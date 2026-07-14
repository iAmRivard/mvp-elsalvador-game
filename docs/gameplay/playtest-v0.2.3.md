# Playtest de flujo narrativo v0.2.3

La validación automatizada no sustituye una prueba con personas. Este entorno no dispone de cinco
participantes ni dispositivos físicos, por lo que el playtest humano está **pendiente** y no se
declaran metas de percepción como aprobadas.

## Registro por participante

```ts
export interface StoryFlowPlaytest {
  device: string;
  platform: 'mobile' | 'desktop';
  understoodPremise: boolean;
  completedFirstMissionWithoutHelp: boolean;
  startedSecondMissionWithoutHelp: boolean;
  noticedTimer: boolean;
  understoodFuelPurpose: boolean;
  understoodRouteChoice: boolean;
  reportedBlockedInput: boolean;
  requestedHelpAt: string[];
  comments: string[];
}
```

| Sesión | Plataforma | Dispositivo        | Participante | Estado    |
| ------ | ---------- | ------------------ | ------------ | --------- |
| P-01   | desktop    | teclado y mouse    | —            | pendiente |
| P-02   | desktop    | portátil           | —            | pendiente |
| P-03   | mobile     | Android vertical   | —            | pendiente |
| P-04   | mobile     | Android horizontal | —            | pendiente |
| P-05   | mobile     | teléfono distinto  | —            | pendiente |

## Protocolo

1. Abrir una partida nueva sin explicar historia, controles ni misión siguiente.
2. Observar desde **La transmisión** hasta el timer de **Camino bloqueado**.
3. No intervenir salvo que la persona declare que no puede continuar; registrar el momento exacto.
4. Pedir que guarde, recargue y confirme que conserva ruta y tiempo.
5. Repetir una vez con combustible bajo y mostrar recuperación sólo si la encuentra.

Preguntar al terminar: quién enviaba la señal, por qué viajaba al occidente, qué seguía después de
la primera misión, qué diferenciaba las rutas, para qué servía el combustible, si vio el timer, si
la música ayudó y si en algún momento creyó que el mouse o toque estaba bloqueado.

## Validación automática

Playwright recorre el flujo en escritorio, Pixel 7 vertical y Pixel 7 horizontal. Comprueba premisa,
CTA compacto, `E`, radio sin pausa, continuación, inspección, elección, cuenta regresiva, geometría
del timer, consumo visible, música cronometrada, persistencia, ausencia de solicitudes externas y
reset con red vial montada. Las simulaciones unitarias cubren rutas, combustible y softlock.

El 14 de julio de 2026, el bundle de producción obtuvo **24 pruebas aprobadas y 15 omisiones
intencionales** por perfil en 2.7 minutos. No hubo fallos ni solicitudes a terceros.

Estos resultados prueban contratos funcionales y de layout, no comprensión humana, fatiga,
audibilidad en altavoces reales ni percepción de urgencia.

## Criterio de aprobación humana

- 4/5 comprenden premisa, elección y propósito del combustible.
- 4/5 completan la primera misión e inician la segunda sin ayuda.
- 5/5 ven el temporizador.
- 0/5 reportan input aparentemente bloqueado.
- La música no oculta radio, motor ni señales en ningún dispositivo.

La versión técnica puede desplegarse para obtener estas sesiones, pero el criterio humano seguirá
pendiente hasta adjuntar cinco registros completos.
