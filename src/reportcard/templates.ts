// @ts-nocheck
import { escapeHtmlRC, ordinalRC } from './helpers';
/* =========================================================
   Report Card — Template Renderers (1 of 2): shared blocks + Classic + Modern
   =========================================================
   Every function here takes the SAME (data, theme) pair — data comes
   from gatherReportCardData() (unchanged calculation/wording), theme
   comes from resolveTheme(). Each renderer returns { css, html }.

   NONE of these functions calculate anything — they only lay out
   values already present on `data`.
   ========================================================= */

function buildSubjectRowsHtml(data) {
  const gradeClass = (g) => (g === 'A' || g === 'B') ? 'grade-good' : (g === '-' ? '' : 'grade-poor');
  return data.subjectRows.map(s => {
    const compCells = data.components.map(c => {
      const val = (data.scoresByComponent[s.subjectId] || {})[c.id];
      return `<td>${val !== undefined ? val : '-'}</td>`;
    }).join('');
    return `
      <tr>
        <td class="rc2-subject-name">${escapeHtmlRC(s.name)}</td>
        ${compCells}
        <td class="rc2-total-col">${s.total}</td>
        <td class="${gradeClass(s.grade)}">${escapeHtmlRC(s.grade)}</td>
        <td>${escapeHtmlRC(s.remark)}</td>
      </tr>
    `;
  }).join('');
}

function buildComponentHeadersHtml(data) {
  return data.components.map(c => `<th>${escapeHtmlRC(c.name)}<br><span style="font-weight:400;">(${c.max_score})</span></th>`).join('');
}

function buildCognitiveRowsHtml(data) {
  if (!data.cognitiveTraits.length) return `<div class="rc2-empty-row">—</div>`;
  return data.cognitiveTraits.map(t => `
    <div class="rc2-skill-row"><span>${escapeHtmlRC(t.name)}:</span><strong>${escapeHtmlRC(data.ratingMap[t.id] || '—')}</strong></div>
  `).join('');
}

function buildCharacterRowsHtml(data) {
  if (!data.characterTraits.length) return `<div class="rc2-empty-row">—</div>`;
  return data.characterTraits.map(t => `
    <div class="rc2-skill-row"><span>${escapeHtmlRC(t.name)}:</span><strong>${escapeHtmlRC(data.ratingMap[t.id] || '—')}</strong></div>
  `).join('');
}

/**
 * Builds the four-box Performance/Attendance/Cognitive/Character grid
 * as an array of { key, title, bodyHtml } objects — respecting each
 * section's school-level visibility toggle (showAttendance,
 * showCognitiveSkills, showCharacterConduct; Position in Class within
 * Performance also respects showPositionInClass). Performance itself
 * is never hidden — it's the report's core result and the original
 * renderReportCard() never gated it.
 *
 * Templates map over this array to render their own box styling —
 * this keeps the "which sections show" logic in exactly one place
 * instead of duplicated eight times.
 */
function buildSummaryBoxes(data) {
  const boxes = [
    {
      key: 'performance',
      title: 'Performance Summary',
      bodyHtml: `
        <div class="rc2-skill-row"><span>Total Score:</span><strong>${data.overallTotal} / ${data.maxPerSubject * data.subjectRows.length}</strong></div>
        <div class="rc2-skill-row"><span>Percentage:</span><strong>${data.overallPercent.toFixed(1)}%</strong></div>
        <div class="rc2-skill-row"><span>Overall Grade:</span><strong>${escapeHtmlRC(data.overallGrade.grade)}</strong></div>
        ${data.showPositionInClass ? `<div class="rc2-skill-row"><span>Position in Class:</span><strong>${ordinalRC(data.overallRank)}</strong></div>` : ''}
        ${data.showClassSize ? `<div class="rc2-skill-row"><span>Total Number in Class:</span><strong>${data.classSize}</strong></div>` : ''}
      `
    }
  ];

  if (data.showAttendance) {
    boxes.push({
      key: 'attendance',
      title: 'Attendance',
      bodyHtml: `
        <div class="rc2-skill-row"><span>Days Opened:</span><strong>${data.daysOpened}</strong></div>
        <div class="rc2-skill-row"><span>Days Present:</span><strong>${data.daysPresent}</strong></div>
        <div class="rc2-skill-row"><span>Days Absent:</span><strong>${data.daysAbsent}</strong></div>
        <div class="rc2-skill-row"><span>Percentage:</span><strong>${data.attendancePercent}%</strong></div>
      `
    });
  }

  if (data.showCognitiveSkills) {
    boxes.push({ key: 'cognitive', title: 'Cognitive Skills', bodyHtml: buildCognitiveRowsHtml(data) });
  }

  if (data.showCharacterConduct) {
    boxes.push({ key: 'character', title: 'Character &amp; Conduct', bodyHtml: buildCharacterRowsHtml(data) });
  }

  return boxes;
}

function photoBlockHtml(data, size) {
  size = size || { w: 72, h: 88 };
  if (!data.showStudentPhoto || !data.student.photo_url) return '';
  return `<img src="${data.student.photo_url}" class="rc2-photo" style="width:${size.w}px; height:${size.h}px;">`;
}

function logoBlockHtml(data, size) {
  size = size || 76;
  return data.school.logo_url
    ? `<img src="${data.school.logo_url}" class="rc2-logo" style="width:${size}px; height:${size}px;">`
    : `<div class="rc2-logo-placeholder" style="width:${size}px; height:${size}px;">${escapeHtmlRC((data.school.name || 'S').charAt(0))}</div>`;
}

/**
 * "Promoted To: X" badge — only rendered when the school actually
 * recorded a promotion for this student's report card. Matches the
 * original renderReportCard()'s conditional exactly.
 */
function promotedBadgeHtml(data) {
  if (!data.promotedTo) return '';
  return `<div class="rc2-promoted"><div class="rc2-promoted-inner">Promoted To: ${escapeHtmlRC(data.promotedTo)}</div></div>`;
}

/**
 * School seal/stamp image — only rendered when the school has one
 * uploaded AND has show_stamp enabled (data.showStamp already folds
 * both checks together).
 */
function stampBlockHtml(data, size) {
  size = size || 64;
  if (!data.showStamp) return '';
  return `<img src="${data.school.stamp_url}" class="rc2-stamp" style="width:${size}px; height:${size}px;">`;
}

/* =========================================================
   1. SCHOLIN CLASSIC — the original navy/gold/wine-red ledger style.
   ========================================================= */
