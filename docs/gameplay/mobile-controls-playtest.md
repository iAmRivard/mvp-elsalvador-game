# Playtest de controles móviles v0.2.2

Este documento separa la validación automatizada de la prueba física. Playwright comprueba contratos
de entrada, layout y recuperación, pero no sustituye la fatiga, el agarre, las barras reales del
navegador, la vibración ni la percepción de cinco personas.

## Contrato de resultados

```ts
export interface MobilePlaytestResult {
  device: string;
  browser: string;
  orientation: 'portrait' | 'landscape';
  controlMode: 'joystick-pedals' | 'joystick-auto-throttle' | 'classic-buttons';
  completedTutorial: boolean;
  completedFirstMission: boolean;
  minutesToCompleteFirstMission: number;
  preferredJoystickSize: string;
  preferredSensitivity: string;
  difficulties: string[];
  comments: string[];
}
```

Guardar un registro por persona y orientación. No combinar dos sesiones en un único resultado.

## Estado de validación

El 14 de julio de 2026 se ejecutó el build de producción con Chromium Playwright en escritorio,
Pixel 7 vertical, Pixel 7 horizontal y contextos DPR 2/3. El resultado final fue **20 aprobados y
13 omitidos** en 2.1 minutos; las omisiones corresponden a casos limitados a otro perfil.

| Perfil automatizado     | Orientación | Cobertura principal                                      | Resultado |
| ----------------------- | ----------- | -------------------------------------------------------- | --------- |
| Chrome 1280x800         | horizontal  | teclado, tutorial, misión, routing, canvas y autonomía   | aprobado  |
| Pixel 7 emulado 412x839 | vertical    | AUTO, Turbo por toque, freno, recuperación y layout      | aprobado  |
| Pixel 7 emulado 863x360 | horizontal  | dos pulgares, rotación, menú compacto, layout y capítulo | aprobado  |
| Chromium DPR 2 y DPR 3  | vertical    | arranque MapLibre y ausencia de solicitudes de sprite    | aprobado  |

Playwright combina crucero, joystick y toque de Turbo sin sostener acelerador. Esto confirma
separación de IDs, captura de puntero y que MapLibre no recibe el gesto, pero no reproduce con fidelidad la
presión, superficie de contacto o postura de dos dedos reales.

## Hallazgos corregidos

- Los dispositivos con DPR 2 solicitaban un sprite vacío `@2x`; se eliminó la dependencia y se
  valida que no exista ninguna solicitud en DPR 2/3.
- Turbo móvil dejó de ser sostenido y ahora dura 2.5 segundos con cooldown de 1.8 segundos.
- El freno cancela simultáneamente AUTO y Turbo; pausa, blur, visibilidad y rotación limpian todo.
- La cabecera móvil usa **Rutas Perdidas**, región compacta y menú `⋯` para acciones secundarias.
- El marcador del jugador se agregaba antes de tener coordenadas iniciales en algunos arranques.
- Dos solicitudes consecutivas de ruta podían cancelar la vigente y activar el fallback.
- El foco del diálogo narrativo podía desplazar internamente `#root` y recortar la interfaz.
- La bitácora, el HUD y los controles se cruzaban en alturas móviles reducidas.
- La atribución compacta de MapLibre iniciaba expandida sobre los pedales.

Todos estos casos tienen cobertura automática o una aserción geométrica asociada.

## Prueba física pendiente

Este entorno no tiene acceso a teléfonos, tabletas ni participantes. No se registran pruebas físicas
como realizadas. Antes de considerar cerrado el playtest humano deben completarse estas cinco filas:

| Sesión | Persona | Dispositivo objetivo       | Navegador       | Orientación | Modo               | Estado    |
| ------ | ------- | -------------------------- | --------------- | ----------- | ------------------ | --------- |
| P-01   | —       | Android gama media         | Chrome          | vertical    | joystick + crucero | pendiente |
| P-02   | —       | Android gama media         | otro disponible | horizontal  | joystick + crucero | pendiente |
| P-03   | —       | Tablet Android             | Chrome          | horizontal  | joystick + crucero | pendiente |
| P-04   | —       | teléfono de pantalla corta | Chrome          | vertical    | botones clásicos   | pendiente |
| P-05   | —       | teléfono Android distinto  | otro disponible | ambas       | libre elección     | pendiente |

## Protocolo

1. Abrir una sesión nueva sin explicar los controles y observar si completa el tutorial.
2. Conducir hasta activar la ruta del Repetidor de Las Delicias.
3. Tomar una curva cerrada, una bifurcación, una calle paralela y una salida voluntaria offroad.
4. Frenar durante el crucero, usar turbo y realizar una interacción contextual.
5. Hacer pan y pinch zoom fuera del joystick; confirmar que los controles no mueven el mapa.
6. Rotar la pantalla, cambiar de pestaña, volver y pausar mientras mantiene una entrada.
7. Visitar una estación, probar recuperación y completar la primera misión cuando el tiempo lo permita.
8. Registrar duración, preferencias, dificultades y comentarios sin suavizar los problemas.

Verificar en cada sesión:

- fatiga tras al menos diez minutos, tamaño y alcance de cada control;
- precisión parcial, retorno al centro y ausencia de dirección o aceleración atascada;
- safe areas, barras del navegador y rotación sin recortes ni scroll del documento;
- pinch zoom fuera del control, cámara, ruta, curvas, rotondas e intersecciones;
- offroad, agua, gasolineras, interacción, pausa, pérdida de foco y recuperación;
- respuesta háptica cuando exista y funcionamiento completo con vibración desactivada.

## Preguntas

- ¿Entendió cómo moverse sin ayuda?
- ¿El joystick se sintió preciso y regresó al centro?
- ¿Pudo conducir sin necesitar tres dedos?
- ¿AUTO se entendió y el freno lo canceló de forma predecible?
- ¿Turbo por toque se sintió útil durante 2.5 segundos?
- ¿El freno fue fácil de encontrar?
- ¿Usó el crucero y entendió cuándo se desactivó?
- ¿La cámara fue cómoda y pudo seguir la ruta?
- ¿Las curvas e intersecciones se sintieron justas?
- ¿Quedó atrapado o algún control permaneció activo?
- ¿Prefiere joystick fijo, flotante o cruceta?
- ¿Qué tamaño y sensibilidad elegiría para una sesión larga?

## Criterio de salida

El playtest físico queda aprobado cuando existan cinco resultados completos, no haya entradas
atascadas, todos puedan recuperar la partida y al menos cuatro personas completen la primera misión
sin instrucciones externas. Cualquier fallo de seguridad de input o bloqueo de progreso reabre la
versión antes del despliegue general.
