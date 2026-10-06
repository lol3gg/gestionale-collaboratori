import type { Profile, UserRole } from './index'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          full_name?: string
          email?: string
          role?: UserRole
          active?: boolean
          created_at?: string
        }
        Update: {
          full_name?: string
          email?: string
          role?: UserRole
          active?: boolean
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      company_assignments: {
        Row: {
          id: string
          company_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          company_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
