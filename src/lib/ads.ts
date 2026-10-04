import { supabase } from './supabase';

export type AdConfig = { enabled: boolean; useTestAds: boolean; bannerUnitId: string; feedEvery: number };

let cached: AdConfig | null = null;
let pending: Promise<AdConfig> | null = null;

const OFF: AdConfig = { enabled: false, useTestAds: false, bannerUnitId: '', feedEvery: 6 };

// The ad unit ids and on/off switch come from the server, so nothing about
// the ad account is stored in the app code.
export function loadAdConfig(): Promise<AdConfig> {
  if (cached) {
    return Promise.resolve(cached);
  }
  if (!pending) {
    pending = (async () => {
      try {
        const { data, error } = await supabase.from('ad_config').select('*').limit(1).maybeSingle();
        if (error || !data) {
          cached = OFF;
        } else {
          cached = {
            enabled: data.ads_enabled === true,
            useTestAds: data.use_test_ads === true,
            bannerUnitId: data.banner_unit_id || '',
            feedEvery: Math.max(4, Number(data.feed_every) || 6),
          };
        }
      } catch {
        cached = OFF;
      }
      return cached as AdConfig;
    })();
  }
  return pending;
}
