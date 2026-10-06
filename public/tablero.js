
const D = window.__DATOS__;
const IS_SUPERADMIN = window.__ES_SUPERADMIN__ === true;
const GESTION = window.__GESTION__;
/* ---------------- constantes ---------------- */
const AREAS = ['KIDS','PRIMARIA','SECUNDARIA','DECE','MARKETING','RIESGOS','ZOOBOTANICA'];
const ACADEMIC = ['KIDS','PRIMARIA','SECUNDARIA'];
const META = {
  KIDS:        {label:'Kids',              cls:'a-kids',   color:'Celeste',  mono:'KD'},
  PRIMARIA:    {label:'Primaria',          cls:'a-prim',   color:'Rosado',   mono:'PR'},
  SECUNDARIA:  {label:'Secundaria',        cls:'a-sec',    color:'Turquesa', mono:'SC'},
  ZOOBOTANICA: {label:'Zoobotánica',       cls:'a-zoo',    color:'Verde',    mono:'ZB'},
  RIESGOS:     {label:'Gestión de Riesgos',cls:'a-riesgo', color:'Amarillo', mono:'GR'},
  DECE:        {label:'DECE',              cls:'a-dece',   color:'Morado',   mono:'DC'},
  MARKETING:   {label:'Marketing',         cls:'a-mkt',    color:'Naranja',  mono:'MK'},
};
/* Un área que no esté catalogada ya no rompe el tablero entero: se muestra con su
   propio código en vez de lanzar sobre META[...] indefinido. */
const meta = a => META[a] || {label:String(a||'—'), cls:'', color:'—', mono:String(a||'??').slice(0,2).toUpperCase()};
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MAIL = 'planificacion@eightacademy.edu.ec';
const COPIA = 'mibermeov@eightacademy.edu.ec';

/* Identidad de área: bloque sólido con monograma. Color + letra + posición fija,
   para que se distingan también impresas en blanco y negro o por un daltónico. */
function areaTag(a,opt){
  const m=meta(a);
  const cls='atag '+m.cls+((opt&&opt.only)?' only':'')+((opt&&opt.lg)?' lg':'');
  return `<span class="${cls}" title="${esc(m.label)}"><span class="mono-tk">${m.mono}</span><span class="aname">${esc(m.label)}</span></span>`;
}
/* Estado: píldora con contorno y glifo — gramática distinta de la identidad */
const GLYPH={good:'✓',warn:'!',justif:'▲',crit:'✕',absent:'○'};
const ESTADO={good:'Sincronizado',warn:'Requiere revisión',justif:'Diferencia justificada',crit:'Inconsistencia crítica',absent:'Ausente en un área'};
const sinEmoji = s => String(s||'').replace(/^\S+\s*/,'');
function statePill(cls,label){
  return `<span class="pill ${cls}"><span class="gl" aria-hidden="true">${GLYPH[cls]||''}</span>${esc(label)}</span>`;
}
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = iso => { if(!iso) return '—'; const [y,m,d]=iso.split('-').map(Number); return `${String(d).padStart(2,'0')} ${MESES[m-1]} ${y}`; };
const parseISO = iso => { const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d); };
/* siempre en horario local: toISOString() convierte a UTC y desplaza un día
   el calendario completo si el archivo se abre en un huso al este de Greenwich */
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays = (iso,n) => { const d=parseISO(iso); d.setDate(d.getDate()+n); return toISO(d); };
const endOf = e => e.end || e.start;   // varias vistas lo necesitaban por separado
const daysFromToday = iso => { if(!iso) return null; const t=new Date(); t.setHours(0,0,0,0); return Math.round((parseISO(iso)-t)/86400000); };

let ROLE=IS_SUPERADMIN?'admin':'directivo', MY_AREA='KIDS', cShow=40, rShow=40;
const hash = s => { let h=0; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return (h>>>0).toString(36); };
const getRev=()=>GESTION.estado.revisiones;

/* clasificación de complejidad de gestión por actividad (adición, no forma parte
   del POA original): grande=+3 meses, mediana=2 meses, pequeña=1 mes o menos */
const getClassMap=()=>GESTION.estado.clasificaciones;
const CLASS_META={
  grande:  {stars:'★★★', label:'Grande · más de 3 meses'},
  mediana: {stars:'★★',  label:'Mediana · 2 meses'},
  pequena: {stars:'★',   label:'Pequeña · 1 mes o menos'},
};
let currentClassEventId=null;
function classBadge(id){
  const c=getClassMap()[id];
  if(!c||!CLASS_META[c]) return '';
  return `<span class="class-badge cb-${c}" aria-hidden="true">${CLASS_META[c].stars}</span>`;
}
function toggleClassPanel(){
  const p=document.getElementById('classPanel'), btn=document.getElementById('dClassBtn');
  const willOpen=p.classList.contains('hidden');
  p.classList.toggle('hidden');
  btn.setAttribute('aria-expanded', willOpen?'true':'false');
}
function refreshClassUI(){
  const c=getClassMap()[currentClassEventId];
  document.querySelectorAll('#classPanel .class-opt').forEach(b=>b.classList.toggle('active', b.dataset.c===c));
  const btn=document.getElementById('dClassBtn');
  btn.className='class-tab'+(c?` cb-${c}`:'');
  document.getElementById('dClassStars').textContent = c?CLASS_META[c].stars:'';
  document.getElementById('dClassLabel').textContent = c?CLASS_META[c].label:'Clasificación';
}
/* minuto a minuto: la casilla detiene los avisos por correo */
const getEntregas=()=>GESTION.estado.entregas||{};
const getAvisos=()=>GESTION.estado.avisos||{};
const FASES_AVISO=[['anticipacion','Anticipación'],['recordatorio','Recordatorio'],['urgencia','Urgencia'],['memo','Memorando'],['seguimiento','Seguimiento']];
function estadoEntrega(id){
  const a=getAvisos()[id];
  if(a&&a.estado==='incumplida') return 'incumplida';
  return getEntregas()[id] ? 'entregada' : '';
}
/* Avisos del minuto a minuto, con el mismo módulo (logica-avisos.js) que usa el
   script de correo: la plataforma muestra exactamente las fechas que se envían. */
const NOMBRE_FASE=Object.fromEntries(FASES_AVISO);
const CAL_AVISOS = window.Logica ? Logica.crearCalendario(D.avisos.noLaborables) : null;
let SITUACIONES=null;
function situacion(e){
  const est=estadoEntrega(e.id), aviso=getAvisos()[e.id], clase=getClassMap()[e.id];
  let plan=null;
  if(CAL_AVISOS && CLASS_META[clase]){
    const desde = HOY_ISO < D.avisos.inicio ? D.avisos.inicio : HOY_ISO;
    plan = Logica.planificar(clase, e.start, (aviso&&aviso.entrada)||desde, CAL_AVISOS);
  }
  if(est) return {estado:est, plan};
  if(!plan) return null;
  const enviadas=(aviso&&aviso.fases)||{};
  const proxima=plan.fases.find(f=>!enviadas[f.fase] && f.fecha>=HOY_ISO)||null;
  return {estado: plan.fechaLimite<HOY_ISO ? 'vencida' : 'pendiente', plan, proxima};
}
function situaciones(){
  if(!SITUACIONES){
    SITUACIONES=new Map();
    dated.forEach(e=>{ const s=situacion(e); if(s) SITUACIONES.set(e.id,s); });
  }
  return SITUACIONES;
}
const habilesHasta = iso => CAL_AVISOS.habilesEntre(HOY_ISO, iso);
function resumenAvisos(){
  const todas=[...situaciones().values()];
  const pendientes=todas.filter(s=>s.estado==='pendiente'||s.estado==='vencida');
  return {
    pendientes,
    vencidas: pendientes.filter(s=>s.estado==='vencida'),
    porVencer: pendientes.filter(s=>s.estado==='pendiente' && habilesHasta(s.plan.fechaLimite)<=10)
  };
}
function textoEntrega(e){
  const s=situaciones().get(e.id);
  if(s&&s.estado==='incumplida') return `<b>No entregado</b> · actividad registrada como incumplida${getEntregas()[e.id]?' (se marcó como entregado después del seguimiento)':''}`;
  if(s&&s.estado==='entregada') return '<b>Entregado</b> · los avisos por correo están detenidos';
  if(s) return `<b>${s.estado==='vencida'?'Fecha límite vencida':'Pendiente'}</b> · entregar antes del ${fmt(s.plan.fechaLimite)} a ${MAIL} con copia a ${COPIA}`+
    (s.proxima?`<br>Próximo aviso: ${NOMBRE_FASE[s.proxima.fase]}, ${fmt(s.proxima.fecha)}`:'');
  if(!CLASS_META[getClassMap()[e.id]]) return 'Sin avisos por correo: la actividad no tiene clasificación';
  return 'Sin avisos por correo: la actividad ya pasó o no queda tiempo para avisar';
}
function textoAvisos(id){
  const a=getAvisos()[id];
  if(!a||!a.fases) return '';
  const filas=FASES_AVISO.filter(([f])=>a.fases[f]).map(([f,n])=>
    a.fases[f]==='omitida' ? `${n}: <i>omitida</i>` : `${n}: ${fmt(a.fases[f])}${f==='memo'&&a.memo?` · ${esc(a.memo)}`:''}`);
  return filas.join('<br>');
}
function refreshEntregaUI(){
  const btn=document.getElementById('dEntregaBtn');
  if(currentClassEventId==null||!IS_SUPERADMIN){ btn.classList.add('hidden'); return; }
  const marcado=!!getEntregas()[currentClassEventId];
  btn.classList.remove('hidden');
  btn.setAttribute('aria-pressed', marcado?'true':'false');
  document.getElementById('dEntregaLabel').textContent = marcado?'Minuto a minuto entregado':'Minuto a minuto';
}
async function toggleEntrega(){
  if(!IS_SUPERADMIN||currentClassEventId==null) return;
  const id=currentClassEventId;
  try { await GESTION.guardarEntrega(id, !getEntregas()[id]); }
  catch(error){ alert('No se pudo guardar la entrega: '+(error.code||error.message)); }
}
async function setClass(c){
  if(!IS_SUPERADMIN) return;
  if(currentClassEventId==null) return;
  const clase = getClassMap()[currentClassEventId]===c ? 'ninguna' : c;
  try { await GESTION.guardarClasificacion(currentClassEventId, clase); }
  catch(error){ alert('No se pudo guardar la clasificación: '+(error.code||error.message)); }
}

