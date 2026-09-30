# Response codes

Codes retournés par Cybersource et surfacés dans nos webhooks (champ `message` + `decision`) ou dans les réponses `/microform/charge` (champ `reason_code`).

::: info Source de vérité
Cette page liste les codes que nous avons observés en production ou explicitement gérés dans notre backend. Pour la liste exhaustive et à jour, consultez la [documentation officielle Cybersource](https://developer.cybersource.com/api/reference/response-codes.html).
:::

## Codes de succès

| rc | Signification |
|---|---|
| `100` | Succès. Peut être absent du top-level dans certaines réponses `/pts/v2/payments` — dans ce cas se baser sur le champ `status` (`AUTHORIZED`, `PARTIAL_AUTHORIZED`). |

## Codes 3DS Payer Authentication

Observés dans notre flow Microform 3DS :

| rc | Signification |
|---|---|
| `475` | Cardholder enrolled dans 3DS — challenge en cours (statut `PENDING_AUTHENTICATION`, intermédiaire) |
| `476` | 3DS authentication failed (OTP incorrect, timeout, refus customer, session Entersekt expirée) |

Notre `/microform/charge` retourne `reason_code: "476"` si le pré-check `/risk/v1/authentication-results` détecte que le challenge n'a pas abouti.

## Codes Decision Manager (fraud engine)

| rc | Signification | Action |
|---|---|---|
| `480` | Marked for review — DM veut analyse manuelle | Auth OK, mais hold shipping/service jusqu'à confirmation manuelle |
| `481` | **Rejected by Decision Manager** — règle fraud a fired | Auth reversée automatiquement par CS. Check `riskInformation.rules` pour identifier la règle |

::: warning Non 3Ds Reject (rc=481 sur notre profile)
Sur notre profile Cybersource `Equity Bank Standard Profile`, la règle `Non 3Ds Reject` fire automatiquement si une tx carte n'est pas authentifiée 3DS. Pour Microform, **assurez-vous d'appeler `/pa-setup` + `/pa-enroll` + de passer `authentication_transaction_id` dans `/charge`**. Voir [3DS Payer Authentication](/card/3ds).

Le Hosted Checkout (UC) gère 3DS automatiquement — pas d'action requise côté marchand.
:::

## Codes Void

| rc | Signification |
|---|---|
| `100` | Void OK |
| `236` | Transaction déjà voided ou reversée (idempotence : c'est un no-op) |
| `246` | Cannot be voided at this time — settlement CS déjà passé. Utilisez [Refund](/card/refunds) à la place. |

## Codes Refund

| rc | Signification |
|---|---|
| `100` | Refund initié avec succès |

Erreurs refund (montant invalide, tx introuvable, etc.) sont retournées avec status HTTP 4xx et un `detail` textuel — pas via reason_code.

## Codes de refus paiement courants

Les codes ci-dessous sont documentés dans la référence Cybersource officielle. Ce sont les codes émis par la banque émettrice via le processeur (Equity Bank Kenya dans notre cas) :

| rc | Signification typique |
|---|---|
| `201` | Refus général de la banque émettrice |
| `202` | Carte expirée |
| `203` | Refus général du processeur |
| `204` | Fonds insuffisants |
| `205` | Carte perdue ou volée |
| `207` | Compte suspendu |
| `208` | Carte inactive |
| `210` | Limite de crédit dépassée |
| `211` | CVV invalide (mismatch) |
| `230` | AVS refus — adresse ne correspond pas |
| `231` | Numéro de compte invalide |
| `232` | Type de carte non accepté par le processeur |
| `233` | Refus général par le processeur |
| `240` | Type de carte ne correspond pas au préfixe du numéro |

Ces codes peuvent varier légèrement selon l'issuer et le pays. Considérez toujours le `message` textuel retourné en complément.

## Interprétation `status` normalisé Moko (`/microform/charge`)

Notre `/microform/charge` normalise le `status` Cybersource selon cette logique (extrait du code) :

| Moko `status` | CS status correspondant | Interprétation marchand |
|---|---|---|
| `SUCCESS` | `AUTHORIZED`, `PARTIAL_AUTHORIZED` | Money committed. Ship le produit / service. |
| `SUCCESS` (log warning) | `AUTHORIZED_PENDING_REVIEW` | DM veut review manuel. Ne PAS ship — attendre confirmation support. |
| `FAILED` | `DECLINED`, `AUTHORIZED_RISK_DECLINED`, `PENDING_AUTHENTICATION`, `PENDING_REVIEW`, `INVALID_REQUEST` | Aucun charge. Montrer erreur customer. |
| `FAILED` (défensif) | Tout autre status inattendu | Log warning pour investigation support. |

## Interprétation `transaction_status` (POST /payment/status)

`transaction_status` correspond à la colonne DB `cybersource_transactions.status` — enum :

| Value | Signification |
|---|---|
| `PENDING` | Tx créée, checkout pas encore complété |
| `SUCCESS` | Charge OK |
| `FAILED` | Charge échoué (declined, 3DS fail, etc.) |
| `CANCELLED` | Customer a cliqué "Annuler" sur checkout |
| `EXPIRED` | 20 min TTL dépassé sans complétion |
| `REFUNDED` | Totalement refundée |
| `PARTIALLY_REFUNDED` | Partiellement refundée |
| `VOIDED` | Voided avant settlement |

## Voir aussi

- [Erreurs (RFC 7807)](/references/errors)
- [Sécurité](/references/security)
- [Cybersource official reason codes](https://developer.cybersource.com/api/reference/response-codes.html)
