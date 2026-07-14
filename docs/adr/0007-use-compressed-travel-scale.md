# ADR 0007: usar una escala de viaje comprimida

- Estado: aceptado.
- Contexto: las distancias reales entre ciudades son demasiado largas para una sesion web y subir
  solamente la velocidad del HUD degrada la lectura y el manejo.
- Decision: conservar una velocidad vehicular comprensible y multiplicar solo el desplazamiento
  geografico por una escala central, inicialmente 5. Combustible se calcula antes de aplicar la
  escala; el odometro registra la distancia geografica recorrida.
- Alternativas: reducir coordenadas rompe la cartografia real; teletransportar entre zonas elimina
  exploracion; mostrar velocidades extremas oculta el problema sin mejorar referencias cercanas.
- Consecuencias: deteccion, rutas y descubrimientos operan en coordenadas reales a mayor ritmo. La
  red vial futura debe balancear sus costos para esta escala y las pruebas deben impedir que el
  consumo se multiplique accidentalmente.
