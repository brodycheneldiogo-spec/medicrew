# MediCrew production readiness

## Implemented and verified in source

- Email/password and Google authentication with password recovery.
- The designated operations address is the only email automatically assigned the admin role.
- Admin access is checked against the server-controlled profile role.
- Professional and organization onboarding, review and access gates.
- Private verification data and admin review operations.
- Mission publication, discovery, applications, selection, chat and completion lifecycle.
- Direct professional compensation: MediCrew does not hold the professional's funds.
- An 11% MediCrew service fee, accepted at publication and invoiced after completion.
- Stripe-hosted service-fee invoices and signed webhook reconciliation.
- Push and transactional-email queues.
- English, French and Spanish UI preferences.
- Current legal-acceptance version storage.
- TypeScript, Expo Doctor and ESLint checks in CI.

## Production state checked on 2026-08-22

- Supabase project is active.
- Database migrations through 0072 are applied.
- All exposed application tables use RLS.
- Anonymous execution was removed from all SECURITY DEFINER functions.
- Mutable search paths reported by the Security Advisor were fixed.
- Recovery and password-change email templates exist in supabase/templates.
- No client-side Stripe SDK or Stripe secret is shipped in the mobile bundle.

## External release actions

1. Create and confirm work.medicrew.app@gmail.com once in Supabase Auth, then sign in normally. The database assigns role admin; no MediCrew email-code screen is shown.
2. Paste the two files in supabase/templates into the matching hosted Supabase email templates and enable the password-changed notification.
3. Add medicrew://reset-password and medicrew://auth/callback to Supabase Auth redirect URLs.
4. Configure custom SMTP, sender identity and auth-email rate limits.
5. Enable leaked-password protection in Supabase Auth.
6. Configure production Expo/EAS variables and push credentials.
7. Confirm Stripe server secrets and the stripe-webhook endpoint for service-fee invoices.
8. Replace legal operator placeholders and obtain appropriate legal review.
9. Run docs/QA.md on physical iOS and Android devices.
10. Complete Apple Developer / Google Play signing, privacy declarations and store listings.

Do not call the app publicly launch-ready until these external actions and physical-device QA are complete.
