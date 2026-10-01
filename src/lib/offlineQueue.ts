import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { supabase } from './supabase';

const KEY = 'scholin_attendance_queue';

type QueuedRegister = { id: string; rows: any[]; label: string; queuedAt: number };

async function read(): Promise<QueuedRegister[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function write(items: QueuedRegister[]) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}

export function isNetworkError(error: any) {
  if (!error) {
    return false;
  }
  if (error.code) {
    return false;
  }
  const message = String(error.message || '').toLowerCase();
  return message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('connection');
}

export async function queueCount() {
  return (await read()).length;
}

export async function saveRegister(rows: any[], label: string): Promise<'saved' | 'queued'> {
  const { error } = await supabase.from('daily_attendance_marks').upsert(rows, { onConflict: 'student_id,mark_date,session' });
  if (!error) {
    return 'saved';
  }
  if (!isNetworkError(error)) {
    throw new Error(error.message || 'Could not save register.');
  }
  const items = await read();
  const key = rows.length ? rows[0].class_id + rows[0].mark_date : String(Date.now());
  const kept = items.filter(i => i.id !== key);
  kept.push({ id: key, rows, label, queuedAt: Date.now() });
  await write(kept);
  return 'queued';
}

let flushing = false;

export async function flushQueue(): Promise<number> {
  if (flushing) {
    return 0;
  }
  flushing = true;
  let sent = 0;
  try {
    const items = await read();
    const remaining: QueuedRegister[] = [];
    for (const item of items) {
      const { error } = await supabase.from('daily_attendance_marks').upsert(item.rows, { onConflict: 'student_id,mark_date,session' });
      if (error) {
        if (isNetworkError(error)) {
          remaining.push(item);
        }
      } else {
        sent++;
      }
    }
    await write(remaining);
  } finally {
    flushing = false;
  }
  return sent;
}

export function startQueueSync() {
  flushQueue();
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') {
      flushQueue();
    }
  });
  return () => sub.remove();
}
