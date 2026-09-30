# Webhooks

Moko notifie votre backend des événements de paiement de manière asynchrone. Les webhooks sont **la source de vérité** — plus fiables que le redirect client-side.

## Événements

| Trigger | Contient `event_type` ? | Signature signée ? |
|---|---|---|
| Paiement finalisé (SUCCESS/FAILED) | ❌ non | ✅ oui |
| Refund admin réussi | ✅ `REFUND` | ✅ oui |
| Void admin réussi | ✅ `VOID` | ✅ oui |
| Annulation client sur checkout | ✅ `PAYMENT_CANCELLATION` | ❌ **non signé** (voir warning) |

::: warning PAYMENT_CANCELLATION non signé
Le webhook `PAYMENT_CANCELLATION` (déclenché quand le customer annule sur la page checkout) utilise un POST HTTP non signé. Ne l'utilisez pas comme confirmation critique — considérez-le comme un signal informatif. Un vrai `SUCCESS` ou `FAILED` arrivera séparément via le webhook signé standard.
:::

## Endpoint côté marchand

Vous exposez un endpoint HTTPS `POST` et passez son URL comme `callback_url` :

- Dans `POST /api/v1/payment/orders`, `POST /api/v1/payment-links`, ou `POST /api/v1/microform/charge`

## Signature webhook

Chaque webhook signé contient les headers :

| Header | Format |
|---|---|
| `X-FreshPay-Signature` | `t=<unix_timestamp>,v1=<hex_signature>` |
| `X-FreshPay-Timestamp` | `<unix_timestamp>` (redondant, informatif) |

### Algorithme

```
message   = str(timestamp) + raw_body     # concat directe, PAS de séparateur
signature = HMAC_SHA256(callback_secret, message).hexdigest()
```

- `timestamp` = entier Unix (secondes UTC)
- `raw_body` = les octets exacts du body JSON envoyé par Moko
  - Moko sérialise avec `json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")`
  - **Ne PAS re-sérialiser** avant vérification — utilisez le raw body reçu
- `callback_secret` = secret spécifique par marchand (distinct de `api_secret`)

## Payloads

### PAYMENT (succès ou échec)

Déclenché après capture Cybersource ou refus. **Pas de champ `event_type`** — on distingue via `status`.

```json
{
  "status": "SUCCESS",
  "reference": "INV-042",
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

Sur échec : `status` = `FAILED`, `decision` = `REJECT` ou `REVIEW`, `message` contient la raison.

### REFUND

Déclenché après un refund admin réussi (si `notify_merchant: true` sur l'appel refund).

```json
{
  "event_type": "REFUND",
  "status": "SUCCESS",
  "transaction_uuid": "FP-...",
  "reference": "INV-042",
  "cs_payment_id": "7907643500666758704885",
  "cs_refund_id": "7907645194846489004894",
  "refund_id": 6,
  "amount": "1.00",
  "currency": "USD",
  "refunded_total": "1.00",
  "remaining": "0.00",
  "reason": "Client demandé — commande annulée",
  "reason_code": "100",
  "message": "Request was processed successfully.",
  "timestamp": "2026-09-30T11:00:00Z"
}
```

### VOID

Déclenché après un void admin réussi (si `notify_merchant: true`).

```json
{
  "event_type": "VOID",
  "status": "SUCCESS",
  "transaction_uuid": "FP-...",
  "reference": "INV-042",
  "cs_payment_id": "7907643500666758704885",
  "cs_void_id": "7907621859236796504887",
  "void_id": 3,
  "amount": "50.00",
  "currency": "USD",
  "reason": "Erreur ops",
  "reason_code": "100",
  "message": "Request was processed successfully.",
  "timestamp": "2026-09-30T11:30:00Z"
}
```

### PAYMENT_CANCELLATION (non signé)

Déclenché quand le customer clique "Annuler" sur la page checkout. **Non signé** (bug backend documenté).

```json
{
  "event_type": "PAYMENT_CANCELLATION",
  "transaction_uuid": "FP-...",
  "reference": "INV-042",
  "amount": "1.00",
  "currency": "USD",
  "timestamp": "2026-09-30T10:07:00Z"
}
```

## Vérifier une signature

### Exemple Python (FastAPI)

```python
import hmac, hashlib, os
from fastapi import APIRouter, Request, HTTPException

