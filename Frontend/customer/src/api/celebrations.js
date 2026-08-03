import api from './axios'

export const getCelebrationPackages = () => api.get('/celebration-packages')
export const getCelebrationTypes = () => api.get('/celebration-packages/types')
export const placeCelebrationOrder = (data) => api.post('/orders/celebration', data)
