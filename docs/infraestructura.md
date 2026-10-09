# Infraestructura del proyecto: Formulario Next.js con alta disponibilidad

Documento de referencia común para Persona 1 (VM), Persona 2 (aplicación) y Persona 3 (documentación y datos).

## 1. Máquina virtual

| Dato | Valor |
|---|---|
| Nombre en VirtualBox | DATACENTER-LAB |
| Sistema operativo | Ubuntu Server 24.04.1 LTS |
| Recursos | Objetivo: 16 GB RAM, 8 vCPU, 200 GB. Actual: 1,6 GB, 1 vCPU, 25 GB (pendiente de ampliar por Persona 1) |
| Usuario | ggccsa |
| Hostname | DATACENTER-LAB |
| Dominio | datacenter.local |
| Acceso | SSH por PuTTY a 127.0.0.1, puerto 2222 |

## 2. Carpetas en la VM

```
~/datacenter-infra/
├── docker-compose.yml
├── .env                  (no se sube a Git)
├── app/                  (código de la aplicación, Persona 2)
├── nginx/nginx.conf
├── haproxy/haproxy.cfg   (enruta al líder de PostgreSQL)
├── postgres/             (configuración de Patroni)
├── redis/                (configuración de Redis y Sentinel)
├── monitoring/           (prometheus.yml, loki-config.yml, alertmanager.yml)
└── backups/
```

## 3. Reglas de reenvío de puertos en VirtualBox

| Nombre | Anfitrión (127.0.0.1) | VM | Uso |
|---|---|---|---|
| SSH | 2222 | 22 | Acceso por PuTTY |
| WEB | 8080 | 80 | La aplicación, a través de Nginx |
| GRAFANA | 3001 | 3000 | Paneles (opcional) |
| PROM | 9090 | 9090 | Prometheus (opcional) |

## 4. Puertos internos (no se exponen fuera de Docker)

| Servicio | Puerto |
|---|---|
| Aplicación Next.js | 3000 |
| PostgreSQL (cada nodo) | 5432 |
| API REST de Patroni | 8008 |
| HAProxy hacia el líder de PostgreSQL | 5000 |
| etcd | 2379 |
| Redis | 6379 |
| Sentinel | 26379 |

## 5. Redes Docker

| Red | Contenedores | Propósito |
|---|---|---|
| frontend-net | Nginx, app | Tráfico de usuarios |
| data-net | app, Redis, Sentinel, HAProxy, Patroni, etcd | Datos; sin acceso desde fuera |
| monitoring-net | Prometheus, Grafana, Loki, Alertmanager, exporters y la app (métricas) | Observabilidad |

## 6. Presupuesto orientativo de memoria

| Grupo | Contenedores | Aprox. |
|---|---|---|
| App | 3 × 512 MB | 1,5 GB |
| PostgreSQL | 2 × 1 GB | 2 GB |
| etcd | 3 × 128 MB | 0,4 GB |
| Redis y Sentinel | 2 + 3 contenedores | 0,9 GB |
| Nginx y HAProxy | 2 × 128 MB | 0,25 GB |
| Monitoreo | Prometheus, Grafana, Loki, cAdvisor y exporters | 2,4 GB |
| Ubuntu + Docker | Sistema base | 1 GB |
| **Total** | | **~8,5 GB de 16 GB** |

Todo contenedor debe tener límite de memoria y `restart: unless-stopped`.

## 7. Reglas del equipo

- El archivo `.env` real nunca se sube a Git; solo `.env.example`.
- La aplicación no guarda estado local: borradores en Redis, envíos definitivos en PostgreSQL.
- Solo Nginx publica puertos hacia fuera de Docker.
- Las versiones de las imágenes Docker se fijan; no se usa `latest`.