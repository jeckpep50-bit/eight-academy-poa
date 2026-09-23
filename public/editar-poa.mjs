import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { CONFIG, DOMINIO, SUPERADMINS, AREAS } from './config.js';
import { detectColumns, rowsToCandidates, textToCandidates, compact, parseDate } from './poa-model.mjs';
import { applyChanges } from './poa-store.mjs';

const $=selector=>document.querySelector(selector);
const app=initializeApp(CONFIG), auth=getAuth(app), db=getFirestore(app);
const admin=user=>user?.emailVerified && user.email?.toLowerCase().endsWith('@'+DOMINIO) &&
  SUPERADMINS.includes(user.email.toLowerCase());
let events=[], version='', selectedId=null, dirty=false, stale=false, saving=false;
let initialId=Number(new URLSearchParams(location.search).get('id'))||null;
let extracted=null, fileName='', preview=[], matchVersion='', unsub=null;
const fields=['activity','area','responsable','start','end','publico','objetivo','unidad','periodo','prioridad','estado','planning','notas'];
const labels={activity:'Actividad',start:'Inicio',end:'Fin',area:'Área',responsable:'Responsable',publico:'Público',objetivo:'Objetivo',prioridad:'Prioridad',estado:'Estado',unidad:'Unidad',periodo:'Período',notas:'Notas'};

function message(text,kind='') { $('#message').textContent=text; $('#message').className='message '+kind; }
function option(value,label=value) { const el=document.createElement('option');el.value=value;el.textContent=label;return el; }
function node(tag,className='',content='') { const el=document.createElement(tag);if(className) el.className=className;el.textContent=content;return el; }
function setBusy(busy) { saving=busy; document.querySelectorAll('button').forEach(button=>{if(button.id!=='tabActivities'&&button.id!=='tabImport')button.disabled=busy;}); }
function showTab(which) {
  const importTab=which==='import';
  $('#activities').hidden=importTab;$('#importPanel').hidden=!importTab;
  $('#tabActivities').setAttribute('aria-selected',String(!importTab));
  $('#tabImport').setAttribute('aria-selected',String(importTab));
}
$('#tabActivities').addEventListener('click',()=>showTab('activities'));
$('#tabImport').addEventListener('click',()=>showTab('import'));
for(const selector of ['#filterArea','#defaultArea','[name=area]']) {
  const select=$(selector);for(const area of AREAS)select.append(option(area));
}

async function loadData() {
  const [meta,...parts]=await Promise.all([getDoc(doc(db,'meta','general')),...AREAS.map(area=>getDoc(doc(db,'poa',area)))]);
  if (!meta.exists()||parts.some(part=>!part.exists())) throw new Error('El POA está incompleto en Firestore.');
  const nextVersion=meta.data().subidoEl;
  if (dirty && version && nextVersion!==version) {
    stale=true;message('Otro administrador actualizó el POA. Copia tus cambios si los necesitas y recarga esta página antes de guardar.','error');return;
  }
  version=nextVersion;
  events=parts.flatMap(part=>part.data().events||[]).sort((a,b)=>a.id-b.id);
  if(initialId&&events.some(event=>event.id===initialId)){selectedId=initialId;initialId=null;}
  stale=false;
  renderList();
  if (selectedId && !events.some(event=>event.id===selectedId)) selectedId=null;
  if (selectedId && !dirty) fillForm(events.find(event=>event.id===selectedId));
  if (matchVersion && matchVersion!==version && preview.length) {
    preview=[];$('#previewPanel').hidden=true;
    message('Los datos cambiaron. Vuelve a preparar la vista previa del documento.','error');
  } else message(`${events.filter(event=>!event.archivado).length} actividades vigentes. Los cambios se sincronizan entre administradores.`,'ok');
}

