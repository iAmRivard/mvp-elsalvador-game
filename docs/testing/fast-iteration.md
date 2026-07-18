# Iteración rápida de pruebas

Este flujo conserva los comandos completos de publicación, pero evita ejecutar
la matriz completa durante cada cambio pequeño. Los perfiles enfocados usan
solo `chromium-mobile`, un worker, cero reintentos y detienen la ejecución tras
el primer fallo.

## Comandos

| Comando                        | Alcance                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `npm run test:unit:changed`    | Pruebas Vitest afectadas por cambios sin commit; pasa si no hay pruebas relacionadas. |
| `npm run test:unit:branch`     | Pruebas Vitest afectadas desde `origin/main`; pasa si no hay pruebas relacionadas.    |
| `npm run test:e2e:smoke`       | Ocho escenarios móviles esenciales etiquetados `@smoke`.                              |
| `npm run test:e2e:camera`      | Escenarios `@camera` de seguimiento, proyección y viewport seguro.                    |
| `npm run test:e2e:map`         | Escenarios `@map` de carga, rutas y legibilidad.                                      |
| `npm run test:e2e:last-failed` | Últimos fallos de Playwright en el proyecto móvil.                                    |
| `npm run check:fast`           | Typecheck, unitarias afectadas y smoke móvil.                                         |
| `npm run check:branch`         | Lint, typecheck, unitarias afectadas desde `origin/main` y smoke móvil.               |
| `npm run check:release`        | `npm run check` completo y la matriz Playwright completa.                             |

Los perfiles E2E enfocados generan primero un build de producción actualizado.
Esto evita servir un `dist` de otro SHA y mantiene la medición del navegador
separada del servidor de desarrollo.

## Política de uso

### Bucle interno

Después de un cambio pequeño:

1. Ejecutar de uno a tres archivos unitarios directamente relacionados.
2. Ejecutar como máximo un archivo E2E o uno de los perfiles enfocados.
3. Mantener un worker, cero reintentos y `max-failures=1`.
4. Procurar terminar en menos de 120 segundos.

No ejecutar aquí la matriz completa, PWA, escritorio, landscape, Docker,
capturas largas ni repeticiones masivas.

### Checkpoint

Al cerrar una hipótesis, ejecutar `npm run check:fast`.

### Gate de rama

Después de completar todos los cambios enfocados, ejecutar una vez
`npm run check:branch`, seguido de los perfiles `camera` y `map`.

### Gate de publicación

Ejecutar una sola vez `npm run check:release`. Solo después se valida Docker y
GitHub Actions sobre el mismo SHA.

Un escenario inestable puede repetirse hasta tres veces durante el desarrollo.
Tras el tercer fallo se guarda trace y screenshot, se clasifica como producto,
prueba o entorno, y deja de repetirse hasta corregir la causa.

## Etiquetas Playwright

- `@smoke`: recorrido esencial que bloquea el bucle corto.
- `@camera`: seguimiento, proyección, cadencia o viewport seguro.
- `@map`: estilo, etiquetas, símbolos o legibilidad.
- `@mobile`: interacción táctil o viewport móvil.
- `@navigation`: ruta y maniobra.
- `@release`: parte de la matriz completa.
- `@performance`: recopila o valida métricas de costo.
