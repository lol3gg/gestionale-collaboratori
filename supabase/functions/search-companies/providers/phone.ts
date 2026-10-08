function phoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function isItalianNational(digits: string): boolean {
  if (!digits) return false
  if (digits.startsWith('3') && digits.length === 10) return true
  if (digits.startsWith('0') && digits.length >= 6 && digits.length <= 11) return true
  return false
}

function stripItalianCountryCode(digits: string): string {
  if (digits.startsWith('0039')) return digits.slice(4)
  if (digits.startsWith('39')) {
    const rest = digits.slice(2)
    if (isItalianNational(rest) || (/^[03]/.test(rest) && rest.length >= 6 && rest.length <= 12)) return rest
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

/** Telefono visuale normalizzato. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('+')) {
    const digits = phoneDigits(trimmed)
    if (!digits) return ''
    if (digits.startsWith('39') && (isItalianNational(digits.slice(2)) || digits.length >= 8)) {
      const national = stripItalianCountryCode(digits)
      return national ? formatNational(national) : ''
    }
    return `+${digits}`
  }
  const digits = stripItalianCountryCode(phoneDigits(trimmed))
  if (!digits) return ''
  return formatNational(digits)
}

/** Chiave canonica per dedupe (cifre, con prefisso paese). */
export function canonicalPhoneKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('+')) {
    const digits = phoneDigits(trimmed)
    if (!digits) return ''
    if (digits.startsWith('39') && isItalianNational(digits.slice(2))) {
      return `39${stripItalianCountryCode(digits)}`
    }
    return digits
  }
  const national = stripItalianCountryCode(phoneDigits(trimmed))
  if (!national) return ''
  return `39${national}`
}
