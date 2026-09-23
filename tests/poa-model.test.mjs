import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, normalizeEvent, detectColumns, rowsToCandidates, textToCandidates } from '../public/poa-model.mjs';

test('convierte fechas ecuatorianas y de Excel sin desplazarlas',()=>{
  assert.equal(parseDate('23/09/2026'),'2026-09-23');
  assert.equal(parseDate('2026-02-30'),'');
  assert.equal(parseDate(25569),'1970-01-01');
});

test('calcula duración y alerta cuando se sustituyen fechas',()=>{
  const base=normalizeEvent({area:'KIDS',activity:'Capacitación',start:'2026-10-20',end:'2026-10-21',planning:'SÍ'},765);
  assert.equal(base.duration,2);
  assert.equal(base.reminder,'2026-10-05');
  const edited=normalizeEvent({...base,start:'2026-11-02',end:'2026-11-04'},765,base);
  assert.equal(edited.duration,3);
  assert.equal(edited.reminder,'2026-10-18');
  assert.equal(edited.dateStatus,'CORREGIDA');
  assert.throws(()=>normalizeEvent({...base,start:'2026-12-01',end:'2026-11-01'},765,base),/posterior/);
});

test('mapea filas de Excel a actividades con origen y área',()=>{
  const rows=[['Actividad','Fecha inicio','Fecha fin','Responsable'],['Taller docente','01/10/2026','02/10/2026','Dirección']];
  const columns=detectColumns(rows[0]);
  const candidates=rowsToCandidates(rows,columns,'PRIMARIA','plan.xlsx','Hoja 1');
  assert.deepEqual(candidates.map(({activity,start,end,area,sourceRow})=>({activity,start,end,area,sourceRow})),[
    {activity:'Taller docente',start:'2026-10-01',end:'2026-10-02',area:'PRIMARIA',sourceRow:2}
  ]);
});

test('extrae propuestas con fechas explícitas de un Word o PDF',()=>{
  const candidates=textToCandidates('Capacitación de seguridad 14/10/2026 al 15/10/2026\nTexto sin fecha', 'RIESGOS','plan.docx');
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].start,'2026-10-14');
  assert.equal(candidates[0].end,'2026-10-15');
});
