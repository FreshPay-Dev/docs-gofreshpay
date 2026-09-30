# Verify

Consulter le statut d'une transaction Mobile Money par sa référence. Utile si vous n'avez pas configuré de `callback_url` OU si vous voulez faire du polling en secours.

## Endpoint

```
POST https://api.gofreshpay.com/api/v1/gateway
```

Same URL que Collection et Withdrawal. Discriminant : `action: "verify"`.

## Body parameters

| Champ | Type | Requis | Description |
|---|---|---|---|
| `merchant_id` | string | ✅ | Votre identifiant marchand |
| `merchant_secrete` | string | ✅ | Votre secret API (noter l'orthographe) |
| `action` | string | ✅ | `verify` |
| `reference` | string | ✅ | Référence à vérifier (`reference` marchand OU `Transaction_id` Moko) |

## Exemples

::: code-group

```bash [cURL]
curl -X POST https://api.gofreshpay.com/api/v1/gateway \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your_merchant_id",
    "merchant_secrete": "your_merchant_secret",
    "action": "verify",
    "reference": "order_001"
  }'
```

```javascript [Node.js]
const axios = require('axios');

const { data } = await axios.post(
  'https://api.gofreshpay.com/api/v1/gateway',
  {
    merchant_id: 'your_merchant_id',
    merchant_secrete: 'your_merchant_secret',
    action: 'verify',
    reference: 'order_001',
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
        'action': 'verify',
        'reference': 'order_001',
    }
)

print(response.json())
```

:::

## Réponse

```json
{
  "Status": "Success",
  "Comment": "Transaction Found",
  "Trans_Status": "Successful",
  "Currency": "CDF",
  "Amount": 5000.0,
  "Method": "mpesa",
  "Customer_result": "243970000000",
  "Reference": "order_001",
  "Transaction_id": "PDxK3mN09vR2qL7y26wPz",
  "Action": "debit",
  "Created_at": "2026-03-06 15:30:00",
  "Updated_at": "2026-03-06 15:30:05",
  "Trans_Status_Description": "Transaction completed",
  "Financial_Institution_id": "TXN123456789"
}
```

## Champs de réponse

| Champ | Description |
|---|---|
| `Status` | `Success` si la tx a été trouvée |
| `Comment` | Message texte (`Transaction Found` en général) |
| `Trans_Status` | **Vrai statut de la transaction** : `Successful`, `Pending`, `Failed` |
| `Currency` | `CDF` ou `USD` |
| `Amount` | Montant |
| `Method` | Opérateur (`mpesa`, `orange`, `airtel`, `afrimoney`) |
| `Customer_result` | Numéro client |
| `Reference` | Votre référence originale |
| `Transaction_id` | Identifiant unique Moko |
| `Action` | `debit` (collection) ou `credit` (withdrawal) |
| `Created_at` | Timestamp création |
| `Updated_at` | Timestamp dernière update |
| `Trans_Status_Description` | Message textuel |
| `Financial_Institution_id` | Référence opérateur |

## Polling strategy

Si vous polls Verify pour connaître le résultat :

- **Intervalle recommandé** : 5-10 secondes
- **Timeout total** : 5 minutes max (au-delà, considérer la tx comme échouée et notifier support)
- **Backoff** : optionnel — les 30 premières secondes tapez plus vite (2-3s), puis espacez
- **Priorité webhook** : si vous avez configuré `callback_url`, le webhook arrivera plus vite que le polling — utilisez-le en priorité, polling en secours seulement

::: tip
En production, préférez toujours [Webhooks](/mobile-money/webhooks) au polling — moins de charge sur nos serveurs et réponse plus rapide côté vous.
:::

## Réf marchand vs réf Moko

Le champ `reference` accepte les deux :
- Votre `reference` original passé au moment du `debit` ou `credit`
- OU le `Transaction_id` Moko retourné dans la réponse initiale

Utile si vous avez perdu votre référence interne mais avez le Moko ID (ou l'inverse).
