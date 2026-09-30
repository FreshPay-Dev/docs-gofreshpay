# Response codes

Codes retournés par Cybersource et surfacés dans nos réponses `POST /charge` sous le champ `reason_code`.

## Codes de succès

| rc | Signification |
|---|---|
| `100` | Requête traitée avec succès. Pas systématiquement présent dans les 201 responses — utiliser `status` en priorité. |

## Codes de refus paiement

| rc | Signification | Retry ? |
|---|---|---|
| `201` | Refusé par la banque émettrice — code générique | Non (contacter banque) |
| `202` | Carte expirée | Non |
| `203` | Refus général | Non |
| `204` | Fonds insuffisants | Après paiement |
| `205` | Carte perdue/volée | Non |
| `207` | Compte suspendu | Non |
| `208` | Carte inactive | Non |
| `209` | Refus émetteur inconnu | Non |
| `210` | Limite de crédit dépassée | Non |
| `211` | CVV invalide | Corriger |
| `221` | Compte gelé | Non |
| `230` | AVS refus | Corriger adresse |
| `231` | Numéro de compte invalide | Corriger |
| `232` | Type de carte non accepté par processeur | Non |
| `233` | Refus général par le processeur | Non |
| `240` | Type de carte ne correspond pas au numéro | Corriger |

## Codes Decision Manager (fraud engine)

| rc | Signification | Notes |
|---|---|---|
| `480` | Marked for review — Decision Manager veut analyse manuelle | Hold shipping en attente confirmation |
| `481` | **Rejected by Decision Manager** — règle fraud a fired | Auth reversée automatiquement. Check `riskInformation.rules` pour la règle exacte |

::: warning Non 3Ds Reject
Sur notre profile Equity Bank, la règle `Non 3Ds Reject` fire si une tx carte n'a pas été authentifiée 3DS. Si vous utilisez Microform, assurez-vous d'appeler `/pa-setup` + `/pa-enroll` + passer `authentication_transaction_id` dans `/charge`. Voir [3DS Payer Authentication](/card/3ds).
:::

## Codes 3DS Payer Auth

| rc | Signification |
|---|---|
| `475` | Cardholder enrolled dans 3DS — challenge en cours (PENDING, pas final) |
| `476` | 3DS authentication failed (wrong OTP, timeout, refus customer) |
| `478` | Merchant fraud reject |

## Codes techniques

| rc | Signification | Action |
|---|---|---|
| `101` | Un ou plusieurs champs requis manquants | Corriger payload |
| `102` | Validation error sur un champ | Corriger payload |
| `104` | Merchant reference déjà utilisé | Idempotence — retourner état existant |
| `150` | Erreur générale Cybersource | Retry avec backoff |
| `151` | Timeout Cybersource | Retry |
| `152` | Timeout processeur | Retry avec délai |

## Codes Refund

| rc | Signification |
|---|---|
| `100` | Refund initié avec succès |
| `102` | Refund invalid data |
| `234` | Refund décliné par processeur |

## Codes Void

| rc | Signification |
|---|---|
| `100` | Void OK |
| `236` | Transaction déjà voided |
| `246` | Cannot be voided at this time (settlement déjà passé) — use [refund](/card/refunds) |

## Interpréter les status normalisés Moko

Notre `/charge` retourne un `status` normalisé :

| Moko `status` | Basé sur CS status | Interprétation marchand |
|---|---|---|
| `SUCCESS` | `AUTHORIZED`, `PARTIAL_AUTHORIZED` | Money committed, ship the product |
| `SUCCESS` (avec warning log) | `AUTHORIZED_PENDING_REVIEW` | DM veut review — hold shipping jusqu'à confirmation |
| `FAILED` | `DECLINED`, `AUTHORIZED_RISK_DECLINED`, `PENDING_AUTHENTICATION`, `PENDING_REVIEW`, `INVALID_REQUEST` | Ne pas ship, montrer erreur customer |
| `3DS_AUTHENTICATION_FAILED` | (interne — pré-check avant charge) | Customer n'a pas complété 3DS |

## Voir aussi

- [Erreurs (RFC 7807)](/references/errors)
- [Sécurité](/references/security)
