import type { ReactNode } from 'react'

export type Column<T> = {
  key: string
  header: ReactNode
  className?: string
  cell: (row: T) => ReactNode
  /** Shown on mobile card layout; defaults to header text when string */
  mobileLabel?: string
  /** Hide this column from mobile cards */
  hideOnMobile?: boolean
}

type TableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string
  /** Custom mobile card renderer; if omitted, auto-builds from columns */
  renderMobileCard?: (row: T) => ReactNode
}

function labelOf(column: Column<unknown>): string | null {
  if (column.mobileLabel) return column.mobileLabel
  if (typeof column.header === 'string') return column.header
  return null
}

export function Table<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  rowClassName,
  renderMobileCard,
}: TableProps<T>) {
  const mobileColumns = columns.filter((column) => !column.hideOnMobile)

  return (
    <>
      {/* Mobile cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)}>
            {renderMobileCard ? (
              renderMobileCard(row)
            ) : (
              <button
                type="button"
                className={`card-surface flex w-full flex-col gap-2 p-4 text-left transition duration-150 active:scale-[0.99] ${
                  onRowClick ? '' : 'cursor-default'
                } ${rowClassName?.(row) ?? ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                disabled={!onRowClick}
              >
                {mobileColumns.map((column) => {
                  const label = labelOf(column as Column<unknown>)
                  return (
                    <div key={column.key} className="min-w-0">
                      {label ? <p className="text-xs font-medium text-muted">{label}</p> : null}
                      <div className="text-[15px] text-ink">{column.cell(row)}</div>
                    </div>
                  )
                })}
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="card-surface hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[15px]">
            <thead className="bg-canvas text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className={`whitespace-nowrap px-4 py-3 ${column.className ?? ''}`}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className={`align-middle transition-colors duration-150 hover:bg-canvas/80 ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(row) ?? ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3.5 text-ink ${column.className ?? ''}`}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
