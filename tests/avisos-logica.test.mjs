import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const Logica = new Function(readFileSync(new URL('../apps-script/Logica.js', import.meta.url), 'utf8') + '\nreturn Logica;')();

const NO_LABORABLES = ['2026-10-09', '2026-11-02', '2026-11-03', '2026-11-20', '2026-12-07',
  '2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25', '2026-12-28', '2026-12-29',
  '2026-12-30', '2026-12-31', '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-30', '2027-05-24'];
const cal = Logica.crearCalendario(NO_LABORABLES);
const resumen = plan => plan.fases.map(f => `${f.fase}:${f.dias}`).join(' ');

test('salta fines de semana y feriados al contar días hábiles', () => {
  assert.equal(cal.esHabil('2026-10-09'), false);
  assert.equal(cal.esHabil('2026-10-10'), false);
  assert.equal(cal.esHabil('2026-10-12'), true);
  assert.equal(cal.habilAnterior('2026-10-12'), '2026-10-08');
  assert.equal(cal.siguienteHabil('2026-12-19'), '2027-01-04');
  assert.equal(cal.habilesEntre('2026-11-16', '2026-11-23'), 4);
});

test('una actividad Grande que entra a tiempo sigue la tabla 50/30/15/5', () => {
  const plan = Logica.planificar('grande', '2027-06-01', '2026-10-05', cal);
  assert.equal(plan.comprimido, false);
  assert.equal(resumen(plan), 'anticipacion:50 recordatorio:30 urgencia:15 memo:5 seguimiento:0');
  const memo = plan.fases.find(f => f.fase === 'memo');
  assert.equal(cal.habilesEntre(memo.fecha, '2027-06-01'), 5);
  assert.equal(plan.fechaLimite, cal.habilAnterior(memo.fecha));
  assert.equal(plan.fases.at(-1).fecha, '2027-06-01');
});

test('Mediana y Pequeña usan sus propias tablas', () => {
  assert.equal(resumen(Logica.planificar('mediana', '2027-06-01', '2026-10-05', cal)),
    'anticipacion:30 recordatorio:18 urgencia:10 memo:3 seguimiento:0');
  assert.equal(resumen(Logica.planificar('pequena', '2027-06-01', '2026-10-05', cal)),
    'anticipacion:15 recordatorio:10 urgencia:5 memo:2 seguimiento:0');
});

// Lunes 3 de mayo de 2027 como entrada, sin feriados cerca: cada caso queda con N días exactos.
const entradaCon = n => {
  const inicio = '2027-06-21';
  return Logica.planificar('grande', inicio, cal.habilAntes(inicio, n), cal);
};

test('calendario comprimido con 12 días: 12 · 7 · 4 · 1 y memo', () => {
  const plan = entradaCon(12);
  assert.equal(plan.comprimido, true);
  assert.equal(resumen(plan), 'anticipacion:12 recordatorio:7 urgencia:4 memo:1 seguimiento:0');
});

test('con 6 días no hay memo: 6 · 4 · 2', () => {
  assert.equal(resumen(entradaCon(6)), 'anticipacion:6 recordatorio:4 urgencia:2 seguimiento:0');
});

test('con 3 días se omite el recordatorio para no enviar correos seguidos', () => {
  assert.equal(resumen(entradaCon(3)), 'anticipacion:3 urgencia:1 seguimiento:0');
});

test('con 1 o 2 días solo hay anticipación y seguimiento', () => {
  assert.equal(resumen(entradaCon(2)), 'anticipacion:2 seguimiento:0');
  assert.equal(resumen(entradaCon(1)), 'anticipacion:1 seguimiento:0');
});

test('el memo exige al menos 10 días hábiles', () => {
  assert.ok(entradaCon(10).fases.some(f => f.fase === 'memo'));
  assert.ok(!entradaCon(9).fases.some(f => f.fase === 'memo'));
  assert.equal(entradaCon(9).fechaLimite, cal.habilAnterior('2027-06-21'));
});

test('una Pequeña con 12 días también se comprime, porque su ventana es 15', () => {
  const plan = Logica.planificar('pequena', '2027-06-21', cal.habilAntes('2027-06-21', 12), cal);
  assert.equal(resumen(plan), 'anticipacion:12 recordatorio:7 urgencia:4 memo:1 seguimiento:0');
});

test('sin estrellas, el mismo día de la actividad o ya pasada: no se envía nada', () => {
  assert.equal(Logica.planificar(undefined, '2027-06-21', '2026-10-05', cal), null);
  assert.equal(Logica.planificar('ninguna', '2027-06-21', '2026-10-05', cal), null);
  assert.equal(Logica.planificar('grande', '2027-06-21', '2027-06-21', cal), null);
  assert.equal(Logica.planificar('grande', '2027-06-21', '2027-06-25', cal), null);
});

test('si la actividad cae en día no laborable, el seguimiento sale el siguiente hábil', () => {
  assert.equal(Logica.planificar('grande', '2026-11-20', '2026-10-05', cal).fases.at(-1).fecha, '2026-11-23');
  assert.equal(Logica.planificar('grande', '2027-01-09', '2026-10-05', cal).fases.at(-1).fecha, '2027-01-11');
});

test('al arrancar el 5 de octubre, una Grande del 23 de noviembre entra comprimida', () => {
  const plan = Logica.planificar('grande', '2026-11-23', '2026-10-05', cal);
  assert.equal(plan.comprimido, true);
  assert.equal(plan.disponibles, 31);
  assert.equal(plan.fases[0].fecha, '2026-10-05');
  assert.equal(resumen(plan), 'anticipacion:31 recordatorio:19 urgencia:9 memo:3 seguimiento:0');
});

test('acción del día: envía la fase vencida más avanzada y nunca repite', () => {
  const plan = entradaCon(12);
  const [ant, rec, urg] = plan.fases;
  assert.deepEqual(Logica.accionDelDia(plan, {}, ant.fecha, false), { enviar: 'anticipacion', omitir: [] });
  assert.deepEqual(Logica.accionDelDia(plan, { anticipacion: ant.fecha }, ant.fecha, false), { enviar: null, omitir: [] });
  assert.deepEqual(Logica.accionDelDia(plan, { anticipacion: ant.fecha }, urg.fecha, false),
    { enviar: 'urgencia', omitir: ['recordatorio'] });
  assert.deepEqual(Logica.accionDelDia(plan, {}, rec.fecha, true), { enviar: null, omitir: [] });
});
