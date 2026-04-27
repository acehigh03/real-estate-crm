export type LeadStatus = "New" | "Contacted" | "Replied" | "Hot" | "Dead" | "DNC";
export type LeadClassification = "HOT" | "WARM" | "COLD" | "DEAD" | "OPT_OUT" | "UNKNOWN";
export type LeadStage = "New" | "Contacted" | "Replied" | "Hot Lead" | "Follow Up" | "Closed" | "DNC";
export type LeadPriority = "high" | "medium" | "low";
export type MessageClassification = "HOT" | "WARM" | "NOT_INTERESTED" | "STOP_DNC" | "NEEDS_REVIEW";
export type CampaignType = "cash_offer" | "foreclosure_help" | "probate" | "tax_sale";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: {
          campaign_id: string | null;
          city: string | null;
          created_at: string;
          dnc_reason: string | null;
          email: string | null;
          first_name: string;
          classification: LeadClassification;
          id: string;
          is_dnc: boolean;
          last_name: string;
          last_contacted_at: string | null;
          last_replied_at: string | null;
          lead_score: number | null;
          lead_source: string | null;
          mailing_address: string | null;
          motivation_score: number;
          next_follow_up_at: string | null;
          notes_summary: string | null;
          phone: string;
          phone_normalized: string;
          priority: LeadPriority | null;
          property_address: string;
          stage: LeadStage | null;
          state: string | null;
          status: LeadStatus;
          tag: string | null;
          updated_at: string;
          user_id: string;
          zip: string | null;
        };
        Insert: {
          campaign_id?: string | null;
          city?: string | null;
          classification?: LeadClassification;
          dnc_reason?: string | null;
          email?: string | null;
          first_name: string;
          is_dnc?: boolean;
          last_name: string;
          last_contacted_at?: string | null;
          last_replied_at?: string | null;
          lead_score?: number | null;
          lead_source?: string | null;
          mailing_address?: string | null;
          motivation_score?: number;
          next_follow_up_at?: string | null;
          notes_summary?: string | null;
          phone: string;
          phone_normalized: string;
          priority?: LeadPriority | null;
          property_address: string;
          stage?: LeadStage | null;
          state?: string | null;
          status?: LeadStatus;
          tag?: string | null;
          user_id: string;
          zip?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          campaign_type: CampaignType | null;
          created_at: string;
          hot_count: number;
          id: string;
          messaged_count: number;
          name: string;
          replied_count: number;
          status: string | null;
          template_variant: string | null;
          total_leads: number;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          campaign_type?: CampaignType | null;
          hot_count?: number;
          messaged_count?: number;
          name: string;
          replied_count?: number;
          status?: string | null;
          template_variant?: string | null;
          total_leads?: number;
          user_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          body: string;
          classification: MessageClassification | null;
          created_at: string;
          direction: "inbound" | "outbound";
          id: string;
          lead_id: string | null;
          phone: string | null;
          status: string | null;
          telnyx_message_id: string | null;
          to_number: string;
          user_id: string | null;
        };
        Insert: {
          body: string;
          classification?: MessageClassification | null;
          direction: "inbound" | "outbound";
          lead_id?: string | null;
          phone?: string | null;
          status?: string | null;
          telnyx_message_id?: string | null;
          to_number: string;
          user_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      notes: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          lead_id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          lead_id: string;
          user_id: string;
        };
        Update: {
          body?: string;
        };
        Relationships: [];
      };
      followups: {
        Row: {
          completed_at: string | null;
          created_at: string;
          due_date: string;
          id: string;
          lead_id: string;
          note: string | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          due_date: string;
          lead_id: string;
          note?: string | null;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["followups"]["Insert"]>;
        Relationships: [];
      };
      import_logs: {
        Row: {
          created_at: string;
          failed_count: number;
          file_name: string;
          id: string;
          imported_count: number;
          messaged_count: number;
          skipped_count: number;
          total_rows: number;
          user_id: string;
        };
        Insert: {
          failed_count?: number;
          file_name: string;
          imported_count?: number;
          messaged_count?: number;
          skipped_count?: number;
          total_rows?: number;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["import_logs"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
        };
        Insert: {
          email: string;
          id: string;
        };
        Update: {
          email?: string;
        };
        Relationships: [];
      };
      sms_settings: {
        Row: {
          id: string;
          user_id: string;
          auto_send_enabled: boolean;
          send_window_start: string; // "HH:MM:SS" (Postgres time)
          send_window_end: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          auto_send_enabled?: boolean;
          send_window_start?: string;
          send_window_end?: string;
          timezone?: string;
        };
        Update: {
          auto_send_enabled?: boolean;
          send_window_start?: string;
          send_window_end?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sms_queue: {
        Row: {
          id: string;
          lead_id: string;
          message: string;
          status: string;
          scheduled_for: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          message: string;
          status?: string;
          scheduled_for?: string | null;
          sent_at?: string | null;
        };
        Update: {
          status?: string;
          sent_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
