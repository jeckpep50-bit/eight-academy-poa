import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fuente = f => readFileSync(new URL(`../apps-script/${f}`, import.meta.url), 'utf8');
const { procesarDia, Logica } = new Function(fuente('Logica.js') + fuente('Avisos.js') + '\nreturn { procesarDia, Logica };')();

const persona = (nombre, correo, cargo) => ({ nombre, correo, cargo });
const CONFIG = {
  modo: 'activo', inicio: '2026-10-05',
  responsables: {
    KIDS: [persona('Ana Pérez', 'aperez@x', 'Directora de KIDS'), persona('Luisa Mora', 'lmora@x', 'Coordinadora de KIDS')],
    RIESGOS: [persona('Carlos Ruiz', 'cruiz@x', 'Consultor de Seguridad e Higiene en el Trabajo')]
  },
  copias: [persona('Rosa Vega', 'rvega@x', 'Rectora')],
  noLaborables: ['2026-10-09', '2026-11-02', '2026-11-03', '2026-11-20', '2026-12-07'].map(fecha => ({ fecha, motivo: 'feriado' }))
};
const ev = (id, area, start, extra = {}) => ({ id, area, start, end: start, activity: `Actividad ${id}`, responsable: 'Docentes', ...extra });
const EVENTOS = [
  ev(1, 'KIDS', '2027-06-01'),
  ev(2, 'KIDS', '2026-11-23', { objetivo: 'Obj. 7', publico: 'Niños / Padres', periodo: 'PRIMER TRIMESTRE' }),
  ev(3, 'RIESGOS', '2026-11-23'),
  ev(4, 'KIDS', '2026-11-24'),
  ev(5, 'RIESGOS', '2026-11-21')
];
const CLASES = { 1: 'grande', 2: 'grande', 3: 'mediana', 5: 'pequena' };

function simular(desde, hasta, alEnviar = () => {}) {
  const estado = { avisos: {}, entregas: {}, contadorMemos: 0 }, enviados = [], resumenes = [];
  for (let d = desde; d <= hasta; d = Logica.sumarDias(d, 1)) {
    const r = procesarDia({ config: CONFIG, eventos: EVENTOS, clasificaciones: CLASES, ...estado }, d);
    if (!r.activo) continue;
    estado.avisos = r.avisos;
    estado.contadorMemos = r.contadorMemos;
    r.correos.forEach(c => { enviados.push({ dia: d, ...c }); alEnviar(c, estado); });
    if (r.resumen) resumenes.push({ dia: d, ...r.resumen });
  }
  return { estado, enviados, resumenes };
}

test('recorre el calendario y envía cada fase una sola vez, solo en días hábiles', () => {
  const { enviados } = simular('2026-10-05', '2026-11-30');
  const deA = id => enviados.filter(c => c.id === String(id)).map(c => `${c.dia} ${c.fase}`);

  assert.deepEqual(deA(2), [
    '2026-10-05 anticipacion', '2026-10-22 recordatorio', '2026-11-09 urgencia',
    '2026-11-17 memo', '2026-11-23 seguimiento'
  ]);
  assert.equal(deA(1).length, 0, 'la del 1 de junio aún no llega a sus 50 días hábiles');
  assert.equal(deA(4).length, 0, 'sin estrellas no recibe correos');
  const dias = enviados.map(c => c.dia);
  assert.ok(!dias.some(d => [0, 6].includes(new Date(d + 'T12:00').getDay())), 'nada en fin de semana');
  assert.ok(!dias.includes('2026-11-20') && !dias.includes('2026-10-09'), 'nada en feriados');
  const claves = enviados.map(c => c.id + c.fase);
  assert.equal(new Set(claves).size, claves.length, 'ningún correo repetido');
});

test('marcar "minuto a minuto entregado" detiene las fases siguientes', () => {
  const { enviados, estado } = simular('2026-10-05', '2026-11-30', (c, est) => {
    if (c.id === '3' && c.fase === 'recordatorio') est.entregas['3'] = { entregado: true };
  });
  assert.deepEqual(enviados.filter(c => c.id === '3').map(c => c.fase), ['anticipacion', 'recordatorio']);
  assert.equal(estado.avisos['3'].estado, 'entregada');
  assert.equal(estado.avisos['2'].estado, 'incumplida');
});

