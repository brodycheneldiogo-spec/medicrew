# MediCrew production checklist

## Product model
MediCrew is a two-sided medical transport marketplace inspired by the operating model of marketplace staffing platforms: professionals join and apply without a professional-side platform fee; companies publish missions, select verified professionals and pay the MediCrew service fee after a completed mission. There is no live GPS tracking layer.

## Implemented in code
- Mandatory phone OTP + email/password account completion.
- Email verification, resend and password recovery/reset.
- Private professional document storage with real uploads and signed admin viewing.
- Admin verification for companies, professionals, documents and certifications.
- Verification expiry handling and audit logs.
- Real multi-slot availability calendar backed by `professional_availability`.
- Push-token registration and push delivery Edge Function infrastructure.
- Company service-fee ledger generated after mission completion.
- Stripe PaymentIntent preparation and webhook reconciliation on the server.
- International country/language/currency foundations.
- Privacy, terms and data-handling screens.
- Production icon, splash and EAS build configuration.

## Secrets
Never commit `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUSH_DISPATCH_SECRET` or any Supabase service/secret key. Client `EXPO_PUBLIC_*` values are intended for the mobile build and must still be protected by RLS.

## Supabase production
1. Link the repository to the production Supabase project.
2. Apply migrations through `0031_push_dispatch.sql`.
3. Enable email confirmations in Supabase Auth.
4. Configure `medicrew://reset-password` and the production email confirmation URL.
5. Deploy `create-payment-intent`, `stripe-webhook` and `send-push-notification`.
6. Set the Edge Function secrets from `supabase/functions/.env.example` without committing the real file.
7. Create a Database Webhook for INSERT on `public.notification_push_queue` -> `send-push-notification` and send `x-push-dispatch-secret`.
8. Configure the Stripe webhook to `stripe-webhook` and store its signing secret.
9. Confirm the `professional-documents` bucket is private.

## Store release
Run `npm install`, `npm run typecheck` and `npm run doctor`. Test a development/release build on a physical iPhone and Android device. Then configure EAS credentials and run `eas build --platform all --profile production`. Submit with EAS after the Apple/Google store accounts, certificates and listing metadata are configured.

## Manual QA
### Authentication
- [ ] Phone OTP cannot be skipped.
- [ ] Email/password cannot be skipped for new accounts.
- [ ] Password eye button works.
- [ ] Email confirmation blocks marketplace actions until confirmed.
- [ ] Resend email works.
- [ ] Password reset link opens and saves a new password.
### Verification
- [ ] PDF/JPG/PNG/WEBP <= 10 MB uploads successfully.
- [ ] Unsupported or oversized files are rejected.
- [ ] Upload creates a pending record.
- [ ] Professional cannot self-verify.
- [ ] Admin can open a private file through a short-lived signed URL.
- [ ] Admin can verify/reject documents and certifications.
- [ ] Expired credentials become expired.
- [ ] Only verified professionals with confirmed email can become eligible matches.
### Marketplace
- [ ] Unverified companies cannot publish.
- [ ] Requirements and availability are respected.
- [ ] Selection remains atomic.
- [ ] Chat is created only for confirmed missions.
- [ ] In-progress missions cannot be cancelled.
- [ ] Both sides must confirm completion.
### Calendar
- [ ] Multiple future slots can be created.
- [ ] Existing slots can be edited.
- [ ] Slots can be removed.
- [ ] Matching uses exact stored windows.
- [ ] Local time is converted to ISO timestamps.
### Payments
- [ ] Exactly one service-fee ledger row is generated after completion.
- [ ] Companies only see their own payment rows.
- [ ] PaymentIntent is created server-side.
- [ ] Stripe webhook changes the ledger to paid/failed/cancelled.
- [ ] Raw card data never enters MediCrew storage.
### Push
- [ ] iOS permission prompt appears.
- [ ] Android notification channel exists.
- [ ] Push token is stored per device.
- [ ] Notification opens the mission screen.
- [ ] Disabled permissions do not block the app.
### Privacy/safety
- [ ] Patient-identifying information is not requested in marketplace fields.
- [ ] Private documents cannot be opened anonymously.
- [ ] Admin-only RPCs reject non-admin users.
- [ ] No service-role or Stripe secret is shipped to the client.

## Important limitation
The admin verification workflow is real, but a document upload is not proof of authenticity by itself. Real-world credential verification becomes authoritative only when an authorized reviewer checks the source document and, where required, an official registry or identity provider. This repository does not invent such an external verification result.

The in-app legal text is a production baseline and must be reviewed with the final MediCrew legal entity, controller address, retention periods, jurisdiction-specific clauses and support contact before public launch.
