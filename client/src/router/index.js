import { createRouter, createWebHistory } from 'vue-router'

import Landing from '../views/landing.vue'
import DailyMood from '../views/daily-mood.vue'
import Login from '../views/login.vue'
import Signup from '../views/signup.vue'
import Canvas from '../views/canvas.vue'
import Dashboard from '../views/dashboard.vue'

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
  },
  {
    path: '/canvas',
    name: 'canvas',
    component: Canvas,
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
  },
  {
    path: '/signup',
    name: 'signup',
    component: Signup,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
