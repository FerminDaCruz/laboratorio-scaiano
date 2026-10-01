export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      doctores: {
        Row: {
          activo: boolean
          actualizado_en: string
          creado_en: string
          departamento: string | null
          domicilio: string | null
          fecha_alta: string
          ficha: number
          id: number
          localidad: string | null
          nombre: string
          notas: string | null
          obra_social_id: number | null
          piso: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          departamento?: string | null
          domicilio?: string | null
          fecha_alta?: string
          ficha: number
          id?: never
          localidad?: string | null
          nombre: string
          notas?: string | null
          obra_social_id?: number | null
          piso?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          departamento?: string | null
          domicilio?: string | null
          fecha_alta?: string
          ficha?: number
          id?: never
          localidad?: string | null
          nombre?: string
          notas?: string | null
          obra_social_id?: number | null
          piso?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctores_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      imputaciones: {
        Row: {
          creado_en: string
          id: number
          importe: number
          movimiento_debe_id: number
          movimiento_haber_id: number
        }
        Insert: {
          creado_en?: string
          id?: never
          importe: number
          movimiento_debe_id: number
          movimiento_haber_id: number
        }
        Update: {
          creado_en?: string
          id?: never
          importe?: number
          movimiento_debe_id?: number
          movimiento_haber_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "imputaciones_movimiento_debe_id_fkey"
            columns: ["movimiento_debe_id"]
            isOneToOne: false
            referencedRelation: "movimientos_cc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputaciones_movimiento_debe_id_fkey"
            columns: ["movimiento_debe_id"]
            isOneToOne: false
            referencedRelation: "v_creditos_disponibles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputaciones_movimiento_debe_id_fkey"
            columns: ["movimiento_debe_id"]
            isOneToOne: false
            referencedRelation: "v_deudas_pendientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputaciones_movimiento_haber_id_fkey"
            columns: ["movimiento_haber_id"]
            isOneToOne: false
            referencedRelation: "movimientos_cc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputaciones_movimiento_haber_id_fkey"
            columns: ["movimiento_haber_id"]
            isOneToOne: false
            referencedRelation: "v_creditos_disponibles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputaciones_movimiento_haber_id_fkey"
            columns: ["movimiento_haber_id"]
            isOneToOne: false
            referencedRelation: "v_deudas_pendientes"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_cc: {
        Row: {
          anula_movimiento_id: number | null
          creado_en: string
          creado_por: string | null
          doctor_id: number
          fecha: string
          id: number
          importe: number
          medio: string | null
          referencia: string | null
          remito_id: number | null
          tipo: string
        }
        Insert: {
          anula_movimiento_id?: number | null
          creado_en?: string
          creado_por?: string | null
          doctor_id: number
          fecha?: string
          id?: never
          importe: number
          medio?: string | null
          referencia?: string | null
          remito_id?: number | null
          tipo: string
        }
        Update: {
          anula_movimiento_id?: number | null
          creado_en?: string
          creado_por?: string | null
          doctor_id?: number
          fecha?: string
          id?: never
          importe?: number
          medio?: string | null
          referencia?: string | null
          remito_id?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_cc_anula_movimiento_id_fkey"
            columns: ["anula_movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos_cc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cc_anula_movimiento_id_fkey"
            columns: ["anula_movimiento_id"]
            isOneToOne: false
            referencedRelation: "v_creditos_disponibles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cc_anula_movimiento_id_fkey"
            columns: ["anula_movimiento_id"]
            isOneToOne: false
            referencedRelation: "v_deudas_pendientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cc_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cc_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cc_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_saldos_doctor"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "movimientos_cc_remito_id_fkey"
            columns: ["remito_id"]
            isOneToOne: false
            referencedRelation: "remitos"
            referencedColumns: ["id"]
          },
        ]
      }
      obras_sociales: {
        Row: {
          activa: boolean
          codigo: string
          creado_en: string
          id: number
          nombre: string
        }
        Insert: {
          activa?: boolean
          codigo: string
          creado_en?: string
          id?: never
          nombre: string
        }
        Update: {
          activa?: boolean
          codigo?: string
          creado_en?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      orden_items: {
        Row: {
          cantidad: number
          id: number
          orden_id: number
          piezas: string | null
          posicion: number
          precio_unitario: number
          subtotal: number | null
          trabajo_id: number
        }
        Insert: {
          cantidad?: number
          id?: never
          orden_id: number
          piezas?: string | null
          posicion?: number
          precio_unitario: number
          subtotal?: number | null
          trabajo_id: number
        }
        Update: {
          cantidad?: number
          id?: never
          orden_id?: number
          piezas?: string | null
          posicion?: number
          precio_unitario?: number
          subtotal?: number | null
          trabajo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "orden_items_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_items_trabajo_id_fkey"
            columns: ["trabajo_id"]
            isOneToOne: false
            referencedRelation: "trabajos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes: {
        Row: {
          actualizado_en: string
          color: string | null
          creado_en: string
          creado_por: string | null
          doctor_id: number
          edad: number | null
          entrega_at: string | null
          estado: string
          fecha: string
          id: number
          indicaciones: string | null
          numero: number
          obra_social_id: number | null
          paciente: string
          remito_id: number | null
          sexo: string | null
          total: number
        }
        Insert: {
          actualizado_en?: string
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          doctor_id: number
          edad?: number | null
          entrega_at?: string | null
          estado?: string
          fecha?: string
          id?: never
          indicaciones?: string | null
          numero: number
          obra_social_id?: number | null
          paciente: string
          remito_id?: number | null
          sexo?: string | null
          total?: number
        }
        Update: {
          actualizado_en?: string
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          doctor_id?: number
          edad?: number | null
          entrega_at?: string | null
          estado?: string
          fecha?: string
          id?: never
          indicaciones?: string | null
          numero?: number
          obra_social_id?: number | null
          paciente?: string
          remito_id?: number | null
          sexo?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_saldos_doctor"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "ordenes_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_remito_id_fkey"
            columns: ["remito_id"]
            isOneToOne: false
            referencedRelation: "remitos"
            referencedColumns: ["id"]
          },
        ]
      }
      periodo_saldos: {
        Row: {
          doctor_id: number
          facturado: number
          pagos: number
          periodo_id: number
          saldo_anterior: number
          saldo_final: number
        }
        Insert: {
          doctor_id: number
          facturado: number
          pagos: number
          periodo_id: number
          saldo_anterior: number
          saldo_final: number
        }
        Update: {
          doctor_id?: number
          facturado?: number
          pagos?: number
          periodo_id?: number
          saldo_anterior?: number
          saldo_final?: number
        }
        Relationships: [
          {
            foreignKeyName: "periodo_saldos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodo_saldos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_saldos_doctor"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "periodo_saldos_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos: {
        Row: {
          anio: number
          cerrado_en: string | null
          cerrado_por: string | null
          id: number
          mes: number
        }
        Insert: {
          anio: number
          cerrado_en?: string | null
          cerrado_por?: string | null
          id?: never
          mes: number
        }
        Update: {
          anio?: number
          cerrado_en?: string | null
          cerrado_por?: string | null
          id?: never
          mes?: number
        }
        Relationships: [
          {
            foreignKeyName: "periodos_cerrado_por_fkey"
            columns: ["cerrado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      precios_trabajo: {
        Row: {
          creado_en: string
          creado_por: string | null
          id: number
          precio: number
          trabajo_id: number
          vigente_desde: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: never
          precio: number
          trabajo_id: number
          vigente_desde: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: never
          precio?: number
          trabajo_id?: number
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "precios_trabajo_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precios_trabajo_trabajo_id_fkey"
            columns: ["trabajo_id"]
            isOneToOne: false
            referencedRelation: "trabajos"
            referencedColumns: ["id"]
          },
        ]
      }
      remito_lineas: {
        Row: {
          id: number
          importe: number
          orden_id: number
          remito_id: number
        }
        Insert: {
          id?: never
          importe: number
          orden_id: number
          remito_id: number
        }
        Update: {
          id?: never
          importe?: number
          orden_id?: number
          remito_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "remito_lineas_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remito_lineas_remito_id_fkey"
            columns: ["remito_id"]
            isOneToOne: false
            referencedRelation: "remitos"
            referencedColumns: ["id"]
          },
        ]
      }
      remitos: {
        Row: {
          anulado_en: string | null
          anulado_por: string | null
          creado_en: string
          creado_por: string | null
          doctor_id: number
          fecha: string
          id: number
          numero: number
          total: number
        }
        Insert: {
          anulado_en?: string | null
          anulado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          doctor_id: number
          fecha?: string
          id?: never
          numero: number
          total: number
        }
        Update: {
          anulado_en?: string | null
          anulado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          doctor_id?: number
          fecha?: string
          id?: never
          numero?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "remitos_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remitos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remitos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remitos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_saldos_doctor"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      trabajos: {
        Row: {
          activo: boolean
          codigo: string
          creado_en: string
          descripcion: string | null
          id: number
          titulo: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          creado_en?: string
          descripcion?: string | null
          id?: never
          titulo: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          creado_en?: string
          descripcion?: string | null
          id?: never
          titulo?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          activo: boolean
          creado_en: string
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          id: string
          nombre: string
          rol?: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_antiguedad_deuda: {
        Row: {
          dias_0_30: number | null
          dias_31_60: number | null
          dias_61_90: number | null
          dias_mas_90: number | null
          dias_mas_viejo: number | null
          doctor_id: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_cc_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cc_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_saldos_doctor"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      v_creditos_disponibles: {
        Row: {
          disponible: number | null
          doctor_id: number | null
          fecha: string | null
          id: number | null
          importe: number | null
          tipo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_cc_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cc_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_saldos_doctor"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      v_deudas_pendientes: {
        Row: {
          doctor_id: number | null
          fecha: string | null
          id: number | null
          importe: number | null
          pendiente: number | null
          remito_id: number | null
          tipo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_cc_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cc_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_saldos_doctor"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "movimientos_cc_remito_id_fkey"
            columns: ["remito_id"]
            isOneToOne: false
            referencedRelation: "remitos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_precios_vigentes: {
        Row: {
          precio: number | null
          trabajo_id: number | null
          vigente_desde: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precios_trabajo_trabajo_id_fkey"
            columns: ["trabajo_id"]
            isOneToOne: false
            referencedRelation: "trabajos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_saldos_doctor: {
        Row: {
          doctor_id: number | null
          saldo: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      anular_remito: {
        Args: { p_motivo?: string; p_remito_id: number }
        Returns: Json
      }
      cerrar_periodo: { Args: { p_anio: number; p_mes: number }; Returns: Json }
      crear_orden: {
        Args: {
          p_color?: string
          p_doctor_id: number
          p_edad?: number
          p_entrega_at?: string
          p_fecha?: string
          p_indicaciones?: string
          p_items: Json
          p_obra_social_id?: number
          p_paciente: string
          p_sexo?: string
        }
        Returns: Json
      }
      emitir_remito: {
        Args: { p_doctor_id: number; p_fecha?: string; p_orden_ids: number[] }
        Returns: Json
      }
      es_admin: { Args: never; Returns: boolean }
      es_staff: { Args: never; Returns: boolean }
      imputar_credito_a_deuda: {
        Args: { p_deuda_id: number; p_doctor_id: number }
        Returns: number
      }
      registrar_pago: {
        Args: {
          p_deuda_ids?: number[]
          p_doctor_id: number
          p_fecha?: string
          p_importe: number
          p_medio?: string
          p_referencia?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

