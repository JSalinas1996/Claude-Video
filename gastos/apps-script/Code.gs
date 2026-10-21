/**
 * Gastos — web app de Apps Script.
 *  doGet  → panel (Index.html) o configuración para el atajo (?action=config)
 *  doPost → alta de un gasto desde el atajo de iPhone
 *  importarMails → carga los pagos de Mercado Pago que llegan por mail (trigger cada 15 min)
 * Todo pide el token guardado en Propiedades del script (lo genera setup()).
 */

const TZ = 'America/Argentina/Buenos_Aires';
const HOJA = 'Movimientos';
const VERSION = 'v5';
const COLUMNAS = ['ID', 'Fecha', 'Mes', 'Tipo', 'Descripción', 'Monto', 'Categoría', 'Clase',
  'Subcategoría', 'Medio', 'Cuota', 'Origen', 'Creado', 'USD'];
const COL = Object.fromEntries(COLUMNAS.map((c, i) => [c, i]));

const CATEGORIAS = ['🛒 Supermercado', '🍽 Comida/Delivery', '🚗 Transporte', '🏠 Hogar',
  '⚽ Entretenimiento', '👕 Ropa/Compras', '🛡 Seguros', '💳 Impuestos/Financiero',
  '💰 Ahorro USD', '❓ Otros'];
const CAT_INGRESO = '💵 Ingreso';
const CAT_AHORRO = '💰 Ahorro USD';
// Tipos que no son gasto ni ingreso: fotos de saldo (pesos y USD) y el pago del resumen de tarjeta,
// que solo mueve el saldo disponible (los consumos ya están cargados uno por uno).
const CAT_SALDO = '🏦 Saldo';
const CAT_SALDO_USD = '💵 Saldo USD';
const CAT_PAGO_TARJETA = '💳 Pago de tarjeta';
const TIPOS = { Gasto: '', Ingreso: CAT_INGRESO, Saldo: CAT_SALDO, SaldoUSD: CAT_SALDO_USD, 'Pago tarjeta': CAT_PAGO_TARJETA };
const MEDIOS = ['Dinero MP', 'Tarjeta de crédito', 'Crédito MP', 'Transferencia banco', 'Efectivo', 'Fijo mensual'];

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
  asegurarEncabezado_(sh);
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
  if (p.action === 'version') return json_({ version: VERSION });

  const t = HtmlService.createTemplateFromFile('Index');
  t.k = p.k;
  t.nuevo = ['Gasto', 'Ingreso', 'Ahorro', 'Saldo', 'Resumen'].includes(p.nuevo) ? p.nuevo : '';
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
  asegurarEncabezado_(sh);
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
        usd: Number(r[COL.USD]) || 0,
        creado: r[COL.Creado] instanceof Date ? Utilities.formatDate(r[COL.Creado], tzHoja, 'yyyy-MM-dd HH:mm') : String(r[COL.Creado]),
      };
    });
  return { filas, categorias: CATEGORIAS, medios: MEDIOS };
}

function guardar(k, datos) {
  if (!tokenValido_(k)) throw new Error('Acceso denegado');
  return agregar_(datos, 'panel');
}

function editar(k, id, datos) {
  if (!tokenValido_(k)) throw new Error('Acceso denegado');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = hoja_();
    const fila = filaDeId_(sh, id);
    if (!fila) throw new Error('No encontré el movimiento');
    const actual = sh.getRange(fila, 1, 1, COLUMNAS.length).getValues()[0];
    const nueva = armarFila_(Object.assign({}, datos, { id }), actual[COL.Origen], actual[COL.Creado]);
    sh.getRange(fila, 1, 1, COLUMNAS.length).setValues([nueva]);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Alta en bloque desde el importador de resúmenes; `pago` (opcional) agrega el pago del resumen. */
function guardarLote(k, filas, pago) {
  if (!tokenValido_(k)) throw new Error('Acceso denegado');
  const nuevas = filas.map(d => armarFila_(Object.assign({}, d, { id: Utilities.getUuid().slice(0, 8) }), 'resumen'));
  if (pago) nuevas.push(armarFila_(Object.assign({}, pago, { tipo: 'Pago tarjeta', id: Utilities.getUuid().slice(0, 8) }), 'resumen'));
  if (!nuevas.length) return 0;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hoja_();
    sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, COLUMNAS.length).setValues(nuevas);
    return nuevas.length;
  } finally {
    lock.releaseLock();
  }
}

