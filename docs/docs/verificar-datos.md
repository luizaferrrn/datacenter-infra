# Verificación de la capa de datos (Fase 3)

Los nombres de contenedores son provisionales. Se ajustan cuando Persona 1 despliegue.

## 1. Estado de PostgreSQL con Patroni

```bash
docker exec -it pg-1 patronictl list
```

Resultado esperado: un nodo con rol Leader y otro como Replica, ambos en estado running.

## 2. Un envío llegó a PostgreSQL
Con el líder detrás de HAProxy (puerto 5000):

```bash
docker exec -it pg-1 psql -U postgres -d formulario -c "SELECT id, data->>'nombre' AS nombre, data->>'prioridad' AS prioridad, submitted_at FROM submissions ORDER BY submitted_at DESC LIMIT 5;"
```
Si `pg-1` es réplica, el comando funciona igual para leer. Si pide contraseña, es `POSTGRES_SUPERUSER_PASSWORD` del `.env`.


## 3. Un borrador está en Redis

Resultado esperado: aparece la fila con los datos de prueba.

```bash
docker exec -it redis-primary redis-cli -a <REDIS_PASSWORD> keys "draft:*"
```

Resultado esperado: aparece al menos una clave `draft:...`.

## 4. Estado de Redis y Sentinel

```bash
docker exec -it sentinel-1 redis-cli -p 26379 sentinel master mymaster
```

Resultado esperado: aparece la información del primario, con `mymaster` como nombre.

## 5. Pruebas de caída

| Prueba | Qué se hace | Qué se comprueba | Tiempo | Pasó |
|---|---|---|---|---|
| PostgreSQL líder | Persona 1 detiene el contenedor líder | `patronictl list` muestra nuevo líder; el envío anterior sigue en la tabla | | [ ] |
| Redis primario | Persona 1 detiene el Redis primario | Sentinel promueve la réplica; el borrador sigue en Redis | | [ ] |
| Reinicio de la VM | Persona 1 ejecuta `sudo reboot` | Los datos de ambos siguen presentes | | [ ] |