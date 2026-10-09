import { NextResponse } from 'next/server';
import { leerConfig } from '../../../lib/config';
import Redis from 'ioredis';
import { Pool } from 'pg';

export async function GET() {
  const checks: Record<string, string> = {
    redis: 'ok',
    postgres: 'ok',
  };
  let statusCode = 200;

  try {
    const config = leerConfig();

    // 1. Verificar Redis si está configurado en modo sentinel o directo
    if (config.redis.modo === 'sentinel') {
      const sentinelsFormatted = config.redis.sentinels.map((s: { host: string; port: number }) => ({
        host: s.host,
        port: s.port,
      }));
      const redis = new Redis({
        sentinels: sentinelsFormatted,
        name: config.redis.nombreMaster,
        password: config.redis.password,
        sentinelPassword: config.redis.sentinelPassword,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });
      await redis.ping();
      await redis.quit();
    } else if (config.redis.modo === 'directo') {
      const redis = new Redis(config.redis.url, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });
      await redis.ping();
      await redis.quit();
    }

    // 2. PostgreSQL si está en modo real
    if (config.postgres.modo === 'real') {
      const pool = new Pool({
        connectionString: config.postgres.databaseUrl,
        connectionTimeoutMillis: 2000,
      });
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
    }
  } catch (error: unknown) {
    statusCode = 503;
    const err = error as Error;
    checks.error = err?.message || 'Error de conectividad con dependencias';
  }

  return NextResponse.json(
    {
      status: statusCode === 200 ? 'ready' : 'not_ready',
      checks,
    },
    {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}