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

  if (!collapsible) return <div className="mb-4">{fields}</div>

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          Filtri
          {active ? <span className="ml-2 text-xs font-normal text-indigo-700">attivi</span> : null}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="border-t border-slate-100 px-3 pb-3">{fields}</div> : null}
    </div>
  )
}
