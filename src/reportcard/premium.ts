// @ts-nocheck
import { escapeHtmlRC } from './helpers';

/* Three premium report card designs: Emerald (royal), Heritage (prestige), Navy Gold (modern).
   Same (data, theme) contract as the other renderers; builders are repeated here so this file stands alone. */

function fitName(name, base) {
  const n = String(name || '').length;
  if (n <= 20) return base;
  if (n <= 26) return +(base * 0.84).toFixed(2);
  if (n <= 34) return +(base * 0.7).toFixed(2);
  return +(base * 0.6).toFixed(2);
}

const SERIF = "'Playfair Display','Noto Serif','Droid Serif',Georgia,serif";
const SANS = "'Inter','Roboto','Noto Sans',Arial,sans-serif";

function rows(data) {
  const grade = g => (g === 'A' || g === 'B' ? 'grade-good' : g === '-' ? '' : 'grade-poor');
  return data.subjectRows
    .map(s => {
      const cells = data.components
        .map(c => {
          const v = (data.scoresByComponent[s.subjectId] || {})[c.id];
          return '<td>' + (v !== undefined ? v : '-') + '</td>';
        })
        .join('');
      return '<tr><td class="rc2-subject-name">' + escapeHtmlRC(s.name) + '</td>' + cells + '<td class="rc2-total-col">' + s.total + '</td><td class="' + grade(s.grade) + '">' + escapeHtmlRC(s.grade) + '</td><td>' + escapeHtmlRC(s.remark) + '</td></tr>';
    })
    .join('');
}

function heads(data) {
  return data.components.map(c => '<th>' + escapeHtmlRC(c.name) + '<br><span style="font-weight:500;">(' + c.max_score + ')</span></th>').join('');
}

function skillRows(list, data) {
  if (!list.length) return '<div class="rc2-skill-row"><span>-</span></div>';
  return list.map(t => '<div class="rc2-skill-row"><span>' + escapeHtmlRC(t.name) + ':</span><strong>' + escapeHtmlRC(data.ratingMap[t.id] || '-') + '</strong></div>').join('');
}

function boxes(data) {
  const out = [];
  out.push({
    key: 'performance',
    title: 'Performance Summary',
    body:
      '<div class="rc2-skill-row"><span>Total Score:</span><strong>' + data.overallTotal + ' / ' + data.maxPerSubject * data.subjectRows.length + '</strong></div>' +
      '<div class="rc2-skill-row"><span>Percentage:</span><strong>' + data.overallPercent.toFixed(1) + '%</strong></div>' +
      '<div class="rc2-skill-row"><span>Overall Grade:</span><strong>' + escapeHtmlRC(data.overallGrade.grade) + '</strong></div>' +
      (data.showPositionInClass ? '<div class="rc2-skill-row"><span>Position in Class:</span><strong>' + ord(data.overallRank) + '</strong></div>' : '') +
      (data.showClassSize ? '<div class="rc2-skill-row"><span>Total Number in Class:</span><strong>' + data.classSize + '</strong></div>' : ''),
  });
  if (data.showAttendance) {
    out.push({
      key: 'attendance',
      title: 'Attendance',
      body:
        '<div class="rc2-skill-row"><span>Days Opened:</span><strong>' + data.daysOpened + '</strong></div>' +
        '<div class="rc2-skill-row"><span>Days Present:</span><strong>' + data.daysPresent + '</strong></div>' +
        '<div class="rc2-skill-row"><span>Days Absent:</span><strong>' + data.daysAbsent + '</strong></div>' +
        '<div class="rc2-skill-row"><span>Percentage:</span><strong>' + data.attendancePercent + '%</strong></div>' +
        '<div class="rc2-bar"><i style="width:' + Math.max(0, Math.min(100, Number(data.attendancePercent) || 0)) + '%"></i></div>',
    });
  }
  if (data.showCognitiveSkills) {
    out.push({ key: 'cognitive', title: 'Cognitive Skills', body: skillRows(data.cognitiveTraits, data) });
  }
  if (data.showCharacterConduct) {
    out.push({ key: 'character', title: 'Character &amp; Conduct', body: skillRows(data.characterTraits, data) });
  }
  return out;
}

