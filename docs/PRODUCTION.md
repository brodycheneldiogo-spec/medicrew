# MediCrew production operations

## Business and payment model

MediCrew is a verified staffing marketplace for air-medical transport and event medical coverage. Organizations and professionals settle professional compensation directly. MediCrew invoices the organization separately for the disclosed 11% service fee after a completed mission. Stripe hosts that invoice payment page; MediCrew never receives raw card data.

## Supabase

- Apply migrations in order and confirm the migration list before release.
- Keep every verification/document bucket private.
- Keep RLS enabled and run Security Advisor after each schema change.
- Client builds contain only the Supabase URL and publishable/anon key.
- Service-role, Stripe, Resend and cron secrets belong only in Edge Function secrets.
- Keep stripe-webhook public only because Stripe cannot send a user JWT; verify every request with the Stripe signature.
- Require authentication or a private cron secret for every other operational Edge Function.

## Authentication

- Allowed mobile redirects: medicrew://auth/callback and medicrew://reset-password.
- The operations admin is work.medicrew.app@gmail.com.
- The user must authenticate with Supabase; knowing the email address never grants access.
- The database assigns the admin role, and every admin RPC checks that server-side role.
- Use the templates in supabase/templates and a custom SMTP sender.

## Builds

Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (or publishable-key equivalent) and EXPO_PUBLIC_EAS_PROJECT_ID in EAS. Run npm ci, typecheck, lint and Expo Doctor before building both production platforms.

Complete the manual checks in docs/QA.md before submission.