export function renderClassicTemplate(data, theme) {
  const css = `
    .rc-tpl-classic{ background:${theme.background}; max-width:800px; width:800px; margin:0 auto; padding:32px 36px; border:3px solid ${theme.primary}; border-radius:10px; font-family:'Inter', sans-serif; color:${theme.textOnBackground}; }
    .rc-tpl-classic .rc2-header{ display:flex; align-items:flex-start; gap:16px; border-bottom:2px solid ${theme.primary}; padding-bottom:14px; margin-bottom:16px; }
    .rc-tpl-classic .rc2-logo, .rc-tpl-classic .rc2-logo-placeholder{ border-radius:50%; object-fit:cover; flex-shrink:0; }
    .rc-tpl-classic .rc2-logo-placeholder{ background:${theme.tintPrimary}; display:flex; align-items:center; justify-content:center; color:${theme.primary}; font-family:'Lora',serif; font-weight:700; font-size:1.6rem; border:2px solid ${theme.accent}; }
    .rc-tpl-classic .rc2-school-info{ flex:1; text-align:center; padding-top:4px; }
    .rc-tpl-classic .rc2-school-name{ font-family:'Lora',serif; font-weight:800; font-size:1.65rem; color:${theme.primary}; margin:0; letter-spacing:0.02em; }
    .rc-tpl-classic .rc2-motto{ font-style:italic; color:${theme.secondary}; font-size:0.92rem; margin:3px 0; font-weight:600; }
    .rc-tpl-classic .rc2-address{ font-size:0.76rem; color:#555; margin:2px 0; }
    .rc-tpl-classic .rc2-photo, .rc-tpl-classic .rc2-photo-placeholder{ object-fit:cover; border:1px solid #999; flex-shrink:0; }
    .rc-tpl-classic .rc2-photo-placeholder{ background:#eee; display:flex; align-items:center; justify-content:center; color:#999; font-size:0.65rem; text-align:center; }
    .rc-tpl-classic .rc2-title{ text-align:center; font-family:'Lora',serif; font-weight:800; font-size:2rem; color:${theme.secondary}; letter-spacing:0.08em; margin:10px 0 2px 0; }
    .rc-tpl-classic .rc2-title-underline{ width:140px; height:2px; background:${theme.primary}; margin:0 auto 6px auto; position:relative; }
    .rc-tpl-classic .rc2-session{ text-align:center; font-size:0.85rem; color:${theme.primary}; font-weight:700; margin-bottom:16px; letter-spacing:0.03em; }
    .rc-tpl-classic .rc2-bio-table{ width:100%; border-collapse:collapse; margin-bottom:16px; font-size:0.78rem; }
    .rc-tpl-classic .rc2-bio-table td{ padding:7px 12px; border:1px solid ${theme.border}; }
    .rc-tpl-classic .rc2-bio-table td.label{ background:${theme.tintAccent}; font-weight:700; width:22%; }
    .rc-tpl-classic .rc2-bio-table td.val{ background:#fff; }
    .rc-tpl-classic table.rc2-subjects{ width:100%; border-collapse:collapse; margin-bottom:16px; font-size:0.76rem; table-layout:fixed; }
    .rc-tpl-classic table.rc2-subjects th, .rc-tpl-classic table.rc2-subjects td{ border:1px solid ${theme.border}; padding:7px 6px; text-align:center; }
    .rc-tpl-classic table.rc2-subjects th{ background:${theme.secondary}; color:${theme.textOnSecondary}; font-size:0.7rem; text-transform:uppercase; font-weight:700; }
    .rc-tpl-classic table.rc2-subjects .rc2-subject-name{ text-align:left; padding-left:12px; }
    .rc-tpl-classic table.rc2-subjects tbody tr:nth-child(even) td{ background:${theme.tintPrimary}; }
    .rc-tpl-classic .rc2-total-col{ font-weight:800; color:${theme.primary}; }
    .rc-tpl-classic .grade-good{ color:#2F7A4F; font-weight:800; }
    .rc-tpl-classic .grade-poor{ color:${theme.secondary}; font-weight:800; }
    .rc-tpl-classic .rc2-summary-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px; }
    .rc-tpl-classic .rc2-summary-box{ border:1px solid ${theme.border}; border-radius:6px; overflow:hidden; background:#fff; }
    .rc-tpl-classic .rc2-box-title{ color:#fff; font-size:0.66rem; text-transform:uppercase; padding:6px 8px; font-weight:700; text-align:center; }
    .rc-tpl-classic .rc2-summary-box.performance .rc2-box-title{ background:${theme.primary}; }
    .rc-tpl-classic .rc2-summary-box.attendance .rc2-box-title{ background:#2F5233; }
    .rc-tpl-classic .rc2-summary-box.cognitive .rc2-box-title{ background:${theme.accent}; color:${theme.textOnAccent}; }
    .rc-tpl-classic .rc2-summary-box.character .rc2-box-title{ background:${theme.secondary}; color:${theme.textOnSecondary}; }
    .rc-tpl-classic .rc2-box-body{ padding:8px 10px; font-size:0.68rem; }
    .rc-tpl-classic .rc2-skill-row{ display:flex; justify-content:space-between; padding:2.5px 0; }
    .rc-tpl-classic .rc2-remarks{ display:grid; grid-template-columns:1fr 1fr; border:1px solid ${theme.border}; border-radius:6px; overflow:hidden; margin-bottom:6px; }
    .rc-tpl-classic .rc2-remark-title{ color:#fff; font-size:0.68rem; text-transform:uppercase; font-weight:700; padding:6px 14px; text-align:center; }
    .rc-tpl-classic .rc2-remark-col:first-child .rc2-remark-title{ background:${theme.primary}; }
    .rc-tpl-classic .rc2-remark-col:last-child .rc2-remark-title{ background:${theme.secondary}; color:${theme.textOnSecondary}; }
    .rc-tpl-classic .rc2-remark-text{ padding:10px 16px; line-height:1.5; font-size:0.74rem; }
    .rc-tpl-classic .rc2-signatures{ display:flex; justify-content:space-between; margin-top:16px; padding:0 20px; }
    .rc-tpl-classic .rc2-sig-block{ text-align:center; font-size:0.75rem; width:180px; }
    .rc-tpl-classic .rc2-sig-line{ border-top:1px solid #555; padding-top:4px; margin-top:20px; }
    .rc-tpl-classic .rc2-footer-bar{ background:${theme.primary}; color:${theme.textOnPrimary}; text-align:center; padding:8px; margin:18px -36px -32px -36px; border-radius:0 0 7px 7px; font-size:0.72rem; letter-spacing:0.15em; font-weight:600; }
    .rc-tpl-classic .rc2-stamp-wrap{ display:flex; justify-content:center; margin:-30px 0 6px 0; position:relative; z-index:5; }
    .rc-tpl-classic .rc2-stamp{ object-fit:contain; }
    .rc-tpl-classic .rc2-promoted{ text-align:center; margin-top:14px; }
    .rc-tpl-classic .rc2-promoted-inner{ display:inline-block; border:1.5px solid ${theme.primary}; border-radius:20px; padding:6px 18px; background:#fff; font-size:0.85rem; font-weight:700; color:${theme.secondary}; text-transform:uppercase; letter-spacing:0.03em; }
  `;

  const html = `
    <div class="rc-page rc-tpl-classic">
      <div class="rc2-header">
        ${logoBlockHtml(data)}
        <div class="rc2-school-info">
          <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
          ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
          <p class="rc2-address">${escapeHtmlRC(data.school.address || '')}</p>
          <p class="rc2-address">${data.school.phone ? 'Tel: ' + escapeHtmlRC(data.school.phone) : ''}${data.school.phone && data.school.email ? ' | ' : ''}${data.school.email ? 'Email: ' + escapeHtmlRC(data.school.email) : ''}</p>
        </div>
        ${photoBlockHtml(data)}
      </div>
      <div class="rc2-title">REPORT CARD</div>
      <div class="rc2-title-underline"></div>
      <div class="rc2-session">${escapeHtmlRC(data.sessionName)} SESSION</div>

      <table class="rc2-bio-table">
        <tr><td class="label">STUDENT'S NAME:</td><td class="val">${escapeHtmlRC(data.student.full_name).toUpperCase()}</td><td class="label">${data.showDob ? 'DATE OF BIRTH:' : ''}</td><td class="val">${data.showDob ? (data.student.dob ? new Date(data.student.dob).toLocaleDateString(undefined, {year:'numeric',month:'long',day:'numeric'}) : '—') : ''}</td></tr>
        <tr><td class="label">ADMISSION NO.:</td><td class="val">${escapeHtmlRC(data.student.admission_no || '—')}</td><td class="label">GENDER:</td><td class="val">${escapeHtmlRC(data.student.gender || '—')}</td></tr>
        <tr><td class="label">CLASS:</td><td class="val">${escapeHtmlRC(data.classRow.name)}${data.classRow.arm ? ' ' + escapeHtmlRC(data.classRow.arm) : ''}</td><td class="label">TERM:</td><td class="val">${escapeHtmlRC(data.termName)}</td></tr>
        <tr><td class="label">TERM ENDS:</td><td class="val" colspan="3">${data.termRow.term_end_date ? new Date(data.termRow.term_end_date).toLocaleDateString(undefined, {year:'numeric',month:'long',day:'numeric'}) : '—'}</td></tr>
        <tr><td class="label">NEXT TERM RESUMES:</td><td class="val" colspan="3">${data.termRow.next_term_resumes ? new Date(data.termRow.next_term_resumes).toLocaleDateString(undefined, {year:'numeric',month:'long',day:'numeric'}) : '—'}</td></tr>
      </table>

      <table class="rc2-subjects">
        <thead><tr><th style="text-align:left;">SUBJECTS</th>${buildComponentHeadersHtml(data)}<th>TOTAL<br>(${data.maxPerSubject})</th><th>GRADE</th><th>REMARKS</th></tr></thead>
        <tbody>${buildSubjectRowsHtml(data)}</tbody>
      </table>

      <div class="rc2-summary-grid">
        ${buildSummaryBoxes(data).map(b => `<div class="rc2-summary-box ${b.key}"><div class="rc2-box-title">${b.title}</div><div class="rc2-box-body">${b.bodyHtml}</div></div>`).join('')}
      </div>

      <div class="rc2-remarks">
        <div class="rc2-remark-col"><div class="rc2-remark-title">Class Teacher's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.class_teacher_remark) || '—')}</div></div>
        <div class="rc2-remark-col"><div class="rc2-remark-title">Principal's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.principal_remark) || '—')}</div></div>
      </div>

      ${data.showStamp ? `<div class="rc2-stamp-wrap">${stampBlockHtml(data, 68)}</div>` : ''}

      <div class="rc2-signatures">
        <div class="rc2-sig-block"><div class="rc2-sig-line">Class Teacher</div><div>Date: ${new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</div></div>
        <div class="rc2-sig-block"><div class="rc2-sig-line">Principal</div><div>Date: ${new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</div></div>
      </div>

      ${promotedBadgeHtml(data)}

    </div>
  `;
  return { css: css, html: html };
}

/* =========================================================
   2. SCHOLIN MODERN — card-based layout, icon accents, rounded boxes.
   ========================================================= */
