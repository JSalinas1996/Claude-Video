---
workflow: general-video
flow: companion
storyboard: no
message: "Recorrido completo del departamento de 59 m² de Iurban en 59 e/ 9 y 10"
destination: instagram-stories
aspect: 1080x1920
language: es
length: 32.6s
---

## Intent

Historias de Instagram: fachada → cruce del vidrio → recorrido en video → renders (balcón, cocina,
lavadero, dormitorio) → ficha 59 m² → contacto. Sin música. Color parejo entre video y renders.

## Assets

- assets/images/fachada.jpg — fachada iluminada (corregida).
- assets/images/{living,balcon,cocina,lavadero,dormitorio}.jpg — renders 13, 12, 7, 8, 11 igualados a una
  misma familia de color (balance hacia 12/13 + viñeta + grano con semilla 59). Originales en assets/src/.
- assets/video/recorrido.mp4 — original 2560×1802 (NO versionado, 106 MB):
  https://drive.google.com/file/d/1TiGwsVdp_-RB0Pw8JWmOsw2MWg62BWtD/view
- assets/video/recorrido-9x16.mp4 — derivado (NO versionado). Regenerar:
  ffmpeg -i assets/video/recorrido.mp4 -loop 1 -i assets/video/vignette-9x16.png -filter_complex "[0:v]crop=1013:1802:(iw-1013)/2:0,scale=1080:1920:flags=lanczos,fps=30,format=gbrp,lut3d=file=assets/video/match_renders.cube:interp=tetrahedral[a];[1:v]format=gbrp[m];[a][m]blend=all_mode=multiply:shortest=1,noise=alls=3:allf=t+u,format=yuv420p[o]" -map "[o]" -c:v libx264 -preset slow -crf 13 -an assets/video/recorrido-9x16.mp4
- match_renders.cube — curva medida igualando los frames inicial/final del video con los renders 13/12.

## Notes

- Sin GPU en el contenedor: nada de color grading WebGL en vivo; transiciones con filtros CSS.
- No mencionar artefactos. "Balcón" sin frente/contrafrente. Datos: 59 m², 1 dormitorio, 2 ambientes.
