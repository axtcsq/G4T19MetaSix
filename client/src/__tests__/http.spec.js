import { afterEach, describe, expect, it } from 'vitest'
import { api } from '@/api/http'

const originalAdapter = api.defaults.adapter

// Replaces the network with a function that answers like the server would.
function respondWith(handler) {
  api.defaults.adapter = async (config) => {
    const { status, data } = handler(config)
    const response = { data, status, statusText: '', headers: {}, config }

    if (status >= 400) {
      const error = new Error(`Request failed with status code ${status}`)
      error.config = config
      error.response = response
      throw error
    }

    return response
  }
}

describe('api client', () => {
  afterEach(() => {
    api.defaults.adapter = originalAdapter
  })

  it('returns the response body and sends JSON bodies', async () => {
    let sent
    respondWith((config) => {
      sent = config
      return { status: 201, data: { _id: '1', mood: 'Happy' } }
    })

    await expect(api.post('/api/moods', { mood: 'Happy' })).resolves.toEqual({
      _id: '1',
      mood: 'Happy',
    })
    expect(sent.method).toBe('post')
    expect(JSON.parse(sent.data)).toEqual({ mood: 'Happy' })
  })

  it("uses the server's error message", async () => {
    respondWith(() => ({ status: 400, data: { error: 'Invalid mood' } }))

    await expect(api.patch('/api/moods/1', { mood: 'Bored' })).rejects.toThrow('Invalid mood')
  })

  it('falls back to the status code when the server gives no message', async () => {
    respondWith(() => ({ status: 503, data: '' }))

    await expect(api.delete('/api/moods/1')).rejects.toThrow('Request failed with status 503.')
  })

  it('explains when the server cannot be reached', async () => {
    api.defaults.adapter = async () => {
      throw new Error('Network Error')
    }

    await expect(api.get('/api/moods')).rejects.toThrow('Could not reach the server.')
  })
})
