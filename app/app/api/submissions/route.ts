import { esUuid, validarEnvio } from "../../../lib/formulario";
import { obtenerAlmacenes } from "../../../lib/almacen";
import { responder, responderFallo } from "../../../lib/respuestas";
import { log } from "../../../lib/log";

const MAX_BYTES = 16 * 1024;

// POST /api/submissions  cuerpo: { "draft_id": "<uuid>", "data": { ...5 campos } }
//   201 { id, draft_id, submitted_at, ya_enviado:false }  primer envío
//   200 { id, draft_id, submitted_at, ya_enviado:true }   reintento del mismo draft_id (no duplica)
//   400 json_invalido | draft_id_invalido | 413 cuerpo_demasiado_grande | 422 { error:"validacion", campos }
//   503 servicio_no_disponible (el almacén no respondió: reintentar es seguro, el envío es idempotente)
//   500 error_interno | configuracion_invalida
// Nunca se devuelve 200/201 si el envío no quedó realmente guardado.
export async function POST(req: Request) {
  const texto = await req.text();
  if (texto.length > MAX_BYTES) return responder({ error: "cuerpo_demasiado_grande" }, 413);

  let cuerpo: { draft_id?: unknown; data?: unknown } | null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return responder({ error: "json_invalido" }, 400);
  }
  const draftCrudo = cuerpo?.draft_id;
  if (!esUuid(draftCrudo)) return responder({ error: "draft_id_invalido" }, 400);
  const draftId = draftCrudo.toLowerCase();

  const validado = validarEnvio(cuerpo?.data);
  if (!validado.ok) return responder({ error: "validacion", campos: validado.errores }, 422);

  let almacenes: ReturnType<typeof obtenerAlmacenes>;
  let resultado: Awaited<ReturnType<ReturnType<typeof obtenerAlmacenes>["envios"]["crear"]>>;
  try {
    almacenes = obtenerAlmacenes();
    resultado = await almacenes.envios.crear(draftId, validado.datos);
  } catch (error) {
    return responderFallo(error, "envio_fallo", { draft_id: draftId });
  }

  // El borrador se elimina solo DESPUÉS de confirmar el envío. Si falla, el envío sigue siendo válido
  // (el borrador expira solo por su TTL).
  try {
    await almacenes.borradores.eliminar(draftId);
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