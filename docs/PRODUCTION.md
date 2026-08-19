# MediCrew production checklist

## Product model
MediCrew is a two-sided medical-transport marketplace. Verified professionals can discover/apply to missions; companies publish transport and event missions, select verified professionals and pay mission compensation through MediCrew before the mission starts. MediCrew charges the disclosed platform fee (currently 5% in the production model). After both sides confirm completion, the professional amount can be released through Stripe Connect when payout onboarding is complete.

Event missions can be created for sporting, cultural, corporate and other operational events. Matching prioritizes verified professionals who are available at the required time and are based in the event country or have explicitly enabled international availability.

## Implemented in code
- Mandatory phone OTP + email/password account completion.
- Current Terms, Privacy and Data Handling acceptance recorded at signup.
- Email verification, resend and password recovery/reset.
- Private professional/company document storage with signed admin viewing.
- Admin verification for companies, professionals, documents and certifications.
- Designated operations admin bootstrap for the configured admin account.
- Verification expiry handling and audit records.
- Multi-slot availability calendar backed by `professional_availability`.
- Event missions with country-aware matching and targeted push notifications.
- Push-token registration, queued delivery and stale-token cleanup.
- Transactional email queue and Resend dispatcher for mission/payment events.
- Stripe PaymentIntent creation and webhook reconciliation on the server.
- Stripe Connect payout release after both-sided completion.
- Server-side gate preventing a mission from entering `in_progress` until payment is confirmed.
- International country/language/currency foundations.
- Privacy, terms and data-handling screens.
- Production icon/splash configuration.

## Secrets
Never commit `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUSH_DISPATCH_SECRET`, `RESEND_API_KEY` or any Supabase service/secret key. Client `EXPO_PUBLIC_*` values are intended for the mobile build and must still be protected by RLS.

## Supabase production
1. Link the repository to the production Supabase project.
2. Apply all migrations through the latest migration.
3. Enable email confirmations in Supabase Auth.
4. Configure the production email confirmation and password-reset URLs.
5. Deploy `create-payment-intent`, `stripe-webhook`, `sync-payment-status`, `release-mission-payment`, `create-connect-account-link` and `dispatch-push-queue`.
6. Set Edge Function secrets from `supabase/functions/.env.example` plus `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
7. Configure a secure scheduler/cron to invoke `dispatch-push-queue` with `x-cron-secret: $PUSH_DISPATCH_SECRET`.
8. Configure the Stripe webhook to `stripe-webhook` and store its signing secret.
9. Confirm `professional-documents` and `company-documents` buckets are private.
10. Confirm the designated operations account has `role='admin'` in `public.profiles` after its first production sign-in.

## Store release
Run `npm install`, `npm run typecheck`, `npm run lint` and `npm run doctor`. Test a production build on a physical iPhone. Configure EAS credentials and environment variables, then run `eas build --platform ios --profile production`. Submit with EAS/App Store Connect after the Apple Developer account, certificates, privacy details and listing metadata are configured.

## Manual QA
### Authentication
- [ ] Phone OTP cannot be skipped.
- [ ] Email/password cannot be skipped for new accounts.
- [ ] Password eye button works.
- [ ] Current legal acceptance is required and recorded.
- [ ] Email confirmation blocks marketplace actions until confirmed.
- [ ] Password reset works on a physical iPhone.

### Verification and admin
- [ ] PDF/JPG/PNG/WEBP <= 10 MB uploads successfully.
- [ ] Unsupported or oversized files are rejected.
- [ ] Upload creates a pending record.
- [ ] Professional cannot self-verify.
- [ ] Admin can open a private file through a short-lived signed URL.
- [ ] Admin sees company/professional evidence grouped by the account holder.
- [ ] Admin can verify/reject documents and certifications.
- [ ] Expired credentials become expired.

### Marketplace
- [ ] Unverified companies cannot publish.
- [ ] Requirements and availability are respected.
- [ ] Event matching prefers same-country or explicitly international professionals.
- [ ] Only eligible verified professionals receive event-match notifications.
- [ ] Selection remains atomic.
- [ ] Chat is created only for confirmed missions.
- [ ] Mission confirmation displays the payment step.
- [ ] An unpaid mission cannot enter `in_progress`.
- [ ] Both sides must confirm completion before payout release.

### Payments
- [ ] PaymentIntent is created server-side.
- [ ] Stripe webhook changes the ledger to paid/failed/refunded.
- [ ] Company and assigned professional receive payment notifications.
- [ ] Professional payout uses Stripe Connect only after completion and onboarding.
- [ ] Raw card data never enters MediCrew storage.

### Push and email
- [ ] iOS permission prompt appears.
- [ ] Push token is stored per device.
- [ ] Tapping a mission notification opens the mission.
- [ ] Event matches generate targeted notifications.
- [ ] Transactional email queue receives confirmation/payment events.
- [ ] Resend dispatch sends queued email when the secret is configured.

### Privacy/security
- [ ] Patient-identifying information is not requested in marketplace fields.
- [ ] Private documents cannot be opened anonymously.
- [ ] Admin-only RPCs reject non-admin users.
- [ ] No service-role or Stripe secret is shipped to the client.
- [ ] RLS prevents cross-account document, mission, chat and payment access.

## Legal limitation
The in-app legal documents are a product/legal baseline, not jurisdiction-specific legal advice. Before public operation, the operator must publish its legal identity, registered address, privacy contact, support contact and applicable governing-law/dispute wording, and obtain appropriate review for professional credential data, payments, tax, insurance, employment/agency rules and international event assignments.
