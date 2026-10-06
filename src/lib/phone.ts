export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function stripCountryCode(digits: string): string {
  if (digits.startsWith('0039')) return digits.slice(4)
  if (digits.startsWith('39')) {
    const rest = digits.slice(2)
    if (/^[03]/.test(rest) && rest.length >= 6 && rest.length <= 12) return rest
  }
  return digits
}

function formatNational(digits: string): string {
  if (digits.startsWith('3') && digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }
  if (digits.startsWith('0') && digits.length >= 6) {
    const prefixLength = digits.startsWith('02') || digits.startsWith('06') ? 2 : 3
    if (digits.length > prefixLength) {
      return `${digits.slice(0, prefixLength)} ${digits.slice(prefixLength)}`
    }
  }
  return digits
}

export function normalizeItalianPhone(raw: string): string {
  const digits = stripCountryCode(phoneDigits(raw.trim()))
  if (!digits) return ''
  return formatNational(digits)
}

export function phonesMatch(left: string, right: string): boolean {
  const a = phoneDigits(normalizeItalianPhone(left))
  const b = phoneDigits(normalizeItalianPhone(right))
  if (!a || !b) return false
  return a === b
}

export function telHref(phone: string): string {
  const digits = phoneDigits(normalizeItalianPhone(phone) || phone)
  if (!digits) return ''
  return `tel:+39${digits}`
}
