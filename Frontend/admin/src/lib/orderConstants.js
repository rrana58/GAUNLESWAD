export const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']

export const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  preparing: 'bg-orange-100 text-orange-700 border-orange-200',
  ready: 'bg-purple-100 text-purple-700 border-purple-200',
  out_for_delivery: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  refunded: 'bg-gray-100 text-gray-700 border-gray-200',
}

export const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'out_for_delivery',
  out_for_delivery: 'delivered',
}

export const NEXT_LABEL = {
  pending: 'Confirm Order',
  confirmed: 'Start Preparing',
  preparing: 'Mark Ready',
  ready: 'Out for Delivery',
  out_for_delivery: 'Mark Delivered',
}
