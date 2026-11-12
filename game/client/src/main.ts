import { createApp } from 'vue'
import App from './App.vue'
import './main.css'

createApp(App).mount('#app')

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Push notifications won't work, everything else will.
  })
}
