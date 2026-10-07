import type {
  CallLog,
  Company,
  CompanyNote,
  CompanyStatus,
  ExplanationBooking,
  ExplanationExtraSlot,
  Profile,
} from '../../types'
import { explanationSlots, slotBounds } from '../calendar'
import { DEMO_ADMIN_ID, DEMO_GIULIA_ID, DEMO_LUCA_ID, DEMO_MARCO_ID, DEMO_STORE_VERSION } from './ids'

const MARCO = DEMO_MARCO_ID
const GIULIA = DEMO_GIULIA_ID
const LUCA = DEMO_LUCA_ID

type SeedRow = [
  name: string,
  city: string,
  province: string,
  region: string,
  status: CompanyStatus,
  assigneeId: string | null,
  email: string | null,
  employees: number | null,
]

const rows: SeedRow[] = [
  ['Impresa Edile Martini', 'Milano', 'MI', 'Lombardia', 'accettato', MARCO, 'info@impresamartini.it', 42],
  ['Costruzioni Alpine', 'Brescia', 'BS', 'Lombardia', 'non_risponde', MARCO, null, 18],
  ['Edilfutura', 'Bergamo', 'BG', 'Lombardia', 'da_chiamare', GIULIA, null, null],
  ['Laterizi del Nord', 'Monza', 'MB', 'Lombardia', 'rifiutato', LUCA, null, null],
  ['Cantiere Aperto', 'Torino', 'TO', 'Piemonte', 'da_chiamare', MARCO, 'ufficio@cantiereaperto.it', null],
  ['Muratori Associati', 'Novara', 'NO', 'Piemonte', 'da_richiamare', GIULIA, null, 27],
  ['Strutture e Fondamenta', 'Verona', 'VR', 'Veneto', 'da_chiamare', null, null, null],
  ['Edilizia Pontina', 'Padova', 'PD', 'Veneto', 'da_richiamare', MARCO, null, null],
  ['Cementi Tirreni', 'Venezia', 'VE', 'Veneto', 'accettato', GIULIA, 'contatti@cementitirreni.it', 64],
  ['Casa Nuova Costruzioni', 'Vicenza', 'VI', 'Veneto', 'numero_errato', LUCA, null, null],
  ['Impresa Fratelli Conti', 'Bologna', 'BO', 'Emilia-Romagna', 'da_chiamare', null, null, null],
  ['Ristrutturazioni Mediterranee', 'Modena', 'MO', 'Emilia-Romagna', 'non_risponde', MARCO, null, 15],
  ['Solai e Coperture', 'Parma', 'PR', 'Emilia-Romagna', 'rifiutato', GIULIA, null, null],
  ['Edilprogetti', 'Reggio Emilia', 'RE', 'Emilia-Romagna', 'da_chiamare', null, null, null],
  ['Costruzioni Vesuvio', 'Firenze', 'FI', 'Toscana', 'accettato', MARCO, 'segreteria@costruzionivesuvio.it', null],
  ['Impresa Adriatica', 'Prato', 'PO', 'Toscana', 'da_chiamare', GIULIA, null, 33],
  ['Mattone Vivo', 'Pisa', 'PI', 'Toscana', 'numero_errato', LUCA, null, null],
  ['Cantieri del Garda', 'Roma', 'RM', 'Lazio', 'da_chiamare', null, null, null],
  ['Edilizia Etnea', 'Latina', 'LT', 'Lazio', 'non_risponde', MARCO, null, null],
  ['Fondamenta Padane', 'Napoli', 'NA', 'Campania', 'accettato', GIULIA, 'info@fondamentapadane.it', null],
  ['Nuovi Spazi', 'Salerno', 'SA', 'Campania', 'da_chiamare', null, null, null],
  ['Impresa Lagunare', 'Bari', 'BA', 'Puglia', 'da_richiamare', MARCO, null, null],
  ['Costruzioni Appennino', 'Lecce', 'LE', 'Puglia', 'rifiutato', LUCA, null, null],
  ['Edilsud', 'Palermo', 'PA', 'Sicilia', 'accettato', GIULIA, null, 51],
  ['Capitelli e Travi', 'Catania', 'CT', 'Sicilia', 'da_chiamare', null, null, null],
  ['Impresa Ionica', 'Reggio Calabria', 'RC', 'Calabria', 'da_chiamare', MARCO, null, null],
  ['Cantiere Reale', 'Genova', 'GE', 'Liguria', 'da_chiamare', null, null, null],
  ['Edilizia Sabina', 'Ancona', 'AN', 'Marche', 'da_richiamare', GIULIA, 'hello@ediliziasabina.it', null],
  ['Costruzioni Orobiche', 'Perugia', 'PG', 'Umbria', 'non_risponde', MARCO, null, null],
  ['Impresa del Po', 'Pescara', 'PE', 'Abruzzo', 'numero_errato', LUCA, null, null],
  ['Pietre di Sardegna', 'Cagliari', 'CA', 'Sardegna', 'da_chiamare', null, null, 22],
  ['Edilnova', 'Udine', 'UD', 'Friuli-Venezia Giulia', 'da_chiamare', MARCO, null, null],
  ['Muri e Design', 'Trieste', 'TS', 'Friuli-Venezia Giulia', 'da_chiamare', GIULIA, null, null],
  ['Impresa Bresciana', 'Trento', 'TN', 'Trentino-Alto Adige', 'da_chiamare', null, null, null],
  ['Tetti Rossi', 'Bolzano', 'BZ', 'Trentino-Alto Adige', 'da_richiamare', MARCO, 'info@tettirossi.it', null],
  ['Costruzioni Emiliane', 'Aosta', 'AO', "Valle d'Aosta", 'rifiutato', LUCA, null, null],
  ['Edilizia Ligure', 'Potenza', 'PZ', 'Basilicata', 'da_chiamare', MARCO, null, null],
  ['Cantieri Umbri', 'Campobasso', 'CB', 'Molise', 'da_chiamare', GIULIA, null, 11],
  ['Impresa dello Stretto', 'Sassari', 'SS', 'Sardegna', 'non_risponde', MARCO, null, null],
  ['Spazi Urbani', 'Ravenna', 'RA', 'Emilia-Romagna', 'da_chiamare', null, null, null],
]

