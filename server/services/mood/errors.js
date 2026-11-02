// Thrown by the API clients. analyse.js reads `status`: a 404 from ReccoBeats means no features.
export class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message)
    this.status = status
    this.headers = headers
  }
}

// A service that's busy (429), down (5xx) or unreachable says nothing about the
// song, so the analysis job retries it later without counting the attempt.
export function busyStatus(status) {
  return status === 429 || status >= 500
}

export function isTemporary(error) {
  return Boolean(error?.temporary) || error?.name === 'TimeoutError' || error?.message === 'fetch failed'
}
