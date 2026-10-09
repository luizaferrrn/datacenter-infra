// Contratos de persistencia. Los endpoints solo conocen estas interfaces:
// hoy las implementa el almacén simulado; después Redis (borradores) y PostgreSQL (envíos).
import type { BorradorDatos, DatosFormulario } from "./formulario";
import { crearAlmacenesSimulados } from "./almacen-simulado";

export const TTL_BORRADOR_SEGUNDOS = 7 * 24 * 60 * 60; // 604800, docs/schema-data.md

export type Borrador = {
  draft_id: string;
  data: BorradorDatos;
  updated_at: string; // ISO 8601
};

export type Envio = {
  id: number;
  draft_id: string;
  data: DatosFormulario;
  submitted_at: string; // ISO 8601
};

export interface AlmacenBorradores {
  guardar(borrador: Borrador): Promise<void>;
  obtener(draftId: string): Promise<Borrador | null>;
  eliminar(draftId: string): Promise<void>;
}

export interface AlmacenEnvios {
  /** Idempotente por draft_id: si ya existe devuelve el original con creado=false. */
  crear(draftId: string, data: DatosFormulario): Promise<{ envio: Envio; creado: boolean }>;
}

export type Almacenes = { borradores: AlmacenBorradores; envios: AlmacenEnvios };

export function obtenerAlmacenes(): Almacenes {
  // Siguiente etapa: si hay REDIS_SENTINELS / DATABASE_URL, devolver las implementaciones reales.
  return crearAlmacenesSimulados(TTL_BORRADOR_SEGUNDOS);
}