const streets = ['Via Roma', 'Via Garibaldi', 'Corso Italia', 'Via Mazzini', 'Via Verdi', 'Via Dante']

function websiteFor(name: string): string {
  const host = name
    .toLowerCase()
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]+/g, '')
  return `https://www.${host}.it`
}

function phoneFor(index: number): string {
  const prefixes = ['02', '06', '011', '010', '051', '055', '081', '091', '080', '095']
  const prefix = prefixes[index % prefixes.length] ?? '02'
  const rest = String(4100000 + index * 173).slice(0, 7)
  return `${prefix} ${rest}`
}

function notesFor(id: string): CompanyNote[] {
  if (id === 'co-01') {
    return [
      {
        id: 'note-01',
        author_id: DEMO_ADMIN_ID,
        author_name: 'Lillo (Admin)',
        body: 'Cliente storico: richiamare per il cantiere di Rho.',
        created_at: '2025-11-02T10:30:00.000Z',
      },
      {
        id: 'note-01b',
        author_id: DEMO_MARCO_ID,
        author_name: 'Marco Rossi',
        body: 'Confermato l’appuntamento in cantiere per martedì.',
        created_at: '2026-01-20T09:15:00.000Z',
      },
    ]
  }
  if (id === 'co-02') {
    return [
      {
        id: 'note-02',
        author_id: DEMO_MARCO_ID,
        author_name: 'Marco Rossi',
        body: 'Inviato il listino, attendono un riscontro.',
        created_at: '2026-02-14T15:10:00.000Z',
      },
    ]
  }
  return []
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export function createSeed(): {
  version: number
  collaborators: Profile[]
  companies: Company[]
  callLogs: CallLog[]
  bookings: ExplanationBooking[]
  extraSlots: ExplanationExtraSlot[]
} {
  const collaborators: Profile[] = [
    {
      id: DEMO_ADMIN_ID,
      full_name: 'Lillo (Admin)',
      email: 'lillo.admin@demo.it',
      role: 'admin',
      active: true,
      created_at: '2024-01-15T09:00:00.000Z',
    },
    {
      id: DEMO_MARCO_ID,
      full_name: 'Marco Rossi',
      email: 'marco.rossi@demo.it',
      role: 'collaboratore',
      active: true,
      created_at: '2024-03-02T09:00:00.000Z',
    },
    {
      id: DEMO_GIULIA_ID,
      full_name: 'Giulia Bianchi',
      email: 'giulia.bianchi@demo.it',
      role: 'collaboratore',
      active: true,
      created_at: '2024-06-18T09:00:00.000Z',
    },
    {
      id: DEMO_LUCA_ID,
      full_name: 'Luca Verdi',
      email: 'luca.verdi@demo.it',
      role: 'collaboratore',
      active: false,
      created_at: '2025-01-09T09:00:00.000Z',
    },
  ]

  const companies: Company[] = rows.map((row, index) => {
    const [name, city, province, region, status, assigneeId, email, employees] = row
    const id = `co-${String(index + 1).padStart(2, '0')}`
    const created = new Date(Date.UTC(2024, 1, 1) + index * 14 * 24 * 60 * 60 * 1000)
    return {
      id,
      name,
      city,
      province,
      region,
      address: index % 6 === 5 ? null : `${streets[index % streets.length] ?? 'Via Roma'} ${12 + index}`,
      phone: index === 20 || index === 33 ? '' : phoneFor(index),
      website: websiteFor(name),
      status,
      assignee_id: assigneeId,
      callback_at:
        status === 'da_richiamare' ? new Date(Date.now() + (index + 1) * 8 * 60 * 60 * 1000).toISOString() : null,
      email,
      employees,
      created_at: created.toISOString(),
      notes: notesFor(id),
    }
  })

  const callbackOf = (id: string) => companies.find((company) => company.id === id)?.callback_at ?? null

  const callLogs: CallLog[] = [
    { id: 'log-01', company_id: 'co-02', user_id: MARCO, outcome: 'non_risponde', note: 'Segreteria telefonica.', callback_at: null, created_at: hoursAgo(3) },
    { id: 'log-02', company_id: 'co-02', user_id: MARCO, outcome: 'non_risponde', note: null, callback_at: null, created_at: hoursAgo(1) },
    { id: 'log-03', company_id: 'co-19', user_id: MARCO, outcome: 'non_risponde', note: 'Occupato.', callback_at: null, created_at: hoursAgo(5) },
    { id: 'log-04', company_id: 'co-12', user_id: MARCO, outcome: 'non_risponde', note: null, callback_at: null, created_at: daysAgo(2) },
    { id: 'log-05', company_id: 'co-01', user_id: MARCO, outcome: 'accettato', note: 'Interessati al sopralluogo.', callback_at: null, created_at: daysAgo(1) },
    { id: 'log-06', company_id: 'co-15', user_id: MARCO, outcome: 'accettato', note: null, callback_at: null, created_at: hoursAgo(6) },
    { id: 'log-07', company_id: 'co-08', user_id: MARCO, outcome: 'da_richiamare', note: 'Richiamare il titolare.', callback_at: callbackOf('co-08'), created_at: daysAgo(1) },
    { id: 'log-08', company_id: 'co-09', user_id: GIULIA, outcome: 'accettato', note: 'Inviare il contratto.', callback_at: null, created_at: daysAgo(1) },
    { id: 'log-09', company_id: 'co-20', user_id: GIULIA, outcome: 'accettato', note: null, callback_at: null, created_at: daysAgo(3) },
    { id: 'log-10', company_id: 'co-24', user_id: GIULIA, outcome: 'accettato', note: null, callback_at: null, created_at: hoursAgo(4) },
    { id: 'log-11', company_id: 'co-13', user_id: GIULIA, outcome: 'rifiutato', note: 'Hanno già un fornitore.', callback_at: null, created_at: daysAgo(4) },
    { id: 'log-12', company_id: 'co-04', user_id: LUCA, outcome: 'rifiutato', note: 'Non interessati.', callback_at: null, created_at: daysAgo(12) },
    { id: 'log-13', company_id: 'co-06', user_id: GIULIA, outcome: 'da_richiamare', note: 'Chiede un richiamo nel pomeriggio.', callback_at: callbackOf('co-06'), created_at: daysAgo(1) },
  ]

  const slots = explanationSlots()
  const first = slots[0]
  const second = slots[1]
  if (!first || !second) {
    return { version: DEMO_STORE_VERSION, collaborators, companies, callLogs, bookings: [], extraSlots: [] }
  }

  const bookingAt = (dayOffset: number, slot: (typeof slots)[number], id: string, companyId: string, userId: string): ExplanationBooking => {
    const day = new Date()
    day.setDate(day.getDate() + dayOffset)
    const bounds = slotBounds(day, slot)
    return {
      id,
      company_id: companyId,
      user_id: userId,
      starts_at: bounds.starts.toISOString(),
      ends_at: bounds.ends.toISOString(),
      created_at: new Date().toISOString(),
    }
  }

  const bookings: ExplanationBooking[] = [
    bookingAt(1, first, 'book-01', 'co-01', MARCO),
    bookingAt(1, second, 'book-02', 'co-09', GIULIA),
    bookingAt(2, first, 'book-03', 'co-15', MARCO),
  ]

  return { version: DEMO_STORE_VERSION, collaborators, companies, callLogs, bookings, extraSlots: [] }
}
