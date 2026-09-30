# Withdrawal (Payout)

Envoyer de l'argent vers le wallet Mobile Money d'un customer. Les fonds sont débités de votre wallet Moko et crédités asynchronement sur le wallet de l'opérateur.

## Endpoint

```
POST https://api.gofreshpay.com/api/v1/gateway
```

Content-Type : `application/json`. Pas de header d'auth — les identifiants sont dans le body (voir [Overview](/mobile-money/overview#auth)).

## Body parameters

| Champ | Type | Requis | Description |
|---|---|---|---|
| `merchant_id` | string | ✅ | Votre identifiant marchand |
| `merchant_secrete` | string | ✅ | Votre secret API (noter l'orthographe) |
| `action` | string | ✅ | `credit` — pour withdrawal |
| `method` | string | ✅ | `mpesa`, `orange`, `airtel`, `afrimoney` |
| `amount` | string | ✅ | Montant à envoyer |
| `currency` | string | ✅ | `CDF` ou `USD` |
| `customer_number` | string | ✅ | Numéro destinataire format `243XXXXXXXXX` |
| `reference` | string | ✅ | Votre référence unique par payout |
| `firstname` | string | ✅ | Prénom du destinataire |
| `lastname` | string | ✅ | Nom du destinataire |
| `email` | string | ✅ | Email du destinataire |
| `callback_url` | string | | URL webhook pour notifications async |

## Exemples

::: code-group

```bash [cURL]
curl -X POST https://api.gofreshpay.com/api/v1/gateway \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your_merchant_id",
    "merchant_secrete": "your_merchant_secret",
    "action": "credit",
    "method": "mpesa",
    "amount": "5000",
    "currency": "CDF",
    "customer_number": "243970000000",
    "reference": "payout_001",
    "firstname": "John",
    "lastname": "Doe",
    "email": "john@example.com",
    "callback_url": "https://yoursite.com/webhook"
  }'
```

```javascript [Node.js]
const axios = require('axios');

const { data } = await axios.post(
  'https://api.gofreshpay.com/api/v1/gateway',
  {
    merchant_id: 'your_merchant_id',
    merchant_secrete: 'your_merchant_secret',
    action: 'credit',
    method: 'mpesa',
    amount: '5000',
    currency: 'CDF',
    customer_number: '243970000000',
    reference: 'payout_001',
    firstname: 'John',
    lastname: 'Doe',
    email: 'john@example.com',
    callback_url: 'https://yoursite.com/webhook',
  }
);

console.log(data);
```

```python [Python]
import requests

response = requests.post(
    'https://api.gofreshpay.com/api/v1/gateway',
    json={
        'merchant_id': 'your_merchant_id',
        'merchant_secrete': 'your_merchant_secret',
        'action': 'credit',
        'method': 'mpesa',
        'amount': '5000',
        'currency': 'CDF',
        'customer_number': '243970000000',
        'reference': 'payout_001',
        'firstname': 'John',
        'lastname': 'Doe',
        'email': 'john@example.com',
        'callback_url': 'https://yoursite.com/webhook',
    }
)

print(response.json())
```

```php [PHP]
<?php
$ch = curl_init('https://api.gofreshpay.com/api/v1/gateway');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'merchant_id'      => 'your_merchant_id',
    'merchant_secrete' => 'your_merchant_secret',
    'action'           => 'credit',
    'method'           => 'mpesa',
    'amount'           => '5000',
    'currency'         => 'CDF',
    'customer_number'  => '243970000000',
    'reference'        => 'payout_001',
    'firstname'        => 'John',
    'lastname'         => 'Doe',
    'email'            => 'john@example.com',
    'callback_url'     => 'https://yoursite.com/webhook',
]));

$response = curl_exec($ch);
curl_close($ch);

print_r(json_decode($response));
```

:::

## Réponse (200 OK)

```json
{
  "Reference": "payout_001",
  "Customer_Number": "243970000000",
  "Amount": 5000.0,
  "Currency": "CDF",
  "Created_At": "2026-03-06 13:05:35.018745",
  "Updated_At": "2026-03-06 13:05:35.018764",
  "Transaction_id": "PDz9OCe03Lw3061V63n26qVC"
}
```

::: warning Payout asynchrone
La réponse initiale confirme que le payout a été **initié**. Les fonds sont livrés au wallet du destinataire asynchronement (généralement quelques secondes à quelques minutes). Le vrai résultat arrive via le [webhook](/mobile-money/webhooks) sur votre `callback_url` avec `Trans_Status = Successful | Failed | Pending`.
:::

## Champs de réponse

| Champ | Description |
|---|---|
| `Reference` | Votre référence originale |
| `Customer_Number` | Numéro destinataire |
| `Amount` | Montant |
| `Currency` | `CDF` ou `USD` |
| `Created_At` | Timestamp création côté Moko |
| `Updated_At` | Timestamp dernière update |
| `Transaction_id` | Identifiant unique Moko (à conserver pour `verify`) |

## Précautions payout

- **Vérifier le solde de votre wallet Moko** avant d'initier un payout de grande taille — si insuffisant, la requête sera rejetée (`Trans_Status: Failed` avec message solde insuffisant côté webhook)
- **Double-checker le `customer_number`** — un mauvais numéro peut envoyer les fonds à quelqu'un d'autre
- **Idempotency** : ne pas retry le même `reference` deux fois sans avoir vérifié via [Verify](/mobile-money/verify) le statut de la première tentative

## Prochaines étapes

- **[Webhooks](/mobile-money/webhooks)** — recevoir le résultat final
- **[Verify](/mobile-money/verify)** — vérifier le statut par référence
