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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
