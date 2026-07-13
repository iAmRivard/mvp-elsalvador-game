# Modelos locales

`expedition-vehicle.glb` y `suchitoto-signal.glb` son recursos originales generados con geometría
primitiva de Three.js. No contienen texturas, referencias externas ni material de terceros.

Para reconstruirlos:

```sh
npm run generate:models
```

El vehículo usa metros y apunta hacia `-Y`. La capa personalizada aplica posición, rumbo y escala
de pantalla. La baliza representa el objetivo interactivo `investigar-senal` de Suchitoto.
