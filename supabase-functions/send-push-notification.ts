// =========================================================
// Supabase Edge Function: send-push-notification   (version 2, drop-in replacement)
//
// Same inputs as before: { category, title, message, school_id?, data? }
// Same categories: vacancy, school_announcement, broadcast. The 2-per-day limit is now OFF (see ENFORCE_DAILY_LIMIT).
//
// What is new:
//  1. It no longer hides failures. The reply now says how many sends failed and why
//     (for example SENDER_ID_MISMATCH means the app's Firebase project is not the one this function uses).
//  2. Phones that Firebase says are gone (uninstalled apps) are removed from push_tokens.
//  3. category 'test' sends only to the person who is calling (used by the app's Notification check).
//  4. Parents of the school's students also get school announcements (set INCLUDE_PARENTS to false to turn this off).
//  5. The phone app shows the notification in its high-importance channel.
//
// HOW TO DEPLOY: Supabase Dashboard > Edge Functions > send-push-notification > replace the code with this file > Deploy.
// The FIREBASE_SERVICE_ACCOUNT secret you already have is used as before.
// =========================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Daily limit is switched OFF for now. Set to true to limit each person to DAILY_CAP_PER_CATEGORY per category per day.
const ENFORCE_DAILY_LIMIT = false;
const DAILY_CAP_PER_CATEGORY = 2;
const INCLUDE_PARENTS = true;
const CATEGORIES = ['vacancy', 'school_announcement', 'broadcast', 'test'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function base64UrlEncode(bytes) {
  const str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(serviceAccount) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header))) + '.' + base64UrlEncode(new TextEncoder().encode(JSON.stringify(claimSet)));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(serviceAccount.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
  const jwt = signingInput + '.' + base64UrlEncode(signature);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error('Failed to get FCM access token: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

// FCM only accepts text values inside data.
function stringifyData(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  return out;
}

async function sendFcmMessage(accessToken, projectId, token, title, body, data) {
  const response = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: stringifyData(data),
        android: { priority: 'high', notification: { channel_id: 'scholin_default', sound: 'default' } },
      },
    }),
  });
  const result = await response.json().catch(() => ({}));
  const status = result && result.error ? result.error.status || '' : '';
  const errorCode = result && result.error && Array.isArray(result.error.details) ? (result.error.details.find((d) => d.errorCode) || {}).errorCode || '' : '';
  const message = result && result.error ? result.error.message || '' : '';
  // Tokens that can never work with this server's Firebase project are removed too. The app saves a fresh token the next time it opens.
  const dead = status === 'NOT_FOUND' || errorCode === 'UNREGISTERED' || errorCode === 'SENDER_ID_MISMATCH' || /sender ?id mismatch/i.test(message) || (status === 'INVALID_ARGUMENT' && /registration token/i.test(message));
  return { ok: response.ok, error: response.ok ? '' : (errorCode || status || 'ERROR') + (message ? ': ' + message : ''), dead };
}

async function inChunks(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { category, title, message, school_id, data } = body;

    if (!category || !title || !message) return json({ error: 'category, title, and message are required.' }, 400);
    if (!CATEGORIES.includes(category)) return json({ error: 'Invalid category.' }, 400);

    const serviceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountRaw) return json({ error: 'Push notifications are not configured on the server.' }, 500);
    const serviceAccount = JSON.parse(serviceAccountRaw);

    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    let recipientProfileIds = [];

    if (category === 'test') {
      const asCaller = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
      });
      const { data: u } = await asCaller.auth.getUser();
      if (!u || !u.user) return json({ error: 'Not signed in.' }, 401);
      recipientProfileIds = [u.user.id];
    }

    if (category === 'broadcast' || category === 'vacancy') {
      const { data: allMembers } = await supabase.from('school_members').select('profile_id').eq('is_active', true);
      recipientProfileIds = [...new Set((allMembers || []).map((m) => m.profile_id))];
    }

    if (category === 'school_announcement') {
      if (!school_id) return json({ error: 'school_id is required for school_announcement.' }, 400);
      const { data: schoolMembers } = await supabase.from('school_members').select('profile_id').eq('school_id', school_id).eq('is_active', true);
      const ids = new Set((schoolMembers || []).map((m) => m.profile_id));

      if (INCLUDE_PARENTS) {
        const { data: students } = await supabase.from('students').select('id').eq('school_id', school_id);
        await inChunks((students || []).map((s) => s.id), 100, async (chunk) => {
          const { data: links } = await supabase.from('parent_student_links').select('parent_id').in('student_id', chunk);
          (links || []).forEach((l) => ids.add(l.parent_id));
        });
      }
      recipientProfileIds = [...ids];
    }

    if (recipientProfileIds.length === 0) return json({ success: true, sent: 0, failed: 0, skipped: 0, reason: 'No recipients.' });

    // Nigerian date, so the daily limit resets at midnight there.
    const today = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
    const countByProfile = {};
    let eligibleProfileIds = recipientProfileIds;

    if (ENFORCE_DAILY_LIMIT && category !== 'test') {
      await inChunks(recipientProfileIds, 100, async (chunk) => {
        const { data: existingCounts } = await supabase.from('push_notification_counts').select('profile_id, count').eq('category', category).eq('send_date', today).in('profile_id', chunk);
        (existingCounts || []).forEach((row) => {
          countByProfile[row.profile_id] = row.count;
        });
      });
      eligibleProfileIds = recipientProfileIds.filter((id) => (countByProfile[id] || 0) < DAILY_CAP_PER_CATEGORY);
      if (eligibleProfileIds.length === 0) {
        return json({ success: true, sent: 0, failed: 0, skipped: recipientProfileIds.length, reason: 'Everyone is at the daily limit of ' + DAILY_CAP_PER_CATEGORY + ' for this category.' });
      }
    }

    const tokenRows = [];
    await inChunks(eligibleProfileIds, 100, async (chunk) => {
      const { data: rows } = await supabase.from('push_tokens').select('profile_id, token').in('profile_id', chunk);
      (rows || []).forEach((r) => tokenRows.push(r));
    });
    if (tokenRows.length === 0) return json({ success: true, sent: 0, failed: 0, skipped: recipientProfileIds.length, reason: 'No registered devices.' });

    const accessToken = await getAccessToken(serviceAccount);
    let sentCount = 0;
    let failedCount = 0;
    const errors = {};
    const notifiedProfileIds = new Set();
    const deadTokens = [];

    for (const row of tokenRows) {
      const r = await sendFcmMessage(accessToken, serviceAccount.project_id, row.token, title, message, data);
      if (r.ok) {
        sentCount++;
        notifiedProfileIds.add(row.profile_id);
      } else {
        failedCount++;
        errors[r.error] = (errors[r.error] || 0) + 1;
        if (r.dead) deadTokens.push(row.token);
      }
    }

    if (deadTokens.length) await supabase.from('push_tokens').delete().in('token', deadTokens);

    if (ENFORCE_DAILY_LIMIT && category !== 'test') {
      for (const profileId of notifiedProfileIds) {
        await supabase.from('push_notification_counts').upsert(
          { profile_id: profileId, category, send_date: today, count: (countByProfile[profileId] || 0) + 1 },
          { onConflict: 'profile_id,category,send_date' },
        );
      }
    }

    return json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      skipped: recipientProfileIds.length - notifiedProfileIds.size,
      removed_dead_tokens: deadTokens.length,
      errors,
      project_id: serviceAccount.project_id,
    });
  } catch (err) {
    return json({ error: err.message || 'Could not send notification.' }, 500);
  }
});
