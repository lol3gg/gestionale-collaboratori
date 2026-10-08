import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { CompanyBulkDialogs, type BulkAction } from '../components/companies/CompanyBulkDialogs'
import { CompanyDrawer } from '../components/companies/CompanyDrawer'
import { CompanyFormModal } from '../components/companies/CompanyFormModal'
import { CompanyTable, companyAssigneeLabel } from '../components/companies/CompanyTable'
import { CompanyToolbar } from '../components/companies/CompanyToolbar'
import { ImportCompaniesModal } from '../components/companies/ImportCompaniesModal'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useCollaborators } from '../hooks/useCollaborators'
import { useCompanies } from '../hooks/useCompanies'
import { useProfile } from '../hooks/useProfile'
import { type CompanyListFilters, type CompanySortKey } from '../lib/companies'
import { downloadCsv } from '../lib/csv'
import { formatDate } from '../lib/format'
import { statusLabel } from '../lib/labels'
import { errorMessage } from '../lib/validators'
import type { Company, CompanyListParams } from '../types'

const PAGE_SIZE = 25
const emptyCompanies: Company[] = []

const initialFilters: CompanyListFilters = {
  search: '',
  status: 'all',
  region: 'all',
  province: 'all',
  assignee: 'all',
  phone: 'all',
}

function filtersActive(filters: CompanyListFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.region !== 'all' ||
    filters.province !== 'all' ||
    filters.assignee !== 'all' ||
    filters.phone !== 'all'
  )
}