test('el memo lleva número correlativo, firma y el texto institucional acordado', () => {
  const { enviados } = simular('2026-10-05', '2026-11-30');
  const memos = enviados.filter(c => c.fase === 'memo');
  assert.deepEqual(memos.map(c => c.memo), ['PLAN-POA-2026-001', 'PLAN-POA-2026-002', 'PLAN-POA-2026-003']);
  const m = memos.find(c => c.id === '2');
  assert.match(m.asunto, /^MEMORANDO PLAN-POA-2026-00\d · Incumplimiento/);
  assert.match(m.texto, /Para: Ana Pérez, Directora de KIDS; Luisa Mora, Coordinadora de KIDS/);
  assert.match(m.texto, /pese a los avisos enviados el 5 de octubre, 22 de octubre y 9 de noviembre/);
  assert.match(m.texto, /serán notificadas por los departamentos competentes/);
  assert.match(m.texto, /planificacion@eightacademy\.edu\.ec, con copia a mibermeov@eightacademy\.edu\.ec/);
  assert.match(m.texto, /Marisol Bermeo\nDepartamento de Planificación\nEight Academy$/);
  assert.deepEqual(m.para, ['aperez@x', 'lmora@x']);
});

test('el correo muestra los datos de la actividad y omite los vacíos', () => {
  const { enviados } = simular('2026-10-05', '2026-10-06');
  const c = enviados.find(x => x.id === '2');
  assert.match(c.asunto, /^POA Kids · Aviso anticipado: Actividad 2 \(23 de noviembre\)$/);
  assert.match(c.texto, /Buenos días, Ana Pérez y Luisa Mora:/);
  assert.match(c.texto, /Fecha de la actividad: lunes 23 de noviembre de 2026/);
  assert.match(c.texto, /Clasificación: ★★★ Grande/);
  assert.match(c.texto, /Descripción: Niños \/ Padres · PRIMER TRIMESTRE/);
  assert.match(c.texto, /Fecha límite de entrega del minuto a minuto: lunes 16 de noviembre de 2026/);
  const sinDatos = enviados.find(x => x.id === '3');
  assert.doesNotMatch(sinDatos.texto, /Objetivo:|Descripción:/);
});

test('una actividad en sábado recibe el seguimiento el lunes, en pasado', () => {
  const { enviados } = simular('2026-10-05', '2026-11-30');
  const s = enviados.find(c => c.id === '5' && c.fase === 'seguimiento');
  assert.equal(s.dia, '2026-11-23');
  assert.match(s.texto, /El sábado 21 de noviembre de 2026 correspondía la realización/);
});

test('el resumen diario pone los memorandos primero y lleva el acumulado', () => {
  const { resumenes } = simular('2026-10-05', '2026-11-30');
  const conMemo = resumenes.find(r => /MEMORANDOS/.test(r.texto));
  assert.ok(conMemo.texto.indexOf('MEMORANDOS') < (conMemo.texto.indexOf('URGENCIA') + 1 || Infinity));
  assert.match(resumenes.at(-1).texto, /Acumulado del año lectivo: \d+ actividades entregadas a tiempo · \d+ memorandos · \d+ actividades en seguimiento/);
});

test('no envía en pausa, antes del inicio, ni en días no laborables', () => {
  const base = { eventos: EVENTOS, clasificaciones: CLASES, avisos: {}, entregas: {}, contadorMemos: 0 };
  assert.equal(procesarDia({ ...base, config: { ...CONFIG, modo: 'pausado' } }, '2026-10-06').activo, false);
  assert.equal(procesarDia({ ...base, config: CONFIG }, '2026-10-02').activo, false);
  assert.equal(procesarDia({ ...base, config: CONFIG }, '2026-11-20').activo, false);
});