export function renderModernTemplate(data, theme) {
  const css = `
    .rc-tpl-modern{ background:${theme.background}; max-width:800px; width:800px; margin:0 auto; padding:28px 32px; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,0.08); font-family:'Inter', sans-serif; color:${theme.textOnBackground}; }
    .rc-tpl-modern .rc2-header{ display:flex; align-items:center; gap:14px; margin-bottom:18px; }
    .rc-tpl-modern .rc2-logo, .rc-tpl-modern .rc2-logo-placeholder{ border-radius:50%; object-fit:cover; }
    .rc-tpl-modern .rc2-logo-placeholder{ background:${theme.primary}; color:${theme.textOnPrimary}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.4rem; }
    .rc-tpl-modern .rc2-school-name{ font-family:'Inter',sans-serif; font-weight:800; font-size:1.5rem; color:${theme.primary}; margin:0; }
    .rc-tpl-modern .rc2-motto{ font-style:italic; color:${theme.secondary}; font-size:0.85rem; font-weight:600; margin:2px 0; }
    .rc-tpl-modern .rc2-address{ font-size:0.74rem; color:#666; }
    .rc-tpl-modern .rc2-title-row{ display:flex; align-items:center; gap:12px; margin-left:auto; }
    .rc-tpl-modern .rc2-title{ font-weight:800; font-size:1.3rem; color:${theme.primary}; }
    .rc-tpl-modern .rc2-session-pill{ background:${theme.primary}; color:${theme.textOnPrimary}; font-size:0.7rem; font-weight:700; padding:4px 12px; border-radius:20px; }
    .rc-tpl-modern .rc2-photo, .rc-tpl-modern .rc2-photo-placeholder{ border-radius:10px; object-fit:cover; margin-left:14px; }
    .rc-tpl-modern .rc2-photo-placeholder{ background:#f0f0f0; display:flex; align-items:center; justify-content:center; color:#999; font-size:0.6rem; text-align:center; }
    .rc-tpl-modern .rc2-bio-card{ background:${theme.tintPrimary}; border-radius:12px; padding:14px 18px; margin-bottom:16px; display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; font-size:0.78rem; }
    .rc-tpl-modern .rc2-bio-item span{ display:block; font-size:0.66rem; color:${theme.primary}; text-transform:uppercase; font-weight:700; letter-spacing:0.03em; }
    .rc-tpl-modern table.rc2-subjects{ width:100%; border-collapse:separate; border-spacing:0; margin-bottom:16px; font-size:0.76rem; border-radius:10px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06); }
    .rc-tpl-modern table.rc2-subjects th{ background:${theme.primary}; color:${theme.textOnPrimary}; padding:9px 8px; font-size:0.68rem; text-transform:uppercase; }
    .rc-tpl-modern table.rc2-subjects td{ padding:8px; text-align:center; border-bottom:1px solid #eee; }
    .rc-tpl-modern table.rc2-subjects .rc2-subject-name{ text-align:left; padding-left:14px; font-weight:600; }
    .rc-tpl-modern .rc2-total-col{ font-weight:800; color:${theme.primary}; }
    .rc-tpl-modern .grade-good{ color:#2F7A4F; font-weight:800; }
    .rc-tpl-modern .grade-poor{ color:${theme.secondary}; font-weight:800; }
    .rc-tpl-modern .rc2-summary-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
    .rc-tpl-modern .rc2-summary-box{ background:#fff; border:1px solid #eee; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,0.05); overflow:hidden; }
    .rc-tpl-modern .rc2-box-title{ font-size:0.66rem; text-transform:uppercase; padding:8px 10px; font-weight:700; }
    .rc-tpl-modern .rc2-summary-box.performance .rc2-box-title{ background:${theme.tintPrimary}; color:${theme.primary}; }
    .rc-tpl-modern .rc2-summary-box.attendance .rc2-box-title{ background:${theme.tintAccent}; color:${theme.primaryDark}; }
    .rc-tpl-modern .rc2-summary-box.cognitive .rc2-box-title{ background:${theme.tintSecondary}; color:${theme.secondary}; }
    .rc-tpl-modern .rc2-summary-box.character .rc2-box-title{ background:#f5f0ff; color:#6b4fa0; }
    .rc-tpl-modern .rc2-box-body{ padding:10px; font-size:0.68rem; }
    .rc-tpl-modern .rc2-skill-row{ display:flex; justify-content:space-between; padding:3px 0; }
    .rc-tpl-modern .rc2-remarks{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
    .rc-tpl-modern .rc2-remark-col{ background:#fff; border:1px solid #eee; border-radius:12px; overflow:hidden; box-shadow:0 1px 6px rgba(0,0,0,0.05); }
    .rc-tpl-modern .rc2-remark-title{ background:${theme.primary}; color:${theme.textOnPrimary}; font-size:0.68rem; text-transform:uppercase; font-weight:700; padding:8px 14px; }
    .rc-tpl-modern .rc2-remark-text{ padding:12px 16px; font-size:0.76rem; line-height:1.5; }
    .rc-tpl-modern .rc2-signatures{ display:flex; justify-content:space-between; margin-top:10px; padding:0 10px; }
    .rc-tpl-modern .rc2-sig-block{ text-align:center; font-size:0.75rem; width:180px; }
    .rc-tpl-modern .rc2-sig-line{ border-top:1px solid #ccc; padding-top:4px; margin-top:20px; }
    .rc-tpl-modern .rc2-footer-bar{ text-align:center; padding:10px; margin-top:16px; font-size:0.7rem; letter-spacing:0.15em; font-weight:700; color:${theme.primary}; border-top:2px solid ${theme.tintPrimary}; }
    .rc-tpl-modern .rc2-stamp-wrap{ display:flex; justify-content:center; margin:-24px 0 6px 0; position:relative; z-index:5; }
    .rc-tpl-modern .rc2-stamp{ object-fit:contain; }
    .rc-tpl-modern .rc2-promoted{ text-align:center; margin-top:14px; }
    .rc-tpl-modern .rc2-promoted-inner{ display:inline-block; border-radius:20px; padding:6px 18px; background:${theme.tintPrimary}; font-size:0.85rem; font-weight:700; color:${theme.primary}; text-transform:uppercase; letter-spacing:0.03em; }
  `;

  const html = `
    <div class="rc-page rc-tpl-modern">
      <div class="rc2-header">
        ${logoBlockHtml(data, 56)}
        <div>
          <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
          ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
          <p class="rc2-address">${escapeHtmlRC(data.school.address || '')}</p>
          <p class="rc2-address">${data.school.phone ? 'Tel: ' + escapeHtmlRC(data.school.phone) : ''}${data.school.phone && data.school.email ? ' | ' : ''}${data.school.email ? 'Email: ' + escapeHtmlRC(data.school.email) : ''}</p>
        </div>
        <div class="rc2-title-row">
          <div><div class="rc2-title">REPORT CARD</div><div class="rc2-session-pill">${escapeHtmlRC(data.sessionName)}</div></div>
        </div>
        ${photoBlockHtml(data, {w:60,h:60})}
      </div>

      <div class="rc2-bio-card">
        <div class="rc2-bio-item"><span>Student's Name</span>${escapeHtmlRC(data.student.full_name).toUpperCase()}</div>
        ${data.showDob ? `<div class="rc2-bio-item"><span>Date of Birth</span>${data.student.dob ? new Date(data.student.dob).toLocaleDateString() : '—'}</div>` : ''}
        <div class="rc2-bio-item"><span>Admission No.</span>${escapeHtmlRC(data.student.admission_no || '—')}</div>
        <div class="rc2-bio-item"><span>Gender</span>${escapeHtmlRC(data.student.gender || '—')}</div>
        <div class="rc2-bio-item"><span>Class</span>${escapeHtmlRC(data.classRow.name)}${data.classRow.arm ? ' ' + escapeHtmlRC(data.classRow.arm) : ''}</div>
        <div class="rc2-bio-item"><span>Term</span>${escapeHtmlRC(data.termName)}</div>
        <div class="rc2-bio-item"><span>Term Ends</span>${data.termRow.term_end_date ? new Date(data.termRow.term_end_date).toLocaleDateString() : '—'}</div>
        <div class="rc2-bio-item" style="grid-column:1 / -1;"><span>Next Term Resumes</span>${data.termRow.next_term_resumes ? new Date(data.termRow.next_term_resumes).toLocaleDateString() : '—'}</div>
      </div>

      <table class="rc2-subjects">
        <thead><tr><th style="text-align:left;">Subjects</th>${buildComponentHeadersHtml(data)}<th>Total<br>(${data.maxPerSubject})</th><th>Grade</th><th>Remarks</th></tr></thead>
        <tbody>${buildSubjectRowsHtml(data)}</tbody>
      </table>

      <div class="rc2-summary-grid">
        ${buildSummaryBoxes(data).map(b => `<div class="rc2-summary-box ${b.key}"><div class="rc2-box-title">${b.title}</div><div class="rc2-box-body">${b.bodyHtml}</div></div>`).join('')}
      </div>

      <div class="rc2-remarks">
        <div class="rc2-remark-col"><div class="rc2-remark-title">Class Teacher's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.class_teacher_remark) || '—')}</div></div>
        <div class="rc2-remark-col"><div class="rc2-remark-title">Principal's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.principal_remark) || '—')}</div></div>
      </div>

      ${data.showStamp ? `<div class="rc2-stamp-wrap">${stampBlockHtml(data, 60)}</div>` : ''}

      <div class="rc2-signatures">
        <div class="rc2-sig-block"><div class="rc2-sig-line">Class Teacher</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
        <div class="rc2-sig-block"><div class="rc2-sig-line">Principal</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
      </div>

      ${promotedBadgeHtml(data)}

    </div>
  `;
  return { css: css, html: html };
}

/* =========================================================
   Report Card — Template Renderers (2 of 4): Royal, British, Prestige
   ========================================================= */

/* =========================================================
   3. SCHOLIN ROYAL — cream and gold, ornate double border.
   ========================================================= */
