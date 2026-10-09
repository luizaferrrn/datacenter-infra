import { NextResponse } from "next/server";
import { esUuid, validarBorrador } from "../../../../lib/formulario";
import { obtenerAlmacenes } from "../../../../lib/almacen";
import { responder, responderFallo } from "../../../../lib/respuestas";

const MAX_BYTES = 16 * 1024;

type Contexto = { params: Promise<{ id: string }> };

// GET /api/drafts/{id} -> 200 borrador | 400 id_invalido | 404 no_encontrado | 503 | 500
export async function GET(_req: Request, { params }: Contexto) {
  const { id: crudo } = await params;
  if (!esUuid(crudo)) return responder({ error: "id_invalido" }, 400);
  const id = crudo.toLowerCase(); // un mismo UUID = una sola clave, venga en mayúsculas o minúsculas
  try {
    const borrador = await obtenerAlmacenes().borradores.obtener(id);
    if (!borrador) return responder({ error: "no_encontrado" }, 404);
    return responder(borrador, 200);
  } catch (error) {
    return responderFallo(error, "draft_get_fallo", { draft_id: id });
  }
}

// PUT /api/drafts/{id}  cuerpo: { "data": { ...campos parciales } }
// -> 200 { draft_id, updated_at } | 400 | 413 | 422 { error:"validacion", campos } | 503 | 500
export async function PUT(req: Request, { params }: Contexto) {
  const { id: crudo } = await params;
  if (!esUuid(crudo)) return responder({ error: "id_invalido" }, 400);
  const id = crudo.toLowerCase();

  const texto = await req.text();
  if (texto.length > MAX_BYTES) return responder({ error: "cuerpo_demasiado_grande" }, 413);

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return responder({ error: "json_invalido" }, 400);
  }
  const validado = validarBorrador((cuerpo as { data?: unknown } | null)?.data);
  if (!validado.ok) return responder({ error: "validacion", campos: validado.errores }, 422);

  try {
    const borrador = { draft_id: id, data: validado.datos, updated_at: new Date().toISOString() };
    await obtenerAlmacenes().borradores.guardar(borrador);
    return responder({ draft_id: id, updated_at: borrador.updated_at }, 200);
  } catch (error) {
    return responderFallo(error, "draft_put_fallo", { draft_id: id });
  }
}

// DELETE /api/drafts/{id} -> 204 (idempotente) | 400 | 503 | 500
export async function DELETE(_req: Request, { params }: Contexto) {
  const { id: crudo } = await params;
  if (!esUuid(crudo)) return responder({ error: "id_invalido" }, 400);
  const id = crudo.toLowerCase();
  try {
    await obtenerAlmacenes().borradores.eliminar(id);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responderFallo(error, "draft_delete_fallo", { draft_id: id });
  }
}