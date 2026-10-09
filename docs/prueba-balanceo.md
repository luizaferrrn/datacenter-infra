# Pruebas de balanceo (Fase 4)

## Preparación
- [ ] `docker compose ps` muestra Nginx y las instancias de la app en `Up`
- [ ] La página abre en http://127.0.0.1:8080

## Prueba A: reparto entre instancias
Recargar la página 10 veces y anotar el identificador de instancia que muestra.

| Recarga | Instancia |
|---|---|
| 1 | |
| 2 | |
(...)

Resultado esperado: aparecen al menos dos instancias distintas.

## Prueba B: apagar una instancia mientras se escribe
1. Abrir el formulario y escribir nombre, correo y parte de la descripción.
2. Anotar qué instancia atiende (identificador en pantalla).
3. Persona 1 ejecuta: `docker stop <nombre-de-esa-instancia>`
4. Seguir escribiendo y esperar el autoguardado.
5. Recargar la página: el borrador debe reaparecer.
6. Completar y enviar.

| Qué se observa | Resultado |
|---|---|
| ¿La página siguió respondiendo? | |
| ¿Hubo algún error visible? | |
| ¿El borrador reapareció? | |
| ¿El envío se guardó (consulta en PostgreSQL)? | |
| Tiempo hasta que respondió otra instancia | |

## Prueba C: dejar solo una instancia (prueba 4 del plan)
Persona 1 detiene todas menos una. El servicio debe seguir, aunque más lento.

## Prueba D: volver a encender
Persona 1 enciende la instancia y recarga Nginx (`docker compose exec nginx nginx -s reload`). Debe volver a aparecer en el reparto.