CALLBACK_SECRET = os.environ["MOKO_CALLBACK_SECRET"]

router = APIRouter()

def verify_moko_signature(header: str, raw_body: bytes) -> bool:
    """Parse header 't=UNIX,v1=HEX', reconstruit signature, compare."""
    try:
        parts = dict(p.split("=", 1) for p in header.split(","))
        ts = parts["t"]
        received_sig = parts["v1"]
    except Exception:
        return False

    message = ts.encode() + raw_body  # concat directe
    expected = hmac.new(CALLBACK_SECRET.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(received_sig, expected)


@router.post("/webhooks/moko")
async def moko_webhook(request: Request):
    signature = request.headers.get("X-FreshPay-Signature")
    if not signature:
        raise HTTPException(400, "Missing signature")

    raw_body = await request.body()
    if not verify_moko_signature(signature, raw_body):
        raise HTTPException(403, "Invalid signature")

    payload = await request.json()
    event = payload.get("event_type")

    if event == "REFUND":
        # créditer customer
        pass
    elif event == "VOID":
        # rollback interne
        pass
    elif event == "PAYMENT_CANCELLATION":
        # signal informatif — attendre webhook final
        pass
    else:
        # PAYMENT (pas de event_type) — status détermine action
        if payload["status"] == "SUCCESS":
            # marquer commande payée
            pass

    return {"received": True}
```

### Exemple Node.js (Express)

```javascript
import express from 'express';
import crypto from 'node:crypto';

const CALLBACK_SECRET = process.env.MOKO_CALLBACK_SECRET;

function verifyMokoSignature(header, rawBody) {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const ts = parts.t;
  const receivedSig = parts.v1;
  if (!ts || !receivedSig) return false;

  const message = Buffer.concat([Buffer.from(ts), rawBody]);
  const expected = crypto.createHmac('sha256', CALLBACK_SECRET)
    .update(message)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expected));
}

const app = express();

// IMPORTANT: raw body pour la vérif HMAC
app.post('/webhooks/moko',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['x-freshpay-signature'];
    if (!sig || !verifyMokoSignature(sig, req.body)) {
      return res.status(403).send('Invalid signature');
    }
    const payload = JSON.parse(req.body.toString());
    // ... traiter
    res.json({ received: true });
  }
);
```

## Idempotence

Moko peut réessayer si votre serveur timeout ou renvoie 5xx. Votre handler doit être **idempotent** :

```python
# BAD
def handle_payment_success(tx_uuid):
    stock -= 1  # ❌ si reçu 3x, stock -= 3

# GOOD
def handle_payment_success(tx_uuid):
    order = get_order_by_tx(tx_uuid)
    if order.status != 'pending':
        return  # déjà traité
    order.status = 'paid'
    stock -= 1
```

## Codes de réponse attendus

- **2xx** — succès, Moko ne retry pas
- **4xx** (sauf 429) — erreur permanente, Moko ne retry pas
- **429** — throttle
- **5xx** — erreur temporaire, Moko peut retry

## Debug

Tester la réception avec les endpoints Moko :

```bash
curl -X POST https://uc.card.gofreshpay.com/api/v1/test/test-callback \
  -H "Content-Type: application/json" \
  -d '{"your":"payload","for":"testing"}'

# Consulter historique reçu
curl https://uc.card.gofreshpay.com/api/v1/test/test-callback/history

# Dernier reçu
curl https://uc.card.gofreshpay.com/api/v1/test/test-callback/last
```

Pour tester en local avec Moko qui POSTe chez vous : utilisez [ngrok](https://ngrok.com/) pour exposer votre serveur dev en HTTPS.
