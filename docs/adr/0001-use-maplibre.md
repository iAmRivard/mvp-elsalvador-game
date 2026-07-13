# ADR 0001: usar MapLibre GL JS

- Estado: aceptado.
- Contexto: se necesita render vectorial WebGL, cámara inclinada y control completo del origen de
  datos sin una licencia propietaria.
- Decisión: MapLibre GL JS renderiza el mapa 2.5D y gestiona cámara y controles.
- Alternativas: Leaflet limita la experiencia 2.5D; Three.js obligaría a crear un motor de mapa;
  SDK propietarios contradicen la autonomía.
- Consecuencias: se requiere WebGL y limpieza explícita de listeners y recursos.
