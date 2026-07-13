# ADR 0004: autonomía en tiempo de ejecución

- Estado: aceptado.
- Contexto: el juego debe seguir funcionando sin proveedores cartográficos, CDNs o APIs externas.
- Decisión: todo recurso de runtime se versiona y sirve desde el mismo origen; una validación
  automática rechaza URLs externas.
- Alternativas: CDNs reducen el repositorio, pero introducen disponibilidad, privacidad y cambios
  ajenos.
- Consecuencias: el build es más pesado y cada recurso debe tener licencia y actualización.