function ord(n) {
  if (!n || n < 1) return '-';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function dateOf(v) {
  return v ? new Date(v).toLocaleDateString() : '-';
}

function laurelLeaves() {
  const out = [];
  const cx = 60;
  const cy = 60;
  const R = 52;
  for (let i = 0; i < 9; i++) {
    const t = (112 + i * 17) * (Math.PI / 180);
    const lx = cx + R * Math.cos(t);
    const ly = cy + R * Math.sin(t);
    const rot = (t * 180) / Math.PI - 18;
    out.push('<ellipse cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" rx="3.6" ry="8.2" transform="rotate(' + rot.toFixed(1) + ' ' + lx.toFixed(1) + ' ' + ly.toFixed(1) + ')"/>');
    const mx = cx - R * Math.cos(t);
    const rot2 = 180 - (t * 180) / Math.PI + 18 + 0;
    out.push('<ellipse cx="' + mx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" rx="3.6" ry="8.2" transform="rotate(' + (-rot).toFixed(1) + ' ' + mx.toFixed(1) + ' ' + ly.toFixed(1) + ')"/>');
  }
  return out.join('');
}

const LAUREL = '<svg viewBox="0 0 120 120" class="rc2-laurel" xmlns="http://www.w3.org/2000/svg"><g fill="currentColor">' + laurelLeaves() + '</g></svg>';

function logo(data, size) {
  const inner = data.school.logo_url
    ? '<img src="' + data.school.logo_url + '" class="rc2-logo-img">'
    : '<div class="rc2-logo-ph">' + escapeHtmlRC((data.school.name || 'S').charAt(0)) + '</div>';
  return '<div class="rc2-logo-wrap" style="width:' + size + 'px;height:' + size + 'px;">' + LAUREL + '<div class="rc2-logo-disc">' + inner + '</div></div>';
}

function photo(data) {
  if (!data.showStudentPhoto || !data.student.photo_url) return '';
  return '<img src="' + data.student.photo_url + '" class="rc2-photo">';
}

const BOOKS =
  '<svg viewBox="0 0 220 170" class="rc2-books" xmlns="http://www.w3.org/2000/svg">' +
  '<rect x="30" y="118" width="170" height="26" rx="3" fill="#B7924A"/><rect x="30" y="118" width="170" height="6" fill="#D9BC7C"/>' +
  '<rect x="20" y="92" width="170" height="26" rx="3" fill="#2E5F4B"/><rect x="20" y="92" width="170" height="6" fill="#4B8068"/>' +
  '<rect x="34" y="66" width="156" height="26" rx="3" fill="#C9A86A"/><rect x="34" y="66" width="156" height="6" fill="#E3CB92"/>' +
  '<rect x="26" y="40" width="150" height="26" rx="3" fill="#1F4D3C"/><rect x="26" y="40" width="150" height="6" fill="#3B7059"/>' +
  '<polygon points="100,6 190,26 100,46 10,26" fill="#16382C"/><polygon points="100,6 190,26 100,30 10,26" fill="#245444"/>' +
  '<path d="M178 28 L178 62" stroke="#D4A63C" stroke-width="3"/><circle cx="178" cy="66" r="5" fill="#D4A63C"/></svg>';

function details(data, theme) {
  const cls = escapeHtmlRC(data.classRow.name) + (data.classRow.arm ? ' ' + escapeHtmlRC(data.classRow.arm) : '');
  const L = [
    ['STUDENT\'S NAME:', escapeHtmlRC(data.student.full_name).toUpperCase()],
    ['ADMISSION NO.:', escapeHtmlRC(data.student.admission_no || '-')],
    ['CLASS:', cls],
    ['TERM ENDS:', dateOf(data.termRow.term_end_date)],
    ['NEXT TERM RESUMES:', dateOf(data.termRow.next_term_resumes)],
  ];
  const R = [];
  if (data.showDob) R.push(['DATE OF BIRTH:', data.student.dob ? new Date(data.student.dob).toLocaleDateString() : '-']);
  R.push(['GENDER:', escapeHtmlRC(data.student.gender || '-')]);
  R.push(['TERM:', escapeHtmlRC(data.termName)]);
  const one = r => '<div class="rc2-d-row"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>';
  return '<div class="rc2-details"><div class="rc2-d-col">' + L.map(one).join('') + '</div><div class="rc2-d-col rc2-d-right">' + R.map(one).join('') + '</div></div>';
}

function summary(data) {
  return '<div class="rc2-summary-grid">' + boxes(data).map(b => '<div class="rc2-sbox rc2-sbox-' + b.key + '"><div class="rc2-sbox-title">' + b.title + '</div><div class="rc2-sbox-body">' + b.body + '</div></div>').join('') + '</div>';
}

function remarks(data) {
  const ct = escapeHtmlRC((data.remarksRow && data.remarksRow.class_teacher_remark) || '-');
  const pr = escapeHtmlRC((data.remarksRow && data.remarksRow.principal_remark) || '-');
  return (
    '<div class="rc2-remarks">' +
    '<div class="rc2-rem rc2-rem-a"><div class="rc2-rem-title">CLASS TEACHER\'S REMARK</div><div class="rc2-rem-text">' + ct + '</div></div>' +
    '<div class="rc2-rem rc2-rem-b"><div class="rc2-rem-title">PRINCIPAL\'S REMARK</div><div class="rc2-rem-text">' + pr + '</div></div>' +
    '</div>'
  );
}

function signatures(data) {
  const stamp = data.showStamp ? '<img src="' + data.school.stamp_url + '" class="rc2-stamp">' : '';
  const promoted = data.promotedTo ? '<div class="rc2-promoted-pill">PROMOTED TO: ' + escapeHtmlRC(data.promotedTo).toUpperCase() + '</div>' : '';
  const today = new Date().toLocaleDateString();
  return (
    '<div class="rc2-sigs">' +
    '<div class="rc2-sig"><div class="rc2-sig-line"></div><b>Class Teacher</b><span>Date: ' + today + '</span></div>' +
    '<div class="rc2-sig-mid">' + stamp + promoted + '</div>' +
    '<div class="rc2-sig"><div class="rc2-sig-line"></div><b>Principal</b><span>Date: ' + today + '</span></div>' +
    '</div>'
  );
}

function contactBlock(data) {
  const out = [];
  if (data.school.address) out.push('<div class="rc2-contact">' + escapeHtmlRC(data.school.address) + '</div>');
  if (data.school.phone) out.push('<div class="rc2-contact">Tel: ' + escapeHtmlRC(data.school.phone) + '</div>');
  if (data.school.email) out.push('<div class="rc2-contact">' + escapeHtmlRC(data.school.email) + '</div>');
  return out.join('');
}

function shared(key, theme, o) {
  const k = '.rc-tpl-' + key;
  return `
    ${k}{ position:relative; overflow:hidden; background:${theme.background}; width:800px; max-width:800px; margin:0 auto; padding:${o.padTop}px 34px ${o.padBottom}px; font-family:${SANS}; color:#1B2433; }
    ${k} *{ box-sizing:border-box; }
    ${k} .rc2-deco{ position:absolute; pointer-events:none; }
    ${k} .rc2-content{ position:relative; z-index:2; }
    ${k} .rc2-header{ display:flex; align-items:center; gap:20px; }
    ${k} .rc2-logo-wrap{ position:relative; flex:0 0 auto; color:${theme.accent}; }
    ${k} .rc2-laurel{ position:absolute; left:0; top:0; width:100%; height:100%; }
    ${k} .rc2-logo-disc{ position:absolute; left:13%; top:13%; width:74%; height:74%; border-radius:50%; background:${theme.primary}; border:3px solid ${theme.accent}; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    ${k} .rc2-logo-img{ width:100%; height:100%; object-fit:cover; background:#fff; }
    ${k} .rc2-logo-ph{ color:#fff; font-family:${SERIF}; font-weight:800; font-size:2rem; }
    ${k} .rc2-school{ flex:1; min-width:0; text-align:left; }
    ${k} .rc2-school-name{ margin:0; font-family:${SERIF}; font-weight:900; font-size:${o.nameSize}rem; line-height:1.08; color:${o.nameColor || theme.primary}; letter-spacing:-0.005em; word-break:normal; overflow-wrap:break-word; }
    ${k} .rc2-motto{ margin:4px 0 6px 0; font-family:${SERIF}; font-style:italic; font-weight:700; font-size:1.05rem; color:${theme.accent}; }
    ${k} .rc2-contact{ font-size:0.86rem; font-weight:600; line-height:1.4; color:${o.contact || theme.primary}; }
    ${k} .rc2-photo{ width:92px; height:112px; object-fit:cover; border-radius:12px; border:3px solid ${theme.accent}; background:#fff; flex:0 0 auto; }
    ${k} .rc2-books{ width:150px; flex:0 0 auto; }
    ${k} .rc2-details{ display:flex; border:1.5px solid ${theme.accent}; border-radius:14px; background:rgba(255,255,255,0.88); padding:8px 16px; margin-top:14px; }
    ${k} .rc2-d-col{ flex:1.25; }
    ${k} .rc2-d-right{ flex:1; border-left:1px solid ${theme.accent}66; padding-left:16px; margin-left:12px; }
    ${k} .rc2-d-row{ display:flex; gap:10px; padding:4px 0; border-bottom:1px solid ${theme.accent}33; font-size:0.78rem; }
    ${k} .rc2-d-row:last-child{ border-bottom:none; }
    ${k} .rc2-d-row .k{ flex:0 0 40%; font-weight:800; color:${theme.primary}; }
    ${k} .rc2-d-row .v{ flex:1; font-weight:500; word-break:break-word; }
    ${k} .rc2-table-wrap{ margin-top:14px; border:1.5px solid ${theme.primary}; border-radius:14px; overflow:hidden; background:rgba(255,255,255,0.9); }
    ${k} table.rc2-subjects{ width:100%; border-collapse:collapse; font-size:0.76rem; }
    ${k} table.rc2-subjects th{ background:${theme.primary}; color:${theme.textOnPrimary}; padding:7px 4px; font-weight:800; font-size:0.66rem; text-align:center; text-transform:uppercase; border-left:1px solid rgba(255,255,255,0.18); }
    ${k} table.rc2-subjects th:first-child{ text-align:left; padding-left:14px; font-size:0.78rem; border-left:none; letter-spacing:0.04em; }
    ${k} table.rc2-subjects td{ padding:5px 4px; text-align:center; border-left:1px solid ${theme.primary}1f; font-weight:500; }
    ${k} table.rc2-subjects td:first-child{ border-left:none; }
    ${k} table.rc2-subjects tbody tr:nth-child(even) td{ background:${theme.primary}0d; }
    ${k} table.rc2-subjects .rc2-subject-name{ text-align:left; padding-left:14px; font-weight:600; }
    ${k} table.rc2-subjects .rc2-total-col{ font-weight:900; background:${theme.accent}22 !important; color:${theme.primary}; }
    ${k} .grade-good{ color:#1F7A45; font-weight:900; }
    ${k} .grade-poor{ color:#C62828; font-weight:900; }
    ${k} .rc2-summary-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:14px; }
    ${k} .rc2-sbox{ border-radius:12px; overflow:hidden; background:rgba(255,255,255,0.92); border:1.5px solid var(--bc); }
    ${k} .rc2-sbox-performance{ --bc:${theme.primary}; --bh:${theme.primary}; }
    ${k} .rc2-sbox-attendance{ --bc:${theme.secondary}; --bh:${theme.secondary}; }
    ${k} .rc2-sbox-cognitive{ --bc:${theme.accent}; --bh:${theme.accent}; }
    ${k} .rc2-sbox-character{ --bc:${theme.primary}; --bh:${theme.primary}; }
    ${k} .rc2-sbox-title{ background:var(--bh); color:#fff; font-weight:800; font-size:0.64rem; letter-spacing:0.03em; text-transform:uppercase; padding:7px 8px; text-align:center; }
    ${k} .rc2-sbox-cognitive .rc2-sbox-title{ color:${theme.textOnAccent}; }
    ${k} .rc2-sbox-body{ padding:8px 9px; font-size:0.68rem; }
    ${k} .rc2-skill-row{ display:flex; justify-content:space-between; gap:6px; padding:2.5px 0; }
    ${k} .rc2-skill-row strong{ font-weight:800; }
    ${k} .rc2-bar{ height:7px; border-radius:4px; background:#E4E7EB; margin-top:6px; overflow:hidden; }
    ${k} .rc2-bar i{ display:block; height:100%; background:${theme.secondary}; border-radius:4px; }
    ${k} .rc2-remarks{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px; }
    ${k} .rc2-rem{ border-radius:12px; overflow:hidden; background:rgba(255,255,255,0.92); border:1.5px solid var(--rc); }
    ${k} .rc2-rem-a{ --rc:${theme.primary}; }
    ${k} .rc2-rem-b{ --rc:${theme.accent}; }
    ${k} .rc2-rem-title{ background:var(--rc); color:#fff; font-weight:800; font-size:0.68rem; letter-spacing:0.03em; padding:7px 14px; }
    ${k} .rc2-rem-b .rc2-rem-title{ color:${theme.textOnAccent}; }
    ${k} .rc2-rem-text{ padding:10px 14px; font-size:0.76rem; line-height:1.5; font-weight:500; }
    ${k} .rc2-sigs{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-top:16px; }
    ${k} .rc2-sig{ width:210px; text-align:center; font-size:0.72rem; display:flex; flex-direction:column; gap:2px; }
    ${k} .rc2-sig b{ font-weight:800; }
    ${k} .rc2-sig-line{ border-top:1.5px solid #3b4252; margin-bottom:4px; margin-top:26px; }
    ${k} .rc2-sig-mid{ flex:1; text-align:center; display:flex; flex-direction:column; align-items:center; gap:6px; }
    ${k} .rc2-stamp{ width:56px; height:56px; object-fit:contain; }
    ${k} .rc2-promoted-pill{ display:inline-block; background:${theme.primary}; color:#fff; font-weight:800; font-size:0.74rem; letter-spacing:0.04em; padding:9px 22px; border-radius:22px; border:2.5px solid ${theme.accent}; box-shadow:0 0 0 2px ${theme.background}, 0 0 0 3.5px ${theme.accent}; }
    ${k} .rc2-foot{ display:flex; align-items:center; gap:10px; margin-top:16px; }
    ${k} .rc2-foot i{ flex:1; height:1.5px; background:${theme.accent}; }
    ${k} .rc2-foot b{ width:8px; height:8px; background:${theme.accent}; transform:rotate(45deg); }
  `;
}

/* ---------- 1. EMERALD (replaces Royal) ---------- */
export function renderEmeraldTemplate(data, theme) {
  const css =
    shared('royal', theme, { padTop: 54, padBottom: 40, nameSize: fitName(data.school.name, 2.15) }) +
    `
    .rc-tpl-royal{ background:${theme.background} radial-gradient(ellipse at 85% 6%, rgba(255,255,255,0.9), rgba(255,255,255,0) 55%); }
    .rc-tpl-royal .rc2-band{ position:relative; margin-top:16px; background:${theme.primary}; color:#fff; padding:14px 30px 12px 30px; border-radius:14px 0 0 14px; clip-path:polygon(0 0, 88% 0, 100% 100%, 0 100%); width:84%; }
    .rc-tpl-royal .rc2-band::after{ content:''; position:absolute; right:0; top:0; bottom:0; width:8%; background:linear-gradient(115deg, transparent 49%, ${theme.accent} 50%, ${theme.accent} 54%, transparent 55%); }
    .rc-tpl-royal .rc2-band .a{ font-size:0.95rem; font-weight:700; letter-spacing:0.5em; color:${theme.accent}; }
    .rc-tpl-royal .rc2-band .t{ font-family:${SERIF}; font-weight:900; font-size:2.55rem; line-height:1.05; letter-spacing:0.01em; }
    .rc-tpl-royal .rc2-band .s{ font-size:0.9rem; font-weight:700; letter-spacing:0.3em; color:${theme.accent}; margin-top:2px; }
    `;
  const html = `
    <div class="rc-page rc-tpl-royal">
      <svg class="rc2-deco" style="left:0;top:0;width:210px;height:150px;" viewBox="0 0 210 150" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 H210 C120 4 40 40 0 150 Z" fill="${theme.primary}"/><path d="M210 0 C120 4 40 40 0 150" fill="none" stroke="${theme.accent}" stroke-width="5"/></svg>
      <svg class="rc2-deco" style="left:0;bottom:0;width:100%;height:120px;" viewBox="0 0 800 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 120 V30 C200 100 520 140 800 60 V120 Z" fill="${theme.primary}"/><path d="M0 30 C200 100 520 140 800 60" fill="none" stroke="${theme.accent}" stroke-width="4"/></svg>
      <div class="rc2-content">
        <div class="rc2-header">
          ${logo(data, 124)}
          <div class="rc2-school">
            <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
            ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
            ${contactBlock(data)}
          </div>
          ${photo(data) || BOOKS}
        </div>
        <div class="rc2-band"><div class="a">ACADEMIC</div><div class="t">REPORT CARD</div><div class="s">${escapeHtmlRC(data.sessionName)} SESSION</div></div>
        ${details(data, theme)}
        <div class="rc2-table-wrap"><table class="rc2-subjects">
          <thead><tr><th>SUBJECTS</th>${heads(data)}<th>TOTAL<br>(${data.maxPerSubject})</th><th>GRADE</th><th>REMARKS</th></tr></thead>
          <tbody>${rows(data)}</tbody>
        </table></div>
        ${summary(data)}
        ${remarks(data)}
        ${signatures(data)}
        <div class="rc2-foot"><i></i><b></b><i></i></div>
      </div>
    </div>`;
  return { css, html };
}

/* ---------- 2. HERITAGE (replaces Prestige) ---------- */
export function renderHeritageTemplate(data, theme) {
  const css =
    shared('prestige', theme, { padTop: 60, padBottom: 52, nameSize: fitName(data.school.name, 2.15) }) +
    `
    .rc-tpl-prestige .rc2-title-block{ margin-top:18px; }
    .rc-tpl-prestige .rc2-title-block .a{ font-size:1rem; font-weight:700; letter-spacing:0.55em; color:${theme.accent}; }
    .rc-tpl-prestige .rc2-title-block .t{ font-family:${SERIF}; font-weight:900; font-size:3rem; line-height:1.02; color:${theme.primary}; }
    .rc-tpl-prestige .rc2-title-block .s{ display:inline-block; font-size:0.95rem; font-weight:700; letter-spacing:0.3em; color:${theme.primary}; padding-bottom:4px; border-bottom:2.5px solid ${theme.secondary}; margin-top:4px; }
    .rc-tpl-prestige .rc2-details{ background:linear-gradient(110deg, #fff 55%, ${theme.accent}1c); border-top:5px solid ${theme.primary}; }
    `;
  const html = `
    <div class="rc-page rc-tpl-prestige">
      <svg class="rc2-deco" style="left:0;top:0;width:180px;height:200px;" viewBox="0 0 180 200" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 H110 C60 30 20 80 0 200 Z" fill="${theme.primary}"/><path d="M0 200 C20 110 40 70 90 20" fill="none" stroke="${theme.secondary}" stroke-width="18"/><path d="M0 200 C14 120 40 60 110 0" fill="none" stroke="${theme.accent}" stroke-width="3"/></svg>
      <svg class="rc2-deco" style="left:0;bottom:0;width:100%;height:130px;" viewBox="0 0 800 130" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 130 V80 C120 110 300 100 420 130 Z" fill="${theme.accent}"/><path d="M0 130 V100 C120 125 260 118 340 130 Z" fill="${theme.primary}"/><path d="M800 130 V50 C720 70 640 100 560 130 Z" fill="${theme.primary}"/><path d="M800 130 V86 C730 98 690 112 650 130 Z" fill="${theme.secondary}"/></svg>
      <div class="rc2-content">
        <div class="rc2-header">
          ${logo(data, 124)}
          <div class="rc2-school">
            <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
            ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
            ${contactBlock(data)}
          </div>
          ${photo(data)}
        </div>
        <div class="rc2-title-block"><div class="a">ACADEMIC</div><div class="t">REPORT CARD</div><div class="s">${escapeHtmlRC(data.sessionName)} SESSION</div></div>
        ${details(data, theme)}
        <div class="rc2-table-wrap"><table class="rc2-subjects">
          <thead><tr><th>SUBJECTS</th>${heads(data)}<th>TOTAL<br>(${data.maxPerSubject})</th><th>GRADE</th><th>REMARKS</th></tr></thead>
          <tbody>${rows(data)}</tbody>
        </table></div>
        ${summary(data)}
        ${remarks(data)}
        ${signatures(data)}
        <div class="rc2-foot"><i></i><b></b><i></i></div>
      </div>
    </div>`;
  return { css, html };
}

/* ---------- 3. NAVY GOLD (replaces Modern) ---------- */
export function renderNavyGoldTemplate(data, theme) {
  const css =
    shared('modern', theme, { padTop: 52, padBottom: 52, nameSize: fitName(data.school.name, 2.1) }) +
    `
    .rc-tpl-modern{ border-radius:0; box-shadow:none; }
    .rc-tpl-modern .rc2-band{ margin:16px -34px 0 -34px; background:${theme.primary}; color:#fff; text-align:center; padding:12px 20px 12px 20px; }
    .rc-tpl-modern .rc2-band .a{ font-size:1rem; font-weight:700; letter-spacing:0.5em; color:${theme.accent}; }
    .rc-tpl-modern .rc2-band .t{ display:flex; align-items:center; justify-content:center; gap:18px; font-family:${SERIF}; font-weight:900; font-size:2.6rem; line-height:1.05; }
    .rc-tpl-modern .rc2-band .t i{ width:90px; height:2px; background:${theme.accent}; }
    .rc-tpl-modern .rc2-band .s{ font-size:0.92rem; font-weight:700; letter-spacing:0.3em; color:${theme.accent}; margin-top:2px; }
    .rc-tpl-modern .rc2-details{ margin-top:16px; }
    `;
  const html = `
    <div class="rc-page rc-tpl-modern">
      <svg class="rc2-deco" style="right:0;top:0;width:260px;height:150px;" viewBox="0 0 260 150" xmlns="http://www.w3.org/2000/svg"><path d="M260 0 V120 C230 50 160 12 70 0 Z" fill="${theme.primary}"/><path d="M70 0 C165 14 232 56 260 128" fill="none" stroke="${theme.accent}" stroke-width="5"/></svg>
      <svg class="rc2-deco" style="left:0;bottom:0;width:100%;height:120px;" viewBox="0 0 800 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 120 V60 C160 110 420 134 800 70 V120 Z" fill="${theme.primary}"/><path d="M0 60 C160 110 420 134 800 70" fill="none" stroke="${theme.accent}" stroke-width="4"/></svg>
      <div class="rc2-content">
        <div class="rc2-header">
          ${logo(data, 124)}
          <div class="rc2-school">
            <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
            ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
            ${contactBlock(data)}
          </div>
          ${photo(data)}
        </div>
        <div class="rc2-band"><div class="a">ACADEMIC</div><div class="t"><i></i>REPORT CARD<i></i></div><div class="s">${escapeHtmlRC(data.sessionName)} SESSION</div></div>
        ${details(data, theme)}
        <div class="rc2-table-wrap"><table class="rc2-subjects">
          <thead><tr><th>SUBJECTS</th>${heads(data)}<th>TOTAL<br>(${data.maxPerSubject})</th><th>GRADE</th><th>REMARKS</th></tr></thead>
          <tbody>${rows(data)}</tbody>
        </table></div>
        ${summary(data)}
        ${remarks(data)}
        ${signatures(data)}
        <div class="rc2-foot"><i></i><b></b><i></i></div>
      </div>
    </div>`;
  return { css, html };
}
