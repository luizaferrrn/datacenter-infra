"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  CAMPOS,
  ETIQUETAS_PRIORIDAD,
  ETIQUETAS_TIPO_PROBLEMA,
  PRIORIDADES,
  TIPOS_PROBLEMA,
  esUuid,
  validarBorrador,
  validarEnvio,
  type BorradorDatos,
  type CampoClave,
  type DatosFormulario,
  type Errores,
} from "../lib/formulario";

const CLAVE_LS = "formulario:borrador:v1";
const MAX_REINTENTOS = 6;
const CABECERAS = { "Content-Type": "application/json" };

type Local = {
  draft_id: string;
  data: BorradorDatos;
  updated_at: string;
  envio_pendiente: boolean;
};
type Sync = "pendiente" | "sincronizando" | "sincronizado" | "sin_conexion" | "desconectado" | "rechazado";
type Fase = "editando" | "enviando" | "envio_pendiente" | "enviado";

// UUID v4 con getRandomValues: randomUUID() exige contexto seguro (https/localhost).
function nuevoUuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function nuevoLocal(): Local {
  return { draft_id: nuevoUuid(), data: {}, updated_at: new Date().toISOString(), envio_pendiente: false };
}

function cargarLocal(): Local | null {
  try {
    const crudo = localStorage.getItem(CLAVE_LS);
    if (!crudo) return null;
    const o = JSON.parse(crudo) as Partial<Local> | null;
    if (!o || !esUuid(o.draft_id)) return null;
    const v = validarBorrador(o.data ?? {});
    return {
      draft_id: o.draft_id,
      data: v.ok ? v.datos : {},
      updated_at: typeof o.updated_at === "string" ? o.updated_at : new Date().toISOString(),
      envio_pendiente: o.envio_pendiente === true,
    };
  } catch {
    return null;
  }
}

const espera = (intentos: number) => Math.min(2000 * 2 ** intentos, 30000);
const largo = (s: string | undefined) => Array.from(s ?? "").length;
const maximo = (clave: CampoClave) => {
  const r = CAMPOS.find((c) => c.clave === clave);
  return r && r.tipo !== "lista" ? r.max : 0;
};

const ENTRADA =
  "w-full rounded border border-zinc-400 bg-transparent px-3 py-2 text-base disabled:opacity-60";

function Campo(props: { id: string; etiqueta: string; error?: string; contador?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.etiqueta}
      </label>
      {props.children}
      {props.contador ? <p className="text-xs text-zinc-600 dark:text-zinc-400">{props.contador}</p> : null}
      {props.error ? (
        <p id={`${props.id}-error`} className="text-sm text-red-700 dark:text-red-400">
          {props.error}
        </p>
      ) : null}
    </div>
  );
}

