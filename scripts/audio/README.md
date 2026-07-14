# Audio local

`generate-audio.mjs` crea efectos y tres pistas musicales WAV mono de 22.05 kHz a partir de osciladores y ruido determinista.
No descarga muestras ni requiere dependencias. Los bucles de motor y terreno se mezclan en Web Audio;
los demás archivos son efectos de una sola reproducción.

```sh
npm run generate:audio
```

Los sonidos y la música son composiciones originales generadas para el proyecto,
sin muestras de terceros, y se sirven desde `/audio/` en el mismo origen.
