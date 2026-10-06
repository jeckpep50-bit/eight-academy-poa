/* Avisos por correo de la Plataforma POA · Eight Academy.
   Corre en Google Apps Script con la cuenta mibermeov@: envía desde ella y lee
   y escribe Firestore con su permiso de IAM (rol "Cloud Datastore User"). */

var PROYECTO = 'eight-academy-poa';
var ZONA = 'America/Guayaquil';
var HORA_ENVIO = '09:10';
var FIRMA = ['Marisol Bermeo', 'Departamento de Planificación', 'Eight Academy'];
var ENTREGA = 'planificacion@eightacademy.edu.ec';
var COPIA_ENTREGA = 'mibermeov@eightacademy.edu.ec';
var LIMITE_PRUEBA = 5;

var AREAS = {
  KIDS: 'Kids', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria', DECE: 'DECE',
  MARKETING: 'Marketing', RIESGOS: 'Gestión de Riesgos', ZOOBOTANICA: 'Zoobotánica'
};
var CLASES = { grande: '★★★ Grande', mediana: '★★ Mediana', pequena: '★ Pequeña' };
var NOMBRE_FASE = {
  anticipacion: 'Anticipación', recordatorio: 'Recordatorio', urgencia: 'Urgencia',
  memo: 'Memorando', seguimiento: 'Seguimiento'
};
var ORDEN_RESUMEN = ['memo', 'urgencia', 'recordatorio', 'anticipacion', 'seguimiento'];

/* ============================================================
   Instalación (la ejecuta Marisol una sola vez)
   ============================================================ */

function instalar() {
  desinstalar();
  ScriptApp.newTrigger('programarEnvio').timeBased().atHour(6).everyDays(1).inTimezone(ZONA).create();
  programarEnvio();
  Logger.log('Instalado. Los avisos se revisarán cada día hábil a las ' + HORA_ENVIO + '.');
}

function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
}

// Los disparadores diarios de Apps Script se mueven hasta una hora; uno de una
// sola vez programado cada mañana sale a la hora exacta.
function programarEnvio() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'enviarAvisosDelDia'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var hoy = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
  var cuando = new Date(hoy + 'T' + HORA_ENVIO + ':00-05:00');
  if (cuando > new Date()) ScriptApp.newTrigger('enviarAvisosDelDia').timeBased().at(cuando).create();
}

/* ============================================================
   Envío diario
   ============================================================ */

function enviarAvisosDelDia() {
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(60 * 1000)) return;
  try {
    var hoy = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
    var datos = leerDatos();
    var resultado = procesarDia(datos, hoy);
    if (!resultado.activo) { Logger.log(resultado.motivo); return; }

    var prueba = datos.config.modo === 'prueba';
    var enviados = 0, errores = resultado.errores.slice();
    resultado.correos.forEach(function (c) {
      if (prueba && enviados >= LIMITE_PRUEBA) return;
      try {
        enviarCorreo(c, datos.config);
        enviados++;
        if (!prueba) {
          fsEscribir('avisos/' + c.id, resultado.avisos[c.id]);
          fsCrear('registroAvisos', {
            actividad: c.id, area: c.area, fase: c.fase, fecha: hoy, para: c.para,
            asunto: c.asunto, enviadoEl: new Date()
          });
        }
      } catch (e) { errores.push('Actividad ' + c.id + ' (' + c.fase + '): ' + e.message); }
    });
    if (!prueba) {
      resultado.soloEstado.forEach(function (id) { fsEscribir('avisos/' + id, resultado.avisos[id]); });
      if (resultado.contadorMemos !== datos.contadorMemos)
        fsEscribir('config/contadores', { memos: resultado.contadorMemos });
    }
    if (resultado.resumen) enviarResumen(resultado.resumen, datos.config);
    if (errores.length) avisarErrores(errores, datos.config, hoy);
    Logger.log('Avisos enviados: ' + enviados + (prueba ? ' (modo prueba)' : ''));
  } finally {
    candado.releaseLock();
  }
}

