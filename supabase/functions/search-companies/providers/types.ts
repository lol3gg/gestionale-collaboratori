export type NormalizedPlace = {
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

export type BBox = {
  swLat: number
  swLng: number
  neLat: number
  neLng: number
}

export type SearchProviderOptions = {
  languageCode: string
  regionCode: string
  maxPages?: number
  /** Restrictione rettangolare Places API (New). */
  locationRestriction?: BBox
  locationHint?: {
    city: string
    province: string
    region: string
    country: string
  }
}

export type SearchProviderResult = {
  places: NormalizedPlace[]
  requestCount: number
  /** true se si sono riempite tutte e 3 le pagine (≈60 risultati). */
  saturated: boolean
}

export interface SearchProvider {
  search(textQuery: string, options: SearchProviderOptions): Promise<SearchProviderResult>
}
