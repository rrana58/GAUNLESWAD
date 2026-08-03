import api from './axios'

// Dashboard
export const getStats = () => api.get('/admin/stats')
export const getRevenue = (params) => api.get('/admin/analytics/revenue', { params })
export const getTopItems = (params) => api.get('/admin/analytics/top-items', { params })

// Audit trail
export const getAuditLogs = (params) => api.get('/admin/audit-logs', { params })

// Users
export const getUsers = (params) => api.get('/admin/users', { params })
export const createUser = (data) => api.post('/admin/users', data)
export const updateUser = (id, data) => api.patch(`/admin/users/${id}`, data)
export const deleteUser = (id) => api.delete(`/admin/users/${id}`)
export const toggleUser = (id) => api.patch(`/admin/users/${id}/toggle`)

// Coupons
export const getCoupons = () => api.get('/admin/coupons')
export const createCoupon = (data) => api.post('/admin/coupons', data)
export const updateCoupon = (id, data) => api.patch(`/admin/coupons/${id}`, data)
export const deleteCoupon = (id) => api.delete(`/admin/coupons/${id}`)

// Closed dates
export const getClosedDates = (params) => api.get('/admin/closed-dates', { params })
export const createClosedDate = (data) => api.post('/admin/closed-dates', data)
export const updateClosedDate = (id, data) => api.patch(`/admin/closed-dates/${id}`, data)
export const deleteClosedDate = (id) => api.delete(`/admin/closed-dates/${id}`)

// Settings
export const getSettings = () => api.get('/admin/settings')
export const updateSettings = (data) => api.patch('/admin/settings', data)
export const uploadPopupImage = (formData) =>
  api.post('/menu/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// Special sessions
export const getSessions = (params) => api.get('/special-sessions', { params })
export const createSession = (data) => api.post('/special-sessions', data)
export const updateSession = (id, data) => api.patch(`/special-sessions/${id}`, data)
export const deleteSession = (id) => api.delete(`/special-sessions/${id}`)
export const getAvailableItems = () => api.get('/special-sessions/available-items')

// Subscriptions
export const getSubscriptions = (params) => api.get('/subscriptions/admin', { params })
export const confirmSubscription = (id, data) => api.patch(`/subscriptions/admin/${id}/confirm`, data)
export const updateSubscriptionStatus = (id, data) => api.patch(`/subscriptions/admin/${id}/status`, data)
export const getSubscriptionStats = () => api.get('/subscriptions/admin/stats')

// Meal plans
export const getMealPlans = () => api.get('/meal-plans')
export const createMealPlan = (data) => api.post('/meal-plans', data)
export const updateMealPlan = (id, data) => api.patch(`/meal-plans/${id}`, data)
export const deleteMealPlan = (id) => api.delete(`/meal-plans/${id}`)

// Announcements
export const getAnnouncements = () => api.get('/announcements')
export const createAnnouncement = (data) => api.post('/announcements', data)
export const updateAnnouncement = (id, data) => api.patch(`/announcements/${id}`, data)
export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`)

// Jobs
export const getJobs = () => api.get('/jobs')
export const createJob = (data) => api.post('/jobs', data)
export const updateJob = (id, data) => api.patch(`/jobs/${id}`, data)
export const deleteJob = (id) => api.delete(`/jobs/${id}`)
export const getJobApplications = (params) => api.get('/jobs/applications', { params })
export const updateJobApplicationStatus = (id, status) => api.patch(`/jobs/applications/${id}`, { status })

// Notifications
export const sendBroadcast = (data) => api.post('/notifications/broadcast', data)
