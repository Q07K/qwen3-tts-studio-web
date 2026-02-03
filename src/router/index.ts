import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            redirect: '/voice-clone'
        },
        {
            path: '/voice-clone',
            name: 'VoiceClone',
            component: () => import('../views/VoiceClone.vue')
        },
        {
            path: '/editor',
            name: 'StudioEditor',
            component: () => import('../views/StudioEditor.vue')
        }
    ]
});

export default router;
