import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useListeningRoom } from '@/composables/useListeningRoom'

// Logs out from anywhere in the app: stops the player and clears the user's
// songs before the session ends, then goes back to the landing page.
export function useLogOut() {
  const router = useRouter()
  const auth = useAuthStore()

  return async function logOut() {
    useListeningRoom().disconnect()
    await auth.logout()
    await router.replace('/')
  }
}