export function AziendePage() {
  const toast = useToast()
  const { profile, loading } = useProfile()
  const peopleQuery = useCollaborators()
  const [filters, setFilters] = useState<CompanyListFilters>(initialFilters)
  const [sort, setSort] = useState<{ key: CompanySortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [showEmail, setShowEmail] = useState(false)
  const [showEmployees, setShowEmployees] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [bulk, setBulk] = useState<BulkAction | null>(null)

  const isAdmin = profile?.role === 'admin'
  const people = peopleQuery.data ?? []

  const visibleFilters = useMemo<CompanyListFilters>(
    () => ({ ...filters, assignee: isAdmin ? filters.assignee : 'all' }),
    [filters, isAdmin],
  )

  const listParams = useMemo<CompanyListParams>(
    () => ({
      search: visibleFilters.search,
      status: visibleFilters.status,
      region: visibleFilters.region,
      province: visibleFilters.province,
      assignee: visibleFilters.assignee,
      phone: visibleFilters.phone,
      sortKey: sort.key,
      sortDir: sort.dir,
      page,
      pageSize: PAGE_SIZE,
    }),
    [visibleFilters, sort, page],
  )

  const query = useCompanies(profile, listParams)
  const companies = query.data?.companies ?? emptyCompanies
  const total = query.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)

  const assigneeName = (id: string | null) => companyAssigneeLabel(id, people)
  const openCompany = companies.find((company) => company.id === openId) ?? null

  useEffect(() => {
    setPage(0)
  }, [filters, sort])

  useEffect(() => {
    const ids = new Set(companies.map((company) => company.id))
    setSelected((current) => {
      const next = current.filter((id) => ids.has(id))
      return next.length === current.length ? current : next
    })
    if (openId && !ids.has(openId)) setOpenId(null)
  }, [companies, openId])

  const exportRows = () => {
    downloadCsv(
      'aziende.csv',
      [
        'nome',
        'città',
        'provincia',
        'regione',
        'indirizzo',
        'telefono',
        'email',
        'sito',
        'dipendenti',
        'stato',
        'assegnato a',
        'data inserimento',
      ],
      companies.map((company) => [
        company.name,
        company.city,
        company.province,
        company.region,
        company.address ?? '',
        company.phone,
        company.email ?? '',
        company.website,
        company.employees === null ? '' : String(company.employees),
        statusLabel(company.status),
        assigneeName(company.assignee_id),
        formatDate(company.created_at),
      ]),
    )
    toast.success('CSV esportato (pagina corrente)')
  }

  if (loading || !profile || query.isPending) {
    return (
      <section>
        <PageHeader title="Aziende" />
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-primary-600" />
        </div>
      </section>
    )
  }

  return (
    <section>
      <PageHeader
        title="Aziende"
        description="Tutte le aziende del portafoglio."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              Importa CSV
            </Button>
            <Button variant="secondary" disabled={companies.length === 0} onClick={exportRows}>
              Esporta CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)}>Aggiungi azienda</Button>
          </div>
        }
      />

      {query.isError ? (
        <EmptyState
          title="Impossibile caricare le aziende"
          description={errorMessage(query.error)}
          action={<Button onClick={() => void query.refetch()}>Riprova</Button>}
        />
      ) : (
        <>
          <CompanyToolbar
            filters={filters}
            companies={companies}
            people={people}
            isAdmin={isAdmin}
            showEmail={showEmail}
            showEmployees={showEmployees}
            onFilters={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onToggleEmail={setShowEmail}
            onToggleEmployees={setShowEmployees}
            onReset={() => setFilters(initialFilters)}
          />

          {selected.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3">
              <span className="text-sm font-medium text-primary-900">{selected.length} selezionate</span>
              <Button variant="secondary" onClick={() => setBulk('assign')}>
                Assegna
              </Button>
              <Button variant="secondary" onClick={() => setBulk('status')}>
                Cambia stato
              </Button>
              <Button variant="danger" onClick={() => setBulk('delete')}>
                Elimina
              </Button>
              <Button variant="ghost" onClick={() => setSelected([])}>
                Annulla
              </Button>
            </div>
          ) : null}

          {total === 0 ? (
            <EmptyState
              title={filtersActive(visibleFilters) ? 'Nessun risultato' : 'Nessuna azienda'}
              description={
                filtersActive(visibleFilters)
                  ? 'Nessuna azienda corrisponde ai filtri.'
                  : 'Aggiungi un’azienda o importa un CSV.'
              }
              action={
                filtersActive(visibleFilters) ? (
                  <Button variant="secondary" onClick={() => setFilters(initialFilters)}>
                    Azzera filtri
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <CompanyTable
                rows={companies}
                people={people}
                showEmail={showEmail}
                showEmployees={showEmployees}
                sort={sort}
                onSort={(key) =>
                  setSort((current) =>
                    current.key === key
                      ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
                      : { key, dir: 'asc' },
                  )
                }
                selectable
                selected={new Set(selected)}
                onToggle={(id) =>
                  setSelected((current) =>
                    current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                  )
                }
                onTogglePage={(checked) => {
                  const pageIds = companies.map((row) => row.id)
                  setSelected((current) =>
                    checked
                      ? [...new Set([...current, ...pageIds])]
                      : current.filter((id) => !pageIds.includes(id)),
                  )
                }}
                onOpen={(company: Company) => setOpenId(company.id)}
              />
              <div className="mt-4 flex flex-col gap-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {total === 0
                    ? '0'
                    : `${safePage * PAGE_SIZE + 1}–${Math.min(total, safePage * PAGE_SIZE + PAGE_SIZE)} di ${total}`}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                    Precedente
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Successiva
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <CompanyDrawer company={openCompany} people={people} profile={profile} onClose={() => setOpenId(null)} />
      <CompanyFormModal open={createOpen} profile={profile} people={people} onClose={() => setCreateOpen(false)} />
      <ImportCompaniesModal
        open={importOpen}
        profile={profile}
        companies={companies}
        onClose={() => setImportOpen(false)}
      />
      <CompanyBulkDialogs
        action={bulk}
        companies={companies}
        people={people}
        profile={profile}
        selectedIds={selected}
        onClose={() => setBulk(null)}
        onDone={() => setSelected([])}
      />
    </section>
  )
}
