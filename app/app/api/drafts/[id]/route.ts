import { NextResponse } from "next/server";
import { esUuid, validarBorrador } from "../../../../lib/formulario";
import { obtenerAlmacenes } from "../../../../lib/almacen";
import { log } from "../../../../lib/log";

const SIN_CACHE = { "Cache-Control": "no-store" };
const MAX_BYTES = 16 * 1024;

function responder(cuerpo: unknown, status: number) {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE });
}

type Contexto = { params: Promise<{ id: string }> };

// GET /api/drafts/{id} -> 200 borrador | 400 id_invalido | 404 no_encontrado
export async function GET(_req: Request, { params }: Contexto) {
  const { id } = await params;
  if (!esUuid(id)) return responder({ error: "id_invalido" }, 400);
  try {
    const borrador = await obtenerAlmacenes().borradores.obtener(id);
    if (!borrador) return responder({ error: "no_encontrado" }, 404);
    return responder(borrador, 200);
  } catch {
    log("error", "draft_get_fallo", { draft_id: id });
    return responder({ error: "error_interno" }, 500);
  }
}

// PUT /api/drafts/{id}  cuerpo: { "data": { ...campos parciales } }
// -> 200 { draft_id, updated_at } | 400 | 413 | 422 { error:"validacion", campos }
export async function PUT(req: Request, { params }: Contexto) {
  const { id } = await params;
  if (!esUuid(id)) return responder({ error: "id_invalido" }, 400);

  const texto = await req.text();
  if (texto.length > MAX_BYTES) return responder({ error: "cuerpo_demasiado_grande" }, 413);

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return responder({ error: "json_invalido" }, 400);
  }
  const data = (cuerpo as { data?: unknown } | null)?.data;
  const validado = validarBorrador(data);
  if (!validado.ok) return responder({ error: "validacion", campos: validado.errores }, 422);

  try {
    const borrador = { draft_id: id, data: validado.datos, updated_at: new Date().toISOString() };
    await obtenerAlmacenes().borradores.guardar(borrador);
    return responder({ draft_id: id, updated_at: borrador.updated_at }, 200);
  } catch {
    log("error", "draft_put_fallo", { draft_id: id });
    return responder({ error: "error_interno" }, 500);
  }
}

// DELETE /api/drafts/{id} -> 204 (idempotente)
export async function DELETE(_req: Request, { params }: Contexto) {
  const { id } = await params;
  if (!esUuid(id)) return responder({ error: "id_invalido" }, 400);
  try {
    await obtenerAlmacenes().borradores.eliminar(id);
    return new NextResponse(null, { status: 204, headers: SIN_CACHE });
  } catch {
    log("error", "draft_delete_fallo", { draft_id: id });
    return responder({ error: "error_interno" }, 500);
  }
}
