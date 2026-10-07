import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Input, Select } from '../ui/Input'

type CallQueueFiltersProps = {
  query: string
  region: string
  province: string
  city: string
  regions: string[]
  provinces: string[]
  cities: string[]
  collapsible?: boolean
  onQuery: (value: string) => void
  onRegion: (value: string) => void
  onProvince: (value: string) => void
  onCity: (value: string) => void
}

export function CallQueueFilters({
  query,
  region,
  province,
  city,
  regions,
  provinces,
  cities,
  collapsible = false,
  onQuery,
  onRegion,
  onProvince,
  onCity,
}: CallQueueFiltersProps) {
  const [open, setOpen] = useState(false)
  const active = Boolean(query || region || province || city)

  const fields = (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${collapsible ? 'pt-3' : ''}`}>
      <Input label="Cerca per nome" value={query} placeholder="Nome azienda" onChange={(event) => onQuery(event.target.value)} />
      <Select
        label="Regione"
        value={region}
        onChange={(event) => {
          onRegion(event.target.value)
          onProvince('')
          onCity('')
        }}
      >
        <option value="">Tutte</option>
        {regions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
      <Select
        label="Provincia"
        value={province}
        onChange={(event) => {
          onProvince(event.target.value)
          onCity('')
        }}
      >
        <option value="">Tutte</option>
        {provinces.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
      <Select label="Città" value={city} onChange={(event) => onCity(event.target.value)}>
        <option value="">Tutte</option>
        {cities.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
    </div>
  )

  if (!collapsible) {
    return (
      <div className="mb-4 rounded-xl border border-line bg-surface p-3 shadow-card sm:p-4">
        {fields}
      </div>
    )
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-2 bg-surface px-3.5 py-2.5 text-left text-[15px] font-semibold text-ink transition-colors hover:bg-canvas"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          Filtri
          {active ? (
            <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
              attivi
            </span>
          ) : null}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="border-t border-line bg-canvas/60 px-3.5 pb-3.5">{fields}</div> : null}
    </div>
  )
}