const dated = D.events.filter(e=>e.start);

/* ---------------- diálogo de detalle ---------------- */
if(typeof HTMLDialogElement==='undefined'){
  document.documentElement.classList.add('sin-dialog');
  document.querySelectorAll('dialog').forEach(d=>{
    d.showModal=()=>d.setAttribute('open','');
    d.close=()=>{ d.removeAttribute('open'); d.dispatchEvent(new Event('close')); };
  });
}
function openDetail(title, rows){
  document.getElementById('dTitle').textContent = title;
  document.getElementById('dBody').innerHTML = rows.filter(r=>r[1]).map(r=>`<dt>${esc(r[0])}</dt><dd>${r[1]}</dd>`).join('');
  document.getElementById('dBody').scrollTop=0;
  document.getElementById('detail').showModal();
  /* por defecto, sin clasificación visible; showEv la reactiva cuando aplica */
  currentClassEventId=null;
  document.getElementById('dClassBtn').classList.add('hidden');
  document.getElementById('dEntregaBtn').classList.add('hidden');
  document.getElementById('classPanel').classList.add('hidden');
}
function evRows(e){
  const badge = areaTag(e.area,{lg:true});
  return [
    ['Área', badge],
    ['Destacada', e.destacado ? '★ Actividad destacada' : ''],
    ['Editar', IS_SUPERADMIN ? `<a href="./editar-poa.html?id=${e.id}">Editar esta actividad</a>` : ''],
    ['Fechas', e.start ? (e.start===e.end?fmt(e.start):`${fmt(e.start)} – ${fmt(e.end)}`) : 'Sin fecha declarada'],
    ['Estado de la fecha', `${esc(e.dateStatus)}${e.dateNote?` · ${esc(e.dateNote)}`:''}`],
    ['Responsable', e.responsable ? `${esc(e.responsable)}<br><span class="trace">${esc(e.responsableFuente||'')}</span>` : '<i>No especificado en el POA</i>'],
    ['Público', esc(e.publico||'')],
    ['Objetivo asociado', esc(e.objetivo||'')],
    ['Unidad / pilar', esc(e.unidad||'')],
    ['Período', esc(e.periodo||'')],
    ['Prioridad', esc(e.prioridad||'')],
    ['Estado', esc(e.estado||'')],
    ['Observaciones', esc(e.notas||'')],
    ['Minuto a minuto', e.start ? textoEntrega(e) : ''],
    ['Avisos enviados', IS_SUPERADMIN ? textoAvisos(e.id) : ''],
    ['Texto original en el POA', `<span class="trace">${esc(e.original||'')}</span>`],
    ['Fuente', `<span class="trace">${esc(e.sourceFile)} · hoja «${esc(e.sourceSheet)}» · fila ${esc(e.sourceRow)}</span>`],
  ];
}

/* ---------------- motor de coincidencias entre áreas ---------------- */
const STOP = new Set(['de','del','la','el','los','las','y','o','en','a','para','con','por','al','un','una','the','of','and','su','sus','se','dia','dias','sede','sedes','todos','todas','nivel','niveles','interno','general','cada','for','to',
  /* nombres de área o sección: identifican al público, no a la actividad */
  'kids','primaria','secundaria','zoobotanica','zoo','botanica','dece','marketing','eight','academy','bgu','egbs']);
function canon(t){
  return (t||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9ñ ]/g,' ')
    .split(/\s+/).filter(w=>w && !STOP.has(w));
}
function tokens(t){
  const out=new Set();
  canon(t).forEach(w=>{ if(w.length>=4 || /^\d+$/.test(w)) out.add(w); });
  return out;
}
function digitsOf(set){ return [...set].filter(w=>/^\d+$/.test(w)).sort().join(','); }

/* Palabras como "salida", "campaña" o "feriado" aparecen en decenas de actividades
   distintas: pesan poco. Una palabra rara ("tomatis", "aladino") identifica de verdad
   a la actividad. Se pondera cada palabra por su rareza para no unir actividades
   que sólo comparten vocabulario genérico. */
let DF=new Map(), NDOC=1;
function idf(w){ const d=DF.get(w)||1; return Math.log(NDOC/d)+0.2; }
function wsum(set){ let s=0; set.forEach(w=>s+=idf(w)); return s; }
function similar(a,b){
  if(!a.size || !b.size) return false;
  const da=digitsOf(a), db=digitsOf(b);
  if(da && db && da!==db) return false;           // "Unidad 1" nunca es "Unidad 5"
  const shared=[...a].filter(w=>b.has(w));
  if(!shared.length) return false;
  const bestDf = Math.min(...shared.map(w=>DF.get(w)||1));
  if(bestDf > 8) return false;                    // sólo comparten vocabulario genérico
  if(!shared.some(w=>w.length>=5 && (DF.get(w)||1)<=8)) return false;
  const si=shared.reduce((s,w)=>s+idf(w),0);
  return si / Math.min(wsum(a),wsum(b)) >= 0.66;
}
function computeFamilies(){
  const items = dated
    .filter(e=>!e.recurrente && e.dateStatus!=='MES POR DEFINIR')
    .map(e=>({e,t:tokens(e.activity)})).filter(x=>x.t.size>0);
  DF=new Map(); NDOC=items.length||1;
  items.forEach(x=>x.t.forEach(w=>DF.set(w,(DF.get(w)||0)+1)));
  const clusters = [];
  items.forEach(x=>{
    let best=null;
    for(const c of clusters){ if(similar(x.t,c.tokens)){ best=c; break; } }
    if(best){ best.items.push(x.e); }
    else clusters.push({tokens:x.t, items:[x.e], name:x.e.activity});
  });
  const fams=[];
  clusters.forEach((c,idx)=>{
    const evs=c.items;
    const areas=[...new Set(evs.map(e=>e.area))];
    if(areas.length<2) return;
    const firsts=areas.map(a=>evs.filter(e=>e.area===a).sort((x,y)=>x.start.localeCompare(y.start))[0]);
    const starts=firsts.map(e=>parseISO(e.start).getTime());
    const spread=Math.round((Math.max(...starts)-Math.min(...starts))/86400000);
    let status,cls;
    if(spread===0){ status='🟢 Correctamente sincronizado'; cls='good'; }
    else if(spread<=3){ status='🟠 Diferencia justificada'; cls='justif'; }
    else if(spread<=21){ status='🟡 Requiere revisión'; cls='warn'; }
    else { status='🔴 Inconsistencia crítica'; cls='crit'; }
    const missing=ACADEMIC.filter(a=>!areas.includes(a));
    const academicHits=areas.filter(a=>ACADEMIC.includes(a)).length;
    if(academicHits===2 && missing.length===1 && spread<=21){
      status=`⚫ Ausente en ${meta(missing[0]).label}`; cls='absent';
    }
    fams.push({key:'f'+idx, name:c.name, areas, firsts, spread, status, cls, all:evs});
  });
  return fams.sort((a,b)=>b.spread-a.spread || a.name.localeCompare(b.name));
}

/* ---------------- motor de conflictos ---------------- */
function overlaps(a,b){ return a.start <= b.end && b.start <= a.end; }
function eachDay(e,fn){ let c=parseISO(e.start); const end=parseISO(endOf(e)); let g=0;
  while(c<=end && g<400){ fn(toISO(c)); c.setDate(c.getDate()+1); g++; } }

/* Un feriado o período de vacaciones vale para toda la institución, sin importar
   qué área lo haya escrito en su POA: se consolidan por fecha para no repetir
   el mismo choque una vez por cada área que lo declaró. */
