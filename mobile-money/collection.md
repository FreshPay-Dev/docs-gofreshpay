# Collection (Deposit)

Collecter un paiement depuis le wallet Mobile Money d'un customer. L'opérateur envoie un **STK Push** sur son téléphone, il tape son PIN, la tx est débitée et créditée à votre wallet Moko.

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
| `action` | string | ✅ | `debit` — pour collection |
| `method` | string | ✅ | `mpesa`, `orange`, `airtel`, `afrimoney` |
| `amount` | string | ✅ | Montant à collecter |
| `currency` | string | ✅ | `CDF` ou `USD` |
| `customer_number` | string | ✅ | Numéro client format `243XXXXXXXXX` |
| `reference` | string | ✅ | Votre référence unique par transaction |
| `firstname` | string | ✅ | Prénom du customer |
| `lastname` | string | ✅ | Nom du customer |
| `email` | string | ✅ | Email du customer |
| `callback_url` | string | | URL webhook pour notifications async |

## Exemples

::: code-group

```bash [cURL]
curl -X POST https://api.gofreshpay.com/api/v1/gateway \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your_merchant_id",
    "merchant_secrete": "your_merchant_secret",
    "action": "debit",
    "method": "mpesa",
    "amount": "5000",
    "currency": "CDF",
    "customer_number": "243970000000",
    "reference": "order_001",
    "firstname": "John",
    "lastname": "Doe",
    "email": "customer@example.com",
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
    action: 'debit',
    method: 'mpesa',
    amount: '5000',
    currency: 'CDF',
    customer_number: '243970000000',
    reference: 'order_001',
    firstname: 'John',
    lastname: 'Doe',
    email: 'customer@example.com',
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
        'action': 'debit',
        'method': 'mpesa',
        'amount': '5000',
        'currency': 'CDF',
        'customer_number': '243970000000',
        'reference': 'order_001',
        'firstname': 'John',
        'lastname': 'Doe',
        'email': 'customer@example.com',
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
    'action'           => 'debit',
    'method'           => 'mpesa',
    'amount'           => '5000',
    'currency'         => 'CDF',
    'customer_number'  => '243970000000',
    'reference'        => 'order_001',
    'firstname'        => 'John',
    'lastname'         => 'Doe',
    'email'            => 'customer@example.com',
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
  "Status": "Success",
  "Comment": "Transaction Received Successfully",
  "Reference": "order_001",
  "Customer_Number": "243970000000",
  "Amount": 5000.0,
  "Currency": "CDF",
  "Created_At": "2026-03-06 13:05:35.018745",
  "Updated_At": "2026-03-06 13:05:35.018764",
  "Transaction_id": "PDxK3mN09vR2qL7y26wPz"
}
```

::: warning `Status: "Success"` ≠ paiement effectué
Le `Status: "Success"` de cette réponse signifie **la requête a été reçue et le STK Push a été envoyé au customer**, PAS que le paiement a été complété. Le vrai résultat arrive via le [webhook](/mobile-money/webhooks) sur votre `callback_url` avec `Trans_Status = Successful | Failed | Pending`.
:::

## Champs de réponse

| Champ | Description |
|---|---|
| `Status` | Status de la requête (`Success` = STK Push envoyé) |
| `Comment` | Message texte |
| `Reference` | Votre référence originale |
| `Customer_Number` | Numéro customer |
| `Amount` | Montant |
| `Currency` | `CDF` ou `USD` |
| `Created_At` | Timestamp création côté Moko |
| `Updated_At` | Timestamp dernière update |
| `Transaction_id` | Identifiant unique Moko (à conserver pour `verify` et reconciliation) |

## Prochaines étapes

- **[Configurer votre webhook](/mobile-money/webhooks)** — recevoir le résultat final
- **[Verify](/mobile-money/verify)** — polling alternatif si vous n'utilisez pas de webhook
- **[Withdrawal](/mobile-money/withdrawal)** — envoyer des fonds vers un customer