// Muestra en el registro lo que se enviaría hoy, sin enviar ni escribir nada.
function simularHoy() {
  var hoy = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
  var r = procesarDia(leerDatos(), hoy);
  if (!r.activo) { Logger.log(r.motivo); return; }
  r.correos.forEach(function (c) { Logger.log('[' + c.fase + '] ' + c.asunto + ' → ' + c.para.join(', ')); });
  Logger.log(r.correos.length + ' correos. Errores: ' + (r.errores.join(' | ') || 'ninguno'));
}

/* ============================================================
   Decisión del día (sin entradas ni salidas: se prueba en Node)
   ============================================================ */

function procesarDia(datos, hoy) {
  var cfg = datos.config || {};
  if (cfg.modo === 'pausado') return { activo: false, motivo: 'Envío en pausa.' };
  if (cfg.inicio && hoy < cfg.inicio) return { activo: false, motivo: 'Aún no llega la fecha de inicio.' };
  var cal = Logica.crearCalendario((cfg.noLaborables || []).map(function (d) { return d.fecha; }));
  if (!cal.esHabil(hoy)) return { activo: false, motivo: 'Hoy no es día hábil.' };

  var avisos = {}, correos = [], soloEstado = [], errores = [];
  Object.keys(datos.avisos || {}).forEach(function (id) { avisos[id] = JSON.parse(JSON.stringify(datos.avisos[id])); });
  var contador = datos.contadorMemos || 0;

  datos.eventos.forEach(function (e) {
    try {
      var id = String(e.id);
      var aviso = avisos[id];
      var entregado = !!(datos.entregas[id] && datos.entregas[id].entregado);
      if (aviso && entregado && aviso.estado === 'en curso') {
        aviso.estado = 'entregada';
        soloEstado.push(id);
      } else if (aviso && !entregado && aviso.estado === 'entregada') {
        aviso.estado = 'en curso';
        soloEstado.push(id);
      }
      var plan = Logica.planificar(datos.clasificaciones[id], e.start, aviso ? aviso.entrada : hoy, cal);
      if (!plan) return;
      var accion = Logica.accionDelDia(plan, aviso ? aviso.fases : {}, hoy, entregado);
      if (!accion.enviar) return;

      var responsables = (cfg.responsables || {})[e.area] || [];
      if (!responsables.length) { errores.push('El área ' + e.area + ' no tiene responsables configurados.'); return; }

      aviso = aviso || { entrada: hoy, fases: {}, estado: 'en curso' };
      accion.omitir.forEach(function (f) { aviso.fases[f] = 'omitida'; });
      var memoNumero = null;
      if (accion.enviar === 'memo') {
        contador++;
        memoNumero = 'PLAN-POA-' + hoy.slice(0, 4) + '-' + ('00' + contador).slice(-3);
        aviso.memo = memoNumero;
      }
      var previos = Object.keys(aviso.fases).map(function (f) { return aviso.fases[f]; })
        .filter(function (v) { return v !== 'omitida'; }).sort();
      aviso.fases[accion.enviar] = hoy;
      aviso.clase = plan.clase;
      aviso.fechaActividad = e.start;
      if (accion.enviar === 'seguimiento') aviso.estado = 'incumplida';
      avisos[id] = aviso;

      correos.push(componer({
        evento: e, fase: accion.enviar, plan: plan, cal: cal, hoy: hoy,
        responsables: responsables, memoNumero: memoNumero, previos: previos
      }));
    } catch (err) {
      errores.push('Actividad ' + e.id + ': ' + err.message);
    }
  });

  return {
    activo: true, correos: correos, avisos: avisos, soloEstado: soloEstado, errores: errores,
    contadorMemos: contador,
    resumen: correos.length ? componerResumen(correos, avisos, datos.entregas, hoy) : null
  };
}

/* ============================================================
   Redacción
   ============================================================ */

var DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(iso) {
  var p = iso.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return DIAS_SEMANA[d.getUTCDay()] + ' ' + p[2] + ' de ' + MESES[p[1] - 1] + ' de ' + p[0];
}
function fechaCorta(iso) { var p = iso.split('-').map(Number); return p[2] + ' de ' + MESES[p[1] - 1]; }
function listaFechas(isos) {
  var t = isos.map(fechaCorta);
  return t.length < 2 ? (t[0] || '') : t.slice(0, -1).join(', ') + ' y ' + t[t.length - 1];
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function nombres(personas) {
  var n = personas.map(function (p) { return p.nombre; });
  return n.length < 2 ? n[0] : n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1];
}

function bloque(e, plan) {
  return [
    ['Área', AREAS[e.area] || e.area],
    ['Actividad', e.activity],
    ['Fecha de la actividad', fechaLarga(e.start)],
    ['Clasificación', CLASES[plan.clase]],
    ['Responsable en el POA', e.responsable],
    ['Objetivo', e.objetivo],
    ['Descripción', [e.publico, e.periodo, e.notas].filter(function (x) { return x; }).join(' · ')],
    ['Fecha límite de entrega del minuto a minuto', fechaLarga(plan.fechaLimite)]
  ].filter(function (f) { return f[1]; });
}

