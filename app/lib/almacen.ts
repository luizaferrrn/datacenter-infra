// Contratos de persistencia. Los endpoints solo conocen estas interfaces:
import type { BorradorDatos, DatosFormulario } from "./formulario";
import { leerConfig } from "./config";
import { crearAlmacenesSimulados } from "./almacen-simulado";
import { AlmacenRedisBorradores } from "./almacen-redis";
import { AlmacenPostgresEnvios } from "./almacen-postgres";

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
  const config = leerConfig();
  const simulados = crearAlmacenesSimulados(TTL_BORRADOR_SEGUNDOS);

  // Seleccionamos Redis si el modo no es simulado, de lo contrario usamos memoria
  const borradores = config.redis.modo !== "simulado" 
    ? new AlmacenRedisBorradores() 
    : simulados.borradores;

  // Seleccionamos PostgreSQL si el modo es "real", de lo contrario usamos memoria
  const envios = config.postgres.modo === "real" 
    ? new AlmacenPostgresEnvios() 
    : simulados.envios;

  return { borradores, envios };
}