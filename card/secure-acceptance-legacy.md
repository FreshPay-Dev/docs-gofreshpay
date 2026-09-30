# Secure Acceptance (Legacy)

::: danger Deprecated
Secure Acceptance (SA) est le **premier mode** de paiement carte Moko, en production depuis les débuts de l'offre. Il est aujourd'hui **remplacé par Unified Checkout (UC)** pour toute nouvelle intégration. Les marchands historiques SA continuent de fonctionner sans interruption, mais aucun nouveau marchand n'est provisionné en SA.

**Migration UC** : voir plan de cutover (à publier). Les marchands SA existants seront migrés progressivement.
:::

## Qu'est-ce que SA

Secure Acceptance = solution "hosted checkout" Cybersource première génération. Le flow :

```
1. POST /api/v1/payment/orders                     (mêmes params qu'UC)
2. Réponse : { data: { links: "https://.../{uuid}?sig=..." } }
3. GET /api/v1/payment/{uuid}?sig=...              (page Moko)
4. Backend Moko renvoie une PAGE HTML avec un <form> auto-submit
   contenant les paramètres CS signés (access_key, profile_id, signature, ...)
5. Le browser POSTe automatiquement vers l'URL Cybersource Secure Acceptance
6. Le customer saisit sa carte sur la page Cybersource (formulaire hébergé)
7. 3DS déclenché par CS si applicable
8. CS POSTe le résultat vers /api/v1/payment/receipt
9. Redirect vers return_url marchand
10. Webhook signé sur callback_url (identique à UC)
```

## SA vs UC — pourquoi migrer

| Aspect | SA (legacy) | UC (nouveau) |
|---|---|---|
| Rendu | Page CS avec form auto-submit | SDK embedded dans page Moko |
| Domaine visible | `secureacceptance.cybersource.com` (redirect complet) | `uc.card.gofreshpay.com` (branded Moko) |
| Flow customer | 2 redirects (marchand → CS → marchand) | 1 page stable (SDK Cybersource dans iframe) |
| Personnalisation UX | Faible (page CS standard) | Meilleure (contrôle sur wrapping) |
| 3DS | Automatique | Automatique |
| Cybersource support | En maintenance | Actif (nouveau développement) |
| Reason codes | Identiques | Identiques |
| Refund / Void | Identique (via APIs admin) | Identique |
| Webhook format | Identique | Identique |

## API identique côté marchand

**Bonne nouvelle** : l'API marchand est **strictement identique** entre SA et UC. Le même `POST /api/v1/payment/orders` fonctionne, le même schéma webhook arrive, les mêmes refunds/voids marchent. La différence est **exclusivement backend** — le branching se fait via une variable d'environnement `USE_UC` sur le container Moko qui sert votre marchand.

Autrement dit : **si vous intégrez selon la doc [Hosted Checkout](/card/hosted-checkout) aujourd'hui, votre code fonctionnera pareil que vous soyez servi par un container SA ou UC**. La migration est transparente pour votre code.

## Différences visibles côté customer

- **SA** : après clic "Payer", le browser navigue vers un domaine Cybersource. Le customer voit une URL `secureacceptance.cybersource.com` dans la barre d'adresse. Retour ensuite vers votre `return_url`.
- **UC** : après clic "Payer", le customer reste sur `uc.card.gofreshpay.com` (domaine Moko). Le SDK Cybersource embed les champs carte via iframe sécurisé. Le customer ne voit jamais `cybersource.com` dans son URL.

Le customer perçoit UC comme "plus intégré / plus pro". Moins de dropoff observé.

## Marchands SA existants

Si vous êtes déjà intégré via SA :

- **Vous n'avez rien à changer aujourd'hui.** Votre marchand tourne sur le container SA (`cybersource-app`). Aucune modification de code requise.
- **Vous serez notifié** avant tout basculement — communication au minimum 30 jours avant le flip du flag `USE_UC` sur votre container.
- **Aucun dev côté vous** ne sera nécessaire pour le cutover, sauf changement volontaire vers Microform (custom checkout embedded).
- **Testez UC dès maintenant** en demandant l'accès sandbox UC — même API, vérifiez le rendu customer avant votre migration.

## Nouveaux marchands

Si vous démarrez aujourd'hui votre intégration :

- **Suivez la doc [Hosted Checkout](/card/hosted-checkout)** — vous serez provisionné directement en UC.
- **Pas de choix à faire** entre SA et UC — la décision est backend-side. Nous provisionnons uniquement en UC pour les nouveaux comptes.
- Si vous voulez un contrôle UX total (checkout sur votre propre domaine), voir [Microform](/card/microform).

## Cutover roadmap

À publier. Grandes lignes prévues :

1. **Phase actuelle** : SA et UC coexistent. Nouveau merchant → UC. Ancien merchant → SA (statu quo).
2. **Phase migration** : notification 30j → basculement par batch de marchands, monitoring 48h par batch.
3. **Phase finale** : décommission du container SA `cybersource-app`.

Dates cibles à annoncer avec la communication officielle.

## Support pendant la transition

Pour toute question SA / roadmap migration :

- `dev@gofreshpay.com` (technique)
- `support@gofreshpay.com` (question compte / cutover)

## Voir aussi

- [Hosted Checkout (UC)](/card/hosted-checkout) — l'implémentation actuelle
- [Custom Checkout (Microform)](/card/microform) — pour un contrôle UX total
- [Overview](/card/overview) — comparaison des 3 modes
