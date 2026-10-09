# Esquema de datos

## Borradores (Redis)

- **Clave:** `draft:{draft_id}` (ejemplo: `draft:3f2b8c1e-5a7d-4e2a-9b3c-1d2e3f4a5b6c`)
- **Expiración (TTL):** 7 días (604800 segundos)
- **Valor:** JSON con este formato:

```json
{
  "draft_id": "3f2b8c1e-5a7d-4e2a-9b3c-1d2e3f4a5b6c",
  "data": {
    "nombre": "Ana Pérez",
    "correo": "ana@ejemplo.com",
    "tipo_problema": "red",
    "prioridad": "alta",
    "descripcion": "No tengo conexión a internet en la oficina desde la mañana."
  },
  "updated_at": "2026-10-08T20:15:00Z"
}
```

En un borrador los campos pueden estar incompletos o vacíos; la validación completa se aplica solo al enviar.

## Envíos definitivos (PostgreSQL)

```sql
CREATE TABLE submissions (
  id           BIGSERIAL PRIMARY KEY,
  draft_id     UUID NOT NULL UNIQUE,
  data         JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`draft_id` es único: si el usuario pulsa Enviar dos veces, el segundo intento no crea un duplicado.

Ejemplo del contenido de `data` en un envío definitivo (todos los campos completos y válidos):

```json
{
  "nombre": "Ana Pérez",
  "correo": "ana@ejemplo.com",
  "tipo_problema": "red",
  "prioridad": "alta",
  "descripcion": "No tengo conexión a internet en la oficina desde la mañana."
}
```

## Campos dentro de `data`

| Clave | Tipo en JSON | Valores permitidos |
|---|---|---|
| nombre | texto | 3 a 100 caracteres |
| correo | texto | Correo válido |
| tipo_problema | texto | software, hardware, red, otro |
| prioridad | texto | baja, media, alta |
| descripcion | texto | 10 a 1000 caracteres |

## Flujo

1. El navegador genera un `draft_id` (UUID) y guarda el borrador en `localStorage`.
2. El borrador se sincroniza con Redis usando ese `draft_id`.
3. Al enviar, el servidor valida todos los campos, inserta en `submissions` y borra el borrador de Redis.

## Consulta de ejemplo

Para ver los envíos por prioridad:

```sql
SELECT id, data->>'nombre' AS nombre, data->>'prioridad' AS prioridad, submitted_at
FROM submissions
WHERE data->>'prioridad' = 'alta'
ORDER BY submitted_at DESC;
```