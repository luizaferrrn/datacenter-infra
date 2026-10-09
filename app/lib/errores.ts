// Una dependencia externa (Redis o PostgreSQL) no respondió tras los reintentos acotados.
// Los endpoints la traducen a 503 (ver respuestas.ts). Es distinta de un error de programación (500).
export class DependenciaNoDisponible extends Error {
  readonly dependencia: "redis" | "postgres";

  constructor(dependencia: "redis" | "postgres", causa?: unknown) {
    super(`${dependencia} no disponible`, { cause: causa });
    this.name = "DependenciaNoDisponible";
    this.dependencia = dependencia;
  }
}