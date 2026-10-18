import { createRouter, createWebHistory } from 'vue-router'

import Landing from '../views/landing.vue'
import DailyMood from '../views/daily-mood.vue'
import Login from '../views/login.vue'
import Signup from '../views/signup.vue'
import Canvas from '../views/canvas.vue'
import PersonalityHub from '../views/personality-hub.vue'
import PersonalityQuiz from '../views/personality-quiz.vue'

const routes = [
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
