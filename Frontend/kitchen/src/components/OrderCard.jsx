import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Clock, AlertCircle, ChevronDown, ChevronUp, User, MapPin, Utensils, Printer, XCircle, Pencil, Plus, Search, ArrowLeftCircle } from "lucide-react";
import PrintBillModal from "./PrintBillModal";
import api from "../utils/axios";


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

export default function OrderCard({ order, onStatusChange, onCancelOrder, onEditItems }) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showEditItems, setShowEditItems] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [savingItems, setSavingItems] = useState(false);
  const [pendingAddItems, setPendingAddItems] = useState([]);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerMenuItems, setPickerMenuItems] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSelected, setPickerSelected] = useState(null);
  const [pickerVariantId, setPickerVariantId] = useState(null);
  const [pickerAddonIds, setPickerAddonIds] = useState([]);
  const [pickerQty, setPickerQty] = useState(1);

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

  const canEditOrCancel = !["delivered", "cancelled", "out_for_delivery"].includes(order.status);

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please enter a cancellation reason");
      return;
    }
    setCancelling(true);
    await onCancelOrder(order._id, cancelReason.trim());
    setCancelling(false);
    setShowCancel(false);
    setCancelReason("");
  };

  const openEditItems = () => {
    setDraftItems(order.items.map((it, idx) => ({ ...it, _id: it._id || String(idx) })));
    setPendingAddItems([]);
    setShowAddPicker(false);
    setPickerSelected(null);
    setShowEditItems(true);
  };

  const openAddPicker = () => {
    setShowAddPicker(true);
    setPickerSelected(null);
    setPickerSearch("");
    loadPickerItems("");
  };

  const loadPickerItems = async (term) => {
    setPickerLoading(true);
    try {
      const { data } = await api.get("/menu", { params: { limit: 30, search: term || undefined } });
      setPickerMenuItems(data.items || []);
    } catch {
      toast.error("Failed to load menu");
    } finally {
      setPickerLoading(false);
    }
  };

  // Debounced live search against the backend — scales to any menu size
  // instead of relying on a capped client-side list.
  const pickerSearchTimer = useRef(null);
  useEffect(() => {
    if (!showAddPicker || pickerSelected) return;
    if (pickerSearchTimer.current) clearTimeout(pickerSearchTimer.current);
    pickerSearchTimer.current = setTimeout(() => {
      loadPickerItems(pickerSearch);
    }, 300);
    return () => clearTimeout(pickerSearchTimer.current);
  }, [pickerSearch, showAddPicker]);

  const selectPickerItem = (item) => {
    setPickerSelected(item);
    const firstAvailableVariant = item.variants?.find((v) => v.isAvailable);
    setPickerVariantId(firstAvailableVariant?._id || null);
    setPickerAddonIds([]);
    setPickerQty(1);
  };

  const confirmAddPickedItem = () => {
    const item = pickerSelected;
    if (!item) return;
    const variant = item.variants?.find((v) => v._id === pickerVariantId);
    const addons = (item.addons || []).filter((a) => pickerAddonIds.includes(a._id));
    const unitPrice = variant ? variant.price : item.basePrice;
    setPendingAddItems((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        menuItemId: item._id,
        name: item.name,
        variantId: variant?._id || undefined,
        variantName: variant?.name,
        addonIds: addons.map((a) => a._id),
        addonNames: addons.map((a) => a.name),
        unitPrice,
        quantity: pickerQty,
      },
    ]);
    setShowAddPicker(false);
    setPickerSelected(null);
  };

  const filteredPickerItems = pickerMenuItems.filter((m) =>
    m.name.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const handleSaveItems = async () => {
    if (draftItems.length === 0 && pendingAddItems.length === 0) {
      toast.error("An order must have at least one item — cancel the order instead");
      return;
    }
    const changedItems = draftItems
      .filter((d) => {
        const original = order.items.find((o) => o._id === d._id);
        return original && original.quantity !== d.quantity;
      })
      .map((d) => ({ _id: d._id, quantity: d.quantity }));
    const removeItemIds = order.items
      .filter((o) => !draftItems.some((d) => d._id === o._id))
      .map((o) => o._id);
    const addItems = pendingAddItems.map((p) => ({
      menuItemId: p.menuItemId,
      quantity: p.quantity,
      variantId: p.variantId,
      addonIds: p.addonIds,
    }));
    if (changedItems.length === 0 && removeItemIds.length === 0 && addItems.length === 0) {
      setShowEditItems(false);
      return;
    }
    setSavingItems(true);
    const ok = await onEditItems(order._id, { items: changedItems, removeItemIds, addItems });
    setSavingItems(false);
    if (ok) setShowEditItems(false);
  };

  const customerName = order.guestInfo?.name || order.customer?.name;
  const deliveryType = order.deliveryType === "pickup" ? "Pickup" : "Delivery";

  // Format order number cleanly to avoid header wrapping
  const parts = (order.orderNumber || "").split("-");
  const shortNum = parts.length > 1 ? `#${parts[parts.length - 1]}` : `#${order.orderNumber}`;

  return (
    <>
    {showBill && <PrintBillModal order={order} onClose={() => setShowBill(false)} />}

    {/* Cancel Order Modal */}
    {showCancel && (
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: "var(--gs-z-modal, 1300)", backgroundColor: "oklch(0 0 0 / 0.5)" }}
        onClick={() => !cancelling && setShowCancel(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Cancel order ${shortNum}`}
          onClick={(e) => e.stopPropagation()}
          className="bg-card w-full max-w-sm p-5 space-y-4"
          style={{ borderRadius: "var(--gs-admin-radius-2xl)" }}
        >
          <h2 className="font-bold text-foreground">Cancel Order {shortNum}?</h2>
          <p className="text-sm text-muted-foreground">
            This will notify the customer and can't be undone.
          </p>
          <div className="space-y-1.5">
            <label htmlFor={`cancel-reason-${order._id}`} className="text-xs font-semibold text-foreground">
              Reason *
            </label>
            <input
              id={`cancel-reason-${order._id}`}
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Out of stock, kitchen closed early"
              className="w-full border border-border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              style={{ borderRadius: "var(--gs-admin-radius-lg)" }}
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowCancel(false)}
              disabled={cancelling}
              className="flex-1 py-2 font-semibold text-sm bg-muted hover:bg-muted/80 text-foreground border border-border gs-kitchen-focus-ring"
              style={{ borderRadius: "var(--gs-admin-radius-xl)" }}
            >
              Back
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="flex-1 py-2 font-semibold text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-70 gs-kitchen-focus-ring"
              style={{ borderRadius: "var(--gs-admin-radius-xl)" }}
            >
              {cancelling ? "Cancelling..." : "Confirm Cancel"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit Items Modal — quantity correction, removal, and adding/swapping items */}
    {showEditItems && (
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: "var(--gs-z-modal, 1300)", backgroundColor: "oklch(0 0 0 / 0.5)" }}
        onClick={() => !savingItems && setShowEditItems(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit items for order ${shortNum}`}
          onClick={(e) => e.stopPropagation()}
          className="bg-card w-full max-w-sm p-5 space-y-4 max-h-[85vh] overflow-y-auto"
          style={{ borderRadius: "var(--gs-admin-radius-2xl)" }}
        >
          {showAddPicker ? (
            <>
              <button
                type="button"
                onClick={() => (pickerSelected ? setPickerSelected(null) : setShowAddPicker(false))}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <ArrowLeftCircle size={14} aria-hidden="true" />
                Back
              </button>

              {!pickerSelected ? (
                <>
                  <h2 className="font-bold text-foreground">Add an item</h2>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Search menu…"
                      className="w-full border border-border pl-9 pr-3 py-2 text-sm outline-none focus-visible:ring-2"
                      style={{ borderRadius: "var(--gs-admin-radius-lg)" }}
                      autoFocus
                    />
                  </div>
                  {pickerLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Loading menu…</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                      {filteredPickerItems.map((item) => (
                        <li key={item._id}>
                          <button
                            type="button"
                            onClick={() => selectPickerItem(item)}
                            className="w-full flex items-center justify-between gap-3 border border-border p-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors gs-kitchen-focus-ring"
                            style={{ borderRadius: "var(--gs-admin-radius-lg)" }}
                          >
                            <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                            <span className="text-xs font-mono text-muted-foreground shrink-0">
                              Rs. {item.variants?.length ? item.variants[0].price : item.basePrice}
                            </span>
                          </button>
                        </li>
                      ))}
                      {filteredPickerItems.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">No items found.</p>
                      )}
                    </ul>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <h2 className="font-bold text-foreground">{pickerSelected.name}</h2>
                  {pickerSelected.variants?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">Choose an option</p>
                      <div className="flex flex-col gap-1.5">
                        {pickerSelected.variants.filter((v) => v.isAvailable).map((v) => (
                          <label
                            key={v._id}
                            className="flex items-center justify-between gap-2 border border-border px-3 py-2 text-sm cursor-pointer"
                            style={{ borderRadius: "var(--gs-admin-radius-lg)" }}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="picker-variant"
                                checked={pickerVariantId === v._id}
                                onChange={() => setPickerVariantId(v._id)}
                              />
                              {v.name}
                            </span>
                            <span className="font-mono text-xs">Rs. {v.price}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {pickerSelected.addons?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">Add-ons</p>
                      <div className="flex flex-col gap-1.5">
                        {pickerSelected.addons.filter((a) => a.isAvailable).map((a) => (
                          <label
                            key={a._id}
                            className="flex items-center justify-between gap-2 border border-border px-3 py-2 text-sm cursor-pointer"
                            style={{ borderRadius: "var(--gs-admin-radius-lg)" }}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={pickerAddonIds.includes(a._id)}
                                onChange={() =>
                                  setPickerAddonIds((prev) =>
                                    prev.includes(a._id) ? prev.filter((x) => x !== a._id) : [...prev, a._id]
                                  )
                                }
                              />
                              {a.name}
                            </span>
                            <span className="font-mono text-xs">+Rs. {a.price}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Quantity</span>
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center bg-muted hover:bg-muted/80 text-foreground border border-border gs-kitchen-focus-ring"
                      style={{ borderRadius: "var(--gs-admin-radius-md)" }}
                      onClick={() => setPickerQty((q) => Math.max(1, q - 1))}
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{pickerQty}</span>
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center bg-muted hover:bg-muted/80 text-foreground border border-border gs-kitchen-focus-ring"
                      style={{ borderRadius: "var(--gs-admin-radius-md)" }}
                      onClick={() => setPickerQty((q) => Math.min(10, q + 1))}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={confirmAddPickedItem}
                    className="w-full py-2.5 font-semibold text-sm text-white gs-kitchen-focus-ring"
                    style={{ borderRadius: "var(--gs-admin-radius-xl)", backgroundColor: "var(--gs-kitchen-accent, #e11d48)" }}
                  >
                    Add to order
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="font-bold text-foreground">Edit Items — {shortNum}</h2>
              <p className="text-xs text-muted-foreground">
                Adjust quantities, remove items, or add a different dish — priced fresh off the current menu.
              </p>
              <ul className="space-y-2.5">
                {draftItems.map((item) => (
                  <li
                    key={item._id}
                    className="flex items-center justify-between gap-2 border border-border p-2.5"
                    style={{ borderRadius: "var(--gs-admin-radius-lg)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                      {item.variant?.name && (
                        <p className="text-[11px] text-muted-foreground">{item.variant.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftItems((prev) =>
                            prev.map((d) => (d._id === item._id ? { ...d, quantity: Math.max(1, d.quantity - 1) } : d))
                          )
                        }
                        aria-label={`Decrease quantity of ${item.name}`}
                        className="w-7 h-7 flex items-center justify-center bg-muted hover:bg-muted/80 text-foreground border border-border gs-kitchen-focus-ring"
                        style={{ borderRadius: "var(--gs-admin-radius-md)" }}
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftItems((prev) =>
                            prev.map((d) => (d._id === item._id ? { ...d, quantity: Math.min(10, d.quantity + 1) } : d))
                          )
                        }
                        aria-label={`Increase quantity of ${item.name}`}
                        className="w-7 h-7 flex items-center justify-center bg-muted hover:bg-muted/80 text-foreground border border-border gs-kitchen-focus-ring"
                        style={{ borderRadius: "var(--gs-admin-radius-md)" }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftItems((prev) => prev.filter((d) => d._id !== item._id))}
                        aria-label={`Remove ${item.name}`}
                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 gs-kitchen-focus-ring"
                        style={{ borderRadius: "var(--gs-admin-radius-md)" }}
                      >
                        <XCircle size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}

                {pendingAddItems.map((item) => (
                  <li
                    key={item.tempId}
                    className="flex items-center justify-between gap-2 border border-primary/40 bg-primary/5 p-2.5"
                    style={{ borderRadius: "var(--gs-admin-radius-lg)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {item.name}
                        {item.variantName && <span className="font-normal text-muted-foreground"> ({item.variantName})</span>}
                        <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-primary">New</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">Rs. {item.unitPrice} each</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setPendingAddItems((prev) => prev.filter((p) => p.tempId !== item.tempId))}
                        aria-label={`Remove ${item.name}`}
                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 gs-kitchen-focus-ring"
                        style={{ borderRadius: "var(--gs-admin-radius-md)" }}
                      >
                        <XCircle size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={openAddPicker}
                className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors gs-kitchen-focus-ring"
                style={{ borderRadius: "var(--gs-admin-radius-lg)" }}
              >
                <Plus size={14} aria-hidden="true" />
                Add / swap an item
              </button>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowEditItems(false)}
                  disabled={savingItems}
                  className="flex-1 py-2 font-semibold text-sm bg-muted hover:bg-muted/80 text-foreground border border-border gs-kitchen-focus-ring"
                  style={{ borderRadius: "var(--gs-admin-radius-xl)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveItems}
                  disabled={savingItems}
                  className="flex-1 py-2 font-semibold text-sm text-white disabled:opacity-70 gs-kitchen-focus-ring"
                  style={{ borderRadius: "var(--gs-admin-radius-xl)", backgroundColor: "var(--gs-kitchen-accent, #e11d48)" }}
                >
                  {savingItems ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    <article
      className={`bg-card border-2 shadow-sm transition-all duration-200 overflow-hidden ${
        order.status === "pending" ? "border-blue-300 shadow-blue-100" :
        order.status === "confirmed" ? "border-purple-300 shadow-purple-100" :
        order.status === "preparing" ? "border-amber-300 shadow-amber-100" :
        "border-emerald-300 shadow-emerald-100"
      }`}
      style={{ borderRadius: "var(--gs-admin-radius-2xl)" }}
      aria-label={`Order ${shortNum}, ${cfg.badgeLabel}, ${customerName || "Guest"}, ${formatWaitTime(waitMinutes)}`}
    >
      {/* Top Urgency Bar */}
      {timerUrgent && (
        <div
          className="bg-rose-600 text-white text-[11px] font-bold text-center py-1 flex items-center justify-center gap-1.5 animate-pulse"
          role="alert"
        >
          <AlertCircle size={12} aria-hidden="true" />
          WAITING {formatWaitTime(waitMinutes).toUpperCase()} — URGENT!
        </div>
      )}

      {/* Card Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} order ${shortNum} details`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(v => !v); } }}
        className="p-3.5 flex items-center justify-between cursor-pointer select-none border-b border-border bg-muted/50 gs-kitchen-focus-ring"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex flex-col">
            <span className="font-black text-xl text-foreground leading-tight tracking-tight">{shortNum}</span>
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[110px]" title={order.orderNumber}>
              {order.orderNumber}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 text-[10px] font-extrabold border ${cfg.badge}`}
              style={{ borderRadius: "var(--gs-admin-radius-full)" }}
            >
              {cfg.badgeLabel}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium ${timerClass}`}
              style={{ borderRadius: "var(--gs-admin-radius-full)" }}
            >
              <Clock size={10} aria-hidden="true" />
              {formatWaitTime(waitMinutes)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" style={{ borderRadius: "var(--gs-admin-radius-lg)" }}>
            {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
          </div>
        </div>
      </div>

      {/* Collapsible Body */}
      {expanded && (
        <div className="p-3.5 space-y-3">
          {/* Customer & Type Header */}
          <div
            className="flex items-center justify-between text-xs text-muted-foreground bg-muted/80 px-2.5 py-1.5 border border-border"
            style={{ borderRadius: "var(--gs-admin-radius-lg)" }}
          >
            {customerName ? (
              <span className="flex items-center gap-1 font-semibold text-foreground truncate max-w-[140px]">
                <User size={12} className="text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">{customerName}</span>
              </span>
            ) : (
              <span className="text-muted-foreground/60 italic">Guest</span>
            )}
            <span
              className="flex items-center gap-1 font-bold text-foreground bg-card px-2 py-0.5 border border-border text-[10px]"
              style={{ borderRadius: "var(--gs-admin-radius-md)" }}
            >
              <MapPin size={10} className="text-red-500" aria-hidden="true" />
              {deliveryType}
            </span>
          </div>

          {/* Items List */}
          <div
            className="bg-muted divide-y divide-border border border-border"
            style={{ borderRadius: "var(--gs-admin-radius-xl)" }}
          >
            <div className="px-3 py-1.5 flex items-center justify-between text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Utensils size={11} aria-hidden="true" /> Items
              </span>
              <span>Qty: {order.items.reduce((s, i) => s + i.quantity, 0)}</span>
            </div>
            {order.items.map((item, idx) => (
              <div key={idx} className="px-3 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground leading-snug">
                    <span className="font-black mr-1" style={{ color: "var(--gs-kitchen-accent)" }}>{item.quantity}×</span>{" "}
                    {item.name}
                  </p>
                  {item.variant && (
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                      Variant: {typeof item.variant === "object" && item.variant !== null ? (item.variant.name || JSON.stringify(item.variant)) : String(item.variant)}
                    </p>
                  )}
                  {item.addons?.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Addons: {item.addons
                        .map((a) => (typeof a === "object" && a !== null ? (a.name || JSON.stringify(a)) : String(a)))
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  {item.customizations?.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
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
            <div
              className="flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2"
              role="note"
              style={{ borderRadius: "var(--gs-admin-radius-xl)" }}
            >
              <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-800 font-medium leading-tight">{order.specialInstructions}</p>
            </div>
          )}

          {/* Primary Action Button (FULL WIDTH - Never squished) */}
          {cfg.next && (
            <button
              onClick={handleAction}
              disabled={loading}
              aria-busy={loading}
              aria-label={`${cfg.actionLabel} for order ${shortNum}`}
              className={`w-full py-2.5 font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed gs-kitchen-focus-ring ${cfg.actionClass}`}
              style={{ borderRadius: "var(--gs-admin-radius-xl)", minHeight: "44px" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
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
            aria-label={`Print ticket or bill for order ${shortNum}`}
            className="w-full py-2 font-semibold text-xs bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center justify-center gap-1.5 transition-colors gs-kitchen-focus-ring"
            style={{ borderRadius: "var(--gs-admin-radius-xl)", minHeight: "44px" }}
          >
            <Printer size={14} aria-hidden="true" style={{ color: "var(--gs-kitchen-accent)" }} />
            Print Ticket / Bill
          </button>

          {/* Edit / Cancel — corrections made before the order goes out */}
          {canEditOrCancel && (
            <div className="flex gap-2">
              <button
                onClick={openEditItems}
                aria-label={`Edit items for order ${shortNum}`}
                className="flex-1 py-2 font-semibold text-xs bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center justify-center gap-1.5 transition-colors gs-kitchen-focus-ring"
                style={{ borderRadius: "var(--gs-admin-radius-xl)", minHeight: "40px" }}
              >
                <Pencil size={13} aria-hidden="true" />
                Edit Items
              </button>
              <button
                onClick={() => setShowCancel(true)}
                aria-label={`Cancel order ${shortNum}`}
                className="flex-1 py-2 font-semibold text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center gap-1.5 transition-colors gs-kitchen-focus-ring"
                style={{ borderRadius: "var(--gs-admin-radius-xl)", minHeight: "40px" }}
              >
                <XCircle size={13} aria-hidden="true" />
                Cancel
              </button>
            </div>
          )}

          {order.status === "ready" && (
            <div
              className="w-full py-2.5 font-bold text-xs text-center bg-emerald-50 text-emerald-700 border border-emerald-200"
              role="status"
              style={{ borderRadius: "var(--gs-admin-radius-xl)" }}
            >
              🎉 Ready for Pickup / Dispatch
            </div>
          )}
        </div>
      )}
    </article>
    </>
  );
}