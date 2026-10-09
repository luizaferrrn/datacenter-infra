// SOLO PARA DESARROLLO LOCAL. Vive en la memoria de UN proceso:
// no se comparte entre las 3 instancias y se pierde al reiniciar. No es HA ni persistencia real.
import type { Almacenes, Borrador, Envio } from "./almacen";

type Estado = {
  borradores: Map<string, { borrador: Borrador; expira: number }>;
  envios: Map<string, Envio>;
  siguienteId: number;
};

// globalThis para sobrevivir al recargado en caliente de `next dev`.
const g = globalThis as unknown as { __almacenSimulado?: Estado };

function estado(): Estado {
  g.__almacenSimulado ??= { borradores: new Map(), envios: new Map(), siguienteId: 1 };
  return g.__almacenSimulado;
}

export function crearAlmacenesSimulados(ttlSegundos: number): Almacenes {
  return {
    borradores: {
      async guardar(borrador) {
        estado().borradores.set(borrador.draft_id, {
          borrador,
          expira: Date.now() + ttlSegundos * 1000,
        });
      },
      async obtener(draftId) {
        const e = estado().borradores.get(draftId);
        if (!e) return null;
        if (e.expira <= Date.now()) {
          estado().borradores.delete(draftId);
          return null;
        }
        return e.borrador;
      },
      async eliminar(draftId) {
        estado().borradores.delete(draftId);
      },
    },
    envios: {
      async crear(draftId, data) {
        const s = estado();
        const existente = s.envios.get(draftId);
        if (existente) return { envio: existente, creado: false };
        const envio: Envio = {
          id: s.siguienteId++,
          draft_id: draftId,
          data,
          submitted_at: new Date().toISOString(),
        };
        s.envios.set(draftId, envio);
        return { envio, creado: true };
      },
    },
  };
}
