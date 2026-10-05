# Deploy notes for phase 6a

## 1. upload-image (new)
Supabase Dashboard > Edge Functions > Create function named exactly: upload-image
Paste upload-image.ts and deploy.
Add these secrets (Edge Functions > Secrets):
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
Get the key and secret from the Cloudinary dashboard (Settings > API Keys).
After the new app is installed, delete the unsigned upload preset in Cloudinary
(Settings > Upload > Upload presets) so nobody can upload without going through the server.

## 2. Subscription functions (updated, redeploy all three)
- create-subscription-payment
- reinitialize-subscription-payment
- verify-subscription-payment (unchanged, included for reference)
The first two now also return the checkout link and reference, so the app never builds a payment address itself.

## 3. GitHub secret (optional but recommended)
Repo > Settings > Secrets and variables > Actions > New secret
Name: GOOGLE_SERVICES_JSON, value: the full contents of google-services.json.
The build uses it when present, so the file can be removed from the repository.

# Phase 6b: Events and Fees

No new server functions. The screens use the same database tables and functions as your HTML app
(record_event_payment, recalculate_event, assign_students_to_event), which you already have.
If your Supabase project is missing any of them, run the SQL in the migrations folder in this order:
1. events-fees-migration.sql
2. events-fees-permission-migration.sql
3. online-fee-payments-stage-b1-migration.sql (adds the online payment method, needed for Phase 6c)
4. fee-gated-report-release-migration.sql

# Phase 6c: Parents pay online, payout bank account

## Run this once if not done yet (Supabase SQL editor)
1. online-fee-payments-stage-b1-migration.sql
2. school-payout-account-migration.sql
3. payment-terms-migration.sql
4. parent-events-access-migration.sql
5. parent-report-card-renderer-access-migration.sql
(All five are in your original web project folder. The first is also in migrations here.)

## Redeploy one function
- create-fee-payment (replace with create-fee-payment.ts from this folder).
  The only change: it now also returns the checkout link and reference, so the app never builds a payment address.

## Already deployed, nothing to change
create-subaccount, delete-subaccount, verify-fee-payment, paystack-webhook, sync-paystack-settlements.

## Test in Paystack test mode first
1. As the school owner: School Settings > Payout bank account. Pick a bank, enter a 10 digit account number, Verify and save.
2. As admin: Events and Fees > create a fee and assign it to a student.
3. As the parent linked to that student: Fees tab > tap the fee > Pay now. Pay with a Paystack test card.
4. Confirm the balance updates and a receipt appears under Payment history.

# Phase 7a: Vacancy board, announcements, profile and schools

## Redeploy two functions (they now also return the checkout link and reference)
- create-vacancy-payment
- reinitialize-vacancy-payment
(verify-paystack-payment is unchanged, included for reference.)

## Ads (optional, off by default)
See ADS-SETUP.md. Run migrations/ad-config-migration.sql only when you are ready to switch ads on.

## Nothing else to deploy
Announcements, profile, schools and roster use tables and rules you already have from the HTML app.
If announcement edit or delete fails for school admins, run admin-announcements-rls-migration.sql
(from your original web folder) once.

# Phase 7b: Clock a Friend, Results Status, Activity Log, Referrals

No new server functions and no new SQL. These screens use tables and functions you already have:
record-attendance (Clock a Friend), activity_log and mark_activity_seen (Activity Log),
referral_commissions and referral_payouts (Referrals).
If Activity Log rows do not open, run the activity-log migrations from your original web folder:
activity-log-migration.sql, activity-log-payments-teachers-migration.sql, activity-log-tappable-migration.sql.

# Pictures, vacancies and font size fixes

## Run once in the Supabase SQL editor
- vacancy-posting-type-migration.sql  (adds the "for my school or personal" choice to vacancies)

## Redeploy one function
- create-vacancy-payment (replace with create-vacancy-payment.ts from this folder).
  It now saves whether the vacancy is for a school or a personal posting.

## Nothing else changes on the server
upload-image stays exactly as it is.

# Vacancy redesign, QR poster, keyboard fix

## Run once in the Supabase SQL editor (replaces the earlier version of this file)
- vacancy-posting-type-migration.sql
  Adds: school or personal posting, location, category and job type to vacancies.
  Existing vacancies stay as school postings in the Teaching category, Full-time, with no location.

## Redeploy one function (use the new file)
- create-vacancy-payment

## New build library
- react-native-print (the Print button on the attendance poster). It is added to the build workflow automatically.
