## Datos de prueba

| Campo | Valor |
|---|---|
| nombre | Ana Pérez |
| correo | ana@ejemplo.com |
| tipo_problema | red |
| prioridad | alta |
| descripcion | No tengo conexión a internet en la oficina desde la mañana. |

## Pruebas

| # | Prueba | Resultado esperado | Pasó | Hora | Tiempo de recuperación |
|---|---|---|---|---|---|
| 1 | Cerrar el navegador a mitad del formulario | El borrador reaparece | [ ] | | |
| 2 | Cortar el internet del usuario | Conserva lo escrito y sincroniza al volver | [ ] | | |
| 3 | Apagar una instancia de la app | La página sigue disponible | [ ] | | |
| 4 | Apagar todas las instancias menos una | El servicio sigue, más lento | [ ] | | |
| 5 | Apagar Redis primario | Sentinel promueve la réplica, sin pérdida de borradores | [ ] | | |
| 6 | Apagar PostgreSQL líder | Patroni promueve al secundario, sin pérdida de envíos | [ ] | | |
| 7 | Prueba de carga con varios usuarios | Sin errores relevantes | [ ] | | |
| 8 | Apagar y encender la VM completa | Los contenedores se reinician solos y los datos siguen | [ ] | | |
| 9 | Perder la VM y restaurar desde backup | Los datos se recuperan | [ ] | | |
| 10 | Enviar con campos obligatorios vacíos | Se rechaza y marca los campos faltantes | [ ] | | |
| 11 | Descripción de menos de 10 caracteres | Se rechaza con mensaje de error | [ ] | | |
| 12 | Pulsar Enviar dos veces seguidas | Se guarda un solo envío | [ ] | | |