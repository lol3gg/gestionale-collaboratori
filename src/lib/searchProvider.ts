/**
 * Contratto fornitore ricerca aziende.
 * L'implementazione live è lato Edge Function (Google Places).
 * Aggiungere OpenStreetMap o altri provider implementando questa interfaccia
 * in supabase/functions/search-companies/providers/ senza toccare UI/RPC.
 */

export type NormalizedSearchHit = {
  google_place_id: string
  name: string
  phone: string
  phone_normalized: string
  website: string
  address: string | null
  city: string
  province: string
  region: string
  country: string
  business_status: string | null
}

export type SearchProviderQuery = {
  textQuery: string
  languageCode: string
  regionCode: string
  locationRestriction?: {
    swLat: number
    swLng: number
    neLat: number
    neLng: number
  }
  locationHint?: {
    city: string
    province: string
    region: string
    country: string
  }
}

export type SearchProviderResult = {
  places: NormalizedSearchHit[]
  requestCount: number
  saturated: boolean
}

export interface SearchProvider {
  search(query: SearchProviderQuery): Promise<SearchProviderResult>
}
