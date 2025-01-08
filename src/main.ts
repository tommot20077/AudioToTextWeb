import { createApp } from 'vue';
import VueNativeSock from 'vue-native-websocket-vue3';
import App from './App.vue';

const app = createApp(App);

app.use(VueNativeSock, 'ws://138.2.33.143:8077/ws/task', {
    reconnect: true,
    vuex: {},
    format: 'json',
});

app.mount('#app');