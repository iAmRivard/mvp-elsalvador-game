# ADR 0006 — Usar una red vial local

- Estado: aceptado.
- Fecha: 2026-07-13.

## Contexto

Las líneas directas no comunican una experiencia de conducción y un servicio público de rutas
rompería la autonomía, la CSP y la operación sin credenciales del proyecto.

## Decisión

Versionar un grafo compacto derivado de OpenStreetMap para el corredor occidental. Se genera con
`osmium-tool`, se valida por checksum, se carga bajo demanda y usa un índice de cuadrícula propio.
El artefacto conserva solo datos necesarios para detección y A*. El enrutamiento usa A* local con
sentidos, cierres y fallback directo fuera de cobertura.

## Consecuencias

Las rutas y la asistencia funcionan sin red externa y son reproducibles. El repositorio aumenta en
aproximadamente 5.5 MiB y actualizar carreteras requiere ejecutar y revisar el pipeline local. Fuera
del corredor, las misiones deben conservar un fallback explícito.
