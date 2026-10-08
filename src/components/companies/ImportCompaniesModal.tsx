import { useMemo, useRef, useState } from 'react'
import type { Company, DuplicatePolicy, ImportResult, Profile } from '../../types'
import {
  IMPORT_FIELDS,
  duplicateReasonLabel,
  emptyMapping,
  guessMapping,
  importFieldLabel,
  prepareImport,
  type ColumnMapping,
} from '../../lib/companies'
import { parseCsv, type CsvTable } from '../../lib/csv'
import { useImportCompanies } from '../../hooks/useCompanies'
import { useToast } from '../ui/Toast'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Input'

type ImportStep = 'map' | 'review' | 'done'

type ImportCompaniesModalProps = {
  open: boolean
  profile: Profile
  companies: Company[]
  onClose: () => void
}

export function ImportCompaniesModal({ open, profile, companies, onClose }: ImportCompaniesModalProps) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const importCompanies = useImportCompanies(profile)
  const [fileName, setFileName] = useState('')
  const [table, setTable] = useState<CsvTable | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping())
  const [step, setStep] = useState<ImportStep>('map')
  const [policy, setPolicy] = useState<DuplicatePolicy>('skip')
  const [result, setResult] = useState<ImportResult | null>(null)

  const prepared = useMemo(
    () => (table ? prepareImport(table, mapping, companies) : null),
    [table, mapping, companies],
  )

  const reset = () => {
    setFileName('')
    setTable(null)
    setMapping(emptyMapping())
    setStep('map')
    setPolicy('skip')
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const preview = table?.rows.slice(0, 5) ?? []

  return (
    <Modal
      open={open}
      title="Importa CSV"
      description="Carica un file, collega le colonne e scegli come trattare i doppioni."
      onClose={close}
      size="xl"
      footer={
        step === 'done' ? (
          <Button onClick={close}>Chiudi</Button>
        ) : step === 'review' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('map')}>
              Indietro
            </Button>
            <Button
              loading={importCompanies.isPending}
              disabled={!prepared || prepared.rows.length === 0}
              onClick={() => {
                if (!prepared) return
                importCompanies.mutate(
                  { rows: prepared.rows, policy },
                  {
                    onSuccess: (value) => {
                      setResult({ ...value, errors: [...prepared.errors, ...value.errors] })
                      setStep('done')
                    },
                  },
                )
              }}
            >
              Importa
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Annulla
            </Button>
            <Button
              disabled={!table || mapping.name === ''}
              onClick={() => setStep('review')}
            >
              Controlla doppioni
            </Button>
          </>
        )
      }
    >
      {step === 'map' ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                if (file.size > 2_000_000) {
                  toast.error('Il file è troppo grande')
                  return
                }
                void file.text().then((text) => {
                  const parsed = parseCsv(text)
                  if (parsed.headers.length === 0) {
                    toast.error('Il file non contiene intestazioni')
                    return
                  }
                  setFileName(file.name)
                  setTable(parsed)
                  setMapping(guessMapping(parsed.headers))
                  setStep('map')
                  setResult(null)
                })
              }}
            />
            <Button variant="secondary" onClick={() => inputRef.current?.click()}>
              Scegli file
            </Button>
            <a href="/esempio-aziende.csv" download className="text-sm font-medium text-primary-700 hover:underline">
              Scarica il CSV di esempio
            </a>
            {fileName ? <span className="text-sm text-muted">{fileName}</span> : null}
          </div>

          {table ? (
            <>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Anteprima</h3>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-canvas text-muted">
                      <tr>
                        {table.headers.map((header) => (
                          <th key={header} className="whitespace-nowrap px-3 py-2 font-medium">
                            {header || '—'}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row) => (
                        <tr key={row.line} className="border-t border-line">
                          {table.headers.map((header, index) => (
                            <td key={`${row.line}-${header}`} className="whitespace-nowrap px-3 py-2 text-ink">
                              {row.cells[index] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Prime {preview.length} righe di {table.rows.length}.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {IMPORT_FIELDS.map((field) => (
                  <Select
                    key={field}
                    label={importFieldLabel[field]}
                    value={mapping[field]}
                    onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}
                  >
                    <option value="">{field === 'name' ? 'Collega una colonna' : 'Non importare'}</option>
                    {table.headers.map((header) => (
                      <option key={`${field}-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </Select>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Nessun file selezionato. Il separatore può essere il punto e virgola o la virgola.</p>
          )}
        </div>
      ) : null}

      {step === 'review' && prepared ? (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            {prepared.rows.length} righe pronte, {prepared.duplicates.length} doppioni, {prepared.errors.length} errori.
          </p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Doppioni</legend>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="policy" checked={policy === 'skip'} onChange={() => setPolicy('skip')} />
              Salta
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="policy" checked={policy === 'update'} onChange={() => setPolicy('update')} />
              Aggiorna i dati anagrafici
            </label>
          </fieldset>
          {prepared.duplicates.length === 0 ? (
            <p className="text-sm text-muted">Nessun doppione rispetto alle aziende già presenti.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {prepared.duplicates.map((item) => (
                <li key={`${item.line}-${item.reason}`} className="rounded-lg bg-warning-bg px-3 py-2 text-warning-fg">
                  Riga {item.line}: {item.name}. {duplicateReasonLabel(item.reason)} di {item.matchName}
                  {item.matchCity ? ` (${item.matchCity})` : ''}.
                </li>
              ))}
            </ul>
          )}
          {prepared.errors.length > 0 ? (
            <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
              {prepared.errors.map((item) => (
                <li key={`${item.line}-${item.message}`} className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
                  Riga {item.line}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {step === 'done' && result ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Summary label="Importate" value={result.imported} />
            <Summary label="Aggiornate" value={result.updated} />
            <Summary label="Saltate" value={result.skipped} />
            <Summary label="Errori" value={result.errors.length} />
          </dl>
          {result.errors.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {result.errors.map((item) => (
                <li key={`${item.line}-${item.message}`} className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
                  Riga {item.line}: {item.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nessun errore nelle righe inviate.</p>
          )}
        </div>
      ) : null}
    </Modal>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line px-3 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-ink">{value}</dd>
    </div>
  )
}
