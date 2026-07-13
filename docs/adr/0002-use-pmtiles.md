# ADR 0002: usar PMTiles

- Estado: aceptado.
- Contexto: los mosaicos deben alojarse con la SPA sin desplegar un servidor de tiles.
- Decisión: distribuir un único PMTiles local con soporte de HTTP Range.
- Alternativas: miles de archivos MVT complican despliegue y caché; MBTiles necesita servicio o
  soporte específico del servidor.
- Consecuencias: Nginx debe conservar Range Requests y el artefacto se gestiona con Git LFS.
