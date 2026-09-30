# Quickstart — Premier paiement en 5 minutes

Ce guide crée un paiement carte de test de 1 USD, redirige le client vers un checkout hébergé Moko, et reçoit le résultat via webhook.

## Prérequis

- Un compte marchand Moko (contact `dev@gofreshpay.com` pour vos clés sandbox)
- `curl`, `python3` ou `node` (au choix)

Vous avez besoin de :

- `MOKO_API_KEY` — votre clé publique (`nex_test_*` en sandbox, `nex_live_*` en prod)
- `MOKO_API_SECRET` — votre secret HMAC (à garder côté serveur uniquement)
- `MOKO_BASE_URL` — `https://uc.card.gofreshpay.com` (même URL sandbox et prod ; l'environnement est dérivé des clés)

## 1. Signer une requête

Toutes les requêtes marchand sont authentifiées par HMAC-SHA256. Voir [Authentication](/authentication) pour le détail complet.

::: code-group

```python [Python]
import hmac, hashlib, json, httpx
from datetime import datetime, timezone

API_KEY = "..."
API_SECRET = "..."
BASE = "https://uc.card.gofreshpay.com"

body = json.dumps({
    "amount": 100,           # int en cents (1.00 USD)
    "currency": "USD",
    "reference": "INV-001",
    "customer_email": "client@example.com",
    "customer_name": "Jean Kabala",
    "return_url": "https://your-shop.com/order/INV-001",
}, separators=(",", ":"))

ts = datetime.now(timezone.utc).isoformat()
sig = hmac.new(API_SECRET.encode(), (body + ts).encode(), hashlib.sha256).hexdigest()

r = httpx.post(
    f"{BASE}/api/v1/payment/orders",
    content=body,
    headers={
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-Timestamp": ts,
        "X-Signature": sig,
    },
)
print(r.json())
```

```javascript [Node.js]
import crypto from 'node:crypto';

const API_KEY = '...';
const API_SECRET = '...';
const BASE = 'https://uc.card.gofreshpay.com';

const body = JSON.stringify({
  amount: 100,
  currency: 'USD',
  reference: 'INV-001',
  customer_email: 'client@example.com',
  customer_name: 'Jean Kabala',
  return_url: 'https://your-shop.com/order/INV-001',
});

const ts = new Date().toISOString();
const sig = crypto.createHmac('sha256', API_SECRET)
  .update(body + ts)
  .digest('hex');

const r = await fetch(`${BASE}/api/v1/payment/orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'X-Timestamp': ts,
    'X-Signature': sig,
  },
  body,
});
console.log(await r.json());
```

```bash [curl]
API_KEY="..."
API_SECRET="..."
BODY='{"amount":100,"currency":"USD","reference":"INV-001","customer_email":"client@example.com","customer_name":"Jean Kabala","return_url":"https://your-shop.com/order/INV-001"}'
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SIG=$(printf '%s%s' "$BODY" "$TS" | openssl dgst -sha256 -hmac "$API_SECRET" -r | awk '{print $1}')

curl -X POST https://uc.card.gofreshpay.com/api/v1/payment/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

:::

## 2. Rediriger le client

La réponse contient un `checkout_url`. Redirigez le navigateur du client vers cette URL :

```json
{
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "checkout_url": "https://uc.card.gofreshpay.com/api/v1/payment/uc/6f719977-...?sig=...",
  "expires_at": "2026-09-30T10:07:41Z",
  "status": "PENDING"
}
```

Le client tape sa carte sur la page hébergée par Moko, valide 3DS (OTP bancaire), puis est redirigé vers le `return_url` que vous avez fourni, avec un query param `?status=succeeded` ou `?status=failed`.

## 3. Recevoir le webhook

Configurez un endpoint dans votre backend pour recevoir le webhook (aussi signé HMAC — voir [Webhooks](/card/webhooks)) :

```json
{
  "event_type": "PAYMENT",
  "status": "SUCCESS",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "transaction_id": "7907643500666758704885",
  "amount": "1.00",
  "currency": "USD",
  "reference": "INV-001",
  "timestamp": "2026-09-30T10:32:00Z"
}
```

Marquez la commande comme payée dans votre DB, envoyez le reçu, expédiez le produit.

## Prochaines étapes

- [Custom Checkout (Microform)](/card/microform) — checkout intégré sur votre propre domaine
- [Payment Links](/card/payment-links) — encaisser sans site web
- [Refunds](/card/refunds) — remboursements partiels ou complets
- [Testing & Sandbox](/testing-sandbox) — cartes de test