function buildHolidayIndex(){
  const idx = {};
  dated.filter(e=>e.tags.holiday).forEach(e=>{
    eachDay(e,ds=>{ (idx[ds]=idx[ds]||[]).push(e); });
  });
  return idx;
}
function computeConflicts(){
  const evs = dated.filter(e=>!e.recurrente);
  const out = [];
  // A · actividad ordinaria dentro de un día declarado no laborable
  evs.filter(e=>!e.tags.holiday).forEach(a=>{
    const hits = [];
    eachDay(a,ds=>{ (HOL[ds]||[]).forEach(h=>{ if(h.area!==a.area) hits.push({ds,h}); }); });
    if(!hits.length) return;
    const names = [...new Set(hits.map(x=>`«${x.h.activity}» (${meta(x.h.area).label})`))];
    const days  = [...new Set(hits.map(x=>x.ds))].sort();
    // en una campaña larga el feriado es incidental; sólo importa si la actividad es
    // corta o si el período no laborable se come la mitad o más de sus días
    const dur = (a.duration||1);
    if(dur > 5 && (days.length / dur) < 0.5) return;
    out.push({sev:'CRÍTICA', a, b:hits[0].h, kind:'no-lectivo',
      why:`«${a.activity}» (${meta(a.area).label}) coincide con ${days.length===1?'el día':'los días'} ${days.map(fmt).join(', ')}, declarado no laborable por ${names.join(' / ')}.`});
  });
  // B y C · choques entre actividades de áreas distintas
  for(let i=0;i<evs.length;i++){
    for(let j=i+1;j<evs.length;j++){
      const a=evs[i], b=evs[j];
      if(a.area===b.area) continue;
      if(a.tags.holiday || b.tags.holiday) continue;
      if(!overlaps(a,b)) continue;
      let sev=null, why='';
      if(a.tags.institutional && b.tags.institutional){
        sev='ALTA'; why='Dos actividades institucionales de áreas distintas ocupan las mismas fechas.';
      } else {
        const shared=['evaluation','parents','cultural','extracurricular'].filter(t=>a.tags[t]&&b.tags[t]);
        if(shared.length){ sev='MEDIA'; why='Actividades del mismo tipo en áreas distintas sobre las mismas fechas: compiten por el mismo público o el mismo equipo.'; }
      }
      if(!sev) continue;
      out.push({sev,a,b,why,kind:'solapamiento'});
    }
  }
  const ord={'CRÍTICA':0,'ALTA':1,'MEDIA':2};
  return out.sort((x,y)=>ord[x.sev]-ord[y.sev] || x.a.start.localeCompare(y.a.start));
}

/* ---------------- carga semanal ---------------- */
/* Semana lectiva: la semana 1 empieza el lunes de la semana que contiene el
   1 de septiembre. Clave "AAAA-Wnn", con AAAA = año en que arranca el año lectivo. */
function lunesInicioLectivo(anio){
  const d=new Date(Date.UTC(anio,8,1));
  d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
  return d;
}
function semanaLectiva(d){
  const t=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
  let anio=d.getFullYear();
  if(t<lunesInicioLectivo(anio).getTime()) anio--;
  const w=1+Math.floor((t-lunesInicioLectivo(anio).getTime())/(7*86400000));
  return `${anio}-W${String(w).padStart(2,'0')}`;
}
function lunesDeSemana(clave){
  const [anio,w]=clave.split('-W').map(Number);
  const d=lunesInicioLectivo(anio);
  return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+(w-1)*7);
}
// Lo anterior al lunes de inicio (capacitación, planificación de agosto) es "previa".
let anioLectivo;
function nombreSemana(clave){
  if(anioLectivo===undefined){
    const fechas=dated.map(e=>e.start).sort();
    anioLectivo=Number(semanaLectiva(parseISO(fechas[fechas.length>>1])).slice(0,4));
  }
  const [anio,w]=clave.split('-W').map(Number);
  return anio<anioLectivo ? 'Semana previa' : `Semana ${w}`;
}
function loadLevel(n){
  if(n>=7) return {cls:'crit',label:'Sobrecarga'};
  if(n>=5) return {cls:'justif',label:'Elevada'};
  if(n===4) return {cls:'warn',label:'Moderada'};
  return {cls:'good',label:'Equilibrada'};
}
/* Se recorre día a día y se deduplica por semana: avanzar de 7 en 7 perdía la
   última semana de todo evento que cruzara el lunes sin durar 7 días completos. */
function computeLoads(){
  const m={};
  dated.forEach(e=>{
    const vistas=new Set();
    eachDay(e,ds=>{                       // recorrido de días: una sola implementación
      const w=semanaLectiva(parseISO(ds));
      if(vistas.has(w)) return;
      vistas.add(w);
      const k=e.area+'|'+w;
      (m[k]=m[k]||{area:e.area,week:w,n:0}).n++;
    });
  });
  return Object.values(m);
}

/* ---------------- matriz de riesgos (derivada de los datos) ---------------- */
function buildRisks(){
  const R=[];
  // 1 · desincronización entre áreas
  FAMS.filter(f=>f.cls!=='good').forEach(f=>{
    const detail = f.firsts.map(e=>`${meta(e.area).label}: ${fmt(e.start)}${e.start!==e.end?' – '+fmt(e.end):''}`).join(' · ');
    const prio = f.cls==='crit' ? 'CRÍTICA' : f.cls==='absent' ? 'ALTA' : f.cls==='warn' ? 'MEDIA' : 'BAJA';
    R.push({
      prio, cls:f.cls, title:`«${f.name}» no coincide entre áreas`,
      dato:`${detail}. Dispersión máxima: ${f.spread} días.`,
      hallazgo: f.status.replace(/^\S+\s*/,''),
      inferencia: f.cls==='absent'
        ? 'La actividad aparece en dos secciones académicas y no se localizó en la tercera: puede tratarse de una omisión o de una actividad que no aplica a ese nivel.'
        : f.spread>21
          ? 'La diferencia supera las tres semanas: es poco probable que responda sólo a una adaptación por nivel.'
          : 'La diferencia puede responder a una adaptación por nivel o a una desalineación real; la matriz no permite distinguirlo.',
      recomendacion: f.cls==='absent'
        ? 'Confirmar con Dirección Académica si corresponde incorporarla al área faltante.'
        : 'Definir si es una sola actividad institucional con fecha única o versiones por área, y unificar la denominación.',
      validacion:'Sí — requiere confirmación de Dirección Académica.',
      fuentes: f.firsts.map(e=>`${e.sourceFile} · ${e.sourceSheet} · fila ${e.sourceRow}`),
      evs: f.firsts
    });
  });
  // 2 · actividades dentro de vacaciones / feriados
  CONF.filter(c=>c.sev==='CRÍTICA').forEach(c=>{
    R.push({
      prio:'CRÍTICA', cls:'crit', title:`Actividad programada dentro de un período no lectivo`,
      dato:`${meta(c.a.area).label}: «${c.a.activity}» ${fmt(c.a.start)}${c.a.start!==c.a.end?' – '+fmt(c.a.end):''} · ${meta(c.b.area).label}: «${c.b.activity}» ${fmt(c.b.start)}${c.b.start!==c.b.end?' – '+fmt(c.b.end):''}`,
      hallazgo:c.why,
      inferencia:'Si el período no lectivo aplica a toda la institución, la actividad no podría ejecutarse en esas fechas.',
      recomendacion:'Verificar el alcance del feriado o vacación y reubicar la actividad, o declarar explícitamente que el período no aplica a esa área.',
      validacion:'Sí — requiere confirmación de la dirección de ambas áreas.',
      fuentes:[`${c.a.sourceFile} · fila ${c.a.sourceRow}`,`${c.b.sourceFile} · fila ${c.b.sourceRow}`],
      evs:[c.a,c.b]
    });
  });
  // 3 · semanas en sobrecarga
  const over = LOADS.filter(l=>l.n>=7);
  over.forEach(l=>{
    const evs = dated.filter(e=>e.area===l.area && semanaLectiva(parseISO(e.start))===l.week);
    R.push({
      prio:'MEDIA', cls:'warn', title:`${nombreSemana(l.week)} en sobrecarga para ${meta(l.area).label}`,
      dato:`${l.n} actividades activas en la misma semana: ${evs.slice(0,6).map(e=>'«'+e.activity+'»').join(', ')}${evs.length>6?'…':''}`,
      hallazgo:'La semana supera el umbral declarado de 7 actividades.',
      inferencia:'Una concentración así suele implicar solapamiento de equipos, espacios o público.',
      recomendacion:'Redistribuir las actividades no críticas de esa semana hacia semanas contiguas.',
      validacion:'Sí — la dirección del área debe confirmar la capacidad operativa real.',
      fuentes:[...new Set(evs.map(e=>e.sourceFile))],
      evs:evs.slice(0,8)
    });
  });
  // 4 · fechas que requieren validación
  dated.filter(e=>e.dateStatus==='REVISAR').forEach(e=>{
    R.push({
      prio:'CRÍTICA', cls:'crit', title:`Fecha dudosa en ${meta(e.area).label}: «${e.activity}»`,
      dato:`Texto original: «${e.original}». Fecha mostrada: ${fmt(e.start)}${e.start!==e.end?' – '+fmt(e.end):''}.`,
      hallazgo:'La celda de origen no permite determinar la fecha con certeza.',
      inferencia:e.dateNote||'La fecha almacenada es inconsistente con el resto del calendario.',
      recomendacion:'Confirmar la fecha con el área responsable y corregirla en el archivo POA original.',
      validacion:'Sí — validación externa requerida.',
      fuentes:[`${e.sourceFile} · ${e.sourceSheet} · fila ${e.sourceRow}`], evs:[e]
    });
  });
  // 5 · actividades sin responsable
  const noResp = D.events.filter(e=>!e.responsable && !e.recurrente);
  if(noResp.length){
    const byArea = {};
    noResp.forEach(e=>{ (byArea[e.area]=byArea[e.area]||[]).push(e); });
    Object.keys(byArea).forEach(a=>{
      R.push({
        prio:'MEDIA', cls:'warn', title:`${byArea[a].length} actividades sin responsable declarado en ${meta(a).label}`,
        dato: byArea[a].slice(0,8).map(e=>`«${e.activity}» (fila ${e.sourceRow})`).join(', ') + (byArea[a].length>8?'…':''),
        hallazgo:'La columna de responsable está vacía en el POA para estas filas.',
        inferencia:'Sin responsable declarado no es posible asignar el seguimiento ni la alerta de planificación.',
        recomendacion:'Completar la columna RESPONSABLE en el archivo POA del área.',
        validacion:'Sí — la define el área propietaria del POA.',
        fuentes:[...new Set(byArea[a].map(e=>e.sourceFile))], evs:byArea[a].slice(0,8)
      });
    });
  }
  // 6 · actividades sin fecha
  const noDate = D.events.filter(e=>!e.start);
  if(noDate.length){
    R.push({
      prio:'ALTA', cls:'warn', title:`${noDate.length} actividades sin fecha declarada`,
      dato: noDate.map(e=>`${meta(e.area).label}: «${e.activity}» (fila ${e.sourceRow})`).join(' · '),
      hallazgo:'La celda de fecha está vacía o indica sólo un período abierto.',
      inferencia:'No pueden ubicarse en el calendario ni recibir avisos del minuto a minuto.',
      recomendacion:'Definir la fecha en el POA o declararlas explícitamente como transversales de todo el año.',
      validacion:'Sí.', fuentes:[...new Set(noDate.map(e=>e.sourceFile))], evs:noDate
    });
  }
  const ord={'CRÍTICA':0,'ALTA':1,'MEDIA':2,'BAJA':3};
  R.sort((a,b)=>ord[a.prio]-ord[b.prio]);
  // identificador estable por contenido: las marcas de "revisado" sobreviven a una
  // regeneración de datos, cosa que un índice de array no hace
  R.forEach(r=>{ r._id = hash(`${r.prio}|${r.title}|${r.fuentes[0]||''}`); });
  return R;
}

