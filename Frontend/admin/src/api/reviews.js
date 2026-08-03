import api from './axios'

export const getAdminReviews = (params) => api.get('/reviews/admin', { params })
export const getReviewStats = () => api.get('/reviews/admin/stats')
export const replyToReview = (id, reply) => api.patch(`/reviews/${id}/reply`, { reply })
export const unpublishReview = (id) => api.patch(`/reviews/${id}/unpublish`)
export const publishReview = (id) => api.patch(`/reviews/${id}/publish`)
export const deleteReview = (id) => api.delete(`/reviews/${id}`)