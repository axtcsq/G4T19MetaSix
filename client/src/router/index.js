import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/home.vue'
import DailyMood from '../views/daily-mood.vue'
import Login from '../views/login.vue'
import Signup from '../views/signup.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home,
  },
  {
    path: '/daily-mood',
    name: 'daily-mood',
    component: DailyMood,
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
