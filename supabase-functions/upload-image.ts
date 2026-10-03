import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Server side image upload. The app sends the picture here; this function
// signs and sends it to Cloudinary using secrets that only exist on the server.
// Required secrets (Supabase Dashboard > Edge Functions > Secrets):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function sha1Hex(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const MAX_BASE64_CHARS = 11 * 1024 * 1024; // about 8 MB of image data
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      return json({ error: 'Image upload is not set up yet.' }, 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await asCaller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Not authenticated.' }, 401);
    const userId = userData.user.id;

    const { school_id, image_base64, content_type } = await req.json();
    if (typeof image_base64 !== 'string' || image_base64.length === 0) return json({ error: 'No image received.' }, 400);
    if (image_base64.length > MAX_BASE64_CHARS) return json({ error: 'Image is too large (max 8MB).' }, 400);
    const type = ALLOWED_TYPES.includes(content_type) ? content_type : 'image/jpeg';

    const admin = createClient(supabaseUrl, serviceRoleKey);
    if (school_id) {
      const { data: membership } = await admin
        .from('school_members')
        .select('id')
        .eq('profile_id', userId)
        .eq('school_id', school_id)
        .eq('is_active', true)
        .maybeSingle();
      const { data: profile } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
      if (!membership && !(profile && profile.is_super_admin)) {
        return json({ error: 'You do not have access to this school.' }, 403);
      }
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = school_id ? 'schools/' + school_id : 'users/' + userId;
    const toSign = 'folder=' + folder + '&timestamp=' + timestamp + apiSecret;
    const signature = await sha1Hex(toSign);

    const form = new FormData();
    form.append('file', 'data:' + type + ';base64,' + image_base64);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', folder);
    form.append('signature', signature);

    const upstream = await fetch('https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload', { method: 'POST', body: form });
    const result = await upstream.json();
    if (!upstream.ok || !result.secure_url) {
      return json({ error: 'The image could not be uploaded. Please try again.' }, 502);
    }

    await admin.from('cloudinary_assets').insert({
      school_id: school_id || null,
      public_id: result.public_id,
      url: result.secure_url,
      uploaded_by: userId,
    });

    return json({ url: result.secure_url, public_id: result.public_id });
  } catch (_err) {
    return json({ error: 'The image could not be uploaded. Please try again.' }, 500);
  }
});