export function renderRoyalTemplate(data, theme) {
  const css = `
    .rc-tpl-royal{ background:${theme.background}; max-width:800px; width:800px; margin:0 auto; padding:30px 34px; border:3px double ${theme.accent}; border-radius:4px; font-family:'Georgia',serif; color:${theme.textOnBackground}; position:relative; }
    .rc-tpl-royal::before, .rc-tpl-royal::after{ content:''; position:absolute; width:36px; height:36px; border:2px solid ${theme.accent}; }
    .rc-tpl-royal::before{ top:8px; left:8px; border-right:none; border-bottom:none; }
    .rc-tpl-royal::after{ bottom:8px; right:8px; border-left:none; border-top:none; }
    .rc-tpl-royal .rc2-header{ display:flex; align-items:flex-start; gap:16px; margin-bottom:14px; }
    .rc-tpl-royal .rc2-logo, .rc-tpl-royal .rc2-logo-placeholder{ border-radius:50%; object-fit:cover; border:2px solid ${theme.accent}; }
    .rc-tpl-royal .rc2-logo-placeholder{ background:${theme.tintPrimary}; display:flex; align-items:center; justify-content:center; color:${theme.primary}; font-weight:700; font-size:1.6rem; }
    .rc-tpl-royal .rc2-school-info{ flex:1; text-align:center; }
    .rc-tpl-royal .rc2-school-name{ font-weight:700; font-size:1.6rem; color:${theme.primary}; margin:0; letter-spacing:0.03em; }
    .rc-tpl-royal .rc2-motto{ font-style:italic; color:${theme.secondary}; font-size:0.9rem; margin:3px 0; }
    .rc-tpl-royal .rc2-address{ font-size:0.75rem; color:#666; }
    .rc-tpl-royal .rc2-photo, .rc-tpl-royal .rc2-photo-placeholder{ object-fit:cover; border:1px solid #ccc; }
    .rc-tpl-royal .rc2-photo-placeholder{ background:#f5f5f5; display:flex; align-items:center; justify-content:center; color:#999; font-size:0.62rem; text-align:center; }
    .rc-tpl-royal .rc2-title{ text-align:center; font-weight:700; font-size:2.1rem; color:${theme.accent}; letter-spacing:0.1em; margin:6px 0 4px 0; }
    .rc-tpl-royal .rc2-session-pill{ display:block; text-align:center; margin:0 auto 16px auto; width:fit-content; background:${theme.primary}; color:${theme.textOnPrimary}; font-size:0.75rem; padding:4px 18px; border-radius:14px; letter-spacing:0.05em; }
    .rc-tpl-royal .rc2-bio-table{ width:100%; border-collapse:collapse; margin-bottom:16px; font-size:0.78rem; }
    .rc-tpl-royal .rc2-bio-table td{ padding:7px 12px; border:1px solid ${theme.accent}55; }
    .rc-tpl-royal .rc2-bio-table td.label{ background:${theme.tintAccent}; font-weight:700; width:22%; }
    .rc-tpl-royal .rc2-bio-table td.val{ background:#fff; }
    .rc-tpl-royal table.rc2-subjects{ width:100%; border-collapse:collapse; margin-bottom:16px; font-size:0.76rem; }
    .rc-tpl-royal table.rc2-subjects th, .rc-tpl-royal table.rc2-subjects td{ border:1px solid ${theme.accent}55; padding:7px 6px; text-align:center; }
    .rc-tpl-royal table.rc2-subjects th{ background:${theme.primary}; color:${theme.textOnPrimary}; font-size:0.68rem; text-transform:uppercase; }
    .rc-tpl-royal table.rc2-subjects .rc2-subject-name{ text-align:left; padding-left:12px; }
    .rc-tpl-royal .rc2-total-col{ font-weight:800; color:${theme.primary}; }
    .rc-tpl-royal .grade-good{ color:#2F7A4F; font-weight:800; }
    .rc-tpl-royal .grade-poor{ color:${theme.secondary}; font-weight:800; }
    .rc-tpl-royal .rc2-summary-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px; }
    .rc-tpl-royal .rc2-summary-box{ border:1px solid ${theme.accent}55; border-radius:4px; background:#fff; }
    .rc-tpl-royal .rc2-box-title{ color:${theme.primary}; font-size:0.66rem; text-transform:uppercase; padding:6px 8px; font-weight:700; text-align:center; border-bottom:1px solid ${theme.accent}55; background:${theme.tintAccent}; }
    .rc-tpl-royal .rc2-box-body{ padding:8px 10px; font-size:0.68rem; }
    .rc-tpl-royal .rc2-skill-row{ display:flex; justify-content:space-between; padding:2.5px 0; }
    .rc-tpl-royal .rc2-remarks{ display:grid; grid-template-columns:1fr 1fr; border:1px solid ${theme.accent}55; border-radius:4px; overflow:hidden; margin-bottom:16px; }
    .rc-tpl-royal .rc2-remark-title{ color:${theme.primary}; font-size:0.68rem; text-transform:uppercase; font-weight:700; padding:6px 14px; text-align:center; background:${theme.tintAccent}; border-bottom:1px solid ${theme.accent}55; }
    .rc-tpl-royal .rc2-remark-text{ padding:10px 16px; line-height:1.5; font-size:0.74rem; }
    .rc-tpl-royal .rc2-signatures{ display:flex; justify-content:space-between; align-items:flex-end; padding:0 10px; position:relative; }
    .rc-tpl-royal .rc2-seal{ width:52px; height:52px; border-radius:50%; background:${theme.accent}; color:${theme.textOnAccent}; display:flex; align-items:center; justify-content:center; font-size:0.6rem; text-align:center; font-weight:700; }
    .rc-tpl-royal .rc2-sig-block{ text-align:center; font-size:0.75rem; width:160px; }
    .rc-tpl-royal .rc2-sig-line{ border-top:1px solid #777; padding-top:4px; margin-top:16px; }
    .rc-tpl-royal .rc2-footer-bar{ text-align:center; padding:8px; margin-top:18px; font-size:0.72rem; letter-spacing:0.18em; font-weight:700; color:${theme.primary}; border-top:2px double ${theme.accent}; }
    .rc-tpl-royal .rc2-promoted{ text-align:center; margin-top:14px; }
    .rc-tpl-royal .rc2-promoted-inner{ display:inline-block; border:1.5px solid ${theme.accent}; border-radius:20px; padding:6px 18px; background:#fff; font-size:0.85rem; font-weight:700; color:${theme.primary}; text-transform:uppercase; letter-spacing:0.03em; }
  `;

  const html = `
    <div class="rc-page rc-tpl-royal">
      <div class="rc2-header">
        ${logoBlockHtml(data)}
        <div class="rc2-school-info">
          <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
          ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
          <p class="rc2-address">${escapeHtmlRC(data.school.address || '')}</p>
          <p class="rc2-address">${data.school.phone ? 'Tel: ' + escapeHtmlRC(data.school.phone) : ''}${data.school.phone && data.school.email ? ' | ' : ''}${data.school.email ? 'Email: ' + escapeHtmlRC(data.school.email) : ''}</p>
        </div>
        ${photoBlockHtml(data)}
      </div>
      <div class="rc2-title">REPORT CARD</div>
      <div class="rc2-session-pill">${escapeHtmlRC(data.sessionName)} SESSION</div>

      <table class="rc2-bio-table">
        <tr><td class="label">STUDENT'S NAME:</td><td class="val">${escapeHtmlRC(data.student.full_name).toUpperCase()}</td><td class="label">${data.showDob ? 'DATE OF BIRTH:' : ''}</td><td class="val">${data.showDob ? (data.student.dob ? new Date(data.student.dob).toLocaleDateString() : '—') : ''}</td></tr>
        <tr><td class="label">ADMISSION NO.:</td><td class="val">${escapeHtmlRC(data.student.admission_no || '—')}</td><td class="label">GENDER:</td><td class="val">${escapeHtmlRC(data.student.gender || '—')}</td></tr>
        <tr><td class="label">CLASS:</td><td class="val">${escapeHtmlRC(data.classRow.name)}${data.classRow.arm ? ' ' + escapeHtmlRC(data.classRow.arm) : ''}</td><td class="label">TERM:</td><td class="val">${escapeHtmlRC(data.termName)}</td></tr>
        <tr><td class="label">TERM ENDS:</td><td class="val" colspan="3">${data.termRow.term_end_date ? new Date(data.termRow.term_end_date).toLocaleDateString() : '—'}</td></tr>
        <tr><td class="label">NEXT TERM RESUMES:</td><td class="val" colspan="3">${data.termRow.next_term_resumes ? new Date(data.termRow.next_term_resumes).toLocaleDateString() : '—'}</td></tr>
      </table>

      <table class="rc2-subjects">
        <thead><tr><th style="text-align:left;">SUBJECTS</th>${buildComponentHeadersHtml(data)}<th>TOTAL<br>(${data.maxPerSubject})</th><th>GRADE</th><th>REMARKS</th></tr></thead>
        <tbody>${buildSubjectRowsHtml(data)}</tbody>
      </table>

      <div class="rc2-summary-grid">
        ${buildSummaryBoxes(data).map(b => `<div class="rc2-summary-box"><div class="rc2-box-title">${b.title}</div><div class="rc2-box-body">${b.bodyHtml}</div></div>`).join('')}
      </div>

      <div class="rc2-remarks">
        <div class="rc2-remark-col"><div class="rc2-remark-title">Class Teacher's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.class_teacher_remark) || '—')}</div></div>
        <div class="rc2-remark-col"><div class="rc2-remark-title">Principal's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.principal_remark) || '—')}</div></div>
      </div>

      <div class="rc2-signatures">
        <div class="rc2-sig-block"><div class="rc2-sig-line">Class Teacher</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
        ${data.showStamp ? stampBlockHtml(data, 52) : '<div class="rc2-seal">SEAL</div>'}
        <div class="rc2-sig-block"><div class="rc2-sig-line">Principal</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
      </div>

      ${promotedBadgeHtml(data)}

    </div>
  `;
  return { css: css, html: html };
}

/* =========================================================
   4. SCHOLIN BRITISH — formal boxed academic style, everything in a frame.
   ========================================================= */
export function renderBritishTemplate(data, theme) {
  const css = `
    .rc-tpl-british{ background:${theme.background}; max-width:800px; width:800px; margin:0 auto; padding:26px; border:1px solid ${theme.primary}; font-family:'Georgia',serif; color:${theme.textOnBackground}; }
    .rc-tpl-british .rc2-header{ display:flex; align-items:center; gap:14px; border:1px solid ${theme.primary}; padding:12px 16px; margin-bottom:14px; }
    .rc-tpl-british .rc2-logo, .rc-tpl-british .rc2-logo-placeholder{ object-fit:cover; }
    .rc-tpl-british .rc2-logo-placeholder{ background:${theme.tintPrimary}; display:flex; align-items:center; justify-content:center; color:${theme.primary}; font-weight:700; font-size:1.5rem; }
    .rc-tpl-british .rc2-school-name{ font-weight:700; font-size:1.35rem; color:${theme.primary}; margin:0; }
    .rc-tpl-british .rc2-motto{ font-style:italic; color:${theme.secondary}; font-size:0.82rem; }
    .rc-tpl-british .rc2-address{ font-size:0.72rem; color:#555; }
    .rc-tpl-british .rc2-title-block{ margin-left:auto; text-align:right; }
    .rc-tpl-british .rc2-title{ font-weight:700; font-size:1.5rem; color:${theme.primary}; }
    .rc-tpl-british .rc2-session-pill{ display:inline-block; background:${theme.primary}; color:${theme.textOnPrimary}; font-size:0.68rem; padding:2px 10px; border-radius:3px; margin-top:2px; }
    .rc-tpl-british .rc2-bio-frame{ border:1px solid ${theme.primary}; margin-bottom:14px; display:flex; }
    .rc-tpl-british .rc2-bio-table{ width:100%; border-collapse:collapse; font-size:0.78rem; flex:1; }
    .rc-tpl-british .rc2-bio-table td{ padding:6px 10px; border:1px solid ${theme.border}; }
    .rc-tpl-british .rc2-bio-table td.label{ font-weight:700; width:22%; }
    .rc-tpl-british .rc2-photo, .rc-tpl-british .rc2-photo-placeholder{ object-fit:cover; border-left:1px solid ${theme.primary}; }
    .rc-tpl-british .rc2-photo-placeholder{ background:#f5f5f5; display:flex; align-items:center; justify-content:center; color:#999; font-size:0.6rem; text-align:center; }
    .rc-tpl-british table.rc2-subjects{ width:100%; border-collapse:collapse; margin-bottom:14px; font-size:0.76rem; border:1px solid ${theme.primary}; }
    .rc-tpl-british table.rc2-subjects th, .rc-tpl-british table.rc2-subjects td{ border:1px solid ${theme.border}; padding:6px; text-align:center; }
    .rc-tpl-british table.rc2-subjects th{ background:${theme.primary}; color:${theme.textOnPrimary}; font-size:0.66rem; text-transform:uppercase; }
    .rc-tpl-british table.rc2-subjects .rc2-subject-name{ text-align:left; padding-left:10px; }
    .rc-tpl-british .rc2-total-col{ font-weight:800; }
    .rc-tpl-british .grade-good{ color:#2F7A4F; font-weight:800; }
    .rc-tpl-british .grade-poor{ color:${theme.secondary}; font-weight:800; }
    .rc-tpl-british .rc2-summary-grid{ display:grid; grid-template-columns:repeat(4,1fr); border:1px solid ${theme.primary}; margin-bottom:14px; }
    .rc-tpl-british .rc2-summary-box{ border-right:1px solid ${theme.border}; }
    .rc-tpl-british .rc2-summary-box:last-child{ border-right:none; }
    .rc-tpl-british .rc2-box-title{ font-size:0.64rem; text-transform:uppercase; padding:6px 8px; font-weight:700; text-align:center; background:${theme.tintPrimary}; border-bottom:1px solid ${theme.border}; }
    .rc-tpl-british .rc2-box-body{ padding:7px 9px; font-size:0.66rem; }
    .rc-tpl-british .rc2-skill-row{ display:flex; justify-content:space-between; padding:2px 0; }
    .rc-tpl-british .rc2-remarks{ display:grid; grid-template-columns:1fr 1fr; border:1px solid ${theme.primary}; margin-bottom:14px; }
    .rc-tpl-british .rc2-remark-col{ border-right:1px solid ${theme.border}; }
    .rc-tpl-british .rc2-remark-col:last-child{ border-right:none; }
    .rc-tpl-british .rc2-remark-title{ font-size:0.66rem; text-transform:uppercase; font-weight:700; padding:6px 12px; background:${theme.tintPrimary}; border-bottom:1px solid ${theme.border}; }
    .rc-tpl-british .rc2-remark-text{ padding:9px 12px; line-height:1.5; font-size:0.72rem; }
    .rc-tpl-british .rc2-signatures{ display:flex; justify-content:space-between; padding:0 10px; margin-top:14px; }
    .rc-tpl-british .rc2-sig-block{ text-align:center; font-size:0.72rem; width:170px; }
    .rc-tpl-british .rc2-sig-line{ border-top:1px solid #555; padding-top:4px; margin-top:18px; }
    .rc-tpl-british .rc2-footer-bar{ text-align:center; padding:7px; margin-top:16px; font-size:0.68rem; letter-spacing:0.15em; font-weight:700; border-top:1px solid ${theme.primary}; border-bottom:1px solid ${theme.primary}; color:${theme.primary}; }
    .rc-tpl-british .rc2-stamp-wrap{ display:flex; justify-content:center; margin:6px 0; }
    .rc-tpl-british .rc2-stamp{ object-fit:contain; }
    .rc-tpl-british .rc2-promoted{ text-align:center; margin-top:12px; }
    .rc-tpl-british .rc2-promoted-inner{ display:inline-block; border:1px solid ${theme.primary}; padding:5px 16px; font-size:0.8rem; font-weight:700; color:${theme.primary}; text-transform:uppercase; letter-spacing:0.03em; }
  `;

  const html = `
    <div class="rc-page rc-tpl-british">
      <div class="rc2-header">
        ${logoBlockHtml(data, 60)}
        <div>
          <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
          ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
          <p class="rc2-address">${escapeHtmlRC(data.school.address || '')}</p>
          <p class="rc2-address">${data.school.phone ? 'Tel: ' + escapeHtmlRC(data.school.phone) : ''}${data.school.phone && data.school.email ? ' | ' : ''}${data.school.email ? 'Email: ' + escapeHtmlRC(data.school.email) : ''}</p>
        </div>
        <div class="rc2-title-block">
          <div class="rc2-title">REPORT CARD</div>
          <div class="rc2-session-pill">${escapeHtmlRC(data.sessionName)}</div>
        </div>
      </div>

      <div class="rc2-bio-frame">
        <table class="rc2-bio-table">
          <tr><td class="label">Student's Name</td><td>${escapeHtmlRC(data.student.full_name).toUpperCase()}</td><td class="label">${data.showDob ? 'Date of Birth' : ''}</td><td>${data.showDob ? (data.student.dob ? new Date(data.student.dob).toLocaleDateString() : '—') : ''}</td></tr>
          <tr><td class="label">Admission No.</td><td>${escapeHtmlRC(data.student.admission_no || '—')}</td><td class="label">Gender</td><td>${escapeHtmlRC(data.student.gender || '—')}</td></tr>
          <tr><td class="label">Class</td><td>${escapeHtmlRC(data.classRow.name)}${data.classRow.arm ? ' ' + escapeHtmlRC(data.classRow.arm) : ''}</td><td class="label">Term</td><td>${escapeHtmlRC(data.termName)}</td></tr>
          <tr><td class="label">Term Ends</td><td colspan="3">${data.termRow.term_end_date ? new Date(data.termRow.term_end_date).toLocaleDateString() : '—'}</td></tr>
          <tr><td class="label">Next Term Resumes</td><td colspan="3">${data.termRow.next_term_resumes ? new Date(data.termRow.next_term_resumes).toLocaleDateString() : '—'}</td></tr>
        </table>
        ${photoBlockHtml(data, {w:80,h:96})}
      </div>

      <table class="rc2-subjects">
        <thead><tr><th style="text-align:left;">Subjects</th>${buildComponentHeadersHtml(data)}<th>Total<br>(${data.maxPerSubject})</th><th>Grade</th><th>Remarks</th></tr></thead>
        <tbody>${buildSubjectRowsHtml(data)}</tbody>
      </table>

      <div class="rc2-summary-grid">
        ${buildSummaryBoxes(data).map(b => `<div class="rc2-summary-box"><div class="rc2-box-title">${b.title}</div><div class="rc2-box-body">${b.bodyHtml}</div></div>`).join('')}
      </div>

      <div class="rc2-remarks">
        <div class="rc2-remark-col"><div class="rc2-remark-title">Class Teacher's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.class_teacher_remark) || '—')}</div></div>
        <div class="rc2-remark-col"><div class="rc2-remark-title">Principal's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.principal_remark) || '—')}</div></div>
      </div>

      ${data.showStamp ? `<div class="rc2-stamp-wrap">${stampBlockHtml(data, 56)}</div>` : ''}

      <div class="rc2-signatures">
        <div class="rc2-sig-block"><div class="rc2-sig-line">Class Teacher</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
        <div class="rc2-sig-block"><div class="rc2-sig-line">Principal</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
      </div>

      ${promotedBadgeHtml(data)}

    </div>
  `;
  return { css: css, html: html };
}