function componer(o) {
  var e = o.evento, area = AREAS[e.area] || e.area, faltan = o.cal.habilesEntre(o.hoy, e.start);
  var donde = ENTREGA + ', con copia a ' + COPIA_ENTREGA;
  var saludo = 'Buenos días, ' + nombres(o.responsables) + ':';
  var limite = fechaLarga(o.plan.fechaLimite);
  var asunto, encabezado = null, antes, despues;

  if (o.fase === 'anticipacion') {
    asunto = 'POA ' + area + ' · Aviso anticipado: ' + e.activity + ' (' + fechaCorta(e.start) + ')';
    antes = ['Les informamos con anticipación que la siguiente actividad del POA requiere su minuto a minuto (ruta de trabajo):'];
    despues = ['Les pedimos enviarlo a ' + donde + ', a más tardar el ' + limite + '. Planificar con tiempo permite coordinar espacios, personal y recursos con las demás áreas.',
      'Gracias por su compromiso.'];
  } else if (o.fase === 'recordatorio') {
    asunto = 'POA ' + area + ' · Recordatorio: minuto a minuto de ' + e.activity;
    antes = ['Aún no hemos recibido el minuto a minuto de la siguiente actividad:'];
    despues = ['Faltan ' + faltan + ' días hábiles para la actividad y la fecha límite de entrega es el ' + limite + '. Les recordamos enviarlo a ' + donde + '. Si ya está en preparación, les agradecemos enviarlo en cuanto esté listo.'];
  } else if (o.fase === 'urgencia') {
    asunto = 'POA ' + area + ' · URGENTE: ' + e.activity + ' aún sin minuto a minuto';
    antes = ['A ' + faltan + ' días hábiles de la actividad, todavía no contamos con su minuto a minuto:'];
    despues = ['Les invitamos a reflexionar sobre lo que implica llegar a una actividad sin una ruta de trabajo clara: la experiencia de los estudiantes, la coordinación con las demás áreas y la imagen de la institución dependen de una buena planificación.',
      'Les pedimos priorizar su entrega antes del ' + limite + ', a ' + donde + '. Si existe algún impedimento, comuníquenlo hoy mismo respondiendo a este correo para buscar juntos una solución.'];
  } else if (o.fase === 'memo') {
    asunto = 'MEMORANDO ' + o.memoNumero + ' · Incumplimiento en la entrega del minuto a minuto: ' + e.activity;
    saludo = null;
    encabezado = [
      ['MEMORANDO N.º', o.memoNumero],
      ['Para', o.responsables.map(function (p) { return p.nombre + (p.cargo ? ', ' + p.cargo : ''); }).join('; ')],
      ['De', FIRMA[0] + ', ' + FIRMA[1]],
      ['Fecha', fechaLarga(o.hoy)],
      ['Asunto', 'Llamado de atención por incumplimiento en la entrega del minuto a minuto']
    ];
    antes = ['Por medio del presente se deja constancia de que, vencida la fecha límite del ' + limite +
      (o.previos.length ? ' y pese a los avisos enviados el ' + listaFechas(o.previos) : '') +
      ', no se ha recibido el minuto a minuto de la siguiente actividad:'];
    despues = ['Se solicita entregarlo de manera inmediata, a más tardar el ' +
      fechaLarga(o.cal.siguienteHabil(Logica.sumarDias(o.hoy, 1))) + ', a ' + donde + '.',
      'El presente incumplimiento queda registrado. Las medidas que correspondan serán notificadas por los departamentos competentes, conforme a las políticas internas de la institución.'];
  } else {
    asunto = 'POA ' + area + ' · Seguimiento: ' + e.activity + ' sin minuto a minuto entregado';
    antes = [(o.hoy === e.start ? 'Hoy, ' + fechaLarga(e.start) + ', corresponde' : 'El ' + fechaLarga(e.start) + ' correspondía') +
      ' la realización de la siguiente actividad, de la cual no se recibió el minuto a minuto:'];
    despues = ['La actividad queda registrada en la plataforma como incumplida en la entrega de su planificación. Les solicitamos enviar, en un plazo de 2 días hábiles, un informe breve a ' + donde + ', que indique si la actividad se realizó, cómo se organizó y los motivos por los que no se entregó el minuto a minuto.'];
  }

  var filas = bloque(e, o.plan);
  var texto = [], html = [];
  if (encabezado) {
    texto.push(encabezado.map(function (f) { return f[0] + ': ' + f[1]; }).join('\n'), '');
    html.push('<table style="border-collapse:collapse;margin:0 0 18px">' + encabezado.map(function (f) {
      return '<tr><td style="padding:3px 14px 3px 0;font-weight:700;vertical-align:top">' + esc(f[0]) + '</td><td style="padding:3px 0">' + esc(f[1]) + '</td></tr>';
    }).join('') + '</table>');
  }
  if (saludo) { texto.push(saludo, ''); html.push('<p>' + esc(saludo) + '</p>'); }
  antes.forEach(function (p) { texto.push(p, ''); html.push('<p>' + esc(p) + '</p>'); });
  texto.push(filas.map(function (f) { return f[0] + ': ' + f[1]; }).join('\n'), '');
  html.push('<table style="border-collapse:collapse;margin:6px 0 18px;border-left:4px solid #1e2a78">' + filas.map(function (f) {
    return '<tr><td style="padding:5px 14px;color:#4a5375;vertical-align:top;white-space:nowrap">' + esc(f[0]) + '</td><td style="padding:5px 14px 5px 0;font-weight:600">' + esc(f[1]) + '</td></tr>';
  }).join('') + '</table>');
  despues.forEach(function (p) { texto.push(p, ''); html.push('<p>' + esc(p) + '</p>'); });
  texto.push(FIRMA.join('\n'));
  html.push('<p style="margin-top:22px">' + FIRMA.map(esc).join('<br>') + '</p>');

  return {
    id: String(e.id), area: e.area, fase: o.fase, actividad: e.activity, fechaActividad: e.start,
    clase: o.plan.clase, memo: o.memoNumero,
    para: o.responsables.map(function (p) { return p.correo; }),
    paraNombres: nombres(o.responsables),
    asunto: asunto, texto: texto.join('\n'),
    html: '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1f36;max-width:640px">' + html.join('') + '</div>'
  };
}

