import Redis from 'ioredis';
import { leerConfig } from './config';
import type { AlmacenBorradores, Borrador } from './almacen';

let redisClient: Redis | null = null;

function obtenerClienteRedis(): Redis {
  if (!redisClient) {
    const config = leerConfig();

    if (config.redis.modo === 'sentinel' && config.redis.sentinels && config.redis.sentinels.length > 0) {
      // Formatear los nodos sentinel para ioredis [{ host, port }]
      const sentinelsFormatted = config.redis.sentinels.map((s) => ({
        host: s.host,
        port: s.port,
      }));

      redisClient = new Redis({
        sentinels: sentinelsFormatted,
        name: config.redis.nombreMaster,
        password: config.redis.password,
        sentinelPassword: config.redis.sentinelPassword,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    } else {
      throw new Error('Configuración de Redis incompleta o modo no soportado para Sentinel.');
    }
  }
  return redisClient;
}

const TTL_BORRADOR_SEGUNDOS = 7 * 24 * 60 * 60; // 7 días

export class AlmacenRedisBorradores implements AlmacenBorradores {
  private getKey(draftId: string): string {
    return `draft:${draftId.toLowerCase()}`;
  }

  async guardar(borrador: Borrador): Promise<void> {
    const client = obtenerClienteRedis();
    const idNorm = borrador.draft_id.toLowerCase();
    const key = this.getKey(idNorm);

    const payload = {
      draft_id: idNorm,
      data: borrador.data,
      updated_at: borrador.updated_at,
    };

    await client.set(key, JSON.stringify(payload), 'EX', TTL_BORRADOR_SEGUNDOS);
  }

  async obtener(draftId: string): Promise<Borrador | null> {
    const client = obtenerClienteRedis();
    const key = this.getKey(draftId);
    const raw = await client.get(key);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      return {
        draft_id: parsed.draft_id,
        data: parsed.data,
        updated_at: parsed.updated_at,
      };
    } catch {
      return null;
    }
  }

  async eliminar(draftId: string): Promise<void> {
    const client = obtenerClienteRedis();
    const key = this.getKey(draftId);
    await client.del(key);
  }
}