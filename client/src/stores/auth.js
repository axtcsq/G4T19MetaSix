import { ref } from 'vue'
import { defineStore } from 'pinia'
import { demoLogin as demoLoginRequest, getMe, logout as logoutRequest } from '@/api/auth'

// Who is logged in, as the server sees it. The session itself lives in an
// httpOnly cookie, so the browser can only find out by asking /api/me.
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const checked = ref(false)
  const error = ref('')
  let pending = null

  function load() {
    pending ??= getMe()
      .then((me) => {
        user.value = me
        error.value = ''
      })
      .catch((failure) => {
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

  async function demoLogin() {
    user.value = await demoLoginRequest()
    error.value = ''
  }

  async function logout() {
    await logoutRequest()
    user.value = null
  }

  return { user, checked, error, load, demoLogin, logout }
})
