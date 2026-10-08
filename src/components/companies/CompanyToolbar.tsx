import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { COMPANY_STATUSES, type Collaborator, type Company, type CompanyStatus } from '../../types'
import { statusLabel } from '../../lib/labels'
import { controlClassName } from '../ui/Input'
import { Button } from '../ui/Button'
import type { CompanyListFilters } from '../../lib/companies'

type CompanyToolbarProps = {
  filters: CompanyListFilters
  companies: Company[]
  people: Collaborator[]
  isAdmin: boolean
  showEmail: boolean
  showEmployees: boolean
  onFilters: (patch: Partial<CompanyListFilters>) => void
  onToggleEmail: (value: boolean) => void
  onToggleEmployees: (value: boolean) => void
  onReset: () => void
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ''))].sort((left, right) => left.localeCompare(right, 'it'))
}

export function CompanyToolbar({
  filters,
  companies,
  people,
  isAdmin,
  showEmail,
  showEmployees,
  onFilters,
  onToggleEmail,
  onToggleEmployees,
  onReset,
}: CompanyToolbarProps) {
  const [columnsOpen, setColumnsOpen] = useState(false)
  const columnsRef = useRef<HTMLDivElement>(null)
  const regions = useMemo(() => unique(companies.map((company) => company.region)), [companies])
  const provinces = useMemo(() => {
    const source = filters.region === 'all' ? companies : companies.filter((company) => company.region === filters.region)
    return unique(source.map((company) => company.province))
  }, [companies, filters.region])

  useEffect(() => {
    if (!columnsOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!(event.target instanceof Node) || !columnsRef.current?.contains(event.target)) {
        setColumnsOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [columnsOpen])

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 block text-sm font-medium text-ink">Cerca</span>
          <input
            value={filters.search}
            aria-label="Cerca per nome o città"
            placeholder="Nome o città"
            className={controlClassName}
            onChange={(event) => onFilters({ search: event.target.value })}
          />
        </label>
        <div className="relative" ref={columnsRef}>
          <Button variant="secondary" aria-expanded={columnsOpen} onClick={() => setColumnsOpen((open) => !open)}>
            Colonne
          </Button>
          {columnsOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-line bg-surface p-3 shadow-lg">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={showEmail} onChange={(event) => onToggleEmail(event.target.checked)} />
                Email
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={showEmployees}
                  onChange={(event) => onToggleEmployees(event.target.checked)}
                />
                Dipendenti
              </label>
            </div>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FilterSelect
          label="Stato"
          value={filters.status}
          onChange={(value) => onFilters({ status: isStatus(value) ? value : 'all' })}
        >
          <option value="all">Tutti gli stati</option>
          {COMPANY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Regione"
          value={filters.region}
          onChange={(value) => onFilters({ region: value, province: 'all' })}
        >
          <option value="all">Tutte le regioni</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Provincia" value={filters.province} onChange={(value) => onFilters({ province: value })}>
          <option value="all">Tutte le province</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </FilterSelect>
        {isAdmin ? (
          <FilterSelect label="Assegnato a" value={filters.assignee} onChange={(value) => onFilters({ assignee: value })}>
            <option value="all">Tutti</option>
            <option value="none">Non assegnate</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.active ? person.full_name : `${person.full_name} (disattivo)`}
              </option>
            ))}
          </FilterSelect>
        ) : null}
        <FilterSelect label="Telefono" value={filters.phone} onChange={(value) => onFilters({ phone: isPhone(value) ? value : 'all' })}>
          <option value="all">Con e senza</option>
          <option value="yes">Con telefono</option>
          <option value="no">Senza telefono</option>
        </FilterSelect>
      </div>
      <div>
        <Button variant="ghost" className="px-2" onClick={onReset}>
          Azzera filtri
        </Button>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <select className={controlClassName} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  )
}

function isStatus(value: string): value is CompanyStatus | 'all' {
  return value === 'all' || COMPANY_STATUSES.some((status) => status === value)
}

function isPhone(value: string): value is CompanyListFilters['phone'] {
  return value === 'all' || value === 'yes' || value === 'no'
}
