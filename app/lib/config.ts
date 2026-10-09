

type Env = Record<string, string | undefined>;
// Solo el tipo mínimo de `process` que se usa aquí: así este archivo compila aunque el editor o el tsconfig
// no carguen @types/node. En tiempo de ejecución sigue siendo el `process` real de Node.
declare const process: { env: Env };

export type SentinelNodo = { host: string; port: number };

export type ConfigRedis =
  | { modo: "sentinel"; sentinels: SentinelNodo[]; nombreMaster: string; password?: string; sentinelPassword?: string }
  | { modo: "directo"; url: string } // solo desarrollo local
  | { modo: "simulado" };

export type ConfigPostgres =
  | { modo: "real"; databaseUrl: string; poolMax: number }
  | { modo: "simulado" };

export type Config = {
  entorno: "produccion" | "desarrollo";
  redis: ConfigRedis;
  postgres: ConfigPostgres;
};

/** Valores predeterminados. Lo que NO aparece aquí (hosts, usuarios, claves, base de datos) debe proporcionarse. */
export const PREDETERMINADOS = {
  REDIS_MASTER_NAME: "mymaster",
  PUERTO_SENTINEL: 26379,
  PG_POOL_MAX: 10,
} as const;

/** Tope de PG_POOL_MAX: protección contra errores de tipeo (cada instancia abre hasta este número de conexiones). */
export const PG_POOL_MAX_LIMITE = 100;

export class ErrorConfiguracion extends Error {
  readonly problemas: string[];

  constructor(problemas: string[]) {
    super(`Configuración inválida:\n- ${problemas.join("\n- ")}`);
    this.name = "ErrorConfiguracion";
    this.problemas = problemas;
  }
}

const HOST = /^[A-Za-z0-9_]([A-Za-z0-9_.-]*[A-Za-z0-9_])?$/;
const NOMBRE_MASTER = /^[A-Za-z0-9_.-]+$/;

/** Devuelve el valor recortado, o undefined si no existe o está vacío. */
function valor(env: Env, clave: string): string | undefined {
  const v = env[clave]?.trim();
  return v ? v : undefined;
}

function parsearPuerto(texto: string): number | null {
  if (!/^\d{1,5}$/.test(texto)) return null;
  const n = Number(texto);
  return n >= 1 && n <= 65535 ? n : null;
}

function parsearSentinels(texto: string, problemas: string[]): SentinelNodo[] | null {
  const nodos: SentinelNodo[] = [];
  const vistos = new Set<string>();
  let correcto = true;

  texto.split(",").forEach((crudo, indice) => {
    const pos = indice + 1;
    const parte = crudo.trim();
    if (parte === "") {
      problemas.push(`REDIS_SENTINELS: la entrada ${pos} está vacía (¿coma sobrante?).`);
      correcto = false;
      return;
    }
    const trozos = parte.split(":");
    if (trozos.length > 2) {
      problemas.push(`REDIS_SENTINELS: la entrada ${pos} no tiene el formato host:puerto.`);
      correcto = false;
      return;
    }
    const host = trozos[0];
    if (!HOST.test(host)) {
      problemas.push(`REDIS_SENTINELS: el host de la entrada ${pos} no es válido (solo letras, números, "_", "." y "-").`);
      correcto = false;
      return;
    }
    let port: number = PREDETERMINADOS.PUERTO_SENTINEL;
    if (trozos.length === 2) {
      const p = parsearPuerto(trozos[1]);
      if (p === null) {
        problemas.push(`REDIS_SENTINELS: el puerto de la entrada ${pos} debe ser un entero entre 1 y 65535.`);
        correcto = false;
        return;
      }
      port = p;
    }
    const clave = `${host.toLowerCase()}:${port}`;
    if (vistos.has(clave)) {
      problemas.push(`REDIS_SENTINELS: la entrada ${pos} está repetida.`);
      correcto = false;
      return;
    }
    vistos.add(clave);
    nodos.push({ host, port });
  });

  return correcto ? nodos : null;
}

