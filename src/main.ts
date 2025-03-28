import {createApp} from 'vue';
import VueNativeSock from 'vue-native-websocket-vue3';
import App from './App.vue';
import Config from "../config/config.ts";

const app = createApp(App);
const wsBaseUrl = Config.wsUrl;

app.use(VueNativeSock, wsBaseUrl, {
    reconnect: true,
    vuex: {},
    format: 'json',
});

app.mount('#app');