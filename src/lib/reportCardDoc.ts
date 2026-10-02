import * as HtmlToPdfModule from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { supabase } from './supabase';
import { gatherReportCardData } from '../reportcard/data';
import { resolveTheme } from '../reportcard/themes';
import { renderReportCardTemplate } from '../reportcard/templates';
import { buildPagedDocument } from '../reportcard/pagination';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function inlineImages(html: string) {
  const urls = Array.from(new Set((html.match(/src="https?:\/\/[^"]+"/g) || []).map(m => m.slice(5, -1))));
  let out = html;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const dataUrl = await blobToDataUrl(await response.blob());
      out = out.split('src="' + url + '"').join('src="' + dataUrl + '"');
    } catch {}
  }
  return out;
}

export type ReportCardArgs = {
  studentId: string;
  classId: string;
  termId: string;
  sessionId: string;
  sessionName: string;
  termName: string;
  school: any;
};

export async function buildReportCardHtml(args: ReportCardArgs): Promise<{ error: string | null; html?: string; printHtml?: string; name?: string }> {
  const data = await gatherReportCardData({ ...args, schoolId: args.school.id });
  if (data.error === 'no_published_subjects') {
    return { error: 'no_published_subjects' };
  }
  const { data: templateRow, error } = await supabase.rpc('get_report_card_template', { p_school_id: args.school.id });
  if (error) {
    throw new Error(error.message || 'Could not load the report card template.');
  }
  const theme = resolveTheme(templateRow);
  const { css, html } = renderReportCardTemplate(templateRow.report_template, data, theme);
  const body = await inlineImages(html);
  return {
    error: null,
    html: buildPagedDocument(css, body, 'preview'),
    printHtml: buildPagedDocument(css, body, 'print'),
    name: data.student ? data.student.full_name : 'Report Card',
  };
}

export async function exportReportCardPdf(html: string, studentName: string, share: boolean) {
  const mod: any = HtmlToPdfModule;
  const generate = mod.generatePDF || (mod.default && mod.default.generatePDF) || mod.convert || (mod.default && mod.default.convert);
  if (typeof generate !== 'function') {
    throw new Error('PDF tools are not available in this build.');
  }
  const safe = studentName.replace(/[^A-Za-z0-9]+/g, '_') + '_ReportCard';
  const file = await generate({ html, fileName: safe, width: 595, height: 842, padding: 0 });
  const path = file && (file.filePath || file.path);
  if (!path) {
    throw new Error('The PDF could not be created.');
  }
  const url = path.startsWith('file://') ? path : 'file://' + path;
  await Share.open({ url, type: 'application/pdf', title: safe, failOnCancel: false });
  return path as string;
}
