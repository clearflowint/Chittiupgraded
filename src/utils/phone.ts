/**
 * phone — Phone validation and normalization utilities
 */

export function normalizePhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return digits ? `+${digits}` : '';
}

export function isValidPhoneNumber(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 10;
}

export function formatPhoneDisplay(phone: string | undefined | null): string {
  if (!phone) return '—';
  const clean = normalizePhoneNumber(phone);
  if (clean.length === 13 && clean.startsWith('+91')) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`;
  }
  return phone;
}
