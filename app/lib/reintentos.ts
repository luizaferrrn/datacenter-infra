import { DependenciaNoDisponible } from "./errores";
import { log } from "./log";

const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

type Opciones = {
  /** Intentos totales (el primero incluido). Por defecto 3. */
  intentos?: number;
  /** Espera antes del 2.º intento; se duplica en cada reintento (100 ms, 200 ms...). Por defecto 100. */
  esperaBaseMs?: number;
};

/**
 * Ejecuta `fn` con un número ACOTADO de intentos y espera creciente.
 * - Solo reintenta los errores que `esTransitorio` reconoce; cualquier otro se propaga tal cual (al primer fallo).
 * - Si se agotan los intentos, lanza DependenciaNoDisponible con la causa original: el fallo no se oculta.
 * Reintentar solo es seguro si `fn` es idempotente (los accesos de la Fase 3 lo son).
 */
export async function conDependencia<T>(
  dependencia: "redis" | "postgres",
  fn: () => Promise<T>,
  esTransitorio: (error: unknown) => boolean,
  { intentos = 3, esperaBaseMs = 100 }: Opciones = {},
): Promise<T> {
  const maximo = Math.max(1, Math.floor(intentos));
  let ultimo: unknown;

  for (let intento = 1; intento <= maximo; intento++) {
    try {
      return await fn();
    } catch (error) {
      if (!esTransitorio(error)) throw error;
      ultimo = error;
      if (intento < maximo) {
        log("warn", `${dependencia}_reintento`, {
          intento,
          motivo: error instanceof Error ? error.message : "desconocido",
        });
        await dormir(esperaBaseMs * 2 ** (intento - 1));
      }
    }
  }
  throw new DependenciaNoDisponible(dependencia, ultimo);
}