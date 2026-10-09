import { connection, NextResponse } from "next/server";
import { nombreInstancia } from "../../../lib/log";

// Salud del PROCESO únicamente (healthcheck del contenedor). No consulta Redis ni PostgreSQL:
// si una dependencia cae, no debe tumbar las 3 instancias. Las dependencias irán en /api/ready.
export async function GET() {
  await connection(); // fuerza ejecución en cada petición (no prerenderizar en build)
  return NextResponse.json(
    { status: "ok", instancia: nombreInstancia() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
