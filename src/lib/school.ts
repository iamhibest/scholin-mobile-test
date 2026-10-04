import { supabase } from './supabase';
import { verifiedUpdate } from './verifiedUpdate';
import { getActiveSchoolContext } from './dashboard';

export type StaffRole = 'owner' | 'teacher_admin' | 'teacher';

export type StaffContext = {
  userId: string;
  schoolId: string;
  school: any;
  membership: any;
  role: StaffRole;
  isAdmin: boolean;
  autoAdmission: boolean;
};

export type Student = {
  id: string;
  school_id: string;
  full_name: string;
  admission_no: string | null;
  gender: string | null;
  dob: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  photo_url: string | null;
};

export type StudentForm = {
  full_name: string;
  admission_no: string;
  gender: string;
  dob: string;
  parent_name: string;
  parent_phone: string;
  photo_url: string;
};

export type SchoolClass = { id: string; name: string; arm: string | null; class_teacher_id?: string | null; class_teacher?: { full_name: string } | null };

function fail(error: any, fallback: string): never {
  throw new Error((error && error.message) || fallback);
}

export function classLabel(c: { name: string; arm?: string | null }) {
  return c.name + (c.arm ? ' ' + c.arm : '');
}

export async function loadStaffContext(): Promise<StaffContext | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) {
    return null;
  }
  const context = await getActiveSchoolContext(userId);
  if (!context) {
    return null;
  }
  const membership = context.membership;
  const role = membership.role as StaffRole;
  return {
    userId,
    schoolId: membership.schools.id,
    school: membership.schools,
    membership,
    role,
    isAdmin: role === 'owner' || role === 'teacher_admin',
    autoAdmission: membership.schools.auto_admission_enabled === true,
  };
}

export async function fetchSessions(schoolId: string) {
  const { data, error } = await supabase.from('sessions').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
  if (error) {
    fail(error, 'Could not load sessions.');
  }
  return data || [];
}

export async function fetchTerms(sessionId: string) {
  const { data, error } = await supabase.from('terms').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
  if (error) {
    fail(error, 'Could not load terms.');
  }
  return data || [];
}

export async function fetchClasses(sessionId: string): Promise<SchoolClass[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('*, class_teacher:profiles(full_name)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) {
    fail(error, 'Could not load classes.');
  }
  return (data || []) as SchoolClass[];
}

export async function fetchClass(classId: string): Promise<SchoolClass> {
  const { data, error } = await supabase.from('classes').select('*, class_teacher:profiles(full_name)').eq('id', classId).single();
  if (error) {
    fail(error, 'Could not load this class.');
  }
  return data as SchoolClass;
}

export async function createClass(schoolId: string, sessionId: string, name: string, arm: string) {
  const { error } = await supabase.from('classes').insert({ school_id: schoolId, session_id: sessionId, name, arm: arm || null });
  if (error) {
    fail(error, 'Could not add class.');
  }
}

export async function updateClass(classId: string, name: string, arm: string) {
  const { error } = await supabase.from('classes').update({ name, arm: arm || null }).eq('id', classId);
  if (error) {
    fail(error, 'Could not save changes.');
  }
}

export async function fetchSchoolTeachers(schoolId: string) {
  const { data, error } = await supabase.from('school_members').select('profile_id, profiles(full_name)').eq('school_id', schoolId).eq('is_active', true);
  if (error) {
    fail(error, 'Could not load teachers.');
  }
  return (data || []).map((t: any) => ({ id: t.profile_id as string, name: (t.profiles && t.profiles.full_name) || 'Unknown' }));
}

export async function setClassTeacher(classId: string, teacherId: string) {
  const { error } = await supabase.from('classes').update({ class_teacher_id: teacherId }).eq('id', classId);
  if (error) {
    fail(error, 'Could not update class teacher.');
  }
}

export async function fetchClassRoster(classId: string, sessionId: string) {
  const { data, error } = await supabase
    .from('student_class_history')
    .select('student_id, students(id, full_name, admission_no, gender, photo_url)')
    .eq('class_id', classId)
    .eq('session_id', sessionId);
  if (error) {
    fail(error, 'Could not load students.');
  }
  return (data || [])
    .map((h: any) => h.students)
    .filter(Boolean)
    .sort((a: any, b: any) => String(a.full_name).localeCompare(String(b.full_name)));
}

export async function fetchStudentRoster(schoolId: string, sessionId: string) {
  const [history, students] = await Promise.all([
    supabase.from('student_class_history').select('student_id, class_id').eq('session_id', sessionId),
    supabase.from('students').select('*').eq('school_id', schoolId).order('full_name', { ascending: true }),
  ]);
  if (students.error) {
    fail(students.error, 'Could not load students.');
  }
  const assign: Record<string, string> = {};
  (history.data || []).forEach((h: any) => {
    assign[h.student_id] = h.class_id;
  });
  const list = (students.data || []) as Student[];
  const ids = list.map(s => s.id);
  const linked = new Set<string>();
  if (ids.length > 0) {
    const { data: links } = await supabase.from('parent_student_links').select('student_id').in('student_id', ids);
    (links || []).forEach((l: any) => linked.add(l.student_id));
  }
  return { students: list, assign, linked };
}

