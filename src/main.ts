import { createApp } from 'vue';
import VueNativeSock from 'vue-native-websocket-vue3';
import App from './App.vue';

const app = createApp(App);

const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = window.location.host;
const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || `${protocol}://${host}/ws/task`;

app.use(VueNativeSock, wsBaseUrl, {
    reconnect: true,
    vuex: {},
    format: 'json',
});

app.mount('#app');