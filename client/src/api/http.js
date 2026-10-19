import axios from 'axios'

// Shared axios client for every call to our server. In development Vite
// proxies /api to the server; deployments set VITE_API_BASE_URL instead.
export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, ''),
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
    return Promise.reject(new Error(message || `Request failed with status ${status}.`))
  },
)

// Old fetch helper, kept until every module uses the axios client.
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export async function request(path, options = {}) {
  let response

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the server. Check that it is running, then try again.')
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null ? payload.error : payload
    throw new Error(message || `Request failed with status ${response.status}.`)
  }

  return payload
}
