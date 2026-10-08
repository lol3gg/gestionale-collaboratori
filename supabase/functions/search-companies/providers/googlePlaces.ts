import { canonicalPhoneKey, normalizePhone } from './phone.ts'
import type {
  BBox,
  NormalizedPlace,
  SearchProvider,
  SearchProviderOptions,
  SearchProviderResult,
} from './types.ts'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
  'nextPageToken',
].join(',')

type AddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

type PlacesApiPlace = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  addressComponents?: AddressComponent[]
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  businessStatus?: string
}

type PlacesSearchResponse = {
  places?: PlacesApiPlace[]
  nextPageToken?: string
  error?: { message?: string; status?: string; code?: number }
}

function componentByType(components: AddressComponent[] | undefined, type: string): AddressComponent | undefined {
  return components?.find((c) => c.types?.includes(type))
}

function mapPlace(
  place: PlacesApiPlace,
  fallback: { city: string; province: string; region: string; country: string },
): NormalizedPlace | null {
  const id = place.id?.replace(/^places\//, '') ?? ''
  if (!id) return null
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') return null

  const name = place.displayName?.text?.trim() ?? ''
  if (!name) return null

  const comps = place.addressComponents ?? []
  const locality =
    componentByType(comps, 'locality')?.longText ??
    componentByType(comps, 'postal_town')?.longText ??
    componentByType(comps, 'administrative_area_level_3')?.longText ??
    fallback.city
  const province =
    componentByType(comps, 'administrative_area_level_2')?.shortText?.toUpperCase() ??
    fallback.province
  const region =
    componentByType(comps, 'administrative_area_level_1')?.longText ?? fallback.region
  const country =
    componentByType(comps, 'country')?.shortText?.toUpperCase() ?? fallback.country

  const phoneRaw = place.nationalPhoneNumber || place.internationalPhoneNumber || ''
  const phone = normalizePhone(phoneRaw)
  const phone_normalized = canonicalPhoneKey(phoneRaw)

  return {
    google_place_id: id,
    name,
    phone,
    phone_normalized,
    website: place.websiteUri?.trim() ?? '',
    address: place.formattedAddress?.trim() || null,
    city: locality || fallback.city,
    province: province.slice(0, 2) || fallback.province,
    region: region || fallback.region,
    country: country || fallback.country,
    business_status: place.businessStatus ?? 'OPERATIONAL',
  }
}

export function splitBBoxIntoQuadrants(bbox: BBox): BBox[] {
  const midLat = (bbox.swLat + bbox.neLat) / 2
  const midLng = (bbox.swLng + bbox.neLng) / 2
  return [
    // SW
    { swLat: bbox.swLat, swLng: bbox.swLng, neLat: midLat, neLng: midLng },
    // SE
    { swLat: bbox.swLat, swLng: midLng, neLat: midLat, neLng: bbox.neLng },
    // NW
    { swLat: midLat, swLng: bbox.swLng, neLat: bbox.neLat, neLng: midLng },
    // NE
    { swLat: midLat, swLng: midLng, neLat: bbox.neLat, neLng: bbox.neLng },
  ]
}

export class GooglePlacesProvider implements SearchProvider {
  constructor(private readonly apiKey: string) {}

  async search(textQuery: string, options: SearchProviderOptions): Promise<SearchProviderResult> {
    const maxPages = options.maxPages ?? 3
    const results: NormalizedPlace[] = []
    const seen = new Set<string>()
    let pageToken: string | undefined
    let requestCount = 0

    for (let page = 0; page < maxPages; page++) {
      const body: Record<string, unknown> = {
        textQuery,
        languageCode: options.languageCode,
        regionCode: options.regionCode,
        pageSize: 20,
      }
      if (pageToken) body.pageToken = pageToken
      if (options.locationRestriction) {
        body.locationRestriction = {
          rectangle: {
            low: {
              latitude: options.locationRestriction.swLat,
              longitude: options.locationRestriction.swLng,
            },
            high: {
              latitude: options.locationRestriction.neLat,
              longitude: options.locationRestriction.neLng,
            },
          },
        }
      }

      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),
      })
      requestCount += 1

      const data = (await res.json()) as PlacesSearchResponse

      if (!res.ok || data.error) {
        const msg = data.error?.message ?? `HTTP ${res.status}`
        const status = data.error?.status ?? ''
        if (res.status === 429 || status === 'RESOURCE_EXHAUSTED') {
          throw new PlacesQuotaError(`Quota Google Places esaurita: ${msg}`)
        }
        if (res.status === 403 || status === 'PERMISSION_DENIED' || /API key/i.test(msg)) {
          throw new PlacesAuthError(`Chiave Google Places non valida o senza permessi: ${msg}`)
        }
        throw new PlacesNetworkError(`Errore Google Places: ${msg}`)
      }

      const hint = options.locationHint
      for (const place of data.places ?? []) {
        const mapped = mapPlace(place, {
          city: hint?.city ?? '',
          province: hint?.province ?? '',
          region: hint?.region ?? '',
          country: hint?.country ?? options.regionCode,
        })
        if (!mapped) continue
        if (seen.has(mapped.google_place_id)) continue
        seen.add(mapped.google_place_id)
        results.push(mapped)
      }

      pageToken = data.nextPageToken
      if (!pageToken) break
    }

    // 3 pagine × 20 = 60: se arriviamo a 60 risultati unici la cella è satura
    const saturated = results.length >= 60

    return { places: results, requestCount, saturated }
  }
}

export class PlacesQuotaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlacesQuotaError'
  }
}

export class PlacesAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlacesAuthError'
  }
}

export class PlacesNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlacesNetworkError'
  }
}
