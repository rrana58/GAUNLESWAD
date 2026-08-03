import api from './axios'

export const menuApi = {
  getMenu: (params) => api.get('/menu', { params }),
  getFeatured: () => api.get('/menu', { params: { featured: 'true', limit: 8 } }),
  getGrouped: () => api.get('/menu/grouped'),
  getCategories: () => api.get('/menu/categories'),
  getItem: (id) => api.get(`/menu/${id}`),
  getReviews: (menuItemId) => api.get(`/reviews/menu/${menuItemId}`),
  getActiveSpecialSession: () => api.get('/special-sessions/active'),
}