import type { CompanyFormErrors, CompanyFormInput } from '../../lib/companies'
import { Input } from '../ui/Input'

type CompanyFieldsProps = {
  value: CompanyFormInput
  errors: CompanyFormErrors
  onChange: (patch: Partial<CompanyFormInput>) => void
  disabled?: boolean
}

export function CompanyFields({ value, errors, onChange, disabled = false }: CompanyFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Input
          label="Nome"
          value={value.name}
          disabled={disabled}
          error={errors.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>
      <Input
        label="Telefono"
        value={value.phone}
        disabled={disabled}
        error={errors.phone}
        onChange={(event) => onChange({ phone: event.target.value })}
      />
      <Input
        label="Email"
        type="email"
        value={value.email}
        disabled={disabled}
        error={errors.email}
        onChange={(event) => onChange({ email: event.target.value })}
      />
      <div className="sm:col-span-2">
        <Input
          label="Sito"
          value={value.website}
          disabled={disabled}
          error={errors.website}
          onChange={(event) => onChange({ website: event.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Input
          label="Indirizzo"
          value={value.address}
          disabled={disabled}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </div>
      <Input
        label="Città"
        value={value.city}
        disabled={disabled}
        onChange={(event) => onChange({ city: event.target.value })}
      />
      <Input
        label="Provincia"
        value={value.province}
        disabled={disabled}
        onChange={(event) => onChange({ province: event.target.value })}
      />
      <Input
        label="Regione"
        value={value.region}
        disabled={disabled}
        onChange={(event) => onChange({ region: event.target.value })}
      />
      <Input
        label="Dipendenti"
        inputMode="numeric"
        value={value.employees}
        disabled={disabled}
        error={errors.employees}
        onChange={(event) => onChange({ employees: event.target.value })}
      />
    </div>
  )
}