function renderList() {
  const query=compact($('#search').value), area=$('#filterArea').value;
  const visible=events.filter(event=>(!event.archivado||$('#showArchived').checked) &&
    (!area||event.area===area) &&
    (!query||compact([event.activity,event.responsable,event.id].join(' ')).includes(query)));
  const list=$('#activityList');list.replaceChildren();
  $('#listCount').textContent=`${visible.length} actividades mostradas`;
  for(const event of visible.slice(0,300)) {
    const button=node('button','activity'+(event.id===selectedId?' active':'')+(event.archivado?' archived':''));
    button.type='button';
    const title=node('strong','',`${event.destacado?'★ ':''}${event.activity}`);
    if(event.destacado) title.classList.add('star');
    const detail=node('small','',`${event.area} · ${event.start||'Sin fecha'}${event.archivado?' · Archivada':''} · #${event.id}`);
    button.append(title,detail);button.addEventListener('click',()=>selectEvent(event.id));list.append(button);
  }
  if(visible.length>300)list.append(node('p','hint','Refina la búsqueda para ver más resultados.'));
}
['#search','#filterArea','#showArchived'].forEach(selector=>$(selector).addEventListener('input',renderList));

function fillForm(event) {
  const form=$('#eventForm');
  for(const name of fields) form.elements[name].value=event?.[name]??(name==='planning'?'VALIDAR':'');
  form.elements.recurrente.checked=event?.recurrente===true;
  form.elements.destacado.checked=event?.destacado===true;
  $('#formTitle').textContent=event?`${event.archivado?'Archivada · ':''}Editar actividad #${event.id}`:'Nueva actividad';
  $('#formHint').textContent=event?`Origen: ${event.sourceFile||'Edición manual'} · ${event.sourceSheet||'—'} · fila ${event.sourceRow||'—'}`:
    'Completa la actividad y sus fechas. Al guardar, se actualizarán los tableros abiertos.';
  $('#addDate').hidden=!event||event.archivado;
  $('#archiveActivity').hidden=!event||event.archivado;
  $('#restoreActivity').hidden=!event||!event.archivado;
  $('#saveActivity').disabled=event?.archivado===true;
  dirty=false;renderList();
}
function selectEvent(id) {if(dirty&&!confirm('Hay cambios sin guardar. ¿Descartarlos?'))return;selectedId=id;fillForm(events.find(event=>event.id===id));}
$('#newActivity').addEventListener('click',()=>{if(dirty&&!confirm('Hay cambios sin guardar. ¿Descartarlos?'))return;selectedId=null;fillForm(null);});
$('#eventForm').addEventListener('input',()=>{dirty=true;});
function formData() {
  const form=$('#eventForm'),data={};for(const key of fields)data[key]=form.elements[key].value;
  data.recurrente=form.elements.recurrente.checked;
  data.destacado=form.elements.destacado.checked;
  return data;
}
async function saveChanges(changes,options={}) {
  if(stale) throw new Error('La versión cambió. Recarga antes de guardar.');
  setBusy(true);
  try {
    const result=await applyChanges(db,auth.currentUser,version,changes,options);
    dirty=false;version='';await loadData();
    message(`${changes.length} cambio(s) guardado(s). Los tableros se actualizarán automáticamente.${result.version?' Versión '+result.version+'.':''}`,'ok');
    return result;
  } finally {setBusy(false);}
}
$('#eventForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!admin(auth.currentUser))return;
  try {
    const result=await saveChanges([{op:selectedId?'update':'add',id:selectedId,data:formData()}],{label:'Edición manual'});
    selectedId=result.ids[0];fillForm(events.find(item=>item.id===selectedId));
  } catch(error){message(error.message||error.code,'error');}
});
$('#addDate').addEventListener('click',()=>{
  if(!selectedId)return;
  const old=events.find(event=>event.id===selectedId);
  if(!old)return;
  selectedId=null;fillForm({...old,start:'',end:'',archivado:false});
  $('#formTitle').textContent='Otra fecha para la actividad';
  $('#formHint').textContent='Añade las nuevas fechas. Se creará una segunda entrada y se conservará la original.';
  $('#addDate').hidden=true;
  dirty=true;
});
for(const [selector,op,label] of [['#archiveActivity','archive','archivar'],['#restoreActivity','restore','restaurar']]) {
  $(selector).addEventListener('click',async()=>{
    if(!selectedId||!confirm(`¿Quieres ${label} esta actividad?`))return;
    try {await saveChanges([{op,id:selectedId}],{label:`${label} actividad`});fillForm(events.find(event=>event.id===selectedId));}
    catch(error){message(error.message||error.code,'error');}
  });
}

