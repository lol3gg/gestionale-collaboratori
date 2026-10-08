export function phoneDigits(value: string): string {
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

function formatInternational(digitsWithCc: string): string {
  if (!digitsWithCc) return ''
  return `+${digitsWithCc}`
}

/** Prefisso paese se il valore grezzo inizia con + (es. "41", "39"). */
export function detectCountryPrefix(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('+')) return null
  const digits = phoneDigits(trimmed)
  if (!digits) return null
  if (digits.startsWith('39') && isItalianNational(digits.slice(2))) return '39'
  if (digits.startsWith('1') && digits.length >= 11) return '1'
  // Prefissi comuni a 2 cifre; fallback: 2 cifre
  const two = digits.slice(0, 2)
  if (two && two !== '39') return two
  if (digits.startsWith('39')) return '39'
  return two || null
}

/**
 * Normalizza un numero.
 * - Italiano (+39 / 0039 / nazionale): formato nazionale senza prefisso paese.
 * - Estero (inizia con + e prefisso ≠ 39): conserva +prefisso e le cifre.
 */
export function normalizeItalianPhone(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('+')) {
    const digits = phoneDigits(trimmed)
    if (!digits) return ''
    if (digits.startsWith('39') && (isItalianNational(digits.slice(2)) || digits.length >= 8)) {
      const national = stripItalianCountryCode(digits)
      return national ? formatNational(national) : ''
    }
    // Estero: non trattare come italiano
    return formatInternational(digits)
  }

  const digits = stripItalianCountryCode(phoneDigits(trimmed))
  if (!digits) return ''
  return formatNational(digits)
}

/** Chiave canonica per confronti duplicati (cifre con prefisso paese incluso). */
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

export function phonesMatch(left: string, right: string): boolean {
  const a = canonicalPhoneKey(left)
  const b = canonicalPhoneKey(right)
  if (!a || !b) return false
  return a === b
}

export function telHref(phone: string): string {
  const trimmed = phone.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('+')) {
    const digits = phoneDigits(trimmed)
    if (!digits) return ''
    // Estero o +39: usa le cifre così come sono, senza anteporre 39 di nuovo
    return `tel:+${digits}`
  }

  const national = phoneDigits(normalizeItalianPhone(trimmed) || trimmed)
  if (!national) return ''
  return `tel:+39${national}`
}

/** Cifre internazionali senza + per wa.me / copia. */
export function internationalDigits(phone: string): string {
  const key = canonicalPhoneKey(phone)
  return key
}

export function waHref(phone: string): string {
  const digits = internationalDigits(phone)
  if (!digits) return ''
  return `https://wa.me/${digits}`
}

/** Test di esempio (eseguiti in DEV all’import del modulo). */
export function runPhoneSelfChecks(): void {
  const cases: { input: string; href: string; matchWith?: string; normalizedIncludes?: string }[] = [
    { input: '333 1234567', href: 'tel:+393331234567' },
    { input: '+39 333 1234567', href: 'tel:+393331234567', matchWith: '3331234567' },
    { input: '+41 79 123 45 67', href: 'tel:+41791234567', normalizedIncludes: '+41' },
    { input: '+33 6 12 34 56 78', href: 'tel:+33612345678', matchWith: '+33612345678' },
    { input: '+1 212 555 0100', href: 'tel:+12125550100' },
  ]

  for (const item of cases) {
    const href = telHref(item.input)
    if (href !== item.href) {
      throw new Error(`telHref(${JSON.stringify(item.input)}) → ${href}, atteso ${item.href}`)
    }
    if (item.matchWith && !phonesMatch(item.input, item.matchWith)) {
      throw new Error(`phonesMatch fallito per ${item.input} / ${item.matchWith}`)
    }
    if (item.normalizedIncludes) {
      const normalized = normalizeItalianPhone(item.input)
      if (!normalized.includes(item.normalizedIncludes)) {
        throw new Error(`normalize(${item.input}) = ${normalized}, atteso include ${item.normalizedIncludes}`)
      }
    }
  }

  // Estero non deve collidere con italiano “stesse cifre nazionali”
  if (phonesMatch('+41791234567', '791234567')) {
    throw new Error('Un numero CH non deve matchare un nazionale IT senza prefisso corretto')
  }
}

if (import.meta.env.DEV) {
  runPhoneSelfChecks()
}