/* =========================================================
   5. SCHOLIN PRESTIGE — dark sidebar crest, luxury certificate feel.
   ========================================================= */
export function renderPrestigeTemplate(data, theme) {
  const css = `
    .rc-tpl-prestige{ background:${theme.background}; max-width:800px; width:800px; margin:0 auto; display:flex; border:1px solid ${theme.border}; border-radius:6px; overflow:hidden; font-family:'Georgia',serif; color:${theme.textOnBackground}; }
    .rc-tpl-prestige .rc2-sidebar{ width:190px; flex-shrink:0; background:${theme.primary}; color:${theme.textOnPrimary}; padding:26px 18px; text-align:center; }
    .rc-tpl-prestige .rc2-logo, .rc-tpl-prestige .rc2-logo-placeholder{ border-radius:50%; object-fit:cover; margin:0 auto 14px auto; border:2px solid ${theme.accent}; }
    .rc-tpl-prestige .rc2-logo-placeholder{ background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.8rem; }
    .rc-tpl-prestige .rc2-school-name{ font-weight:700; font-size:1.2rem; margin:0 0 6px 0; line-height:1.3; }
    .rc-tpl-prestige .rc2-motto{ font-style:italic; color:${theme.accent}; font-size:0.78rem; margin-bottom:10px; }
    .rc-tpl-prestige .rc2-address{ font-size:0.68rem; opacity:0.85; margin:2px 0; }
    .rc-tpl-prestige .rc2-photo, .rc-tpl-prestige .rc2-photo-placeholder{ object-fit:cover; margin:16px auto 0 auto; border:2px solid ${theme.accent}; }
    .rc-tpl-prestige .rc2-photo-placeholder{ background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.6); font-size:0.6rem; text-align:center; }
    .rc-tpl-prestige .rc2-main{ flex:1; padding:26px 28px; }
    .rc-tpl-prestige .rc2-title{ font-weight:700; font-size:1.9rem; color:${theme.primary}; letter-spacing:0.05em; margin-bottom:2px; }
    .rc-tpl-prestige .rc2-session{ font-size:0.8rem; color:${theme.secondary}; font-weight:700; margin-bottom:16px; }
    .rc-tpl-prestige .rc2-bio-table{ width:100%; border-collapse:collapse; margin-bottom:14px; font-size:0.76rem; }
    .rc-tpl-prestige .rc2-bio-table td{ padding:6px 0; border-bottom:1px solid ${theme.border}; }
    .rc-tpl-prestige .rc2-bio-table td.label{ font-weight:700; color:${theme.primary}; width:32%; }
    .rc-tpl-prestige table.rc2-subjects{ width:100%; border-collapse:collapse; margin-bottom:14px; font-size:0.74rem; }
    .rc-tpl-prestige table.rc2-subjects th, .rc-tpl-prestige table.rc2-subjects td{ padding:7px 6px; text-align:center; border-bottom:1px solid ${theme.border}; }
    .rc-tpl-prestige table.rc2-subjects th{ background:${theme.tintPrimary}; color:${theme.primary}; font-size:0.66rem; text-transform:uppercase; border-top:2px solid ${theme.accent}; border-bottom:2px solid ${theme.accent}; }
    .rc-tpl-prestige table.rc2-subjects .rc2-subject-name{ text-align:left; }
    .rc-tpl-prestige .rc2-total-col{ font-weight:800; color:${theme.primary}; }
    .rc-tpl-prestige .grade-good{ color:#2F7A4F; font-weight:800; }
    .rc-tpl-prestige .grade-poor{ color:${theme.secondary}; font-weight:800; }
    .rc-tpl-prestige .rc2-summary-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
    .rc-tpl-prestige .rc2-summary-box{ border-left:3px solid ${theme.accent}; padding:8px 12px; background:${theme.tintPrimary}; }
    .rc-tpl-prestige .rc2-box-title{ font-size:0.64rem; text-transform:uppercase; font-weight:700; color:${theme.primary}; margin-bottom:4px; }
    .rc-tpl-prestige .rc2-skill-row{ display:flex; justify-content:space-between; font-size:0.68rem; padding:1.5px 0; }
    .rc-tpl-prestige .rc2-remarks{ margin-bottom:14px; }
    .rc-tpl-prestige .rc2-remark-col{ margin-bottom:8px; }
    .rc-tpl-prestige .rc2-remark-title{ font-size:0.64rem; text-transform:uppercase; font-weight:700; color:${theme.primary}; margin-bottom:2px; }
    .rc-tpl-prestige .rc2-remark-text{ font-size:0.72rem; line-height:1.5; padding-left:10px; border-left:2px solid ${theme.accent}; }
    .rc-tpl-prestige .rc2-signatures{ display:flex; justify-content:space-between; margin-top:16px; }
    .rc-tpl-prestige .rc2-sig-block{ text-align:center; font-size:0.72rem; width:160px; }
    .rc-tpl-prestige .rc2-sig-line{ border-top:1px solid #999; padding-top:4px; margin-top:16px; }
    .rc-tpl-prestige .rc2-footer-bar{ text-align:center; font-size:0.64rem; letter-spacing:0.16em; font-weight:700; color:${theme.accent}; margin-top:16px; }
    .rc-tpl-prestige .rc2-stamp-wrap{ display:flex; justify-content:center; margin:6px 0; }
    .rc-tpl-prestige .rc2-stamp{ object-fit:contain; }
    .rc-tpl-prestige .rc2-promoted{ text-align:center; margin-top:12px; }
    .rc-tpl-prestige .rc2-promoted-inner{ display:inline-block; border-left:3px solid ${theme.accent}; padding:5px 16px; font-size:0.78rem; font-weight:700; color:${theme.primary}; text-transform:uppercase; letter-spacing:0.03em; background:${theme.tintPrimary}; }
  `;

  const html = `
    <div class="rc-page rc-tpl-prestige">
      <div class="rc2-sidebar">
        ${logoBlockHtml(data, 70)}
        <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
        ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
        <p class="rc2-address">${escapeHtmlRC(data.school.address || '')}</p>
        <p class="rc2-address">${escapeHtmlRC(data.school.phone || '')}</p>
        <p class="rc2-address">${escapeHtmlRC(data.school.email || '')}</p>
        ${photoBlockHtml(data, {w:76,h:92})}
      </div>
      <div class="rc2-main">
        <div class="rc2-title">REPORT CARD</div>
        <div class="rc2-session">${escapeHtmlRC(data.sessionName)} SESSION &middot; ${escapeHtmlRC(data.termName)}</div>

        <table class="rc2-bio-table">
          <tr><td class="label">Student's Name</td><td>${escapeHtmlRC(data.student.full_name).toUpperCase()}</td></tr>
          <tr><td class="label">Admission No.</td><td>${escapeHtmlRC(data.student.admission_no || '—')}</td></tr>
          <tr><td class="label">Class</td><td>${escapeHtmlRC(data.classRow.name)}${data.classRow.arm ? ' ' + escapeHtmlRC(data.classRow.arm) : ''}</td></tr>
          ${data.showDob ? `<tr><td class="label">Date of Birth</td><td>${data.student.dob ? new Date(data.student.dob).toLocaleDateString() : '—'}</td></tr>` : ''}
          <tr><td class="label">Gender</td><td>${escapeHtmlRC(data.student.gender || '—')}</td></tr>
          <tr><td class="label">Term Ends</td><td>${data.termRow.term_end_date ? new Date(data.termRow.term_end_date).toLocaleDateString() : '—'}</td></tr>
          <tr><td class="label">Next Term Resumes</td><td>${data.termRow.next_term_resumes ? new Date(data.termRow.next_term_resumes).toLocaleDateString() : '—'}</td></tr>
        </table>

        <table class="rc2-subjects">
          <thead><tr><th style="text-align:left;">Subject</th>${buildComponentHeadersHtml(data)}<th>Total<br>(${data.maxPerSubject})</th><th>Grade</th><th>Remarks</th></tr></thead>
          <tbody>${buildSubjectRowsHtml(data)}</tbody>
        </table>

        <div class="rc2-summary-grid">
          ${buildSummaryBoxes(data).map(b => `<div class="rc2-summary-box"><div class="rc2-box-title">${b.title}</div>${b.bodyHtml}</div>`).join('')}
        </div>

        <div class="rc2-remarks">
          <div class="rc2-remark-col"><div class="rc2-remark-title">Class Teacher's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.class_teacher_remark) || '—')}</div></div>
          <div class="rc2-remark-col"><div class="rc2-remark-title">Principal's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.principal_remark) || '—')}</div></div>
        </div>

        ${data.showStamp ? `<div class="rc2-stamp-wrap">${stampBlockHtml(data, 54)}</div>` : ''}

        <div class="rc2-signatures">
          <div class="rc2-sig-block"><div class="rc2-sig-line">Class Teacher</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
          <div class="rc2-sig-block"><div class="rc2-sig-line">Principal</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
        </div>

        ${promotedBadgeHtml(data)}

      </div>
    </div>
  `;
  return { css: css, html: html };
}

