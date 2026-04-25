export type LeadStatus = "New" | "Contacted" | "Replied" | "Hot" | "Dead" | "DNC";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: {
          created_at: string;
          email: string | null;
          first_name: string;
          follow_up_date: string | null;
          id: string;
          last_name: string;
          lead_source: string | null;
          mailing_address: string | null;
          notes_summary: string | null;
          phone: string;
          phone_normalized: string;
          property_address: string;
          status: LeadStatus;
          tag: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          email?: string | null;
          first_name: string;
          follow_up_date?: string | null;
          last_name: string;
          lead_source?: string | null;
          mailing_address?: string | null;
          notes_summary?: string | null;
          phone: string;
          phone_normalized: string;
          property_address: string;
          status?: LeadStatus;
          tag?: string | null;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          body: string;
          created_at: string;
          direction: "inbound" | "outbound";
          id: string;
          lead_id: string | null;
          status: string | null;
          telnyx_message_id: string | null;
          to_number: string;
          user_id: string | null;
        };
        Insert: {
          body: string;
          direction: "inbound" | "outbound";
          lead_id?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
