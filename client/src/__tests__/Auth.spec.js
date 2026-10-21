import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getMe, logout, spotifyLoginUrl } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal()),
  getMe: vi.fn(),
  logout: vi.fn(),
}))

function failure(status, message) {
  return Object.assign(new Error(message), { status })
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads the logged-in user', async () => {
    getMe.mockResolvedValue({ id: '1', displayName: 'Demo' })
    const auth = useAuthStore()

    await auth.load()

    expect(auth.user).toEqual({ id: '1', displayName: 'Demo' })
    expect(auth.checked).toBe(true)
    expect(auth.error).toBe('')
  })

  it('treats 401 as logged out, not as an error', async () => {
    getMe.mockRejectedValue(failure(401, 'Not logged in'))
    const auth = useAuthStore()

    await auth.load()

    expect(auth.user).toBeNull()
    expect(auth.checked).toBe(true)
    expect(auth.error).toBe('')
  })

  it('keeps other failures so the login page can show them', async () => {
    getMe.mockRejectedValue(failure(undefined, 'Could not reach the server.'))
    const auth = useAuthStore()

    await auth.load()

    expect(auth.user).toBeNull()
    expect(auth.error).toBe('Could not reach the server.')
  })

  it('asks the server only once while a check is pending', async () => {
    getMe.mockResolvedValue({ id: '1' })
    const auth = useAuthStore()

    await Promise.all([auth.load(), auth.load()])

    expect(getMe).toHaveBeenCalledTimes(1)
  })

  it('clears the user on logout', async () => {
    getMe.mockResolvedValue({ id: '1' })
    logout.mockResolvedValue(null)
    const auth = useAuthStore()
    await auth.load()

    await auth.logout()

    expect(logout).toHaveBeenCalled()
    expect(auth.user).toBeNull()
  })
})

describe('spotifyLoginUrl', () => {
  it("sends the browser's timezone and the page to return to", () => {
    const url = new URL(spotifyLoginUrl('/calendar'), 'http://127.0.0.1:5173')

    expect(url.pathname).toBe('/api/auth/login')
    expect(url.searchParams.get('tz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(url.searchParams.get('next')).toBe('/calendar')
  })
})
