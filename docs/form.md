# Definición del formulario

| Campo | Clave técnica | Tipo | Obligatorio | Validación |
|---|---|---|---|---|
| Nombre completo | nombre | texto | Sí | 3 a 100 caracteres |
| Correo electrónico | correo | email | Sí | Formato de correo válido | Máximo de 254 caracteres|
| Tipo de problema | tipo_problema | lista | Sí | Una de: software, hardware, red, otro |
| Prioridad | prioridad | lista | Sí | Una de: baja, media, alta |
| Descripción del problema | descripcion | texto largo | Sí | 10 a 1000 caracteres |

## Valores de las listas

| Clave técnica | Valor guardado | Texto que ve el usuario |
|---|---|---|
| tipo_problema | software | Software o aplicación |
| tipo_problema | hardware | Computador o hardware |
| tipo_problema | red | Internet o conexión de red |
| tipo_problema | otro | Otro |
| prioridad | baja | Baja |
| prioridad | media | Media |
| prioridad | alta | Alta |

## Reglas

- La validación se hace en el navegador y también en el servidor.
- El formulario se autoguarda mientras el usuario escribe.
- Al enviar, el borrador se convierte en un envío definitivo.