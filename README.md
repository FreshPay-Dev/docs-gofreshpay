# docs-gofreshpay

Documentation publique de la plateforme Moko Afrika, servie sur https://docs.gofreshpay.com.

Stack : [VitePress](https://vitepress.dev/) — Markdown → statique, hébergé sur Cloudflare Pages.

## Développement local

```bash
npm install
npm run dev
```

Serveur dev sur http://localhost:5173.

## Build

```bash
npm run build
```

Sortie dans `.vitepress/dist/`.

## Déploiement

Auto-deploy sur push `main` via Cloudflare Pages (voir `.github/workflows/deploy.yml`).

## Structure

- `index.md` — landing
- `quickstart.md` — intégration 5 min
- `authentication.md` — schéma HMAC
- `testing-sandbox.md` — cartes de test, environnements
- `card/` — endpoints carte (UC, Microform, 3DS, Payment Links, Refunds, Voids, Webhooks)
- `references/` — response codes, erreurs, sécurité
- `mobile-money/` — MM (Phase 2)

## Convention de contenu

- Français par défaut (marchés RDC / francophone).
- Exemples code : `curl`, Python, JavaScript côté marchand (proxy backend).
- Pas d'exemples qui exposent le secret HMAC côté browser.

## Contact

- Support technique : `dev@gofreshpay.com`
- Bugs docs : issues GitHub sur ce repo
