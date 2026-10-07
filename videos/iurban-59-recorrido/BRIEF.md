---
workflow: general-video
flow: companion
storyboard: yes
message: "De la fachada a tu casa: departamentos de 59 m² de Iurban en 59 e/ 9 y 10"
destination: instagram-feed
aspect: 1080x1350
language: es
audience: compradores e inversores de departamentos en La Plata
length: 24s
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
- assets/images/logo-blanco.png — logo provisto por el usuario.

## Customizations

- Corrección de color (media-treatment canónico) sobre los 4 medios + viñeta y grano sutiles.
- Cruce del vidrio con sobreexposición/bloom/desenfoque animados (propiedades canónicas animables).
- CTA: "Consultá por WhatsApp" · 221 616-1752.

## Notes

- No mencionar artefactos/electrodomésticos. "Balcón" sin especificar frente/contrafrente.
- Datos: 1 dormitorio, 2 ambientes, 59 m² (unidad tipo del recorrido, confirmado por el usuario).
- En este contenedor no hay WebGL: snapshot/check necesitan --timeout 60000.
