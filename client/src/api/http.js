import axios from 'axios'

// Same /api paths locally and on Vercel. Vite proxies them in dev, the top-level Vercel rewrite handles them when deployed.
export const api = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Callers get the body directly, and any failure becomes an Error with a message that's safe to show.
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (!error.response) {
      return Promise.reject(
        new Error('Could not reach the server. Check that it is running, then try again.'),
      )
    }

    const { data, status } = error.response
    const message = typeof data === 'object' && data !== null ? data.error : data
    const failure = new Error(
      typeof message === 'string' && message ? message : `Request failed with status ${status}.`,
    )
    // Lets callers tell "not logged in" (401) apart from other failures.
    failure.status = status
    return Promise.reject(failure)
  },
)
