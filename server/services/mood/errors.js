// Thrown by the API clients. analyse.js reads `status`: a 404 from ReccoBeats means no features.
export class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message)
    this.status = status
    this.headers = headers
  }
}
