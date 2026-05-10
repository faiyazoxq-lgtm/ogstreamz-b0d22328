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
      _stream_link_key: {
        Row: {
          id: number
          key: string
        }
        Insert: {
          id?: number
          key: string
        }
        Update: {
          id?: number
          key?: string
        }
        Relationships: []
      }
      ai_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json
          mood: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json
          mood?: string | null
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json
          mood?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_settings: {
        Row: {
          id: number
          retention_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      battle_plays: {
        Row: {
          battle_id: string
          choices: Json
          created_at: string
          id: string
          outcome: string | null
          picked_index: number | null
          round: number
          session_id: string
          situation: string
          user_id: string | null
        }
        Insert: {
          battle_id: string
          choices?: Json
          created_at?: string
          id?: string
          outcome?: string | null
          picked_index?: number | null
          round?: number
          session_id: string
          situation: string
          user_id?: string | null
        }
        Update: {
          battle_id?: string
          choices?: Json
          created_at?: string
          id?: string
          outcome?: string | null
          picked_index?: number | null
          round?: number
          session_id?: string
          situation?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_plays_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battlehub_votes: {
        Row: {
          created_at: string
          id: string
          round_key: number
          side: string
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          round_key: number
          side: string
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          round_key?: number
          side?: string
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      battles: {
        Row: {
          accent: string
          created_at: string
          created_by: string | null
          custom_prompt: string
          emoji: string
          id: string
          language: string
          name: string
          public: boolean
          research: Json
          scenario: string
          slug: string
          swear_chat_enabled: boolean
          tagline: string
          theme_config: Json
          themes: string[]
          updated_at: string
          view_count: number
        }
        Insert: {
          accent?: string
          created_at?: string
          created_by?: string | null
          custom_prompt?: string
          emoji?: string
          id?: string
          language?: string
          name: string
          public?: boolean
          research?: Json
          scenario: string
          slug: string
          swear_chat_enabled?: boolean
          tagline?: string
          theme_config?: Json
          themes?: string[]
          updated_at?: string
          view_count?: number
        }
        Update: {
          accent?: string
          created_at?: string
          created_by?: string | null
          custom_prompt?: string
          emoji?: string
          id?: string
          language?: string
          name?: string
          public?: boolean
          research?: Json
          scenario?: string
          slug?: string
          swear_chat_enabled?: boolean
          tagline?: string
          theme_config?: Json
          themes?: string[]
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      boss_chat_messages: {
        Row: {
          content: string
          created_at: string
          external_user: string | null
          id: string
          market_context: Json | null
          persona: string | null
          role: string
          session_id: string | null
          source: string
        }
        Insert: {
          content: string
          created_at?: string
          external_user?: string | null
          id?: string
          market_context?: Json | null
          persona?: string | null
          role: string
          session_id?: string | null
          source?: string
        }
        Update: {
          content?: string
          created_at?: string
          external_user?: string | null
          id?: string
          market_context?: Json | null
          persona?: string | null
          role?: string
          session_id?: string | null
          source?: string
        }
        Relationships: []
      }
      boss_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      bot_factory: {
        Row: {
          active: boolean
          asset_class: string | null
          bias: string
          bot_username: string | null
          channel_chat_id: string
          created_at: string
          created_by: string | null
          id: string
          last_broadcast: string | null
          last_pinged_at: string | null
          pair_label: string
          pair_name: string
          ping_count: number
          telegram_bot_token: string
          tier: string
          updated_at: string
          webhook_secret: string
          webhook_url: string | null
        }
        Insert: {
          active?: boolean
          asset_class?: string | null
          bias?: string
          bot_username?: string | null
          channel_chat_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_broadcast?: string | null
          last_pinged_at?: string | null
          pair_label?: string
          pair_name: string
          ping_count?: number
          telegram_bot_token: string
          tier?: string
          updated_at?: string
          webhook_secret?: string
          webhook_url?: string | null
        }
        Update: {
          active?: boolean
          asset_class?: string | null
          bias?: string
          bot_username?: string | null
          channel_chat_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_broadcast?: string | null
          last_pinged_at?: string | null
          pair_label?: string
          pair_name?: string
          ping_count?: number
          telegram_bot_token?: string
          tier?: string
          updated_at?: string
          webhook_secret?: string
          webhook_url?: string | null
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
      card_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          notes: string | null
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          tier?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      civility_settings: {
        Row: {
          id: number
          swear_default: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          swear_default?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          swear_default?: boolean
          updated_at?: string
          updated_by?: string | null
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
      custom_hubs: {
        Row: {
          accent: string
          created_at: string
          created_by: string | null
          href: string
          icon: string
          id: string
          published: boolean
          sort_order: number
          swear_chat_enabled: boolean
          tagline: string
          title: string
          updated_at: string
        }
        Insert: {
          accent?: string
          created_at?: string
          created_by?: string | null
          href: string
          icon?: string
          id?: string
          published?: boolean
          sort_order?: number
          swear_chat_enabled?: boolean
          tagline?: string
          title: string
          updated_at?: string
        }
        Update: {
          accent?: string
          created_at?: string
          created_by?: string | null
          href?: string
          icon?: string
          id?: string
          published?: boolean
          sort_order?: number
          swear_chat_enabled?: boolean
          tagline?: string
          title?: string
          updated_at?: string
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
      fleet_settings: {
        Row: {
          global_frequency: string
          id: number
          updated_at: string
        }
        Insert: {
          global_frequency?: string
          id?: number
          updated_at?: string
        }
        Update: {
          global_frequency?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      hub_settings: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          hub_key: string
          id: string
          integrations: Json
          model: string
          style_prompt: string
          tuning: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          hub_key: string
          id?: string
          integrations?: Json
          model?: string
          style_prompt?: string
          tuning?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          hub_key?: string
          id?: string
          integrations?: Json
          model?: string
          style_prompt?: string
          tuning?: Json
          updated_at?: string
          updated_by?: string | null
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
      magic_link_audit: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          id: string
          redirect_to: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          redirect_to?: string | null
          status: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          redirect_to?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      market_pulse: {
        Row: {
          asset: string
          delta_pct: number | null
          direction: string
          prev_price: number | null
          price: number | null
          source: string | null
          updated_at: string
        }
        Insert: {
          asset: string
          delta_pct?: number | null
          direction?: string
          prev_price?: number | null
          price?: number | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          asset?: string
          delta_pct?: number | null
          direction?: string
          prev_price?: number | null
          price?: number | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pass_orders: {
        Row: {
          amount_cents: number
          boss_decision_note: string | null
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          duration_days: number
          environment: string
          id: string
          issued_pass_id: string | null
          kind: string
          pass_number: string | null
          product_id: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string
          telegram_alert_msg_id: string | null
          updated_at: string
          user_chat_id: number | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          boss_decision_note?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          duration_days: number
          environment?: string
          id?: string
          issued_pass_id?: string | null
          kind: string
          pass_number?: string | null
          product_id: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id: string
          telegram_alert_msg_id?: string | null
          updated_at?: string
          user_chat_id?: number | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          boss_decision_note?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          duration_days?: number
          environment?: string
          id?: string
          issued_pass_id?: string | null
          kind?: string
          pass_number?: string | null
          product_id?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string
          telegram_alert_msg_id?: string | null
          updated_at?: string
          user_chat_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pass_orders_issued_pass_id_fkey"
            columns: ["issued_pass_id"]
            isOneToOne: false
            referencedRelation: "vip_passes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pass_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_credit_grants: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string | null
          credits: number
          email: string
          grant_rank: Database["public"]["Enums"]["syndicate_rank"] | null
          id: string
          notes: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number
          email: string
          grant_rank?: Database["public"]["Enums"]["syndicate_rank"] | null
          id?: string
          notes?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number
          email?: string
          grant_rank?: Database["public"]["Enums"]["syndicate_rank"] | null
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      portal_marketing: {
        Row: {
          apollo_filters: Json
          audience_icp: string | null
          campaign_id: string | null
          created_at: string
          email_body: string | null
          email_subject: string | null
          error: string | null
          expanded_pitch: string | null
          hashtags: string[]
          id: string
          portal_id: string
          portal_slug: string
          seo_description: string | null
          seo_title: string | null
          status: string
          telegram_caption: string | null
          telegram_message_id: string | null
          updated_at: string
        }
        Insert: {
          apollo_filters?: Json
          audience_icp?: string | null
          campaign_id?: string | null
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          error?: string | null
          expanded_pitch?: string | null
          hashtags?: string[]
          id?: string
          portal_id: string
          portal_slug: string
          seo_description?: string | null
          seo_title?: string | null
          status?: string
          telegram_caption?: string | null
          telegram_message_id?: string | null
          updated_at?: string
        }
        Update: {
          apollo_filters?: Json
          audience_icp?: string | null
          campaign_id?: string | null
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          error?: string | null
          expanded_pitch?: string | null
          hashtags?: string[]
          id?: string
          portal_id?: string
          portal_slug?: string
          seo_description?: string | null
          seo_title?: string | null
          status?: string
          telegram_caption?: string | null
          telegram_message_id?: string | null
          updated_at?: string
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
      portal_view_events: {
        Row: {
          country: string | null
          created_at: string
          id: string
          kind: string
          path: string | null
          referrer: string | null
          slug: string
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          kind: string
          path?: string | null
          referrer?: string | null
          slug: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          kind?: string
          path?: string | null
          referrer?: string | null
          slug?: string
          user_agent?: string | null
          visitor_id?: string | null
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
          connect_openers: Json
          created_at: string
          created_by: string | null
          id: string
          jokes: Json
          kind: string
          language: string
          lyric_text: string | null
          music_hooks: Json
          name: string
          niche: string
          price_cents: number
          scout_meta: Json
          seo_description: string | null
          seo_image_url: string | null
          seo_refreshed_at: string | null
          seo_title: string | null
          slug: string
          style: string | null
          swear_chat_enabled: boolean
          telegram_config: Json
          theme: string
          theme_config: Json
          tool_ideas: Json
          trade_briefs: Json
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
          connect_openers?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          jokes?: Json
          kind?: string
          language?: string
          lyric_text?: string | null
          music_hooks?: Json
          name: string
          niche: string
          price_cents?: number
          scout_meta?: Json
          seo_description?: string | null
          seo_image_url?: string | null
          seo_refreshed_at?: string | null
          seo_title?: string | null
          slug: string
          style?: string | null
          swear_chat_enabled?: boolean
          telegram_config?: Json
          theme?: string
          theme_config?: Json
          tool_ideas?: Json
          trade_briefs?: Json
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
          connect_openers?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          jokes?: Json
          kind?: string
          language?: string
          lyric_text?: string | null
          music_hooks?: Json
          name?: string
          niche?: string
          price_cents?: number
          scout_meta?: Json
          seo_description?: string | null
          seo_image_url?: string | null
          seo_refreshed_at?: string | null
          seo_title?: string | null
          slug?: string
          style?: string | null
          swear_chat_enabled?: boolean
          telegram_config?: Json
          theme?: string
          theme_config?: Json
          tool_ideas?: Json
          trade_briefs?: Json
          updated_at?: string
          vibe?: string | null
          view_count?: number
          vip?: boolean
        }
        Relationships: []
      }
      power_packs: {
        Row: {
          anthem_prompt: string | null
          asset: string
          bear_case: string | null
          bias: string
          bull_case: string | null
          citations: Json
          command: string
          created_at: string
          headlines: Json
          id: string
          status: string
          summary: string | null
          suno_audio_url: string | null
          suno_task_id: string | null
          telegram_caption: string | null
          telegram_message_id: string | null
          telegram_status: string
          updated_at: string
          user_id: string
          video_prompt: string | null
          video_url: string | null
        }
        Insert: {
          anthem_prompt?: string | null
          asset: string
          bear_case?: string | null
          bias?: string
          bull_case?: string | null
          citations?: Json
          command: string
          created_at?: string
          headlines?: Json
          id?: string
          status?: string
          summary?: string | null
          suno_audio_url?: string | null
          suno_task_id?: string | null
          telegram_caption?: string | null
          telegram_message_id?: string | null
          telegram_status?: string
          updated_at?: string
          user_id: string
          video_prompt?: string | null
          video_url?: string | null
        }
        Update: {
          anthem_prompt?: string | null
          asset?: string
          bear_case?: string | null
          bias?: string
          bull_case?: string | null
          citations?: Json
          command?: string
          created_at?: string
          headlines?: Json
          id?: string
          status?: string
          summary?: string | null
          suno_audio_url?: string | null
          suno_task_id?: string | null
          telegram_caption?: string | null
          telegram_message_id?: string | null
          telegram_status?: string
          updated_at?: string
          user_id?: string
          video_prompt?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          contact_card: Json
          created_at: string
          credits: number
          display_name: string | null
          email: string
          feature_flags: Json
          free_clicks_used: number
          id: string
          rank: Database["public"]["Enums"]["syndicate_rank"]
          referred_by_reseller: string | null
          status: Database["public"]["Enums"]["account_status"]
          stream_expires_at: string | null
          stream_links: Json
          stream_status: string | null
          stream_verified_at: string | null
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          contact_card?: Json
          created_at?: string
          credits?: number
          display_name?: string | null
          email: string
          feature_flags?: Json
          free_clicks_used?: number
          id: string
          rank?: Database["public"]["Enums"]["syndicate_rank"]
          referred_by_reseller?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          stream_expires_at?: string | null
          stream_links?: Json
          stream_status?: string | null
          stream_verified_at?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          contact_card?: Json
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string
          feature_flags?: Json
          free_clicks_used?: number
          id?: string
          rank?: Database["public"]["Enums"]["syndicate_rank"]
          referred_by_reseller?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          stream_expires_at?: string | null
          stream_links?: Json
          stream_status?: string | null
          stream_verified_at?: string | null
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
          price_cents: number
          reseller_id: string | null
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
          price_cents?: number
          reseller_id?: string | null
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
          price_cents?: number
          reseller_id?: string | null
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
      reseller_accounts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          credits: number
          display_name: string | null
          id: string
          markup_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          credits?: number
          display_name?: string | null
          id?: string
          markup_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          credits?: number
          display_name?: string | null
          id?: string
          markup_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reseller_credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          reseller_user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          reseller_user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          reseller_user_id?: string
        }
        Relationships: []
      }
      signal_bundles: {
        Row: {
          channel_chat_id: string
          compliance_badge: string
          created_at: string
          error: string | null
          id: string
          intro_message_id: number | null
          portal_slug: string
          signal_payload: Json
          status: string
          suno_audio_url: string | null
          suno_message_id: number | null
          suno_task_id: string | null
          updated_at: string
          user_id: string
          veo_message_id: number | null
          veo_operation: string | null
          veo_video_url: string | null
        }
        Insert: {
          channel_chat_id: string
          compliance_badge?: string
          created_at?: string
          error?: string | null
          id?: string
          intro_message_id?: number | null
          portal_slug: string
          signal_payload?: Json
          status?: string
          suno_audio_url?: string | null
          suno_message_id?: number | null
          suno_task_id?: string | null
          updated_at?: string
          user_id: string
          veo_message_id?: number | null
          veo_operation?: string | null
          veo_video_url?: string | null
        }
        Update: {
          channel_chat_id?: string
          compliance_badge?: string
          created_at?: string
          error?: string | null
          id?: string
          intro_message_id?: number | null
          portal_slug?: string
          signal_payload?: Json
          status?: string
          suno_audio_url?: string | null
          suno_message_id?: number | null
          suno_task_id?: string | null
          updated_at?: string
          user_id?: string
          veo_message_id?: number | null
          veo_operation?: string | null
          veo_video_url?: string | null
        }
        Relationships: []
      }
      signup_pass_claims: {
        Row: {
          created_at: string
          id: string
          pass_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pass_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pass_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_pass_claims_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "signup_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_passes: {
        Row: {
          created_at: string
          created_by: string | null
          credits: number
          expires_at: string | null
          id: string
          label: string | null
          max_uses: number
          redeem_code: string | null
          token: string
          uses: number
          vip_days: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credits?: number
          expires_at?: string | null
          id?: string
          label?: string | null
          max_uses?: number
          redeem_code?: string | null
          token: string
          uses?: number
          vip_days?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credits?: number
          expires_at?: string | null
          id?: string
          label?: string | null
          max_uses?: number
          redeem_code?: string | null
          token?: string
          uses?: number
          vip_days?: number | null
        }
        Relationships: []
      }
      store_packs: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          credits: number | null
          id: string
          name: string
          price_id: string
          recurring: boolean
          sort_order: number
          tagline: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          credits?: number | null
          id?: string
          name: string
          price_id: string
          recurring?: boolean
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          credits?: number | null
          id?: string
          name?: string
          price_id?: string
          recurring?: boolean
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_products: {
        Row: {
          active: boolean
          asset_url: string | null
          created_at: string
          currency: string
          description: string | null
          duration_days: number | null
          id: string
          image_url: string | null
          kind: string
          metadata: Json
          price_cents: number
          sku: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number | null
          id?: string
          image_url?: string | null
          kind: string
          metadata?: Json
          price_cents: number
          sku: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number | null
          id?: string
          image_url?: string | null
          kind?: string
          metadata?: Json
          price_cents?: number
          sku?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          credits_per_song: number
          id: number
          stream_portal_url: string
          updated_at: string
        }
        Insert: {
          credits_per_song?: number
          id?: number
          stream_portal_url?: string
          updated_at?: string
        }
        Update: {
          credits_per_song?: number
          id?: number
          stream_portal_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      stream_account_links: {
        Row: {
          enc_server: string | null
          enc_username: string
          expires_at: string | null
          id: string
          linked_at: string
          notes: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          enc_server?: string | null
          enc_username: string
          expires_at?: string | null
          id?: string
          linked_at?: string
          notes?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          enc_server?: string | null
          enc_username?: string
          expires_at?: string | null
          id?: string
          linked_at?: string
          notes?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stream_expiry_reminders: {
        Row: {
          expires_at: string
          notified_at: string
          threshold_days: number
          user_id: string
        }
        Insert: {
          expires_at: string
          notified_at?: string
          threshold_days: number
          user_id: string
        }
        Update: {
          expires_at?: string
          notified_at?: string
          threshold_days?: number
          user_id?: string
        }
        Relationships: []
      }
      stream_verification_requests: {
        Row: {
          auto_expires_at: string | null
          auto_status: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          enc_password: string | null
          enc_payload: string | null
          enc_server: string | null
          enc_username: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_expires_at?: string | null
          auto_status?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          enc_password?: string | null
          enc_payload?: string | null
          enc_server?: string | null
          enc_username?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_expires_at?: string | null
          auto_status?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          enc_password?: string | null
          enc_payload?: string | null
          enc_server?: string | null
          enc_username?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          power_pack_id: string | null
          prompt: string | null
          raw: Json
          signal_bundle_id: string | null
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
          power_pack_id?: string | null
          prompt?: string | null
          raw?: Json
          signal_bundle_id?: string | null
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
          power_pack_id?: string | null
          prompt?: string | null
          raw?: Json
          signal_bundle_id?: string | null
          status?: string
          style_tags?: string | null
          task_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suno_jobs_signal_bundle_id_fkey"
            columns: ["signal_bundle_id"]
            isOneToOne: false
            referencedRelation: "signal_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      swear_lexicon: {
        Row: {
          category: string
          items: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          items?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          items?: string[]
          updated_at?: string
          updated_by?: string | null
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
      telegram_link_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          token: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          token: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_pass_reminders: {
        Row: {
          id: string
          kind: string
          pass_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          pass_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          pass_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_pass_reminders_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "vip_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_user_links: {
        Row: {
          chat_id: number | null
          code_expires_at: string | null
          created_at: string
          link_code: string | null
          linked_at: string | null
          notify_live: boolean
          notify_purchases: boolean
          notify_reminders: boolean
          tg_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id?: number | null
          code_expires_at?: string | null
          created_at?: string
          link_code?: string | null
          linked_at?: string | null
          notify_live?: boolean
          notify_purchases?: boolean
          notify_reminders?: boolean
          tg_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: number | null
          code_expires_at?: string | null
          created_at?: string
          link_code?: string | null
          linked_at?: string | null
          notify_live?: boolean
          notify_purchases?: boolean
          notify_reminders?: boolean
          tg_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      topup_requests: {
        Row: {
          created_at: string
          credits_granted: number | null
          credits_requested: number
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          email: string | null
          id: string
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_granted?: number | null
          credits_requested?: number
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          email?: string | null
          id?: string
          reason?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_granted?: number | null
          credits_requested?: number
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          email?: string | null
          id?: string
          reason?: string
          status?: string
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
      user_telegram_links: {
        Row: {
          chat_id: number
          first_name: string | null
          linked_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: number
          first_name?: string | null
          linked_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          first_name?: string | null
          linked_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      vault_credentials: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          enc_password: string
          enc_username: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          enc_password: string
          enc_username: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          enc_password?: string
          enc_username?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      vip_notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "vip_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_notifications: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string
          id: string
          link_url: string | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by: string
          id?: string
          link_url?: string | null
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          link_url?: string | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      vip_pass_pool: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      vip_pass_reveals: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          pool_id: string
          revealed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          pool_id: string
          revealed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          pool_id?: string
          revealed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_pass_reveals_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "vip_pass_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_passes: {
        Row: {
          created_at: string
          expires_at: string
          granted_by: string | null
          id: string
          notes: string | null
          revoked_at: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          source?: string
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
      _stream_link_secret: { Args: never; Returns: string }
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
      apply_pending_grants: {
        Args: { _email: string; _user_id: string }
        Returns: number
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
      boss_approve_topup: {
        Args: { _credits: number; _id: string; _note: string }
        Returns: Json
      }
      boss_create_reseller: {
        Args: {
          _display_name: string
          _initial_credits: number
          _markup_cents: number
          _user_id: string
        }
        Returns: string
      }
      boss_decide_pass_order: {
        Args: { _approve: boolean; _note?: string; _order_id: string }
        Returns: Json
      }
      boss_decide_stream_request: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: Json
      }
      boss_delete_vault_credential: { Args: { _id: string }; Returns: boolean }
      boss_delete_vip_pass_pool: { Args: { _id: string }; Returns: boolean }
      boss_deny_topup: {
        Args: { _id: string; _note: string }
        Returns: boolean
      }
      boss_grant_by_email: {
        Args: {
          _credits: number
          _email: string
          _grant_rank: Database["public"]["Enums"]["syndicate_rank"]
          _notes: string
        }
        Returns: Json
      }
      boss_grant_vip_pass: {
        Args: {
          _expires_at: string
          _notes: string
          _source: string
          _user_id: string
        }
        Returns: string
      }
      boss_link_stream_account: {
        Args: {
          _expires_at: string
          _notes?: string
          _server: string
          _status: string
          _user_id: string
          _username: string
        }
        Returns: string
      }
      boss_list_stream_links: {
        Args: never
        Returns: {
          email: string
          expires_at: string
          id: string
          linked_at: string
          notes: string
          server: string
          status: string
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      boss_list_stream_requests: {
        Args: { _status: string }
        Returns: {
          auto_expires_at: string
          auto_status: string
          created_at: string
          decided_at: string
          decision_note: string
          email: string
          has_password: boolean
          id: string
          rank: string
          server: string
          status: string
          user_id: string
          username: string
        }[]
      }
      boss_list_vault_credentials: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          id: string
          label: string
          password: string
          sort_order: number
          updated_at: string
          username: string
        }[]
      }
      boss_purge_view_events: { Args: never; Returns: number }
      boss_revoke_vip_pass: { Args: { _pass_id: string }; Returns: boolean }
      boss_set_banned: {
        Args: { _banned: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      boss_topup_reseller: {
        Args: { _delta: number; _reason: string; _user_id: string }
        Returns: number
      }
      boss_unlink_stream_account: {
        Args: { _user_id: string }
        Returns: boolean
      }
      boss_upsert_vault_credential: {
        Args: {
          _active: boolean
          _id: string
          _label: string
          _password: string
          _sort_order: number
          _username: string
        }
        Returns: string
      }
      boss_upsert_vip_pass_pool: {
        Args: {
          _active: boolean
          _code: string
          _id: string
          _label: string
          _sort_order: number
        }
        Returns: string
      }
      civility_default: { Args: never; Returns: boolean }
      claim_real_og_bundle: {
        Args: {
          _amount_cents: number
          _bundle_sku: string
          _credits: number
          _currency: string
          _environment: string
          _stripe_session_id: string
          _user_id: string
        }
        Returns: Json
      }
      claim_real_og_pass: {
        Args: {
          _amount_cents: number
          _currency: string
          _environment: string
          _stripe_session_id: string
          _user_id: string
        }
        Returns: Json
      }
      claim_signup_pass: { Args: { _token: string }; Returns: Json }
      claim_telegram_link_code: {
        Args: { _chat_id: number; _code: string; _tg_username: string }
        Returns: Json
      }
      enqueue_stream_verification: {
        Args: {
          _auto_expires_at: string
          _auto_payload: Json
          _auto_status: string
          _password: string
          _server: string
          _user_id: string
          _username: string
        }
        Returns: string
      }
      get_user_purchases_summary: { Args: never; Returns: Json }
      has_active_vip: {
        Args: { _env?: string; _user?: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_portal_view: { Args: { _slug: string }; Returns: number }
      is_boss: { Args: { _uid: string }; Returns: boolean }
      is_real_og: { Args: { _uid?: string }; Returns: boolean }
      mark_stream_verified: {
        Args: { _expires_at: string; _status: string; _user_id: string }
        Returns: undefined
      }
      notify_stream_expiring_soon: { Args: never; Returns: number }
      notify_user: {
        Args: {
          _body: string
          _link: string
          _severity: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      plan_includes_tier: {
        Args: {
          _plan: Database["public"]["Enums"]["subscription_plan"]
          _required: Database["public"]["Enums"]["subscription_plan"]
        }
        Returns: boolean
      }
      purge_portal_view_events: { Args: never; Returns: number }
      purge_stream_verification_requests: { Args: never; Returns: Json }
      redeem_code: { Args: { _code: string }; Returns: Json }
      refresh_news_scout: {
        Args: { _meta: Json; _slug: string }
        Returns: undefined
      }
      request_topup: {
        Args: { _credits: number; _reason: string }
        Returns: string
      }
      reseller_mint_code: {
        Args: {
          _code: string
          _credits: number
          _max_uses: number
          _price_cents: number
        }
        Returns: Json
      }
      reveal_vault_credential: { Args: never; Returns: Json }
      reveal_vip_pass: { Args: never; Returns: Json }
      set_stream_credentials: {
        Args: {
          _password: string
          _server: string
          _user_id: string
          _username: string
        }
        Returns: undefined
      }
      spend_credits: {
        Args: { _amount: number; _reason: string }
        Returns: number
      }
    }
    Enums: {
      account_status: "free" | "vip"
      app_role: "admin" | "user" | "reseller"
      subscription_plan: "free" | "metal" | "energy" | "syndicate"
      syndicate_rank: "prospect" | "enforcer" | "vip" | "boss" | "stream_user"
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
      app_role: ["admin", "user", "reseller"],
      subscription_plan: ["free", "metal", "energy", "syndicate"],
      syndicate_rank: ["prospect", "enforcer", "vip", "boss", "stream_user"],
    },
  },
} as const
