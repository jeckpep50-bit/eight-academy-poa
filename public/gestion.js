import {
  collection, doc, onSnapshot, setDoc, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// El estado compartido se recibe siempre de Firestore. No se conserva una copia
// editable en localStorage, para que todos los administradores vean lo mismo.
export function iniciarGestion(db, usuario, esSuperadmin) {
  const estado = { revisiones: {}, clasificaciones: {}, entregas: {}, avisos: {}, error: null };
  const suscriptores = new Set();
  const avisar = () => suscriptores.forEach(fn => fn(estado));

  onSnapshot(collection(db, "revisiones"), snapshot => {
    const revisiones = {};
    snapshot.forEach(item => { if (item.data().revisado === true) revisiones[item.id] = true; });
    estado.revisiones = revisiones;
    estado.error = null;
    avisar();
  }, error => { estado.error = error; avisar(); });

  onSnapshot(collection(db, "clasificaciones"), snapshot => {
    const clasificaciones = {};
    snapshot.forEach(item => {
      const clase = item.data().clase;
      if (["grande", "mediana", "pequena"].includes(clase)) clasificaciones[item.id] = clase;
    });
    estado.clasificaciones = clasificaciones;
    estado.error = null;
    avisar();
  }, error => { estado.error = error; avisar(); });

  // Un fallo aquí (p. ej. reglas aún sin publicar) no debe detener el tablero.
  onSnapshot(collection(db, "entregas"), snapshot => {
    const entregas = {};
    snapshot.forEach(item => { if (item.data().entregado === true) entregas[item.id] = true; });
    estado.entregas = entregas;
    avisar();
  }, error => console.warn("No se pudieron leer las entregas", error));

  onSnapshot(collection(db, "avisos"), snapshot => {
    const avisos = {};
    snapshot.forEach(item => { avisos[item.id] = item.data(); });
    estado.avisos = avisos;
    avisar();
  }, error => console.warn("No se pudo leer el estado de los avisos", error));

  function exigirPermiso() {
    if (!esSuperadmin) throw new Error("Solo un super administrador puede modificar el estado.");
  }

  return {
    estado,
    suscribir(fn) { suscriptores.add(fn); fn(estado); return () => suscriptores.delete(fn); },
    async guardarRevision(id, revisado) {
      exigirPermiso();
      if (!/^[a-z0-9]{1,16}$/.test(id)) throw new Error("Identificador de hallazgo inválido.");
      await setDoc(doc(db, "revisiones", id), {
        revisado, actualizadoPor: usuario.email, actualizadoEl: serverTimestamp()
      });
    },
    async guardarClasificacion(id, clase) {
      exigirPermiso();
      if (!/^[0-9]{1,10}$/.test(String(id)) || !["grande", "mediana", "pequena", "ninguna"].includes(clase)) {
        throw new Error("Clasificación inválida.");
      }
      await setDoc(doc(db, "clasificaciones", String(id)), {
        clase, actualizadoPor: usuario.email, actualizadoEl: serverTimestamp()
      });
    },
    async guardarEntrega(id, entregado) {
      exigirPermiso();
      if (!/^[0-9]{1,10}$/.test(String(id)) || typeof entregado !== "boolean") {
        throw new Error("Entrega inválida.");
      }
      await setDoc(doc(db, "entregas", String(id)), {
        entregado, actualizadoPor: usuario.email, actualizadoEl: serverTimestamp()
      });
    },
    async restablecerRevisiones() {
      exigirPermiso();
      const ids = Object.keys(estado.revisiones);
      for (let offset = 0; offset < ids.length; offset += 200) {
        const lote = writeBatch(db);
        ids.slice(offset, offset + 200).forEach(id => lote.set(doc(db, "revisiones", id), {
          revisado: false, actualizadoPor: usuario.email, actualizadoEl: serverTimestamp()
        }));
        await lote.commit();
      }
    }
  };
}
