export type CsvRow = {
  line: number
  cells: string[]
}

export type CsvTable = {
  headers: string[]
  rows: CsvRow[]
}

function delimiterOf(headerLine: string): ',' | ';' {
  const semicolons = headerLine.match(/;/g)?.length ?? 0
  const commas = headerLine.match(/,/g)?.length ?? 0
  return semicolons >= commas ? ';' : ','
}

function parseRecords(text: string, delimiter: ',' | ';'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char ?? ''
      }
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === delimiter) {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += char ?? ''
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export function parseCsv(text: string): CsvTable {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const firstLine = cleaned.split('\n').find((line) => line.trim().length > 0) ?? ''
  const records = parseRecords(cleaned, delimiterOf(firstLine))
  const occupied = records
    .map((cells, index) => ({ line: index + 1, cells }))
    .filter((row) => row.cells.some((value) => value.trim() !== ''))
  const header = occupied[0]
  if (!header) return { headers: [], rows: [] }
  return {
    headers: header.cells.map((value) => value.trim()),
    rows: occupied.slice(1).map((row) => ({
      line: row.line,
      cells: row.cells,
    })),
  }
}

function escapeCell(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => escapeCell(cell)).join(';'))
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
