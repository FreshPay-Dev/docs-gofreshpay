# Webhooks

Moko notifie votre backend des événements de paiement de manière asynchrone. Les webhooks sont **la source de vérité** — plus fiables que le redirect client-side (le customer peut fermer son navigateur).

## Événements

| `event_type` | Déclenché quand |
|---|---|
| `PAYMENT` | Après charge : `status: SUCCESS` ou `FAILED` |
| `REFUND` | Après un refund admin réussi (`notify_merchant: true`) |
| `VOID` | Après un void admin réussi (`notify_merchant: true`) |

## Endpoint côté marchand

Vous devez exposer un endpoint HTTPS qui accepte `POST`. Passez son URL comme :

- `callback_url` dans `POST /api/v1/payment/orders`, `/api/v1/payment-links`, ou `/api/v1/microform/charge`
- **OU** en config globale marchand (via `POST /api/v1/merchants/{id}` — support)

## Payload

### PAYMENT

```json
{
  "event_type": "PAYMENT",
  "status": "SUCCESS",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "transaction_id": "7907643500666758704885",
  "amount": "1.00",
  "currency": "USD",
  "reference": "INV-042",
  "reason_code": null,
  "message": null,
  "timestamp": "2026-09-30T10:32:00Z"
}
```

### REFUND

```json
{
  "event_type": "REFUND",
  "status": "SUCCESS",
  "transaction_uuid": "6f719977-...",
  "reference": "INV-042",
  "cs_payment_id": "7907643500666758704885",
  "cs_refund_id": "7907645194846489004894",
  "refund_id": 6,
  "amount": "1.00",
  "currency": "USD",
  "refunded_total": "1.00",
  "remaining": "0.00",
  "reason": "Client demandé",
  "timestamp": "2026-09-30T11:00:00Z"
}
```

### VOID

```json
{
  "event_type": "VOID",
  "status": "SUCCESS",
  "transaction_uuid": "6f719977-...",
  "cs_payment_id": "7907643500666758704885",
  "cs_void_id": "7907621859236796504887",
  "void_id": 3,
  "amount": "50.00",
  "currency": "USD",
  "reason": "Erreur ops",
  "timestamp": "2026-09-30T11:30:00Z"
}
```

## Vérification de signature

Chaque webhook Moko contient un header `X-FreshPay-Signature` = HMAC-SHA256 du body avec votre `callback_secret` (spécifique par marchand, différent de votre `api_secret`).

::: warning
`callback_secret` est **distinct** de votre `api_secret`. Contactez support pour le récupérer.
:::

### Exemple Python (FastAPI)

```python
import hmac, hashlib
from fastapi import APIRouter, Request, HTTPException

CALLBACK_SECRET = "..."  # depuis vos vars d'env

router = APIRouter()

@router.post("/webhooks/moko")
async def moko_webhook(request: Request):
    signature = request.headers.get("X-FreshPay-Signature")
    if not signature:
        raise HTTPException(400, "Missing signature")

    body = await request.body()
    expected = hmac.new(
        CALLBACK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise HTTPException(403, "Invalid signature")

    payload = await request.json()

    if payload["event_type"] == "PAYMENT" and payload["status"] == "SUCCESS":
        # Marquer commande payée
        pass
    elif payload["event_type"] == "REFUND":
        # Créditer le customer
        pass

    return {"received": True}
```

### Exemple Node.js (Express)

```javascript
import express from 'express';
import crypto from 'node:crypto';

const CALLBACK_SECRET = '...';
const app = express();

// IMPORTANT: raw body pour la vérif HMAC
app.post('/webhooks/moko', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-freshpay-signature'];
  if (!signature) return res.status(400).send('Missing signature');

  const expected = crypto.createHmac('sha256', CALLBACK_SECRET)
    .update(req.body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(403).send('Invalid signature');
  }

  const payload = JSON.parse(req.body.toString());
  // ... traiter payload

  res.json({received: true});
});
```

## Idempotence

Moko peut réessayer un webhook plusieurs fois (jusqu'à 5x avec backoff exponentiel) en cas d'erreur réseau ou 5xx de votre serveur. Votre handler doit être **idempotent** :

```python
# BAD - décrémente le stock à chaque webhook reçu
def handle_payment_success(tx_id):
    stock -= 1  # ❌ si reçu 3x, stock -= 3

# GOOD - check état en DB avant de traiter
def handle_payment_success(tx_id):
    order = get_order_by_tx(tx_id)
    if order.status != 'pending':
        return  # déjà traité
    order.status = 'paid'
    stock -= 1
```

## Retry policy

- **1er retry** : +1 min
- **2e retry** : +5 min
- **3e retry** : +30 min
- **4e retry** : +2h
- **5e retry** : +6h

Après 5 échecs consécutifs, le webhook est marqué en dead-letter. Contactez support pour re-livraison manuelle.

## Codes de réponse attendus

- **2xx** — succès, ne retry pas
- **4xx** (sauf 429) — erreur permanente, ne retry pas
- **429** — throttle, retry après `Retry-After` header
- **5xx** — erreur temporaire, retry

## Debug

Testez la réception avec l'endpoint de debug Moko :

```bash
# POSTer un fake webhook vers votre URL de test
curl -X POST https://uc.card.gofreshpay.com/api/v1/test/test-callback \
  -H "Content-Type: application/json" \
  -d '{"event_type":"PAYMENT","status":"SUCCESS","test":true}'

# Consulter historique reçu
curl https://uc.card.gofreshpay.com/api/v1/test/test-callback/history
```

Pour tester en local : utilisez [ngrok](https://ngrok.com/) pour exposer votre serveur dev.
