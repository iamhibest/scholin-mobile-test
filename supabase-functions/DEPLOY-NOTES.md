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
