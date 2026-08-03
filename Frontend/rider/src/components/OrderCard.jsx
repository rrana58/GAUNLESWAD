import { format } from "date-fns";
import { MapPin, Phone, CheckCircle, Navigation } from "lucide-react";

export default function OrderCard({ order, onStatusChange }) {
  const address = order.deliveryAddress;
  const isSubscription = order.orderType === "subscription";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
        <div>
          <span className="font-mono font-bold text-lg text-slate-900">#{order.orderNumber}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${isSubscription ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isSubscription ? 'Subscription' : 'Normal'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {format(new Date(order.createdAt), "h:mm a")}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-900">Rs. {order.totalAmount}</p>
          <p className="text-[10px] font-medium text-slate-500 uppercase">{order.paymentMethod}</p>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="bg-rose-50 p-1.5 rounded-lg text-rose-600 mt-0.5 shrink-0">
            <MapPin size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{address?.street}</p>
            <p className="text-xs text-slate-500">{address?.area}</p>
            {address?.label && (
              <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded font-medium">
                {address.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600 shrink-0">
            <Phone size={16} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {order.customer?.name || order.guestInfo?.name}
            </p>
            <a href={`tel:${order.customer?.phone || order.guestInfo?.phone}`} className="text-xs text-blue-600 font-medium">
              {order.customer?.phone || order.guestInfo?.phone}
            </a>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {order.status === "ready" && (
          <button
            onClick={() => onStatusChange(order._id, "out_for_delivery")}
            className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-semibold text-sm shadow-sm shadow-amber-200 flex items-center justify-center gap-2"
          >
            <Navigation size={18} />
            Pick Up Order
          </button>
        )}
        
        {order.status === "out_for_delivery" && (
          <button
            onClick={() => onStatusChange(order._id, "delivered")}
            className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-semibold text-sm shadow-sm shadow-emerald-200 flex items-center justify-center gap-2"
          >
            <CheckCircle size={18} />
            Mark Delivered
          </button>
        )}
      </div>
    </div>
  );
}
