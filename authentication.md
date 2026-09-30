# Authentication

L'API Moko utilise **HMAC-SHA256** pour signer chaque requête marchand.

## Base URL

```
https://uc.card.gofreshpay.com
```

L'environnement (development / production) est déterminé par votre profile marchand côté serveur. Une clé rattachée à un environnement ne peut pas appeler l'autre — sinon `403 Unauthorized environment`.

## Récupérer vos clés

Contact `dev@gofreshpay.com` pour recevoir vos clés sandbox et démarrer les tests. Une fois validé, les clés prod sont livrées séparément.

Chaque marchand reçoit :

- `X-API-Key` : identifiant public
- `api_secret` : clé HMAC (**doit rester server-side**)
- `callback_secret` : clé HMAC distincte pour vérifier les webhooks reçus (voir [Webhooks](/card/webhooks))

## Headers requis

Chaque requête doit inclure les 3 headers :

| Header | Valeur |
|---|---|
| `X-API-Key` | Votre clé publique |
| `X-Timestamp` | Timestamp ISO 8601 (parseable par `datetime.fromisoformat`) |
| `X-Signature` | HMAC-SHA256 hex de `body + timestamp` avec `api_secret` |

## Algorithme de signature

```
message   = request_body_string + timestamp_string
signature = HMAC_SHA256(api_secret, message).hexdigest()
```

- `request_body_string` = body JSON sérialisé sans espaces additionnels (le même octet-pour-octet que ce que vous envoyez)
- `timestamp_string` = valeur exacte de votre header `X-Timestamp`
- **Pas de séparateur** entre body et timestamp — concat directe
- Résultat = string hex 64 caractères (lowercase)

**Note** : pour les endpoints qui n'ont pas de body (GET), utilisez `body_string = ""` (chaîne vide).

## Fenêtre de validité

Le serveur rejette toute requête dont le `X-Timestamp` est **plus de 30 secondes** dans le passé (par rapport à l'horloge UTC du serveur).

Réponse en cas de timestamp expiré :

```json
{ "detail": "Expired request" }
```
HTTP **408 Request Timeout**.

Assurez-vous que l'horloge de votre serveur est synchronisée via NTP.

## Exemples

::: code-group

```python [Python]
import hmac, hashlib, json
from datetime import datetime, timezone

def sign_request(api_secret: str, body: dict) -> tuple[str, str, str]:
    """Retourne (body_str, timestamp, signature)."""
    body_str = json.dumps(body, separators=(",", ":"))
    ts = datetime.now(timezone.utc).isoformat()
    sig = hmac.new(
        api_secret.encode(),
        (body_str + ts).encode(),
        hashlib.sha256,
    ).hexdigest()
    return body_str, ts, sig
```

```javascript [Node.js]
import crypto from 'node:crypto';

function signRequest(apiSecret, body) {
  const bodyStr = JSON.stringify(body);
  const ts = new Date().toISOString();
  const sig = crypto.createHmac('sha256', apiSecret)
    .update(bodyStr + ts)
    .digest('hex');
  return { bodyStr, ts, sig };
}
```

```php [PHP]
<?php
function signRequest(string $apiSecret, array $body): array {
    $bodyStr = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $ts = gmdate('Y-m-d\TH:i:s\Z');
    $sig = hash_hmac('sha256', $bodyStr . $ts, $apiSecret);
    return ['body' => $bodyStr, 'timestamp' => $ts, 'signature' => $sig];
}
```

:::

## Erreurs d'authentification

| Code HTTP | Detail | Cause |
|---|---|---|
| 401 | `Missing authentication headers` | Un des 3 headers absent |
| 403 | `Invalid credentials` | `X-API-Key` inconnu — merchant introuvable OU api_key ne match pas |
| 403 | `Invalid request signature` | HMAC ne correspond pas (secret mismatch ou body altéré) |
| 403 | `Unauthorized environment` | Clé sandbox utilisée sur endpoint prod (ou l'inverse) |
| 403 | `Test account not allowed in production` | Compte flaggé `is_test=1` utilisé en env production |
| 400 | `Invalid timestamp format` | `X-Timestamp` non parseable par `datetime.fromisoformat` |
| 408 | `Expired request` | `X-Timestamp` > 30s dans le passé |

## Bonnes pratiques

- **Ne jamais** exposer `api_secret` côté frontend (browser, app mobile). Toujours signer server-side.
- Utilisez un **backend proxy** si vous avez un checkout SPA : votre frontend appelle votre backend, qui signe et forwarde vers Moko.
- Rotationnez vos clés au moins **2 fois par an** (contactez support).
- Stockez `api_secret` dans un vault (AWS Secrets Manager, HashiCorp Vault, ou variable d'environnement chiffrée).

## Webhooks reçus depuis Moko

Utilisent un **scheme différent** — voir [Webhooks](/card/webhooks). Le secret utilisé est `callback_secret` (distinct de `api_secret`), et le format de signature est `X-FreshPay-Signature: t=UNIX_TS,v1=HEX`.
