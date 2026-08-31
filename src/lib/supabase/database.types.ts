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
      ad_categories: {
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
      appointments: {
        Row: {
          branch_id: string
          celular: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          nombre: string | null
          observacion: string | null
          responsable_nombre: string | null
          resultado: string | null
          scheduled_at: string
          scheduled_time: string | null
          source: string
          source_file: string | null
          source_row: number | null
          staff_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          celular?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string | null
          observacion?: string | null
          responsable_nombre?: string | null
          resultado?: string | null
          scheduled_at: string
          scheduled_time?: string | null
          source?: string
          source_file?: string | null
          source_row?: number | null
          staff_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          celular?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string | null
          observacion?: string | null
          responsable_nombre?: string | null
          resultado?: string | null
          scheduled_at?: string
          scheduled_time?: string | null
          source?: string
          source_file?: string | null
          source_row?: number | null
          staff_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
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
      cash_concepts: {
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
      cash_movements: {
        Row: {
          amount: number
          branch_id: string
          company_id: string
          concept_code: string | null
          created_at: string
          created_by: string | null
          factura: string | null
          id: string
          identificacion: string | null
          kind: string
          method_code: string | null
          nombre: string | null
          observacion: string | null
          period_month: string
          report_date: string
          responsable_nombre: string | null
          source: string
          source_file: string | null
          source_row: number | null
          staff_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          company_id: string
          concept_code?: string | null
          created_at?: string
          created_by?: string | null
          factura?: string | null
          id?: string
          identificacion?: string | null
          kind: string
          method_code?: string | null
          nombre?: string | null
          observacion?: string | null
          period_month: string
          report_date: string
          responsable_nombre?: string | null
          source?: string
          source_file?: string | null
          source_row?: number | null
          staff_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          company_id?: string
          concept_code?: string | null
          created_at?: string
          created_by?: string | null
          factura?: string | null
          id?: string
          identificacion?: string | null
          kind?: string
          method_code?: string | null
          nombre?: string | null
          observacion?: string | null
          period_month?: string
          report_date?: string
          responsable_nombre?: string | null
          source?: string
          source_file?: string | null
          source_row?: number | null
          staff_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_concept_code_fkey"
            columns: ["concept_code"]
            isOneToOne: false
            referencedRelation: "cash_concepts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cash_movements_method_code_fkey"
            columns: ["method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cash_movements_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      channels: {
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
      companies: {
        Row: {
          accent_color: string
          archived_at: string | null
          city: string | null
          created_at: string
          created_by: string | null
          crm_label: string | null
          department: string | null
          hora_entrada: string
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
          hora_entrada?: string
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
          hora_entrada?: string
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
            foreignKeyName: "company_payment_methods_method_code_fkey"
            columns: ["method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
        ]
      }
      company_staff: {
        Row: {
          branch_id: string | null
          company_id: string
          staff_id: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          staff_id: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_staff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
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
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
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
      daily_activity: {
        Row: {
          agenda_cancela: number
          agenda_confirmada: number
          agenda_no_contesta: number
          agenda_posible: number
          agenda_reprograma: number
          atencion_agenda: number
          atencion_asociado: number
          atencion_certificados: number
          atencion_declinado: number
          atencion_enrolamiento: number
          atencion_renovacion: number
          atencion_seguimiento: number
          atencion_venta: number
          branch_id: string
          caducadas_final: number
          caducadas_inicial: number
          caducadas_medio: number
          chats_final: number
          chats_inicial: number
          chats_medio: number
          company_id: string
          created_at: string
          created_by: string | null
          hora_llegada: string | null
          hora_salida: string | null
          id: string
          llamada_agenda: number
          llamada_contestada: number
          llamada_efectiva: number
          llamada_no_contestada: number
          llamada_no_interesado: number
          llamada_postventa: number
          llamada_seguimiento: number
          notas: string | null
          period_month: string
          report_date: string
          responsable_nombre: string
          source: string
          source_file: string | null
          source_row: number | null
          staff_id: string
          tareas_final: number
          tareas_inicial: number
          tareas_medio: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agenda_cancela?: number
          agenda_confirmada?: number
          agenda_no_contesta?: number
          agenda_posible?: number
          agenda_reprograma?: number
          atencion_agenda?: number
          atencion_asociado?: number
          atencion_certificados?: number
          atencion_declinado?: number
          atencion_enrolamiento?: number
          atencion_renovacion?: number
          atencion_seguimiento?: number
          atencion_venta?: number
          branch_id: string
          caducadas_final?: number
          caducadas_inicial?: number
          caducadas_medio?: number
          chats_final?: number
          chats_inicial?: number
          chats_medio?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          hora_llegada?: string | null
          hora_salida?: string | null
          id?: string
          llamada_agenda?: number
          llamada_contestada?: number
          llamada_efectiva?: number
          llamada_no_contestada?: number
          llamada_no_interesado?: number
          llamada_postventa?: number
          llamada_seguimiento?: number
          notas?: string | null
          period_month: string
          report_date: string
          responsable_nombre: string
          source?: string
          source_file?: string | null
          source_row?: number | null
          staff_id: string
          tareas_final?: number
          tareas_inicial?: number
          tareas_medio?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agenda_cancela?: number
          agenda_confirmada?: number
          agenda_no_contesta?: number
          agenda_posible?: number
          agenda_reprograma?: number
          atencion_agenda?: number
          atencion_asociado?: number
          atencion_certificados?: number
          atencion_declinado?: number
          atencion_enrolamiento?: number
          atencion_renovacion?: number
          atencion_seguimiento?: number
          atencion_venta?: number
          branch_id?: string
          caducadas_final?: number
          caducadas_inicial?: number
          caducadas_medio?: number
          chats_final?: number
          chats_inicial?: number
          chats_medio?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          hora_llegada?: string | null
          hora_salida?: string | null
          id?: string
          llamada_agenda?: number
          llamada_contestada?: number
          llamada_efectiva?: number
          llamada_no_contestada?: number
          llamada_no_interesado?: number
          llamada_postventa?: number
          llamada_seguimiento?: number
          notas?: string | null
          period_month?: string
          report_date?: string
          responsable_nombre?: string
          source?: string
          source_file?: string | null
          source_row?: number | null
          staff_id?: string
          tareas_final?: number
          tareas_inicial?: number
          tareas_medio?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_activity_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_updated_by_fkey"
            columns: ["updated_by"]
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
      id_types: {
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
      medical_centers: {
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
      payments: {
        Row: {
          amount: number
          branch_id: string
          company_id: string
          contrato: string | null
          created_at: string
          created_by: string | null
          date_estimated: boolean
          id: string
          licencia_id: string | null
          licencia_nombre: string | null
          method_code: string | null
          observacion: string | null
          pagare: string | null
          period_month: string
          recibo: string | null
          ref_credito: string | null
          report_date: string
          sale_id: string | null
          source: string
          source_file: string | null
          source_row: number | null
          titular_id: string | null
          titular_nombre: string | null
          updated_at: string
          updated_by: string | null
          voucher: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          company_id: string
          contrato?: string | null
          created_at?: string
          created_by?: string | null
          date_estimated?: boolean
          id?: string
          licencia_id?: string | null
          licencia_nombre?: string | null
          method_code?: string | null
          observacion?: string | null
          pagare?: string | null
          period_month: string
          recibo?: string | null
          ref_credito?: string | null
          report_date: string
          sale_id?: string | null
          source?: string
          source_file?: string | null
          source_row?: number | null
          titular_id?: string | null
          titular_nombre?: string | null
          updated_at?: string
          updated_by?: string | null
          voucher?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          company_id?: string
          contrato?: string | null
          created_at?: string
          created_by?: string | null
          date_estimated?: boolean
          id?: string
          licencia_id?: string | null
          licencia_nombre?: string | null
          method_code?: string | null
          observacion?: string | null
          pagare?: string | null
          period_month?: string
          recibo?: string | null
          ref_credito?: string | null
          report_date?: string
          sale_id?: string | null
          source?: string
          source_file?: string | null
          source_row?: number | null
          titular_id?: string | null
          titular_nombre?: string | null
          updated_at?: string
          updated_by?: string | null
          voucher?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payments_method_code_fkey"
            columns: ["method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      products: {
        Row: {
          code: string
          is_renovacion: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          is_renovacion?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_renovacion?: boolean
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
      sale_states: {
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
      sale_types: {
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
      sales: {
        Row: {
          ad_category_code: string | null
          adicion: number
          branch_id: string
          cantidad_comision: number
          cantidad_final: number
          channel_code: string | null
          ciudad: string | null
          company_id: string
          consecutivo_examen: string | null
          contrato: string | null
          costo_carta: number
          costo_examen: number
          created_at: string
          created_by: string | null
          credito_celular: string | null
          credito_id: string | null
          credito_nombre: string | null
          credito_tipo_id: string | null
          cuenta_devolucion: string | null
          departamento: string | null
          descuento: number
          devolucion_lamina: string | null
          documentos: string | null
          evento: string | null
          fecha_certificado: string | null
          fecha_devolucion: string | null
          fecha_legalizacion: string | null
          financing_code: string | null
          id: string
          id_asociado: string | null
          id_referido: string | null
          ingreso_neto: number
          licencia_celular: string | null
          licencia_id: string | null
          licencia_nombre: string | null
          licencia_tipo_id: string | null
          medical_center_code: string | null
          observacion: string | null
          pagare: string | null
          pago_evento: string | null
          period_month: string
          product_code: string | null
          recaudo: number
          ref_credito: string | null
          report_date: string
          responsable_nombre: string | null
          saldo: number
          sale_type_code: string | null
          school_code: string | null
          source: string
          source_file: string | null
          source_row: number | null
          staff_id: string | null
          state_code: string | null
          total_comision: number
          total_costo: number
          updated_at: string
          updated_by: string | null
          valor_comision: number
          valor_final: number
          valor_inicial: number
          valor_lamina: number
          voucher: string | null
        }
        Insert: {
          ad_category_code?: string | null
          adicion?: number
          branch_id: string
          cantidad_comision?: number
          cantidad_final?: number
          channel_code?: string | null
          ciudad?: string | null
          company_id: string
          consecutivo_examen?: string | null
          contrato?: string | null
          costo_carta?: number
          costo_examen?: number
          created_at?: string
          created_by?: string | null
          credito_celular?: string | null
          credito_id?: string | null
          credito_nombre?: string | null
          credito_tipo_id?: string | null
          cuenta_devolucion?: string | null
          departamento?: string | null
          descuento?: number
          devolucion_lamina?: string | null
          documentos?: string | null
          evento?: string | null
          fecha_certificado?: string | null
          fecha_devolucion?: string | null
          fecha_legalizacion?: string | null
          financing_code?: string | null
          id?: string
          id_asociado?: string | null
          id_referido?: string | null
          ingreso_neto?: number
          licencia_celular?: string | null
          licencia_id?: string | null
          licencia_nombre?: string | null
          licencia_tipo_id?: string | null
          medical_center_code?: string | null
          observacion?: string | null
          pagare?: string | null
          pago_evento?: string | null
          period_month: string
          product_code?: string | null
          recaudo?: number
          ref_credito?: string | null
          report_date: string
          responsable_nombre?: string | null
          saldo?: number
          sale_type_code?: string | null
          school_code?: string | null
          source?: string
          source_file?: string | null
          source_row?: number | null
          staff_id?: string | null
          state_code?: string | null
          total_comision?: number
          total_costo?: number
          updated_at?: string
          updated_by?: string | null
          valor_comision?: number
          valor_final?: number
          valor_inicial?: number
          valor_lamina?: number
          voucher?: string | null
        }
        Update: {
          ad_category_code?: string | null
          adicion?: number
          branch_id?: string
          cantidad_comision?: number
          cantidad_final?: number
          channel_code?: string | null
          ciudad?: string | null
          company_id?: string
          consecutivo_examen?: string | null
          contrato?: string | null
          costo_carta?: number
          costo_examen?: number
          created_at?: string
          created_by?: string | null
          credito_celular?: string | null
          credito_id?: string | null
          credito_nombre?: string | null
          credito_tipo_id?: string | null
          cuenta_devolucion?: string | null
          departamento?: string | null
          descuento?: number
          devolucion_lamina?: string | null
          documentos?: string | null
          evento?: string | null
          fecha_certificado?: string | null
          fecha_devolucion?: string | null
          fecha_legalizacion?: string | null
          financing_code?: string | null
          id?: string
          id_asociado?: string | null
          id_referido?: string | null
          ingreso_neto?: number
          licencia_celular?: string | null
          licencia_id?: string | null
          licencia_nombre?: string | null
          licencia_tipo_id?: string | null
          medical_center_code?: string | null
          observacion?: string | null
          pagare?: string | null
          pago_evento?: string | null
          period_month?: string
          product_code?: string | null
          recaudo?: number
          ref_credito?: string | null
          report_date?: string
          responsable_nombre?: string | null
          saldo?: number
          sale_type_code?: string | null
          school_code?: string | null
          source?: string
          source_file?: string | null
          source_row?: number | null
          staff_id?: string | null
          state_code?: string | null
          total_comision?: number
          total_costo?: number
          updated_at?: string
          updated_by?: string | null
          valor_comision?: number
          valor_final?: number
          valor_inicial?: number
          valor_lamina?: number
          voucher?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_ad_category_code_fkey"
            columns: ["ad_category_code"]
            isOneToOne: false
            referencedRelation: "ad_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_channel_code_fkey"
            columns: ["channel_code"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sales_credito_tipo_id_fkey"
            columns: ["credito_tipo_id"]
            isOneToOne: false
            referencedRelation: "id_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_financing_code_fkey"
            columns: ["financing_code"]
            isOneToOne: false
            referencedRelation: "financing_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_licencia_tipo_id_fkey"
            columns: ["licencia_tipo_id"]
            isOneToOne: false
            referencedRelation: "id_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_medical_center_code_fkey"
            columns: ["medical_center_code"]
            isOneToOne: false
            referencedRelation: "medical_centers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_sale_type_code_fkey"
            columns: ["sale_type_code"]
            isOneToOne: false
            referencedRelation: "sale_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_school_code_fkey"
            columns: ["school_code"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "sale_states"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      schools: {
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
      staff: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          profile_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id?: string
          profile_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          profile_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
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
          llamada_efectiva: number | null
          llamadas_contestadas: number | null
          period_month: string | null
          ratio_contactabilidad: number | null
          recaudo_mes: number | null
          status: Database["public"]["Enums"]["company_status"] | null
          total_llamadas: number | null
          ventas_mes: number | null
        }
        Relationships: []
      }
      v_capture_status: {
        Row: {
          branch_id: string | null
          company_id: string | null
          registrado: boolean | null
          report_date: string | null
          responsable_nombre: string | null
          staff_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_staff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      v_daily_activity: {
        Row: {
          agenda_cancela: number | null
          agenda_confirmada: number | null
          agenda_no_contesta: number | null
          agenda_posible: number | null
          agenda_reprograma: number | null
          atencion_agenda: number | null
          atencion_asociado: number | null
          atencion_certificados: number | null
          atencion_declinado: number | null
          atencion_enrolamiento: number | null
          atencion_renovacion: number | null
          atencion_seguimiento: number | null
          atencion_venta: number | null
          branch_id: string | null
          caducadas_depuradas: number | null
          caducadas_final: number | null
          caducadas_inicial: number | null
          caducadas_medio: number | null
          chats_depurados: number | null
          chats_final: number | null
          chats_inicial: number | null
          chats_medio: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          hora_entrada: string | null
          hora_llegada: string | null
          hora_salida: string | null
          id: string | null
          llamada_agenda: number | null
          llamada_contestada: number | null
          llamada_efectiva: number | null
          llamada_no_contestada: number | null
          llamada_no_interesado: number | null
          llamada_postventa: number | null
          llamada_seguimiento: number | null
          llamadas_contestadas: number | null
          llego_tarde: boolean | null
          notas: string | null
          period_month: string | null
          ratio_contactabilidad: number | null
          ratio_conversion_agendas: number | null
          ratio_conversion_llamada: number | null
          ratio_venta_presencial: number | null
          report_date: string | null
          responsable_nombre: string | null
          source: string | null
          source_file: string | null
          source_row: number | null
          staff_id: string | null
          tareas_depuradas: number | null
          tareas_final: number | null
          tareas_inicial: number | null
          tareas_medio: number | null
          total_agendas: number | null
          total_atencion: number | null
          total_llamadas: number | null
          updated_at: string | null
          updated_by: string | null
          volumen_venta_general: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_activity_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_activity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_daily_sales: {
        Row: {
          branch_id: string | null
          comision: number | null
          company_id: string | null
          facturacion: number | null
          licencias: number | null
          recaudo_venta: number | null
          renovaciones: number | null
          report_date: string | null
          saldo: number | null
          ventas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_monthly_activity: {
        Row: {
          atencion_agenda: number | null
          atencion_certificados: number | null
          atencion_renovacion: number | null
          atencion_venta: number | null
          branch_id: string | null
          chats_depurados: number | null
          company_id: string | null
          dias_reportados: number | null
          dias_tarde: number | null
          llamada_agenda: number | null
          llamada_efectiva: number | null
          llamadas_contestadas: number | null
          period_month: string | null
          ratio_contactabilidad: number | null
          ratio_conversion_agendas: number | null
          ratio_conversion_llamada: number | null
          ratio_llegadas_tarde: number | null
          ratio_venta_presencial: number | null
          responsable_nombre: string | null
          staff_id: string | null
          tareas_depuradas: number | null
          total_agendas: number | null
          total_atencion: number | null
          total_llamadas: number | null
          volumen_venta_general: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      v_monthly_collection: {
        Row: {
          amount: number | null
          branch_id: string | null
          company_id: string | null
          method_code: string | null
          pagos: number | null
          period_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_method_code_fkey"
            columns: ["method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
        ]
      }
      v_monthly_sales_by_financing: {
        Row: {
          branch_id: string | null
          company_id: string | null
          facturacion: number | null
          financing_code: string | null
          financing_name: string | null
          licencias: number | null
          period_month: string | null
          renovaciones: number | null
          ventas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_financing_code_fkey"
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
          entradas_mes: number | null
          facturacion_mes: number | null
          licencias_mes: number | null
          period_month: string | null
          recaudo_mes: number | null
          renovaciones_mes: number | null
          salidas_mes: number | null
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
      admin_ban_user: {
        Args: { bloquear: boolean; target_user: string }
        Returns: undefined
      }
      admin_change_email: {
        Args: { p_email: string; target_user: string }
        Returns: undefined
      }
      admin_create_user: {
        Args: {
          p_confirmado?: boolean
          p_email: string
          p_full_name: string
          p_password?: string
          p_phone?: string
          p_role?: Database["public"]["Enums"]["user_role"]
        }
        Returns: string
      }
      admin_set_password: {
        Args: { p_password: string; target_user: string }
        Returns: undefined
      }
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
      es_mi_registro: { Args: { target_staff: string }; Returns: boolean }
      has_company_access: { Args: { target_company: string }; Returns: boolean }
      is_active_user: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      link_payments_to_sales: { Args: never; Returns: number }
      log_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_company_id?: string
          p_entity: string
          p_entity_id?: string
        }
        Returns: undefined
      }
      me: { Args: never; Returns: Json }
      my_company_ids: { Args: never; Returns: string[] }
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
