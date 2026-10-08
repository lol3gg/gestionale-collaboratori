export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: 'admin' | 'collaboratore'
          active: boolean
          daily_goal: number
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string
          email?: string
          role?: 'admin' | 'collaboratore'
          active?: boolean
          daily_goal?: number
          created_at?: string
        }
        Update: {
          full_name?: string
          email?: string
          role?: 'admin' | 'collaboratore'
          active?: boolean
          daily_goal?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: string
          name: string
          phone: string
          email: string | null
          website: string
          address: string | null
          city: string
          province: string
          region: string
          country: string
          employees: number | null
          status: string
          assigned_to: string | null
          callback_at: string | null
          google_place_id: string | null
          source: string
          fetched_at: string | null
          import_batch_id: string | null
          possible_duplicate: boolean
          similar_company_id: string | null
          duplicate_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string
          email?: string | null
          website?: string
          address?: string | null
          city?: string
          province?: string
          region?: string
          country?: string
          employees?: number | null
          status?: string
          assigned_to?: string | null
          callback_at?: string | null
          google_place_id?: string | null
          source?: string
          fetched_at?: string | null
          import_batch_id?: string | null
          possible_duplicate?: boolean
          similar_company_id?: string | null
          duplicate_note?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          phone?: string
          email?: string | null
          website?: string
          address?: string | null
          city?: string
          province?: string
          region?: string
          country?: string
          employees?: number | null
          status?: string
          assigned_to?: string | null
          callback_at?: string | null
          google_place_id?: string | null
          source?: string
          fetched_at?: string | null
          import_batch_id?: string | null
          possible_duplicate?: boolean
          similar_company_id?: string | null
          duplicate_note?: string | null
        }
        Relationships: []
      }
      company_notes: {
        Row: {
          id: string
          company_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          body?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          id: string
          company_id: string
          user_id: string
          outcome: string
          note: string | null
          callback_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          outcome: string
          note?: string | null
          callback_at?: string | null
          created_at?: string
        }
        Update: {
          outcome?: string
          note?: string | null
          callback_at?: string | null
        }
        Relationships: []
      }
      searches: {
        Row: {
          id: string
          user_id: string
          name: string
          query: string
          country: string
          region: string | null
          regions: string[]
          province: string | null
          city: string | null
          provinces: string[]
          keywords: string[]
          max_requests: number
          estimated_queries: number
          estimated_cost_eur: number
          actual_requests: number
          results_count: number
          added_count: number
          auto_add_to_companies: boolean
          import_batch_id: string | null
          summary: Json | null
          status: string
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          query?: string
          country?: string
          region?: string | null
          regions?: string[]
          province?: string | null
          city?: string | null
          provinces?: string[]
          keywords?: string[]
          max_requests?: number
          estimated_queries?: number
          estimated_cost_eur?: number
          actual_requests?: number
          results_count?: number
          added_count?: number
          auto_add_to_companies?: boolean
          import_batch_id?: string | null
          summary?: Json | null
          status?: string
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          name?: string
          query?: string
          country?: string
          region?: string | null
          regions?: string[]
          province?: string | null
          city?: string | null
          provinces?: string[]
          keywords?: string[]
          max_requests?: number
          estimated_queries?: number
          estimated_cost_eur?: number
          actual_requests?: number
          results_count?: number
          added_count?: number
          auto_add_to_companies?: boolean
          import_batch_id?: string | null
          summary?: Json | null
          status?: string
          error_message?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          id: string
          search_id: string | null
          created_by: string
          country: string
          regions: string[]
          keywords: string[]
          max_requests: number
          auto_add: boolean
          status: string
          comuni_total: number
          comuni_done: number
          found_count: number
          inserted_count: number
          duplicates_safe: number
          duplicates_doubtful: number
          without_phone: number
          requests_count: number
          estimated_cost_eur: number
          cancel_deleted: number
          cancel_kept: number
          cancel_summary: Json | null
          created_at: string
          completed_at: string | null
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          search_id?: string | null
          created_by: string
          country?: string
          regions?: string[]
          keywords?: string[]
          max_requests?: number
          auto_add?: boolean
          status?: string
          comuni_total?: number
          comuni_done?: number
          found_count?: number
          inserted_count?: number
          duplicates_safe?: number
          duplicates_doubtful?: number
          without_phone?: number
          requests_count?: number
          estimated_cost_eur?: number
          cancel_deleted?: number
          cancel_kept?: number
          cancel_summary?: Json | null
          created_at?: string
          completed_at?: string | null
          cancelled_at?: string | null
        }
        Update: {
          search_id?: string | null
          status?: string
          comuni_total?: number
          comuni_done?: number
          found_count?: number
          inserted_count?: number
          duplicates_safe?: number
          duplicates_doubtful?: number
          without_phone?: number
          requests_count?: number
          estimated_cost_eur?: number
          cancel_deleted?: number
          cancel_kept?: number
          cancel_summary?: Json | null
          completed_at?: string | null
          cancelled_at?: string | null
        }
        Relationships: []
      }
      comuni: {
        Row: {
          id: string
          name: string
          province: string
          region: string
          istat_code: string
          country: string
          population: number | null
          bbox_sw_lat: number | null
          bbox_sw_lng: number | null
          bbox_ne_lat: number | null
          bbox_ne_lng: number | null
          bbox_source: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          province: string
          region: string
          istat_code: string
          country?: string
          population?: number | null
          bbox_sw_lat?: number | null
          bbox_sw_lng?: number | null
          bbox_ne_lat?: number | null
          bbox_ne_lng?: number | null
          bbox_source?: string
          created_at?: string
        }
        Update: {
          name?: string
          province?: string
          region?: string
          istat_code?: string
          country?: string
          population?: number | null
          bbox_sw_lat?: number | null
          bbox_sw_lng?: number | null
          bbox_ne_lat?: number | null
          bbox_ne_lng?: number | null
          bbox_source?: string
        }
        Relationships: []
      }
      search_jobs: {
        Row: {
          id: string
          search_id: string
          status: string
          total_queries: number
          completed_queries: number
          cursor_offset: number
          batch_size: number
          request_count: number
          saturated_cells: number
          pending_cells: number
          comuni_total: number
          comuni_done: number
          pause_summary: string | null
          error_message: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          search_id: string
          status?: string
          total_queries?: number
          completed_queries?: number
          cursor_offset?: number
          batch_size?: number
          request_count?: number
          saturated_cells?: number
          pending_cells?: number
          comuni_total?: number
          comuni_done?: number
          pause_summary?: string | null
          error_message?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: string
          total_queries?: number
          completed_queries?: number
          cursor_offset?: number
          batch_size?: number
          request_count?: number
          saturated_cells?: number
          pending_cells?: number
          comuni_total?: number
          comuni_done?: number
          pause_summary?: string | null
          error_message?: string | null
          last_error?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      search_cells: {
        Row: {
          id: string
          job_id: string
          search_id: string
          comune_id: string
          keyword: string
          level: number
          bbox_sw_lat: number
          bbox_sw_lng: number
          bbox_ne_lat: number
          bbox_ne_lng: number
          status: string
          n_risultati: number
          n_nuovi: number
          request_count: number
          parent_cell_id: string | null
          error_message: string | null
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          search_id: string
          comune_id: string
          keyword: string
          level?: number
          bbox_sw_lat: number
          bbox_sw_lng: number
          bbox_ne_lat: number
          bbox_ne_lng: number
          status?: string
          n_risultati?: number
          n_nuovi?: number
          request_count?: number
          parent_cell_id?: string | null
          error_message?: string | null
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          status?: string
          n_risultati?: number
          n_nuovi?: number
          request_count?: number
          error_message?: string | null
          processed_at?: string | null
        }
        Relationships: []
      }
      search_results: {
        Row: {
          id: string
          search_id: string
          google_place_id: string | null
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
          is_duplicate_in_db: boolean
          is_duplicate_in_search: boolean
          possible_duplicate: boolean
          similar_company_id: string | null
          discarded: boolean
          added_company_id: string | null
          auto_added: boolean
          fetched_at: string
          created_at: string
        }
        Insert: {
          id?: string
          search_id: string
          google_place_id?: string | null
          name: string
          phone?: string
          phone_normalized?: string
          website?: string
          address?: string | null
          city?: string
          province?: string
          region?: string
          country?: string
          business_status?: string | null
          is_duplicate_in_db?: boolean
          is_duplicate_in_search?: boolean
          possible_duplicate?: boolean
          similar_company_id?: string | null
          discarded?: boolean
          added_company_id?: string | null
          auto_added?: boolean
          fetched_at?: string
          created_at?: string
        }
        Update: {
          discarded?: boolean
          added_company_id?: string | null
          is_duplicate_in_db?: boolean
          possible_duplicate?: boolean
          similar_company_id?: string | null
          auto_added?: boolean
        }
        Relationships: []
      }
      app_settings: {
        Row: { key: string; value: Json; updated_at: string }
        Insert: { key: string; value?: Json; updated_at?: string }
        Update: { value?: Json; updated_at?: string }
        Relationships: []
      }
      places_usage_daily: {
        Row: { day: string; request_count: number; updated_at: string }
        Insert: { day?: string; request_count?: number; updated_at?: string }
        Update: { request_count?: number; updated_at?: string }
        Relationships: []
      }
      explanation_bookings: {
        Row: {
          id: string
          company_id: string
          user_id: string
          starts_at: string
          ends_at: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          starts_at: string
          ends_at: string
          created_at?: string
        }
        Update: never
        Relationships: []
      }
      explanation_extra_slots: {
        Row: {
          id: string
          day: string
          start_min: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          day: string
          start_min: number
          created_at?: string
          created_by?: string | null
        }
        Update: never
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_call_outcome: {
        Args: {
          p_company_id: string
          p_outcome: string
          p_note?: string | null
          p_callback_at?: string | null
        }
        Returns: Json
      }
      undo_call: {
        Args: { p_log_id: string }
        Returns: Database['public']['Tables']['companies']['Row']
      }
      claim_company: {
        Args: { p_id: string }
        Returns: Database['public']['Tables']['companies']['Row']
      }
      release_company: {
        Args: { p_id: string }
        Returns: Database['public']['Tables']['companies']['Row']
      }
      book_explanation: {
        Args: { p_company_id: string; p_starts_at: string }
        Returns: Database['public']['Tables']['explanation_bookings']['Row']
      }
      import_companies: {
        Args: { p_rows: Json; p_policy?: string }
        Returns: Json
      }
      dashboard_stats: {
        Args: Record<string, never>
        Returns: Json
      }
      next_company_for_call: {
        Args: { p_skip?: string[] }
        Returns: Database['public']['Tables']['companies']['Row'] | null
      }
      max_claimed_companies: {
        Args: Record<string, never>
        Returns: number
      }
      estimate_places_search: {
        Args: { p_region: string; p_provinces: string[]; p_keywords: string[] }
        Returns: Json
      }
      estimate_places_search_regions: {
        Args: { p_regions: string[]; p_keywords: string[] }
        Returns: Json
      }
      add_search_results_to_companies: {
        Args: { p_ids: string[] }
        Returns: Json
      }
      ingest_search_results_to_companies: {
        Args: { p_ids: string[]; p_batch_id?: string | null }
        Returns: Json
      }
      finalize_import_batch: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      cancel_import_batch: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      get_search_coverage: {
        Args: { p_search_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
