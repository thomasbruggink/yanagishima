import { createRouter, createWebHistory } from 'vue-router'
import DefaultView from '@/views/DefaultView'
import ShareView from '@/views/ShareView'
import ErrorView from '@/views/ErrorView'

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/diff',
      component: () => import(/* webpackChunkName: "diff-view" */ '@/views/DiffView')
    },
    {
      path: '/share',
      component: ShareView
    },
    {
      path: '/error',
      component: ErrorView
    },
    {
      path: '/',
      component: DefaultView
    }
  ]
})
