// @ts-nocheck
import { supabase } from '../lib/supabase';
import { computeDayValue } from '../lib/attendance';
/* =========================================================
   Report Card — data gathering (shared, logic unchanged)
   =========================================================
   This is the SINGLE SOURCE OF TRUTH for every number, label, and
   piece of wording that appears on a report card — grading, position,
   attendance, cognitive/character skills, remarks, everything.

   It was extracted directly out of class-report-cards.html's
   renderReportCard() function with NO changes to any calculation,
   query, or wording — only split apart from the HTML-building code so
   multiple visual templates can share the exact same data and never
   disagree with each other or drift out of sync.

   Include after js-supabase-client.js and js-attendance-helpers.js:
   <script src="js-attendance-helpers.js"></script>
   <script src="js-report-card-data.js"></script>

   Usage:
     const data = await gatherReportCardData({
       studentId, classId, termId, sessionId, sessionName, termName, schoolId, school
     });
     if (data.error) { ...show empty state... }
     else { ...pass `data` into any template renderer... }
   ========================================================= */

export async function gatherReportCardData({ studentId, classId, termId, sessionId, sessionName, termName, schoolId, school }) {
  const [
    { data: student },
    { data: classRow },
    { data: termRow },
    { data: components },
    { data: publishedSubjects },
    { data: classSubjectOrder },
    { data: gradingScale },
    { data: ratings },
    { data: skillTraits },
    { data: attendanceRow },
    { data: remarksRow },
    { data: attendanceSetting },
    { data: schoolRow }
  ] = await Promise.all([
    supabase.from('students').select('*').eq('id', studentId).single(),
    supabase.from('classes').select('*').eq('id', classId).single(),
    supabase.from('terms').select('*').eq('id', termId).single(),
    supabase.from('assessment_components').select('*').eq('term_id', termId).order('order_index'),
    supabase.from('subject_publish_status').select('subject_id, subjects(name)').eq('class_id', classId).eq('term_id', termId).eq('is_published', true),
    supabase.from('class_subjects').select('subject_id, sort_order').eq('class_id', classId),
    supabase.from('grading_scale').select('*').eq('school_id', schoolId),
    supabase.from('student_skill_ratings').select('*').eq('student_id', studentId).eq('term_id', termId),
    supabase.from('skill_traits').select('*').eq('school_id', schoolId).order('order_index'),
    supabase.from('attendance').select('*').eq('student_id', studentId).eq('term_id', termId).maybeSingle(),
    supabase.from('report_card_remarks').select('*').eq('student_id', studentId).eq('term_id', termId).maybeSingle(),
    supabase.from('class_attendance_settings').select('*').eq('class_id', classId).eq('term_id', termId).maybeSingle(),
    supabase.from('schools').select('attendance_mode').eq('id', schoolId).single()
  ]);

  if (!publishedSubjects || publishedSubjects.length === 0) {
    return { error: 'no_published_subjects' };
  }

  const subjectIds = publishedSubjects.map(p => p.subject_id);
  const maxPerSubject = (components || []).reduce((sum, c) => sum + parseFloat(c.max_score), 0) || 100;

  const { data: allResults } = await supabase
    .from('results')
    .select('student_id, subject_id, score')
    .eq('class_id', classId).eq('term_id', termId)
    .in('subject_id', subjectIds);

  const { data: classHistory } = await supabase
    .from('student_class_history')
    .select('student_id')
    .eq('class_id', classId).eq('session_id', sessionId);

  const studentTotals = {};
  (classHistory || []).forEach(h => { studentTotals[h.student_id] = 0; });
  (allResults || []).forEach(r => {
    studentTotals[r.student_id] = (studentTotals[r.student_id] || 0) + parseFloat(r.score);
  });

  const rankArray = Object.entries(studentTotals).sort((a, b) => b[1] - a[1]);
  const overallRank = rankArray.findIndex(([sid]) => sid === studentId) + 1;
  const classSize = (classHistory || []).length;

  const bySubject = {};
  subjectIds.forEach(sid => { bySubject[sid] = {}; });
  (allResults || []).filter(r => r.student_id === studentId).forEach(r => {
    bySubject[r.subject_id] = bySubject[r.subject_id] || {};
    bySubject[r.subject_id].total = (bySubject[r.subject_id].total || 0) + parseFloat(r.score);
  });

  const { data: myComponentScores } = await supabase
    .from('results')
    .select('*')
    .eq('student_id', studentId).eq('class_id', classId).eq('term_id', termId)
    .in('subject_id', subjectIds);

  const scoresByComponent = {};
  (myComponentScores || []).forEach(r => {
    if (!scoresByComponent[r.subject_id]) scoresByComponent[r.subject_id] = {};
    scoresByComponent[r.subject_id][r.assessment_component_id] = r.score;
  });

  function getGrade(total) {
    const percent = (total / maxPerSubject) * 100;
    // Inclusive on both ends: a 40-49 band must match exactly 49%,
    // and a 70-100 band must match exactly 100%.
    const match = (gradingScale || []).find(g => percent >= g.min_score && percent <= g.max_score);
    return match ? { grade: match.grade, remark: match.remark } : { grade: '-', remark: '' };
  }

  let overallTotal = 0;
  const subjectOrderMap = {};
  (classSubjectOrder || []).forEach(cs => { subjectOrderMap[cs.subject_id] = cs.sort_order || 0; });

  const subjectsWithEntries = publishedSubjects.filter(ps => scoresByComponent[ps.subject_id] && Object.keys(scoresByComponent[ps.subject_id]).length > 0);
  const subjectRows = subjectsWithEntries.map(ps => {
    const total = (bySubject[ps.subject_id] && bySubject[ps.subject_id].total) || 0;
    overallTotal += total;
    const g = getGrade(total);
    return { name: ps.subjects.name, subjectId: ps.subject_id, total, grade: g.grade, remark: g.remark };
  });

  // Stable sort by the class's saved subject arrangement (Arrange
  // Subjects, under School Portal → Session → Term → Class). Subjects
  // with no saved order (or the same order — e.g. before anyone has
  // arranged this class yet) keep their original relative order, so
  // report cards look unchanged until a school actually sets one up.
  subjectRows.sort((a, b) => (subjectOrderMap[a.subjectId] || 0) - (subjectOrderMap[b.subjectId] || 0));

  const overallPercent = subjectRows.length > 0 ? (overallTotal / (maxPerSubject * subjectRows.length)) * 100 : 0;
  const overallGrade = getGrade(overallTotal / subjectRows.length || 0);

  const cognitiveTraits = (skillTraits || []).filter(t => t.category === 'cognitive');
  const characterTraits = (skillTraits || []).filter(t => t.category === 'character');
  const ratingMap = {};
  (ratings || []).forEach(r => { ratingMap[r.trait_id] = r.rating; });

  const daysOpened = termRow ? (termRow.days_school_opened || 0) : 0;
  let daysPresent = attendanceRow ? (attendanceRow.days_present || 0) : 0;

  if (attendanceSetting && attendanceSetting.use_calculated_attendance) {
    const { data: marks } = await supabase
      .from('daily_attendance_marks')
      .select('mark_date, session, status')
      .eq('student_id', studentId).eq('term_id', termId);

    const byDate = {};
    (marks || []).forEach(m => {
      byDate[m.mark_date] = byDate[m.mark_date] || {};
      byDate[m.mark_date][m.session] = m.status;
    });

    const mode = (schoolRow && schoolRow.attendance_mode) || 'combined';
    const totalPoints = Object.values(byDate).reduce((sum, dayMarks) => {
      const val = computeDayValue(dayMarks, mode);
      return sum + (val !== null ? val : 0);
    }, 0);
    daysPresent = totalPoints / 2; // convert points (full day = 2) back to day-equivalents
  }

  const daysAbsent = Math.max(0, daysOpened - daysPresent);
  const attendancePercent = daysOpened > 0 ? ((daysPresent / daysOpened) * 100).toFixed(0) : 0;

  return {
    error: null,
    student, classRow, termRow, school,
    sessionName, termName,
    components: components || [],
    maxPerSubject,
    subjectRows,
    scoresByComponent,
    overallTotal,
    overallPercent,
    overallGrade,
    overallRank,
    classSize,
    cognitiveTraits, characterTraits, ratingMap,
    daysOpened,
    daysPresent: Math.round(daysPresent * 10) / 10,
    daysAbsent: Math.round(daysAbsent * 10) / 10,
    attendancePercent,
    remarksRow,
    // Section visibility — these come from the school's own settings
    // and must be respected by every template exactly as the original
    // renderReportCard() did (default to shown unless explicitly false).
    showPositionInClass: school.show_position_class !== false,
    showAttendance: school.show_attendance !== false,
    showCognitiveSkills: school.show_cognitive_skills !== false,
    showCharacterConduct: school.show_character_conduct !== false,
    showStamp: school.show_stamp !== false && !!school.stamp_url,
    showDob: school.show_dob_rc !== false,
    showStudentPhoto: school.show_student_photo_rc !== false,
    showClassSize: school.show_class_size_rc !== false,
    promotedTo: (remarksRow && remarksRow.promoted_to) || null
  };
}

