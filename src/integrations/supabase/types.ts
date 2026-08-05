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
      configuracao_documentos: {
        Row: {
          cabecalho_texto: string | null
          criado_em: string
          id: string
          logo_url: string | null
          mostrar_timbre: boolean
          rodape_texto: string | null
          usar_papel_timbrado: boolean
        }
        Insert: {
          cabecalho_texto?: string | null
          criado_em?: string
          id?: string
          logo_url?: string | null
          mostrar_timbre?: boolean
          rodape_texto?: string | null
          usar_papel_timbrado?: boolean
        }
        Update: {
          cabecalho_texto?: string | null
          criado_em?: string
          id?: string
          logo_url?: string | null
          mostrar_timbre?: boolean
          rodape_texto?: string | null
          usar_papel_timbrado?: boolean
        }
        Relationships: []
      }
      documento_modelos: {
        Row: {
          ativo: boolean
          conteudo: string
          criado_em: string
          id: string
          nome: string
          ordem: number
          tipo: string
        }
        Insert: {
          ativo?: boolean
          conteudo?: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
          tipo: string
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          aguardando_feedback: boolean
          area: Database["public"]["Enums"]["inbox_area"]
          concluido: boolean
          concluido_em: string | null
          criado_em: string
          dia_semana: string | null
          id: string
          lembrete_data_hora: string | null
          lembrete_enviado: boolean
          prioridades: string[]
          texto: string
          tipo: Database["public"]["Enums"]["inbox_tipo"]
        }
        Insert: {
          aguardando_feedback?: boolean
          area: Database["public"]["Enums"]["inbox_area"]
          concluido?: boolean
          concluido_em?: string | null
          criado_em?: string
          dia_semana?: string | null
          id?: string
          lembrete_data_hora?: string | null
          lembrete_enviado?: boolean
          prioridades?: string[]
          texto: string
          tipo: Database["public"]["Enums"]["inbox_tipo"]
        }
        Update: {
          aguardando_feedback?: boolean
          area?: Database["public"]["Enums"]["inbox_area"]
          concluido?: boolean
          concluido_em?: string | null
          criado_em?: string
          dia_semana?: string | null
          id?: string
          lembrete_data_hora?: string | null
          lembrete_enviado?: boolean
          prioridades?: string[]
          texto?: string
          tipo?: Database["public"]["Enums"]["inbox_tipo"]
        }
        Relationships: []
      }
      links_rapidos: {
        Row: {
          area: string
          criado_em: string | null
          id: string
          titulo: string
          url: string
        }
        Insert: {
          area: string
          criado_em?: string | null
          id?: string
          titulo: string
          url: string
        }
        Update: {
          area?: string
          criado_em?: string | null
          id?: string
          titulo?: string
          url?: string
        }
        Relationships: []
      }
      pagamentos_recorrentes: {
        Row: {
          criado_em: string
          descricao: string
          dia_mes: number
          id: string
        }
        Insert: {
          criado_em?: string
          descricao: string
          dia_mes: number
          id?: string
        }
        Update: {
          criado_em?: string
          descricao?: string
          dia_mes?: number
          id?: string
        }
        Relationships: []
      }
      pagamentos_recorrentes_registro: {
        Row: {
          ano: number
          atualizado_em: string
          id: string
          impresso: boolean
          mes: number
          pagamento_id: string
          pago: boolean
        }
        Insert: {
          ano: number
          atualizado_em?: string
          id?: string
          impresso?: boolean
          mes: number
          pagamento_id: string
          pago?: boolean
        }
        Update: {
          ano?: number
          atualizado_em?: string
          id?: string
          impresso?: boolean
          mes?: number
          pagamento_id?: string
          pago?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_recorrentes_registro_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos_recorrentes"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_usuario: {
        Row: {
          area: string
          criado_em: string | null
          id: string
          item_menu: string
          usuario_id: string
        }
        Insert: {
          area: string
          criado_em?: string | null
          id?: string
          item_menu: string
          usuario_id: string
        }
        Update: {
          area?: string
          criado_em?: string | null
          id?: string
          item_menu?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_usuario_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          convite_token: string | null
          criado_em: string | null
          email: string
          id: string
          nome: string
          role: string
          status: string
        }
        Insert: {
          convite_token?: string | null
          criado_em?: string | null
          email: string
          id: string
          nome: string
          role: string
          status: string
        }
        Update: {
          convite_token?: string | null
          criado_em?: string | null
          email?: string
          id?: string
          nome?: string
          role?: string
          status?: string
        }
        Relationships: []
      }
      prompts: {
        Row: {
          criado_em: string
          descricao: string | null
          id: string
          texto: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          id?: string
          texto: string
          titulo: string
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          id?: string
          texto?: string
          titulo?: string
        }
        Relationships: []
      }
      rotina_cards: {
        Row: {
          area: Database["public"]["Enums"]["inbox_area"] | null
          coluna: string
          concluido: boolean | null
          criado_em: string | null
          id: string
          ordem: number
          tab: string
          texto: string
          tipo_linha: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["inbox_area"] | null
          coluna: string
          concluido?: boolean | null
          criado_em?: string | null
          id?: string
          ordem: number
          tab: string
          texto: string
          tipo_linha: string
        }
        Update: {
          area?: Database["public"]["Enums"]["inbox_area"] | null
          coluna?: string
          concluido?: boolean | null
          criado_em?: string | null
          id?: string
          ordem?: number
          tab?: string
          texto?: string
          tipo_linha?: string
        }
        Relationships: []
      }
      tarefas_recorrentes: {
        Row: {
          area: Database["public"]["Enums"]["inbox_area"]
          criado_em: string
          data_inicio: string | null
          dia_mes: number | null
          dia_semana: string | null
          id: string
          intervalo_meses: number | null
          tipo_recorrencia: string
          titulo: string
          ultima_conclusao: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["inbox_area"]
          criado_em?: string
          data_inicio?: string | null
          dia_mes?: number | null
          dia_semana?: string | null
          id?: string
          intervalo_meses?: number | null
          tipo_recorrencia: string
          titulo: string
          ultima_conclusao?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["inbox_area"]
          criado_em?: string
          data_inicio?: string | null
          dia_mes?: number | null
          dia_semana?: string | null
          id?: string
          intervalo_meses?: number | null
          tipo_recorrencia?: string
          titulo?: string
          ultima_conclusao?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      inbox_area:
        | "geral"
        | "diretoria"
        | "financeiro"
        | "consultorio"
        | "versa3d"
        | "especializacao"
        | "graduacao"
        | "doutorado"
        | "dentistas-petropolis"
        | "connect-lab"
        | "gestao"
      inbox_tipo: "mensagem" | "ideia" | "tarefa"
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
      inbox_area: [
        "geral",
        "diretoria",
        "financeiro",
        "consultorio",
        "versa3d",
        "especializacao",
        "graduacao",
        "doutorado",
        "dentistas-petropolis",
        "connect-lab",
        "gestao",
      ],
      inbox_tipo: ["mensagem", "ideia", "tarefa"],
    },
  },
} as const
