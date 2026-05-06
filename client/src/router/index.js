import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('../views/Home.vue') },
  { path: '/inbound', component: () => import('../views/Inbound.vue') },
  { path: '/outbound', component: () => import('../views/Outbound.vue') },
  { path: '/inventory', component: () => import('../views/Inventory.vue') },
  { path: '/defects', component: () => import('../views/Defects.vue') },
  { path: '/reports', component: () => import('../views/Reports.vue') },
  { path: '/settings', component: () => import('../views/Settings.vue') }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
