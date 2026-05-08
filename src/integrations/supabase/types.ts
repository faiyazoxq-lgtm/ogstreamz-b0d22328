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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bot_configs: {
        Row: {
          active: boolean
          asset_class: string | null
          bias: string | null
          channel_chat_id: string
          created_at: string
          created_by: string | null
          id: string
          last_broadcast: string | null
          last_pinged_at: string | null
          pair_label: string
          pair_name: string
          ping_count: number
          tier_required: Database["public"]["Enums"]["subscription_plan"]
          update_frequency: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_class?: string | null
          bias?: string | null
          channel_chat_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_broadcast?: string | null
          last_pinged_at?: string | null
          pair_label: string
          pair_name: string
          ping_count?: number
          tier_required?: Database["public"]["Enums"]["subscription_plan"]
          update_frequency?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_class?: string | null
          bias?: string | null
          channel_chat_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_broadcast?: string | null
          last_pinged_at?: string | null
          pair_label?: string
          pair_name?: string
          ping_count?: number
          tier_required?: Database["public"]["Enums"]["subscription_plan"]
          update_frequency?: string
          updated_at?: string
        }
        Relationships: []
      }
      calculators: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          name: string
          published: boolean
          slug: string
          vip: boolean
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          published?: boolean
          slug: string
          vip?: boolean
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          published?: boolean
          slug?: string
          vip?: boolean
        }
        Relationships: []
      }
      connect_campaigns: {
        Row: {
          created_at: string
          created_by: string
          icp: string
          id: string
          instantly_campaign_id: string | null
          offer: string
          scout_news: Json
          scout_summary: string | null
          status: string
          target_company: string
          target_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          icp: string
          id?: string
          instantly_campaign_id?: string | null
          offer: string
          scout_news?: Json
          scout_summary?: string | null
          status?: string
          target_company: string
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          icp?: string
          id?: string
          instantly_campaign_id?: string | null
          offer?: string
          scout_news?: Json
          scout_summary?: string | null
          status?: string
          target_company?: string
          target_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      connect_leads: {
        Row: {
          apollo_payload: Json
          campaign_id: string
          company: string | null
          created_at: string
          email: string | null
          email_body: string | null
          email_subject: string | null
          full_name: string | null
          id: string
          job_title: string | null
          linkedin_url: string | null
          news_snippet: string | null
          send_status: string
          updated_at: string
        }
        Insert: {
          apollo_payload?: Json
          campaign_id: string
          company?: string | null
          created_at?: string
          email?: string | null
          email_body?: string | null
          email_subject?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          news_snippet?: string | null
          send_status?: string
          updated_at?: string
        }
        Update: {
          apollo_payload?: Json
          campaign_id?: string
          company?: string | null
          created_at?: string
          email?: string | null
          email_body?: string | null
          email_subject?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          news_snippet?: string | null
          send_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connect_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "connect_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      connect_sending_domains: {
        Row: {
          active: boolean
          created_at: string
          daily_cap: number
          domain: string
          id: string
          last_reset: string
          sent_today: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_cap?: number
          domain: string
          id?: string
          last_reset?: string
          sent_today?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_cap?: number
          domain?: string
          id?: string
          last_reset?: string
          sent_today?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          credits_granted: number
          currency: string
          environment: string
          id: string
          price_id: string
          stripe_session_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credits_granted: number
          currency?: string
          environment?: string
          id?: string
          price_id: string
          stripe_session_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credits_granted?: number
          currency?: string
          environment?: string
          id?: string
          price_id?: string
          stripe_session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_track_requests: {
        Row: {
          created_at: string
          credits_spent: number
          deliverable_url: string | null
          id: string
          lyrics: string | null
          notes: string | null
          portal_slug: string | null
          status: string
          updated_at: string
          user_id: string
          vibe: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number
          deliverable_url?: string | null
          id?: string
          lyrics?: string | null
          notes?: string | null
          portal_slug?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vibe: string
        }
        Update: {
          created_at?: string
          credits_spent?: number
          deliverable_url?: string | null
          id?: string
          lyrics?: string | null
          notes?: string | null
          portal_slug?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vibe?: string
        }
        Relationships: []
      }
      jokes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          keyword: string | null
          published: boolean
          source: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          keyword?: string | null
          published?: boolean
          source?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          keyword?: string | null
          published?: boolean
          source?: string | null
        }
        Relationships: []
      }
      portal_unlocks: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          environment: string
          id: string
          portal_id: string
          stripe_session_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          portal_id: string
          stripe_session_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          portal_id?: string
          stripe_session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      portals: {
        Row: {
          audio_snippet_url: string | null
          audio_url: string | null
          bg_video_aspect: string
          bg_video_prompt: string | null
          bg_video_url: string | null
          created_at: string
          created_by: string | null
          id: string
          jokes: Json
          kind: string
          language: string
          lyric_text: string | null
          name: string
          niche: string
          price_cents: number
          scout_meta: Json
          slug: string
          style: string | null
          telegram_config: Json
          theme: string
          theme_config: Json
          updated_at: string
          vibe: string | null
          view_count: number
          vip: boolean
        }
        Insert: {
          audio_snippet_url?: string | null
          audio_url?: string | null
          bg_video_aspect?: string
          bg_video_prompt?: string | null
          bg_video_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jokes?: Json
          kind?: string
          language?: string
          lyric_text?: string | null
          name: string
          niche: string
          price_cents?: number
          scout_meta?: Json
          slug: string
          style?: string | null
          telegram_config?: Json
          theme?: string
          theme_config?: Json
          updated_at?: string
          vibe?: string | null
          view_count?: number
          vip?: boolean
        }
        Update: {
          audio_snippet_url?: string | null
          audio_url?: string | null
          bg_video_aspect?: string
          bg_video_prompt?: string | null
          bg_video_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jokes?: Json
          kind?: string
          language?: string
          lyric_text?: string | null
          name?: string
          niche?: string
          price_cents?: number
          scout_meta?: Json
          slug?: string
          style?: string | null
          telegram_config?: Json
          theme?: string
          theme_config?: Json
          updated_at?: string
          vibe?: string | null
          view_count?: number
          vip?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          display_name: string | null
          email: string
          feature_flags: Json
          free_clicks_used: number
          id: string
          rank: Database["public"]["Enums"]["syndicate_rank"]
          status: Database["public"]["Enums"]["account_status"]
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          display_name?: string | null
          email: string
          feature_flags?: Json
          free_clicks_used?: number
          id: string
          rank?: Database["public"]["Enums"]["syndicate_rank"]
          status?: Database["public"]["Enums"]["account_status"]
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string
          feature_flags?: Json
          free_clicks_used?: number
          id?: string
          rank?: Database["public"]["Enums"]["syndicate_rank"]
          status?: Database["public"]["Enums"]["account_status"]
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      redeem_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          credits: number
          expires_at: string | null
          grant_rank: Database["public"]["Enums"]["syndicate_rank"] | null
          id: string
          max_uses: number
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          credits: number
          expires_at?: string | null
          grant_rank?: Database["public"]["Enums"]["syndicate_rank"] | null
          id?: string
          max_uses?: number
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          credits?: number
          expires_at?: string | null
          grant_rank?: Database["public"]["Enums"]["syndicate_rank"] | null
          id?: string
          max_uses?: number
          uses?: number
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          code_id: string
          created_at: string
          credits_granted: number
          id: string
          rank_granted: Database["public"]["Enums"]["syndicate_rank"] | null
          user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string
          credits_granted: number
          id?: string
          rank_granted?: Database["public"]["Enums"]["syndicate_rank"] | null
          user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string
          credits_granted?: number
          id?: string
          rank_granted?: Database["public"]["Enums"]["syndicate_rank"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "redeem_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suno_jobs: {
        Row: {
          audio_url: string | null
          created_at: string
          id: string
          image_url: string | null
          lyric_text: string | null
          make_instrumental: boolean
          portal_id: string | null
          portal_slug: string | null
          prompt: string | null
          raw: Json
          status: string
          style_tags: string | null
          task_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          lyric_text?: string | null
          make_instrumental?: boolean
          portal_id?: string | null
          portal_slug?: string | null
          prompt?: string | null
          raw?: Json
          status?: string
          style_tags?: string | null
          task_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          lyric_text?: string | null
          make_instrumental?: boolean
          portal_id?: string | null
          portal_slug?: string | null
          prompt?: string | null
          raw?: Json
          status?: string
          style_tags?: string | null
          task_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      syndicate_subscribers: {
        Row: {
          id: string
          joined_at: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: string
          telegram_user_id: number | null
          telegram_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      track_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          environment: string
          id: string
          stripe_session_id: string
          track_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          stripe_session_id: string
          track_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          stripe_session_id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_purchases_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          full_path: string | null
          id: string
          portal_slug: string
          preview_path: string | null
          price_cents: number
          suno_prompt: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          full_path?: string | null
          id?: string
          portal_slug: string
          preview_path?: string | null
          price_cents?: number
          suno_prompt?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          full_path?: string | null
          id?: string
          portal_slug?: string
          preview_path?: string | null
          price_cents?: number
          suno_prompt?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_scans: {
        Row: {
          asset_class: string | null
          confidence: number | null
          created_at: string
          delayed: boolean
          id: string
          payload: Json
          portal_slug: string
          signal: string | null
          user_id: string
        }
        Insert: {
          asset_class?: string | null
          confidence?: number | null
          created_at?: string
          delayed?: boolean
          id?: string
          payload?: Json
          portal_slug: string
          signal?: string | null
          user_id: string
        }
        Update: {
          asset_class?: string | null
          confidence?: number | null
          created_at?: string
          delayed?: boolean
          id?: string
          payload?: Json
          portal_slug?: string
          signal?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      syndicate_gallery: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          kind: string | null
          language: string | null
          name: string | null
          path: string | null
          slug: string | null
          theme: string | null
          theme_config: Json | null
          vibe: string | null
          vip: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_adjust_credits: {
        Args: { _delta: number; _reason: string; _user_id: string }
        Returns: number
      }
      apply_credit_purchase: {
        Args: {
          _amount_cents: number
          _credits: number
          _currency: string
          _environment: string
          _price_id: string
          _stripe_session_id: string
          _user_id: string
        }
        Returns: boolean
      }
      apply_trade_scan: {
        Args: {
          _asset_class: string
          _confidence: number
          _delayed: boolean
          _payload: Json
          _portal_slug: string
          _signal: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_portal_view: { Args: { _slug: string }; Returns: number }
      plan_includes_tier: {
        Args: {
          _plan: Database["public"]["Enums"]["subscription_plan"]
          _required: Database["public"]["Enums"]["subscription_plan"]
        }
        Returns: boolean
      }
      redeem_code: { Args: { _code: string }; Returns: Json }
      refresh_news_scout: {
        Args: { _meta: Json; _slug: string }
        Returns: undefined
      }
      spend_credits: {
        Args: { _amount: number; _reason: string }
        Returns: number
      }
    }
    Enums: {
      account_status: "free" | "vip"
      app_role: "admin" | "user"
      subscription_plan: "free" | "metal" | "energy" | "syndicate"
      syndicate_rank: "prospect" | "enforcer" | "vip" | "boss"
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
      account_status: ["free", "vip"],
      app_role: ["admin", "user"],
      subscription_plan: ["free", "metal", "energy", "syndicate"],
      syndicate_rank: ["prospect", "enforcer", "vip", "boss"],
    },
  },
} as const
