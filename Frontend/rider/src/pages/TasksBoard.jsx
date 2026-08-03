import { useEffect, useState } from "react";
import api from "../utils/axios";
import { toast } from "sonner";
import { getSocket, disconnectSocket } from "../lib/socket";
import OrderCard from "../components/OrderCard";
import { playNotificationSound } from "../utils/sound";

export default function TasksBoard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("available"); // available (ready) | active (out_for_delivery)

  const fetchOrders = async () => {
    try {
      const res = await api.get("/orders/all?limit=100");
      const activeOrders = (res.data.orders || []).filter(
        (o) => ["ready", "out_for_delivery"].includes(o.status)
      );
      setOrders(activeOrders);
    } catch (error) {
      toast.error("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const socket = getSocket();

    const handleConnect = () => {
      socket.emit("join:delivery");
      socket.emit("join:delivery_all");
    };
    
    const handleOrderAssigned = (payload) => {
      fetchOrders();
      if (window.__riderSoundEnabled !== false) {
        playNotificationSound();
      }
      toast("🔔 New delivery assigned!", {
        description: `Order #${payload.orderNumber} is ready for pickup.`,
        duration: 8000,
      });
    };

    const handleOrderUpdated = (order) => {
      const orderId = order._id;
      const status = order.status;
      setOrders((prev) => {
        // If order just became ready, add it to list
        if (status === "ready" && !prev.some(o => o._id === orderId)) {
           fetchOrders();
           return prev; 
        }
        
        if (status === "delivered" || status === "cancelled") {
          return prev.filter((o) => o._id !== orderId);
        }
        return prev.map((o) => (o._id === orderId ? { ...o, status } : o));
      });
    };

    socket.on("connect", handleConnect);
    socket.on("order:assigned", handleOrderAssigned);
    socket.on("order:updated", handleOrderUpdated);

    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("order:assigned", handleOrderAssigned);
      socket.off("order:updated", handleOrderUpdated);
      disconnectSocket();
    };
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o)));
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      toast.success(newStatus === "delivered" ? "Delivery Complete! 🎉" : "Order Picked Up!");
      
      // If delivered, remove from list after a short delay
      if (newStatus === "delivered") {
        setTimeout(() => {
          setOrders(prev => prev.filter(o => o._id !== orderId));
        }, 2000);
      }
    } catch (error) {
      toast.error("Failed to update status");
      fetchOrders();
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  const availableOrders = orders.filter(o => o.status === "ready");
  const activeOrders = orders.filter(o => o.status === "out_for_delivery");

  const displayList = tab === "available" ? availableOrders : activeOrders;

  return (
    <div className="p-4">
      <div className="flex bg-slate-200/50 p-1 rounded-xl mb-6">
        <button
          onClick={() => setTab("available")}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            tab === "available" ? "bg-white shadow-sm text-rose-600" : "text-slate-500"
          }`}
        >
          Ready to Pickup
          {availableOrders.length > 0 && (
            <span className="ml-2 bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[10px]">
              {availableOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("active")}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            tab === "active" ? "bg-white shadow-sm text-rose-600" : "text-slate-500"
          }`}
        >
          My Deliveries
          {activeOrders.length > 0 && (
            <span className="ml-2 bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[10px]">
              {activeOrders.length}
            </span>
          )}
        </button>
      </div>

      <div className="space-y-4">
        {displayList.map((order) => (
          <OrderCard key={order._id} order={order} onStatusChange={handleStatusChange} />
        ))}

        {displayList.length === 0 && (
          <div className="text-center pt-12">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <span className="text-2xl">🛵</span>
            </div>
            <h3 className="font-medium text-slate-900">No {tab === "available" ? "orders to pickup" : "active deliveries"}</h3>
            <p className="text-sm text-slate-500 mt-1">Check back soon for new orders.</p>
          </div>
        )}
      </div>
    </div>
  );
}
