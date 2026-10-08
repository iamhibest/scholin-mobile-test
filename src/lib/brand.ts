import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// What the super admin controls for the whole app: the logo and the Scholin support button.
// It is remembered on the phone, so the right logo shows straight away, even before the internet answers.
export type Brand = { logo: string | null; supportIcon: string | null; supportLabel: string; supportUrl: string };

const STORE = 'scholin.brand';
let cache: Brand | null = null;
let hydrated = false;
let fetched = false;
let inflight: Promise<Brand | null> | null = null;
const subscribers = new Set<(b: Brand) => void>();

function publish(b: Brand) {
  cache = b;
  subscribers.forEach(s => s(b));
  if (b.logo) {
    Image.prefetch(b.logo).catch(() => {});
  }
}

async function hydrate() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORE);
    if (raw && !cache) {
      publish(JSON.parse(raw));
    }
  } catch {}
}

export async function loadBrand(force = false): Promise<Brand | null> {
  await hydrate();
  if (fetched && !force) {
    return cache;
  }
  if (!inflight) {
    inflight = Promise.resolve(supabase.from('app_settings').select('app_logo_url, support_contact_icon_url, support_contact_label, support_contact_url').limit(1).maybeSingle())
      .then((r: any) => {
        if (r && !r.error) {
          const d = r.data || {};
          const fresh: Brand = {
            logo: d.app_logo_url || null,
            supportIcon: d.support_contact_icon_url || null,
            supportLabel: d.support_contact_label || 'Support',
            supportUrl: (d.support_contact_url || '').trim(),
          };
          fetched = true;
          publish(fresh);
          AsyncStorage.setItem(STORE, JSON.stringify(fresh)).catch(() => {});
        }
        return cache;
      })
      .catch(() => cache)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useBrand() {
  const [brand, setBrand] = useState<Brand | null>(cache);
  useEffect(() => {
    subscribers.add(setBrand);
    loadBrand();
    return () => {
      subscribers.delete(setBrand);
    };
  }, []);
  return brand;
}