/* =========================================================
   Report Card — Template Renderers (3 of 4): Minimal, Primary, Monochrome
   ========================================================= */

/* =========================================================
   6. SCHOLIN MINIMAL — clean, spacious, distraction-free white layout.
   ========================================================= */
export function renderMinimalTemplate(data, theme) {
  const css = `
    .rc-tpl-minimal{ background:${theme.background}; max-width:800px; width:800px; margin:0 auto; padding:40px 44px; font-family:'Inter', sans-serif; color:${theme.textOnBackground}; }
    .rc-tpl-minimal .rc2-header{ display:flex; align-items:center; gap:16px; margin-bottom:28px; }
    .rc-tpl-minimal .rc2-logo, .rc-tpl-minimal .rc2-logo-placeholder{ border-radius:8px; object-fit:cover; }
    .rc-tpl-minimal .rc2-logo-placeholder{ background:${theme.tintPrimary}; display:flex; align-items:center; justify-content:center; color:${theme.primary}; font-weight:700; font-size:1.3rem; }
    .rc-tpl-minimal .rc2-school-name{ font-weight:700; font-size:1.3rem; margin:0; letter-spacing:-0.01em; }
    .rc-tpl-minimal .rc2-motto{ font-size:0.78rem; color:#888; }
    .rc-tpl-minimal .rc2-address{ font-size:0.7rem; color:#999; }
    .rc-tpl-minimal .rc2-title-block{ margin-left:auto; text-align:right; }
    .rc-tpl-minimal .rc2-title{ font-weight:300; font-size:1.5rem; letter-spacing:0.02em; color:#333; }
    .rc-tpl-minimal .rc2-session{ font-size:0.72rem; color:#999; text-transform:uppercase; letter-spacing:0.08em; }
    .rc-tpl-minimal .rc2-photo, .rc-tpl-minimal .rc2-photo-placeholder{ border-radius:8px; object-fit:cover; }
    .rc-tpl-minimal .rc2-photo-placeholder{ background:#f5f5f5; display:flex; align-items:center; justify-content:center; color:#bbb; font-size:0.58rem; text-align:center; }
    .rc-tpl-minimal .rc2-bio-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px 30px; margin-bottom:28px; padding-bottom:24px; border-bottom:1px solid #eee; font-size:0.82rem; }
    .rc-tpl-minimal .rc2-bio-item span{ display:block; font-size:0.66rem; color:#aaa; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px; }
    .rc-tpl-minimal table.rc2-subjects{ width:100%; border-collapse:collapse; margin-bottom:24px; font-size:0.78rem; }
    .rc-tpl-minimal table.rc2-subjects th{ text-align:left; padding:8px 6px; font-size:0.66rem; text-transform:uppercase; color:#999; font-weight:600; border-bottom:2px solid #333; }
    .rc-tpl-minimal table.rc2-subjects td{ padding:10px 6px; border-bottom:1px solid #f0f0f0; text-align:center; }
    .rc-tpl-minimal table.rc2-subjects .rc2-subject-name{ text-align:left; font-weight:600; }
    .rc-tpl-minimal .rc2-total-col{ font-weight:700; }
    .rc-tpl-minimal .grade-good{ color:#2F7A4F; font-weight:700; }
    .rc-tpl-minimal .grade-poor{ color:${theme.secondary}; font-weight:700; }
    .rc-tpl-minimal .rc2-summary-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin-bottom:24px; }
    .rc-tpl-minimal .rc2-box-title{ font-size:0.64rem; text-transform:uppercase; color:#999; letter-spacing:0.05em; margin-bottom:6px; font-weight:600; }
    .rc-tpl-minimal .rc2-skill-row{ display:flex; justify-content:space-between; font-size:0.72rem; padding:2px 0; }
    .rc-tpl-minimal .rc2-remarks{ display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:28px; }
    .rc-tpl-minimal .rc2-remark-title{ font-size:0.64rem; text-transform:uppercase; color:#999; letter-spacing:0.05em; margin-bottom:6px; font-weight:600; }
    .rc-tpl-minimal .rc2-remark-text{ font-size:0.8rem; line-height:1.6; }
    .rc-tpl-minimal .rc2-signatures{ display:flex; justify-content:space-between; margin-top:20px; }
    .rc-tpl-minimal .rc2-sig-block{ text-align:left; font-size:0.74rem; width:170px; }
    .rc-tpl-minimal .rc2-sig-line{ border-top:1px solid #ccc; padding-top:5px; margin-top:24px; color:#999; }
    .rc-tpl-minimal .rc2-footer-bar{ text-align:center; font-size:0.66rem; letter-spacing:0.14em; color:#bbb; margin-top:28px; padding-top:16px; border-top:1px solid #eee; }
    .rc-tpl-minimal .rc2-stamp-wrap{ display:flex; justify-content:center; margin:10px 0; }
    .rc-tpl-minimal .rc2-stamp{ object-fit:contain; opacity:0.85; }
    .rc-tpl-minimal .rc2-promoted{ text-align:center; margin-top:14px; }
    .rc-tpl-minimal .rc2-promoted-inner{ display:inline-block; padding:5px 16px; font-size:0.78rem; font-weight:600; color:#555; border:1px solid #ddd; border-radius:20px; }
  `;

  const html = `
    <div class="rc-page rc-tpl-minimal">
      <div class="rc2-header">
        ${logoBlockHtml(data, 52)}
        <div>
          <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
          ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
          <p class="rc2-address">${escapeHtmlRC(data.school.address || '')}${data.school.phone ? ' · ' + escapeHtmlRC(data.school.phone) : ''}</p>
        </div>
        <div class="rc2-title-block">
          <div class="rc2-title">Report Card</div>
          <div class="rc2-session">${escapeHtmlRC(data.sessionName)} · ${escapeHtmlRC(data.termName)}</div>
        </div>
        ${photoBlockHtml(data, {w:52,h:64})}
      </div>

      <div class="rc2-bio-grid">
        <div class="rc2-bio-item"><span>Student's Name</span>${escapeHtmlRC(data.student.full_name)}</div>
        <div class="rc2-bio-item"><span>Admission No.</span>${escapeHtmlRC(data.student.admission_no || '—')}</div>
        <div class="rc2-bio-item"><span>Class</span>${escapeHtmlRC(data.classRow.name)}${data.classRow.arm ? ' ' + escapeHtmlRC(data.classRow.arm) : ''}</div>
        ${data.showDob ? `<div class="rc2-bio-item"><span>Date of Birth</span>${data.student.dob ? new Date(data.student.dob).toLocaleDateString() : '—'}</div>` : ''}
        <div class="rc2-bio-item"><span>Gender</span>${escapeHtmlRC(data.student.gender || '—')}</div>
        <div class="rc2-bio-item"><span>Term Ends</span>${data.termRow.term_end_date ? new Date(data.termRow.term_end_date).toLocaleDateString() : '—'}</div>
        <div class="rc2-bio-item"><span>Next Term Resumes</span>${data.termRow.next_term_resumes ? new Date(data.termRow.next_term_resumes).toLocaleDateString() : '—'}</div>
      </div>

      <table class="rc2-subjects">
        <thead><tr><th>Subject</th>${buildComponentHeadersHtml(data)}<th>Total (${data.maxPerSubject})</th><th>Grade</th><th>Remarks</th></tr></thead>
        <tbody>${buildSubjectRowsHtml(data)}</tbody>
      </table>

      <div class="rc2-summary-grid">
        ${buildSummaryBoxes(data).map(b => `<div><div class="rc2-box-title">${b.title}</div>${b.bodyHtml}</div>`).join('')}
      </div>

      <div class="rc2-remarks">
        <div><div class="rc2-remark-title">Class Teacher's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.class_teacher_remark) || '—')}</div></div>
        <div><div class="rc2-remark-title">Principal's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.principal_remark) || '—')}</div></div>
      </div>

      ${data.showStamp ? `<div class="rc2-stamp-wrap">${stampBlockHtml(data, 48)}</div>` : ''}

      <div class="rc2-signatures">
        <div class="rc2-sig-block"><div class="rc2-sig-line">Class Teacher — ${new Date().toLocaleDateString()}</div></div>
        <div class="rc2-sig-block"><div class="rc2-sig-line">Principal — ${new Date().toLocaleDateString()}</div></div>
      </div>

      ${promotedBadgeHtml(data)}

    </div>
  `;
  return { css: css, html: html };
}

