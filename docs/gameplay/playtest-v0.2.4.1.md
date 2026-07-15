# Validación móvil v0.2.4.1

La automatización no sustituye la prueba en el teléfono del video. Este entorno no puede operar ese
dispositivo ni atribuir resultados humanos, por lo que comodidad, fatiga y metas 4/5–5/5 continúan
**pendientes** hasta ejecutar el protocolo físico.

## Reproducción de referencia

El falso offroad se reprodujo con estado controlado en `[-89.1913911, 13.6957937]`. La vía urbana
quedaba a 48.47 m del edge 2988: entraba en la búsqueda amplia de 52 m, pero la aceptación inmediata
de 36 m podía descartarla. Una muestra fallida cambiaba de superficie sin memoria.

La superposición se reprodujo iniciando **La transmisión** detenido y orientado contra la ruta. El
Marker de maniobra partía en la coordenada del jugador y el marcador físico quedaba visualmente
debajo. Ambos casos están fijados por pruebas unitarias y Playwright.

## Evidencia automática

- Vitest cubre incremento, centro, giro aislado, frenado, reversa, Turbo y limpieza segura.
- La red vial cubre un miss, cuarto miss, timeout, recuperación, `road-unclassified`, offroad real y
  el punto urbano del video.
- Navegación cubre look-ahead, fallback, reincorporación y supresión real de guía en reversa.
- Interfaz cubre mini navegador, auto-colapso, sheet 55%/85%, prioridad de overlays y radio compacta.
- Combustible cubre 75%, 30%, 20%, ruta temporal, guardado v4, recarga y retorno a misión.
- Playwright se ejecuta en escritorio, Pixel 7 vertical y Pixel 7 horizontal.
- `npm run check`, `npm run test:e2e` y Docker son obligatorios antes del tag.

## Protocolo físico obligatorio

Usar el mismo teléfono y orientación del archivo de referencia:

1. Comenzar una expedición nueva e iniciar **La transmisión**.
2. Subir el objetivo, soltar el joystick y conducir cinco minutos sin sostenerlo.
3. Girar a ambos lados con gesto horizontal y registrar cualquier cambio no solicitado del objetivo.
4. Frenar hasta cero, mantener abajo y comprobar la entrada retardada de reversa.
5. Confirmar que en reversa no hay chevrón, tramo inmediato ni mensaje de avance.
6. Recorrer las calles del video, cruzar intersecciones y registrar cualquier alternancia offroad.
7. Salir realmente de la vía y regresar para comprobar timeout y recuperación.
8. Abrir **Ver objetivo**, probar sheet medio/expandido y cerrarlo mientras se conduce.
9. Recibir radio y descubrimiento; comprobar mapa, joystick, Turbo e interacción.
10. Probar 75%, 30% y 20%, marcar estación, guardar, recargar la página y volver a misión.
11. Repetir los puntos críticos en vertical y horizontal.

Registrar dispositivo, versión de Android/navegador, orientación, duración, temperatura aproximada,
FPS percibido, toques fallidos y respuestas a estas preguntas:

- ¿Se mantiene la marcha sin sostener el joystick?
- ¿Girar cambia accidentalmente la velocidad?
- ¿La misión o radio tapa mapa o controles?
- ¿La maniobra permanece visible y se distingue del vehículo?
- ¿Aparece offroad sobre una calle?
- ¿La bitácora deja mapa suficiente?
- ¿Se entiende cuándo buscar combustible?

## Metas humanas pendientes

- 5/5 comprenden la mini navegación.
- 4/5 prefieren velocidad objetivo frente a throttle continuo.
- 0/5 reproducen offroad falso en el recorrido.
- 5/5 distinguen vehículo y chevrón.
- 0/5 ven guía de avance en reversa.
- 4/5 conducen cinco minutos sin fatiga excesiva.
- 0/5 pierden controles por un overlay.
- 4/5 comprenden cuándo buscar combustible.

No marcar estas metas como aprobadas con resultados headless. Adjuntar el registro del teléfono a
este documento antes del visto bueno humano.
