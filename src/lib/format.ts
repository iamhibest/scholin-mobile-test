export function naira(value: number) {
  const n = Math.round(Number(value) || 0);
  return '\u20A6' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
}

export function shortDate(value?: string) {
  if (!value) {
    return '';
  }
  const d = new Date(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

export function ordinal(index: number) {
  const n = index + 1;
  const suffixes = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

export function toISODateLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}
