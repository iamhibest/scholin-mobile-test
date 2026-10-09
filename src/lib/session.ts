import { supabase } from './supabase';
import { getLastDestination, saveLastDestination } from './storage';

export type Destination = 'SuperAdminHome' | 'Home' | 'ParentHome' | 'Onboarding' | 'PendingApproval';

export async function recordTerms() {
  try {
    await supabase.rpc('record_terms_acceptance');
  } catch {}
}

export async function resolveDestination(userId: string): Promise<Destination> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) {
      throw profileError;
    }
    let dest: Destination = 'Onboarding';
    if (profile && profile.is_super_admin) {
      dest = 'SuperAdminHome';
    } else {
      const { data: memberships } = await supabase
        .from('school_members')
        .select('id')
        .eq('profile_id', userId)
        .eq('is_active', true);
      if (memberships && memberships.length > 0) {
        dest = 'Home';
      } else {
        const { data: links } = await supabase
          .from('parent_student_links')
          .select('student_id')
          .eq('parent_id', userId)
          .limit(1);
        if (links && links.length > 0) {
          dest = 'ParentHome';
        } else {
          // Waiting for approval is no longer a dead end: the person goes to the Onboarding choices
          // (which also list their pending requests) so they can join another school or register their own.
          dest = 'Onboarding';
        }
      }
    }
    await saveLastDestination(dest);
    return dest;
  } catch {
    const last = await getLastDestination();
    return (last as Destination) || 'Home';
  }
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
