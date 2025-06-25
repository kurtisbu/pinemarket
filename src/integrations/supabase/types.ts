export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assignment_logs: {
        Row: {
          assignment_id: string
          created_at: string | null
          details: Json | null
          id: string
          log_level: string
          message: string
          purchase_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          log_level: string
          message: string
          purchase_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          log_level?: string
          message?: string
          purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "script_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_logs_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_tradingview_connected: boolean
          role: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_onboarding_completed: boolean | null
          stripe_payouts_enabled: boolean | null
          tradingview_session_cookie: string | null
          tradingview_signed_session_cookie: string | null
          tradingview_username: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_tradingview_connected?: boolean
          role?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tradingview_session_cookie?: string | null
          tradingview_signed_session_cookie?: string | null
          tradingview_username?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_tradingview_connected?: boolean
          role?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tradingview_session_cookie?: string | null
          tradingview_signed_session_cookie?: string | null
          tradingview_username?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          average_rating: number
          billing_interval: string | null
          category: string
          created_at: string
          description: string
          download_count: number
          id: string
          image_urls: string[] | null
          monthly_price: number | null
          price: number
          pricing_model: string
          rating_count: number
          script_file_path: string | null
          seller_id: string
          status: string
          subscription_plan_id: string | null
          tags: string[] | null
          title: string
          tradingview_publication_url: string | null
          tradingview_script_id: string | null
          trial_period_days: number | null
          updated_at: string
          view_count: number
          yearly_price: number | null
        }
        Insert: {
          average_rating?: number
          billing_interval?: string | null
          category: string
          created_at?: string
          description: string
          download_count?: number
          id?: string
          image_urls?: string[] | null
          monthly_price?: number | null
          price: number
          pricing_model?: string
          rating_count?: number
          script_file_path?: string | null
          seller_id: string
          status?: string
          subscription_plan_id?: string | null
          tags?: string[] | null
          title: string
          tradingview_publication_url?: string | null
          tradingview_script_id?: string | null
          trial_period_days?: number | null
          updated_at?: string
          view_count?: number
          yearly_price?: number | null
        }
        Update: {
          average_rating?: number
          billing_interval?: string | null
          category?: string
          created_at?: string
          description?: string
          download_count?: number
          id?: string
          image_urls?: string[] | null
          monthly_price?: number | null
          price?: number
          pricing_model?: string
          rating_count?: number
          script_file_path?: string | null
          seller_id?: string
          status?: string
          subscription_plan_id?: string | null
          tags?: string[] | null
          title?: string
          tradingview_publication_url?: string | null
          tradingview_script_id?: string | null
          trial_period_days?: number | null
          updated_at?: string
          view_count?: number
          yearly_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          id: string
          payment_intent_id: string | null
          platform_fee: number
          program_id: string
          purchased_at: string
          seller_id: string
          status: Database["public"]["Enums"]["purchase_status"]
          stripe_transfer_id: string | null
          tradingview_username: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          id?: string
          payment_intent_id?: string | null
          platform_fee?: number
          program_id: string
          purchased_at?: string
          seller_id: string
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_transfer_id?: string | null
          tradingview_username?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          id?: string
          payment_intent_id?: string | null
          platform_fee?: number
          program_id?: string
          purchased_at?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_transfer_id?: string | null
          tradingview_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      script_assignments: {
        Row: {
          assigned_at: string | null
          assignment_attempts: number
          assignment_details: Json | null
          buyer_id: string
          created_at: string
          error_message: string | null
          id: string
          last_attempt_at: string | null
          pine_id: string | null
          program_id: string
          purchase_id: string
          retry_count: number
          seller_id: string
          status: Database["public"]["Enums"]["assignment_status"]
          tradingview_script_id: string | null
          tradingview_username: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assignment_attempts?: number
          assignment_details?: Json | null
          buyer_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          pine_id?: string | null
          program_id: string
          purchase_id: string
          retry_count?: number
          seller_id: string
          status?: Database["public"]["Enums"]["assignment_status"]
          tradingview_script_id?: string | null
          tradingview_username?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assignment_attempts?: number
          assignment_details?: Json | null
          buyer_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          pine_id?: string | null
          program_id?: string
          purchase_id?: string
          retry_count?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          tradingview_script_id?: string | null
          tradingview_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_assignments_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_assignments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_assignments_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_access: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          id: string
          program_id: string
          user_subscription_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          program_id: string
          user_subscription_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          program_id?: string
          user_subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_access_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_access_user_subscription_id_fkey"
            columns: ["user_subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          interval: string
          is_active: boolean
          name: string
          price: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval: string
          is_active?: boolean
          name: string
          price: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval?: string
          is_active?: boolean
          name?: string
          price?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tradingview_scripts: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          last_synced_at: string
          likes: number
          pine_id: string | null
          publication_url: string
          reviews_count: number
          script_id: string
          title: string
          user_id: string
          version: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          last_synced_at?: string
          likes?: number
          pine_id?: string | null
          publication_url: string
          reviews_count?: number
          script_id: string
          title: string
          user_id: string
          version?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          last_synced_at?: string
          likes?: number
          pine_id?: string | null
          publication_url?: string
          reviews_count?: number
          script_id?: string
          title?: string
          user_id?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tradingview_scripts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_script_download_url: {
        Args: { program_id_param: string }
        Returns: string
      }
      increment_program_view_count: {
        Args: { program_uuid: string }
        Returns: undefined
      }
    }
    Enums: {
      assignment_status: "pending" | "assigned" | "failed" | "expired"
      purchase_status: "pending" | "completed" | "failed" | "refunded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assignment_status: ["pending", "assigned", "failed", "expired"],
      purchase_status: ["pending", "completed", "failed", "refunded"],
    },
  },
} as const
