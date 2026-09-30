# Webhooks Mobile Money (Callbacks)

Moko envoie des notifications HTTP `POST` en temps réel sur votre `callback_url` quand une transaction Mobile Money change de statut (Successful, Failed, Pending).

## Flow

```
1. Vous initiez un paiement (Collection ou Withdrawal) avec un callback_url
2. Le customer confirme sur son téléphone (STK Push, tape PIN)
3. L'opérateur traite la transaction
4. Moko POSTe un JSON sur votre callback_url
```

Si vous n'avez pas de `callback_url`, utilisez le [Verify endpoint](/mobile-money/verify) en polling.

## Payload standard (non chiffré)

```json
{
  "Status": "Success",
  "Comment": "Transaction Found",
  "Trans_Status": "Successful",
  "Currency": "CDF",
  "Amount": 5000.0,
  "Method": "mpesa",
  "Customer_Details": "243970000000",
  "Reference": "order_001",
  "PayDRC_Reference": "PDxK3mN09vR2qL7y26wPz",
  "Action": "debit",
  "Status_Description": "Transaction successful",
  "Trans_Status_Description": "Paiement recu avec succes",
  "Financial_Institution_id": "MP260405.1234.A56789"
}
```

## Champs du payload

| Champ | Type | Description |
|---|---|---|
| `Status` | string | Toujours `"Success"` — c'est le statut de LIVRAISON du callback, PAS de la transaction |
| `Comment` | string | Toujours `"Transaction Found"` |
| `Trans_Status` | string | **Vrai résultat de la transaction** : `Successful`, `Failed`, `Pending` |
| `Currency` | string | `CDF` ou `USD` |
| `Amount` | number | Montant de la transaction |
| `Method` | string | `mpesa`, `airtel`, `orange`, `afrimoney` |
| `Customer_Details` | string | Numéro customer (`243XXXXXXXXX`) |
| `Reference` | string | Votre référence marchand originale |
| `PayDRC_Reference` | string | Identifiant unique Moko |
| `Action` | string | `debit` (collection) ou `credit` (withdrawal) |
| `Status_Description` | string | Message texte côté Moko |
| `Trans_Status_Description` | string | Message texte côté opérateur telco |
| `Financial_Institution_id` | string | Référence opérateur |

::: warning `Status` vs `Trans_Status`
Le champ `Status` est **toujours** `"Success"` (indique que le callback a été livré). **Utilisez toujours `Trans_Status` pour connaître le résultat réel du paiement.**
:::

## Valeurs de `Trans_Status`

| `Trans_Status` | Signification | Action |
|---|---|---|
| `Successful` | Paiement complété | Marquer commande payée, ship le produit |
| `Failed` | Refusé ou échoué | Notifier customer, ne pas ship |
| `Pending` | Encore en traitement | Attendre le prochain callback (Moko renverra une mise à jour) |

## Exemple handler

::: code-group

```javascript [Node.js (Express)]
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
    const {
        Trans_Status,
        Reference,
        Amount,
        Currency,
        Method,
        PayDRC_Reference,
        Customer_Details,
        Action
    } = req.body;

    // IMPORTANT: Check Trans_Status (NOT Status) for the transaction result
    if (Trans_Status === 'Successful') {
        console.log(`Payment ${Reference} completed: ${Amount} ${Currency} via ${Method}`);
        // updateOrder(Reference, 'paid');
    } else if (Trans_Status === 'Failed') {
        console.log(`Payment ${Reference} failed`);
        // updateOrder(Reference, 'failed');
    } else if (Trans_Status === 'Pending') {
        console.log(`Payment ${Reference} still pending`);
    }

    // Répondre 200 immédiatement pour ACK
    res.status(200).json({ received: true });
});

app.listen(3000);
```

```python [Python (Flask)]
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    data = request.json

    trans_status = data.get('Trans_Status')
    reference = data.get('Reference')
    amount = data.get('Amount')
    currency = data.get('Currency')
    paydrc_ref = data.get('PayDRC_Reference')
    action = data.get('Action')  # "debit" ou "credit"

    # IMPORTANT: Check Trans_Status (NOT Status)
    if trans_status == 'Successful':
        # Payment completed
        pass
    elif trans_status == 'Failed':
        # Payment failed
        pass
    elif trans_status == 'Pending':
        # Attendre prochain callback
        pass

    # Répondre 200 immédiatement
    return jsonify({'received': True}), 200
```

:::

## Retry policy

