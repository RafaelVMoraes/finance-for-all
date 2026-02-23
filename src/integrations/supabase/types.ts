export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          category_id: string
          created_at: string
          distribution: string
          expected_amount: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          distribution?: string
          expected_amount?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          distribution?: string
          expected_amount?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          from_currency: string
          id: string
          month: string
          rate: number
          to_currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_currency: string
          id?: string
          month: string
          rate: number
          to_currency: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_currency?: string
          id?: string
          month?: string
          rate?: number
          to_currency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          date_from: string | null
          date_to: string | null
          filename: string
          id: string
          imported_at: string
          row_count: number
          source_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          date_from?: string | null
          date_to?: string | null
          filename: string
          id?: string
          imported_at?: string
          row_count?: number
          source_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          date_from?: string | null
          date_to?: string | null
          filename?: string
          id?: string
          imported_at?: string
          row_count?: number
          source_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "import_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rule_matches: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          label_normalized: string
          last_seen_at: string
          occurrence_count: number
          user_id: string
          value_range: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          label_normalized: string
          last_seen_at?: string
          occurrence_count?: number
          user_id: string
          value_range?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          label_normalized?: string
          last_seen_at?: string
          occurrence_count?: number
          user_id?: string
          value_range?: string | null
        }
        Relationships: []
      }
      import_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          enabled: boolean
          id: string
          last_applied_at: string | null
          name: string
          priority: number
          times_applied: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_applied_at?: string | null
          name: string
          priority?: number
          times_applied?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_applied_at?: string | null
          name?: string
          priority?: number
          times_applied?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_sources: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_snapshots: {
        Row: {
          confirmed: boolean
          created_at: string
          id: string
          investment_id: string
          month: string
          total_value: number
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          id?: string
          investment_id: string
          month: string
          total_value: number
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          id?: string
          investment_id?: string
          month?: string
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_snapshots_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_types: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          initial_amount: number
          investment_type: string
          investment_type_id: string | null
          monthly_contribution: number
          name: string
          start_month: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          initial_amount?: number
          investment_type: string
          investment_type_id?: string | null
          monthly_contribution?: number
          name: string
          start_month?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          initial_amount?: number
          investment_type?: string
          investment_type_id?: string | null
          monthly_contribution?: number
          name?: string
          start_month?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_investment_type_id_fkey"
            columns: ["investment_type_id"]
            isOneToOne: false
            referencedRelation: "investment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_category_summary: {
        Row: {
          category_id: string
          month: string
          total_amount: number
          transaction_count: number
          user_id: string
        }
        Insert: {
          category_id: string
          month: string
          total_amount?: number
          transaction_count?: number
          user_id: string
        }
        Update: {
          category_id?: string
          month?: string
          total_amount?: number
          transaction_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_category_summary_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_settings: {
        Row: {
          created_at: string
          expected_income: number
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_income?: number
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expected_income?: number
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_totals: {
        Row: {
          incomplete_count: number
          month: string
          total_expenses: number
          total_income: number
          transaction_count: number
          user_id: string
        }
        Insert: {
          incomplete_count?: number
          month: string
          total_expenses?: number
          total_income?: number
          transaction_count?: number
          user_id: string
        }
        Update: {
          incomplete_count?: number
          month?: string
          total_expenses?: number
          total_income?: number
          transaction_count?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          edited_label: string | null
          id: string
          import_batch_id: string | null
          original_category: string | null
          original_label: string
          payment_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          edited_label?: string | null
          id?: string
          import_batch_id?: string | null
          original_category?: string | null
          original_label: string
          payment_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          edited_label?: string | null
          id?: string
          import_batch_id?: string | null
          original_category?: string | null
          original_label?: string
          payment_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          main_currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          main_currency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          main_currency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_investment_summary: { Args: never; Returns: Json }
      get_monthly_summary: {
        Args: { p_month_end: string; p_month_start: string }
        Returns: Json
      }
      get_yearly_summary: { Args: { p_year: number }; Returns: Json }
    }
    Enums: {
      category_type: "fixed" | "variable" | "income"
      currency: "EUR" | "USD" | "BRL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      category_type: ["fixed", "variable", "income"],
      currency: ["EUR", "USD", "BRL"],
    },
  },
} as const