function borrar(k, id) {
  if (!tokenValido_(k)) throw new Error('Acceso denegado');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = hoja_();
    const fila = filaDeId_(sh, id);
    if (!fila) return false;
    sh.deleteRow(fila);
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
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const fila = armarFila_(Object.assign({}, d, { id: d.id || Utilities.getUuid().slice(0, 8) }), origen);
    hoja_().appendRow(fila);
    return { id: fila[COL.ID], monto: fila[COL.Monto], categoria: fila[COL['Categoría']] };
  } finally {
    lock.releaseLock();
  }
}

/** Normaliza lo que llega del atajo, del panel o de un mail a una fila de la hoja. */
function armarFila_(d, origen, creado) {
  const tipo = d.tipo in TIPOS ? d.tipo : 'Gasto';
  const monto = numero_(d.monto);
  if (!monto && !/^Saldo/.test(tipo)) throw new Error('Monto inválido');
  const descripcion = String(d.descripcion || '').trim() || 'Sin descripción';
  const fecha = d.fecha ? String(d.fecha).slice(0, 10) : Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const mes = /^\d{4}-\d{2}$/.test(d.mes || '') ? d.mes : fecha.slice(0, 7);

  let categoria = TIPOS[tipo], sub = d.subcategoria || '';
  if (tipo === 'Gasto') {
    categoria = CATEGORIAS.includes(d.categoria) ? d.categoria : '';
    if (!categoria) [categoria, sub] = adivinarCategoria_(descripcion, sub);
  }
  // El apóstrofo evita que Sheets convierta "2026-10" o "06/09" en fechas.
  return [
    d.id, fecha, "'" + mes, tipo, descripcion, monto, categoria,
    tipo === 'Gasto' ? (d.clase === 'Fijo' ? 'Fijo' : 'Variable') : '', sub,
    tipo === 'Gasto' || tipo === 'Pago tarjeta' ? (d.medio || 'Dinero MP') : (d.medio || ''),
    d.cuota ? "'" + d.cuota : '', origen,
    creado || Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
    categoria === CAT_AHORRO && numero_(d.usd) ? numero_(d.usd) : '',
  ];
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

/**
 * Una sola vez: completa lo que el importador no tomó del Excel.
 * - Agosto 2026: Ahorro USD cargado a mano en la celda G16 (=(1512250+1112800+1497000)/2).
 * - USD comprados por mes (celda "AHORRO USD"), en el mayor movimiento de ahorro de cada mes.
 */
function corregirHistorico() {
  const sh = hoja_();
  asegurarEncabezado_(sh);
  if (!filaDeId_(sh, 'hist-202608-ajuste')) {
    sh.appendRow(armarFila_({
      id: 'hist-202608-ajuste', fecha: '2026-08-01', mes: '2026-08', descripcion: 'Ahorro USD (carga manual)',
      monto: 2061025, categoria: CAT_AHORRO, clase: 'Fijo', subcategoria: 'Compra USD', medio: 'Fijo mensual',
    }, 'histórico', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm')));
  }
  const usdPorMes = { '2026-05': 2100, '2026-06': 4036, '2026-07': 4756, '2026-09': 950, '2026-10': 1800 };
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, COLUMNAS.length).getValues();
  const tz = sh.getParent().getSpreadsheetTimeZone();
  Object.entries(usdPorMes).forEach(([mes, usd]) => {
    let mejor = -1;
    datos.forEach((r, i) => {
      const m = r[COL.Mes] instanceof Date ? Utilities.formatDate(r[COL.Mes], tz, 'yyyy-MM') : String(r[COL.Mes]);
      if (m === mes && r[COL['Categoría']] === CAT_AHORRO && (mejor < 0 || r[COL.Monto] > datos[mejor][COL.Monto])) mejor = i;
    });
    if (mejor >= 0) sh.getRange(mejor + 2, COL.USD + 1).setValue(usd);
  });
  Logger.log('Histórico corregido');
}

function asegurarEncabezado_(sh) {
  if (sh.getRange(1, COLUMNAS.length).getValue() !== COLUMNAS[COLUMNAS.length - 1]) {
    sh.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]);
  }
}

function filaDeId_(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  const i = ids.findIndex(r => String(r[0]) === String(id));
  return i < 0 ? 0 : i + 2;
}

function hoja_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
