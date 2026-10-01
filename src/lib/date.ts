export function isoToDisplay(iso?: string | null) {
  if (!iso) {
    return '';
  }
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) {
    return '';
  }
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

export function maskDate(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return digits.slice(0, 2) + '/' + digits.slice(2);
  }
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
}

export function displayToIso(display: string): string | null | undefined {
  if (!display) {
    return null;
  }
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) {
    return undefined;
  }
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return undefined;
  }
  return m[3] + '-' + m[2] + '-' + m[1];
}
