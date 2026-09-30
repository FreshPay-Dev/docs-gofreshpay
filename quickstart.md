# Quickstart — Premier paiement en 5 minutes

Ce guide crée un paiement carte de 1 USD, redirige le client vers un checkout hébergé Moko, et reçoit le résultat via webhook.

## Prérequis

- Un compte marchand Moko (contact `dev@gofreshpay.com` pour vos clés sandbox)
- `curl`, `python3` ou `node` (au choix)

Vous avez besoin de :

- `MOKO_API_KEY` — votre `X-API-Key`
- `MOKO_API_SECRET` — votre secret HMAC (à garder côté serveur uniquement)
- Base URL : `https://uc.card.gofreshpay.com`

## 1. Signer une requête

Toutes les requêtes marchand sont authentifiées par HMAC-SHA256. Voir [Authentication](/authentication) pour le détail complet.

Message signé = `body_json_string` + `timestamp` (concat directe, sans séparateur).

::: code-group

```python [Python]
import hmac, hashlib, json, httpx
from datetime import datetime, timezone

API_KEY = "..."
API_SECRET = "..."
BASE = "https://uc.card.gofreshpay.com"

body = json.dumps({
    "amount": 1.00,
    "currency": "USD",
    "merchant_reference": "INV-001",
    "callback_url": "https://your-shop.com/webhooks/moko",
    "bill_to_forename": "Jean",
    "bill_to_surname": "Kabala",
    "bill_to_email": "client@example.com",
    "bill_to_phone": "+243812345001",
    "bill_to_address_line1": "Av. Kasa-Vubu 42",
    "bill_to_address_city": "Kinshasa",
    "bill_to_address_country": "CD",
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
  amount: 1.00,
  currency: 'USD',
  merchant_reference: 'INV-001',
  callback_url: 'https://your-shop.com/webhooks/moko',
  bill_to_forename: 'Jean',
  bill_to_surname: 'Kabala',
  bill_to_email: 'client@example.com',
  bill_to_phone: '+243812345001',
  bill_to_address_line1: 'Av. Kasa-Vubu 42',
  bill_to_address_city: 'Kinshasa',
  bill_to_address_country: 'CD',
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
BODY='{"amount":1.00,"currency":"USD","merchant_reference":"INV-001","callback_url":"https://your-shop.com/webhooks/moko","bill_to_forename":"Jean","bill_to_surname":"Kabala","bill_to_email":"client@example.com","bill_to_phone":"+243812345001","bill_to_address_line1":"Av. Kasa-Vubu 42","bill_to_address_city":"Kinshasa","bill_to_address_country":"CD","return_url":"https://your-shop.com/order/INV-001"}'
TS=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
SIG=$(printf '%s%s' "$BODY" "$TS" | openssl dgst -sha256 -hmac "$API_SECRET" -r | awk '{print $1}')

curl -X POST https://uc.card.gofreshpay.com/api/v1/payment/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

:::

## 2. Réponse

```json
{
  "status": "success",
  "data": {
    "amount": "1.00",
    "currency": "USD",
    "transaction_uuid": "FP-20260930-101530-a1b2c3d4-CD",
    "transaction_status": "PENDING",
    "links": "https://uc.card.gofreshpay.com/api/v1/payment/FP-20260930-101530-a1b2c3d4-CD?sig=abc123...",
    "financial_details": {
      "commission_rate": "3.50",
      "commission_amount": "0.04",
      "merchant_amount": "0.96",
      "bank_commission_amount": "0.03",
      "freshpay_commission_amount": "0.01"
    }
  }
}
```

## 3. Rediriger le client

Redirigez le navigateur du client vers l'URL dans `data.links` :

```python
# Backend Python — retourner redirect
from fastapi.responses import RedirectResponse
resp = r.json()
return RedirectResponse(resp["data"]["links"], status_code=303)
```

Le client tape sa carte sur la page hébergée par Moko, valide 3DS (OTP bancaire), puis est redirigé vers votre `return_url` avec des query params (`status=SUCCESS` + `transaction_id` + `amount` + `currency` + `reference`, OU `status=FAILED` + `reason_code` + `message`).

## 4. Recevoir le webhook

Moko POSTe sur votre `callback_url` dès que le paiement est finalisé. Le body est signé HMAC — voir [Webhooks](/card/webhooks) pour la vérification.

```json
{
  "status": "SUCCESS",
  "reference": "INV-001",
  "amount": "1.00",
  "currency": "USD",
  "decision": "ACCEPT",
  "message": "Request was processed successfully.",
  "transaction_uuid": "FP-20260930-101530-a1b2c3d4-CD",
  "auth_cavv_result": "3",
  "customer_name": "Jean Kabala",
  "customer_email": "client@example.com",
  "cavv_message": "",
  "card_type": "Visa",
  "card_last4": "3172",
  "card_expiry_date": "12-2028",
  "card_bin_country": "CD",
  "card_issuer": "Equity Bank",
  "card_scheme": "VISA DEBIT"
}
```

Marquez la commande comme payée dans votre DB, envoyez le reçu, expédiez le produit.

## Prochaines étapes

- [Custom Checkout (Microform)](/card/microform) — checkout intégré sur votre propre domaine
- [Payment Links](/card/payment-links) — encaisser sans site web
- [Refunds](/card/refunds) — remboursements partiels ou complets
- [Testing & Sandbox](/testing-sandbox) — comment tester
