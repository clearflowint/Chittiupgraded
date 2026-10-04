/**
 * phone — Phone validation and normalization utilities
 */

export function normalizePhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return digits ? `+${digits}` : '';
}

export function isValidPhoneNumber(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const norm = normalizePhoneNumber(phone);
  return /^\+91[0-9]{10}$/.test(norm);
}

export function extract10Digits(phone: string | undefined | null): string {
  if (!phone) return '';
  const norm = normalizePhoneNumber(phone);
  if (/^\+91[0-9]{10}$/.test(norm)) {
    return norm.slice(3);
  }
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 12 && clean.startsWith('91')) return clean.slice(2);
  if (clean.length === 11 && clean.startsWith('0')) return clean.slice(1);
  return clean.slice(0, 10);
}

export function formatPhoneDisplay(phone: string | undefined | null): string {
  if (!phone) return '—';
  const clean = normalizePhoneNumber(phone);
  if (clean.length === 13 && clean.startsWith('+91')) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`;
  }
  return phone;
}

export function deduplicateContacts<T extends { phone: string; createdAt: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  // Sort by createdAt ascending to preserve the oldest (REQ 6: Preserve oldest/authoritative ID)
  const sorted = [...items].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  
  for (const item of sorted) {
    const norm = normalizePhoneNumber(item.phone);
    if (!norm) continue;
    if (!seen.has(norm)) {
      seen.set(norm, item);
    }
  }
  return Array.from(seen.values());
}
