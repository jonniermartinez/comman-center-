// Generado con el MCP de Supabase (generate_typescript_types).
// No editar a mano: se regenera cada vez que cambia el esquema.

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          after: Json | null
          before: Json | null
          company_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
        ]
      }
      billing_entries: {
        Row: {
          amount: number
          branch_id: string
          company_id: string
          created_at: string
          created_by: string | null
          financing_code: string
          id: string
          report_date: string
          responsable_nombre: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          branch_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          financing_code: string
          id?: string
          report_date: string
          responsable_nombre?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          financing_code?: string
          id?: string
          report_date?: string
          responsable_nombre?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_monthly"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "billing_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "billing_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_entries_financing_code_fkey"
            columns: ["financing_code"]
            isOneToOne: false
            referencedRelation: "financing_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "billing_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      branches: {
        Row: {
          city: string | null
          company_id: string
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          is_primary: boolean
          name: string
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_primary?: boolean
          name: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "branches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      collection_entries: {
        Row: {
          amount: number
          branch_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          method_code: string
          report_date: string
          responsable_nombre: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          branch_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method_code: string
          report_date: string
          responsable_nombre?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method_code?: string
          report_date?: string
          responsable_nombre?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_monthly"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "collection_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "collection_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collection_entries_method_code_fkey"
            columns: ["method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "collection_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collection_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      companies: {
        Row: {
          accent_color: string
          archived_at: string | null
          city: string | null
          created_at: string
          created_by: string | null
          crm_label: string | null
          department: string | null
          id: string
          logo_url: string | null
          name: string
          nit: string | null
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
        }
        Insert: {
          accent_color?: string
          archived_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          crm_label?: string | null
          department?: string | null
          id?: string
          logo_url?: string | null
          name: string
          nit?: string | null
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Update: {
          accent_color?: string
          archived_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          crm_label?: string | null
          department?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          nit?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      company_financing_types: {
        Row: {
          active: boolean
          company_id: string
          financing_code: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          company_id: string
          financing_code: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          financing_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_financing_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_financing_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_financing_types_financing_code_fkey"
            columns: ["financing_code"]
            isOneToOne: false
            referencedRelation: "financing_types"
            referencedColumns: ["code"]
          },
        ]
      }
      company_modules: {
        Row: {
          company_id: string
          enabled_at: string
          enabled_by: string | null
          module_code: string
        }
        Insert: {
          company_id: string
          enabled_at?: string
          enabled_by?: string | null
          module_code: string
        }
        Update: {
          company_id?: string
          enabled_at?: string
          enabled_by?: string | null
          module_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_modules_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_modules_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_modules_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["code"]
          },
        ]
      }
      company_payment_methods: {
        Row: {
          active: boolean
          company_id: string
          method_code: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          company_id: string
          method_code: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          method_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_payment_methods_method_code_fkey"
            columns: ["method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
        ]
      }
      company_users: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          branch_id: string | null
          company_id: string
          removed_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id?: string | null
          company_id: string
          removed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id?: string | null
          company_id?: string
          removed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_monthly"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      daily_kpi: {
        Row: {
          agendas_dia: number
          atencion_agendas: number
          branch_id: string
          clientes_atendidos: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          jornada: Database["public"]["Enums"]["jornada"]
          llamada_agenda: number
          llamadas_contestadas: number
          llamadas_realizadas: number
          notas: string | null
          report_date: string
          responsable_nombre: string
          updated_at: string
          updated_by: string | null
          user_id: string
          ventas_efectivas: number
          ventas_exitosas: number
        }
        Insert: {
          agendas_dia?: number
          atencion_agendas?: number
          branch_id: string
          clientes_atendidos?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          jornada?: Database["public"]["Enums"]["jornada"]
          llamada_agenda?: number
          llamadas_contestadas?: number
          llamadas_realizadas?: number
          notas?: string | null
          report_date: string
          responsable_nombre: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          ventas_efectivas?: number
          ventas_exitosas?: number
        }
        Update: {
          agendas_dia?: number
          atencion_agendas?: number
          branch_id?: string
          clientes_atendidos?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          jornada?: Database["public"]["Enums"]["jornada"]
          llamada_agenda?: number
          llamadas_contestadas?: number
          llamadas_realizadas?: number
          notas?: string | null
          report_date?: string
          responsable_nombre?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          ventas_efectivas?: number
          ventas_exitosas?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_kpi_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_monthly"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "daily_kpi_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "daily_kpi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_kpi_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_kpi_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      daily_management: {
        Row: {
          branch_id: string
          certificados: number
          chats_por_responder: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          jornada: Database["public"]["Enums"]["jornada"]
          notas: string | null
          report_date: string
          responsable_nombre: string
          tareas_caducadas: number
          tareas_del_dia: number
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          branch_id: string
          certificados?: number
          chats_por_responder?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          jornada?: Database["public"]["Enums"]["jornada"]
          notas?: string | null
          report_date: string
          responsable_nombre: string
          tareas_caducadas?: number
          tareas_del_dia?: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string
          certificados?: number
          chats_por_responder?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          jornada?: Database["public"]["Enums"]["jornada"]
          notas?: string | null
          report_date?: string
          responsable_nombre?: string
          tareas_caducadas?: number
          tareas_del_dia?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_management_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_management_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_monthly"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "daily_management_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_management_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "daily_management_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_management_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_management_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_management_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_management_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_management_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      financing_types: {
        Row: {
          code: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      metrics: {
        Row: {
          code: string
          name: string
          sort_order: number
          unit: string
        }
        Insert: {
          code: string
          name: string
          sort_order?: number
          unit: string
        }
        Update: {
          code?: string
          name?: string
          sort_order?: number
          unit?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          code: string
          description: string | null
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          description?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          description?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      objectives: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          locked: boolean
          metric_code: string
          period_month: string
          target_value: number
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          locked?: boolean
          metric_code: string
          period_month: string
          target_value: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          locked?: boolean
          metric_code?: string
          period_month?: string
          target_value?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "objectives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "objectives_metric_code_fkey"
            columns: ["metric_code"]
            isOneToOne: false
            referencedRelation: "metrics"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "objectives_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "objectives_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sales_entries: {
        Row: {
          branch_id: string
          company_id: string
          created_at: string
          created_by: string | null
          financing_code: string
          id: string
          kind: Database["public"]["Enums"]["venta_kind"]
          licencias: number
          report_date: string
          responsable_nombre: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
          ventas: number
        }
        Insert: {
          branch_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          financing_code: string
          id?: string
          kind?: Database["public"]["Enums"]["venta_kind"]
          licencias?: number
          report_date: string
          responsable_nombre?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          ventas?: number
        }
        Update: {
          branch_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          financing_code?: string
          id?: string
          kind?: Database["public"]["Enums"]["venta_kind"]
          licencias?: number
          report_date?: string
          responsable_nombre?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          ventas?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_monthly"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "sales_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sales_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sales_entries_financing_code_fkey"
            columns: ["financing_code"]
            isOneToOne: false
            referencedRelation: "financing_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sales_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      v_branch_monthly: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          comerciales: number | null
          company_id: string | null
          facturacion_mes: number | null
          is_primary: boolean | null
          licencias_mes: number | null
          llamadas_contestadas: number | null
          llamadas_realizadas: number | null
          period_month: string | null
          ratio_contactabilidad: number | null
          recaudo_mes: number | null
          status: Database["public"]["Enums"]["company_status"] | null
          ventas_efectivas: number | null
          ventas_mes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_capture_status: {
        Row: {
          company_id: string | null
          gestion_registrada: boolean | null
          kpi_registrado: boolean | null
          report_date: string | null
          responsable_nombre: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_daily_kpi: {
        Row: {
          agendas_dia: number | null
          atencion_agendas: number | null
          branch_id: string | null
          clientes_atendidos: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          jornada: Database["public"]["Enums"]["jornada"] | null
          llamada_agenda: number | null
          llamadas_contestadas: number | null
          llamadas_realizadas: number | null
          notas: string | null
          ratio_contactabilidad: number | null
          ratio_conversion_agendas: number | null
          ratio_conversion_llamada: number | null
          ratio_venta_presencial: number | null
          report_date: string | null
          responsable_nombre: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          ventas_efectivas: number | null
          ventas_exitosas: number | null
          volumen_venta_agendas: number | null
          volumen_venta_general: number | null
        }
        Insert: {
          agendas_dia?: number | null
          atencion_agendas?: number | null
          branch_id?: string | null
          clientes_atendidos?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          jornada?: Database["public"]["Enums"]["jornada"] | null
          llamada_agenda?: number | null
          llamadas_contestadas?: number | null
          llamadas_realizadas?: number | null
          notas?: string | null
          ratio_contactabilidad?: never
          ratio_conversion_agendas?: never
          ratio_conversion_llamada?: never
          ratio_venta_presencial?: never
          report_date?: string | null
          responsable_nombre?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          ventas_efectivas?: number | null
          ventas_exitosas?: number | null
          volumen_venta_agendas?: never
          volumen_venta_general?: never
        }
        Update: {
          agendas_dia?: number | null
          atencion_agendas?: number | null
          branch_id?: string | null
          clientes_atendidos?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          jornada?: Database["public"]["Enums"]["jornada"] | null
          llamada_agenda?: number | null
          llamadas_contestadas?: number | null
          llamadas_realizadas?: number | null
          notas?: string | null
          ratio_contactabilidad?: never
          ratio_conversion_agendas?: never
          ratio_conversion_llamada?: never
          ratio_venta_presencial?: never
          report_date?: string | null
          responsable_nombre?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          ventas_efectivas?: number | null
          ventas_exitosas?: number | null
          volumen_venta_agendas?: never
          volumen_venta_general?: never
        }
        Relationships: [
          {
            foreignKeyName: "daily_kpi_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_monthly"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "daily_kpi_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "daily_kpi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_kpi_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_kpi_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_daily_management_progress: {
        Row: {
          caducadas_final: number | null
          caducadas_inicial: number | null
          certificados: number | null
          chats_final: number | null
          chats_inicial: number | null
          company_id: string | null
          report_date: string | null
          responsable_nombre: string | null
          tareas_final: number | null
          tareas_inicial: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_management_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_management_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "daily_management_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_management_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_daily_sales: {
        Row: {
          company_id: string | null
          financing_code: string | null
          financing_name: string | null
          kind: Database["public"]["Enums"]["venta_kind"] | null
          licencias: number | null
          report_date: string | null
          ventas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sales_entries_financing_code_fkey"
            columns: ["financing_code"]
            isOneToOne: false
            referencedRelation: "financing_types"
            referencedColumns: ["code"]
          },
        ]
      }
      v_monthly_billing: {
        Row: {
          amount: number | null
          company_id: string | null
          financing_code: string | null
          period_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "billing_entries_financing_code_fkey"
            columns: ["financing_code"]
            isOneToOne: false
            referencedRelation: "financing_types"
            referencedColumns: ["code"]
          },
        ]
      }
      v_monthly_collection: {
        Row: {
          amount: number | null
          company_id: string | null
          method_code: string | null
          period_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "collection_entries_method_code_fkey"
            columns: ["method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
        ]
      }
      v_monthly_kpi: {
        Row: {
          agendas_dia: number | null
          atencion_agendas: number | null
          clientes_atendidos: number | null
          company_id: string | null
          dias_reportados: number | null
          llamada_agenda: number | null
          llamadas_contestadas: number | null
          llamadas_realizadas: number | null
          period_month: string | null
          ratio_contactabilidad: number | null
          ratio_conversion_agendas: number | null
          ratio_conversion_llamada: number | null
          ratio_venta_presencial: number | null
          responsable_nombre: string | null
          user_id: string | null
          ventas_efectivas: number | null
          ventas_exitosas: number | null
          volumen_venta_agendas: number | null
          volumen_venta_general: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_kpi_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "daily_kpi_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_monthly_sales: {
        Row: {
          company_id: string | null
          financing_code: string | null
          financing_name: string | null
          kind: Database["public"]["Enums"]["venta_kind"] | null
          licencias: number | null
          period_month: string | null
          ventas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sales_entries_financing_code_fkey"
            columns: ["financing_code"]
            isOneToOne: false
            referencedRelation: "financing_types"
            referencedColumns: ["code"]
          },
        ]
      }
      v_monthly_totals: {
        Row: {
          company_id: string | null
          company_name: string | null
          facturacion_mes: number | null
          licencias_mes: number | null
          period_month: string | null
          recaudo_mes: number | null
          renovaciones_mes: number | null
          ventas_mes: number | null
        }
        Relationships: []
      }
      v_objective_progress: {
        Row: {
          company_id: string | null
          cumplimiento: number | null
          metric_code: string | null
          metric_name: string | null
          period_month: string | null
          real_value: number | null
          target_value: number | null
          unit: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_totals"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "objectives_metric_code_fkey"
            columns: ["metric_code"]
            isOneToOne: false
            referencedRelation: "metrics"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "objectives_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_user_activity: {
        Row: {
          registros: number | null
          user_id: string | null
        }
        Insert: {
          registros?: never
          user_id?: string | null
        }
        Update: {
          registros?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_manage_company: { Args: { target_company: string }; Returns: boolean }
      company_data_counts: { Args: { target_company: string }; Returns: Json }
      company_role: {
        Args: { target_company: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_company_cascade: {
        Args: { confirm_name: string; target_company: string }
        Returns: Json
      }
      has_company_access: { Args: { target_company: string }; Returns: boolean }
      is_active_user: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      me: { Args: never; Returns: Json }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      my_status: {
        Args: never
        Returns: Database["public"]["Enums"]["user_status"]
      }
      restore_user: { Args: { target_user: string }; Returns: undefined }
      safe_ratio: {
        Args: { denominador: number; numerador: number }
        Returns: number
      }
      shares_company: { Args: { target_user: string }; Returns: boolean }
      soft_delete_user: { Args: { target_user: string }; Returns: undefined }
    }
    Enums: {
      company_status: "activa" | "archivada"
      jornada: "inicial" | "medio_dia" | "final"
      user_role: "super_admin" | "coordinador" | "asesor"
      user_status: "invitado" | "activo" | "inactivo" | "eliminado"
      venta_kind: "venta" | "renovacion"
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
      company_status: ["activa", "archivada"],
      jornada: ["inicial", "medio_dia", "final"],
      user_role: ["super_admin", "coordinador", "asesor"],
      user_status: ["invitado", "activo", "inactivo", "eliminado"],
      venta_kind: ["venta", "renovacion"],
    },
  },
} as const
