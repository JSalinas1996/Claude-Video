# Gastos

Google Sheet + una web app de Apps Script que:

- recibe gastos desde un atajo de iPhone (`doPost`),
- importa sola los pagos con dinero en cuenta de Mercado Pago que llegan por mail (cada 15 min),
- muestra un panel con totales por mes, categoría y medio de pago, con alta y borrado manual (`doGet`).

```
apps-script/Code.gs              backend (pegar en el editor de Apps Script)
apps-script/Index.html           panel
scripts/importar_historico.py    Presupuesto_mensual.xlsx → Gastos.xlsx (hoja Movimientos)
```

## Puesta en marcha

1. Subir `Gastos.xlsx` a Google Drive → abrirlo con Hojas de cálculo → **Archivo → Guardar como Hojas de cálculo de Google**. La hoja `Movimientos` trae el histórico de mayo a octubre de 2026. El xlsx no está en el repo porque tiene datos personales.
2. **Extensiones → Apps Script**. Reemplazar `Código.gs` por `Code.gs`; crear un archivo HTML llamado `Index` y pegar `Index.html`. Guardar.
3. Elegir la función `setup` → **Ejecutar** → aceptar permisos (Sheets, Gmail, triggers). En **Registro de ejecución** aparece `TOKEN: …`; copiarlo.
4. **Implementar → Nueva implementación → Aplicación web**: *Ejecutar como*: yo; *Quién tiene acceso*: **Cualquier usuario**. Copiar la URL `…/exec`.
   El acceso "cualquier usuario" es necesario para que el atajo pueda enviar datos sin login; lo que protege los datos es el token.
5. Panel: abrir `URL/exec?k=TOKEN` en Safari → Compartir → **Agregar a inicio**.

Después de actualizar a la versión con pestañas (v3), ejecutar una vez `corregirHistorico` desde el editor: agrega el ahorro de agosto que estaba cargado a mano en el Excel y los USD comprados por mes.

Al cambiar el código: **Implementar → Administrar implementaciones → editar → Versión nueva** (así la URL no cambia).

## Atajo de iPhone "Registrar gasto"

Acciones, en orden:

1. **Pedir entrada** — Número — "¿Cuánto?"
2. **Pedir entrada** — Texto — "¿En qué?"
3. **Obtener contenido de URL** — `URL/exec?k=TOKEN&action=config`
4. **Obtener valor de diccionario** — `categorias` → **Elegir de la lista** ("Categoría")
5. **Obtener valor de diccionario** — `medios` del paso 3 → **Elegir de la lista** ("Medio")
6. **Obtener contenido de URL** — `URL/exec`, Método **POST**, Cuerpo **JSON**:
   `k` = TOKEN, `monto` = Entrada 1, `descripcion` = Entrada 2, `categoria` = Elemento elegido (4), `medio` = Elemento elegido (5)
7. **Obtener valor de diccionario** `mensaje` → **Mostrar notificación**

Si en el paso 4 no querés elegir, poné la categoría vacía: el servidor reusa la del último gasto con la misma descripción o aplica las reglas de `REGLAS`.

**Automatización:** Atajos → Automatización → Nueva → **App** → Mercado Pago → **Se cierra** → Ejecutar de inmediato → Registrar gasto.
Se dispara cada vez que cerrás la app, aunque no hayas pagado: cancelás en el primer paso.

## Reglas de datos

- **Saldo disponible** = último "Ajustar saldo" + ingresos − gastos registrados después. Los consumos con tarjeta de crédito no lo mueven hasta que se paga el resumen: después de pagarlo, ajustá el saldo.
- **Consumo** excluye la categoría 💰 Ahorro USD; el ahorro se muestra aparte (pestaña Ahorros). Resultado del mes = ingresos − consumo − ahorro.

- `Mes` es el mes de presupuesto. Para la tarjeta es el mes del resumen, no el de la compra.
- Los pagos con **tarjeta de crédito** hechos por Mercado Pago no se importan del mail: ya vienen en el resumen. Al registrarlos con el atajo, usá medio "Tarjeta de crédito" solo si no vas a cargar el resumen; si no, se duplican.
- Resumen de tarjeta mensual: pegar las filas categorizadas en `Movimientos` con `Medio` = Tarjeta de crédito y `Mes` = mes del resumen (como texto, ej. `'2026-11`).
- Mercado Pago no manda mail de transferencias ni de pagos con QR (revisado en Gmail). Se puede probar activarlos en <https://www.mercadopago.com.ar/communication-preferences>.

## Regenerar el histórico

```
python3 scripts/importar_historico.py Presupuesto_mensual.xlsx Gastos.xlsx
```

Toma las hojas `Mayo 26` en adelante (las anteriores tienen otro formato) e incluye ingresos, gastos fijos y resumen de tarjeta.
