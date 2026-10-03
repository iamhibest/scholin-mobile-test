import * as HtmlToPdfModule from 'react-native-html-to-pdf';
import { saveToDownloads, shareFile, safeName } from './files';

export async function makePdf(html: string, baseName: string, page?: { width: number; height: number; padding: number }) {
  const mod: any = HtmlToPdfModule;
  const generate = mod.generatePDF || (mod.default && mod.default.generatePDF) || mod.convert || (mod.default && mod.default.convert);
  if (typeof generate !== 'function') {
    throw new Error('PDF tools are not available in this build.');
  }
  const fileName = safeName(baseName);
  const file = await generate({ html, fileName, ...(page || {}) });
  const path = file && (file.filePath || file.path);
  if (!path) {
    throw new Error('The PDF could not be created.');
  }
  return { path: path as string, fileName: fileName + '.pdf' };
}

export async function sharePdf(path: string, title: string) {
  await shareFile(path, 'application/pdf', title);
}

export async function downloadPdf(path: string, fileName: string) {
  return saveToDownloads(path, fileName, 'application/pdf');
}

export function simpleTableHtml(title: string, sub: string, head: string[], rows: string[][]) {
  const esc = (v: any) => String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (
    '<html><head><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111827}h1{font-size:20px;margin:0 0 4px}p{color:#6B7280;margin:0 0 16px;font-size:13px}' +
    'table{width:100%;border-collapse:collapse;font-size:13px}th{background:#1A56DB;color:#fff;text-align:left;padding:8px}td{padding:8px;border-bottom:1px solid #E5E7EB}tr:nth-child(even) td{background:#F9FAFB}</style></head><body>' +
    '<h1>' +
    esc(title) +
    '</h1><p>' +
    esc(sub) +
    '</p><table><tr>' +
    head.map(h => '<th>' + esc(h) + '</th>').join('') +
    '</tr>' +
    rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') +
    '</table></body></html>'
  );
}
