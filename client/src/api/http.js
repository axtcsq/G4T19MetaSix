import axios from 'axios'

// Use the same /api paths locally and in Vercel Services. Vite proxies them
// during development; the top-level Vercel rewrite routes them in deployments.
export const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
})

// Callers get the response body directly, and every failure becomes an Error
// whose message is safe to show the user.
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
    const failure = new Error(message || `Request failed with status ${status}.`)
    // Lets callers tell "not logged in" (401) apart from other failures.
    failure.status = status
    return Promise.reject(failure)
  },
)