/* ---------------- render ---------------- */
function renderHeroKpis(){
  const k=[[D.events.length,'Actividades auditadas'],[AREAS.length,'Áreas comparadas'],
           [RISKS.filter(r=>r.prio==='CRÍTICA').length,'Hallazgos críticos'],[resumenAvisos().pendientes.length,'Minuto a minuto pendientes']];
  document.getElementById('heroKpis').innerHTML=
    k.map(([n,l])=>`<div class="k"><div class="kn">${n}</div><div class="kl">${esc(l)}</div></div>`).join('');
}
function renderKpis(){
  const t=[
    [D.events.length,'Actividades en total','', 's3'],
    [FAMS.length,'Compartidas entre áreas','','s4'],
    [FAMS.filter(f=>f.cls==='good').length,'Sincronizadas','good','s4'],
    [FAMS.filter(f=>f.cls==='crit').length,'Inconsistencias críticas','crit','s4'],
    [CONF.filter(c=>c.sev==='CRÍTICA').length,'Choques críticos','crit','s6'],
    [RISKS.length,'Hallazgos en la matriz','','s7'],
    [resumenAvisos().pendientes.length,'Minuto a minuto pendientes','','s8'],
  ];
  document.getElementById('kpis').innerHTML = t.map(([n,l,c,a])=>`<a class="tile ${c}" href="#${a}"><div class="metric num">${n}</div><div class="label">${esc(l)}</div></a>`).join('');
  document.getElementById('hdr-count').textContent = D.events.length;
  document.getElementById('genDate').textContent = D.generated;
}
function renderAreaTiles(){
  document.getElementById('areaTiles').innerHTML = AREAS.map(a=>{
    const n=D.events.filter(e=>e.area===a).length;
    return `<a class="tile ${meta(a).cls}" href="#s3" onclick="document.getElementById('fArea').value='${a}';renderCal()"><div class="tarea">${areaTag(a)}<span class="trace">${meta(a).color}</span></div><div class="metric num">${n}</div><div class="label">actividades registradas</div></a>`;
  }).join('');
  document.getElementById('areaLegend').innerHTML = AREAS.map(a=>`<span class="legitem">${areaTag(a)}<span class="trace">${meta(a).color}</span></span>`).join('');
}
function renderSem(){
  const b={good:0,warn:0,justif:0,crit:0,absent:0};
  FAMS.forEach(f=>b[f.cls]++);

  document.getElementById('semCounts').innerHTML = Object.keys(b).map(k=>`<div class="tile"><div class="metric num">${b[k]}</div><div class="label stack-2">${statePill(k,ESTADO[k])}</div></div>`).join('');
}

function currentFilters(){
  return {
    month: document.getElementById('fMonth').value,
    area: document.getElementById('fArea').value,
    resp: document.getElementById('fResp').value,
    status: document.getElementById('fStatus').value,
    q: document.getElementById('fText').value.trim().toLowerCase(),
    hideRec: document.getElementById('fRecur').checked,
  };
}
function filtered(){
  const f=currentFilters();
  return dated.filter(e=>{
    if(f.area!=='ALL' && e.area!==f.area) return false;
    if(f.resp!=='ALL' && (e.responsable||'—')!==f.resp) return false;
    if(f.status!=='ALL' && e.dateStatus!==f.status) return false;
    if(f.hideRec && e.recurrente) return false;
    if(f.q && !`${e.activity} ${e.responsable||''} ${e.unidad||''} ${e.publico||''}`.toLowerCase().includes(f.q)) return false;
    return true;
  });
}
/* operable con ratón y con teclado: Enter o Espacio abren el detalle */
/* Una fila de tabla que abre detalle debe alcanzarse con el teclado. No lleva
   role="button" para no romper la semántica de la tabla. */
const filaActivable = fn => `tabindex="0" onclick="${fn}" `+
  `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${fn}}"`;
const activable = fn => `role="button" tabindex="0" onclick="${fn}" `+
  `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${fn}}"`;
