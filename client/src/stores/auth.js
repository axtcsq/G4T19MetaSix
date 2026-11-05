import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getMe, logout as logoutRequest } from '@/api/auth'

// Who's logged in, as the server sees it. The session is an httpOnly cookie, so the browser can only find out by asking /api/me.
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const checked = ref(false)
  const error = ref('')
  let pending = null
  let revision = 0

  function load() {
    const requestRevision = revision
    pending ??= getMe()
      .then((me) => {
        if (requestRevision !== revision) return
        user.value = me
        error.value = ''
      })
      .catch((failure) => {
        if (requestRevision !== revision) return
        user.value = null
        // 401 just means nobody is logged in.
        error.value = failure.status === 401 ? '' : failure.message
      })
      .finally(() => {
        checked.value = true
        pending = null
      })

    return pending
  }

  async function logout() {
    await logoutRequest()
    revision++
    user.value = null
    checked.value = true
    error.value = ''
  }

  return { user, checked, error, load, logout }
})
