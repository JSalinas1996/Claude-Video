---
workflow: general-video
flow: companion
storyboard: yes
message: "De la fachada a tu casa: departamentos de 59 m² de Iurban en 59 e/ 9 y 10"
destination: instagram-feed
aspect: 1080x1350
language: es
audience: compradores e inversores de departamentos en La Plata
length: 26.6s
angle: muestra de renders estilo desarrolladora — fachada, cruce del vidrio, recorrido interior, programa, contacto
---

## Intent

Pieza para feed de Instagram "de la manera más profesional, como hacen las desarrolladoras para la
muestra de renders, no un video básico". Sin música. Corrección de color para que fachada, recorrido
y renders interiores se lean como una sola pieza.

## Assets

- assets/images/fachada-noche.jpg — fachada con luces encendidas (combina con el interior).
- assets/video/recorrido.mp4 — recorrido original 2560×1802, 60 fps, 12,07 s (NO versionado: 106 MB).
  Fuente: https://drive.google.com/file/d/1TiGwsVdp_-RB0Pw8JWmOsw2MWg62BWtD/view
- assets/video/recorrido-4x5.mp4 — copia de trabajo derivada (NO versionada). Regenerar con:
  ffmpeg -i assets/video/recorrido.mp4 -vf "crop=1442:1802:(iw-1442)/2:0,scale=1080:1350:flags=lanczos,fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 12 -an assets/video/recorrido-4x5.mp4
- assets/images/cocina.jpg, assets/images/lavadero.jpg — renders interiores.
- assets/images/balcon.jpg — render 9 (comedor con ventanal al balcón), toma "02 Balcón".
- assets/images/logo-blanco.png — logo provisto por el usuario.

## Customizations

- Corrección de color (media-treatment canónico) sobre los 4 medios + viñeta y grano sutiles.
- Cruce del vidrio con sobreexposición/bloom/desenfoque animados (propiedades canónicas animables).
- CTA: "Consultá por WhatsApp" · 221 616-1752.

## Notes

- No mencionar artefactos/electrodomésticos. "Balcón" sin especificar frente/contrafrente.
- Datos: 1 dormitorio, 2 ambientes, 59 m² (unidad tipo del recorrido, confirmado por el usuario).
- En este contenedor no hay WebGL: snapshot/check necesitan --timeout 60000.

## Notas de render (contenedor sin GPU)

- La corrección de color está horneada en los assets (`assets/images/*-graded.jpg`, generados con el
  motor de HyperFrames) y en el video (`assets/video/recorrido-4x5-graded.mp4`, NO versionado).
  Los shaders WebGL en vivo trababan el render en software (~16 s/frame).
- Regenerar el video corregido desde la copia 4:5:
  ffmpeg -i assets/video/recorrido-4x5.mp4 -loop 1 -i assets/video/vignette-mask.png -filter_complex "[0:v]format=gbrp,lut3d=file=assets/video/grade_b.cube:interp=tetrahedral[a];[1:v]format=gbrp[m];[a][m]blend=all_mode=multiply:shortest=1,noise=alls=3:allf=t+u,format=yuv420p[o]" -map "[o]" -c:v libx264 -preset slow -crf 12 -an assets/video/recorrido-4x5-graded.mp4
  (máscara de viñeta: 1.0 en el centro → 0.86 en las esquinas, 1080×1350).
- Transiciones (cruce del vidrio, enfoques) con filtros CSS brightness/blur en vez de los efectos animables de color grading.
