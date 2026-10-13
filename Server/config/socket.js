const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("ioredis");
const jwt = require("jsonwebtoken");
const { logger, securityLogger } = require("../utils/logger");
const Order = require("../models/Order");
const RiderLocation = require("../models/RiderLocation");

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

  // â”€â”€â”€ Redis Adapter â€” required for horizontal scaling (multiple server instances) â”€â”€
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
    logger.info("âœ… Socket.IO Redis adapter attached (horizontal scaling ready)");
  } catch (err) {
    // Non-fatal in development â€” single-server mode still works
    logger.warn(`Socket.IO Redis adapter failed â€” running in single-server mode: ${err.message}`);
  }

  // â”€â”€â”€ Auth middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        // Guests can connect without a valid token â€” just don't set socket.user
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    const ip = socket.handshake.address;
    logger.debug(`Socket connected: ${socket.id} from ${ip}`);

    // Authorized users join their order room
    socket.on("join:order", async (orderId) => {
      if (!/^[0-9a-f]{24}$/.test(String(orderId || ""))) return;

      try {
        const order = await Order.findById(orderId).select(
          "_id customer deliveryPerson"
        );

        if (!order) return;

        const userId = socket.user?.id || socket.user?._id;
        const userRole = socket.user?.role;

        const isCustomer =
          userRole === "customer" &&
          order.customer?.toString() === String(userId);

        const isAssignedRider =
          userRole === "delivery" &&
          order.deliveryPerson?.toString() === String(userId);

        const isAuthorizedStaff =
          userRole === "admin" || userRole === "kitchen";

        if (!isCustomer && !isAssignedRider && !isAuthorizedStaff) {
          securityLogger.warn(
            `Unauthorized order room join: user ${userId || "guest"} attempted order ${orderId}`
          );
          return;
        }

        socket.join(`order:${order._id}`);
      } catch (error) {
        logger.error(`Order room join failed: ${error.message}`);
      }
    });
    // Customer joins their own room for targeted notifications
    socket.on("join:customer", () => {
      if (socket.user?.role === "customer") {
        socket.join(`customer:${socket.user.id}`); console.log(`Customer joined notification room: customer:${socket.user.id}`);
      }
    });
    // Admin joins the admin room â€” only authenticated admins allowed
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
    socket.on("rider:location:update", async (payload = {}) => {
      if (socket.user?.role !== "delivery") {
        securityLogger.warn(`Unauthorized rider location update from ${socket.handshake.address}`);
        return;
      }

      const {
        orderId,
        latitude,
        longitude,
        accuracy = null,
        heading = null,
        speed = null,
      } = payload;

      if (
        !/^[0-9a-f]{24}$/.test(String(orderId || "")) ||
        !Number.isFinite(Number(latitude)) ||
        !Number.isFinite(Number(longitude)) ||
        Number(latitude) < -90 ||
        Number(latitude) > 90 ||
        Number(longitude) < -180 ||
        Number(longitude) > 180
      ) {
        return;
      }

      try {
        const order = await Order.findOne({
          _id: orderId,
          deliveryPerson: socket.user.id,
          status: "out_for_delivery",
          deliveryType: "delivery",
        }).select("_id");

        if (!order) {
          securityLogger.warn(
            `Rider ${socket.user.id} attempted location update for unauthorized order ${orderId}`
          );
          return;
        }

        const location = await RiderLocation.findOneAndUpdate(
          { rider: socket.user.id },
          {
            $set: {
              latitude: Number(latitude),
              longitude: Number(longitude),
              accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
              heading: Number.isFinite(Number(heading)) ? Number(heading) : null,
              speed: Number.isFinite(Number(speed)) ? Number(speed) : null,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        io.to(`order:${order._id}`).emit("rider:location:update", {
          orderId: String(order._id),
          riderId: String(socket.user.id),
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          heading: location.heading,
          speed: location.speed,
          updatedAt: location.updatedAt,
        });
      } catch (error) {
        logger.error(`Rider location update failed: ${error.message}`);
      }
    });
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
        securityLogger.warn(`Socket event flood from ${ip} â€” disconnecting`);
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

  logger.info("âœ… Socket.IO initialized");
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

const emitCustomerNotification = (userId, notification) => {
  if (!io) return;
  io.to(`customer:${userId}`).emit("notification:new", notification);
};
module.exports = { initSocket, getIO, emitOrderUpdate, emitNewOrder, emitDeliveryAssignment, emitCustomerNotification };
