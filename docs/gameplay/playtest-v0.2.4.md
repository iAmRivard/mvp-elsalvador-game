# Playtest de navegación y móvil v0.2.4

La validación automatizada no sustituye una prueba con personas. Este entorno no dispone de cinco
participantes ni teléfonos físicos, por lo que el playtest humano está **pendiente**. No se declaran
aprobadas metas de comprensión, comodidad o preferencia.

## Validación automática

- 56 archivos y 249 pruebas unitarias/de integración cubren navegación, superficies, marcadores,
  tutorial, misión, joystick, preferencias, combustible, checkpoints y softlocks.
- Playwright recorre Chrome de escritorio, Pixel 7 vertical y Pixel 7 horizontal. Verifica heading
  contradictorio, ruta/reincorporación, tutorial compacto, CTA de misión, joystick diagonal,
  frenado, reversa, Turbo, mapa general, estación, ruta A*, recarga y retorno a misión.
- La ejecución final completa terminó con **30 pruebas aprobadas y 15 omisiones intencionales** en
  3 minutos, sin fallos en ninguno de los tres perfiles.
- Los seis escenarios específicos de combustible pasan en los tres viewports y comprueban por
  geometría que la ayuda no cubre joystick ni acciones.
- `check:external-resources`, mapa, red vial y build operan sin servicios externos en runtime.

Estos resultados prueban contratos funcionales y de layout. No prueban fatiga, postura, vibración,
comprensión espontánea ni barras reales de navegador.

## Registro pendiente

| Sesión | Plataforma | Dispositivo objetivo       | Orientación | Participante | Estado    |
| ------ | ---------- | -------------------------- | ----------- | ------------ | --------- |
| P-01   | desktop    | teclado y mouse            | horizontal  | —            | pendiente |
| P-02   | desktop    | portátil                   | horizontal  | —            | pendiente |
| P-03   | mobile     | Android gama media         | vertical    | —            | pendiente |
| P-04   | mobile     | Android gama media         | horizontal  | —            | pendiente |
| P-05   | mobile     | teléfono de pantalla corta | ambas       | —            | pendiente |

## Protocolo

1. Abrir una partida nueva sin explicar marcador, ruta, misión, controles ni combustible.
2. Completar el tutorial y comenzar **La transmisión** sin expandir manualmente toda la bitácora.
3. Conducir por una curva, una calle paralela, un camino de tierra y una salida de ruta.
4. Usar joystick único en diagonal, frenar hasta cero, activar reversa, Turbo e interacción.
5. Reducir combustible a 20%, identificar la bomba, marcar la estación, llegar y recargar.
6. Confirmar que después de recargar vuelve la ruta de misión.
7. Rotar el teléfono, pausar, cambiar de pestaña y continuar; registrar cualquier entrada retenida.

## Preguntas

- ¿Hacia dónde entendiste que apuntaba el triángulo?
- ¿La flecha de navegación coincidía con la ruta?
- ¿Supiste cuándo debías reincorporarte?
- ¿Un camino de tierra parecía transitable?
- ¿El tutorial tapaba información?
- ¿Supiste dónde estaba tu vehículo?
- ¿Encontraste el botón para iniciar la misión?
- ¿El joystick único fue más cómodo?
- ¿Pudiste acelerar, frenar y girar sin pensar demasiado?
- ¿Supiste dónde recargar combustible?
- ¿Pudiste marcar una estación sin ayuda?

## Criterio humano

- 5/5 identifican al jugador.
- 5/5 distinguen ruta y dirección recomendada.
- 4/5 prefieren o comprenden el joystick único.
- 4/5 inician la misión sin ayuda.
- 4/5 encuentran una estación.
- 0/5 reportan contradicción entre triángulo y ruta.

La versión técnica puede desplegarse para realizar estas sesiones, pero el criterio humano seguirá
pendiente hasta adjuntar cinco registros completos.