/* =========================================================
   7. SCHOLIN PRIMARY — bright, friendly, icon-rich, suits nursery/primary.
   ========================================================= */
export function renderPrimaryTemplate(data, theme) {
  const css = `
    .rc-tpl-primary{ background:${theme.background}; max-width:800px; width:800px; margin:0 auto; padding:26px 30px; border:4px dashed ${theme.accent}; border-radius:20px; font-family:'Inter', sans-serif; color:${theme.textOnBackground}; }
    .rc-tpl-primary .rc2-header{ display:flex; align-items:center; gap:14px; background:${theme.tintPrimary}; border-radius:16px; padding:14px 18px; margin-bottom:16px; }
    .rc-tpl-primary .rc2-logo, .rc-tpl-primary .rc2-logo-placeholder{ border-radius:50%; object-fit:cover; border:3px solid ${theme.accent}; }
    .rc-tpl-primary .rc2-logo-placeholder{ background:#fff; display:flex; align-items:center; justify-content:center; color:${theme.primary}; font-weight:800; font-size:1.5rem; }
    .rc-tpl-primary .rc2-school-name{ font-weight:800; font-size:1.4rem; color:${theme.primary}; margin:0; }
    .rc-tpl-primary .rc2-motto{ font-style:italic; color:${theme.secondary}; font-size:0.82rem; font-weight:600; }
    .rc-tpl-primary .rc2-address{ font-size:0.7rem; color:#666; }
    .rc-tpl-primary .rc2-title{ text-align:center; font-weight:800; font-size:1.9rem; margin:6px 0; background:linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.accent}); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.04em; }
    .rc-tpl-primary .rc2-session-pill{ display:block; text-align:center; width:fit-content; margin:0 auto 16px auto; background:${theme.accent}; color:${theme.textOnAccent}; font-weight:700; font-size:0.75rem; padding:5px 18px; border-radius:20px; }
    .rc-tpl-primary .rc2-bio-table{ width:100%; border-collapse:separate; border-spacing:4px; margin-bottom:16px; font-size:0.78rem; }
    .rc-tpl-primary .rc2-bio-table td{ padding:8px 12px; border-radius:8px; }
    .rc-tpl-primary .rc2-bio-table td.label{ background:${theme.tintAccent}; font-weight:700; width:22%; }
    .rc-tpl-primary .rc2-bio-table td.val{ background:#fff; border:1px solid #eee; }
    .rc-tpl-primary table.rc2-subjects{ width:100%; border-collapse:separate; border-spacing:0 4px; margin-bottom:16px; font-size:0.76rem; }
    .rc-tpl-primary table.rc2-subjects th{ background:${theme.primary}; color:${theme.textOnPrimary}; padding:8px 6px; font-size:0.68rem; text-transform:uppercase; }
    .rc-tpl-primary table.rc2-subjects th:first-child{ border-radius:10px 0 0 10px; }
    .rc-tpl-primary table.rc2-subjects th:last-child{ border-radius:0 10px 10px 0; }
    .rc-tpl-primary table.rc2-subjects td{ background:#fff; padding:8px; text-align:center; border-top:1px solid #eee; border-bottom:1px solid #eee; }
    .rc-tpl-primary table.rc2-subjects .rc2-subject-name{ text-align:left; padding-left:14px; font-weight:700; border-radius:10px 0 0 10px; border-left:1px solid #eee; }
    .rc-tpl-primary table.rc2-subjects td:last-child{ border-radius:0 10px 10px 0; border-right:1px solid #eee; }
    .rc-tpl-primary .rc2-total-col{ font-weight:800; color:${theme.primary}; }
    .rc-tpl-primary .grade-good{ color:#2F7A4F; font-weight:800; }
    .rc-tpl-primary .grade-poor{ color:${theme.secondary}; font-weight:800; }
    .rc-tpl-primary .rc2-summary-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px; }
    .rc-tpl-primary .rc2-summary-box{ border-radius:14px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
    .rc-tpl-primary .rc2-box-title{ color:#fff; font-size:0.64rem; text-transform:uppercase; padding:7px 8px; font-weight:700; text-align:center; }
    .rc-tpl-primary .rc2-summary-box:nth-child(1) .rc2-box-title{ background:${theme.primary}; }
    .rc-tpl-primary .rc2-summary-box:nth-child(2) .rc2-box-title{ background:#2F9E6E; }
    .rc-tpl-primary .rc2-summary-box:nth-child(3) .rc2-box-title{ background:${theme.secondary}; }
    .rc-tpl-primary .rc2-summary-box:nth-child(4) .rc2-box-title{ background:${theme.accent}; color:${theme.textOnAccent}; }
    .rc-tpl-primary .rc2-box-body{ padding:8px 10px; font-size:0.68rem; background:#fff; }
    .rc-tpl-primary .rc2-skill-row{ display:flex; justify-content:space-between; padding:2.5px 0; }
    .rc-tpl-primary .rc2-remarks{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
    .rc-tpl-primary .rc2-remark-col{ border-radius:14px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
    .rc-tpl-primary .rc2-remark-title{ color:#fff; font-size:0.66rem; text-transform:uppercase; font-weight:700; padding:7px 14px; }
    .rc-tpl-primary .rc2-remark-col:first-child .rc2-remark-title{ background:${theme.primary}; }
    .rc-tpl-primary .rc2-remark-col:last-child .rc2-remark-title{ background:${theme.secondary}; }
    .rc-tpl-primary .rc2-remark-text{ padding:10px 14px; background:#fff; line-height:1.5; font-size:0.74rem; }
    .rc-tpl-primary .rc2-signatures{ display:flex; justify-content:space-between; margin-top:12px; padding:0 14px; }
    .rc-tpl-primary .rc2-sig-block{ text-align:center; font-size:0.72rem; width:160px; }
    .rc-tpl-primary .rc2-sig-line{ border-top:2px dotted ${theme.accent}; padding-top:4px; margin-top:20px; }
    .rc-tpl-primary .rc2-footer-bar{ text-align:center; padding:8px; margin-top:14px; font-size:0.7rem; letter-spacing:0.12em; font-weight:700; color:#fff; background:linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.accent}); border-radius:12px; }
    .rc-tpl-primary .rc2-stamp-wrap{ display:flex; justify-content:center; margin:8px 0; }
    .rc-tpl-primary .rc2-stamp{ object-fit:contain; }
    .rc-tpl-primary .rc2-promoted{ text-align:center; margin-top:12px; }
    .rc-tpl-primary .rc2-promoted-inner{ display:inline-block; border-radius:20px; padding:6px 16px; background:${theme.tintAccent}; font-size:0.8rem; font-weight:800; color:${theme.primary}; text-transform:uppercase; letter-spacing:0.03em; }
  `;

  const html = `
    <div class="rc-page rc-tpl-primary">
      <div class="rc2-header">
        ${logoBlockHtml(data, 60)}
        <div>
          <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
          ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
          <p class="rc2-address">${escapeHtmlRC(data.school.address || '')}</p>
          <p class="rc2-address">${data.school.phone ? 'Tel: ' + escapeHtmlRC(data.school.phone) : ''}${data.school.phone && data.school.email ? ' | ' : ''}${data.school.email ? 'Email: ' + escapeHtmlRC(data.school.email) : ''}</p>
        </div>
        ${photoBlockHtml(data, {w:56,h:56})}
      </div>
      <div class="rc2-title">REPORT CARD</div>
      <div class="rc2-session-pill">${escapeHtmlRC(data.sessionName)} SESSION</div>

      <table class="rc2-bio-table">
        <tr><td class="label">Student's Name</td><td class="val">${escapeHtmlRC(data.student.full_name)}</td><td class="label">${data.showDob ? 'Date of Birth' : ''}</td><td class="val">${data.showDob ? (data.student.dob ? new Date(data.student.dob).toLocaleDateString() : '—') : ''}</td></tr>
        <tr><td class="label">Admission No.</td><td class="val">${escapeHtmlRC(data.student.admission_no || '—')}</td><td class="label">Gender</td><td class="val">${escapeHtmlRC(data.student.gender || '—')}</td></tr>
        <tr><td class="label">Class</td><td class="val">${escapeHtmlRC(data.classRow.name)}${data.classRow.arm ? ' ' + escapeHtmlRC(data.classRow.arm) : ''}</td><td class="label">Term</td><td class="val">${escapeHtmlRC(data.termName)}</td></tr>
        <tr><td class="label">Term Ends</td><td class="val" colspan="3">${data.termRow.term_end_date ? new Date(data.termRow.term_end_date).toLocaleDateString() : '—'}</td></tr>
        <tr><td class="label">Next Term Resumes</td><td class="val" colspan="3">${data.termRow.next_term_resumes ? new Date(data.termRow.next_term_resumes).toLocaleDateString() : '—'}</td></tr>
      </table>

      <table class="rc2-subjects">
        <thead><tr><th style="text-align:left;">Subjects</th>${buildComponentHeadersHtml(data)}<th>Total (${data.maxPerSubject})</th><th>Grade</th><th>Remarks</th></tr></thead>
        <tbody>${buildSubjectRowsHtml(data)}</tbody>
      </table>

      <div class="rc2-summary-grid">
        ${buildSummaryBoxes(data).map(b => `<div class="rc2-summary-box"><div class="rc2-box-title">${b.title}</div><div class="rc2-box-body">${b.bodyHtml}</div></div>`).join('')}
      </div>

      <div class="rc2-remarks">
        <div class="rc2-remark-col"><div class="rc2-remark-title">Class Teacher's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.class_teacher_remark) || '—')}</div></div>
        <div class="rc2-remark-col"><div class="rc2-remark-title">Principal's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.principal_remark) || '—')}</div></div>
      </div>

      ${data.showStamp ? `<div class="rc2-stamp-wrap">${stampBlockHtml(data, 56)}</div>` : ''}

      <div class="rc2-signatures">
        <div class="rc2-sig-block"><div class="rc2-sig-line">Class Teacher</div><div>${new Date().toLocaleDateString()}</div></div>
        <div class="rc2-sig-block"><div class="rc2-sig-line">Principal</div><div>${new Date().toLocaleDateString()}</div></div>
      </div>

      ${promotedBadgeHtml(data)}

    </div>
  `;
  return { css: css, html: html };
}

