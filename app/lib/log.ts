// Logs JSON por stdout/stderr. No registrar contenido del formulario ni secretos.
import os from "node:os";

const instancia = os.hostname(); // hostname del contenedor: estable por instancia

export function nombreInstancia(): string {
  return instancia;
}

export function log(
  nivel: "info" | "warn" | "error",
  evento: string,
  campos: Record<string, string | number | boolean | undefined> = {},
): void {
  const linea = JSON.stringify({ ts: new Date().toISOString(), nivel, evento, instancia, ...campos });
  if (nivel === "error") console.error(linea);
  else console.log(linea);
}
