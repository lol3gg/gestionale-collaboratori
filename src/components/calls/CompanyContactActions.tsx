import { Copy, Mail, MessageCircle, Phone } from 'lucide-react'
import { websiteHref, websiteLabel } from '../../lib/companies'
import { internationalDigits, telHref, waHref } from '../../lib/phone'
import { useToast } from '../ui/Toast'
import { Button } from '../ui/Button'

type CompanyContactActionsProps = {
  phone: string
  email: string | null
  website: string
  hugeCall?: boolean
}

export function CompanyContactActions({ phone, email, website, hugeCall }: CompanyContactActionsProps) {
  const toast = useToast()
  const phoneLink = telHref(phone)
  const whatsapp = waHref(phone)
  const site = websiteHref(website)

  const copyPhone = async () => {
    const digits = internationalDigits(phone)
    const text = digits ? `+${digits}` : phone
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Numero copiato')
    } catch {
      toast.error('Impossibile copiare il numero')
    }
  }

  return (
    <div className="space-y-2">
      {phone ? (
        <p className={`font-semibold tabular-nums text-ink ${hugeCall ? 'text-lg' : 'text-[15px]'}`}>{phone}</p>
      ) : (
        <p className="text-[15px] text-muted">Nessun telefono</p>
      )}

      {phoneLink ? (
        <a
          href={phoneLink}
          className={`btn-primary-solid flex w-full items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition duration-150 active:scale-[0.98] ${
            hugeCall ? 'min-h-16 text-lg' : 'min-h-12 px-4 text-base'
          }`}
        >
          <Phone className={hugeCall ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden="true" />
          Chiama
        </a>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2 text-sm font-medium text-ink hover:bg-canvas"
          >
            <MessageCircle className="h-4 w-4 text-success-fg" aria-hidden="true" />
            WhatsApp
          </a>
        ) : null}
        {email ? (
          <a
            href={`mailto:${email}`}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2 text-sm font-medium text-ink hover:bg-canvas"
          >
            <Mail className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Email
          </a>
        ) : null}
        {phone ? (
          <Button variant="secondary" className="min-h-11 gap-1.5 border border-line text-sm" onClick={() => void copyPhone()}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copia
          </Button>
        ) : null}
        {site ? (
          <a
            href={site}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 truncate rounded-xl border border-line bg-surface px-2 text-sm font-medium text-primary-700 hover:bg-canvas"
          >
            {websiteLabel(website)}
          </a>
        ) : null}
      </div>
    </div>
  )
}
