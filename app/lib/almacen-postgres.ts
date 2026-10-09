import { Pool } from 'pg';
import { leerConfig } from './config';
import type { AlmacenEnvios, Envio } from './almacen';
import type { DatosFormulario } from './formulario';

let pool: Pool | null = null;

function obtenerPoolPostgres(): Pool {
  if (!pool) {
    const config = leerConfig();

    if (config.postgres.modo !== 'real') {
      throw new Error('Configuración de PostgreSQL no está en modo real.');
    }

    pool = new Pool({
      connectionString: config.postgres.databaseUrl,
      max: config.postgres.poolMax,
    });
  }
  return pool;
}

export class AlmacenPostgresEnvios implements AlmacenEnvios {
  async crear(draftId: string, data: DatosFormulario): Promise<{ envio: Envio; creado: boolean }> {
    const clientDb = obtenerPoolPostgres();
    const idNorm = draftId.toLowerCase();
    const submittedAt = new Date().toISOString();

    const client = await clientDb.connect();
    try {
      await client.query('BEGIN');

      // 1. Verificar si ya existe un envío con este draft_id (Idempotencia)
      const existingQuery = `
        SELECT id, draft_id, data, submitted_at 
        FROM submissions 
        WHERE draft_id = $1
      `;
      const existingResult = await client.query(existingQuery, [idNorm]);

      if (existingResult.rows.length > 0) {
        await client.query('ROLLBACK');
        const row = existingResult.rows[0];
        return {
          envio: {
            id: Number(row.id),
            draft_id: row.draft_id,
            data: row.data as DatosFormulario,
            submitted_at: row.submitted_at,
          },
          creado: false, // Ya existía, no se duplica
        };
      }

      // 2. Insertar nuevo envío
      const insertQuery = `
        INSERT INTO submissions (draft_id, data, submitted_at)
        VALUES ($1, $2, $3)
        RETURNING id, draft_id, data, submitted_at
      `;
      const insertResult = await client.query(insertQuery, [idNorm, JSON.stringify(data), submittedAt]);
      await client.query('COMMIT');

      const row = insertResult.rows[0];
      return {
        envio: {
          id: Number(row.id),
          draft_id: row.draft_id,
          data: row.data as DatosFormulario,
          submitted_at: row.submitted_at,
        },
        creado: true,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}