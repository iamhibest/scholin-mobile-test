# Ads on the Job Vacancies page

Ads are OFF by default. The app builds and runs exactly as before until you switch them on.

## What the page does
- Quiet sponsored banner after every 6th job (setting: feed_every), never at the top, never back to back.
- One banner under the job description on the detail page, never next to the Apply button.
- No full screen ads, no pop ups, no ads that cover content. The slot collapses to nothing if an ad fails.

## What you need (Google AdMob)
1. An AdMob account (admob.google.com) and add the Scholin Android app.
2. The AdMob App ID (looks like ca-app-pub-1234567890123456~1234567890).
3. One Banner ad unit ID (looks like ca-app-pub-1234567890123456/1234567890).
4. For payouts, AdMob needs your payment profile and tax details. Ads can run on test mode before this is done.

## Turn it on (no code edits)
1. Run migrations/ad-config-migration.sql in the Supabase SQL editor.
2. GitHub repo > Settings > Secrets and variables > Actions:
   - Secret: ADMOB_APP_ID = your App ID
   - Variable (Variables tab): ENABLE_ADS = true
3. Push or run the build again, install the new APK.
4. In Supabase table ad_config set banner_unit_id to your banner unit ID.
   Keep use_test_ads = true first and ads_enabled = true to check the layout with Google test ads.
5. When happy, set use_test_ads = false. Never tap your own live ads, AdMob can ban the account.

## Keys
The App ID is only in the build (GitHub secret), not in the code. The banner unit ID is read from the server.
Ad IDs are public identifiers, not passwords. They cannot be fully hidden, because the ad library needs them on the phone.
