// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Sugar from 'sugar'
import 'bootstrap/dist/js/bootstrap.bundle'
import '@/assets/scss/custom.scss'
import 'toastr/toastr.scss'
import 'lity'
import 'lity/dist/lity.min.css'
import toastr from 'toastr'
import { createApp } from 'vue'
import App from '@/App'
import router from '@/router'
import store from '@/store'
import VueClipboards from 'vue-clipboards'
import VueScrollTo from 'vue-scrollto'
import BaseAce from '@/components/base/BaseAce'
import BaseAutoLink from '@/components/base/BaseAutoLink'
import BaseHighlight from '@/components/base/BaseHighlight'

Sugar.extend()

toastr.options = {
  escapeHtml: false,
  closeButton: true,
  debug: false,
  newestOnTop: false,
  progressBar: false,
  positionClass: 'toast-bottom-right',
  preventDuplicates: false,
  onclick: null,
  showDuration: 300,
  hideDuration: 1000,
  timeOut: 30000,
  extendedTimeOut: 1000,
  showEasing: 'swing',
  hideEasing: 'linear',
  showMethod: 'fadeIn',
  hideMethod: 'fadeOut'
}

const app = createApp(App)

app.config.productionTip = false

app.use(VueClipboards)
app.use(VueScrollTo)
app.use(router)
app.use(store)

app.component('BaseAce', BaseAce)
app.component('BaseAutoLink', BaseAutoLink)
app.component('BaseHighlight', BaseHighlight)

app.directive('focus', {
  inserted (el) {
    el.focus()
  }
})

app.mount('#app')
