import { supabase } from './supabase';

// A normal Supabase update can quietly change nothing when a security rule blocks it.
// This one checks that a row really changed and says so plainly when it did not.
export async function verifiedUpdate(table: string, patch: Record<string, any>, match: Record<string, any>, what: string) {
  let query: any = supabase.from(table).update(patch);
  Object.keys(match).forEach(k => {
    query = query.eq(k, match[k]);
  });
  const { data, error } = await query.select('*');
  if (error) {
    throw new Error(error.message || 'Could not save ' + what + '.');
  }
  if (!data || data.length === 0) {
    throw new Error('The ' + what + ' could not be saved because your account is not allowed to change it. Please contact support.');
  }
  return data[0];
}
