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
    PostgrestVersion: "12.2.3 (519615d)"
  }
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
          featured_at: string | null
          featured_description: string | null
          featured_priority: number | null
          id: string
          is_featured: boolean | null
          is_tradingview_connected: boolean
          role: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_onboarding_completed: boolean | null
          stripe_payouts_enabled: boolean | null
          tradingview_connection_status: string | null
          tradingview_last_error: string | null
          tradingview_last_validated_at: string | null
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
          featured_at?: string | null
          featured_description?: string | null
          featured_priority?: number | null
          id: string
          is_featured?: boolean | null
          is_tradingview_connected?: boolean
          role?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tradingview_connection_status?: string | null
          tradingview_last_error?: string | null
          tradingview_last_validated_at?: string | null
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
          featured_at?: string | null
          featured_description?: string | null
          featured_priority?: number | null
          id?: string
          is_featured?: boolean | null
          is_tradingview_connected?: boolean
          role?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tradingview_connection_status?: string | null
          tradingview_last_error?: string | null
          tradingview_last_validated_at?: string | null
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
          stripe_monthly_price_id: string | null
          stripe_product_id: string | null
          stripe_yearly_price_id: string | null
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
          stripe_monthly_price_id?: string | null
          stripe_product_id?: string | null
          stripe_yearly_price_id?: string | null
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
          stripe_monthly_price_id?: string | null
          stripe_product_id?: string | null
          stripe_yearly_price_id?: string | null
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
      rate_limit_configs: {
        Row: {
          burst_limit: number
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          requests_per_hour: number
          requests_per_minute: number
          updated_at: string
        }
        Insert: {
          burst_limit?: number
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          requests_per_hour?: number
          requests_per_minute?: number
          updated_at?: string
        }
        Update: {
          burst_limit?: number
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          requests_per_hour?: number
          requests_per_minute?: number
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip_address: unknown | null
          request_count: number
          updated_at: string
          user_id: string | null
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: unknown | null
          request_count?: number
          updated_at?: string
          user_id?: string | null
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: unknown | null
          request_count?: number
          updated_at?: string
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          id: string
          program_id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      script_assignments: {
        Row: {
          access_type: string | null
          assigned_at: string | null
          assignment_attempts: number
          assignment_details: Json | null
          buyer_id: string
          created_at: string
          error_message: string | null
          expires_at: string | null
          id: string
          is_trial: boolean | null
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
          access_type?: string | null
          assigned_at?: string | null
          assignment_attempts?: number
          assignment_details?: Json | null
          buyer_id: string
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean | null
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
          access_type?: string | null
          assigned_at?: string | null
          assignment_attempts?: number
          assignment_details?: Json | null
          buyer_id?: string
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean | null
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
      security_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          risk_level: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          risk_level?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          risk_level?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_access_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_uses: number | null
          expires_at: string | null
          id: string
          is_used: boolean
          max_uses: number | null
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_used?: boolean
          max_uses?: number | null
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_used?: boolean
          max_uses?: number | null
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Relationships: []
      }
      seller_notifications: {
        Row: {
          created_at: string | null
          email_on_connection_expiry: boolean | null
          email_on_program_disabled: boolean | null
          id: string
          last_expiry_notification_sent_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_on_connection_expiry?: boolean | null
          email_on_program_disabled?: boolean | null
          id?: string
          last_expiry_notification_sent_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_on_connection_expiry?: boolean | null
          email_on_program_disabled?: boolean | null
          id?: string
          last_expiry_notification_sent_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_notifications_user_id_fkey"
            columns: ["user_id"]
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
      trial_usage: {
        Row: {
          created_at: string
          id: string
          program_id: string
          used_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          used_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_usage_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_usage_user_id_fkey"
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
      check_rate_limit: {
        Args: {
          p_endpoint?: string
          p_ip_address?: unknown
          p_limit?: number
          p_user_id?: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_rate_limit_secure: {
        Args: {
          p_endpoint?: string
          p_ip_address?: unknown
          p_limit?: number
          p_user_id?: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_trial_eligibility: {
        Args: { p_program_id: string; p_user_id: string }
        Returns: boolean
      }
      disable_programs_for_expired_connections: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_featured_creators_with_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          avg_rating: number
          bio: string
          created_at: string
          display_name: string
          featured_at: string
          featured_description: string
          featured_priority: number
          id: string
          is_featured: boolean
          is_tradingview_connected: boolean
          role: string
          total_programs: number
          total_revenue: number
          total_sales: number
          username: string
        }[]
      }
      get_public_profiles: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          featured_at: string
          featured_description: string
          featured_priority: number
          id: string
          is_featured: boolean
          is_tradingview_connected: boolean
          role: string
          username: string
        }[]
      }
      get_safe_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          featured_at: string
          featured_description: string
          featured_priority: number
          id: string
          is_featured: boolean
          is_tradingview_connected: boolean
          role: string
          username: string
        }[]
      }
      get_script_download_url: {
        Args: { program_id_param: string }
        Returns: string
      }
      increment_program_view_count: {
        Args: { program_uuid: string }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type: string
          p_risk_level?: string
        }
        Returns: string
      }
      record_trial_usage: {
        Args: { p_program_id: string; p_user_id: string }
        Returns: undefined
      }
      sanitize_user_content: {
        Args: { content: string; max_length?: number }
        Returns: string
      }
      seller_has_valid_tradingview_connection: {
        Args: { seller_user_id: string }
        Returns: boolean
      }
      toggle_creator_featured_status: {
        Args: {
          creator_id: string
          description?: string
          featured: boolean
          priority?: number
        }
        Returns: undefined
      }
      update_program_rating_stats: {
        Args: { program_uuid: string }
        Returns: undefined
      }
      validate_file_upload: {
        Args: {
          p_bucket_name: string
          p_file_name: string
          p_file_size: number
          p_mime_type: string
        }
        Returns: Json
      }
      validate_seller_access_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: Json
      }
      validate_tradingview_url: {
        Args: { url: string }
        Returns: boolean
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
      assignment_status: ["pending", "assigned", "failed", "expired"],
      purchase_status: ["pending", "completed", "failed", "refunded"],
    },
  },
} as const
