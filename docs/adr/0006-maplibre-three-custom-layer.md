# ADR 0006: integrar Three.js como capa personalizada de MapLibre

- Estado: aceptado.
- Contexto: el vehículo y una señal de misión necesitan volumen, iluminación y animación sin
  duplicar mapa, cámara ni controles.
- Decisión: usar una capa personalizada 3D que comparte contexto y matriz con MapLibre. Three.js y
  los GLB se cargan de forma diferida; calidad baja o cualquier error conserva el marcador 2D.
- Alternativas: un segundo canvas complica sincronización y composición; reconstruir el mapa en
  Three.js duplica el motor; incrustar geometría WebGL manual reduce peso pero aumenta mantenimiento
  y elimina el flujo GLB.
- Consecuencias: el ciclo de vida debe limpiar recursos sin perder el contexto compartido y el
  renderer 3D debe restaurar su estado antes y después de dibujar. El build incorpora Three.js, pero
  queda separado de la carga inicial y sólo se solicita cuando el perfil lo habilita.
