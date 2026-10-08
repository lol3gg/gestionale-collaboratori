import type { ReactNode } from 'react'
import { telHref } from '../../lib/phone'
import { formatDate } from '../../lib/format'
import { websiteHref, websiteLabel, type CompanySortKey } from '../../lib/companies'
import type { Collaborator, Company } from '../../types'
import { Table, type Column } from '../ui/Table'
import { CompanyStatusBadge } from './CompanyStatusBadge'

type SortState = {
  key: CompanySortKey
  dir: 'asc' | 'desc'
}

type CompanyTableProps = {
  rows: Company[]
  people: Collaborator[]
  showEmail: boolean
  showEmployees: boolean
  sort: SortState
  onSort: (key: CompanySortKey) => void
  selectable: boolean
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
  onTogglePage: (checked: boolean) => void
  onOpen: (company: Company) => void
}

function assigneeLabel(id: string | null, people: Collaborator[]): string {
  if (!id) return 'Non assegnata'
  const person = people.find((item) => item.id === id)
  if (!person) return 'Sconosciuto'
  return person.active ? person.full_name : `${person.full_name} (disattivo)`
}

function SortButton({
  label,
  column,
  sort,
  onSort,
}: {
  label: string
  column: CompanySortKey
  sort: SortState
  onSort: (key: CompanySortKey) => void
}) {
  const active = sort.key === column
  return (
    <button type="button" className="inline-flex items-center gap-1" onClick={() => onSort(column)}>
      {label}
      <span aria-hidden="true">{active ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
      {active ? <span className="sr-only">{sort.dir === 'asc' ? 'crescente' : 'decrescente'}</span> : null}
    </button>
  )
}

export function CompanyTable({
  rows,
  people,
  showEmail,
  showEmployees,
  sort,
  onSort,
  selectable,
  selected,
  onToggle,
  onTogglePage,
  onOpen,
}: CompanyTableProps) {
  const pageIds = rows.map((row) => row.id)
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  const columns: Column<Company>[] = []

  if (selectable) {
    columns.push({
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          aria-label="Seleziona le aziende di questa pagina"
          onChange={(event) => onTogglePage(event.target.checked)}
        />
      ),
      cell: (row) => (
        <input
          type="checkbox"
          checked={selected.has(row.id)}
          aria-label={`Seleziona ${row.name}`}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggle(row.id)}
        />
      ),
    })
  }

  const sortHeader = (label: string, column: CompanySortKey): ReactNode => (
    <SortButton label={label} column={column} sort={sort} onSort={onSort} />
  )

  columns.push(
    {
      key: 'name',
      header: sortHeader('Nome', 'name'),
      cell: (row) => <span className="font-medium text-ink">{row.name}</span>,
    },
    { key: 'city', header: sortHeader('Città', 'city'), cell: (row) => row.city || '—' },
    { key: 'province', header: sortHeader('Provincia', 'province'), cell: (row) => row.province || '—' },
    {
      key: 'phone',
      header: sortHeader('Telefono', 'phone'),
      cell: (row) =>
        row.phone ? (
          <a
            href={telHref(row.phone)}
            className="text-primary-700 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.phone}
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'website',
      header: sortHeader('Sito', 'website'),
      cell: (row) => {
        const href = websiteHref(row.website)
        if (!href) return row.website || '—'
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary-700 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {websiteLabel(row.website)}
          </a>
        )
      },
    },
  )

  if (showEmail) {
    columns.push({
      key: 'email',
      header: sortHeader('Email', 'email'),
      cell: (row) => row.email ?? '—',
    })
  }

  if (showEmployees) {
    columns.push({
      key: 'employees',
      header: sortHeader('Dipendenti', 'employees'),
      className: 'text-right',
      cell: (row) => (row.employees === null ? '—' : <span className="tabular-nums">{row.employees}</span>),
    })
  }

  columns.push(
    {
      key: 'status',
      header: sortHeader('Stato', 'status'),
      cell: (row) => <CompanyStatusBadge status={row.status} />,
    },
    {
      key: 'assignee',
      header: sortHeader('Assegnato a', 'assignee'),
      cell: (row) => assigneeLabel(row.assignee_id, people),
    },
    {
      key: 'created_at',
      header: sortHeader('Data inserimento', 'created_at'),
      cell: (row) => formatDate(row.created_at),
    },
  )

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="card-surface p-4">
            <div className="flex items-start gap-3">
              {selectable ? (
                <input
                  type="checkbox"
                  className="mt-2 h-5 w-5"
                  checked={selected.has(row.id)}
                  aria-label={`Seleziona ${row.name}`}
                  onChange={() => onToggle(row.id)}
                />
              ) : null}
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(row)}>
                <span className="block break-words text-base font-semibold tracking-tight text-ink">{row.name}</span>
                <span className="mt-1 block text-[15px] text-muted">
                  {row.city} ({row.province})
                </span>
              </button>
              <CompanyStatusBadge status={row.status} />
            </div>
            {row.phone ? (
              <a href={telHref(row.phone)} className="mt-3 block text-lg font-semibold text-primary-700">
                {row.phone}
              </a>
            ) : (
              <p className="mt-3 text-[15px] text-muted">Nessun telefono</p>
            )}
            <p className="mt-2 text-[15px] text-muted">
              {row.assignee_id ? `Assegnata a ${assigneeLabel(row.assignee_id, people)}` : 'Nel pool'}
            </p>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          onRowClick={onOpen}
          rowClassName={(row) => (selected.has(row.id) ? 'bg-primary-50/70' : '')}
        />
      </div>
    </>
  )
}

export function companyAssigneeLabel(id: string | null, people: Collaborator[]): string {
  return assigneeLabel(id, people)
}
