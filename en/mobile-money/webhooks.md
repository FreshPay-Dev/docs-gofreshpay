# Mobile Money Webhooks (Callbacks)

Moko sends real-time HTTP `POST` notifications to your `callback_url` when a Mobile Money transaction changes status (Successful, Failed, Pending).

## Flow

```
1. You initiate a payment (Collection or Withdrawal) with a callback_url
2. The customer confirms on their phone (STK Push, enters PIN)
3. The operator processes the transaction
4. Moko POSTs a JSON payload to your callback_url
```

If you don't have a `callback_url`, poll the [Verify endpoint](/en/mobile-money/verify) instead.

## Standard payload (unencrypted)

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

## Payload fields

| Field | Type | Description |
|---|---|---|
| `Status` | string | Always `"Success"` — this is the callback DELIVERY status, NOT the transaction status |
| `Comment` | string | Always `"Transaction Found"` |
| `Trans_Status` | string | **Actual transaction result**: `Successful`, `Failed`, `Pending` |
| `Currency` | string | `CDF` or `USD` |
| `Amount` | number | Transaction amount |
| `Method` | string | `mpesa`, `airtel`, `orange`, `afrimoney` |
| `Customer_Details` | string | Customer phone number (`243XXXXXXXXX`) |
| `Reference` | string | Your original merchant reference |
| `PayDRC_Reference` | string | Unique Moko identifier |
| `Action` | string | `debit` (collection) or `credit` (withdrawal) |
| `Status_Description` | string | Text message from Moko |
| `Trans_Status_Description` | string | Text message from the mobile operator |
| `Financial_Institution_id` | string | Operator reference |

::: warning `Status` vs `Trans_Status`
The `Status` field is **always** `"Success"` (it indicates the callback was delivered). **Always use `Trans_Status` to determine the actual payment result.**
:::

## `Trans_Status` values

| `Trans_Status` | Meaning | Action |
|---|---|---|
| `Successful` | Payment completed | Mark the order as paid, ship the product |
| `Failed` | Declined or failed | Notify the customer, don't ship |
| `Pending` | Still processing | Wait for the next callback (Moko will send an update) |

## Example handler

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

    // Respond 200 immediately to ACK
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
    action = data.get('Action')  # "debit" or "credit"

    # IMPORTANT: Check Trans_Status (NOT Status)
    if trans_status == 'Successful':
        # Payment completed
        pass
    elif trans_status == 'Failed':
        # Payment failed
        pass
    elif trans_status == 'Pending':
        # Wait for the next callback
        pass

    # Respond 200 immediately
    return jsonify({'received': True}), 200
```

:::

## Retry policy

Moko retries callbacks up to **5 times** with increasing delays if your endpoint doesn't respond with a `2xx` code. You can always check a transaction's status via [Verify](/en/mobile-money/verify).

## Best practices

- **Always respond with HTTP 200 immediately**, then process asynchronously (queue, background job)
- **Check `Trans_Status`** (not `Status`) to determine the result
- **Match callbacks** to your orders using the `Reference` field
- **Idempotency**: you may receive the same callback multiple times — deduplicate by `PayDRC_Reference`
- **HTTPS required** for your `callback_url`
- **Log every callback you receive** for debugging and reconciliation

## Encrypted callbacks (optional)

On request, Moko can enable **AES-128-CBC encrypted + HMAC-SHA256 signed** callbacks for your merchant account. The encrypted payload is sent in a base64 `data` field, and an `X-Signature` header carries the signature.

### How it works

1. Moko encrypts the JSON payload with AES-128-CBC (key + IV provided to you)
2. The encrypted bytes are base64-encoded
3. An HMAC-SHA256 signature is computed over the base64 string
4. The POST body contains `{ "data": "<base64_encrypted>" }` with an `X-Signature` header

### Encrypted request format

```
Headers:
  Content-Type: application/json
  X-Signature: a1b2c3d4e5f6...  (HMAC-SHA256 hex digest)

Body:
{
    "data": "U2FsdGVkX1+abc123...base64_encrypted_payload..."
}
```

### Encryption details

| Parameter | Value |
|---|---|
| Algorithm | AES-128-CBC |
| Key size | 16 bytes (provided by Moko) |
| IV | Same as the AES key |
| Padding | PKCS7 |
| Encoding | Encrypted bytes → base64 |
| Signature | `HMAC-SHA256(hmac_key, base64_string)` sent in the `X-Signature` header |

### Decrypting on your server

1. Verify that the `X-Signature` header matches `HMAC-SHA256(hmac_key, body.data)`
2. Base64-decode `body.data`
3. Decrypt with AES-CBC using your key (IV = key)
4. Remove the PKCS7 padding
5. Parse the resulting JSON string

::: code-group

```javascript [Node.js]
const crypto = require('crypto');

const AES_KEY = Buffer.from('your_aes_key_here'); // 16 bytes from Moko
const HMAC_KEY = Buffer.from('your_hmac_key_here'); // 16 bytes from Moko

function verifyAndDecrypt(encryptedData, receivedSignature) {
  // 1. Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', HMAC_KEY)
    .update(encryptedData)
    .digest('hex');

  if (expectedSig !== receivedSignature) {
    throw new Error('Invalid signature');
  }

  // 2. Decrypt AES-CBC
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

AES_KEY = b'your_aes_key_here'   # 16 bytes from Moko
HMAC_KEY = b'your_hmac_key_here' # 16 bytes from Moko

def verify_and_decrypt(encrypted_data, received_signature):
    # 1. Verify HMAC
    expected_sig = hmac.new(HMAC_KEY, encrypted_data.encode(), hashlib.sha256).hexdigest()
    if expected_sig != received_signature:
        raise ValueError('Invalid signature')

    # 2. Decrypt AES-CBC
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

Encryption is **opt-in** — by default your callbacks are sent in plain text. To enable it, request your AES and HMAC keys from `henock.barakael@mokoafrika.com`.