function evHTML(e,mini){
  const cls = mini?'mev':'ev';
  const inf = (e.dateStatus==='INFERIDA'||e.dateStatus==='MES POR DEFINIR')?' inferida':'';
  const lbl = `${meta(e.area).label}: ${e.activity}, ${fmt(e.start)}`;
  const cId=getClassMap()[e.id];
  const ent=estadoEntrega(e.id);
  const lblc = (cId&&CLASS_META[cId] ? `, ${CLASS_META[cId].label}` : '') +
    (ent==='entregada' ? ', minuto a minuto entregado' : ent==='incumplida' ? ', incumplida: no se entregó el minuto a minuto' : '');
  return `<div class="${cls}${inf} ${meta(e.area).cls}${ent?' '+ent:''}" ${activable(`showEv(${e.id})`)} `+
    `aria-label="${esc(lbl+lblc)}" title="${esc(lbl+lblc)}">` +
    `<b class="evtk" aria-hidden="true">${meta(e.area).mono}</b>${e.destacado?'★ ':''}${esc(e.activity)}${classBadge(e.id)}</div>`;
}
window.showEv = id => { const e=D.events.find(x=>x.id===id); if(e){ openDetail(e.activity, evRows(e)); currentClassEventId=id; document.getElementById('dClassBtn').classList.remove('hidden'); refreshClassUI(); refreshEntregaUI(); } };
/* al cambiar el estado compartido, el detalle abierto se actualiza sin perder el scroll */
function refreshDetalleAbierto(){
  if(currentClassEventId==null||!document.getElementById('detail').hasAttribute('open')) return;
  const e=D.events.find(x=>x.id===currentClassEventId);
  if(!e) return;
  document.getElementById('dBody').innerHTML = evRows(e).filter(r=>r[1]).map(r=>`<dt>${esc(r[0])}</dt><dd>${r[1]}</dd>`).join('');
  refreshClassUI(); refreshEntregaUI();
}
function monthGrid(evs,y,m,mini){
  const first=new Date(y,m-1,1), dim=new Date(y,m,0).getDate(), lead=(first.getDay()+6)%7;
  const today=toISO(new Date());
  let h='';
  for(let i=0;i<lead;i++) h+=`<div class="${mini?'mday pad':'day pad'}"></div>`;
  for(let d=1;d<=dim;d++){
    const ds=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const list=evs.filter(e=>e.start<=ds && endOf(e)>=ds);
    const vacio = list.length?'':' vacio';
    const critico = (!mini && DIAS_CRITICOS.has(ds)) ? ' conflicto' : '';
    const esHoy = ds===HOY_ISO ? (mini?' today':' hoy') : '';
    const cab = mini
      ? `<div class="mdn">${d}</div>`
      : `<div class="dtop" ${activable(`showDia('${ds}')`)} aria-label="Ver las ${list.length} actividades del día ${d}"><span class="dn">${d}</span>${critico?'<span class="dmark" aria-hidden="true">CHOQUE</span>':''}${ds===HOY_ISO?'<span class="hoy-pill">HOY</span>':''}${list.length?`<span class="dmore" aria-hidden="true">${list.length}</span>`:''}</div>`;
    h+=`<div class="${mini?'mday':'day'}${esHoy}${vacio}${critico}">${cab}${list.map(e=>evHTML(e,mini)).join('')}</div>`;
  }
  return h;
}
function renderCal(){
  const mode=document.getElementById('viewMode').value;
  document.getElementById('unifiedView').classList.toggle('hidden',mode!=='unified');
  document.getElementById('compareView').classList.toggle('hidden',mode==='unified');
  const evs=filtered();
  const month=document.getElementById('fMonth').value;
  document.getElementById('calSub').textContent = `${evs.length} actividades coinciden con el filtro, de ${D.events.length} registradas. Cuando varias áreas tienen la misma actividad, todas se muestran: no se agrupan ni se ocultan duplicados.`;
  if(month==='ALL'){
    document.getElementById('calendar').innerHTML='<p class="empty">Elige un mes para ver el calendario día por día.</p>';
    document.getElementById('compareGrid').innerHTML='<p class="empty">Elige un mes para comparar.</p>';
    return;
  }
  const [y,m]=month.split('-').map(Number);
  if(mode==='unified'){
    document.getElementById('calendar').innerHTML=monthGrid(evs,y,m,false);
  } else {
    const cols = mode==='compare3'?ACADEMIC:AREAS;
    const g=document.getElementById('compareGrid');
    g.classList.toggle('wide', mode==='compare7');
    g.style.gridTemplateColumns = mode==='compare7' ? '' : 'repeat(3,minmax(0,1fr))';
    g.innerHTML = cols.map(a=>{
      const ae=evs.filter(e=>e.area===a);
      return `<div class="compare-col"><h3>${areaTag(a)}<span class="barmeta">${ae.length} act.</span></h3><div class="mini-cal">${monthGrid(ae,y,m,true)}</div></div>`;
    }).join('');
  }
}
function renderFamilies(){
  const f=document.getElementById('famStatus').value;
  const rows=FAMS.filter(x=>f==='ALL'||x.cls===f);
  document.getElementById('families').innerHTML = rows.map(x=>`<tr class="clickable" ${filaActivable(`showFam('${x.key}')`)}>
    <td><b>${esc(x.name)}</b></td>
    <td>${statePill(x.cls, sinEmoji(x.status))}</td>
    <td><div class="areadates">${x.firsts.map(e=>`<div class="ad">${areaTag(e.area)}<span class="mono">${fmt(e.start)}</span></div>`).join('')}</div></td>
    <td class="num">${x.spread} d</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin coincidencias con este filtro.</td></tr>';
}
window.showFam = k => {
  const f=FAMS.find(x=>x.key===k); if(!f) return;
  openDetail(f.name, [['Estado',statePill(f.cls, sinEmoji(f.status))],
    ...f.all.map(e=>[meta(e.area).label, `${esc(e.activity)}<br><span class="mono">${fmt(e.start)}${e.start!==e.end?' – '+fmt(e.end):''}</span><br><span class="trace">${esc(e.sourceFile)} · fila ${esc(e.sourceRow)}</span>`])]);
};
function renderConflicts(){
  const sev=document.getElementById('cSev').value, ar=document.getElementById('cArea').value;
  const rows=CONF.filter(c=>(sev==='ALL'||c.sev===sev)&&(ar==='ALL'||c.a.area===ar||c.b.area===ar));
  document.getElementById('cSub').textContent=`${rows.length} choques detectados (de ${CONF.length} en total) · mostrando ${Math.min(cShow,rows.length)}.`;
  document.getElementById('conflicts').innerHTML = rows.slice(0,cShow).map(c=>`<tr class="clickable" ${filaActivable(`showEv(${c.a.id})`)}>
    <td><span class="badge ${c.sev==='CRÍTICA'?'c':c.sev==='ALTA'?'a':'m'}">${c.sev}</span></td>
    <td>${areaTag(c.a.area)}</td>
    <td>${esc(c.a.activity)}</td>
    <td>${areaTag(c.b.area)}</td>
    <td>${esc(c.b.activity)}</td>
    <td class="num">${fmt(c.a.start)}${c.a.start!==c.a.end?'–'+fmt(c.a.end):''}<br>${fmt(c.b.start)}${c.b.start!==c.b.end?'–'+fmt(c.b.end):''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin choques con este filtro.</td></tr>';
}
function renderRisks(){
  const p=document.getElementById('rPrio').value, rev=getRev();
  const list=RISKS.filter(r=>p==='ALL'||r.prio===p);
  const pend=list.filter(r=>!rev[r._id]).length;
  document.getElementById('rSub').textContent =
    `${list.length} hallazgos con este filtro (${RISKS.length} en total) · ${pend} sin revisar · mostrando ${Math.min(rShow,list.length)}.`;
  document.getElementById('rMore').classList.toggle('hidden', rShow>=list.length);
  document.getElementById('risks').innerHTML = list.slice(0,rShow).map(r=>{
    const isR=!!rev[r._id];
    const bc=r.prio==='CRÍTICA'?'c':r.prio==='ALTA'?'a':r.prio==='MEDIA'?'m':'b';
    const pcls='p-'+r.prio.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const fila=(l,v)=>`<div class="fr"><div class="fl">${l}</div><div class="fv">${esc(v)}</div></div>`;
    return `<div class="finding ${pcls}${isR?' reviewed':''}">
      <div class="finding-head"><span class="title">${esc(r.title)}</span><span class="badge ${bc}">${r.prio}</span>${statePill(r.cls, ESTADO[r.cls]||'')}</div>
      <div class="finding-grid">
        ${fila('Dato de la matriz', r.dato)}
        ${fila('Hallazgo', r.hallazgo)}
        ${fila('Inferencia', r.inferencia)}
        ${fila('Recomendación', r.recomendacion)}
        ${fila('Validación humana', r.validacion)}
      </div>
      <p class="trace">Fuente: ${r.fuentes.map(esc).join(' · ')}</p>
      <div class="actions"><button class="ghost sm admin-only" onclick="toggleRev('${r._id}')">${isR?'Marcar pendiente':'Marcar revisado'}</button>${r.evs&&r.evs.length?`<button class="ghost sm" onclick="showEv(${r.evs[0].id})">Ver actividad</button>`:''}</div>
    </div>`;
  }).join('') || '<p class="sub">Sin hallazgos con este filtro.</p>';
}
window.toggleRev = async id => {
  if(!IS_SUPERADMIN) return;
  try { await GESTION.guardarRevision(id, !getRev()[id]); }
  catch(error){ alert('No se pudo guardar la revisión: '+(error.code||error.message)); }
};
const FILTRO_AVISOS={pendientes:['pendiente','vencida'],vencidas:['vencida'],entregadas:['entregada'],incumplidas:['incumplida']};
function insigniaAviso(s){
  if(!s) return '<span class="badge n">Sin estrellas</span>';
  if(s.estado==='entregada') return '<span class="badge b">Entregado</span>';
  if(s.estado==='incumplida') return '<span class="badge c">Incumplida</span>';
  if(s.estado==='vencida') return '<span class="badge c">Fecha límite vencida</span>';
  const n=habilesHasta(s.plan.fechaLimite);
  return `<span class="badge ${n<=5?'a':'n'}">${n===0?'Vence hoy':`Faltan ${n} días háb.`}</span>`;
}
function renderAlerts(){
  const cuerpo=document.getElementById('alerts');
  if(!CAL_AVISOS){ cuerpo.innerHTML='<tr><td colspan="7" class="muted">No se pudo cargar el calendario de avisos. Recarga la página.</td></tr>'; return; }
  const ar=document.getElementById('aArea').value, w=document.getElementById('aWin').value, sit=situaciones();
  let filas;
  if(w==='sin'){
    filas=dated.filter(e=>e.start>=HOY_ISO && !CLASS_META[getClassMap()[e.id]] && !sit.has(e.id)).map(e=>({e,s:null}));
  } else {
    filas=dated.filter(e=>sit.has(e.id)).map(e=>({e,s:sit.get(e.id)}));
    if(FILTRO_AVISOS[w]) filas=filas.filter(x=>FILTRO_AVISOS[w].includes(x.s.estado));
    if(w==='proximas') filas=filas.filter(x=>x.s.estado==='pendiente' && habilesHasta(x.s.plan.fechaLimite)<=10);
  }
  if(ar!=='ALL') filas=filas.filter(x=>x.e.area===ar);
  const clave=x=>(x.s&&x.s.plan&&(x.s.estado==='pendiente'||x.s.estado==='vencida') ? x.s.plan.fechaLimite : x.e.start);
  filas.sort((a,b)=>clave(a).localeCompare(clave(b)));
  cuerpo.innerHTML = filas.map(({e,s})=>{
    const clase=CLASS_META[getClassMap()[e.id]];
    const limite = s&&s.plan&&(s.estado==='pendiente'||s.estado==='vencida') ? fmt(s.plan.fechaLimite) : '—';
    const proximo = s&&s.proxima ? `${NOMBRE_FASE[s.proxima.fase]} · ${fmt(s.proxima.fecha)}` : '—';
    return `<tr class="clickable" ${filaActivable(`showEv(${e.id})`)}><td>${esc(e.activity)}</td>
      <td>${areaTag(e.area)}</td>
      <td class="num">${fmt(e.start)}</td>
      <td>${clase?`<span class="stars-cell cb-${getClassMap()[e.id]}" title="${esc(clase.label)}">${clase.stars}</span>`:'—'}</td>
      <td class="num">${limite}</td>
      <td>${esc(proximo)}</td>
      <td>${insigniaAviso(s)}</td></tr>`;
  }).join('') || '<tr><td colspan="7" class="muted">Ninguna actividad con este filtro.</td></tr>';
}
/* ---------------- ICS ---------------- */
/* RFC 5545 §3.3.11: en un valor TEXT, la barra, el punto y coma, la coma y el salto
   de línea son separadores y deben escaparse, o el título se corta en la primera coma. */
const ical = s => String(s==null?'':s)
  .replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,')
  .replace(/\r?\n/g,'\\n');
/* RFC 5545 §3.1: ninguna línea puede superar los 75 octetos; las continuaciones
   empiezan con un espacio. Se pliega tratando cada par de escape como indivisible. */
function fold(line){
  const enc=new TextEncoder();
  if(enc.encode(line).length<=75) return line;
  const toks=line.match(/\\.|[\s\S]/g)||[];
  const out=[]; let cur='';
  for(const t of toks){
    if(enc.encode(cur+t).length>73){ out.push(cur); cur=' '+t; }
    else cur+=t;
  }
  if(cur) out.push(cur);
  return out.join('\r\n');
}
function ics(area){
  const evs=dated.filter(e=>area==='ALL'||e.area===area);
  const dt=s=>s.replace(/-/g,'');
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const nombre=`Eight Academy · ${area==='ALL'?'Institucional (7 áreas)':meta(area).label} · 2026-2027`;
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Eight Academy//Calendario 2026-2027//ES',
           'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+ical(nombre),'X-WR-TIMEZONE:America/Guayaquil'];
  evs.forEach(e=>{
    const end=addDays(endOf(e),1);
    const desc=`Área: ${meta(e.area).label}\nResponsable: ${e.responsable||'no especificado'}\nFuente: ${e.sourceFile} (fila ${e.sourceRow})\nMinuto a minuto: enviar a ${MAIL} con copia a ${COPIA}`;
    L.push('BEGIN:VEVENT',
      `UID:ea-${e.id}@eightacademy.edu.ec`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dt(e.start)}`,
      `DTEND;VALUE=DATE:${dt(end)}`,
      'SUMMARY:'+ical(`[${meta(e.area).label}] ${e.activity}`),
      'DESCRIPTION:'+ical(desc),
      'CATEGORIES:'+ical(meta(e.area).label));
    // alarma el día de la fecha límite de entrega, a las 09:00 de Ecuador (14:00 UTC)
    const s=situaciones().get(e.id);
    if(s&&s.estado==='pendiente'){
      L.push('BEGIN:VALARM',`TRIGGER;VALUE=DATE-TIME:${dt(s.plan.fechaLimite)}T140000Z`,'ACTION:DISPLAY',
        'DESCRIPTION:'+ical(`Hoy vence la entrega del minuto a minuto: ${MAIL} con copia a ${COPIA}`),
        'END:VALARM');
    }
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n')+'\r\n';
}
window.dlIcs = (area, boton) => {
  const b=new Blob([ics(area)],{type:'text/calendar;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b); a.download=`Eight_Academy_2026-2027_${area}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  // la descarga es invisible: sin esta confirmación el usuario no sabe si funcionó
  if(boton){
    const n=dated.filter(e=>area==='ALL'||e.area===area).length;
    const txt=boton.textContent;
    boton.textContent=`Descargado · ${n} actividades`;
    boton.disabled=true;
    setTimeout(()=>{ boton.textContent=txt; boton.disabled=false; },2600);
  }
  const avi=document.getElementById('icsAviso');
  if(avi) avi.textContent=`Archivo .ics generado con ${dated.filter(e=>area==='ALL'||e.area===area).length} actividades. Búscalo en tu carpeta de descargas.`;
};

/* ---------------- roles / filtros ---------------- */
function applyRole(r){
  if(r==='admin' && !IS_SUPERADMIN) r='directivo';
  ROLE=r; document.body.dataset.role=r;
  const doc = r==='docente';
  document.getElementById('mySection').classList.toggle('hidden',!doc);
  document.getElementById('mySectionLabel').classList.toggle('hidden',!doc);
  const target = doc ? (document.getElementById('mySection').value||'KIDS') : 'ALL';
  document.getElementById('fArea').value=target;
  document.getElementById('aArea').value=target;
  renderCal(); renderAlerts(); sincronizarMstep();
}
function fillSelects(){
  const months=[...new Set(dated.map(e=>e.start.slice(0,7)))].sort();
  document.getElementById('fMonth').innerHTML='<option value="ALL">Todos los meses</option>'+months.map(m=>{const[y,mo]=m.split('-').map(Number);return `<option value="${m}">${MESES_L[mo-1]} ${y}</option>`}).join('');
  const areaOpts='<option value="ALL">Todas las áreas</option>'+AREAS.map(a=>`<option value="${a}">${meta(a).label}</option>`).join('');
  document.getElementById('fArea').innerHTML=areaOpts;
  document.getElementById('aArea').innerHTML=areaOpts;
  document.getElementById('cArea').innerHTML='<option value="ALL">Cualquier área</option>'+AREAS.map(a=>`<option value="${a}">${meta(a).label}</option>`).join('');
  document.getElementById('mySection').innerHTML=AREAS.map(a=>`<option value="${a}">${meta(a).label}</option>`).join('');
  const resps=[...new Set(dated.map(e=>e.responsable).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  document.getElementById('fResp').innerHTML='<option value="ALL">Todos los responsables</option>'+resps.map(r=>`<option>${esc(r)}</option>`).join('');
  const st=[...new Set(FAMS.map(f=>f.cls))];
  document.getElementById('famStatus').innerHTML='<option value="ALL">Todos los estados</option>'+st.map(s=>`<option value="${s}">${ESTADO[s]}</option>`).join('');
  document.getElementById('icsBtns').innerHTML=[['ALL','Institucional completo (7 áreas)']].concat(AREAS.map(a=>[a,meta(a).label]))
    .map(([v,l])=>`<button class="${v==='ALL'?'':'ghost'}" onclick="dlIcs('${v}',this)">.ics ${esc(l)}</button>`).join('');
}
function wire(){
  const roleSelect=document.getElementById('roleSelect');
  const adminOption=roleSelect.querySelector('option[value="admin"]');
  if(!IS_SUPERADMIN){ adminOption.disabled=true; adminOption.hidden=true; roleSelect.value='directivo'; }
  ['fMonth','fArea','fResp','fStatus','fText','fRecur','viewMode'].forEach(id=>document.getElementById(id).addEventListener('input',renderCal));
  document.getElementById('btnHoy').addEventListener('click',irAHoy);
  document.getElementById('clearFilters').addEventListener('click',()=>{
    document.getElementById('fMonth').value='ALL';
    document.getElementById('fArea').value=ROLE==='docente'?MY_AREA:'ALL';
    document.getElementById('fResp').value='ALL';
    document.getElementById('fStatus').value='ALL';
    document.getElementById('fText').value='';
    document.getElementById('fRecur').checked=false;
    sincronizarMstep();
    renderCal();
  });
  roleSelect.addEventListener('change',e=>applyRole(e.target.value));
  document.getElementById('mySection').addEventListener('change',e=>{MY_AREA=e.target.value;applyRole('docente')});
  document.getElementById('famStatus').addEventListener('change',renderFamilies);
  document.getElementById('cSev').addEventListener('change',()=>{cShow=40;renderConflicts()});
  document.getElementById('cArea').addEventListener('change',()=>{cShow=40;renderConflicts()});
  document.getElementById('cMore').addEventListener('click',()=>{cShow+=40;renderConflicts()});
  document.getElementById('rPrio').addEventListener('change',()=>{rShow=40;renderRisks()});
  document.getElementById('rMore').addEventListener('click',()=>{rShow+=40;renderRisks()});
  document.getElementById('rReset').addEventListener('click',async()=>{
    if(!IS_SUPERADMIN) return;
    try { await GESTION.restablecerRevisiones(); }
    catch(error){ alert('No se pudieron restablecer las revisiones: '+(error.code||error.message)); }
  });
  document.getElementById('aArea').addEventListener('change',renderAlerts);
  document.getElementById('aWin').addEventListener('change',renderAlerts);
}

let FAMS=[],CONF=[],LOADS=[],RISKS=[],HOL={};
function initScrollSpy(){
  const links=[...document.querySelectorAll('nav.quicknav a')];
  const secs=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if(!('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver(entries=>{
    entries.forEach(en=>{
      if(!en.isIntersecting) return;
      links.forEach(l=>l.classList.toggle('active', l.getAttribute('href')==='#'+en.target.id));
    });
  },{rootMargin:'-100px 0px -68% 0px'});
  secs.forEach(s=>io.observe(s));
}

/* ============================================================
   v3 · capa de lectura ejecutiva
   Todo se calcula desde D.events; ninguna cifra está escrita a mano.
   ============================================================ */

const HOY = (()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; })();
const HOY_ISO = toISO(HOY);
const SEMANA_HOY = semanaLectiva(HOY);
const MES_HOY = HOY_ISO.slice(0,7);

/* ---------- tooltip compartido por los gráficos ---------- */
let TT;
function tip(txt, ev){
  if(!TT){ TT=document.createElement('div'); TT.className='tt'; TT.setAttribute('role','status'); document.body.appendChild(TT); }
  TT.innerHTML=txt;
  TT.classList.add('on');
  const x=Math.min(ev.clientX+14, window.innerWidth-300);
  TT.style.left=x+'px';
  TT.style.top=Math.max(8, ev.clientY-14)+'px';
}
function tipOff(){ if(TT) TT.classList.remove('on'); }

/* ---------- 1 · panel "ahora mismo" ---------- */
function renderAhora(){
  const enSemana = dated.filter(e=>{
    let hit=false; eachDay(e,ds=>{ if(semanaLectiva(parseISO(ds))===SEMANA_HOY) hit=true; }); return hit;
  });
  const { vencidas, porVencer } = resumenAvisos();
  const futuros   = dated.filter(e=>daysFromToday(e.start)>=0).sort((a,b)=>a.start.localeCompare(b.start));
  const sig       = futuros[0];
  const diasSig   = sig ? daysFromToday(sig.start) : null;

  const tarjetas = [
    { cls: vencidas.length? 'urge':'calma', n: vencidas.length, l:'Entregas vencidas',
      x: vencidas.length? 'La fecha límite del minuto a minuto ya pasó' : 'Ningún minuto a minuto atrasado', href:'#s8' },
    { cls: porVencer.length? 'pronto':'calma', n: porVencer.length, l:'Vencen en 10 días hábiles',
      x:`Enviar a ${MAIL} con copia a ${COPIA}`, href:'#s8' },
    { cls:'', n: enSemana.length, l:`Actividades esta semana`,
      x: `${nombreSemana(SEMANA_HOY)} · ${fmt(HOY_ISO)}`, href:'#s3' },
    { cls: (sig && diasSig===0)?'pronto':'', n: sig? (diasSig===0? enSemana.filter(e=>e.start<=HOY_ISO && endOf(e)>=HOY_ISO).length : diasSig) : '—',
      l: sig? (diasSig===0? 'Actividades hoy' : 'Días para la próxima actividad') : 'Sin actividades futuras',
      x: sig? `${sig.activity.slice(0,52)} · ${meta(sig.area).label}` : '', href:'#s3' },
  ];
  document.getElementById('ahora').innerHTML = tarjetas.map(t=>
    `<a class="a ${t.cls}" href="${t.href}"><div class="an">${t.n}</div>`+
    `<div class="al">${esc(t.l)}</div><div class="ax">${esc(t.x)}</div></a>`).join('');
}

/* ---------- 2 · mapa de calor área × mes ---------- */
/* Magnitud sobre dos dimensiones: escala secuencial de un solo tono, con leyenda
   y el número dentro de cada celda (nunca color a solas). */
const MESES_AN = [[2026,8],[2026,9],[2026,10],[2026,11],[2026,12],
                  [2027,1],[2027,2],[2027,3],[2027,4],[2027,5],[2027,6],[2027,7]];
function matrizAreaMes(){
  const m={};
  AREAS.forEach(a=>{ m[a]={}; MESES_AN.forEach(([y,mo])=>{ m[a][`${y}-${String(mo).padStart(2,'0')}`]=0; }); });
  dated.forEach(e=>{
    const k=e.start.slice(0,7);
    if(m[e.area] && k in m[e.area]) m[e.area][k]++;
  });
  return m;
}
function pasoHeat(n,max){
  if(!n) return 0;
  const r=n/max;
  return r<=.2?1 : r<=.4?2 : r<=.6?3 : r<=.8?4 : 5;
}
function renderHeat(){
  const m=matrizAreaMes();
  const valores=[]; AREAS.forEach(a=>MESES_AN.forEach(([y,mo])=>valores.push(m[a][`${y}-${String(mo).padStart(2,'0')}`])));
  const max=Math.max(...valores,1);
  const cabecera=MESES_AN.map(([y,mo])=>`<th scope="col">${MESES[mo-1]}<br><span class="trace">${String(y).slice(2)}</span></th>`).join('');
  const filas=AREAS.map(a=>{
    const celdas=MESES_AN.map(([y,mo])=>{
      const k=`${y}-${String(mo).padStart(2,'0')}`, n=m[a][k];
      const p=pasoHeat(n,max);
      const et=`<b>${meta(a).label}</b><br>${MESES_L[mo-1]} ${y}: ${n} actividad${n===1?'':'es'}`;
      return `<td><div class="cell h${p}" tabindex="0" role="button" aria-label="${esc(meta(a).label)}, ${MESES_L[mo-1]} ${y}: ${n} actividades. Abrir el detalle del mes." onclick="showHeatMes('${a}','${k}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showHeatMes('${a}','${k}')}"`+
        ` onmousemove='tip(${JSON.stringify(et)},event)' onmouseleave="tipOff()"`+
        ` onfocus='tip(${JSON.stringify(et)},{clientX:this.getBoundingClientRect().left,clientY:this.getBoundingClientRect().top})' onblur="tipOff()">${n||''}</div></td>`;
    }).join('');
    return `<tr><th scope="row" class="ra">${areaTag(a)}</th>${celdas}</tr>`;
  }).join('');
  document.getElementById('heat').innerHTML =
    `<table><caption class="hidden">Actividades por área y mes</caption>`+
    `<thead><tr><th class="ra"></th>${cabecera}</tr></thead><tbody>${filas}</tbody></table>`;
  document.getElementById('heatLeyenda').innerHTML =
    `<span>Menos</span><span class="paso"><span class="h0" style="background:var(--surface-2)"></span>`+
    [1,2,3,4,5].map(i=>`<span style="background:var(--heat${i})"></span>`).join('')+
    `</span><span>Más · máximo ${max} actividades en un mes</span>`;
}

/* ---------- 3 · carga semanal con eje, umbral y semanas señaladas ---------- */
function renderLoads(){
  const cont=document.getElementById('loadChart');
  const semanas=[...new Set(LOADS.map(l=>l.week))].sort();
  const max=Math.max(...LOADS.map(l=>l.n),8);
  const W=980,H=132,PL=34,PR=10,PT=16,PB=30;
  const bw=(W-PL-PR)/semanas.length;
  const y=v=>PT+(H-PT-PB)*(1-v/max);

  cont.innerHTML = AREAS.map(a=>{
    const serie=LOADS.filter(l=>l.area===a);
    if(!serie.length) return '';
    const porSemana={}; serie.forEach(l=>porSemana[l.week]=l.n);
    const pico=Math.max(...serie.map(s=>s.n));
    const sobre=serie.filter(s=>s.n>=7).sort((x,z)=>z.n-x.n);

    const barras=semanas.map((w,i)=>{
      const n=porSemana[w]||0; if(!n) return '';
      const x=PL+i*bw, h=(H-PT-PB)-(y(n)-PT);
      const nivel=loadLevel(n);
      const et=`<b>${meta(a).label}</b><br>${nombreSemana(w)} · desde el ${fmt(toISO(lunesDeSemana(w)))}<br>${n} actividad${n===1?'':'es'} · ${nivel.label}`;
      return `<g><rect x="${(x+1).toFixed(1)}" y="${y(n).toFixed(1)}" width="${Math.max(bw-2,1.5).toFixed(1)}" height="${Math.max(h,2).toFixed(1)}" rx="2" fill="var(--c)"/>`+
        `<rect x="${x.toFixed(1)}" y="${PT}" width="${bw.toFixed(1)}" height="${H-PT-PB}" fill="transparent"`+
        ` onmousemove='tip(${JSON.stringify(et)},event)' onmouseleave="tipOff()"><title>${esc(`${nombreSemana(w)}: ${n} actividades`)}</title></rect></g>`;
    }).join('');

    // etiqueta directa sólo en la semana más cargada si supera el umbral
    let marca='';
    if(sobre.length){
      const s=sobre[0], i=semanas.indexOf(s.week);
      const x=PL+i*bw+bw/2;
      marca=`<g><circle cx="${x.toFixed(1)}" cy="${(y(s.n)-7).toFixed(1)}" r="3" fill="var(--crit)"/>`+
        `<text x="${x.toFixed(1)}" y="${(y(s.n)-14).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="var(--crit)" font-family="Source Sans 3">sem ${Number(s.week.split('-W')[1])} · ${s.n}</text></g>`;
    }

    // marcas de mes en el eje
    const ticks=[];
    semanas.forEach((w,i)=>{
      const lunes=lunesDeSemana(w);
      if(lunes.getDate()<=7){
        ticks.push(`<text x="${(PL+i*bw).toFixed(1)}" y="${H-10}" font-size="11" fill="var(--ink-3)" font-family="Source Sans 3">${MESES[lunes.getMonth()]}</text>`);
      }
    });

    return `<div class="${meta(a).cls} barblock">
      <div class="barhead">${areaTag(a)}<span class="barmeta">${serie.length} semanas con actividad · pico de ${pico}</span>${statePill(loadLevel(pico).cls, loadLevel(pico).label)}</div>
      <div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Carga semanal de ${esc(meta(a).label)}: pico de ${pico} actividades en una semana">
        <line x1="${PL}" y1="${H-PB}" x2="${W-PR}" y2="${H-PB}" stroke="var(--line-2)" stroke-width="1"/>
        <line x1="${PL}" y1="${y(7).toFixed(1)}" x2="${W-PR}" y2="${y(7).toFixed(1)}" stroke="var(--crit)" stroke-width="1" opacity=".55"/>
        <text x="${W-PR}" y="${(y(7)-5).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--crit)" font-family="Source Sans 3">umbral de sobrecarga · 7</text>
        <text x="0" y="${H-PB+4}" font-size="11" fill="var(--ink-3)" font-family="IBM Plex Mono">0</text>
        <text x="0" y="${PT+4}" font-size="11" fill="var(--ink-3)" font-family="IBM Plex Mono">${max}</text>
        ${ticks.join('')}${barras}${marca}
      </svg></div></div>`;
  }).join('');

  // tabla equivalente: ningún valor queda sólo en el tooltip
  const sobrecargadas=LOADS.filter(l=>l.n>=5).sort((a,b)=>b.n-a.n||a.week.localeCompare(b.week));
  document.getElementById('loadTabla').innerHTML = sobrecargadas.map(l=>{
    const nivel=loadLevel(l.n);
    return `<tr><td>${areaTag(l.area)}</td><td class="num">${esc(nombreSemana(l.week))}</td><td class="num">${l.n}</td><td>${statePill(nivel.cls,nivel.label)}</td></tr>`;
  }).join('') || '<tr><td colspan="4" class="muted">Ninguna semana supera las 4 actividades.</td></tr>';
  document.getElementById('loadTablaSub').textContent =
    `${sobrecargadas.length} semanas con 5 o más actividades, de ${LOADS.length} semanas registradas.`;
}

/* ---------- 4 · avance de validación ---------- */
function renderAvance(){
  const rev=getRev();
  const hechos=RISKS.filter(r=>rev[r._id]).length;
  const pct=RISKS.length? Math.round(hechos/RISKS.length*100) : 0;
  const criticosPend=RISKS.filter(r=>r.prio==='CRÍTICA' && !rev[r._id]).length;
  document.getElementById('avance').innerHTML =
    `<div class="at"><span class="atl">Avance de la validación por Dirección Académica</span>`+
    `<span class="atv">${hechos} de ${RISKS.length} · ${pct}%</span></div>`+
    `<div class="track"><div class="fill" style="width:${pct}%"></div></div>`+
    `<div class="hint">${criticosPend? `Quedan ${criticosPend} hallazgos críticos sin revisar.` : 'Todos los hallazgos críticos están revisados.'} `+
    `El avance se sincroniza entre administradores.</div>`;
}

/* ---------- 5 · días del calendario con conflicto crítico ---------- */
let DIAS_CRITICOS=new Set();
function marcarDiasCriticos(){
  DIAS_CRITICOS=new Set();
  CONF.filter(c=>c.sev==='CRÍTICA').forEach(c=>{
    eachDay(c.a,ds=>DIAS_CRITICOS.add(ds));
  });
}
function irAHoy(){
  const sel=document.getElementById('fMonth');
  const tiene=[...sel.options].some(o=>o.value===MES_HOY);
  sel.value = tiene ? MES_HOY : sel.options[1]?.value || 'ALL';
  document.getElementById('viewMode').value='unified';
  renderCal();
  sincronizarMstep();
  const hoy=document.querySelector('.day.hoy') || document.getElementById('s3');
  hoy.scrollIntoView({block:'center', behavior:'smooth'});
}


/* ============================================================
   v4 · capa táctil
   Todo lo que antes dependía de hover, de un puntero fino o de
   un tooltip tiene aquí un equivalente que se puede tocar.
   ============================================================ */

/* ---------- paso de mes ---------- */
function mesesDisponibles(){
  return [...document.getElementById('fMonth').options].map(o=>o.value).filter(v=>v!=='ALL');
}
function etiquetaMes(v){
  if(v==='ALL') return 'Todos los meses';
  const [y,mo]=v.split('-').map(Number);
  return `${MESES_L[mo-1][0].toUpperCase()}${MESES_L[mo-1].slice(1)} ${y}`;
}
function sincronizarMstep(){
  const v=document.getElementById('fMonth').value, ms=mesesDisponibles(), i=ms.indexOf(v);
  const n = v==='ALL' ? filtered().length
          : filtered().filter(e=>e.start.slice(0,7)<=v && endOf(e).slice(0,7)>=v).length;
  document.getElementById('mLabel').innerHTML =
    `${esc(etiquetaMes(v))}<span class="mcount">${n} actividad${n===1?'':'es'} con el filtro actual</span>`;
  document.getElementById('mPrev').disabled = i<=0;
  document.getElementById('mNext').disabled = i<0 || i>=ms.length-1;
}
function pasoMes(delta){
  const sel=document.getElementById('fMonth'), ms=mesesDisponibles();
  const i=ms.indexOf(sel.value);
  if(i<0){ sel.value = ms.includes(MES_HOY) ? MES_HOY : ms[0]; }
  else { const j=i+delta; if(j<0||j>=ms.length) return; sel.value=ms[j]; }
  renderCal(); sincronizarMstep();
  try{ if(navigator.vibrate) navigator.vibrate(8); }catch(e){}
}

/* ---------- deslizar para cambiar de mes ----------
   Sólo se toma el gesto si es claramente horizontal y no ocurre dentro
   de algo que ya se desplaza a lo ancho (comparada de 7, tablas, mapa). */
function activarDeslizamiento(el){
  let x0=null,y0=null,t0=0;
  el.addEventListener('touchstart',ev=>{
    if(ev.touches.length!==1){ x0=null; return; }
    x0=ev.touches[0].clientX; y0=ev.touches[0].clientY; t0=Date.now();
  },{passive:true});
  el.addEventListener('touchend',ev=>{
    if(x0===null) return;
    const dx=ev.changedTouches[0].clientX-x0, dy=ev.changedTouches[0].clientY-y0;
    x0=null;
    if(Date.now()-t0>700) return;
    if(Math.abs(dx)<70 || Math.abs(dx)<Math.abs(dy)*1.8) return;
    if(ev.target.closest && ev.target.closest('.compare-grid, .scroll, .heat')) return;
    pasoMes(dx<0?1:-1);
  },{passive:true});
}

/* ---------- ficha de un día completo ----------
   En la rejilla del mes una celda recorta las actividades cuando son muchas.
   Tocar la cabecera del día abre la lista entera. */
function itemActividad(e){
  return `<div class="dia-it ${meta(e.area).cls}" ${activable(`showEv(${e.id})`)} `+
    `aria-label="${esc(meta(e.area).label)}: ${esc(e.activity)}">`+
    `${areaTag(e.area,{only:true})}<div class="dia-tx"><b>${esc(e.activity)}</b>`+
    `<span class="trace">${esc(meta(e.area).label)} · ${e.responsable?esc(e.responsable):'sin responsable declarado'} · ${esc(e.dateStatus)}</span>`+
    `</div></div>`;
}
window.showDia = ds => {
  const evs = filtered().filter(e=>e.start<=ds && endOf(e)>=ds)
                        .sort((a,b)=>AREAS.indexOf(a.area)-AREAS.indexOf(b.area));
  const aviso = DIAS_CRITICOS.has(ds)
    ? '<span class="badge c">Choque crítico entre áreas</span>' : '';
  openDetail(fmt(ds), [
    ['Atención', aviso],
    [`${evs.length} actividad${evs.length===1?'':'es'} en el día`,
      evs.length ? `<div class="dia-lista">${evs.map(itemActividad).join('')}</div>`
                 : '<i>Ninguna actividad coincide con los filtros activos.</i>']
  ]);
};

/* ---------- ficha de una celda del mapa de calor ----------
   El tooltip no existe sin ratón: la celda se toca y se abre. */
window.showHeatMes = (a,k) => {
  const evs = dated.filter(e=>e.area===a && e.start.slice(0,7)===k)
                   .sort((x,y)=>x.start.localeCompare(y.start));
  const [y,mo]=k.split('-').map(Number);
  openDetail(`${meta(a).label} · ${etiquetaMes(k)}`, [
    [`${evs.length} actividad${evs.length===1?'':'es'}`,
      evs.length ? `<div class="dia-lista">${evs.map(itemActividad).join('')}</div>`
                 : '<i>Sin actividades registradas en ese mes.</i>'],
    ['Ir al calendario',
      `<button type="button" onclick="verMesArea('${k}','${a}')">Abrir ${esc(etiquetaMes(k))} filtrado por ${esc(meta(a).label)}</button>`]
  ]);
};
function verMesArea(k,a){
  document.getElementById('detail').close();
  document.getElementById('fMonth').value=k;
  document.getElementById('fArea').value=a;
  document.getElementById('viewMode').value='unified';
  renderCal(); sincronizarMstep();
  document.getElementById('s3').scrollIntoView({behavior:'smooth',block:'start'});
}

/* ---------- arranque de la capa táctil ---------- */
function initTactil(){
  document.getElementById('mPrev').addEventListener('click',()=>pasoMes(-1));
  document.getElementById('mNext').addEventListener('click',()=>pasoMes(1));
  ['fMonth','fArea','fResp','fStatus','fText','fRecur','viewMode']
    .forEach(id=>document.getElementById(id).addEventListener('input',sincronizarMstep));
  activarDeslizamiento(document.getElementById('unifiedView'));
  activarDeslizamiento(document.getElementById('compareView'));
  /* la ficha se abre siempre desde arriba, no donde quedó la anterior */
  document.getElementById('detail').addEventListener('close',()=>{
    const b=document.getElementById('dBody'); if(b) b.scrollTop=0;
  });
  sincronizarMstep();
}
function init(){
  const inicioRender = performance.now();
  try{
    HOL=buildHolidayIndex();
    FAMS=computeFamilies();
    CONF=computeConflicts();
    LOADS=computeLoads();
    RISKS=buildRisks();
    marcarDiasCriticos();
    fillSelects(); wire();
    const selMes=document.getElementById('fMonth');
    selMes.value=[...selMes.options].some(o=>o.value===MES_HOY) ? MES_HOY : '2026-09';
    renderHeroKpis(); renderKpis(); renderAhora(); renderHeat(); renderAvance(); renderAreaTiles(); renderSem();
    renderFamilies(); renderLoads(); renderConflicts();
    renderRisks();
    // applyRole() ya dispara renderCal() y renderAlerts(): no se repetían aquí
    applyRole(IS_SUPERADMIN?'admin':'directivo'); initScrollSpy(); initTactil();
    // Al arrancar llegan varias colecciones casi a la vez: se repinta una sola vez por cuadro.
    let repintado=0;
    GESTION.suscribir(estado => {
      if(estado.error){
        const aviso=document.getElementById('rSub');
        if(aviso) aviso.textContent='No se pudo sincronizar el estado compartido: '+(estado.error.code||estado.error.message);
        return;
      }
      SITUACIONES=null;
      if(repintado) return;
      repintado=requestAnimationFrame(()=>{
        repintado=0;
        renderRisks(); renderAvance(); renderCal();
        renderHeroKpis(); renderKpis(); renderAhora(); renderAlerts();
        refreshDetalleAbierto();
      });
    });
    console.info(`POA: cálculo y presentación en ${Math.round(performance.now() - inicioRender)} ms`);
  }catch(err){
    document.querySelector('main').insertAdjacentHTML('afterbegin',
      `<section class="errbox"><h2>Error al cargar el tablero</h2><p class="sub">${esc(err.message)}</p></section>`);
    console.error(err);
  }
}
init();
