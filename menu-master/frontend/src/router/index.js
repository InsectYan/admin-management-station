import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../components/MainLayout.vue';
import SubAppContainer from '../components/SubAppContainer.vue';
import HomeWelcome from '../components/HomeWelcome.vue';
import { getAccessToken, isAdmin, loginPath } from '../lib/amsAuth.js';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', name: 'home', component: HomeWelcome },
        { path: 'users', name: 'users', component: () => import('../views/UsersPage.vue'), meta: { admin: true } },
        { path: 'audit', name: 'audit', component: () => import('../views/AuditLogPage.vue'), meta: { admin: true } },
        { path: 'settings', name: 'settings', component: () => import('../views/SettingsPage.vue') },
        { path: 'media/:pathMatch(.*)*', component: SubAppContainer },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  if (to.meta.public) {
    if (!getAccessToken()) return true;
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/';
    if (/^https?:\/\//.test(redirect)) return true;
    return redirect.startsWith('/login') ? '/' : redirect;
  }
  if (!getAccessToken()) return loginPath(to.fullPath);
  if (to.meta.admin && !isAdmin()) return '/';
  return true;
});

export default router;
