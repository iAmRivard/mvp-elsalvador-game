# Ubicaciones iniciales

Las coordenadas se verificaron antes de incorporarlas. Wikidata se utilizó para ciudades y relieves
con una entidad inequívoca; para El Tunco se contrastó el Geographic Names Server y para Coatepeque
el registro de GeoNames. Los valores se almacenan como `[longitud, latitud]`.

| Ubicación                       | Coordenadas                 | Referencia                            |
| ------------------------------- | --------------------------- | ------------------------------------- |
| San Salvador                    | `[-89.191111, 13.697500]`   | Wikidata Q3110                        |
| Santa Ana                       | `[-89.556667, 13.994722]`   | Wikidata Q739664                      |
| San Miguel                      | `[-88.177222, 13.480278]`   | Wikidata Q672458                      |
| Santa Tecla                     | `[-89.288611, 13.673611]`   | Wikidata Q723246                      |
| Repetidor de Las Delicias       | `[-89.3175451, 13.6820687]` | Punto narrativo sobre la red vial OSM |
| Estación abandonada de El Congo | `[-89.447361, 13.8408999]`  | Punto narrativo sobre la red vial OSM |
| Suchitoto                       | `[-89.025833, 13.936667]`   | Wikidata Q2779509                     |
| El Tunco                        | `[-89.381389, 13.492222]`   | GNS 6239790                           |
| Lago de Coatepeque              | `[-89.546389, 13.863611]`   | GeoNames 3587138                      |
| Lago de Ilopango                | `[-89.050000, 13.666667]`   | Wikidata Q14638420                    |
| Volcán de Santa Ana             | `[-89.630000, 13.852778]`   | Wikidata Q1049338                     |
| Volcán de San Salvador          | `[-89.293889, 13.733889]`   | Wikidata Q2577068                     |
| Cerro Verde                     | `[-89.622581, 13.826411]`   | Wikidata Q1056001                     |
| Volcán de Conchagua             | `[-87.845000, 13.275000]`   | Wikidata Q2661919                     |

Las dos estaciones son ubicaciones ficticias del capítulo colocadas sobre nodos transitables del
snapshot vial; no afirman la existencia de instalaciones reales. Las demás coordenadas representan
un punto de referencia jugable, no límites administrativos ni rutas de acceso. Los radios de
descubrimiento compensan el tamaño físico de lagos, ciudades y complejos volcánicos. No se realiza
ninguna consulta a estas fuentes durante la ejecución.

En zoom lejano se muestran sólo iconos; zoom medio usa nombres cortos y zoom cercano habilita nombre
completo y estado. El layout limita etiquetas, aplica prioridad, colisión, clamping y offset por pitch.
El popup calcula distancia y permite marcar ruta para ubicaciones desbloqueadas.

Los puntos de combustible forman una categoría separada y narrativa: San Salvador
`[-89.193303, 13.699119]`, Las Delicias y El Congo. Usan bomba y verde exclusivos, aparecen en la
leyenda y no representan comercios reales. Su disponibilidad, radio y recarga se documentan en
`docs/gameplay/fuel-balance.md`.
