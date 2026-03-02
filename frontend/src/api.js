import axios from 'axios'

const rawEnvBaseURL = String(import.meta.env.VITE_API_URL || '').trim()
const isLocalhostUrl = /localhost|127\.0\.0\.1/i.test(rawEnvBaseURL)
const envBaseURL = import.meta.env.PROD && isLocalhostUrl ? '' : rawEnvBaseURL
const fallbackBaseURL = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api'

if (import.meta.env.PROD && isLocalhostUrl) {
  console.warn('VITE_API_URL aponta para localhost em producao. Defina a URL publica da API no Vercel.')
}

const api = axios.create({
  baseURL: envBaseURL || fallbackBaseURL
})

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('pdv_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('pdv_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
