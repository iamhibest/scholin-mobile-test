const NAVY = '#0B2A5B';
const GOLD = '#C9A24A';
const GREEN = '#1F6B45';
const CREAM = '#FBF8EE';

const esc = (v: any) => String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function nameSize(name: string) {
  const n = name.length;
  if (n <= 18) return 54;
  if (n <= 26) return 46;
  if (n <= 36) return 40;
  return 34;
}

const ICON_SCAN =
  '<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="13" y="4" width="22" height="40" rx="5"/><path d="M19 17v-3h3M29 17v-3h-3M19 31v3h3M29 31v3h-3"/></svg>';
const ICON_PHONE =
  '<svg viewBox="0 0 48 48" width="50" height="50" fill="none" stroke="' + NAVY + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="3" width="24" height="42" rx="6"/><path d="M19 17v-3h3M29 17v-3h-3M19 33v3h3M29 33v3h-3"/></svg>';
const ICON_FRAME =
  '<svg viewBox="0 0 48 48" width="50" height="50" fill="none" stroke="' + NAVY + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15V8a3 3 0 0 1 3-3h7M33 5h7a3 3 0 0 1 3 3v7M43 33v7a3 3 0 0 1-3 3h-7M15 43H8a3 3 0 0 1-3-3v-7"/><rect x="16" y="16" width="16" height="16" rx="2"/><rect x="21" y="21" width="6" height="6"/></svg>';
const ICON_PERSON =
  '<svg viewBox="0 0 48 48" width="52" height="50" fill="none" stroke="' + NAVY + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="19" cy="15" r="8"/><path d="M5 42c0-9 6-14 14-14s14 5 14 14z"/><circle cx="37" cy="14" r="5"/><circle cx="38" cy="38" r="6" fill="' + NAVY + '" stroke="' + NAVY + '"/><path d="M38 35v6M35 38h6" stroke="#fff"/></svg>';

function laurel(color: string) {
  const out: string[] = [];
  const cx = 60;
  const cy = 62;
  const R = 50;
  for (let i = 0; i < 8; i++) {
    const t = (115 + i * 18) * (Math.PI / 180);
    const lx = cx + R * Math.cos(t);
    const ly = cy + R * Math.sin(t);
    const rot = (t * 180) / Math.PI - 18;
    out.push('<ellipse cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" rx="3.6" ry="8.4" transform="rotate(' + rot.toFixed(1) + ' ' + lx.toFixed(1) + ' ' + ly.toFixed(1) + ')"/>');
    const mx = cx - R * Math.cos(t);
    out.push('<ellipse cx="' + mx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" rx="3.6" ry="8.4" transform="rotate(' + (-rot).toFixed(1) + ' ' + mx.toFixed(1) + ' ' + ly.toFixed(1) + ')"/>');
  }
  return '<svg viewBox="0 0 120 124" class="lw" xmlns="http://www.w3.org/2000/svg"><g fill="' + color + '">' + out.join('') + '</g></svg>';
}

// Builds the QR as a vector SVG (no bitmap, no native image conversion), so it prints sharp and cannot crash the app.
function qrSvg(value: string) {
  const QRImpl: any = require('qrcode/lib/core/qrcode');
  const qr = QRImpl.create(value, { errorCorrectionLevel: 'M' });
  const n: number = qr.modules.size;
  const data: ArrayLike<number> = qr.modules.data;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (data[r * n + c]) {
        let start = c;
        while (c < n && data[r * n + c]) {
          c++;
        }
        d += 'M' + start + ' ' + r + 'h' + (c - start) + 'v1h-' + (c - start) + 'z';
      } else {
        c++;
      }
    }
  }
  return '<svg viewBox="0 0 ' + n + ' ' + n + '" width="262" height="262" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}