async function readFile() {
  const file=$('#file').files[0];if(!file)return;
  fileName=file.name;preview=[];$('#previewPanel').hidden=true;
  $('#mappingPanel').hidden=true;$('#extracted').hidden=true;
  message(`Leyendo ${file.name} solo en este navegador…`);
  try {
    const {extractFile}=await import('./importer.bundle.mjs');
    extracted=await extractFile(file);
    $('#sheet').replaceChildren();
    for(let i=0;i<extracted.sheets.length;i++)$('#sheet').append(option(String(i),extracted.sheets[i].name));
    if(extracted.text){$('#sheet').append(option('text','Texto extraído'));$('#extractedText').textContent=extracted.text.slice(0,40000);$('#extracted').hidden=false;}
    if(!extracted.sheets.length&&!extracted.text)throw new Error('No se encontró texto ni tablas legibles.');
    $('#sheet').value=extracted.sheets.length?'0':'text';
    chooseSheet();
    message(`${file.name} leído localmente. Prepara y revisa los cambios antes de aprobar.`,'ok');
  } catch(error){extracted=null;message('No se pudo procesar el archivo: '+error.message,'error');}
}
$('#file').addEventListener('change',readFile);
$('#sheet').addEventListener('change',chooseSheet);

function chooseSheet() {
  preview=[];$('#previewPanel').hidden=true;
  const selected=$('#sheet').value;
  if(!extracted)return;
  if(selected==='text') {
    $('#mappingPanel').hidden=true;
    preview=textToCandidates(extracted.text,$('#defaultArea').value,fileName);
    matchVersion=version;renderPreview();return;
  }
  const sheet=extracted.sheets[Number(selected)];
  if(!sheet){$('#mappingPanel').hidden=true;return;}
  $('#mappingPanel').hidden=false;
  $('#headerRow').replaceChildren();
  for(let i=0;i<Math.min(15,sheet.rows.length);i++)$('#headerRow').append(option(String(i),`${i+1}: ${sheet.rows[i].slice(0,4).join(' · ').slice(0,100)}`));
  const headerIndex=sheet.rows.slice(0,10).findIndex(row=>detectColumns(row).activity>=0);
  $('#headerRow').value=String(Math.max(0,headerIndex));
  renderMapping();
  if(headerIndex>=0)prepareRows();
}
$('#headerRow').addEventListener('change',renderMapping);
function renderMapping() {
  const sheet=extracted?.sheets[Number($('#sheet').value)];if(!sheet)return;
  const headerRow=Number($('#headerRow').value),header=sheet.rows[headerRow]||[];
  const detected=detectColumns(header),container=$('#mapping');container.replaceChildren();
  for(const key of Object.keys(labels)) {
    const label=node('label','',labels[key]);
    const select=document.createElement('select');select.dataset.key=key;select.append(option('-1','No usar'));
    header.forEach((value,index)=>select.append(option(String(index),`${index+1}: ${String(value||'Sin título').slice(0,50)}`)));
    select.value=String(detected[key]??-1);label.append(select);container.append(label);
  }
}
function prepareRows() {
  const sheet=extracted?.sheets[Number($('#sheet').value)];if(!sheet)return;
  try {
    const columns=Object.fromEntries([...$('#mapping').querySelectorAll('select')].map(select=>[select.dataset.key,Number(select.value)]));
    preview=rowsToCandidates(sheet.rows,columns,$('#defaultArea').value,fileName,sheet.name,Number($('#headerRow').value));
    if(!preview.length)throw new Error('No hay filas con actividades en esta tabla.');
    matchVersion=version;renderPreview();
  } catch(error){message(error.message,'error');}
}
$('#prepareRows').addEventListener('click',prepareRows);