function FormularioInterno() {
  const [local, setLocal] = useState<Local>(() => cargarLocal() ?? nuevoLocal());
  const [fase, setFase] = useState<Fase>(local.envio_pendiente ? "envio_pendiente" : "editando");
  const [sync, setSync] = useState<Sync>(Object.keys(local.data).length > 0 ? "pendiente" : "sincronizado");
  const [errores, setErrores] = useState<Errores>({});
  const [resultado, setResultado] = useState<{ id: number; ya_enviado: boolean } | null>(null);
  const [reintentoEnvio, setReintentoEnvio] = useState(0);

  const versionRef = useRef(local.updated_at);
  const intentosSyncRef = useRef(0);
  const intentosEnvioRef = useRef(0);

  // 1) Guardado local inmediato en cada cambio.
  useEffect(() => {
    if (fase === "enviado") return;
    try {
      localStorage.setItem(
        CLAVE_LS,
        JSON.stringify({ ...local, envio_pendiente: fase === "envio_pendiente" || fase === "enviando" }),
      );
    } catch {
      // Sin almacenamiento disponible (modo privado lleno, etc.): el borrador sigue en memoria y en el servidor.
    }
  }, [local, fase]);

  // 2) Sincronización del borrador con el servidor: espera 0,8 s sin cambios; reintenta con espera creciente.
  useEffect(() => {
    if (fase !== "editando") return;
    if (sync !== "pendiente" && sync !== "sin_conexion") return;
    const ms = sync === "pendiente" ? 800 : espera(intentosSyncRef.current - 1);
    const id = setTimeout(async () => {
      const version = local.updated_at;
      setSync("sincronizando");
      try {
        const r = await fetch(`/api/drafts/${local.draft_id}`, {
          method: "PUT",
          headers: CABECERAS,
          body: JSON.stringify({ data: local.data }),
        });
        if (r.ok) {
          intentosSyncRef.current = 0;
          if (versionRef.current === version) setSync("sincronizado");
          else setSync("pendiente"); // hubo cambios mientras se enviaba
        } else if (r.status >= 400 && r.status < 500) {
          setSync("rechazado");
        } else {
          intentosSyncRef.current += 1;
          setSync(intentosSyncRef.current >= MAX_REINTENTOS ? "desconectado" : "sin_conexion");
        }
      } catch {
        intentosSyncRef.current += 1;
        setSync(intentosSyncRef.current >= MAX_REINTENTOS ? "desconectado" : "sin_conexion");
      }
    }, ms);
    return () => clearTimeout(id);
  }, [fase, sync, local]);

  // 3) Envío definitivo. Es idempotente en el servidor (draft_id), así que reintentar es seguro.
  const enviar = useCallback(async (draftId: string, datos: DatosFormulario) => {
    setFase("enviando");
    try {
      const r = await fetch("/api/submissions", {
        method: "POST",
        headers: CABECERAS,
        body: JSON.stringify({ draft_id: draftId, data: datos }),
      });
      if (r.status === 200 || r.status === 201) {
        const cuerpo = (await r.json()) as { id: number; ya_enviado: boolean };
        try {
          localStorage.removeItem(CLAVE_LS);
        } catch {}
        setResultado({ id: cuerpo.id, ya_enviado: cuerpo.ya_enviado });
        setFase("enviado");
        return;
      }
      if (r.status === 422) {
        const cuerpo = (await r.json()) as { campos?: Errores };
        setErrores(cuerpo.campos ?? {});
        setFase("editando");
        return;
      }
      if (r.status >= 400 && r.status < 500) {
        setErrores({ _: "El servidor rechazó el envío." });
        setFase("editando");
        return;
      }
      throw new Error("error del servidor");
    } catch {
      setFase("envio_pendiente");
    }
  }, []);

  useEffect(() => {
    if (fase !== "envio_pendiente") return;
    if (intentosEnvioRef.current >= MAX_REINTENTOS) return;
    const id = setTimeout(() => {
      intentosEnvioRef.current += 1;
      const v = validarEnvio(local.data);
      if (v.ok) void enviar(local.draft_id, v.datos);
      else setFase("editando");
    }, espera(intentosEnvioRef.current));
    return () => clearTimeout(id);
  }, [fase, local, enviar, reintentoEnvio]);

  // 4) Al volver la conexión se reintenta de inmediato.
  useEffect(() => {
    const alVolver = () => {
      intentosSyncRef.current = 0;
      intentosEnvioRef.current = 0;
      setSync((s) => (s === "sin_conexion" || s === "desconectado" ? "pendiente" : s));
      setReintentoEnvio((n) => n + 1);
    };
    window.addEventListener("online", alVolver);
    return () => window.removeEventListener("online", alVolver);
  }, []);

  function alCambiar(clave: CampoClave, valor: string) {
    if (fase !== "editando") return;
    const updated_at = new Date().toISOString();
    versionRef.current = updated_at;
    intentosSyncRef.current = 0;
    setLocal((prev) => ({ ...prev, data: { ...prev.data, [clave]: valor }, updated_at }));
    setSync("pendiente");
    setErrores((prev) => ({ ...prev, [clave]: undefined }));
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (fase !== "editando") return;
    const v = validarEnvio(local.data);
    if (!v.ok) {
      setErrores(v.errores);
      return;
    }
    setErrores({});
    intentosEnvioRef.current = 0;
    void enviar(local.draft_id, v.datos);
  }

  function reiniciar() {
    const nuevo = nuevoLocal();
    versionRef.current = nuevo.updated_at;
    setLocal(nuevo);
    setResultado(null);
    setErrores({});
    setSync("sincronizado");
    setFase("editando");
  }

  if (fase === "enviado") {
    return (
      <div role="status" className="flex flex-col gap-4 rounded border border-zinc-400 p-5">
        <p className="font-medium">
          {resultado?.ya_enviado
            ? "Este formulario ya había sido enviado antes; no se creó un envío duplicado."
            : "Envío confirmado. Gracias."}
        </p>
        <button type="button" onClick={reiniciar} className="self-start rounded border border-zinc-400 px-4 py-2">
          Llenar otro formulario
        </button>
      </div>
    );
  }

  const d = local.data;
  const bloqueado = fase !== "editando";
  const textoSync: Record<Sync, string> = {
    pendiente: "Cambios por sincronizar con el servidor…",
    sincronizando: "Sincronizando con el servidor…",
    sincronizado: "Borrador sincronizado con el servidor.",
    sin_conexion: "Sin conexión: tus cambios siguen guardados en este navegador y se reintentará.",
    desconectado: "Sin conexión con el servidor. Tus cambios siguen guardados en este navegador.",
    rechazado: "El servidor no aceptó el borrador. Revisa los campos.",
  };

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-5">
      <div role="status" aria-live="polite" className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        <span>Guardado en este navegador.</span>
        <span>{textoSync[sync]}</span>
        {fase === "envio_pendiente" ? (
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Envío pendiente: se reintentará solo al recuperar la conexión.
          </span>
        ) : null}
        {fase === "enviando" ? <span>Enviando…</span> : null}
      </div>

      {errores._ ? <p className="text-sm text-red-700 dark:text-red-400">{errores._}</p> : null}

      <fieldset disabled={bloqueado} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <Campo
          id="nombre"
          etiqueta="Nombre completo"
          error={errores.nombre}
          contador={`${largo(d.nombre)}/${maximo("nombre")}`}
        >
          <input
            id="nombre"
            type="text"
            autoComplete="name"
            value={d.nombre ?? ""}
            onChange={(e: ChangeEvent<HTMLInputElement>) => alCambiar("nombre", e.target.value)}
            aria-invalid={errores.nombre ? true : undefined}
            aria-describedby={errores.nombre ? "nombre-error" : undefined}
            className={ENTRADA}
          />
        </Campo>

        <Campo id="correo" etiqueta="Correo electrónico" error={errores.correo}>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            value={d.correo ?? ""}
            onChange={(e) => alCambiar("correo", e.target.value)}
            aria-invalid={errores.correo ? true : undefined}
            aria-describedby={errores.correo ? "correo-error" : undefined}
            className={ENTRADA}
          />
        </Campo>

        <Campo id="tipo_problema" etiqueta="Tipo de problema" error={errores.tipo_problema}>
          <select
            id="tipo_problema"
            value={d.tipo_problema ?? ""}
            onChange={(e) => alCambiar("tipo_problema", e.target.value)}
            aria-invalid={errores.tipo_problema ? true : undefined}
            aria-describedby={errores.tipo_problema ? "tipo_problema-error" : undefined}
            className={ENTRADA}
          >
            <option value="">Selecciona una opción</option>
            {TIPOS_PROBLEMA.map((v) => (
              <option key={v} value={v}>
                {ETIQUETAS_TIPO_PROBLEMA[v]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="prioridad" etiqueta="Prioridad" error={errores.prioridad}>
          <select
            id="prioridad"
            value={d.prioridad ?? ""}
            onChange={(e) => alCambiar("prioridad", e.target.value)}
            aria-invalid={errores.prioridad ? true : undefined}
            aria-describedby={errores.prioridad ? "prioridad-error" : undefined}
            className={ENTRADA}
          >
            <option value="">Selecciona una opción</option>
            {PRIORIDADES.map((v) => (
              <option key={v} value={v}>
                {ETIQUETAS_PRIORIDAD[v]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          id="descripcion"
          etiqueta="Descripción del problema"
          error={errores.descripcion}
          contador={`${largo(d.descripcion)}/${maximo("descripcion")}`}
        >
          <textarea
            id="descripcion"
            rows={5}
            value={d.descripcion ?? ""}
            onChange={(e) => alCambiar("descripcion", e.target.value)}
            aria-invalid={errores.descripcion ? true : undefined}
            aria-describedby={errores.descripcion ? "descripcion-error" : undefined}
            className={ENTRADA}
          />
        </Campo>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={bloqueado}
          className="rounded bg-zinc-900 px-5 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {fase === "enviando" ? "Enviando…" : fase === "envio_pendiente" ? "Envío pendiente…" : "Enviar"}
        </button>
        {fase === "envio_pendiente" ? (
          <button
            type="button"
            onClick={() => {
              intentosEnvioRef.current = 0;
              setReintentoEnvio((n) => n + 1);
            }}
            className="rounded border border-zinc-400 px-5 py-2"
          >
            Reintentar ahora
          </button>
        ) : null}
        {fase === "editando" && sync === "desconectado" ? (
          <button
            type="button"
            onClick={() => {
              intentosSyncRef.current = 0;
              setSync("pendiente");
            }}
            className="rounded border border-zinc-400 px-5 py-2"
          >
            Reintentar sincronización
          </button>
        ) : null}
      </div>
    </form>
  );
}

// El borrador vive en localStorage, que no existe en el servidor. Se monta el formulario solo en el
// navegador para que el HTML del servidor y el primer render del cliente coincidan.
export default function FormularioCliente() {
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!montado) return <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando formulario…</p>;
  return <FormularioInterno />;
}
