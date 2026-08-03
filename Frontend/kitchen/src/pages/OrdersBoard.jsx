import { useEffect, useState, useCallback } from "react";
import api from "../utils/axios";
import { toast } from "sonner";
import { getSocket, disconnectSocket } from "../lib/socket";
import OrderCard from "../components/OrderCard";
import { RefreshCw } from "lucide-react";
import { playNotificationSound } from "../utils/sound";

const COLUMNS = [
  {
    id: "pending",
    title: "New Orders",
    subtitle: "Awaiting confirmation",
    icon: "🔔",
    headerClass: "bg-blue-600 text-white",
    countClass: "bg-white/20 text-white",
    emptyMsg: "No new orders",
  },
  {
    id: "confirmed",
    title: "Confirmed",
    subtitle: "Ready to start cooking",
    icon: "✓",
    headerClass: "bg-purple-600 text-white",
    countClass: "bg-white/20 text-white",
    emptyMsg: "No confirmed orders",
  },
  {
    id: "preparing",
    title: "Cooking",
    subtitle: "In the kitchen now",
    icon: "🍳",
    headerClass: "bg-amber-500 text-white",
    countClass: "bg-white/20 text-white",
    emptyMsg: "Nothing cooking",
  },
  {
    id: "ready",
    title: "Ready",
    subtitle: "Waiting for pickup/rider",
    icon: "✅",
    headerClass: "bg-emerald-600 text-white",
    countClass: "bg-white/20 text-white",
    emptyMsg: "No orders ready",
  },
];

export default function OrdersBoard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/orders/all?limit=100");
      const activeOrders = (res.data.orders || []).filter(
        (o) => ["pending", "confirmed", "preparing", "ready"].includes(o.status)
      );
      setOrders(activeOrders);
      setLastUpdated(new Date());
    } catch (error) {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const socket = getSocket();

    const handleConnect = () => {
      socket.emit("join:kitchen");
    };

    const handleOrderNew = (order) => {
      setOrders((prev) => {
        if (prev.some((o) => o._id === order._id)) return prev;
        return [order, ...prev];
      });
      // Only play if not muted — mirrors the admin panel behaviour
      if (window.__kitchenSoundEnabled !== false) {
        playNotificationSound("newOrder");
      }
      toast("🔔 New Order!", {
        description: `Order #${order.orderNumber} needs confirmation.`,
        duration: 8000,
      });
    };

    const handleOrderUpdated = (order) => {
      const { _id: orderId, status } = order;
      setOrders((prev) => {
        if (status === "delivered" || status === "cancelled" || status === "out_for_delivery") {
          return prev.filter((o) => o._id !== orderId);
        }
        if (["pending", "confirmed", "preparing", "ready"].includes(status)) {
          const exists = prev.some((o) => o._id === orderId);
          if (!exists) return [order, ...prev];
          return prev.map((o) => (o._id === orderId ? { ...o, ...order } : o));
        }
        return prev;
      });
    };

    socket.on("connect", handleConnect);
    socket.on("order:new", handleOrderNew);
    socket.on("order:updated", handleOrderUpdated);

    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("order:new", handleOrderNew);
      socket.off("order:updated", handleOrderUpdated);
      disconnectSocket();
    };
  }, [fetchOrders]);

  const handleStatusChange = useCallback(async (orderId, newStatus) => {
    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o))
    );
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      const labels = {
        confirmed: "Order confirmed!",
        preparing: "Cooking started! 🍳",
        ready: "Order is ready! ✅",
      };
      toast.success(labels[newStatus] || `Status updated`);
    } catch (error) {
      toast.error("Failed to update status");
      fetchOrders(true);
    }
  }, [fetchOrders]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading orders...</p>
        </div>
      </div>
    );
  }

  const totalActive = orders.filter(o => o.status !== "ready").length;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Stats Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {COLUMNS.map((col) => {
            const count = orders.filter(o => o.status === col.id).length;
            return (
              <div key={col.id} className="flex items-center gap-2">
                <span className="text-lg">{col.icon}</span>
                <div>
                  <p className="text-xs text-slate-500">{col.title}</p>
                  <p className="text-xl font-black text-slate-800 leading-none">{count}</p>
                </div>
              </div>
            );
          })}
          <div className="h-8 w-px bg-slate-200 mx-1" />
          <div>
            <p className="text-xs text-slate-500">Active</p>
            <p className={`text-xl font-black leading-none ${totalActive > 0 ? "text-rose-600" : "text-slate-800"}`}>{totalActive}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <p className="text-xs text-slate-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden min-h-0">
        {COLUMNS.map((col) => {
          const colOrders = orders
            .filter((o) => o.status === col.id)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

          return (
            <div key={col.id} className="flex flex-col rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white min-h-0">
              {/* Column Header */}
              <div className={`${col.headerClass} px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{col.icon}</span>
                    <div>
                      <h2 className="font-bold text-sm leading-tight">{col.title}</h2>
                      <p className="text-xs opacity-80">{col.subtitle}</p>
                    </div>
                  </div>
                  <span className={`${col.countClass} text-sm font-black px-2.5 py-1 rounded-lg min-w-[2rem] text-center`}>
                    {colOrders.length}
                  </span>
                </div>
              </div>

              {/* Orders List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                {colOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-4xl mb-2 opacity-30">{col.icon}</div>
                    <p className="text-slate-400 text-sm font-medium">{col.emptyMsg}</p>
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <OrderCard
                      key={order._id}
                      order={order}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
