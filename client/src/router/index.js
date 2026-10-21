import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

import Landing from '../views/landing.vue'
import DailyMood from '../views/daily-mood.vue'
import MoodCalendar from '../views/calendar.vue'
import Login from '../views/login.vue'
import Canvas from '../views/canvas.vue'
import Dashboard from '../views/dashboard.vue'
import PersonalityHub from '../views/personality-hub.vue'
import PersonalityQuiz from '../views/personality-quiz.vue'
import PersonalityResult from '../views/personality-result.vue'

const routes = [
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard,
  },
  {
    path: '/listen',
    name: 'listen',
    component: () => import('../views/listen.vue'),
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
    meta: { requiresAuth: true },
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: MoodCalendar,
    meta: { requiresAuth: true },
  },
  {
    path: '/canvas',
    name: 'canvas',
    component: Canvas,
  },
  {
    path: '/quiz',
    name: 'personality',
    component: PersonalityHub,
    meta: { requiresAuth: true },
  },
  {
    path: '/quiz/:quizId',
    name: 'personality-quiz',
    component: PersonalityQuiz,
    meta: { requiresAuth: true },
  },
  {
    path: '/quiz/:quizId/result',
    name: 'personality-result',
    component: PersonalityResult,
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
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
})

// Pages that read or write the user's own data need a login first.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.checked) await auth.load()

  if (to.meta.requiresAuth && !auth.user) {
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.name === 'login' && auth.user) {
    return typeof to.query.next === 'string' && to.query.next.startsWith('/') && !to.query.next.startsWith('//')
      ? to.query.next
      : '/dashboard'
  }
})

export default router
