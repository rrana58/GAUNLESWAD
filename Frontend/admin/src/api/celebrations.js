import api from './axios'

export const getCelebrationPackages = () => api.get('/celebration-packages')
export const createCelebrationPackage = (data) => api.post('/celebration-packages', data)
export const updateCelebrationPackage = (id, data) => api.put(`/celebration-packages/${id}`, data)
export const deleteCelebrationPackage = (id) => api.delete(`/celebration-packages/${id}`)
export const getCelebrationTypes = () => api.get('/celebration-packages/types')
