import { useState } from "react";
import { format } from "date-fns";
import { Clock, AlertCircle, ChevronDown, ChevronUp, User, MapPin, Utensils, Printer } from "lucide-react";
import PrintBillModal from "./PrintBillModal";

const STATUS_CONFIG = {
  pending: {
    next: "confirmed",
    actionLabel: "✓ Confirm Order",
    actionClass: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    badgeLabel: "New Order",
  },
  confirmed: {
    next: "preparing",
    actionLabel: "🍳 Start Cooking",
    actionClass: "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    badgeLabel: "Confirmed",
  },
  preparing: {
    next: "ready",
    actionLabel: "✅ Mark Ready",
    actionClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    badgeLabel: "Cooking...",
  },
  ready: {
    next: null,
    actionLabel: null,
    actionClass: "",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    badgeLabel: "Ready ✓",
  },
};

export default function OrderCard({ order, onStatusChange }) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showBill, setShowBill] = useState(false);

  const waitMinutes = Math.floor((new Date() - new Date(order.createdAt)) / 60000);
  let timerClass = "bg-emerald-100 text-emerald-700";
  let timerUrgent = false;
  if (waitMinutes > 30) { timerClass = "bg-rose-100 text-rose-700 font-bold"; timerUrgent = true; }
  else if (waitMinutes > 15) timerClass = "bg-amber-100 text-amber-700";

  // Readable wait time string (caps huge test data numbers gracefully)
  const formatWaitTime = (mins) => {
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.ready;

  const handleAction = async () => {
    if (!cfg.next || loading) return;
    setLoading(true);
    await onStatusChange(order._id, cfg.next);
    setLoading(false);
  };

  const customerName = order.guestInfo?.name || order.customer?.name;
  const deliveryType = order.deliveryType === "pickup" ? "Pickup" : "Delivery";

  // Format order number cleanly to avoid header wrapping
  const parts = (order.orderNumber || "").split("-");
  const shortNum = parts.length > 1 ? `#${parts[parts.length - 1]}` : `#${order.orderNumber}`;

  return (
    <>
    {showBill && <PrintBillModal order={order} onClose={() => setShowBill(false)} />}
    <div className={`bg-white rounded-2xl border-2 shadow-sm transition-all duration-200 overflow-hidden ${
      order.status === "pending" ? "border-blue-300 shadow-blue-100" :
      order.status === "confirmed" ? "border-purple-300 shadow-purple-100" :
      order.status === "preparing" ? "border-amber-300 shadow-amber-100" :
      "border-emerald-300 shadow-emerald-100"
    }`}>
      {/* Top Urgency Bar */}
      {timerUrgent && (
        <div className="bg-rose-600 text-white text-[11px] font-bold text-center py-1 flex items-center justify-center gap-1.5 animate-pulse">
          <AlertCircle size={12} />
          WAITING {formatWaitTime(waitMinutes).toUpperCase()} — URGENT!
        </div>
      )}

      {/* Card Header */}
      <div
        className="p-3.5 flex items-center justify-between cursor-pointer select-none border-b border-slate-100 bg-slate-50/50"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex flex-col">
            <span className="font-black text-xl text-slate-900 leading-tight tracking-tight">{shortNum}</span>
            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]" title={order.orderNumber}>
              {order.orderNumber}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${cfg.badge}`}>
              {cfg.badgeLabel}
            </span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${timerClass}`}>
              <Clock size={10} />
              {formatWaitTime(waitMinutes)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {/* Collapsible Body */}
      {expanded && (
        <div className="p-3.5 space-y-3">
          {/* Customer & Type Header */}
          <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
            {customerName ? (
              <span className="flex items-center gap-1 font-semibold text-slate-800 truncate max-w-[140px]">
                <User size={12} className="text-slate-400 shrink-0" />
                <span className="truncate">{customerName}</span>
              </span>
            ) : (
              <span className="text-slate-400 italic">Guest</span>
            )}
            <span className="flex items-center gap-1 font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
              <MapPin size={10} className="text-rose-500" />
              {deliveryType}
            </span>
          </div>

          {/* Items List */}
          <div className="bg-slate-50 rounded-xl divide-y divide-slate-100 border border-slate-100">
            <div className="px-3 py-1.5 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Utensils size={11} /> Items
              </span>
              <span>Qty: {order.items.reduce((s, i) => s + i.quantity, 0)}</span>
            </div>
            {order.items.map((item, idx) => (
              <div key={idx} className="px-3 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-snug">
                    <span className="text-rose-600 font-black mr-1">{item.quantity}×</span>{" "}
                    {item.name}
                  </p>
                  {item.variant && (
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Variant: {typeof item.variant === "object" && item.variant !== null ? (item.variant.name || JSON.stringify(item.variant)) : String(item.variant)}
                    </p>
                  )}
                  {item.addons?.length > 0 && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Addons: {item.addons
                        .map((a) => (typeof a === "object" && a !== null ? (a.name || JSON.stringify(a)) : String(a)))
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  {item.customizations?.length > 0 && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Customizations: {item.customizations
                        .map((c) => (typeof c === "object" && c !== null ? (c.name || JSON.stringify(c)) : String(c)))
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  {item.specialInstructions && (
                    <p className="text-[11px] text-amber-700 font-medium mt-0.5 italic">"{item.specialInstructions}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Special Instructions */}
          {order.specialInstructions && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-tight">{order.specialInstructions}</p>
            </div>
          )}

          {/* Primary Action Button (FULL WIDTH - Never squished) */}
          {cfg.next && (
            <button
              onClick={handleAction}
              disabled={loading}
              className={`w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${cfg.actionClass}`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Updating...
                </span>
              ) : (
                cfg.actionLabel
              )}
            </button>
          )}

          {/* Secondary Action: Print Ticket / Bill */}
          <button
            onClick={() => setShowBill(true)}
            className="w-full py-2 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Printer size={14} className="text-rose-600" />
            Print Ticket / Bill
          </button>

          {order.status === "ready" && (
            <div className="w-full py-2.5 rounded-xl font-bold text-xs text-center bg-emerald-50 text-emerald-700 border border-emerald-200">
              🎉 Ready for Pickup / Dispatch
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
