# Audio local

`generate-audio.mjs` crea diez WAV mono de 22.05 kHz a partir de osciladores y ruido determinista.
No descarga muestras ni requiere dependencias. Los bucles de motor y terreno se mezclan en Web Audio;
los demás archivos son efectos de una sola reproducción.

```sh
npm run generate:audio
```

Los sonidos son recursos originales del proyecto y se sirven desde `/audio/` en el mismo origen.
