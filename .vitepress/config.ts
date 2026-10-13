import { defineConfig, type DefaultTheme } from 'vitepress'

function sidebarFr(): DefaultTheme.SidebarItem[] {
  return [
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
        { text: 'Webhooks', link: '/card/webhooks' },
        { text: 'Secure Acceptance (legacy)', link: '/card/secure-acceptance-legacy' },
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
  ]
}

function sidebarEn(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Getting started',
      items: [
        { text: 'Introduction', link: '/en/' },
        { text: '5-min Quickstart', link: '/en/quickstart' },
        { text: 'Authentication', link: '/en/authentication' },
        { text: 'Testing & Sandbox', link: '/en/testing-sandbox' },
      ],
    },
    {
      text: 'Card payments',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/card/overview' },
        { text: 'Hosted Checkout (UC)', link: '/en/card/hosted-checkout' },
        { text: 'Custom Checkout (Microform)', link: '/en/card/microform' },
        { text: '3DS Payer Authentication', link: '/en/card/3ds' },
        { text: 'Payment Links', link: '/en/card/payment-links' },
        { text: 'Webhooks', link: '/en/card/webhooks' },
        { text: 'Secure Acceptance (legacy)', link: '/en/card/secure-acceptance-legacy' },
      ],
    },
    {
      text: 'Mobile Money',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/mobile-money/overview' },
        { text: 'Collection (Deposit)', link: '/en/mobile-money/collection' },
        { text: 'Withdrawal (Payout)', link: '/en/mobile-money/withdrawal' },
        { text: 'Verify', link: '/en/mobile-money/verify' },
        { text: 'Webhooks', link: '/en/mobile-money/webhooks' },
      ],
    },
    {
      text: 'References',
      items: [
        { text: 'Response codes', link: '/en/references/response-codes' },
        { text: 'Errors (RFC 7807)', link: '/en/references/errors' },
        { text: 'Security', link: '/en/references/security' },
      ],
    },
  ]
}

export default defineConfig({
  title: 'Moko Afrika',
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

  locales: {
    root: {
      label: 'Français',
      lang: 'fr-FR',
      description: 'Documentation Moko Afrika — API paiement RDC (Carte + Mobile Money)',
      themeConfig: {
        nav: [
          { text: 'Quickstart', link: '/quickstart' },
          { text: 'Card', link: '/card/overview' },
          { text: 'Mobile Money', link: '/mobile-money/overview' },
          { text: 'Références', link: '/references/response-codes' },
          { text: 'Site', link: 'https://gofreshpay.com' },
        ],
        sidebar: sidebarFr(),
        footer: {
          message: 'Moko Afrika · L\'infrastructure paiement de la RDC',
          copyright: '© Moko Afrika',
        },
        editLink: {
          pattern: 'https://github.com/FreshPay-Dev/docs-gofreshpay/edit/main/:path',
          text: 'Suggérer une modif',
        },
        outline: { label: 'Sur cette page' },
        docFooter: { prev: 'Précédent', next: 'Suivant' },
        darkModeSwitchLabel: 'Thème',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Haut de page',
        lastUpdatedText: 'Dernière mise à jour',
        langMenuLabel: 'Changer de langue',
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      description: 'Moko Afrika documentation — DRC payments API (Card + Mobile Money)',
      themeConfig: {
        nav: [
          { text: 'Quickstart', link: '/en/quickstart' },
          { text: 'Card', link: '/en/card/overview' },
          { text: 'Mobile Money', link: '/en/mobile-money/overview' },
          { text: 'References', link: '/en/references/response-codes' },
          { text: 'Website', link: 'https://gofreshpay.com' },
        ],
        sidebar: sidebarEn(),
        footer: {
          message: 'Moko Afrika · The payment infrastructure of the DRC',
          copyright: '© Moko Afrika',
        },
        editLink: {
          pattern: 'https://github.com/FreshPay-Dev/docs-gofreshpay/edit/main/:path',
          text: 'Suggest an edit',
        },
        outline: { label: 'On this page' },
        docFooter: { prev: 'Previous', next: 'Next' },
        darkModeSwitchLabel: 'Theme',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Back to top',
        lastUpdatedText: 'Last updated',
        langMenuLabel: 'Change language',
      },
    },
  },

  themeConfig: {
    siteTitle: 'Moko Afrika Docs',
    logo: '/moko-logo.png',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/FreshPay-Dev' },
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
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
      },
    },
  },
})