/* =========================================================
   8. SCHOLIN BLACK & WHITE — professional monochrome, print-optimized.
   Note: this template renders in monochrome by DESIGN regardless of
   theme colors — its entire purpose is a black-text, white-background,
   gray-border layout for print economy. The separate Black & White
   MODE toggle (which forces monochrome onto any OTHER template) is
   implemented in resolveTheme(), not here.
   ========================================================= */
export function renderMonochromeTemplate(data, theme) {
  const css = `
    .rc-tpl-monochrome{ background:#ffffff; max-width:800px; width:800px; margin:0 auto; padding:30px 34px; border:2px solid #000; font-family:'Georgia',serif; color:#000; }
    .rc-tpl-monochrome .rc2-header{ display:flex; align-items:center; gap:14px; border-bottom:2px solid #000; padding-bottom:12px; margin-bottom:14px; }
    .rc-tpl-monochrome .rc2-logo, .rc-tpl-monochrome .rc2-logo-placeholder{ border-radius:50%; object-fit:cover; border:1px solid #000; filter:grayscale(100%); }
    .rc-tpl-monochrome .rc2-logo-placeholder{ background:#f2f2f2; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.5rem; }
    .rc-tpl-monochrome .rc2-school-name{ font-weight:700; font-size:1.5rem; margin:0; }
    .rc-tpl-monochrome .rc2-motto{ font-style:italic; font-size:0.82rem; color:#333; }
    .rc-tpl-monochrome .rc2-address{ font-size:0.72rem; color:#444; }
    .rc-tpl-monochrome .rc2-title-block{ margin-left:auto; text-align:right; }
    .rc-tpl-monochrome .rc2-title{ font-weight:700; font-size:1.6rem; letter-spacing:0.04em; }
    .rc-tpl-monochrome .rc2-session{ font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; color:#555; }
    .rc-tpl-monochrome .rc2-photo, .rc-tpl-monochrome .rc2-photo-placeholder{ object-fit:cover; border:1px solid #000; filter:grayscale(100%); }
    .rc-tpl-monochrome .rc2-photo-placeholder{ background:#f2f2f2; display:flex; align-items:center; justify-content:center; color:#666; font-size:0.6rem; text-align:center; }
    .rc-tpl-monochrome .rc2-bio-table{ width:100%; border-collapse:collapse; margin-bottom:14px; font-size:0.78rem; }
    .rc-tpl-monochrome .rc2-bio-table td{ padding:6px 10px; border:1px solid #999; }
    .rc-tpl-monochrome .rc2-bio-table td.label{ font-weight:700; width:22%; background:#f2f2f2; }
    .rc-tpl-monochrome table.rc2-subjects{ width:100%; border-collapse:collapse; margin-bottom:14px; font-size:0.76rem; }
    .rc-tpl-monochrome table.rc2-subjects th, .rc-tpl-monochrome table.rc2-subjects td{ border:1px solid #999; padding:6px; text-align:center; }
    .rc-tpl-monochrome table.rc2-subjects th{ background:#000; color:#fff; font-size:0.66rem; text-transform:uppercase; }
    .rc-tpl-monochrome table.rc2-subjects .rc2-subject-name{ text-align:left; padding-left:10px; }
    .rc-tpl-monochrome .rc2-total-col{ font-weight:800; }
    .rc-tpl-monochrome .grade-good{ font-weight:800; text-decoration:underline; }
    .rc-tpl-monochrome .grade-poor{ font-weight:800; font-style:italic; }
    .rc-tpl-monochrome .rc2-summary-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:0; margin-bottom:14px; border:1px solid #999; }
    .rc-tpl-monochrome .rc2-summary-box{ border-right:1px solid #999; }
    .rc-tpl-monochrome .rc2-summary-box:last-child{ border-right:none; }
    .rc-tpl-monochrome .rc2-box-title{ font-size:0.64rem; text-transform:uppercase; padding:6px 8px; font-weight:700; text-align:center; background:#eee; border-bottom:1px solid #999; }
    .rc-tpl-monochrome .rc2-box-body{ padding:7px 9px; font-size:0.66rem; }
    .rc-tpl-monochrome .rc2-skill-row{ display:flex; justify-content:space-between; padding:2px 0; }
    .rc-tpl-monochrome .rc2-remarks{ display:grid; grid-template-columns:1fr 1fr; border:1px solid #999; margin-bottom:14px; }
    .rc-tpl-monochrome .rc2-remark-col{ border-right:1px solid #999; }
    .rc-tpl-monochrome .rc2-remark-col:last-child{ border-right:none; }
    .rc-tpl-monochrome .rc2-remark-title{ font-size:0.66rem; text-transform:uppercase; font-weight:700; padding:6px 12px; background:#eee; border-bottom:1px solid #999; }
    .rc-tpl-monochrome .rc2-remark-text{ padding:9px 12px; line-height:1.5; font-size:0.72rem; }
    .rc-tpl-monochrome .rc2-signatures{ display:flex; justify-content:space-between; padding:0 10px; margin-top:14px; }
    .rc-tpl-monochrome .rc2-sig-block{ text-align:center; font-size:0.72rem; width:170px; }
    .rc-tpl-monochrome .rc2-sig-line{ border-top:1px solid #000; padding-top:4px; margin-top:18px; }
    .rc-tpl-monochrome .rc2-footer-bar{ text-align:center; padding:7px; margin-top:16px; font-size:0.68rem; letter-spacing:0.15em; font-weight:700; border-top:2px solid #000; }
    .rc-tpl-monochrome .rc2-stamp-wrap{ display:flex; justify-content:center; margin:6px 0; }
    .rc-tpl-monochrome .rc2-stamp{ object-fit:contain; filter:grayscale(100%); }
    .rc-tpl-monochrome .rc2-promoted{ text-align:center; margin-top:12px; }
    .rc-tpl-monochrome .rc2-promoted-inner{ display:inline-block; border:1.5px solid #000; padding:5px 16px; font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.03em; }
  `;

  const html = `
    <div class="rc-page rc-tpl-monochrome">
      <div class="rc2-header">
        ${logoBlockHtml(data, 60)}
        <div>
          <p class="rc2-school-name">${escapeHtmlRC(data.school.name)}</p>
          ${data.school.motto ? `<p class="rc2-motto">${escapeHtmlRC(data.school.motto)}</p>` : ''}
          <p class="rc2-address">${escapeHtmlRC(data.school.address || '')}</p>
          <p class="rc2-address">${data.school.phone ? 'Tel: ' + escapeHtmlRC(data.school.phone) : ''}${data.school.phone && data.school.email ? ' | ' : ''}${data.school.email ? 'Email: ' + escapeHtmlRC(data.school.email) : ''}</p>
        </div>
        <div class="rc2-title-block">
          <div class="rc2-title">REPORT CARD</div>
          <div class="rc2-session">${escapeHtmlRC(data.sessionName)} &middot; ${escapeHtmlRC(data.termName)}</div>
        </div>
        ${photoBlockHtml(data, {w:64,h:78})}
      </div>

      <table class="rc2-bio-table">
        <tr><td class="label">Student's Name</td><td>${escapeHtmlRC(data.student.full_name).toUpperCase()}</td><td class="label">${data.showDob ? 'Date of Birth' : ''}</td><td>${data.showDob ? (data.student.dob ? new Date(data.student.dob).toLocaleDateString() : '—') : ''}</td></tr>
        <tr><td class="label">Admission No.</td><td>${escapeHtmlRC(data.student.admission_no || '—')}</td><td class="label">Gender</td><td>${escapeHtmlRC(data.student.gender || '—')}</td></tr>
        <tr><td class="label">Class</td><td>${escapeHtmlRC(data.classRow.name)}${data.classRow.arm ? ' ' + escapeHtmlRC(data.classRow.arm) : ''}</td><td class="label">Term</td><td>${escapeHtmlRC(data.termName)}</td></tr>
        <tr><td class="label">Term Ends</td><td colspan="3">${data.termRow.term_end_date ? new Date(data.termRow.term_end_date).toLocaleDateString() : '—'}</td></tr>
        <tr><td class="label">Next Term Resumes</td><td colspan="3">${data.termRow.next_term_resumes ? new Date(data.termRow.next_term_resumes).toLocaleDateString() : '—'}</td></tr>
      </table>

      <table class="rc2-subjects">
        <thead><tr><th style="text-align:left;">Subjects</th>${buildComponentHeadersHtml(data)}<th>Total (${data.maxPerSubject})</th><th>Grade</th><th>Remarks</th></tr></thead>
        <tbody>${buildSubjectRowsHtml(data)}</tbody>
      </table>

      <div class="rc2-summary-grid">
        ${buildSummaryBoxes(data).map(b => `<div class="rc2-summary-box"><div class="rc2-box-title">${b.title}</div><div class="rc2-box-body">${b.bodyHtml}</div></div>`).join('')}
      </div>

      <div class="rc2-remarks">
        <div class="rc2-remark-col"><div class="rc2-remark-title">Class Teacher's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.class_teacher_remark) || '—')}</div></div>
        <div class="rc2-remark-col"><div class="rc2-remark-title">Principal's Remark</div><div class="rc2-remark-text">${escapeHtmlRC((data.remarksRow && data.remarksRow.principal_remark) || '—')}</div></div>
      </div>

      ${data.showStamp ? `<div class="rc2-stamp-wrap">${stampBlockHtml(data, 56)}</div>` : ''}

      <div class="rc2-signatures">
        <div class="rc2-sig-block"><div class="rc2-sig-line">Class Teacher</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
        <div class="rc2-sig-block"><div class="rc2-sig-line">Principal</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
      </div>

      ${promotedBadgeHtml(data)}

    </div>
  `;
  return { css: css, html: html };
}

/**
 * The single dispatcher every consumer (live preview, gallery preview,
 * class-report-cards.html) calls — maps a template key to its
 * renderer, so nothing outside this file needs a switch statement of
 * its own that could drift out of sync with the template registry.
 */
export function renderReportCardTemplate(templateKey, data, theme) {
  const renderers = {
    classic: renderClassicTemplate,
    modern: renderModernTemplate,
    royal: renderRoyalTemplate,
    british: renderBritishTemplate,
    prestige: renderPrestigeTemplate,
    minimal: renderMinimalTemplate,
    primary: renderPrimaryTemplate,
    monochrome: renderMonochromeTemplate
  };
  const renderer = renderers[templateKey] || renderClassicTemplate;
  return renderer(data, theme);
}