function componerResumen(correos, avisos, entregas, hoy) {
  var ids = Object.keys(avisos);
  var acumulado = {
    aTiempo: ids.filter(function (id) { return entregas[id] && entregas[id].entregado && avisos[id].estado !== 'incumplida'; }).length,
    memos: ids.filter(function (id) { return avisos[id].fases && avisos[id].fases.memo && avisos[id].fases.memo !== 'omitida'; }).length,
    incumplidas: ids.filter(function (id) { return avisos[id].estado === 'incumplida'; }).length
  };
  var texto = ['Buenos días:', '', 'Este es el resumen de los avisos de entrega del minuto a minuto enviados hoy por la Plataforma POA.', ''];
  var html = ['<p>Buenos días:</p><p>Este es el resumen de los avisos de entrega del minuto a minuto enviados hoy por la Plataforma POA.</p>'];
  ORDEN_RESUMEN.forEach(function (fase) {
    var grupo = correos.filter(function (c) { return c.fase === fase; });
    if (!grupo.length) return;
    var titulo = (fase === 'memo' ? 'MEMORANDOS' : NOMBRE_FASE[fase].toUpperCase()) + ' (' + grupo.length + ')';
    texto.push(titulo);
    grupo.forEach(function (c) {
      texto.push('  ' + (c.memo ? c.memo + ' · ' : '') + (AREAS[c.area] || c.area) + ' · ' + c.actividad + ' · ' +
        fechaCorta(c.fechaActividad) + ' · ' + CLASES[c.clase] + ' · enviado a ' + c.paraNombres);
    });
    texto.push('');
    var color = fase === 'memo' ? '#b4232c' : '#1e2a78';
    html.push('<h3 style="font-size:14px;margin:20px 0 6px;color:' + color + '">' + esc(titulo) + '</h3>' +
      '<table style="border-collapse:collapse;width:100%;font-size:13px">' + grupo.map(function (c) {
        return '<tr style="border-top:1px solid #e3e6f0"><td style="padding:5px 8px 5px 0;white-space:nowrap">' + esc(AREAS[c.area] || c.area) + '</td>' +
          '<td style="padding:5px 8px">' + (c.memo ? '<b>' + esc(c.memo) + '</b> · ' : '') + esc(c.actividad) + '</td>' +
          '<td style="padding:5px 8px;white-space:nowrap">' + esc(fechaCorta(c.fechaActividad)) + '</td>' +
          '<td style="padding:5px 8px;white-space:nowrap">' + esc(CLASES[c.clase]) + '</td>' +
          '<td style="padding:5px 0 5px 8px">' + esc(c.paraNombres) + '</td></tr>';
      }).join('') + '</table>');
  });
  var linea = 'Acumulado del año lectivo: ' + acumulado.aTiempo + ' actividades entregadas a tiempo · ' +
    acumulado.memos + ' memorandos · ' + acumulado.incumplidas + ' actividades en seguimiento por no entrega.';
  texto.push(linea, '', FIRMA.join('\n'), 'Mensaje automático de la Plataforma POA');
  html.push('<p style="margin-top:20px">' + esc(linea) + '</p><p style="margin-top:22px">' + FIRMA.map(esc).join('<br>') +
    '<br><span style="color:#6b7394;font-size:12px">Mensaje automático de la Plataforma POA</span></p>');
  return {
    asunto: 'POA · Resumen de avisos enviados hoy, ' + fechaCorta(hoy) + ' (' + correos.length + ' correo' + (correos.length === 1 ? '' : 's') + ')',
    texto: texto.join('\n'),
    html: '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1f36;max-width:760px">' + html.join('') + '</div>',
    acumulado: acumulado
  };
}

/* ============================================================
   Correo
   ============================================================ */

function remitente() { return FIRMA[0] + ' · ' + FIRMA[1]; }

