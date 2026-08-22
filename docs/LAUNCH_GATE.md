# MediCrew launch gate

## Accounts and security

- [ ] The designated admin can sign in and reaches /admin directly.
- [ ] A non-admin cannot read admin queues or execute admin actions.
- [ ] Email confirmation, reset-password deep link and password-changed notification work.
- [ ] Custom SMTP, leaked-password protection and reasonable Auth rate limits are enabled.
- [ ] Security Advisor has no unexpected anonymous privileged-function access.

## Verification and marketplace

- [ ] Professional and organization review flows pass with real test accounts.
- [ ] Unverified accounts cannot access marketplace functions.
- [ ] Mission discovery, application, selection, chat, cancellation and two-sided completion pass.
- [ ] Cross-account RLS attempts fail for profiles, documents, missions, chats and invoices.

## Billing and notifications

- [ ] The 11% service fee shown in the app matches the database and legal terms.
- [ ] A completed mission produces at most one Stripe-hosted invoice.
- [ ] Paid, failed and webhook-retry cases reconcile correctly.
- [ ] Push and transactional email delivery pass on physical devices.

## Legal and stores

- [ ] Operator legal identity, address, support/privacy contacts and governing law are final.
- [ ] Retention, deletion and data-subject-request procedures are documented.
- [ ] iOS and Android production builds pass docs/QA.md.
- [ ] Store privacy disclosures, age rating, screenshots and metadata are complete.
