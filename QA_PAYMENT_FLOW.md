# MediCrew payment QA checklist

- Company pays the mission through MediCrew.
- MediCrew service fee is fixed at 5% of mission compensation.
- 95% is reserved for the verified professional payout.
- Mission cannot start until payment status is `paid`.
- Pre-start cancellation refunds a completed payment before cancellation.
- Both parties must confirm completion before payout release.
- Payout is created server-side to the professional's Stripe Connect account.
- Stripe secret keys are never shipped in the mobile app.
