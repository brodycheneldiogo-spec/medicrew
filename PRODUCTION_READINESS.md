# MediCrew production readiness

## Implemented in code

- Two-step account creation: mandatory phone verification followed by mandatory email + password.
- Password visibility toggle and password recovery flow remain enabled.
- Professional and company names are stored in the account profile.
- Professional and company profile photos use the `avatars` Storage bucket.
- Company onboarding requires legal company information and routes to document-backed verification.
- Professional verification requires verified identity + professional registration evidence before an admin can mark the professional verified.
- Company verification requires at least one verified company-registration document before an admin can mark the company verified.
- Real private document uploads and admin signed-file viewing are enabled.
- Monthly availability calendar uses real dates for the displayed month, with month navigation and professional timezone storage.
- Companies can see the selected professional's current-month availability before selecting them.
- Matching continues to use the mission's actual departure timestamp and professional availability.
- Mission lifecycle remains server-controlled, including two-sided completion and cancellation rules.
- Mission chat remains limited to mission members and explicitly prohibits patient-identifying information.
- Push notification infrastructure remains in place.
- Direct-payment marketplace model implemented: MediCrew displays compensation but does not collect, hold or transfer mission funds.
- Obsolete Stripe mobile integration and payment functions are disabled.
- Privacy policy, data policy and terms were aligned with the direct-payment model.
- iOS/Android profile-photo permissions are configured for Expo SDK 54.

## Release blockers that cannot be completed from source control alone

1. Apply Supabase migrations `0032_final_marketplace_model.sql` and `0033_availability_timezone_security.sql` to the production database.
2. Configure Supabase Auth phone/SMS provider and email SMTP/provider in the production project.
3. Configure production `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (or current Supabase publishable-key equivalent) in the build environment.
4. Configure production push credentials / EAS project credentials and verify APNs + FCM delivery on physical devices.
5. Complete Apple Developer and Google Play Console organization/account setup, signing, store metadata and privacy declarations.
6. Replace the legal placeholder support contact, controller/legal-entity information, governing law and jurisdiction clauses after legal review.
7. Perform physical-device acceptance testing for authentication, document upload, push notifications, camera/photo permissions, calendar timezones and mission lifecycle.
8. Run the production database dry-run/push and verify RLS/storage policies against the live Supabase project.

## Payment model

MediCrew intentionally does **not** require Stripe for mission compensation. The app follows a direct marketplace model: the company and professional agree the mission terms and settle the professional compensation directly. MediCrew does not hold or release those funds.