/** Parsea una URL sin incluir nunca su contenido en el error. Devuelve null si no es válida. */
function parsearUrl(texto: string, protocolos: string[]): URL | null {
  try {
    const url = new URL(texto);
    if (!protocolos.includes(url.protocol) || url.hostname === "") return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Lee y valida la configuración. Lanza ErrorConfiguracion con TODOS los problemas encontrados.
 * No tiene efectos secundarios: no abre conexiones ni modifica el entorno.
 */
export function leerConfig(env: Env =process.env): Config {
  const problemas: string[] = [];
  const produccion = env.NODE_ENV === "production";

  // --- ALMACEN_SIMULADO: opt-in explícito. Solo se aplica a lo que falte configurar.
  let permitirSimulado = false;
  const crudoSimulado = valor(env, "ALMACEN_SIMULADO");
  if (crudoSimulado === "true") permitirSimulado = true;
  else if (crudoSimulado !== undefined && crudoSimulado !== "false") {
    problemas.push('ALMACEN_SIMULADO debe ser "true" o "false" (en minúsculas).');
  }
  const simuladoOk = !produccion || permitirSimulado;

  // --- Redis
  let redis: ConfigRedis | null = null;
  const sentinelsTxt = valor(env, "REDIS_SENTINELS");
  const urlTxt = valor(env, "REDIS_URL");

  if (sentinelsTxt && urlTxt) {
    problemas.push("Defina REDIS_SENTINELS o REDIS_URL, no ambas.");
  } else if (urlTxt && produccion) {
    problemas.push("REDIS_URL no se admite en producción: use REDIS_SENTINELS (la app no debe depender de un primario fijo).");
  } else if (sentinelsTxt) {
    const sentinels = parsearSentinels(sentinelsTxt, problemas);
    const nombreMaster = valor(env, "REDIS_MASTER_NAME") ?? PREDETERMINADOS.REDIS_MASTER_NAME;
    const nombreOk = NOMBRE_MASTER.test(nombreMaster);
    if (!nombreOk) problemas.push('REDIS_MASTER_NAME no es válido (solo letras, números, "_", "." y "-").');
    if (sentinels && nombreOk) {
      redis = {
        modo: "sentinel",
        sentinels,
        nombreMaster,
        password: env.REDIS_PASSWORD || undefined,
        sentinelPassword: env.REDIS_SENTINEL_PASSWORD || undefined,
      };
    }
  } else if (urlTxt) {
    if (parsearUrl(urlTxt, ["redis:", "rediss:"])) redis = { modo: "directo", url: urlTxt };
    else problemas.push("REDIS_URL no es una URL válida (formato redis://host:puerto).");
  } else if (simuladoOk) {
    redis = { modo: "simulado" };
  } else {
    problemas.push(
      'Falta REDIS_SENTINELS (formato "host:puerto,host:puerto"). En producción no se usa el almacén en memoria; ALMACEN_SIMULADO=true lo permite solo para demos.',
    );
  }

  // --- PostgreSQL
  let postgres: ConfigPostgres | null = null;
  const dbTxt = valor(env, "DATABASE_URL");

  let poolMax: number = PREDETERMINADOS.PG_POOL_MAX;
  const poolTxt = valor(env, "PG_POOL_MAX");
  if (poolTxt !== undefined) {
    const n = /^\d{1,4}$/.test(poolTxt) ? Number(poolTxt) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= PG_POOL_MAX_LIMITE) poolMax = n;
    else problemas.push(`PG_POOL_MAX debe ser un entero entre 1 y ${PG_POOL_MAX_LIMITE}.`);
  }

  if (dbTxt) {
    if (parsearUrl(dbTxt, ["postgres:", "postgresql:"])) postgres = { modo: "real", databaseUrl: dbTxt, poolMax };
    else problemas.push("DATABASE_URL no es una URL válida (formato postgres://usuario:clave@host:puerto/basedatos).");
  } else if (simuladoOk) {
    postgres = { modo: "simulado" };
  } else {
    problemas.push(
      "Falta DATABASE_URL (debe apuntar a HAProxy, no a un nodo de PostgreSQL). En producción no se usa el almacén en memoria; ALMACEN_SIMULADO=true lo permite solo para demos.",
    );
  }

  if (problemas.length > 0 || !redis || !postgres) {
    throw new ErrorConfiguracion(problemas.length > 0 ? problemas : ["Configuración incompleta."]);
  }
  return { entorno: produccion ? "produccion" : "desarrollo", redis, postgres };
}

/** Resumen SIN secretos, apto para registrar en el arranque (sin contraseñas ni la URL completa). */
export function describirConfig(config: Config): Record<string, string | number | boolean> {
  const resumen: Record<string, string | number | boolean> = { entorno: config.entorno, redis: config.redis.modo };

  if (config.redis.modo === "sentinel") {
    resumen.redis_sentinels = config.redis.sentinels.map((s) => `${s.host}:${s.port}`).join(",");
    resumen.redis_master = config.redis.nombreMaster;
    resumen.redis_password_definida = config.redis.password !== undefined;
    resumen.redis_sentinel_password_definida = config.redis.sentinelPassword !== undefined;
  } else if (config.redis.modo === "directo") {
    const u = new URL(config.redis.url);
    resumen.redis_host = u.hostname;
    resumen.redis_puerto = u.port || "6379";
  }

  resumen.postgres = config.postgres.modo;
  if (config.postgres.modo === "real") {
    const u = new URL(config.postgres.databaseUrl);
    resumen.postgres_host = u.hostname;
    resumen.postgres_puerto = u.port || "5432";
    resumen.postgres_base = u.pathname.replace(/^\//, "");
    resumen.pg_pool_max = config.postgres.poolMax;
  }
  return resumen;
}