export function buildQrPosterHtml(args: { schoolName: string; address: string; pointName: string; logoUrl?: string | null; qrValue: string }) {
  const name = (args.schoolName || 'School').trim();
  const size = nameSize(name);
  const initial = esc(name.charAt(0).toUpperCase());
  const crest = args.logoUrl
    ? '<img src="' + esc(args.logoUrl) + '" class="crest-img">'
    : '<div class="crest-ph">' + initial + '</div>';

  const css = `
    @page{ size:794px 1122px; margin:0; }
    *{ box-sizing:border-box; margin:0; padding:0; }
    html,body{ background:#fff; }
    body{ width:794px; height:1122px; font-family:'Inter','Roboto','Noto Sans',Arial,sans-serif; color:${NAVY}; }
    .poster{ position:relative; width:794px; height:1122px; overflow:hidden; background:${CREAM}; }
    .deco{ position:absolute; left:0; top:0; width:794px; height:1122px; }
    .frame{ position:absolute; left:9px; top:9px; right:9px; bottom:9px; border:4px solid ${GOLD}; }
    .frame2{ position:absolute; left:17px; top:17px; right:17px; bottom:17px; border:1.5px solid ${GOLD}; }
    .c{ position:absolute; left:0; top:0; width:794px; height:1122px; }
    .head{ position:absolute; left:64px; right:64px; top:46px; display:flex; align-items:center; gap:18px; }
    .crest{ position:relative; width:150px; height:156px; flex:0 0 auto; }
    .lw{ position:absolute; left:0; top:0; width:100%; height:100%; }
    .crest-box{ position:absolute; left:34px; top:24px; width:82px; height:100px; background:${NAVY}; border:4px solid ${GOLD}; border-radius:10px 10px 42px 42px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .crest-img{ width:100%; height:100%; object-fit:cover; background:#fff; }
    .crest-ph{ color:#fff; font-family:'Playfair Display','Noto Serif',Georgia,serif; font-weight:900; font-size:44px; }
    .ribbon{ position:absolute; left:14px; right:14px; top:112px; height:24px; background:${GOLD}; color:${NAVY}; font-family:'Playfair Display','Noto Serif',Georgia,serif; font-weight:800; font-size:13px; letter-spacing:1px; text-align:center; line-height:24px; border-radius:3px; }
    .hname{ flex:1; min-width:0; text-align:center; }
    .name{ font-family:'Playfair Display','Noto Serif',Georgia,serif; font-weight:900; font-size:${size}px; line-height:1.04; color:${NAVY}; text-transform:uppercase; letter-spacing:-0.01em; overflow-wrap:break-word; }
    .point{ margin-top:10px; font-weight:600; font-size:20px; letter-spacing:7px; color:${NAVY}; text-transform:uppercase; }
    .rule{ display:flex; align-items:center; gap:10px; margin:10px auto 0 auto; width:84%; }
    .rule i{ flex:1; height:1.5px; background:${GOLD}; }
    .rule b{ color:${GOLD}; font-size:16px; line-height:1; }
    .addr{ position:absolute; left:140px; right:140px; top:238px; text-align:center; font-size:19px; line-height:1.4; font-weight:500; color:${NAVY}; }
    .qrbox{ position:absolute; left:50%; top:300px; width:300px; height:300px; margin-left:-150px; background:${NAVY}; border-radius:30px; padding:12px; }
    .qrin{ width:100%; height:100%; background:#fff; border-radius:18px; display:flex; align-items:center; justify-content:center; }
    .qrin svg{ width:262px; height:262px; display:block; }
    .banner{ position:absolute; left:130px; right:130px; top:622px; height:84px; background:${NAVY}; border-radius:20px; display:flex; align-items:center; gap:18px; padding:0 28px; color:#fff; }
    .banner .div{ width:2px; height:44px; background:rgba(255,255,255,0.7); }
    .banner .t1{ font-weight:800; font-size:27px; letter-spacing:0.5px; line-height:1.1; }
    .banner .t2{ font-weight:400; font-size:19px; margin-top:2px; }
    .how{ position:absolute; left:46px; right:46px; top:732px; height:208px; border:1.5px solid ${GOLD}; border-radius:20px; padding-top:14px; }
    .how h3{ text-align:center; font-size:21px; font-weight:800; letter-spacing:6px; color:${NAVY}; }
    .steps{ display:flex; margin-top:10px; }
    .step{ flex:1; text-align:center; padding:0 16px; border-left:1.5px solid ${GOLD}; }
    .step:first-child{ border-left:none; }
    .step .top{ display:flex; align-items:center; justify-content:center; gap:12px; height:56px; }
    .step .n{ width:36px; height:36px; border-radius:50%; background:${NAVY}; color:#fff; font-weight:800; font-size:20px; display:flex; align-items:center; justify-content:center; }
    .step b{ display:block; margin-top:10px; font-size:17px; font-weight:800; }
    .step span{ display:block; margin-top:3px; font-size:15px; font-weight:400; line-height:1.3; }
    .thanks{ position:absolute; left:0; right:0; top:956px; text-align:center; }
    .thanks .s{ font-family:'Great Vibes','Brush Script MT','Segoe Script',cursive; font-size:46px; line-height:1; color:${NAVY}; }
    .thanks .l{ position:absolute; top:26px; width:110px; height:1.5px; background:${GOLD}; }
    .thanks p{ margin-top:2px; font-size:17px; font-weight:400; }
    .foot{ position:absolute; left:0; right:0; bottom:26px; display:flex; align-items:center; justify-content:center; gap:20px; color:${GOLD}; font-family:'Playfair Display','Noto Serif',Georgia,serif; font-weight:700; font-size:30px; letter-spacing:6px; }
    .foot i{ width:70px; height:1.5px; background:${GOLD}; }
  `;

  const deco =
    '<svg class="deco" viewBox="0 0 794 1122" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M0 0 H190 C112 16 40 72 0 190 Z" fill="' + NAVY + '"/>' +
    '<path d="M190 0 C112 16 40 72 0 190" fill="none" stroke="' + GOLD + '" stroke-width="5"/>' +
    '<path d="M128 0 C74 14 28 56 0 128" fill="none" stroke="' + GREEN + '" stroke-width="8"/>' +
    '<path d="M794 0 H604 C682 16 754 72 794 190 Z" fill="' + NAVY + '"/>' +
    '<path d="M604 0 C682 16 754 72 794 190" fill="none" stroke="' + GOLD + '" stroke-width="5"/>' +
    '<path d="M666 0 C720 14 766 56 794 128" fill="none" stroke="' + GREEN + '" stroke-width="8"/>' +
    '<path d="M0 1010 C60 1020 150 1040 250 1075 L0 1075 Z" fill="' + GREEN + '"/>' +
    '<path d="M794 1010 C734 1020 644 1040 544 1075 L794 1075 Z" fill="' + GREEN + '"/>' +
    '<path d="M0 1122 V1062 C180 1030 614 1030 794 1062 V1122 Z" fill="' + NAVY + '"/>' +
    '<path d="M0 1062 C180 1030 614 1030 794 1062" fill="none" stroke="' + GOLD + '" stroke-width="4"/>' +
    '</svg>';

  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=794">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600;700;800&family=Great+Vibes&display=swap">' +
    '<style>' + css + '</style></head><body><div class="poster">' + deco +
    '<div class="frame"></div><div class="frame2"></div>' +
    '<div class="head"><div class="crest">' + laurel(GREEN) + '<div class="crest-box">' + crest + '</div><div class="ribbon">SCHOLIN</div></div>' +
    '<div class="hname"><div class="name">' + esc(name) + '</div>' +
    (args.pointName ? '<div class="point">' + esc(args.pointName) + '</div>' : '') +
    '<div class="rule"><i></i><b>\u2605</b><i></i></div></div></div>' +
    (args.address ? '<div class="addr">' + esc(args.address) + '</div>' : '') +
    '<div class="qrbox"><div class="qrin">' + qrSvg(args.qrValue) + '</div></div>' +
    '<div class="banner">' + ICON_SCAN + '<div class="div"></div><div><div class="t1">SCAN THIS QR CODE</div><div class="t2">to clock in and clock out</div></div></div>' +
    '<div class="how"><h3>HOW TO USE</h3><div class="steps">' +
    '<div class="step"><div class="top"><div class="n">1</div>' + ICON_PHONE + '</div><b>Open the Scholin app</b><span>and tap Clock In and Out.</span></div>' +
    '<div class="step"><div class="top"><div class="n">2</div>' + ICON_FRAME + '</div><b>Point at the QR code</b><span>and wait for it to scan.</span></div>' +
    '<div class="step"><div class="top"><div class="n">3</div>' + ICON_PERSON + '</div><b>Scan for your friend</b><span>You can also scan for a colleague.</span></div>' +
    '</div></div>' +
    '<div class="thanks"><div class="l" style="left:160px"></div><div class="l" style="right:160px"></div><div class="s">Thank you</div><p>for being part of our school community.</p></div>' +
    '<div class="foot"><i></i>SCHOLIN<i></i></div>' +
    '</div></body></html>';
  return html;
}
