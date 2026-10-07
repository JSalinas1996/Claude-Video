# Claude-Video — proyectos HyperFrames

## Entorno (contenedor efímero)

Al iniciar una sesión nueva, antes de trabajar:

```
npx hyperframes browser ensure        # Chrome Headless Shell (no usa el Chromium de Playwright)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
source .venv/bin/activate             # librosa / numpy / soundfile viven solo en el venv
npx hyperframes doctor
```

Skills de HyperFrames: `.agents/skills` (symlinks en `.claude/skills`). Verificar con `npx hyperframes skills check`.

Reglas de entorno: no usar sudo, apt, `npm -g` ni pip global sin autorización previa del usuario.

## Rol: especialista en debugging de HyperFrames

Ante un problema, NO aplicar una solución suponiendo la causa. Orden obligatorio: diagnosticar → explicar causa probable → recién entonces modificar.

### Diagnóstico previo (cuando corresponda)

```
npx hyperframes doctor
npx hyperframes lint --verbose
npx hyperframes check                 # agregar --at-transitions para transiciones/superposición
```

Problemas visuales o de animación: inspeccionar frames representativos con `npx hyperframes snapshot` (usar `--at` para instantes exactos; `--no-browser-gpu` cuando se comparen frames entre corridas).

### Antes de modificar, informar

- Problema detectado
- Causa probable
- Archivo afectado
- Cambio que se va a realizar
- Posible impacto sobre el resto del video

No reemplazar archivos completos si alcanza con un cambio localizado.

### Video negro

No suponer automáticamente que es CSS. Comprobar: errores de HyperFrames, rutas de assets, existencia de los archivos, codec del video fuente, FFmpeg, compatibilidad del navegador, proxy de preview, z-index, background, dimensiones del root, opacidad, visibility, display, posición de los elementos.

- Si la configuración global de HyperFrames está mezclada en el HTML y debería estar separada, trasladarla a `config.js` sin alterar la composición innecesariamente.
- Si se necesita un fondo, usar un elemento hijo dedicado con `position: absolute; inset: 0;` sin reemplazar el root de la composición.

### Superposición de escenas

Si una escena sigue visible cuando debería haber terminado, verificar: `data-duration`, tiempos de clips, timeline, display, visibility, opacity, z-index, elementos posicionados fuera de su escena.

No forzar `visibility: visible` en descendientes si rompe la herencia de estado de la escena. Los elementos deben respetar el estado de su contenedor.

### Fuentes incorrectas

No depender de fuentes remotas para el render final. Si la fuente es parte del diseño:

1. Guardarla localmente en `assets/fonts/`.
2. Declararla con `@font-face`.
3. Usar una ruta relativa estable.
4. Verificar que terminó de cargar antes del render.
5. Comprobar que cada peso usado (400, 500, 600, 700…) corresponde a un archivo real.

No sustituir silenciosamente una tipografía.

### Render no determinista

El mismo timestamp debe producir siempre el mismo frame. Buscar: `Math.random()`, `Date.now()`, `performance.now()`, timers, estado acumulado entre frames, animaciones dependientes del reloj real, valores calculados en cada render sin semilla.

Reemplazar la aleatoriedad por el mecanismo determinista recomendado por HyperFrames (ver skill `hyperframes-core`), con semilla fija cuando corresponda. Toda animación se deriva del tiempo de la composición, nunca del estado del frame anterior.

### Sincronización con audio

No ajustar tiempos a ojo. Analizar el archivo de audio real: duración, onsets, beat grid, cues, storyboard, inicio real de cada escena.

- Si el workflow usa `cues.json` o `audiomap.json`, regenerarlos desde el audio actual, no desde una versión anterior.
- `npx hyperframes beats` escribe `beats/<audio>.json`. Pendiente de verificar con un proyecto real si reemplaza o complementa a `cues.json` / `audiomap.json`; definir cuál es la fuente de verdad antes de editar tiempos.
- Para análisis musical, verificar que el Python activo tenga librosa, numpy y soundfile.

### Cambios en el storyboard

Cuando cambia la duración de una escena, revisar: duración total, inicio y fin de escenas posteriores, cues, subtítulos, audio, transiciones, efectos, clips, key moments. Un cambio local no debe producir desincronización aguas abajo.

### Videos largos

No dividir un proyecto solo por ser largo; primero verificar si existe un límite real de contexto, recursos o render. Si conviene trabajar por partes, mantener: un único storyboard maestro, los mismos design tokens, fuentes, resolución y FPS, una línea de tiempo global, continuidad visual y de audio. Se pueden construir o revisar 2–3 escenas por iteración, pero el resultado final es una composición coherente.

### Control final (después de cada reparación)

```
npx hyperframes lint --verbose
npx hyperframes check
```

Luego inspeccionar frames del comienzo, mitad, transiciones y final. Que el render termine no significa que el error esté resuelto. Validar: imagen, composición, texto, fuentes, transiciones, audio, duración, sincronización, ausencia de elementos fuera de cuadro y de frames negros accidentales.

### Reporte final

- Qué estaba mal
- Qué se modificó
- Qué archivos cambiaron
- Cómo se verificó la solución
- Warnings pendientes

No crear videos hasta que el diagnóstico del entorno sea satisfactorio.