export async function fetchStudent(studentId: string) {
  const { data, error } = await supabase.from('students').select('*').eq('id', studentId).single();
  if (error) {
    fail(error, 'Could not load this student.');
  }
  return data as Student;
}

export async function fetchStudentClass(studentId: string, sessionId: string) {
  const { data } = await supabase.from('student_class_history').select('class_id').eq('student_id', studentId).eq('session_id', sessionId).maybeSingle();
  return data ? (data.class_id as string) : '';
}

export async function assignClass(studentId: string, sessionId: string, classId: string) {
  const removed = await supabase.from('student_class_history').delete().eq('student_id', studentId).eq('session_id', sessionId);
  if (removed.error) {
    fail(removed.error, 'Could not change class.');
  }
  if (classId) {
    const { error } = await supabase.from('student_class_history').insert({ student_id: studentId, class_id: classId, session_id: sessionId });
    if (error) {
      fail(error, 'Could not change class.');
    }
  }
}

function studentPayload(form: StudentForm) {
  return {
    full_name: form.full_name.trim(),
    admission_no: form.admission_no.trim() || null,
    gender: form.gender || null,
    dob: form.dob || null,
    parent_name: form.parent_name.trim() || null,
    parent_phone: form.parent_phone.trim() || null,
    photo_url: form.photo_url || null,
  };
}

export async function createStudent(ctx: StaffContext, form: StudentForm, sessionId: string, classId: string) {
  const payload = studentPayload(form);
  if (ctx.autoAdmission) {
    if (!sessionId) {
      throw new Error('Please select a session before adding a student, so an admission number can be generated.');
    }
    const { data: generated, error: genError } = await supabase.rpc('generate_admission_number', { p_school_id: ctx.schoolId, p_session_id: sessionId });
    if (genError) {
      fail(genError, 'Could not generate an admission number.');
    }
    payload.admission_no = generated;
  }
  const { data: student, error } = await supabase.from('students').insert({ school_id: ctx.schoolId, ...payload }).select().single();
  if (error) {
    fail(error, 'Could not add student.');
  }
  if (classId && sessionId) {
    await supabase.from('student_class_history').insert({ student_id: student.id, class_id: classId, session_id: sessionId });
  }
  return student as Student;
}

export async function updateStudent(studentId: string, form: StudentForm) {
  await verifiedUpdate('students', studentPayload(form), { id: studentId }, 'student');
}

export async function removeStudent(studentId: string) {
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) {
    fail(error, 'Could not remove student.');
  }
}

export async function fetchInviteCode(studentId: string) {
  const { data, error } = await supabase.from('student_invite_codes').select('code, uses_remaining').eq('student_id', studentId).eq('is_active', true).maybeSingle();
  if (error) {
    fail(error, 'Could not load invite code.');
  }
  return data ? { code: data.code as string, uses: data.uses_remaining as number } : null;
}

function newInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function regenerateInviteCode(studentId: string) {
  await supabase.from('student_invite_codes').update({ is_active: false }).eq('student_id', studentId).eq('is_active', true);
  const { error } = await supabase.from('student_invite_codes').insert({ student_id: studentId, code: newInviteCode(), uses_remaining: 4, is_active: true });
  if (error) {
    fail(error, 'Could not generate a new code.');
  }
}

export async function fetchMembers(schoolId: string, active: boolean) {
  const { data, error } = await supabase
    .from('school_members')
    .select('*, profiles(full_name, email, phone, avatar_url)')
    .eq('school_id', schoolId)
    .eq('is_active', active)
    .order('created_at', { ascending: true });
  if (error) {
    fail(error, 'Could not load teachers.');
  }
  return data || [];
}

export async function setMemberPermission(memberId: string, field: string, value: boolean) {
  const { error } = await supabase.from('school_members').update({ [field]: value }).eq('id', memberId);
  if (error) {
    fail(error, 'Could not update permission.');
  }
}

export async function setMemberRole(memberId: string, role: StaffRole) {
  const { error } = await supabase.from('school_members').update({ role }).eq('id', memberId);
  if (error) {
    fail(error, 'Could not change role.');
  }
}

export async function removeMember(memberId: string) {
  const { error } = await supabase.from('school_members').delete().eq('id', memberId);
  if (error) {
    fail(error, 'Could not remove this person.');
  }
}

export async function approveRequest(memberId: string) {
  const { error } = await supabase.rpc('accept_teacher_join_request', { p_membership_id: memberId });
  if (error) {
    fail(error, 'Could not approve this request.');
  }
}

export async function saveTeacherProfile(profileId: string, name: string, phone: string, avatarUrl: string | null) {
  await verifiedUpdate('profiles', { full_name: name, phone: phone || null, avatar_url: avatarUrl }, { id: profileId }, 'teacher profile');
}
