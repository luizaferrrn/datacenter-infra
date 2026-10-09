import { NextResponse } from "next/server";
import { ErrorConfiguracion } from "./config";
import { DependenciaNoDisponible } from "./errores";
import { log } from "./log";

type Campos = Record<string, string | number | boolean | undefined>;

/** Respuesta JSON sin caché (todas las respuestas de la API lo son). */
export function responder(cuerpo: unknown, status: number) {
  return NextResponse.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Traduce un fallo interno a la respuesta HTTP adecuada. El detalle va al log; el cliente nunca recibe
 * nombres de servicios internos, mensajes de error ni datos del formulario.
 *  - DependenciaNoDisponible -> 503 servicio_no_disponible (+ Retry-After): reintentar es seguro.
 *  - ErrorConfiguracion      -> 500 configuracion_invalida
 *  - cualquier otro          -> 500 error_interno
 */
export function responderFallo(error: unknown, evento: string, campos: Campos = {}) {
  if (error instanceof DependenciaNoDisponible) {
    log("error", evento, {
      ...campos,
      dependencia: error.dependencia,
      causa: error.cause instanceof Error ? error.cause.message : undefined,
    });
    return NextResponse.json(
      { error: "servicio_no_disponible" },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }
  if (error instanceof ErrorConfiguracion) {
    log("error", evento, { ...campos, motivo: error.message });
    return responder({ error: "configuracion_invalida" }, 500);
  }
  log("error", evento, { ...campos, motivo: error instanceof Error ? error.message : "desconocido" });
  return responder({ error: "error_interno" }, 500);
}