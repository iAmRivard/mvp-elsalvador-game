# Manejo del vehículo

La v0.2 utiliza un modelo arcade sencillo. No simula neumáticos ni fuerzas rígidas: prioriza una
respuesta predecible con teclado y controles táctiles.

## Velocidad y escala

La velocidad del HUD representa el vehiculo y se convierte a km/h con
`abs(speedMetersPerSecond) * 3.6`. El desplazamiento cartografico utiliza una escala independiente:

```text
distancia geografica = velocidad * delta time * escala de viaje
```

La escala inicial es 5. A 26 m/s, el HUD muestra aproximadamente 94 km/h mientras el jugador
recorre 130 metros geograficos por segundo. Esto comprime un trayecto aproximado de 50 km a unos
6.5 minutos a velocidad maxima normal, antes de considerar curvas o detenciones.

El odometro guarda distancia geografica. El combustible se calcula con la distancia representada
del vehiculo, antes de aplicar la escala, para evitar multiplicar el consumo por cinco. El turbo
aplica su propio multiplicador de 1.35.

## Perfil inicial

| Parametro                  |       Valor |
| -------------------------- | ----------: |
| Velocidad maxima normal    |      26 m/s |
| Velocidad maxima con turbo |      38 m/s |
| Reversa maxima             |       8 m/s |
| Aceleracion                |      9 m/s2 |
| Frenado                    |     14 m/s2 |
| Desaceleracion libre       |      5 m/s2 |
| Giro base                  | 90 grados/s |

El giro requiere movimiento, se invierte en reversa y conserva 48 % de su autoridad base a la
velocidad maxima. La preferencia de direccion multiplica el giro por 0.78, 1 o 1.22. Teclado y
controles tactiles producen el mismo `PlayerInput`, por lo que comparten las reglas.

El delta de cada paso se limita a 50 ms. Pausar congela el runtime completo; alcanzar los limites
geograficos cancela distancia y combustible de ese paso y deja la velocidad en cero.

## Condicion y recuperacion

El vehiculo inicia con 100 puntos de condicion. Las vias pavimentadas no producen desgaste base;
una pista consume `0.012` puntos por metro representado y el terreno fuera de carretera `0.05`.
Golpear una restriccion resta 1.5 puntos, con 1.2 segundos de enfriamiento para evitar dano repetido
en cada frame. La distancia de desgaste se obtiene del odometro geografico dividida por la escala de
viaje, por lo que cambiar la compresion no altera accidentalmente el balance.

Al llegar a cero el game loop deja de aceptar aceleracion, frena el vehiculo y pausa la partida. El
jugador puede reintentar el ultimo checkpoint, volver al ultimo lugar seguro o abandonar la mision.
La misma recuperacion cubre combustible agotado, limite jugable y objetivos con tiempo fallidos.

Los objetivos de reparacion consumen una pieza y, cuando se define, energia. Los objetivos de carga
restauran combustible sin superar `maximumFuel`. Ambos efectos se aplican antes de crear el
checkpoint correspondiente.

## Superficie y combustible

Al cargar el corredor, el game loop recibe un contacto vial actualizado a 10 Hz. La clase limita la
velocidad objetivo entre 125 % en autopista y 40 % en pista; fuera de carretera usa 25 %. El consumo
varía entre 100 % en vías principales y 175 % fuera de carretera. Los cambios desaceleran con el
frenado normal en vez de cortar la velocidad instantáneamente.

## Asistencia

Los modos **Libre**, **Suave** y **Firme** cambian únicamente la corrección de posición y rumbo; las
reglas de superficie siguen activas. A 8 m o menos se aplica la fuerza completa y disminuye hasta 36
m. Después de 52 m el rastreador libera la arista. Mantener giro manual reduce la corrección al 28 %
para permitir una salida voluntaria. En controles táctiles la fuerza aumenta 18 %.

La posición se interpola como máximo 12 % por paso y nunca se teletransporta. El rastreador conserva
la arista actual mientras otra no sea al menos 7 m mejor, lo que evita oscilaciones en intersecciones.

## Restricciones

Polígonos locales simplificados protegen Coatepeque, Ilopango, Güija y el Pacífico. Entrar desde
tierra cancela movimiento, distancia y combustible del paso, detiene el vehículo y muestra una
señal visual. Una partida antigua que ya esté dentro de un polígono puede moverse para salir y no
queda atrapada. Los límites nacionales mantienen el mismo frenado seguro.
