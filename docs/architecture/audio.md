# Audio local

El audio usa Web Audio y diez archivos WAV del mismo origen. `GameAudioBridge` traduce cambios
limitados del store y la telemetría en una API imperativa; el motor no vive en React ni reinicia
fuentes durante cada frame.

## Ciclo de vida

1. La aplicación registra una interacción de teclado o puntero antes de llamar `unlock()`.
2. Se crea un único `AudioContext`, se descargan y decodifican los WAV locales y se inician tres
   bucles silenciosos: ralentí, marcha y terreno.
3. Ganancia y velocidad de reproducción cambian con `setTargetAtTime`, con una transición de 120 ms.
4. Turbo, frenado, misión, objetivo, combustible, descubrimiento e interferencia usan fuentes
   breves con un enfriamiento de 600 ms.
5. Al desmontar la aplicación se detienen bucles, se liberan buffers y se cierra el contexto. Un
   fallo de carga ejecuta la misma limpieza y deja el juego funcional en silencio.

El navegador nunca recibe una orden de reproducción antes del gesto del usuario. Las URLs se
validan para comenzar en `/`, rechazar `//` y terminar en `.wav`; la auditoría de recursos también
impide incorporar un dominio externo.

## Mezcla y preferencias

Las preferencias versionadas incluyen volumen general, volumen de efectos, silencio y reducción de
efectos. El volumen general controla toda la mezcla; el de efectos controla señales de una sola
reproducción. Reducir efectos atenúa turbo, frenado e interferencia, y omite el bucle de terreno. El
motor se silencia mientras el juego está pausado.

El perfil predeterminado usa 70 % de volumen general y 80 % de efectos. Los valores cargados se
limitan al intervalo `0..1`; documentos de preferencias v1 a v3 reciben estos valores sin perder sus
ajustes visuales.

## Recursos

Los diez archivos de `public/audio` ocupan 384,112 bytes en total. Son PCM mono a 22.05 kHz,
originales y generados de forma determinista por `npm run generate:audio`. El script no descarga
material ni requiere una biblioteca adicional. `tests/audioAssets.test.ts` valida cabecera, tamaño y
URL local de cada recurso.
