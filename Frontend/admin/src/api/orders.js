import api from './axios'

export const getOrders = (params) => api.get('/orders/all', { params })
export const getOrder = (id) => api.get(`/orders/${id}`)
export const updateOrderStatus = (id, status, note) =>
  api.patch(`/orders/${id}/status`, { status, note })
export const exportOrders = () =>
  api.get('/admin/export/orders', { responseType: 'blob' })