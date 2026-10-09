import { NextResponse } from "next/server";
import { esUuid, validarEnvio } from "../../../lib/formulario";
import { obtenerAlmacenes } from "../../../lib/almacen";
import { log } from "../../../lib/log";

const SIN_CACHE = { "Cache-Control": "no-store" };
const MAX_BYTES = 16 * 1024;

function responder(cuerpo: unknown, status: number) {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE });
}

// POST /api/submissions  cuerpo: { "draft_id": "<uuid>", "data": { ...5 campos } }
//   201 { id, draft_id, submitted_at, ya_enviado:false }  primer envío
//   200 { id, draft_id, submitted_at, ya_enviado:true }   reintento del mismo draft_id (no duplica)
//   400 json_invalido | draft_id_invalido | 413 | 422 { error:"validacion", campos } | 500 error_interno
// PROPUESTA de contrato (201 vs 200): confirmar con el equipo antes de fijarlo.
export async function POST(req: Request) {
  const texto = await req.text();
  if (texto.length > MAX_BYTES) return responder({ error: "cuerpo_demasiado_grande" }, 413);

  let cuerpo: { draft_id?: unknown; data?: unknown } | null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return responder({ error: "json_invalido" }, 400);
  }
  const draftId = cuerpo?.draft_id;
  if (!esUuid(draftId)) return responder({ error: "draft_id_invalido" }, 400);

  const validado = validarEnvio(cuerpo?.data);
  if (!validado.ok) return responder({ error: "validacion", campos: validado.errores }, 422);

  const { borradores, envios } = obtenerAlmacenes();
  let resultado;
  try {
    resultado = await envios.crear(draftId, validado.datos);
  } catch {
    // No se devuelve éxito si el dato no quedó guardado.
    log("error", "envio_fallo", { draft_id: draftId });
    return responder({ error: "error_interno" }, 500);
  }

  // El borrador se elimina solo DESPUÉS de confirmar el envío; si falla, el envío sigue siendo válido.
  try {
    await borradores.eliminar(draftId);
  } catch {
    log("warn", "borrador_no_eliminado", { draft_id: draftId });
  }

  const { envio, creado } = resultado;
  log("info", creado ? "envio_creado" : "envio_repetido", { draft_id: draftId, envio_id: envio.id });
  return responder(
    { id: envio.id, draft_id: envio.draft_id, submitted_at: envio.submitted_at, ya_enviado: !creado },
    creado ? 201 : 200,
  );
}
