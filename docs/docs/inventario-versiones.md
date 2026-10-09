# Inventario de componentes y versiones

Regla del proyecto: no se usa `latest`. Cada imagen lleva una versión fija.

## Decisión sobre PostgreSQL con Patroni

- `bitnami/patroni` queda descartada: no se encontró evidencia de que exista, y Bitnami movió sus imágenes a un repositorio sin actualizaciones.
- Se usará una **imagen propia** (`formulario-patroni`), construida con un Dockerfile a partir de la imagen oficial de PostgreSQL, con Patroni instalado con `pip` en versión fija.

## Tabla de versiones

| Componente | Función | Imagen Docker | Versión fija | Etiqueta verificada en el registro | Notas |
|---|---|---|---|---|---|
| Aplicación | Formulario Next.js | formulario-app (propia) | 1.0.0 | N/A | Base node:22-alpine |
| PostgreSQL + Patroni | Base de datos con failover | formulario-patroni (propia) | Patroni 4.1.3; PostgreSQL por confirmar (17 o 18) | [ ] | Dos nodos |
| etcd | Consenso para Patroni | quay.io/coreos/etcd | v3.6.11 | [ ] | Tres nodos |
| HAProxy | Enruta al líder de PostgreSQL | haproxy | por confirmar | [ ] | |
| Redis | Borradores | redis | 8.2 (parche por confirmar) | [ ] | Versión de soporte extendido |
| Redis Sentinel | Failover de Redis | redis | igual que Redis | [ ] | Misma imagen, tres contenedores |
| Nginx | Balanceador | nginx | por confirmar | [ ] | |
| Prometheus | Métricas | prom/prometheus | por confirmar | [ ] | |
| Grafana | Paneles | grafana/grafana | por confirmar | [ ] | |
| Alertmanager | Alertas | prom/alertmanager | por confirmar | [ ] | |
| Node Exporter | Métricas de la VM | prom/node-exporter | por confirmar | [ ] | |
| cAdvisor | Métricas de contenedores | por confirmar | por confirmar | [ ] | |
| Loki | Logs (opcional) | grafana/loki | por confirmar | [ ] | Solo si sobra memoria |

## Criterios para elegir una versión

- Que exista hoy en el registro (Docker Hub u otro).
- Que sea estable, no `latest` ni de prueba.
- Que lleve algunos meses publicada.
- Que sea compatible con las demás (PostgreSQL con Patroni).

## Cómo se marca una casilla

Se marca `[x]` cuando `docker manifest inspect <imagen>:<etiqueta>` responde con un bloque JSON y no con `no such manifest`.