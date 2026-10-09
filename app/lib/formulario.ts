// Única definición de reglas del formulario (docs/form.md y docs/schema-data.md).
// Sin dependencias de Node: se usa igual en el navegador y en el servidor.

export const TIPOS_PROBLEMA = ["software", "hardware", "red", "otro"] as const;
export const PRIORIDADES = ["baja", "media", "alta"] as const;

export type TipoProblema = (typeof TIPOS_PROBLEMA)[number];
export type Prioridad = (typeof PRIORIDADES)[number];

export const ETIQUETAS_TIPO_PROBLEMA: Record<TipoProblema, string> = {
  software: "Software o aplicación",
  hardware: "Computador o hardware",
  red: "Internet o conexión de red",
  otro: "Otro",
};

export const ETIQUETAS_PRIORIDAD: Record<Prioridad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

export type CampoClave =
  | "nombre"
  | "correo"
  | "tipo_problema"
  | "prioridad"
  | "descripcion";

type ReglaTexto = {
  clave: CampoClave;
  etiqueta: string;
  tipo: "texto" | "email" | "texto_largo";
  min: number;
  max: number;
};
type ReglaLista = {
  clave: CampoClave;
  etiqueta: string;
  tipo: "lista";
  opciones: readonly string[];
};

export const CAMPOS: readonly (ReglaTexto | ReglaLista)[] = [
  { clave: "nombre", etiqueta: "Nombre completo", tipo: "texto", min: 3, max: 100 },
  // max 254 NO está en docs/: es el límite habitual de una dirección de correo. Confirmar con Luisa.
  { clave: "correo", etiqueta: "Correo electrónico", tipo: "email", min: 1, max: 254 },
  { clave: "tipo_problema", etiqueta: "Tipo de problema", tipo: "lista", opciones: TIPOS_PROBLEMA },
  { clave: "prioridad", etiqueta: "Prioridad", tipo: "lista", opciones: PRIORIDADES },
  { clave: "descripcion", etiqueta: "Descripción del problema", tipo: "texto_largo", min: 10, max: 1000 },
];

// Todos los campos son obligatorios al enviar (docs/form.md).
export type DatosFormulario = {
  nombre: string;
  correo: string;
  tipo_problema: TipoProblema;
  prioridad: Prioridad;
  descripcion: string;
};

// En un borrador los campos pueden faltar o estar vacíos (docs/schema-data.md).
export type BorradorDatos = Partial<Record<CampoClave, string>>;

export type Errores = Partial<Record<CampoClave | "_", string>>;
export type Resultado<T> = { ok: true; datos: T } | { ok: false; errores: Errores };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

const largo = (s: string) => Array.from(s).length; // cuenta caracteres, no unidades UTF-16

function validarCampo(
  regla: ReglaTexto | ReglaLista,
  valor: unknown,
  completo: boolean,
): string | null {
  if (valor !== undefined && valor !== null && typeof valor !== "string") {
    return "Debe ser texto.";
  }
  const bruto = (valor ?? "") as string;
  const v = bruto.trim();

  if (v === "") return completo ? "Este campo es obligatorio." : null;

  if (regla.tipo === "lista") {
    return regla.opciones.includes(v) ? null : "Valor no permitido.";
  }
  if (largo(bruto) > regla.max) return `Máximo ${regla.max} caracteres.`;
  if (completo) {
    if (largo(v) < regla.min) return `Mínimo ${regla.min} caracteres.`;
    if (regla.tipo === "email" && !EMAIL.test(v)) return "Correo electrónico no válido.";
  }
  return null;
}

function comoObjeto(entrada: unknown): Record<string, unknown> | null {
  return typeof entrada === "object" && entrada !== null && !Array.isArray(entrada)
    ? (entrada as Record<string, unknown>)
    : null;
}

/** Validación completa: se usa al enviar (navegador y servidor). Recorta espacios en los extremos. */
export function validarEnvio(entrada: unknown): Resultado<DatosFormulario> {
  const obj = comoObjeto(entrada);
  if (!obj) return { ok: false, errores: { _: "Se esperaba un objeto con los campos del formulario." } };

  const errores: Errores = {};
  const limpio: Record<string, string> = {};
  for (const regla of CAMPOS) {
    const error = validarCampo(regla, obj[regla.clave], true);
    if (error) errores[regla.clave] = error;
    else limpio[regla.clave] = (obj[regla.clave] as string).trim();
  }
  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos: limpio as unknown as DatosFormulario };
}

/** Validación de borrador: campos opcionales, pero lo presente debe ser coherente. Ignora claves desconocidas. */
export function validarBorrador(entrada: unknown): Resultado<BorradorDatos> {
  const obj = comoObjeto(entrada);
  if (!obj) return { ok: false, errores: { _: "Se esperaba un objeto con los campos del borrador." } };

  const errores: Errores = {};
  const datos: BorradorDatos = {};
  for (const regla of CAMPOS) {
    const valor = obj[regla.clave];
    const error = validarCampo(regla, valor, false);
    if (error) errores[regla.clave] = error;
    else if (typeof valor === "string") datos[regla.clave] = valor; // se conserva tal cual (sin recortar)
  }
  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos };
}
