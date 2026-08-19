# MediCrew launch gate

This checklist is the minimum release gate for the production marketplace. A green GitHub CI run is not a substitute for a real-device and payment-provider test.

## Database
- [ ] Back up production before the first production migration.
- [ ] Reconcile Supabase migration history before applying `0035_production_consolidation.sql`.
- [ ] Apply the consolidation migration once and verify its objects with SQL read-only checks.
- [ ] Confirm RLS is enabled on all user/document/payment tables.
- [ ] Confirm the admin queue only returns to profiles with `role = admin`.
- [ ] Confirm the configured admin identity is actually the intended account before launch.

## Marketplace
- [ ] Company verification is required before mission publication.
- [ ] Professional verification is required before matching/acceptance.
- [ ] Event missions require an event country.
- [ ] Event matching requires professional type + availability + same-country or explicit international availability.
- [ ] International matching does not imply work/licensing/immigration permission.
- [ ] Company ↔ professional messaging is restricted to the intended mission lifecycle.

## Payments
- [ ] Configure Stripe server-side secrets only in Supabase Edge Function secrets.
- [ ] Configure Stripe Connect onboarding for professionals where payouts are required.
- [ ] Configure and verify the Stripe webhook endpoint.
- [ ] Test success, decline, cancellation, refund and webhook retry paths in Stripe test mode.
- [ ] Verify the mission cannot enter `in_progress` before the server records a successful payment.
- [ ] Verify the professional payout path only releases after the configured completion workflow.
- [ ] Replace any placeholder platform/company legal information before production payments.

## Notifications and messaging
- [ ] Test device push-token registration on iOS.
- [ ] Test mission match, application, selection, payment, cancellation and message notifications.
- [ ] Confirm duplicate notification triggers do not exist.
- [ ] Confirm Realtime/message RLS on real accounts.

## Legal and privacy
- [ ] Insert the operator's legal name, address and support contact.
- [ ] Have counsel review Terms, Privacy Policy and Data Handling Policy for each launch market.
- [ ] Add the final privacy-policy URL required by App Store Connect.
- [ ] Do not collect or store unnecessary patient-identifying information.
- [ ] Define retention/deletion periods for identity and professional documents.
- [ ] Confirm GDPR/data-subject request handling for EU users.

## App Store
- [ ] Test the production build on a physical iPhone.
- [ ] Verify notification permission messaging and deep links.
- [ ] Verify account deletion flow if accounts can be created.
- [ ] Complete App Store privacy nutrition labels and age rating truthfully.
- [ ] Confirm payment functionality complies with Apple's current review rules and the business model.

## Important
MediCrew should not be described as "ready for public launch" until the payment provider, legal operator identity, privacy disclosures and production database migration have been verified in the actual deployment environment.
