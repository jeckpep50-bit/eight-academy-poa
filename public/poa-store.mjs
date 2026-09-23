import { doc, collection, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { AREAS } from './config.js';
import { normalizeEvent, compact } from './poa-model.mjs';

export async function applyChanges(db, user, baseVersion, changes, { archive = false, label = '' } = {}) {
  if (!user?.emailVerified || !user.email || !changes.length || changes.length > 200) {
    throw new Error('La sesión o la selección de cambios no es válida.');
  }
  const metaRef=doc(db,'meta','general');
  const areaRefs=AREAS.map(area=>doc(db,'poa',area));
  const logRef=doc(collection(db,'ediciones'));
  const version=`v${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
  const beforeVersion=`${version}-antes`;
  const timestamp=`${new Date().toISOString()}-${Math.random().toString(36).slice(2,7)}`;
  return runTransaction(db,async transaction=>{
    const metaSnap=await transaction.get(metaRef);
    if (!metaSnap.exists()) throw new Error('No hay un POA cargado en Firestore.');
    const currentMeta=metaSnap.data();
    if (currentMeta.subidoEl !== baseVersion) {
      throw new Error('Otro administrador cambió el POA. Recarga y revisa la vista previa antes de guardar.');
    }
    const snapshots=await Promise.all(areaRefs.map(ref=>transaction.get(ref)));
    if (snapshots.some(snapshot=>!snapshot.exists())) throw new Error('Falta un área en Firestore.');
    const byArea=Object.fromEntries(AREAS.map((area,index)=>[area,[...(snapshots[index].data().events || [])]]));
    const byId=new Map(AREAS.flatMap(area=>byArea[area].map(event=>[event.id,event])));
    let nextId=Math.max(0,...byId.keys());
    const audit=[];
    const touched=new Set();
    for (const change of changes) {
      const op=change.op;
      if (!['add','update','archive','restore','highlight'].includes(op)) throw new Error('Acción no admitida.');
      const old=op==='add' ? null : byId.get(Number(change.id));
      if (op!=='add' && !old) throw new Error(`La actividad ${change.id} ya no existe.`);
      let updated;
      if (op==='add') {
        if (nextId>=9999999999) throw new Error('Se agotaron los identificadores.');
        updated=normalizeEvent(change.data,++nextId,null,change.source || 'Edición manual');
        if(byArea[updated.area].some(event=>!event.archivado&&
          compact(event.activity)===compact(updated.activity)&&
          event.start===updated.start&&event.end===updated.end)) {
          throw new Error(`La actividad «${updated.activity}» ya existe en ${updated.area} con esas fechas.`);
        }
      } else if (op==='update') {
        updated=normalizeEvent({...old,...change.data},old.id,old);
      } else {
        updated={...old};
        if (op==='archive') updated.archivado=true;
        if (op==='restore') updated.archivado=false;
        if (op==='highlight') updated.destacado=change.value===true;
      }
      if (old) {
        byArea[old.area]=byArea[old.area].filter(event=>event.id!==old.id);
        touched.add(old.area);
      }
      byArea[updated.area].push(updated);
      touched.add(updated.area);
      byId.set(updated.id,updated);
      audit.push({op,id:updated.id,area:updated.area,before:old,after:updated});
    }
    for (const area of AREAS) {
      if (byArea[area].length>300) throw new Error(`${area} superaría 300 actividades; divide la carga.`);
    }
    const total=AREAS.reduce((sum,area)=>sum+byArea[area].filter(event=>!event.archivado).length,0);
    const nextMeta={...currentMeta,total,subidoPor:user.email,subidoEl:timestamp};
    for (const area of touched) transaction.set(doc(db,'poa',area),{area,events:byArea[area],n:byArea[area].length});
    transaction.set(metaRef,nextMeta);
    if (archive) {
      const metaBefore={...currentMeta,subidoPor:user.email,subidoEl:timestamp.slice(0,24)};
      for (const area of AREAS) {
        const original=snapshots[AREAS.indexOf(area)].data();
        transaction.set(doc(db,'importaciones',beforeVersion,'poa',area),original);
      }
      transaction.set(doc(db,'importaciones',beforeVersion),metaBefore);
      for (const area of AREAS) {
        transaction.set(doc(db,'importaciones',version,'poa',area),{area,events:byArea[area],n:byArea[area].length});
      }
      transaction.set(doc(db,'importaciones',version),nextMeta);
    }
    transaction.set(logRef,{
      actor:user.email,fecha:new Date(),version:timestamp,
      tipo:archive?'importacion':'edicion',
      etiqueta:String(label).slice(0,150),
      cambios:audit.map(({op,id,area,before,after})=>({op,id,area,
        antes:archive?null:before,despues:archive?null:after}))
    });
    return {total,version:archive?version:null,ids:audit.map(item=>item.id)};
  });
}
