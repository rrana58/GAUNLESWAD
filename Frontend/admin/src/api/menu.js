import api from './axios'

export const getCategories = () => api.get('/menu/categories')
export const createCategory = (data) => api.post('/menu/categories', data)
export const updateCategory = (id, data) => api.patch(`/menu/categories/${id}`, data)
export const deleteCategory = (id) => api.delete(`/menu/categories/${id}`)

export const getMenuItems = (params) => api.get('/menu', { params })
// Admin-only listing — includes unavailable items (the public /menu endpoint
// filters those out, which is correct for customers but hides toggled-off
// items from the admin table).
export const getAdminMenuItems = (params) => api.get('/menu/admin/list', { params })
export const getMenuItem = (id) => api.get(`/menu/${id}`)
export const createMenuItem = (data) => api.post('/menu', data)
export const updateMenuItem = (id, data) => api.patch(`/menu/${id}`, data)
export const deleteMenuItem = (id) => api.delete(`/menu/${id}`)
export const bulkUpdatePrices = (data) => api.post('/admin/menu/bulk-price', data)

// Dedicated toggle and upload endpoints
export const toggleMenuItemAvailability = (id) =>
  api.patch(`/menu/${id}/toggle`)

export const uploadMenuImage = (formData) => {
  return api.post('/menu/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}