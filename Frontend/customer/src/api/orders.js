import api from './axios'

export const ordersApi = {
  placeOrder: (payload) => api.post('/orders', payload),
  trackByToken: (token) => api.get(`/orders/track/${token}`), // guest tracking
  getMyOrders: (params) => api.get('/orders/my-orders', { params }),
  getClosedDates: () => api.get('/orders/closed-dates'),
  getOrder: (id) => api.get(`/orders/${id}`),
  cancelOrder: (id, reason) => api.patch(`/orders/${id}/cancel`, { reason }),
  rateOrder: (id, payload) => api.post(`/orders/${id}/rate`, payload), // { foodRating, deliveryRating?, comment? }
}

export const addressApi = {
  list: () => api.get('/addresses'),
  reverseGeocode: (lat, lng) => api.post('/addresses/reverse-geocode', { lat, lng }),
  create: (payload) => api.post('/addresses', payload),
  update: (addressId, payload) => api.patch(`/addresses/${addressId}`, payload),
  remove: (addressId) => api.delete(`/addresses/${addressId}`),
}

export const paymentApi = {
  initiateKhalti: (orderId) => api.post('/payments/khalti/initiate', { orderId }),
  verifyKhalti: (pidx) => api.post('/payments/khalti/verify', { pidx }),
  getEsewaData: (orderId) => api.post('/payments/esewa/data', { orderId }),
  verifyEsewa: (data, orderId) => api.post('/payments/esewa/verify', { data, orderId }),
  getOrderPayment: (orderId) => api.get(`/payments/order/${orderId}`),
}

export const subscriptionApi = {
  listPlans: () => api.get('/meal-plans'),
  getPlan: (id) => api.get(`/meal-plans/${id}`),
  subscribe: (payload) => api.post('/subscriptions', payload), // { planId, payment: { method, reference? } }
  getMySubscription: () => api.get('/subscriptions/my'),
  getMyMealHistory: () => api.get('/subscriptions/my/history'),
  cancelMySubscription: () => api.delete('/subscriptions/my'),
}

export const notificationApi = {
  list: () => api.get('/notifications'),
  markAllRead: () => api.patch('/notifications/read-all'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
}

export const settingsApi = {
  getPublic: () => api.get('/settings/public'),
}

export const specialSessionApi = {
  getActive: () => api.get('/special-sessions/active'),
}

export const announcementApi = {
  getActive: () => api.get('/announcements/active'),
}

export const jobApi = {
  getActive: () => api.get('/jobs/active'),
  apply: (jobId, payload) => api.post(`/jobs/${jobId}/apply`, payload), // { name, phone, message? }
}

export const promoApi = {
  getPublic: () => api.get('/coupons/public'),
  validate: (code, subtotal) => api.post('/coupons/validate', { code, subtotal }),
}