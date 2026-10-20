import { createRouter, createWebHistory } from 'vue-router'

import Landing from '../views/landing.vue'
import DailyMood from '../views/daily-mood.vue'
import Login from '../views/login.vue'
import Signup from '../views/signup.vue'
import Canvas from '../views/canvas.vue'
import PersonalityHub from '../views/personality-hub.vue'
import PersonalityQuiz from '../views/personality-quiz.vue'
import PersonalityResult from '../views/personality-result.vue'

const routes = [
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
    path: '/quiz',
    name: 'personality',
    component: PersonalityHub,
  },
  {
    path: '/quiz/:quizId',
    name: 'personality-quiz',
    component: PersonalityQuiz,
  },
  {
    path: '/quiz/:quizId/result',
    name: 'personality-result',
    component: PersonalityResult,
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
