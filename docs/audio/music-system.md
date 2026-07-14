# Música adaptativa local

## Estados

| Estado        | Archivo                        | Uso                              |
| ------------- | ------------------------------ | -------------------------------- |
| `exploration` | `/audio/music-exploration.wav` | conducción sin misión            |
| `mission`     | `/audio/music-mission.wav`     | misión activa                    |
| `timed`       | `/audio/music-timed.wav`       | objetivo cronometrado            |
| `silent`      | —                              | recuperación o apagado explícito |

Las tres pistas se cargan y comienzan una sola vez después del desbloqueo de Web Audio. Cada cambio
usa una rampa de 1.5 segundos; las actualizaciones del timer cambian intensidad sin reiniciar la
pista.

## Mezcla

- `audioMasterVolume` controla la salida general.
- `audioEffectsVolume` controla vehículo y señales.
- `audioMusicVolume` controla música por separado.
- `musicMuted` silencia sólo música.
- Radio reduce música a `0.32×` y pausa/menú a `0.18×`, con restauración gradual.
- El estado cronometrado sube moderadamente de `0.72×` a `1×` al agotarse el tiempo.

## Procedencia y licencia

`scripts/audio/generate-audio.mjs` sintetiza osciladores y ruido determinista a 22.05 kHz mono. No
descarga ni incorpora muestras. Efectos y música son composiciones originales generadas para este
repositorio y pueden distribuirse con el proyecto bajo su misma licencia.

Cada pista pesa 529,244 bytes. Los catorce WAV suman 1,987,322 bytes y se sirven desde el mismo
origen. `npm run generate:audio` los reconstruye; `npm run check:external-resources` rechaza URLs
externas.
