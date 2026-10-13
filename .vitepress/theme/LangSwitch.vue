<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

// Bouton FR / EN toujours visible : renvoie vers la même page dans l'autre langue.
// Le FR est servi à la racine, l'EN sous /en/ (même arborescence).
const { page, lang } = useData()

const isEn = computed(() => lang.value.startsWith('en'))

function toUrl(relativePath: string): string {
  const path = relativePath.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1')
  return withBase('/' + path)
}

const frUrl = computed(() => toUrl(page.value.relativePath.replace(/^en\//, '')))
const enUrl = computed(() =>
  toUrl(isEn.value ? page.value.relativePath : 'en/' + page.value.relativePath),
)
</script>

<template>
  <div class="lang-switch" role="group" aria-label="Language / Langue">
    <a :href="frUrl" :class="{ active: !isEn }" :aria-current="!isEn ? 'true' : undefined" hreflang="fr" lang="fr">FR</a>
    <a :href="enUrl" :class="{ active: isEn }" :aria-current="isEn ? 'true' : undefined" hreflang="en" lang="en">EN</a>
  </div>
</template>

<style scoped>
.lang-switch {
  display: flex;
  align-items: center;
  margin-left: 8px;
  margin-right: 16px;
  flex-shrink: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.lang-switch a {
  padding: 6px 9px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.2s, background-color 0.2s;
}

.lang-switch a:hover {
  color: var(--vp-c-brand-1);
}

.lang-switch a.active {
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

/* Mobile : version compacte pour laisser la place au menu hamburger */
@media (max-width: 767px) {
  .lang-switch {
    /* compense l'écart (gap 8px) de la barre : le hamburger a déjà son propre espace interne */
    margin: 0 -8px 0 0;
    font-size: 12px;
  }

  .lang-switch a {
    padding: 5px 6px;
  }
}
</style>
