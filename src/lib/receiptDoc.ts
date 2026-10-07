import { naira } from './format';
import { getPaymentStatus, methodLabel } from './events';
import { phonesOf } from './schoolContact';

function esc(v: any) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function longDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

export type ReceiptInput = {
  school: any;
  student: any;
  className: string;
  event: any;
  payment: any;
  amountDue: number;
  paidUpToThis: number;
};

export function buildReceiptHtml(r: ReceiptInput) {
  const { status, balance } = getPaymentStatus(r.amountDue, r.paidUpToThis);
  const school = r.school || {};
  const logo = school.logo_url
    ? '<img class="logo" src="' + esc(school.logo_url) + '"/>'
    : '<div class="logo ph">' + esc((school.name || 'S').charAt(0)) + '</div>';
  const contact = [phonesOf(school) ? 'Tel: ' + esc(phonesOf(school)) : '', school.email ? 'Email: ' + esc(school.email) : ''].filter(Boolean).join(' | ');
  const message =
    status === 'paid'
      ? 'This receipt confirms that the full amount due for this payment has been received. We appreciate your prompt payment.'
      : 'Kindly complete the outstanding balance on or before the due date. Thank you for your cooperation and continued support.';
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=595">' +
    '<style>' +
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;} html,body{margin:0;padding:0;background:#fff;}' +
    'body{width:595px;font-family:Arial,Helvetica,sans-serif;color:#111827;padding:34px 38px;}' +
    '.head{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1A56DB;padding-bottom:16px;}' +
    '.logo{width:70px;height:70px;border-radius:12px;object-fit:contain;} .ph{background:#1A56DB;color:#fff;font-size:30px;font-weight:700;display:flex;align-items:center;justify-content:center;}' +
    '.sn{font-size:20px;font-weight:800;color:#0F172A;} .sl{font-size:11.5px;color:#4B5563;margin-top:3px;}' +
    '.title{margin:22px 0 14px;text-align:center;font-size:18px;font-weight:800;letter-spacing:3px;color:#1A56DB;}' +
    '.grid{display:flex;flex-wrap:wrap;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;}' +
    '.cell{width:50%;padding:10px 14px;font-size:13px;font-weight:600;border-bottom:1px solid #E5E7EB;} .cell:nth-child(odd){border-right:1px solid #E5E7EB;}' +
    '.cell span{display:block;font-size:10.5px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;}' +
    '.amounts{margin-top:18px;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;}' +
    '.row{display:flex;justify-content:space-between;padding:11px 14px;font-size:13.5px;border-bottom:1px solid #F1F5F9;} .row:last-child{border-bottom:none;}' +
    '.row.bal{background:#F1F5F9;font-weight:800;font-size:15px;}' +
    '.status{margin-top:16px;text-align:center;padding:12px;border-radius:10px;font-weight:800;font-size:14px;letter-spacing:.5px;}' +
    '.paid{background:#DCFCE7;color:#166534;} .partial{background:#FEF3C7;color:#92400E;}' +
    '.msg{margin-top:18px;font-size:12.5px;color:#374151;line-height:1.55;text-align:center;}' +
    '.sig{margin-top:46px;display:flex;justify-content:flex-end;} .sig div{width:190px;border-top:1.5px solid #111827;padding-top:6px;text-align:center;font-size:12px;color:#374151;}' +
    '</style></head><body>' +
    '<div class="head">' + logo + '<div><div class="sn">' + esc(school.name || 'School') + '</div>' +
    (school.address ? '<div class="sl">' + esc(school.address) + '</div>' : '') +
    (contact ? '<div class="sl">' + contact + '</div>' : '') +
    '</div></div>' +
    '<div class="title">PAYMENT RECEIPT</div>' +
    '<div class="grid">' +
    '<div class="cell"><span>Receipt number</span>' + esc(r.payment.receipt_number) + '</div>' +
    '<div class="cell"><span>Date</span>' + esc(longDate(r.payment.payment_date)) + '</div>' +
    '<div class="cell"><span>Student name</span>' + esc(r.student.full_name || '') + '</div>' +
    '<div class="cell"><span>Class</span>' + esc(r.className || 'Not set') + '</div>' +
    '<div class="cell"><span>Admission number</span>' + esc(r.student.admission_no || 'Not set') + '</div>' +
    '<div class="cell"><span>Event</span>' + esc(r.event.name) + '</div>' +
    '<div class="cell"><span>Payment method</span>' + esc(methodLabel(r.payment.payment_method)) + '</div>' +
    '</div>' +
    '<div class="amounts">' +
    '<div class="row"><span>Total amount due</span><span>' + esc(naira(r.amountDue)) + '</span></div>' +
    '<div class="row"><span>Amount paid this transaction</span><span>' + esc(naira(Number(r.payment.amount))) + '</span></div>' +
    '<div class="row"><span>Total paid so far</span><span>' + esc(naira(r.paidUpToThis)) + '</span></div>' +
    '<div class="row bal"><span>Balance remaining</span><span>' + esc(naira(balance)) + '</span></div>' +
    '</div>' +
    '<div class="status ' + (status === 'paid' ? 'paid' : 'partial') + '">' + (status === 'paid' ? 'PAID IN FULL' : 'BALANCE DUE ' + esc(naira(balance))) + '</div>' +
    '<div class="msg">' + message + '<br/><br/>Thank you.</div>' +
    '<div class="sig"><div>Authorised signatory</div></div>' +
    '</body></html>'
  );
}
