import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import LangSwitch from './LangSwitch.vue'
import './custom.css'

const theme: Theme = {
  extends: DefaultTheme,
  // Sélecteur FR / EN toujours visible dans la barre (le menu natif est masqué < 1280px)
  Layout: () => h(DefaultTheme.Layout, null, {
    'nav-bar-content-after': () => h(LangSwitch),
  }),
}

export default theme
