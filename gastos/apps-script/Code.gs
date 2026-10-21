/**
 * Gastos — web app de Apps Script.
 *  doGet  → panel (Index.html) o configuración para el atajo (?action=config)
 *  doPost → alta de un gasto desde el atajo de iPhone
 *  importarMails → carga los pagos de Mercado Pago que llegan por mail (trigger cada 15 min)
 * Todo pide el token guardado en Propiedades del script (lo genera setup()).
 */

const TZ = 'America/Argentina/Buenos_Aires';
const HOJA = 'Movimientos';
const COLUMNAS = ['ID', 'Fecha', 'Mes', 'Tipo', 'Descripción', 'Monto', 'Categoría', 'Clase',
  'Subcategoría', 'Medio', 'Cuota', 'Origen', 'Creado'];
const COL = Object.fromEntries(COLUMNAS.map((c, i) => [c, i]));

const CATEGORIAS = ['🛒 Supermercado', '🍽 Comida/Delivery', '🚗 Transporte', '🏠 Hogar',
  '⚽ Entretenimiento', '👕 Ropa/Compras', '🛡 Seguros', '💳 Impuestos/Financiero',
  '💰 Ahorro USD', '❓ Otros'];
const MEDIOS = ['Dinero MP', 'Tarjeta de crédito', 'Crédito MP', 'Transferencia banco', 'Efectivo'];

// Palabra clave en la descripción → [categoría, subcategoría]. Se usa si no hay un gasto previo igual.
const REGLAS = [
  [/shell|ypf|axion|puma|nafta|combustible/i, '🚗 Transporte', 'Combustible'],
  [/estacion|parking|cochera/i, '🚗 Transporte', 'Estacionamiento'],
  [/aubasa|autopista|peaje/i, '🚗 Transporte', 'Peaje/Autopista'],
  [/uber|cabify|didi|sube/i, '🚗 Transporte', 'Viajes'],
  [/pedidosya|rappi/i, '🍽 Comida/Delivery', 'Delivery'],
  [/carrefour|coto|dia |vea|jumbo|market|chino|almac|verduler|carnicer/i, '🛒 Supermercado', 'Supermercado'],
  [/farmacia|ospe|obra social/i, '❓ Otros', 'Salud'],
  [/edelap|camuzzi|personal|tuenti|movistar|claro|internet/i, '🏠 Hogar', 'Servicios'],
  [/mercadolibre|meli/i, '👕 Ropa/Compras', 'Compras Online'],
];

/* ---------- setup ---------- */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  let sh = ss.getSheetByName(HOJA);
  if (!sh) sh = ss.insertSheet(HOJA);
  if (sh.getLastRow() === 0) sh.appendRow(COLUMNAS);
  sh.setFrozenRows(1);
  sh.getRange('F:F').setNumberFormat('#,##0.00');

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN')) props.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, ''));

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'importarMails')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('importarMails').timeBased().everyMinutes(15).create();

  Logger.log('TOKEN: ' + props.getProperty('TOKEN'));
}

/* ---------- endpoints ---------- */

