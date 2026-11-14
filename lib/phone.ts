/**
 * Canonical phone normalization utility.
 *
 * Strips all non-digit characters from the given phone number.
 * Handles empty, null, undefined, and invalid inputs safely by returning an empty string.
 *
 * @param phone - Phone string to normalize
 * @returns Digits-only normalized string, or empty string if input is empty/invalid
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') {
    return ''
  }
  return phone.replace(/\D/g, '')
}