function enviarCorreo(c, cfg) {
  var prueba = cfg.modo === 'prueba';
  var nota = '<p style="background:#fff4d6;padding:8px 10px;border-radius:6px;font-size:12px">MODO PRUEBA · En modo real iría a: ' +
    esc(c.para.join(', ')) + '</p>';
  MailApp.sendEmail({
    to: prueba ? cfg.correoPrueba : c.para.join(','),
    subject: (prueba ? '[PRUEBA] ' : '') + c.asunto,
    body: c.texto,
    htmlBody: (prueba ? nota : '') + c.html,
    name: remitente()
  });
}

function enviarResumen(r, cfg) {
  var prueba = cfg.modo === 'prueba';
  var para = prueba ? [cfg.correoPrueba] : (cfg.copias || []).map(function (p) { return p.correo; });
  if (!para.length) return;
  MailApp.sendEmail({ to: para.join(','), subject: (prueba ? '[PRUEBA] ' : '') + r.asunto, body: r.texto, htmlBody: r.html, name: remitente() });
}

function avisarErrores(errores, cfg, hoy) {
  var para = cfg.correoErrores || cfg.correoPrueba;
  if (!para) return;
  MailApp.sendEmail({
    to: para, name: remitente(),
    subject: 'POA · Problemas al enviar los avisos del ' + fechaCorta(hoy),
    body: 'Estos avisos no se pudieron preparar o enviar:\n\n' + errores.join('\n')
  });
}

/* ============================================================
   Firestore (API REST con el permiso de la cuenta que ejecuta)
   ============================================================ */

var BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO + '/databases/(default)/documents/';

function llamar(metodo, ruta, cuerpo) {
  var opciones = {
    method: metodo, contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  };
  if (cuerpo) opciones.payload = JSON.stringify(cuerpo);
  var r = UrlFetchApp.fetch(BASE + ruta, opciones);
  var codigo = r.getResponseCode();
  if (codigo === 404 && metodo === 'get') return null;
  if (codigo >= 300) throw new Error('Firestore ' + codigo + ': ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText() || '{}');
}

function fsLeer(ruta) { var d = llamar('get', ruta); return d ? decodificarMapa(d.fields || {}) : null; }

function fsListar(coleccion) {
  var salida = {}, pagina = '';
  do {
    var r = llamar('get', coleccion + '?pageSize=300' + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''));
    ((r && r.documents) || []).forEach(function (d) { salida[d.name.split('/').pop()] = decodificarMapa(d.fields || {}); });
    pagina = r && r.nextPageToken;
  } while (pagina);
  return salida;
}

function fsEscribir(ruta, obj) { llamar('patch', ruta, { fields: codificarMapa(obj) }); }
function fsCrear(coleccion, obj) { llamar('post', coleccion, { fields: codificarMapa(obj) }); }

function leerDatos() {
  var config = fsLeer('config/avisos');
  if (!config) throw new Error('Falta la configuración de avisos (config/avisos).');
  var poa = fsListar('poa'), eventos = [];
  Object.keys(poa).forEach(function (a) {
    (poa[a].events || []).forEach(function (e) { if (e.archivado !== true && e.start) eventos.push(e); });
  });
  var clasif = fsListar('clasificaciones'), clasificaciones = {};
  Object.keys(clasif).forEach(function (id) { clasificaciones[id] = clasif[id].clase; });
  var contadores = fsLeer('config/contadores') || {};
  return {
    config: config, eventos: eventos, clasificaciones: clasificaciones,
    entregas: fsListar('entregas'), avisos: fsListar('avisos'), contadorMemos: contadores.memos || 0
  };
}

function decodificar(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodificar);
  if ('mapValue' in v) return decodificarMapa(v.mapValue.fields || {});
  return null;
}
function decodificarMapa(f) { var o = {}; Object.keys(f).forEach(function (k) { o[k] = decodificar(f[k]); }); return o; }

function codificar(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (x instanceof Date) return { timestampValue: x.toISOString() };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(codificar) } };
  return { mapValue: { fields: codificarMapa(x) } };
}
function codificarMapa(o) { var f = {}; Object.keys(o).forEach(function (k) { f[k] = codificar(o[k]); }); return f; }
