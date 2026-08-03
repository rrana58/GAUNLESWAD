const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("ioredis");
const jwt = require("jsonwebtoken");
const { logger, securityLogger } = require("../utils/logger");

let io;

const initSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.WEB_URL,
        process.env.ADMIN_URL,
        ...(process.env.NODE_ENV === "development"
          ? [
              "http://localhost:3000",
              "http://localhost:3001",
              "http://localhost:5173",
              "http://localhost:5174",
              "http://localhost:5175",
              "http://localhost:5176",
              "http://localhost:5177",
            ]
          : []),
      ].filter(Boolean),
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e4,
    transports: ["websocket", "polling"],
  });

  // ─── Redis Adapter — required for horizontal scaling (multiple server instances) ──
  // Without this, a socket event emitted from Server A won't reach clients on Server B.
  try {
    const pubClient = createClient(process.env.REDIS_URL || "redis://localhost:6379", {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => logger.error(`Socket pub-Redis error: ${err.message}`));
    subClient.on("error", (err) => logger.error(`Socket sub-Redis error: ${err.message}`));

    io.adapter(createAdapter(pubClient, subClient));
    logger.info("✅ Socket.IO Redis adapter attached (horizontal scaling ready)");
  } catch (err) {
    // Non-fatal in development — single-server mode still works
    logger.warn(`Socket.IO Redis adapter failed — running in single-server mode: ${err.message}`);
  }

  // ─── Auth middleware ────────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const ip = socket.handshake.address;

    if (token) {
      if (token.length > 2048) {
        securityLogger.warn(`Socket oversized token from ${ip}`);
        return next(new Error("Invalid token"));
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
          algorithms: ["HS256"],
          issuer: "gharko-swad",
          audience: "gharko-swad-client",
        });
        socket.user = decoded;
      } catch {
        // Guests can connect without a valid token — just don't set socket.user
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    const ip = socket.handshake.address;
    logger.debug(`Socket connected: ${socket.id} from ${ip}`);

    // Customer joins their order room
    socket.on("join:order", (orderId) => {
      if (!/^[0-9a-f]{24}$/.test(orderId)) return;
      socket.join(`order:${orderId}`);
    });

    // Admin joins the admin room — only authenticated admins allowed
    socket.on("join:admin", () => {
      if (socket.user?.role === "admin") {
        socket.join("admin");
        logger.debug(`Admin socket joined: ${socket.id}`);
      } else {
        securityLogger.warn(`Unauthorized admin socket join from ${ip}`);
        socket.disconnect(true);
      }
    });

    // Delivery person joins their own room for targeted notifications
    socket.on("join:delivery", () => {
      if (socket.user?.role === "delivery") {
        socket.join(`delivery:${socket.user.id}`);
      }
    });

    // Kitchen joins kitchen room
    socket.on("join:kitchen", () => {
      if (socket.user?.role === "kitchen" || socket.user?.role === "admin") {
        socket.join("kitchen");
      }
    });

    // Delivery joins global delivery room for all updates
    socket.on("join:delivery_all", () => {
      if (socket.user?.role === "delivery" || socket.user?.role === "admin") {
        socket.join("delivery_all");
      }
    });

    // Event flood limiter
    let eventCount = 0;
    const eventResetTimer = setInterval(() => { eventCount = 0; }, 60000);
    socket.use((packet, next) => {
      eventCount++;
      if (eventCount > 50) {
        securityLogger.warn(`Socket event flood from ${ip} — disconnecting`);
        socket.disconnect(true);
        return;
      }
      next();
    });

    socket.on("disconnect", () => {
      clearInterval(eventResetTimer);
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info("✅ Socket.IO initialized");
  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
};

const emitOrderUpdate = (order) => {
  if (!io) return;
  const safeOrder = {
    _id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusHistory: order.statusHistory,
    estimatedDeliveryTime: order.estimatedDeliveryTime,
    updatedAt: order.updatedAt,
  };
  io.to(`order:${order._id}`).emit("order:updated", safeOrder);
  io.to("admin").to("kitchen").to("delivery_all").emit("order:updated", order); // Staff gets full order
};

const emitNewOrder = (order) => {
  if (!io) return;
  io.to("admin").to("kitchen").emit("order:new", order);
};

/** Notify a specific delivery person when an order is Ready for pickup */
const emitDeliveryAssignment = (deliveryUserId, order) => {
  if (!io) return;
  io.to(`delivery:${deliveryUserId}`).emit("order:assigned", {
    _id: order._id,
    orderNumber: order.orderNumber,
    deliveryAddress: order.deliveryAddress,
    status: order.status,
  });
};

module.exports = { initSocket, getIO, emitOrderUpdate, emitNewOrder, emitDeliveryAssignment };
