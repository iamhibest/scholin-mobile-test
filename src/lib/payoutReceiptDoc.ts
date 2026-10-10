import { naira } from './format';
import { PayoutHistory, PayoutPayment, maskAccount } from './payoutHistory';

function esc(v: any) {
  return String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function longDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

// A receipt that says this has been paid this money into the school's account (or that it is still on its way).
export function buildPayoutReceiptHtml(h: PayoutHistory, p: PayoutPayment) {
  const paid = !!p.settled_at;
  const net = Number(p.net_amount_to_school || 0);
  const fees = Number(p.platform_fee_amount || 0);
  const account = [h.bank_name || 'Bank account', maskAccount(h.account_last4), h.account_name || ''].filter(Boolean).join(' · ');
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=595">' +
    '<style>' +
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;} html,body{margin:0;padding:0;background:#fff;}' +
    'body{width:595px;font-family:Arial,Helvetica,sans-serif;color:#111827;padding:34px 38px;}' +
    '.sn{font-size:20px;font-weight:800;color:#0F172A;border-bottom:3px solid #1A56DB;padding-bottom:14px;}' +
    '.title{margin:22px 0 14px;text-align:center;font-size:17px;font-weight:800;letter-spacing:2px;color:#1A56DB;}' +
    '.status{margin:0 0 16px;text-align:center;padding:12px;border-radius:10px;font-weight:800;font-size:14px;letter-spacing:.5px;}' +
    '.paid{background:#DCFCE7;color:#166534;} .pending{background:#FEF3C7;color:#92400E;}' +
    '.grid{display:flex;flex-wrap:wrap;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;}' +
    '.cell{width:50%;padding:10px 14px;font-size:13px;font-weight:600;border-bottom:1px solid #E5E7EB;} .cell:nth-child(odd){border-right:1px solid #E5E7EB;} .full{width:100%;border-right:none !important;}' +
    '.cell span{display:block;font-size:10.5px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;}' +
    '.amounts{margin-top:18px;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;}' +
    '.row{display:flex;justify-content:space-between;padding:11px 14px;font-size:13.5px;border-bottom:1px solid #F1F5F9;} .row:last-child{border-bottom:none;}' +
    '.row.tot{background:#F1F5F9;font-weight:800;font-size:15px;}' +
    '.msg{margin-top:18px;font-size:12px;color:#4B5563;line-height:1.55;text-align:center;}' +
    '</style></head><body>' +
    '<div class="sn">' + esc(h.school_name || 'School') + '</div>' +
    '<div class="title">' + (paid ? 'PAYOUT RECEIPT' : 'PAYMENT RECEIVED, PAYOUT PENDING') + '</div>' +
    '<div class="status ' + (paid ? 'paid' : 'pending') + '">' +
    (paid ? 'PAID TO YOUR ACCOUNT ON ' + esc(longDate(p.settled_at as string).toUpperCase()) : 'PENDING. NOT YET PAID INTO YOUR ACCOUNT') +
    '</div>' +
    '<div class="grid">' +
    '<div class="cell"><span>Paid by</span>' + esc(p.payer_name) + '</div>' +
    '<div class="cell"><span>Student</span>' + esc(p.student_name || '') + '</div>' +
    '<div class="cell"><span>Payment for</span>' + esc(p.event_name || 'School fee') + '</div>' +
    '<div class="cell"><span>Date parent paid</span>' + esc(longDate(p.payment_date)) + '</div>' +
    '<div class="cell"><span>Receipt number</span>' + esc(p.receipt_number || '') + '</div>' +
    '<div class="cell"><span>Admission number</span>' + esc(p.admission_no || 'Not set') + '</div>' +
    '<div class="cell full"><span>Paid to account</span>' + esc(account) + '</div>' +
    '</div>' +
    '<div class="amounts">' +
    '<div class="row"><span>Amount the parent paid</span><span>' + esc(naira(Number(p.amount))) + '</span></div>' +
    '<div class="row"><span>Transaction fee</span><span>- ' + esc(naira(fees)) + '</span></div>' +
    '<div class="row tot"><span>' + (paid ? 'Amount paid to your account' : 'Amount due to your account') + '</span><span>' + esc(naira(net)) + '</span></div>' +
    '</div>' +
    '<div class="msg">' + (paid ? 'This amount has been paid into the account above.' : 'Payments are made the next working day. This receipt updates to PAID once it is paid.') +
    '<br/>Reference: ' + esc(p.paystack_reference || '') + (paid && p.paystack_settlement_id ? '<br/>Payout ID: ' + esc(p.paystack_settlement_id) : '') + '</div>' +
    '</body></html>'
  );
}
