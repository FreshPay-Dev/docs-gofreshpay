import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'fr-FR',
  title: 'Moko Afrika',
  description: 'Documentation Moko Afrika — API paiement RDC (Carte + Mobile Money)',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['README.md'],

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/favicon.png' }],
    ['meta', { name: 'theme-color', content: '#0a7c47' }],
    ['meta', { property: 'og:title', content: 'Moko Afrika — Documentation' }],
    ['meta', { property: 'og:description', content: 'API de paiement pour les marchands RDC — Carte bancaire (Visa/MasterCard) + Mobile Money, une seule intégration REST.' }],
    ['meta', { property: 'og:url', content: 'https://docs.gofreshpay.com' }],
    ['meta', { property: 'og:image', content: 'https://docs.gofreshpay.com/moko-logo.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
  ],

  themeConfig: {
    siteTitle: 'Moko Afrika Docs',
    logo: '/moko-logo.png',

    nav: [
      { text: 'Quickstart', link: '/quickstart' },
      { text: 'Card', link: '/card/overview' },
      { text: 'Mobile Money', link: '/mobile-money/overview' },
      { text: 'Références', link: '/references/response-codes' },
      { text: 'Site', link: 'https://gofreshpay.com' },
    ],

    sidebar: [
      {
        text: 'Prise en main',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Quickstart 5 min', link: '/quickstart' },
          { text: 'Authentication', link: '/authentication' },
          { text: 'Testing & Sandbox', link: '/testing-sandbox' },
        ],
      },
      {
        text: 'Carte bancaire',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/card/overview' },
          { text: 'Hosted Checkout (UC)', link: '/card/hosted-checkout' },
          { text: 'Custom Checkout (Microform)', link: '/card/microform' },
          { text: '3DS Payer Authentication', link: '/card/3ds' },
          { text: 'Payment Links', link: '/card/payment-links' },
          { text: 'Refunds', link: '/card/refunds' },
          { text: 'Voids', link: '/card/voids' },
          { text: 'Webhooks', link: '/card/webhooks' },
        ],
      },
      {
        text: 'Mobile Money',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/mobile-money/overview' },
          { text: 'Collection (Deposit)', link: '/mobile-money/collection' },
          { text: 'Withdrawal (Payout)', link: '/mobile-money/withdrawal' },
          { text: 'Verify', link: '/mobile-money/verify' },
          { text: 'Webhooks', link: '/mobile-money/webhooks' },
        ],
      },
      {
        text: 'Références',
        items: [
          { text: 'Response codes', link: '/references/response-codes' },
          { text: 'Erreurs (RFC 7807)', link: '/references/errors' },
          { text: 'Sécurité', link: '/references/security' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/FreshPay-Dev' },
    ],

    footer: {
      message: 'Moko Afrika · L\'infrastructure paiement de la RDC',
      copyright: '© Moko Afrika',
    },

    editLink: {
      pattern: 'https://github.com/FreshPay-Dev/docs-gofreshpay/edit/main/:path',
      text: 'Suggérer une modif',
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Rechercher', buttonAriaLabel: 'Rechercher' },
          modal: {
            noResultsText: 'Aucun résultat pour',
            resetButtonTitle: 'Effacer',
            footer: {
              selectText: 'ouvrir',
              navigateText: 'naviguer',
              closeText: 'fermer',
            },
          },
        },
      },
    },

    outline: { label: 'Sur cette page' },
    docFooter: { prev: 'Précédent', next: 'Suivant' },
    darkModeSwitchLabel: 'Thème',
    sidebarMenuLabel: 'Menu',
    returnToTopLabel: 'Haut de page',
    lastUpdatedText: 'Dernière mise à jour',
  },
})
