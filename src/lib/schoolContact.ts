// A school can have two phone numbers. Everywhere a phone shows (receipts, report cards, headers) it shows both.
export function phonesOf(school: any): string {
  if (!school) {
    return '';
  }
  return [school.phone, school.phone_2]
    .map((p: any) => (p ? String(p).trim() : ''))
    .filter(Boolean)
    .join(' / ');
}
