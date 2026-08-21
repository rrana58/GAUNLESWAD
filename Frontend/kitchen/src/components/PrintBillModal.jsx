import { useState, useRef, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { X, Printer, Utensils, Receipt } from "lucide-react";


const VAT_RATE = 0.13; // 13% Nepal VAT

export default function PrintBillModal({ order, onClose }) {
  const [printType, setPrintType] = useState("bill"); // 'bill' | 'kot'
  const printRef = useRef(null);
  const modalRef = useRef(null);
  const closeRef = useRef(null);

  // Focus trap & Escape key handler
  useEffect(() => {
    // Focus the close button on mount
    closeRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Trap focus within modal
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!order) return null;

  // ── Calculations ──────────────────────────────────────────────────────────
  const subtotal = order.subtotal
    ?? order.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const deliveryCharge = order.deliveryCharge ?? order.deliveryFee ?? 0;
  const discount = order.discount ?? 0;
  const taxableAmount = subtotal - discount;
  const vat = order.tax ?? Math.round(taxableAmount * VAT_RATE * 100) / 100;
  const total = order.total ?? order.totalAmount ?? (taxableAmount + vat + deliveryCharge);

  const customerName =
    order.guestInfo?.name || order.customer?.name || "Walk-in Customer";
  const customerPhone =
    order.guestInfo?.phone || order.customer?.phone || "";
  const deliveryType = order.deliveryType === "pickup" ? "PICKUP" : "HOME DELIVERY";

  const handlePrint = (type = printType) => {
    const style = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: #fff; width: 80mm; padding: 2mm; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .big { font-size: 16px; }
        .xl { font-size: 22px; font-weight: 900; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .double { border-top: 2px solid #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .row-left { flex: 1; }
        .row-right { text-align: right; min-width: 60px; }
        .item-name { font-weight: bold; font-size: 13px; }
        .item-sub { font-size: 11px; color: #222; padding-left: 6px; }
        .total-row { font-size: 14px; font-weight: bold; }
        .footer { text-align: center; font-size: 10px; margin-top: 6px; }
        @media print {
          @page { size: 80mm auto; margin: 2mm; }
          body { width: 100%; }
        }
      </style>
    `;

    let html = '';

    if (type === 'kot') {
      const kotItems = order.items
        .map((item) => {
          const variantStr = item.variant ? (typeof item.variant === "object" ? item.variant.name : String(item.variant)) : "";
          const addonsStr = item.addons?.length > 0 ? item.addons.map(a => typeof a === "object" ? a.name : String(a)).filter(Boolean).join(", ") : "";
          const subs = [
            variantStr ? `Variant: ${variantStr}` : "",
            addonsStr ? `Addons: ${addonsStr}` : "",
            item.specialInstructions ? `NOTE: ${item.specialInstructions}` : "",
          ]
            .filter(Boolean)
            .map((s) => `<div class="item-sub">* ${s}</div>`)
            .join("");

          return `
            <div style="margin-bottom:8px;">
              <div class="item-name" style="font-size:15px;">[ ${item.quantity}x ] ${item.name}</div>
              ${subs}
            </div>`;
        })
        .join("");

      html = `
        <!DOCTYPE html>
        <html>
        <head><title>KOT - #${order.orderNumber}</title>${style}</head>
        <body>
          <div class="center">
            <div class="xl">*** KITCHEN TICKET ***</div>
            <div class="big bold" style="margin-top:4px;">ORDER #${order.orderNumber}</div>
            <div style="font-size:14px;font-weight:bold;margin-top:2px;">[ ${deliveryType} ]</div>
            <div>${format(new Date(order.createdAt), "dd MMM yyyy, h:mm:ss a")}</div>
          </div>

          <div class="double"></div>

          <div class="row"><span>Customer:</span><span class="bold">${customerName}</span></div>
          ${order.specialInstructions ? `<div style="background:#000;color:#fff;padding:4px;font-weight:bold;margin:4px 0;text-align:center;">SPECIAL: ${order.specialInstructions}</div>` : ""}

          <div class="double"></div>
          <div class="bold" style="font-size:14px;margin-bottom:6px;">ITEMS TO PREPARE:</div>

          ${kotItems}

          <div class="double"></div>
          <div class="center bold" style="font-size:11px;">END OF KOT #${order.orderNumber}</div>
        </body>
        </html>`;
    } else {
      const itemRows = order.items
        .map((item) => {
          const lineTotal = (item.price ?? 0) * item.quantity;
          const variantStr = item.variant ? (typeof item.variant === "object" ? item.variant.name : String(item.variant)) : "";
          const addonsStr = item.addons?.length > 0 ? item.addons.map(a => typeof a === "object" ? a.name : String(a)).filter(Boolean).join(", ") : "";
          const subs = [
            variantStr ? `  Variant: ${variantStr}` : "",
            addonsStr ? `  Addons: ${addonsStr}` : "",
            item.specialInstructions ? `  Note: ${item.specialInstructions}` : "",
          ]
            .filter(Boolean)
            .map((s) => `<div class="item-sub">${s}</div>`)
            .join("");
          return `
            <div class="row">
              <div class="row-left">
                <div class="item-name">${item.quantity}x ${item.name}</div>
                ${subs}
              </div>
              <div class="row-right">Rs. ${lineTotal.toFixed(2)}</div>
            </div>`;
        })
        .join("");

      html = `
        <!DOCTYPE html>
        <html>
        <head><title>Bill - Gaunle Swad - #${order.orderNumber}</title>${style}</head>
        <body>
          <div class="center">
            <div class="xl bold">🍽️ Gaunle Swad</div>
            <div>Cloud Kitchen</div>
            <div>Pokhara, Nepal</div>
            <div>Ph: 01-XXXXXXX</div>
          </div>

          <div class="divider"></div>

          <div class="row"><span>Order #:</span><span class="bold">${order.orderNumber}</span></div>
          <div class="row"><span>Date:</span><span>${format(new Date(order.createdAt), "dd MMM yyyy, h:mm a")}</span></div>
          <div class="row"><span>Customer:</span><span class="bold">${customerName}</span></div>
          ${customerPhone ? `<div class="row"><span>Phone:</span><span>${customerPhone}</span></div>` : ""}
          <div class="row"><span>Type:</span><span class="bold">${deliveryType}</span></div>
          ${
            order.deliveryAddress?.street
              ? `<div class="row"><span>Address:</span><span style="text-align:right;max-width:50%;">${order.deliveryAddress.street}${order.deliveryAddress.area ? ", " + order.deliveryAddress.area : ""}</span></div>`
              : ""
          }

          <div class="divider"></div>
          <div class="bold" style="margin-bottom:4px;">ORDER ITEMS</div>
          ${itemRows}

          <div class="divider"></div>
          <div class="row"><span>Subtotal</span><span>Rs. ${subtotal.toFixed(2)}</span></div>
          ${discount > 0 ? `<div class="row"><span>Discount</span><span>- Rs. ${discount.toFixed(2)}</span></div>` : ""}
          ${deliveryCharge > 0 ? `<div class="row"><span>Delivery Charge</span><span>Rs. ${deliveryCharge.toFixed(2)}</span></div>` : ""}
          <div class="row"><span>VAT (13%)</span><span>Rs. ${vat.toFixed(2)}</span></div>

          <div class="double"></div>
          <div class="row total-row"><span>TOTAL</span><span>Rs. ${total.toFixed(2)}</span></div>
          <div class="double"></div>

          <div class="row" style="margin-top:4px;"><span>Payment:</span><span class="bold">${(order.paymentMethod || "COD").toUpperCase()}</span></div>

          <div class="divider"></div>
          <div class="footer">
            <div>Thank you for choosing Gaunle Swad!</div>
            <div>Powered by Gharko Swad Platform</div>
            <div style="margin-top:4px;font-size:9px;">Order ID: ${order._id}</div>
          </div>
        </body>
        </html>`;
    }

    const win = window.open("", "_blank", "width=380,height=700");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      style={{ zIndex: "var(--gs-kitchen-z-modal, 50)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Print ticket or bill for order #${order.orderNumber}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        className="bg-card shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
        style={{ borderRadius: "var(--gs-admin-radius-2xl)" }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground text-lg flex items-center gap-2">
              <Printer size={20} aria-hidden="true" style={{ color: "var(--gs-kitchen-accent)" }} />
              Print Thermal Ticket / Bill
            </h2>
            <p className="text-xs text-muted-foreground">Order #{order.orderNumber}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close print dialog"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors gs-kitchen-focus-ring"
            style={{ borderRadius: "var(--gs-admin-radius-xl)" }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Print Mode Selector Tabs */}
        <div className="px-5 pt-3 flex gap-2" role="tablist" aria-label="Print type selection">
          <button
            role="tab"
            aria-selected={printType === "bill"}
            aria-controls="print-preview"
            onClick={() => setPrintType("bill")}
            className={`flex-1 py-2 px-3 font-bold text-xs flex items-center justify-center gap-1.5 transition-all gs-kitchen-focus-ring ${
              printType === "bill"
                ? "text-white shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            style={{
              borderRadius: "var(--gs-admin-radius-xl)",
              ...(printType === "bill" ? { backgroundColor: "var(--gs-kitchen-accent)", boxShadow: "var(--gs-kitchen-shadow-sm)" } : {}),
            }}
          >
            <Receipt size={14} aria-hidden="true" />
            Customer Bill
          </button>
          <button
            role="tab"
            aria-selected={printType === "kot"}
            aria-controls="print-preview"
            onClick={() => setPrintType("kot")}
            className={`flex-1 py-2 px-3 font-bold text-xs flex items-center justify-center gap-1.5 transition-all gs-kitchen-focus-ring ${
              printType === "kot"
                ? "bg-foreground text-card shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            style={{ borderRadius: "var(--gs-admin-radius-xl)" }}
          >
            <Utensils size={14} aria-hidden="true" />
            Kitchen Ticket
          </button>
        </div>

        {/* Bill Preview */}
        <div className="flex-1 overflow-y-auto p-5" id="print-preview" role="tabpanel">
          <div
            ref={printRef}
            className="font-mono text-xs bg-card border border-dashed border-border p-5 mx-auto shadow-inner"
            style={{ maxWidth: "320px", borderRadius: "var(--gs-admin-radius-xl)" }}
          >
            {printType === "kot" ? (
              /* KOT PREVIEW */
              <div>
                <div className="text-center mb-3">
                  <p className="text-lg font-black tracking-wider">*** KITCHEN TICKET ***</p>
                  <p className="text-base font-black" style={{ color: "var(--gs-kitchen-accent)" }}>ORDER #{order.orderNumber}</p>
                  <span
                    className="inline-block bg-foreground text-card px-2 py-0.5 text-[11px] font-bold mt-1"
                    style={{ borderRadius: "var(--gs-admin-radius-sm)" }}
                  >
                    {deliveryType}
                  </span>
                </div>

                <div className="border-t-2 border-foreground my-2" />

                <div className="text-[12px] space-y-1">
                  <p><span className="text-muted-foreground">Customer:</span> <span className="font-bold">{customerName}</span></p>
                  <p><span className="text-muted-foreground">Time:</span> {format(new Date(order.createdAt), "h:mm:ss a")}</p>
                </div>

                {order.specialInstructions && (
                  <div
                    className="bg-amber-100 text-amber-900 p-2 font-bold text-[11px] my-2 text-center border border-amber-300"
                    style={{ borderRadius: "var(--gs-admin-radius-md)" }}
                  >
                    ⚠️ SPECIAL: {order.specialInstructions}
                  </div>
                )}

                <div className="border-t-2 border-foreground my-2" />

                <p className="font-black text-[11px] uppercase tracking-wider text-foreground mb-2">
                  ITEMS TO COOK:
                </p>

                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="border-b border-border pb-1.5 last:border-0">
                      <p className="font-black text-sm text-foreground">
                        <span className="font-black" style={{ color: "var(--gs-kitchen-accent)" }}>[{item.quantity}x]</span> {item.name}
                      </p>
                      {item.variant && (
                        <p className="text-muted-foreground text-[11px] pl-3 font-semibold">
                          * Variant: {typeof item.variant === "object" ? item.variant.name || JSON.stringify(item.variant) : String(item.variant)}
                        </p>
                      )}
                      {item.addons?.length > 0 && (
                        <p className="text-muted-foreground text-[11px] pl-3">
                          * Addons: {item.addons.map(a => typeof a === "object" ? a.name : String(a)).filter(Boolean).join(", ")}
                        </p>
                      )}
                      {item.specialInstructions && (
                        <p className="text-amber-700 text-[11px] pl-3 font-semibold italic">
                          * NOTE: {item.specialInstructions}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t-2 border-foreground my-3" />
                <p className="text-center font-bold text-[10px] text-muted-foreground/60">END OF KOT #{order.orderNumber}</p>
              </div>
            ) : (
              /* CUSTOMER RECEIPT PREVIEW */
              <div>
                <div className="text-center mb-3">
                  <p className="text-xl font-black">🍽️ Gaunle Swad</p>
                  <p className="text-muted-foreground">Cloud Kitchen</p>
                  <p className="text-muted-foreground/60 text-[11px]">Pokhara, Nepal</p>
                </div>

                <div className="border-t border-dashed border-border my-2" />

                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order #</span>
                    <span className="font-bold">{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{format(new Date(order.createdAt), "dd MMM yyyy, h:mm a")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-bold">{customerName}</span>
                  </div>
                  {customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span>{customerPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-bold">{deliveryType}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-border my-2" />

                <p className="font-bold text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                  Order Items
                </p>
                <div className="space-y-2">
                  {order.items.map((item, idx) => {
                    const lineTotal = (item.price ?? 0) * item.quantity;
                    return (
                      <div key={idx}>
                        <div className="flex justify-between">
                          <span className="font-semibold">
                            <span style={{ color: "var(--gs-kitchen-accent)" }}>{item.quantity}×</span> {item.name}
                          </span>
                          <span className="font-semibold whitespace-nowrap ml-2">
                            Rs. {lineTotal.toFixed(2)}
                          </span>
                        </div>
                        {item.variant && (
                          <p className="text-muted-foreground/60 text-[10px] pl-2">
                            Variant: {typeof item.variant === "object" ? item.variant.name || JSON.stringify(item.variant) : String(item.variant)}
                          </p>
                        )}
                        {item.addons?.length > 0 && (
                          <p className="text-muted-foreground/60 text-[10px] pl-2">
                            Addons: {item.addons.map(a => typeof a === "object" ? a.name : String(a)).filter(Boolean).join(", ")}
                          </p>
                        )}
                        {item.specialInstructions && (
                          <p className="text-amber-600 text-[10px] pl-2 italic">
                            Note: {item.specialInstructions}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-dashed border-border my-2" />

                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>Rs. {subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount</span>
                      <span>- Rs. {discount.toFixed(2)}</span>
                    </div>
                  )}
                  {deliveryCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Charge</span>
                      <span>Rs. {deliveryCharge.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT (13%)</span>
                    <span>Rs. {vat.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t-2 border-foreground my-2" />

                <div className="flex justify-between font-black text-base">
                  <span>TOTAL</span>
                  <span>Rs. {total.toFixed(2)}</span>
                </div>

                <div className="border-t-2 border-foreground my-2" />

                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="font-bold uppercase">{order.paymentMethod || "COD"}</span>
                </div>

                <div className="border-t border-dashed border-border my-3" />

                <div className="text-center text-[11px] text-muted-foreground/60 space-y-0.5">
                  <p className="font-semibold text-muted-foreground">Thank you for choosing Gaunle Swad!</p>
                  <p>Powered by Gharko Swad Platform</p>
                  <p className="text-[9px] mt-1 text-muted-foreground/30 break-all">ID: {order._id}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button
            onClick={() => handlePrint("kot")}
            aria-label="Print kitchen ticket"
            className="flex-1 py-2.5 font-bold text-xs bg-muted hover:bg-muted/80 text-foreground transition-colors flex items-center justify-center gap-1.5 gs-kitchen-focus-ring"
            style={{ borderRadius: "var(--gs-admin-radius-xl)", minHeight: "44px" }}
          >
            <Utensils size={15} aria-hidden="true" />
            Print Kitchen Ticket
          </button>
          <button
            onClick={() => handlePrint("bill")}
            aria-label="Print customer bill"
            className="flex-1 py-2.5 font-bold text-xs bg-foreground hover:opacity-90 text-card transition-colors flex items-center justify-center gap-1.5 shadow-md gs-kitchen-focus-ring"
            style={{ borderRadius: "var(--gs-admin-radius-xl)", minHeight: "44px" }}
          >
            <Printer size={15} aria-hidden="true" />
            Print Bill
          </button>
        </div>
      </div>
    </div>
  );
}
