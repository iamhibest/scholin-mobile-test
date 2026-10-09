import { supabase } from './supabase';
import { pickBand } from './bandMatch';
import { addDays, computeDayValue, Mode } from './attendance';

function fail(error: any, fallback: string): never {
  throw new Error((error && error.message) || fallback);
}

export type Component = { id: string; name: string; max_score: number | string; order_index: number };

export async function fetchComponents(termId: string): Promise<Component[]> {
  const { data, error } = await supabase.from('assessment_components').select('*').eq('term_id', termId).order('order_index', { ascending: true });
  if (error) {
    fail(error, 'Could not load assessment components.');
  }
  return (data || []) as Component[];
}

export async function fetchClassSubjectList(classId: string) {
  const { data, error } = await supabase.from('class_subjects').select('subject_id, subjects(id, name)').eq('class_id', classId);
  if (error) {
    fail(error, 'Could not load subjects.');
  }
  return (data || [])
    .map((a: any) => a.subjects)
    .filter(Boolean)
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))) as { id: string; name: string }[];
}

export async function fetchSubjectResults(classId: string, termId: string, subjectId: string) {
  const [results, publish] = await Promise.all([
    supabase.from('results').select('*').eq('class_id', classId).eq('term_id', termId).eq('subject_id', subjectId),
    supabase.from('subject_publish_status').select('*').eq('class_id', classId).eq('term_id', termId).eq('subject_id', subjectId).maybeSingle(),
  ]);
  if (results.error) {
    fail(results.error, 'Could not load results.');
  }
  const map: Record<string, Record<string, number>> = {};
  (results.data || []).forEach((r: any) => {
    if (!map[r.student_id]) {
      map[r.student_id] = {};
    }
    map[r.student_id][r.assessment_component_id] = r.score;
  });
  return { map, published: publish.data ? publish.data.is_published === true : false };
}

export async function saveSubjectResults(args: {
  classId: string;
  termId: string;
  subjectId: string;
  userId: string;
  components: Component[];
  roster: { id: string }[];
  scores: Record<string, Record<string, number>>;
  publish: boolean;
}) {
  const { classId, termId, subjectId, userId, components, roster, scores, publish } = args;
  const rows: any[] = [];
  roster.forEach(s => {
    const mine = scores[s.id] || {};
    components.forEach(c => {
      const v = mine[c.id];
      if (v !== undefined && v !== null && !isNaN(v)) {
        rows.push({ student_id: s.id, class_id: classId, subject_id: subjectId, term_id: termId, assessment_component_id: c.id, score: v, entered_by: userId });
      }
    });
  });

  const removed = await supabase.from('results').delete().eq('class_id', classId).eq('term_id', termId).eq('subject_id', subjectId);
  if (removed.error) {
    fail(removed.error, 'Could not save results.');
  }
  if (rows.length) {
    const { error } = await supabase.from('results').insert(rows);
    if (error) {
      fail(error, 'Could not save results.');
    }
  }

  const stamp = new Date().toISOString();
  const { data: existing } = await supabase
    .from('subject_publish_status')
    .select('id')
    .eq('class_id', classId)
    .eq('term_id', termId)
    .eq('subject_id', subjectId)
    .maybeSingle();
  const payload = { is_published: publish, published_at: publish ? stamp : null, published_by: publish ? userId : null };
  if (existing) {
    await supabase.from('subject_publish_status').update({ ...payload, updated_at: stamp }).eq('id', existing.id);
  } else {
    await supabase.from('subject_publish_status').insert({ class_id: classId, term_id: termId, subject_id: subjectId, ...payload });
  }
}

export async function fetchSchoolSubjects(schoolId: string) {
  const { data, error } = await supabase.from('subjects').select('*').eq('school_id', schoolId).order('name');
  if (error) {
    fail(error, 'Could not load subjects.');
  }
  return data || [];
}

export async function fetchAssignedSubjectIds(classId: string) {
  const { data } = await supabase.from('class_subjects').select('subject_id').eq('class_id', classId);
  return new Set<string>((data || []).map((a: any) => a.subject_id));
}

export async function toggleClassSubject(classId: string, subjectId: string, on: boolean) {
  const res = on
    ? await supabase.from('class_subjects').insert({ class_id: classId, subject_id: subjectId })
    : await supabase.from('class_subjects').delete().eq('class_id', classId).eq('subject_id', subjectId);
  if (res.error) {
    fail(res.error, 'Could not update subjects.');
  }
}

