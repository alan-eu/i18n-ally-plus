/* eslint-disable no-undef */
import { createApp } from 'vue'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import 'vue-material-design-icons/styles.css'
import VCheck from 'vue-material-design-icons/Check.vue'
import VPlusMinus from 'vue-material-design-icons/PlusMinus.vue'
import VCommentOutline from 'vue-material-design-icons/CommentOutline.vue'
import VEarth from 'vue-material-design-icons/Earth.vue'
import VCommentEditOutline from 'vue-material-design-icons/CommentEditOutline.vue'
import VCommentQuestionOutline from 'vue-material-design-icons/CommentQuestionOutline.vue'
import VCheckboxMarkedOutline from 'vue-material-design-icons/CheckboxMarkedOutline.vue'
import VPencilOff from 'vue-material-design-icons/PencilOff.vue'
import VPencil from 'vue-material-design-icons/Pencil.vue'
import VCheckAll from 'vue-material-design-icons/CheckAll.vue'
import VMenu from 'vue-material-design-icons/Menu.vue'
import VChevronLeft from 'vue-material-design-icons/ChevronLeft.vue'
import VChevronRight from 'vue-material-design-icons/ChevronRight.vue'
import VDeleteEmptyOutline from 'vue-material-design-icons/DeleteEmptyOutline.vue'
import VFormatQuoteOpen from 'vue-material-design-icons/FormatQuoteOpen.vue'
import { vscode } from './api'
import App from './App.vue'

const icons = {
  VCheck,
  VPlusMinus,
  VCommentOutline,
  VEarth,
  VCommentEditOutline,
  VCommentQuestionOutline,
  VCheckboxMarkedOutline,
  VPencilOff,
  VPencil,
  VCheckAll,
  VMenu,
  VChevronLeft,
  VChevronRight,
  VDeleteEmptyOutline,
  VFormatQuoteOpen,
}

const locale = 'en'
const i18n = createI18n({
  legacy: true,
  locale,
  messages: {},
})

const store = createStore({
  state() {
    return Object.assign({
      ready: false,
      config: {
        debug: false,
        sourceLanguage: 'en',
        displayLanguage: 'en',
        enabledFrameworks: [],
        ignoredLocales: [],
        extensionRoot: '',
        flags: [],
        locales: [],
      },
      context: {},
      i18n: {},
      route: 'welcome',
      routeData: {},
    },
    vscode.getState(),
    { ready: false })
  },
  mutations: {
    config(state, data) {
      state.config = data
    },
    i18n(state, data) {
      state.i18n = data
      i18n.global.setLocaleMessage(locale, data)
    },
    route(state, { route, data }) {
      state.routeData = data
      state.route = route
    },
    context(state, context) {
      state.context = context
    },
    ready(state) {
      state.ready = true
    },
  },
})

// persist the webview state back to the host on every change
store.subscribe((_mutation, state) => vscode.setState(state))

window.addEventListener('message', (event) => {
  const message = event.data
  switch (message.type) {
    case 'ready':
      store.commit('ready')
      break
    case 'config':
      store.commit('config', message.data)
      break
    case 'route':
      store.commit('route', message)
      break
    case 'i18n':
      store.commit('i18n', message.data)
      break
    case 'context':
      store.commit('context', message.data)
  }
})

const app = createApp(App)
app.use(store)
app.use(i18n)
for (const [name, component] of Object.entries(icons))
  app.component(name, component)
app.mount('#app')

vscode.postMessage({ type: 'ready' })
