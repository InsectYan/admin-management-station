import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../components/MainLayout.vue';
import SubAppContainer from '../components/SubAppContainer.vue';
import HomeWelcome from '../components/HomeWelcome.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', name: 'home', component: HomeWelcome },
        { path: 'media/:pathMatch(.*)*', component: SubAppContainer },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

export default router;
