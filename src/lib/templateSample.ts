import { supabase } from './supabase';
import { gatherReportCardData } from '../reportcard/data';
import { resolveTheme } from '../reportcard/themes';
import { renderReportCardTemplate } from '../reportcard/templates';

function placeholder(school: any) {
  return {
    error: null,
    student: { full_name: 'Sample Student', admission_no: 'SCH/001', gender: 'Female', dob: '2015-05-14', photo_url: null },
    classRow: { name: 'Year 3', arm: '' },
    termRow: { next_term_resumes: null },
    school,
    sessionName: '2025/2026',
    termName: 'First Term',
    components: [
      { id: 'c1', name: '1st CA', max_score: 20 },
      { id: 'c2', name: '2nd CA', max_score: 20 },
      { id: 'c3', name: 'Exam', max_score: 60 },
    ],
    maxPerSubject: 100,
    subjectRows: [
      { name: 'Mathematics', subjectId: 's1', total: 88, grade: 'A', remark: 'Excellent' },
      { name: 'English Language', subjectId: 's2', total: 74, grade: 'B', remark: 'Very Good' },
      { name: 'Basic Science', subjectId: 's3', total: 65, grade: 'C', remark: 'Good' },
    ],
    scoresByComponent: { s1: { c1: 18, c2: 17, c3: 53 }, s2: { c1: 15, c2: 16, c3: 43 }, s3: { c1: 13, c2: 12, c3: 40 } },
    overallTotal: 227,
    overallPercent: 75.6,
    overallGrade: { grade: 'B' },
    overallRank: 3,
    cognitiveTraits: [
      { id: 't1', name: 'Attentiveness' },
      { id: 't2', name: 'Neatness' },
    ],
    characterTraits: [
      { id: 't3', name: 'Punctuality' },
      { id: 't4', name: 'Honesty' },
    ],
    ratingMap: { t1: 'Good', t2: 'Excellent', t3: 'Good', t4: 'Excellent' },
    daysOpened: 60,
    daysPresent: 57,
    daysAbsent: 3,
    attendancePercent: 95,
    remarksRow: { class_teacher_text: 'A hardworking and diligent student. Keep it up!', principal_text: 'Impressive performance this term.' },
  };
}

let cache: { schoolId: string; data: any } | null = null;

export async function getSampleData(school: any) {
  if (cache && cache.schoolId === school.id) {
    return cache.data;
  }
  let data: any = null;
  try {
    const { data: any1 } = await supabase.from('results').select('student_id, class_id, term_id').limit(1).maybeSingle();
    if (any1) {
      const { data: term } = await supabase.from('terms').select('*, sessions(name)').eq('id', any1.term_id).single();
      data = await gatherReportCardData({
        studentId: any1.student_id,
        classId: any1.class_id,
        termId: any1.term_id,
        sessionId: term.session_id,
        sessionName: term.sessions ? term.sessions.name : '2025/2026',
        termName: term.name,
        schoolId: school.id,
        school,
      });
      if (data.error) {
        data = null;
      }
    }
  } catch {
    data = null;
  }
  if (!data) {
    data = placeholder(school);
  }
  cache = { schoolId: school.id, data };
  return data;
}

export function templateHtml(templateKey: string, data: any, themeRow: any) {
  const theme = resolveTheme(themeRow || {});
  const { css, html } = renderReportCardTemplate(templateKey, data, theme);
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=840, initial-scale=1">' +
    '<style>html,body{margin:0;padding:0;background:#E5E7EB;} body{padding:12px 20px;} ' +
    css +
    '</style></head><body>' +
    html +
    '</body></html>'
  );
}
