import { supabase } from './supabase';

export type SchoolRow = { id: string; name: string; address?: string; phone?: string; created_at: string };

export async function loadSuperAdmin() {
  const [schools, teachers, students] = await Promise.all([
    supabase.from('schools').select('id, name, address, phone, created_at').order('created_at', { ascending: false }),
    supabase.from('school_members').select('id', { count: 'exact', head: true }),
    supabase.from('students').select('id', { count: 'exact', head: true }),
  ]);
  return {
    schools: (schools.data || []) as SchoolRow[],
    failed: !!schools.error,
    teachers: teachers.count || 0,
    students: students.count || 0,
  };
}
