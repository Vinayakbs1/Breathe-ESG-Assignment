import axios from 'axios'

// Same origin in production (Django serves both).
// VITE_API_URL override available for custom setups.
const baseURL = import.meta.env.VITE_API_URL || '/api'

function getCookie(name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}

const api = axios.create({
  baseURL,
  withCredentials: true,
})

// Attach CSRF token to every mutating request
api.interceptors.request.use(config => {
  const csrfToken = getCookie('csrftoken')
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken
  }
  return config
})

export default api