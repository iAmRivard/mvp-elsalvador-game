# ADR 0005: despliegue Docker en Dokploy

- Estado: aceptado.
- Contexto: se requiere un despliegue repetible sin servicios adicionales.
- Decisión: build multi-stage Node/Vite y runtime Nginx sobre puerto 80, con `/healthz`.
- Alternativas: servir con Node aumenta superficie y consumo; Compose no aporta al contenedor
  único.
- Consecuencias: variables Vite cambian en build y el proxy debe conservar peticiones Range.
