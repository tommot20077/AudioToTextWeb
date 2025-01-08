<template>
  <div id="app">
    <AudioUpload />
  </div>
</template>

<script>
import AudioUpload from './components/AudioUpload.vue';

export default {
  name: 'App',
  components: {
    AudioUpload,
  },
};
</script>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background-color: #121212;
}
</style>