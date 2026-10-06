import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Super admin only. Blocks, unblocks or permanently deletes a user account.
// Uses the service role key, which only exists on the server (set automatically by Supabase).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('Authorization') || '';
    const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await asCaller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Not authenticated.' }, 401);
    const callerId = userData.user.id;

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: caller } = await admin.from('profiles').select('is_super_admin').eq('id', callerId).maybeSingle();
    if (!caller || !caller.is_super_admin) return json({ error: 'Only a super admin can do this.' }, 403);

    const { action, user_id, reason } = await req.json();
    if (!['block', 'unblock', 'delete'].includes(action) || typeof user_id !== 'string') return json({ error: 'Bad request.' }, 400);
    if (user_id === callerId) return json({ error: 'You cannot do this to your own account.' }, 400);

    const { data: target } = await admin.from('profiles').select('id, full_name, is_super_admin').eq('id', user_id).maybeSingle();
    if (!target) return json({ error: 'User not found.' }, 404);
    if (target.is_super_admin) return json({ error: 'You cannot change another super admin.' }, 400);

    if (action === 'block' || action === 'unblock') {
      const blocking = action === 'block';
      const { error: banErr } = await admin.auth.admin.updateUserById(user_id, { ban_duration: blocking ? '876000h' : 'none' });
      if (banErr) return json({ error: banErr.message }, 500);
      await admin
        .from('profiles')
        .update({ is_blocked: blocking, blocked_at: blocking ? new Date().toISOString() : null, blocked_reason: blocking ? (reason || null) : null })
        .eq('id', user_id);
      return json({ ok: true });
    }

    // delete: refuse for school owners, so a school is never left without an owner
    const { data: owned } = await admin.from('school_members').select('schools(name)').eq('profile_id', user_id).eq('role', 'owner');
    if (owned && owned.length > 0) {
      const names = owned.map((o: any) => (o.schools ? o.schools.name : 'a school')).join(', ');
      return json({ error: 'This user owns ' + names + '. Delete that school first, then delete the user. You can block them in the meantime.' }, 400);
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
    if (delErr) {
      const msg = /foreign key|violates|constraint|database/i.test(delErr.message)
        ? 'This user has records that must be kept, such as payment history, so they cannot be deleted. Block them instead.'
        : delErr.message;
      return json({ error: msg }, 400);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message || 'Something went wrong.' }, 500);
  }
});