Moko retry les callbacks jusqu'à **5 fois** avec des délais progressifs si votre endpoint ne répond pas avec un code `2xx`. Vous pouvez toujours vérifier le statut d'une transaction via [Verify](/mobile-money/verify).

## Bonnes pratiques

- **Toujours répondre HTTP 200 immédiatement**, puis traiter en asynchrone (queue, background job)
- **Vérifier `Trans_Status`** (pas `Status`) pour déterminer le résultat
- **Matcher les callbacks** à vos commandes via le champ `Reference`
- **Idempotency** : vous pouvez recevoir le même callback plusieurs fois — dédupliquer par `PayDRC_Reference`
- **HTTPS obligatoire** pour votre `callback_url`
- **Log tous les callbacks reçus** pour debugging et réconciliation

## Callbacks chiffrés (optionnel)

Sur demande, Moko peut activer des callbacks **chiffrés AES-128-CBC + signés HMAC-SHA256** pour votre marchand. Le payload chiffré transite dans un champ `data` base64, et un header `X-Signature` porte la signature.

### Comment ça fonctionne

1. Moko chiffre le payload JSON en AES-128-CBC (clé + IV fournis à vous)
2. Les bytes chiffrés sont encodés en base64
3. Une signature HMAC-SHA256 est calculée sur la string base64
4. Le POST body contient `{ "data": "<base64_encrypted>" }` avec header `X-Signature`

### Format de la requête chiffrée

```
Headers:
  Content-Type: application/json
  X-Signature: a1b2c3d4e5f6...  (HMAC-SHA256 hex digest)

Body:
{
    "data": "U2FsdGVkX1+abc123...base64_encrypted_payload..."
}
```

### Détails chiffrement

| Paramètre | Valeur |
|---|---|
| Algorithme | AES-128-CBC |
| Taille de clé | 16 bytes (fournie par Moko) |
| IV | Identique à la clé AES |
| Padding | PKCS7 |
| Encodage | Bytes chiffrés → base64 |
| Signature | `HMAC-SHA256(hmac_key, base64_string)` envoyée en header `X-Signature` |

### Décrypter côté serveur

1. Vérifier que le header `X-Signature` match `HMAC-SHA256(hmac_key, body.data)`
2. Base64-decode `body.data`
3. Déchiffrer AES-CBC avec votre clé (IV = clé)
4. Retirer padding PKCS7
5. Parser la string JSON résultante

::: code-group

```javascript [Node.js]
const crypto = require('crypto');

const AES_KEY = Buffer.from('your_aes_key_here'); // 16 bytes de Moko
const HMAC_KEY = Buffer.from('your_hmac_key_here'); // 16 bytes de Moko

function verifyAndDecrypt(encryptedData, receivedSignature) {
  // 1. Vérifier signature HMAC
  const expectedSig = crypto
    .createHmac('sha256', HMAC_KEY)
    .update(encryptedData)
    .digest('hex');

  if (expectedSig !== receivedSignature) {
    throw new Error('Invalid signature');
  }

  // 2. Déchiffrer AES-CBC
  const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_KEY);
  let decrypted = decipher.update(Buffer.from(encryptedData, 'base64'));
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-signature'];
  const { data } = req.body;

  const payload = verifyAndDecrypt(data, signature);
  console.log('Decrypted callback:', payload);

  if (payload.Trans_Status === 'Successful') {
    // Update order
  }

  res.status(200).json({ received: true });
});
```

```python [Python]
import hmac, hashlib, base64, json
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

AES_KEY = b'your_aes_key_here'   # 16 bytes de Moko
HMAC_KEY = b'your_hmac_key_here' # 16 bytes de Moko

def verify_and_decrypt(encrypted_data, received_signature):
    # 1. Vérifier HMAC
    expected_sig = hmac.new(HMAC_KEY, encrypted_data.encode(), hashlib.sha256).hexdigest()
    if expected_sig != received_signature:
        raise ValueError('Invalid signature')

    # 2. Déchiffrer AES-CBC
    raw = base64.b64decode(encrypted_data)
    cipher = AES.new(AES_KEY, AES.MODE_CBC, iv=AES_KEY)
    decrypted = unpad(cipher.decrypt(raw), AES.block_size)

    return json.loads(decrypted.decode('utf-8'))

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Signature')
    data = request.json.get('data')

    payload = verify_and_decrypt(data, signature)

    if payload['Trans_Status'] == 'Successful':
        # Update order
        pass

    return jsonify({'received': True}), 200
```

:::

Le chiffrement est **opt-in** — par défaut vos callbacks sont en clair. Pour activer, demandez vos clés AES et HMAC à `dev@gofreshpay.com`.
