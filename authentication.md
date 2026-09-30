# Authentication

L'API Moko utilise **HMAC-SHA256** pour signer chaque requête marchand. Ce schéma résiste au replay attack et empêche la manipulation du payload en transit.

## Base URL

Une seule URL pour sandbox et production :

```
https://uc.card.gofreshpay.com
```

L'environnement est déterminé par vos clés API :

- **Sandbox** — clés préfixées `test_` (ou `nex_test_*`). Aucun débit réel.
- **Production** — clés préfixées `live_` (ou `nex_live_*`). Débits réels sur les cartes.

::: warning
Ne jamais mixer une clé sandbox et une clé production dans la même requête. Le serveur vérifie strictement.
:::

## Récupérer vos clés

Contact `dev@gofreshpay.com` pour recevoir vos clés sandbox et démarrer les tests. Une fois validé, les clés prod sont livrées séparément (canal chiffré).

Chaque marchand reçoit :

- `X-API-Key` : identifiant public (peut apparaître dans les headers)
- `api_secret` : clé HMAC (**doit rester server-side**, jamais exposée en JS browser)

## Headers requis

Chaque requête doit inclure les 3 headers :

| Header | Valeur |
|---|---|
| `X-API-Key` | Votre clé publique |
| `X-Timestamp` | Timestamp ISO 8601 UTC (ex : `2026-09-30T10:00:00Z`) |
| `X-Signature` | HMAC-SHA256 hex de `body + timestamp` avec `api_secret` |

## Algorithme de signature

```
signature = HMAC_SHA256(api_secret, request_body + timestamp).hexdigest()
```

- `request_body` = body JSON sans espaces (le même qu'envoyé dans `-d`)
- `timestamp` = ISO 8601 UTC (identique au header `X-Timestamp`)
- Résultat = string hex 64 caractères

**Note** : pour un GET sans body, `request_body = ""` (chaîne vide).

## Fenêtre de validité

Le serveur rejette toute requête dont le `X-Timestamp` est **plus vieux que 30 secondes**. Assurez-vous que l'horloge de votre serveur est synchronisée (NTP).

Réponse en cas de timestamp expiré :

```json
{ "detail": "Expired request" }
```
HTTP 408 Request Timeout.

## Exemples

::: code-group

```python [Python]
import hmac, hashlib, json
from datetime import datetime, timezone

def sign_request(api_secret: str, body: dict) -> tuple[str, str, str]:
    """Retourne (body_str, timestamp, signature)."""
    body_str = json.dumps(body, separators=(",", ":"))
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
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
| 403 | `Invalid credentials` | `X-API-Key` inconnu ou révoqué |
| 403 | `Invalid request signature` | HMAC ne correspond pas (secret mismatch ou body altéré) |
| 403 | `Unauthorized environment` | Clé sandbox utilisée sur endpoint prod (ou l'inverse) |
| 408 | `Expired request` | `X-Timestamp` > 30s dans le passé |

## Bonnes pratiques

- **Ne jamais** exposer `api_secret` côté frontend (browser, app mobile). Toujours signer server-side.
- Utilisez un **backend proxy** si vous avez un checkout SPA : votre frontend appelle votre backend, qui signe et forwarde vers Moko.
- Rotationnez vos clés au moins **2 fois par an** (via `POST /api/v1/merchants/regenerate-keys`, contactez support).
- Stockez `api_secret` dans un vault (AWS Secrets Manager, HashiCorp Vault, ou variable d'environnement chiffrée).
- Surveillez les 403 récurrents dans vos logs — indicateur potentiel de fuite de clé.

## Callbacks / Webhooks

Les webhooks reçus depuis Moko sont **également signés** — mais avec un scheme légèrement différent (`X-FreshPay-Signature` + `callback_secret` par marchand). Voir [Webhooks](/card/webhooks) pour la vérification côté récepteur.