function match(row) {
  const matches=events.filter(event=>!event.archivado&&event.area===row.area&&compact(event.activity)===compact(row.activity));
  return matches.length===1?matches[0]:null;
}
function tableInput(value,type='text') {const input=document.createElement('input');input.type=type;input.value=value??'';return input;}
function renderPreview() {
  const body=$('#previewBody');body.replaceChildren();
  preview.forEach((row,index)=>{
    const tr=document.createElement('tr');tr.dataset.index=index;
    tr.append(node('td','',`${row.sourceSheet||'Texto'} · ${row.sourceRow||index+1}`));
    const found=match(row), action=document.createElement('select');action.dataset.field='op';
    action.append(option('skip','Omitir'),option('add','Añadir'));
    if(found)action.append(option('update',`Actualizar #${found.id}`));
    action.value=found?'update':'add';
    const actionCell=document.createElement('td');actionCell.append(action);tr.append(actionCell);
    for(const key of ['activity','area','start','end','responsable']) {
      const td=document.createElement('td');let input;
      if(key==='area'){input=document.createElement('select');for(const area of AREAS)input.append(option(area));input.value=row.area;}
      else input=tableInput(row[key],key==='start'||key==='end'?'date':'text');
      input.dataset.field=key;td.append(input);tr.append(td);
    }
    body.append(tr);
  });
  $('#previewPanel').hidden=false;
  $('#previewSummary').textContent=`${preview.length} filas propuestas · ${preview.filter(row=>!row.start).length} sin fecha reconocida. Revisa la acción, el área y las fechas.`;
}
$('#addPreviewRow').addEventListener('click',()=>{
  preview.push({area:$('#defaultArea').value,activity:'',start:'',end:'',responsable:'',sourceFile:fileName||'Edición manual',sourceSheet:'Manual',sourceRow:preview.length+1});
  matchVersion=version;renderPreview();
});
$('#approveImport').addEventListener('click',async()=>{
  if(!admin(auth.currentUser))return;
  if(matchVersion!==version){message('El POA cambió. Vuelve a preparar la vista previa.','error');return;}
  try {
    const changes=[];
    for(const tr of $('#previewBody').rows) {
      const index=Number(tr.dataset.index),original=preview[index];
      const get=field=>tr.querySelector(`[data-field="${field}"]`).value.trim();
      const op=get('op');if(op==='skip')continue;
      const data={...original,activity:get('activity'),area:get('area'),start:get('start'),end:get('end'),responsable:get('responsable')};
      if(!data.activity)throw new Error(`La fila ${index+1} no tiene actividad.`);
      if(data.end&&!data.start)throw new Error(`La fila ${index+1} tiene fin sin inicio.`);
      if(data.start&&!parseDate(data.start))throw new Error(`La fila ${index+1} tiene una fecha de inicio inválida.`);
      if(data.end&&!parseDate(data.end))throw new Error(`La fila ${index+1} tiene una fecha de fin inválida.`);
      if(op==='update') {
        const found=match(original);
        if(!found)throw new Error(`La fila ${index+1} perdió su coincidencia; vuelve a preparar la vista previa.`);
        const partial=Object.fromEntries(Object.entries(data).filter(([key,value])=>
          !['sourceFile','sourceSheet','sourceRow','planning'].includes(key)&&value!==''));
        if(partial.start&&!partial.end)partial.end=partial.start;
        changes.push({op,id:found.id,data:partial});
      } else changes.push({op:'add',data,source:fileName});
    }
    if(!changes.length)throw new Error('Selecciona al menos una fila para aprobar.');
    if(!confirm(`Se aplicarán ${changes.length} cambios al POA y se guardará una versión recuperable en Firestore. ¿Aprobar?`))return;
    await saveChanges(changes,{archive:true,label:fileName});
    preview=[];$('#previewPanel').hidden=true;$('#file').value='';
  } catch(error){message(error.message||error.code,'error');}
});

onAuthStateChanged(auth,user=>{
  if(!admin(user)) {
    $('#app').hidden=true;
    message('Acceso reservado a los tres super administradores. Inicia sesión en el tablero con tu cuenta institucional.','error');
    return;
  }
  $('#app').hidden=false;$('#who').textContent=user.email;
  if(unsub)unsub();
  unsub=onSnapshot(doc(db,'meta','general'),()=>{if(!saving)loadData().catch(error=>message(error.message||error.code,'error'));},
    error=>message('No se pudo observar Firestore: '+(error.code||error.message),'error'));
});
