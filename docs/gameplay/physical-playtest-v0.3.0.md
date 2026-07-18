# Guia de prueba fisica v0.3.0

## Estado

- Pendiente: la automatizacion no aprueba esta guia.
- Evidencia visual de referencia:
  `artifacts/five-minutes/final-3c2b65a/run-1..3`.
- Repetir en telefono la promocion de guia directa a linea cian: conducir en
  fallback, esperar la red vial, pausar/reanudar y confirmar que el paso 5 se
  completa manteniendo seguimiento real. El E2E de este caso sigue inestable.

## Preparacion

- Ideal: cinco personas que no conozcan los controles.
- No explicar joystick, Turbo, reversa ni reincorporacion antes de empezar.
- Registrar telefono, SO, navegador, PWA/navegador, bateria inicial, conexion,
  brillo, temperatura percibida y si reduced motion esta activo.
- Probar primero una partida nueva; despues un guardado anterior real o copia.
- No crear tag mientras esta validacion siga pendiente.

## Sesion por persona

### 1. Primeros cinco minutos

Observar sin intervenir:

- tiempo hasta tocar un control y hasta movimiento visible;
- si reconoce el vehiculo y la guia;
- si entiende la siguiente accion;
- si cierra narrativa/tutorial naturalmente;
- momentos inmovil, aburrido o confundido;
- primera maniobra, evento y recompensa;
- overlays simultaneos y legibilidad del mapa.

Preguntar solo despues: "Que pensabas que iba a ocurrir con tu primer gesto?"

### 2. Conduccion de 15 minutos

- Conducir en via principal, curva, calle secundaria, tierra y offroad.
- Usar Turbo al menos dos veces.
- Frenar y ejecutar reversa detener-soltar-volver a bajar.
- Abrir/cerrar radio y bitacora.
- Dejar que el vehiculo quede detenido para evaluar la ayuda.
- Usar `REINCORPORAR` cerca de una via y confirmar que no aparece lejos,
  dentro de objetivo offroad o zona restringida.
- Observar tirones, mareo, fatiga, pulgar, sonido, vibracion y calentamiento.

### 3. Garaje y vehiculos

- Abrir garaje desde titulo y pausa.
- Identificar Torogoz, Volcan GT y Coyote 4x4.
- Comparar stats sin explicacion.
- Intentar seleccionar un bloqueado.
- Cambiar vehiculo/skin desbloqueado, volver, recargar y confirmar persistencia.
- Preguntar si la diferencia de control, sonido y offroad se percibe.

### 4. Navegador y PWA

- Repetir recorrido corto en navegador normal.
- Instalar/abrir PWA y repetir con la misma partida.
- Activar modo avion despues de haber cargado una vez; confirmar shell,
  guardado, garaje, red vial y assets locales. El mapa PMTiles completo y la
  conduccion offline quedan fuera del contrato actual porque Range se excluye
  deliberadamente del service worker; documentar la experiencia observada y
  reconectar antes del recorrido.
- Volver a red y confirmar que una actualizacion no interrumpe mision activa.
- Probar orientacion vertical y landscape corto.

## Matriz minima

| Estado                      | Navegador                   | PWA         |
| --------------------------- | --------------------------- | ----------- |
| Partida nueva               | requerido                   | requerido   |
| Guardado antiguo            | requerido                   | requerido   |
| Arcade                      | requerido                   | requerido   |
| Target speed                | requerido                   | una persona |
| Joystick y pedales          | una persona                 | una persona |
| Botones clasicos            | una persona                 | una persona |
| Reduced motion              | una persona                 | una persona |
| Calidad baja/media/alta     | repartir entre dispositivos | repartir    |
| Combustible/condicion bajos | requerido                   | requerido   |
| Offroad/reincorporacion     | requerido                   | requerido   |
| Radio/bitacora/garaje       | requerido                   | requerido   |

Viewports de referencia: 360x800, 392x850, 412x915 y landscape corto.

## Registro tecnico

Cada cinco minutos anotar:

- bateria (%), temperatura si el sistema la expone y calor percibido 1-5;
- tirones observados y pausas largas;
- perdida de touch, toques dobles o input tardio;
- salida del vehiculo del viewport seguro;
- audio cortado, haptics molestos o vibracion continua;
- solicitudes externas observadas si se usa proxy local.

No comparar temperatura o bateria entre telefonos como si fueran equivalentes.

## Preguntas finales

1. Que fue lo primero que intentaste hacer?
2. En algun momento pensaste que el control no funcionaba?
3. Cual era tu vehiculo y cual era la guia?
4. La velocidad se sintio lenta, adecuada o dificil de controlar?
5. Donde mirabas para saber la siguiente accion?
6. Que tarjeta o elemento sobraba?
7. Entendiste como frenar y como entrar en reversa?
8. Cuando usarias reincorporacion?
9. Notaste diferencias entre vehiculos?
10. Quisiste seguir conduciendo? Por que?
11. Hubo mareo, fatiga, calor, audio o vibracion molestos?
12. Preferiste navegador o PWA?

## Criterio de salida

Consolidar problemas por frecuencia y severidad. Corregir cualquier P0/P1
reproducible y repetir el recorrido afectado. La automatizacion no puede marcar
como aprobadas diversion, comodidad, sonido real, haptics, bateria, temperatura,
mareo, fatiga ni legibilidad al sol.
