export type LeadStatus = "New" | "Contacted" | "Replied" | "Hot" | "Dead" | "DNC";
export type LeadClassification = "HOT" | "WARM" | "COLD" | "DEAD" | "OPT_OUT" | "UNKNOWN";
// "Closed" is legacy: older rows used it for both Offer Sent and Dead. New writes use the distinct values.
export type LeadStage =
  | "New"
  | "Contacted"
  | "Replied"
  | "Hot Lead"
  | "Follow Up"
  | "Skip Traced"
  | "Offer Sent"
  | "Dead"
  | "Closed"
  | "DNC";
export type LeadPriority = "high" | "medium" | "low";
export type MessageClassification = "HOT" | "WARM" | "NOT_INTERESTED" | "STOP_DNC" | "NEEDS_REVIEW";
export type CampaignType = "cash_offer" | "foreclosure_help" | "probate" | "tax_sale" | "custom";
export type DripWorkflowStatus = "draft" | "active" | "paused" | "archived";
export type DripEnrollmentStatus = "active" | "paused" | "completed" | "cancelled";
export type AutoResponderTrigger = "keyword" | "any_reply" | "first_reply" | "sentiment";
export type ReplySentiment = "interested" | "maybe" | "not_interested" | "stop" | "question";
export type DripExecutionStatus = "queued" | "processing" | "sent" | "delivered" | "failed" | "skipped" | "cancelled";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      sms_opt_ins: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          phone_normalized: string;
          property_address: string | null;
          consented: boolean;
          consent_text: string;
          consent_version: string;
          source_url: string;
          user_agent: string | null;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          phone_normalized: string;
          property_address?: string | null;
          consented: boolean;
          consent_text: string;
          consent_version: string;
          source_url: string;
          user_agent?: string | null;
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      leads: {
        Row: {
          campaign_id: string | null;
          city: string | null;
          created_at: string;
          deadline: string | null;
          deal_value: number | null;
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
          pipeline_position: number | null;
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
          deadline?: string | null;
          deal_value?: number | null;
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
          pipeline_position?: number | null;
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
          first_sms_template: string | null;
          followup_1_template: string | null;
          followup_2_template: string | null;
          followup_3_template: string | null;
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
          first_sms_template?: string | null;
          followup_1_template?: string | null;
          followup_2_template?: string | null;
          followup_3_template?: string | null;
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
      foreclosure_leads: {
        Row: {
          id: string | number;
          owner_name: string | null;
          first_name: string | null;
          last_name: string | null;
          name: string | null;
          full_name: string | null;
          phone: string | null;
          email: string | null;
          property_address: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          campaign_name: string | null;
          campaign_type: string | null;
          crm_status: string | null;
          crm_notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string | number;
          owner_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          name?: string | null;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          property_address?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          campaign_name?: string | null;
          campaign_type?: string | null;
          crm_status?: string | null;
          crm_notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["foreclosure_leads"]["Insert"]>;
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
          read_at: string | null;
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
          read_at?: string | null;
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
      drip_workflows: {
        Row: { id: string; user_id: string; name: string; status: DripWorkflowStatus; continue_after_reply: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name: string; status?: DripWorkflowStatus; continue_after_reply?: boolean };
        Update: Partial<Database["public"]["Tables"]["drip_workflows"]["Insert"]>;
        Relationships: [];
      };
      drip_steps: {
        Row: { id: string; workflow_id: string; step_number: number; delay_minutes: number; message: string; created_at: string; updated_at: string };
        Insert: { id?: string; workflow_id: string; step_number: number; delay_minutes?: number; message: string };
        Update: Partial<Database["public"]["Tables"]["drip_steps"]["Insert"]>;
        Relationships: [];
      };
      drip_enrollments: {
        Row: { id: string; user_id: string; workflow_id: string; lead_id: string; status: DripEnrollmentStatus; enrolled_at: string; cancelled_at: string | null; cancel_reason: string | null; last_reply_at_enrollment: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; workflow_id: string; lead_id: string; status?: DripEnrollmentStatus; enrolled_at?: string; cancelled_at?: string | null; cancel_reason?: string | null; last_reply_at_enrollment?: string | null };
        Update: Partial<Database["public"]["Tables"]["drip_enrollments"]["Insert"]>;
        Relationships: [];
      };
      drip_executions: {
        Row: { id: string; user_id: string; enrollment_id: string; step_id: string; scheduled_for: string; sent_at: string | null; status: DripExecutionStatus; rendered_message: string | null; telnyx_message_id: string | null; error: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; enrollment_id: string; step_id: string; scheduled_for: string; sent_at?: string | null; status?: DripExecutionStatus; rendered_message?: string | null; telnyx_message_id?: string | null; error?: string | null };
        Update: Partial<Database["public"]["Tables"]["drip_executions"]["Insert"]>;
        Relationships: [];
      };
      auto_responders: {
        Row: { id: string; user_id: string; name: string; is_active: boolean; trigger_type: AutoResponderTrigger; trigger_value: string | null; conditions: Json; actions: Json; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name: string; is_active?: boolean; trigger_type: AutoResponderTrigger; trigger_value?: string | null; conditions?: Json; actions: Json };
        Update: Partial<Database["public"]["Tables"]["auto_responders"]["Insert"]>;
        Relationships: [];
      };
      reply_classifications: {
        Row: { id: string; user_id: string | null; lead_id: string | null; message_id: string | null; message_body: string | null; sentiment: ReplySentiment | null; source: string | null; raw_response: Json | null; classified_at: string };
        Insert: { id?: string; user_id?: string | null; lead_id?: string | null; message_id?: string | null; message_body?: string | null; sentiment?: ReplySentiment | null; source?: string | null; raw_response?: Json | null };
        Update: Partial<Database["public"]["Tables"]["reply_classifications"]["Insert"]>;
        Relationships: [];
      };
      automation_history: {
        Row: { id: string; user_id: string | null; lead_id: string | null; automation_type: string | null; automation_name: string | null; action_taken: string | null; result: string | null; created_at: string };
        Insert: { id?: string; user_id?: string | null; lead_id?: string | null; automation_type?: string | null; automation_name?: string | null; action_taken?: string | null; result?: string | null };
        Update: Partial<Database["public"]["Tables"]["automation_history"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
