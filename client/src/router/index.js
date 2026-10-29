import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { setPageTitle } from '@/utils/pageTitle'

import Landing from '../views/landing.vue'
import DailyMood from '../views/daily-mood.vue'
import MoodCalendar from '../views/calendar.vue'
import Login from '../views/login.vue'
import Dashboard from '../views/dashboard.vue'
import PersonalityHub from '../views/personality/personality-hub.vue'
import Profile from '../views/profile.vue'
import PersonalityQuiz from '../views/personality/personality-quiz.vue'
import PersonalityResult from '../views/personality/personality-result.vue'

const routes = [
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, title: 'Home' },
  },
  {
    path: '/listen',
    name: 'listen',
    component: () => import('../views/listen.vue'),
    meta: { requiresAuth: true, title: 'Listening Room' },
  },
  {
    path: '/',
    name: 'landing',
    component: Landing,
  },
  {
    path: '/daily-mood',
    name: 'daily-mood',
    component: DailyMood,
    meta: { requiresAuth: true, title: 'Daily Mood Log' },
  },
  {
    path: '/canvas',
    redirect: '/daily-mood',
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: MoodCalendar,
    meta: { requiresAuth: true, title: 'Mood Calendar' },
  },
  {
    path: '/quiz',
    name: 'personality',
    component: PersonalityHub,
    meta: { requiresAuth: true, title: 'Find Your Personality' },
  },
  {
    path: '/quiz/:quizId',
    name: 'personality-quiz',
    component: PersonalityQuiz,
    meta: { requiresAuth: true, title: 'Personality Quiz' },
  },
  {
    path: '/quiz/:quizId/result',
    name: 'personality-result',
    component: PersonalityResult,
    meta: { requiresAuth: true, title: 'Your Result' },
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { title: 'Sign In' },
  },
  {
    path: '/song/:id',
    name: 'song',
    component: () => import('../views/song.vue'),
    // The page sets the song's name as the title once it has loaded.
    meta: { requiresAuth: true, title: 'Song Mood' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: Profile,
    meta: { requiresAuth: true, title: 'Your Profile' },
  },
  // Spotify is the only way in, and the first login creates the account.
  {
    path: '/signup',
    redirect: '/login',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  // Start each page at the top, including browser back/forward navigation.
  scrollBehavior: () => ({ left: 0, top: 0 }),
})

// Pages that read or write the user's own data need a login first.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.checked) {
    // Public pages can render while the session check runs. Protected pages
    // still wait so they never flash content the user cannot access.
    if (to.meta.requiresAuth || to.name === 'login') {
      await auth.load()
    } else {
      auth.load()
    }
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.name === 'login' && auth.user) {
    return typeof to.query.next === 'string' &&
      to.query.next.startsWith('/') &&
      !to.query.next.startsWith('//')
      ? to.query.next
      : '/dashboard'
  }
})

router.afterEach((to) => setPageTitle(to.meta.title))

export default router