export async function fetchArrangeList(classId: string) {
  const { data, error } = await supabase.from('class_subjects').select('id, subject_id, sort_order, subjects(name)').eq('class_id', classId);
  if (error) {
    fail(error, 'Could not load subjects.');
  }
  return (data || [])
    .map((r: any) => ({ id: r.id as string, name: r.subjects ? (r.subjects.name as string) : 'Subject', sortOrder: (r.sort_order || 0) as number }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function saveArrangement(list: { id: string }[]) {
  const results = await Promise.all(list.map((s, idx) => supabase.from('class_subjects').update({ sort_order: idx }).eq('id', s.id)));
  const bad = results.find(r => r.error);
  if (bad) {
    fail(bad.error, 'Could not save the arrangement right now. Please try again.');
  }
}

export async function removeStudentFromExam(studentId: string, termId: string, classId: string) {
  const { error } = await supabase.from('results').delete().eq('student_id', studentId).eq('term_id', termId).eq('class_id', classId);
  if (error) {
    fail(error, 'Could not remove student from exam.');
  }
}

export async function deleteClass(classId: string) {
  const { error } = await supabase.from('classes').delete().eq('id', classId);
  if (error) {
    fail(error, 'Could not delete class.');
  }
}

const DEFAULT_TRAITS = [
  { category: 'cognitive', name: 'Analytical Skills', order_index: 0 },
  { category: 'cognitive', name: 'Communication', order_index: 1 },
  { category: 'cognitive', name: 'Creativity', order_index: 2 },
  { category: 'cognitive', name: 'Leadership', order_index: 3 },
  { category: 'cognitive', name: 'Team Work', order_index: 4 },
  { category: 'character', name: 'Punctuality', order_index: 0 },
  { category: 'character', name: 'Neatness', order_index: 1 },
  { category: 'character', name: 'Honesty', order_index: 2 },
  { category: 'character', name: 'Respect for Others', order_index: 3 },
  { category: 'character', name: 'General Conduct', order_index: 4 },
];

export async function fetchTraits(schoolId: string) {
  const { data } = await supabase.from('skill_traits').select('*').eq('school_id', schoolId).order('order_index');
  let traits = data || [];
  if (traits.length === 0) {
    const inserted: any[] = [];
    for (const d of DEFAULT_TRAITS) {
      const { data: row } = await supabase.from('skill_traits').insert({ school_id: schoolId, ...d }).select().single();
      if (row) {
        inserted.push(row);
      }
    }
    traits = inserted;
  }
  return { cognitive: traits.filter((t: any) => t.category === 'cognitive'), character: traits.filter((t: any) => t.category === 'character') };
}

export async function fetchCommentData(studentId: string, termId: string) {
  const [ratings, remarks, attendance, term] = await Promise.all([
    supabase.from('student_skill_ratings').select('*').eq('student_id', studentId).eq('term_id', termId),
    supabase.from('report_card_remarks').select('*').eq('student_id', studentId).eq('term_id', termId).maybeSingle(),
    supabase.from('attendance').select('*').eq('student_id', studentId).eq('term_id', termId).maybeSingle(),
    supabase.from('terms').select('*').eq('id', termId).single(),
  ]);
  const ratingMap: Record<string, string> = {};
  (ratings.data || []).forEach((r: any) => {
    ratingMap[r.trait_id] = r.rating;
  });
  return {
    ratingMap,
    remarks: remarks.data,
    daysPresent: attendance.data ? attendance.data.days_present : null,
    daysOpened: term.data ? term.data.days_school_opened || 0 : 0,
  };
}

export async function saveCommentData(args: {
  studentId: string;
  termId: string;
  ratings: Record<string, string>;
  daysOpened: number;
  daysPresent: number;
  classTeacher: string;
  headTeacher: string;
  principal: string;
  promotedTo: string;
}) {
  const { studentId, termId, ratings, daysOpened, daysPresent, classTeacher, headTeacher, principal, promotedTo } = args;
  for (const traitId of Object.keys(ratings)) {
    const rating = ratings[traitId];
    const { data: existing } = await supabase.from('student_skill_ratings').select('id').eq('student_id', studentId).eq('term_id', termId).eq('trait_id', traitId).maybeSingle();
    const res = existing
      ? await supabase.from('student_skill_ratings').update({ rating }).eq('id', existing.id)
      : await supabase.from('student_skill_ratings').insert({ student_id: studentId, term_id: termId, trait_id: traitId, rating });
    if (res.error) {
      fail(res.error, 'Could not save ratings.');
    }
  }

  const opened = await supabase.from('terms').update({ days_school_opened: daysOpened }).eq('id', termId);
  if (opened.error) {
    fail(opened.error, 'Could not save days school opened.');
  }

  const { data: att } = await supabase.from('attendance').select('id').eq('student_id', studentId).eq('term_id', termId).maybeSingle();
  const attRes = att
    ? await supabase.from('attendance').update({ days_present: daysPresent }).eq('id', att.id)
    : await supabase.from('attendance').insert({ student_id: studentId, term_id: termId, days_present: daysPresent });
  if (attRes.error) {
    fail(attRes.error, 'Could not save attendance.');
  }

  const remarkPayload = {
    class_teacher_remark: classTeacher.trim(),
    head_teacher_remark: headTeacher.trim(),
    principal_remark: principal.trim(),
    promoted_to: promotedTo.trim() || null,
  };
  const { data: rem } = await supabase.from('report_card_remarks').select('id').eq('student_id', studentId).eq('term_id', termId).maybeSingle();
  const remRes = rem
    ? await supabase.from('report_card_remarks').update(remarkPayload).eq('id', rem.id)
    : await supabase.from('report_card_remarks').insert({ student_id: studentId, term_id: termId, ...remarkPayload });
  if (remRes.error) {
    fail(remRes.error, 'Could not save remarks.');
  }
}

export async function suggestComment(schoolId: string, classId: string, termId: string, studentId: string): Promise<{ message: string; band?: any }> {
  const { data: published } = await supabase.from('subject_publish_status').select('subject_id').eq('class_id', classId).eq('term_id', termId).eq('is_published', true);
  if (!published || published.length === 0) {
    return { message: 'No published subjects yet. Nothing to calculate from.' };
  }
  const subjectIds = published.map((p: any) => p.subject_id);
  const [results, components] = await Promise.all([
    supabase.from('results').select('subject_id, score').eq('student_id', studentId).eq('term_id', termId).in('subject_id', subjectIds),
    supabase.from('assessment_components').select('*').eq('term_id', termId),
  ]);
  const maxPer = (components.data || []).reduce((sum: number, c: any) => sum + parseFloat(c.max_score), 0) || 100;
  const bySubject: Record<string, number> = {};
  (results.data || []).forEach((r: any) => {
    bySubject[r.subject_id] = (bySubject[r.subject_id] || 0) + parseFloat(r.score);
  });
  const totals = Object.values(bySubject);
  if (totals.length === 0) {
    return { message: 'No scores recorded yet for published subjects.' };
  }
  const avg = (totals.reduce((a, b) => a + b, 0) / totals.length / maxPer) * 100;
  const { data: allBands } = await supabase.from('auto_comment_bands').select('*').eq('school_id', schoolId);
  const picked = pickBand(allBands as any[], avg);
  const bands = picked ? [picked] : [];
  if (bands.length === 0) {
    return { message: 'Average ' + avg.toFixed(1) + '%. No matching comment band is set up. Configure one in Auto Comments.' };
  }
  return { message: 'Applied based on a ' + avg.toFixed(1) + '% average. You can still edit any text.', band: bands[0] };
}

export async function fetchAllClassNames(schoolId: string) {
  const { data } = await supabase.from('classes').select('name, arm').eq('school_id', schoolId).order('created_at', { ascending: true });
  return (data || []).map((c: any) => c.name + (c.arm ? ' ' + c.arm : ''));
}

export async function fetchPublishState(classId: string, termId: string) {
  const { data, error } = await supabase.from('class_term_report_publish').select('is_published_to_parents, published_at').eq('class_id', classId).eq('term_id', termId).maybeSingle();
  if (error) {
    fail(error, 'Could not load the current publish status.');
  }
  return { published: !!(data && data.is_published_to_parents), at: data ? (data.published_at as string | null) : null };
}

export async function setPublishState(args: { classId: string; termId: string; publish: boolean; userId: string; schoolId: string; className: string; termName: string; sessionName: string }) {
  const { classId, termId, publish, userId, schoolId, className, termName, sessionName } = args;
  const payload: any = { class_id: classId, term_id: termId, is_published_to_parents: publish };
  if (publish) {
    payload.published_at = new Date().toISOString();
    payload.published_by = userId;
  }
  const { error } = await supabase.from('class_term_report_publish').upsert(payload, { onConflict: 'class_id,term_id' });
  if (error) {
    fail(error, publish ? 'Could not publish right now. Please try again.' : 'Could not unpublish right now. Please try again.');
  }
  if (publish) {
    try {
      await supabase.from('activity_log').insert({
        school_id: schoolId,
        activity_type: 'report_card_published',
        title: 'Report cards published for ' + className,
        detail: termName + ', ' + sessionName,
        related_term_id: termId,
        created_by: userId,
      });
    } catch {}
  }
}

export async function fetchFeeGate(schoolId: string, classId: string, termId: string) {
  const { data: school } = await supabase.from('schools').select('fee_gated_report_release').eq('id', schoolId).single();
  if (!school || !school.fee_gated_report_release) {
    return null;
  }
  const { data: rows } = await supabase.from('student_class_history').select('student_id, students(id, full_name)').eq('class_id', classId);
  const roster = (rows || [])
    .filter((r: any) => r.students)
    .map((r: any) => r.students)
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
  return Promise.all(
    roster.map(async (s: any) => {
      const { data, error } = await supabase.rpc('get_report_release_status', { p_student_id: s.id, p_term_id: termId });
      return { student: s, status: error || !data ? { unlocked: true, outstanding: [] } : data };
    }),
  );
}

export async function releaseManually(studentId: string, termId: string, userId: string) {
  const { error } = await supabase.from('student_report_manual_release').upsert({ student_id: studentId, term_id: termId, released_by: userId }, { onConflict: 'student_id,term_id' });
  if (error) {
    fail(error, 'Could not release right now.');
  }
}

export async function fetchSummary(classId: string, termId: string, sessionId: string, schoolId: string, mode: Mode) {
  const [setting, history, weeks, marks] = await Promise.all([
    supabase.from('class_attendance_settings').select('*').eq('class_id', classId).eq('term_id', termId).maybeSingle(),
    supabase.from('student_class_history').select('student_id, students(id, full_name, admission_no)').eq('class_id', classId).eq('session_id', sessionId),
    supabase.from('weekly_attendance_config').select('*').eq('class_id', classId).eq('term_id', termId).order('week_start_date', { ascending: true }),
    supabase.from('daily_attendance_marks').select('student_id, mark_date, session, status').eq('class_id', classId).eq('term_id', termId),
  ]);
  const roster = (history.data || [])
    .map((h: any) => h.students)
    .filter(Boolean)
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
  const byStudentDate: Record<string, Record<string, Record<string, string>>> = {};
  (marks.data || []).forEach((m: any) => {
    byStudentDate[m.student_id] = byStudentDate[m.student_id] || {};
    byStudentDate[m.student_id][m.mark_date] = byStudentDate[m.student_id][m.mark_date] || {};
    byStudentDate[m.student_id][m.mark_date][m.session] = m.status;
  });
  const weekData = (weeks.data || []).map((w: any) => {
    const perStudent: Record<string, number> = {};
    roster.forEach((s: any) => {
      let total = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(w.week_start_date, i);
        const val = computeDayValue((byStudentDate[s.id] && byStudentDate[s.id][d]) || {}, mode);
        if (val !== null) {
          total += val;
        }
      }
      perStudent[s.id] = total;
    });
    return { weekStart: w.week_start_date as string, daysOpen: w.days_open as number, perStudent };
  });
  return { calculated: !!(setting.data && setting.data.use_calculated_attendance), roster, weekData };
}

export async function setCalculatedAttendance(classId: string, termId: string, value: boolean) {
  const { error } = await supabase.from('class_attendance_settings').upsert({ class_id: classId, term_id: termId, use_calculated_attendance: value, updated_at: new Date().toISOString() }, { onConflict: 'class_id,term_id' });
  if (error) {
    fail(error, 'Could not save this setting.');
  }
}
