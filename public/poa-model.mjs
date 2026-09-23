import { AREAS } from './config.js';

export const TAGS = ['holiday','evaluation','parents','institutional','cultural','extracurricular','training'];
export const EMPTY_TAGS = Object.fromEntries(TAGS.map(key => [key, false]));
const trim = value => String(value ?? '').trim();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function validDate(value) {
  if (!datePattern.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(y,m-1,d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth()+1 === m && parsed.getUTCDate() === d;
}

export function addDays(value, days) {
  const [y,m,d] = value.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);
}

export function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  }
  if (typeof value === 'number' && value >= 20000 && value <= 90000) {
    return new Date(Date.UTC(1899,11,30+Math.floor(value))).toISOString().slice(0,10);
  }
  const text = trim(value);
  if (validDate(text)) return text;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return '';
  const iso = `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
  return validDate(iso) ? iso : '';
}

export function normalizeEvent(input, id, previous = null, source = 'Edición manual') {
  const area = trim(input.area || previous?.area).toUpperCase();
  if (!AREAS.includes(area)) throw new Error('Selecciona un área válida.');
  const activity = trim(input.activity);
  if (!activity || activity.length > 250) throw new Error('La actividad debe tener entre 1 y 250 caracteres.');
  const start = parseDate(input.start);
  const end = parseDate(input.end) || start;
  if (trim(input.start) && !start) throw new Error('La fecha de inicio no es válida.');
  if (trim(input.end) && !end) throw new Error('La fecha de fin no es válida.');
  if (end && !start) throw new Error('Indica la fecha de inicio antes de la fecha de fin.');
  if (start && end < start) throw new Error('La fecha de fin debe ser igual o posterior al inicio.');
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Identificador inválido.');
  const planning = input.planning === 'SÍ' ? 'SÍ' : 'VALIDAR';
  const oldTags = previous?.tags || EMPTY_TAGS;
  const rawTags = input.tags || oldTags;
  const tags = Object.fromEntries(TAGS.map(key => [key, rawTags[key] === true]));
  const duration = start ? Math.round((Date.parse(end) - Date.parse(start))/86400000)+1 : null;
  const dateChanged = previous && (previous.start !== start || previous.end !== end);
  return {
    ...(previous || {}), id, area, activity,
    original: previous?.original || activity,
    start: start || null, end: end || null, duration,
    dateStatus: start ? (dateChanged ? 'CORREGIDA' : previous?.dateStatus || 'EXACTA') :
      (previous && !dateChanged ? previous.dateStatus || 'SIN FECHA' : 'SIN FECHA'),
    dateNote: dateChanged ? 'Fecha actualizada por super administrador' : previous?.dateNote || null,
    responsable: trim(input.responsable) || null,
    publico: trim(input.publico) || null,
    objetivo: trim(input.objetivo) || null,
    prioridad: trim(input.prioridad) || null,
    estado: trim(input.estado) || null,
    unidad: trim(input.unidad) || null,
    periodo: trim(input.periodo) || null,
    notas: trim(input.notas) || null,
    recurrente: input.recurrente === true,
    planning,
    reminder: start && planning === 'SÍ' ? addDays(start,-15) : null,
    tags,
    sourceFile: previous?.sourceFile || source,
    sourceSheet: previous?.sourceSheet || '',
    sourceRow: previous?.sourceRow || Math.max(1,Number(input.sourceRow)||1),
    responsableFuente: previous?.responsableFuente || (source === 'Edición manual' ? 'Registro manual' : source),
    destacado: input.destacado === true,
    archivado: input.archivado === true
  };
}

export function compact(value) {
  return trim(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

export function detectColumns(row) {
  const cols = {activity:-1,start:-1,end:-1,area:-1,responsable:-1,publico:-1,objetivo:-1,prioridad:-1,estado:-1,unidad:-1,periodo:-1,notas:-1};
  row.forEach((value,i) => {
    const h = compact(value);
    if (!h) return;
    if (/^(actividad|actividades|descripcion|nombre de actividad|evento|accion|tarea)$/.test(h)) cols.activity=i;
    else if (/^(fecha de inicio|fecha inicio|inicio|desde|fecha inicial)$/.test(h)) cols.start=i;
    else if (/^(fecha de fin|fecha fin|fin|hasta|fecha final)$/.test(h)) cols.end=i;
    else if (/^(fecha|fechas|periodo de ejecucion)$/.test(h) && cols.start<0) cols.start=i;
    else if (/^(area|seccion|departamento)$/.test(h)) cols.area=i;
    else if (/^(responsable|responsables|encargado|lider)$/.test(h)) cols.responsable=i;
    else if (/^(publico|destinatarios|participantes)$/.test(h)) cols.publico=i;
    else if (/^(objetivo|objetivos)$/.test(h)) cols.objetivo=i;
    else if (/^(prioridad)$/.test(h)) cols.prioridad=i;
    else if (/^(estado|estatus)$/.test(h)) cols.estado=i;
    else if (/^(unidad|pilar)$/.test(h)) cols.unidad=i;
    else if (/^(periodo|mes)$/.test(h)) cols.periodo=i;
    else if (/^(notas|observaciones|comentarios)$/.test(h)) cols.notas=i;
  });
  return cols;
}

export function rowsToCandidates(rows, columns, area, fileName, sheetName, headerRow = 0) {
  if (columns.activity < 0) throw new Error('Selecciona la columna de actividad.');
  return rows.slice(headerRow+1).map((row,index) => {
    const get = key => columns[key] >= 0 ? trim(row[columns[key]]) : '';
    const activity = get('activity');
    if (!activity || compact(activity) === 'actividad') return null;
    const foundArea = get('area').toUpperCase();
    const start = parseDate(row[columns.start]);
    const end = parseDate(row[columns.end]) || start;
    return {area: AREAS.includes(foundArea) ? foundArea : area, activity, start, end,
      responsable:get('responsable'), publico:get('publico'), objetivo:get('objetivo'),
      prioridad:get('prioridad'), estado:get('estado'), unidad:get('unidad'),
      periodo:get('periodo'), notas:get('notas'), planning:'VALIDAR',
      sourceFile:fileName, sourceSheet:sheetName, sourceRow:headerRow+index+2};
  }).filter(Boolean).slice(0,200);
}

export function textToCandidates(text, area, fileName) {
  const date = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\b/g;
  return text.split(/\r?\n/).map((line,index) => {
    const clean = line.replace(/\s+/g,' ').trim();
    if (clean.length < 8 || clean.length > 350) return null;
    const dates = [...clean.matchAll(date)].map(match => parseDate(match[0])).filter(Boolean);
    if (!dates.length) return null;
    const activity = clean.replace(date,' ').replace(/^[\s:–—-]+|[\s:–—-]+$/g,'').trim();
    if (activity.length < 4) return null;
    return {area,activity,start:dates[0],end:dates[1] || dates[0],responsable:'',publico:'',objetivo:'',
      prioridad:'',estado:'',unidad:'',periodo:'',notas:'',planning:'VALIDAR',
      sourceFile:fileName,sourceSheet:'Texto',sourceRow:index+1};
  }).filter(Boolean).slice(0,200);
}