function doGet(e) {
  const p = e.parameter || {};
  if (!tokenValido_(p.k)) return HtmlService.createHtmlOutput('Acceso denegado');
  if (p.action === 'config') return json_({ categorias: CATEGORIAS, medios: MEDIOS });

  const t = HtmlService.createTemplateFromFile('Index');
  t.k = p.k;
  return t.evaluate()
    .setTitle('Gastos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!tokenValido_(body.k)) return json_({ ok: false, error: 'token' });
    const r = agregar_(body, 'atajo');
    return json_({ ok: true, id: r.id, mensaje: `${r.categoria} · $${formato_(r.monto)}` });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/* ---------- llamadas desde el panel (google.script.run) ---------- */

function getDatos(k) {
  if (!tokenValido_(k)) throw new Error('Acceso denegado');
  const sh = hoja_();
  if (sh.getLastRow() < 2) return { filas: [], categorias: CATEGORIAS, medios: MEDIOS };
  const tzHoja = sh.getParent().getSpreadsheetTimeZone();
  const filas = sh.getRange(2, 1, sh.getLastRow() - 1, COLUMNAS.length).getValues()
    .filter(r => r[COL.ID])
    .map(r => {
      const f = r[COL.Fecha];
      return {
        id: String(r[COL.ID]),
        fecha: f instanceof Date ? Utilities.formatDate(f, tzHoja, 'yyyy-MM-dd') : String(f),
        mes: r[COL.Mes] instanceof Date ? Utilities.formatDate(r[COL.Mes], tzHoja, 'yyyy-MM') : String(r[COL.Mes]),
        tipo: r[COL.Tipo],
        descripcion: r[COL['Descripción']],
        monto: Number(r[COL.Monto]) || 0,
        categoria: r[COL['Categoría']],
        clase: r[COL.Clase],
        subcategoria: r[COL['Subcategoría']],
        medio: r[COL.Medio],
        cuota: r[COL.Cuota],
        origen: r[COL.Origen],
      };
    });
  return { filas, categorias: CATEGORIAS, medios: MEDIOS };
}

function guardar(k, datos) {
  if (!tokenValido_(k)) throw new Error('Acceso denegado');
  return agregar_(datos, 'panel');
}

function borrar(k, id) {
  if (!tokenValido_(k)) throw new Error('Acceso denegado');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = hoja_();
    const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
    const i = ids.findIndex(r => String(r[0]) === String(id));
    if (i < 0) return false;
    sh.deleteRow(i + 2);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* ---------- mails de Mercado Pago ---------- */

function importarMails() {
  const q = 'from:(mercadopago.com OR mercadopago.com.ar) subject:"Pago aprobado en" newer_than:7d';
  const existentes = new Set(hoja_().getRange('A:A').getValues().flat().map(String));

  GmailApp.search(q, 0, 50).forEach(thread => thread.getMessages().forEach(msg => {
    const id = 'mail-' + msg.getId();
    if (existentes.has(id)) return;
    const pago = parsearMail_(msg.getSubject(), msg.getPlainBody());
    if (!pago) return;
    agregar_({
      id,
      monto: pago.monto,
      descripcion: pago.comercio,
      medio: 'Dinero MP',
      fecha: Utilities.formatDate(msg.getDate(), TZ, 'yyyy-MM-dd'),
    }, 'mail');
    existentes.add(id);
  }));
}

/**
 * Solo pagos con dinero en cuenta. Los pagos con tarjeta de crédito se omiten porque
 * ya entran con el resumen de la tarjeta; los "Recibiste un pago" son ingresos.
 */
function parsearMail_(asunto, cuerpo) {
  if (/Recibiste un pago/i.test(cuerpo)) return null;
  if (!/Dinero disponible|Dinero en cuenta/i.test(cuerpo)) return null;
  const m = cuerpo.match(/Pagaste\s*\$\s*([\d.]+(?:,\d{1,2})?)/i);
  if (!m) return null;
  const comercio = (asunto.match(/Pago aprobado en\s+(.+)/i) || [])[1] || 'Mercado Pago';
  return { monto: numero_(m[1]), comercio: comercio.trim() };
}

/* ---------- núcleo ---------- */

function agregar_(d, origen) {
  const monto = numero_(d.monto);
  if (!monto) throw new Error('Monto inválido');
  const descripcion = String(d.descripcion || '').trim() || 'Sin descripción';
  const fecha = d.fecha ? String(d.fecha).slice(0, 10) : Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

  let categoria = CATEGORIAS.includes(d.categoria) ? d.categoria : '';
  let sub = d.subcategoria || '';
  if (!categoria) [categoria, sub] = adivinarCategoria_(descripcion, sub);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = d.id || Utilities.getUuid().slice(0, 8);
    hoja_().appendRow([
      // El apóstrofo evita que Sheets convierta "2026-10" o "06/09" en fechas.
      id, fecha, "'" + fecha.slice(0, 7), d.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto', descripcion, monto,
      categoria, d.clase || 'Variable', sub, d.medio || 'Dinero MP', d.cuota ? "'" + d.cuota : '', origen,
      Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
    ]);
    return { id, monto, categoria };
  } finally {
    lock.releaseLock();
  }
}

/** Reusa la categoría del último gasto con la misma descripción; si no hay, aplica REGLAS. */
function adivinarCategoria_(descripcion, sub) {
  const sh = hoja_();
  if (sh.getLastRow() > 1) {
    const filas = sh.getRange(2, 1, sh.getLastRow() - 1, COLUMNAS.length).getValues();
    const clave = descripcion.toLowerCase();
    for (let i = filas.length - 1; i >= 0; i--) {
      if (String(filas[i][COL['Descripción']]).toLowerCase() === clave && filas[i][COL.Tipo] === 'Gasto') {
        return [filas[i][COL['Categoría']], sub || filas[i][COL['Subcategoría']]];
      }
    }
  }
  const regla = REGLAS.find(([re]) => re.test(descripcion));
  return regla ? [regla[1], sub || regla[2]] : ['❓ Otros', sub];
}

/* ---------- utilidades ---------- */

/** Acepta 51750, "51.750", "$ 51.750,50", "51750.5". */
function numero_(v) {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  let s = String(v || '').replace(/[^\d.,-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}(\.|$)/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function formato_(n) {
  return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

function tokenValido_(k) {
  const t = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return Boolean(t) && k === t;
}

function hoja_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
