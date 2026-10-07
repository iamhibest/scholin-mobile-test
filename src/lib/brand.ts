import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// What the super admin controls for the whole app: the logo and the Scholin support button.
export type Brand = { logo: string | null; supportIcon: string | null; supportLabel: string; supportUrl: string };

let cache: Brand | null = null;
let inflight: Promise<Brand> | null = null;

export async function loadBrand(force = false): Promise<Brand> {
  if (cache && !force) {
    return cache;
  }
  if (!inflight) {
    inflight = Promise.resolve(supabase.from('app_settings').select('app_logo_url, support_contact_icon_url, support_contact_label, support_contact_url').limit(1).maybeSingle())
      .then((r: any) => {
        const d = r && r.data ? r.data : {};
        cache = {
          logo: d.app_logo_url || null,
          supportIcon: d.support_contact_icon_url || null,
          supportLabel: d.support_contact_label || 'Support',
          supportUrl: (d.support_contact_url || '').trim(),
        };
        return cache;
      })
      .catch(() => cache || { logo: null, supportIcon: null, supportLabel: 'Support', supportUrl: '' })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useBrand() {
  const [brand, setBrand] = useState<Brand | null>(cache);
  useEffect(() => {
    let alive = true;
    loadBrand().then(b => alive && setBrand(b));
    return () => {
      alive = false;
    };
  }, []);
  return brand;
}
