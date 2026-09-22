/* ============================================================
   Puerta de acceso y carga de datos.
   Nada del tablero existe hasta que Firebase confirma una identidad
   del dominio institucional: ni el programa ni las actividades se
   descargan antes de eso.
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  GoogleAuthProvider, signInWithPopup,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { CONFIG, DOMINIO, SUPERADMINS, AREAS, CONFIGURADO } from "./config.js";
import { iniciarGestion } from "./gestion.js";

const $ = s => document.querySelector(s);
const puerta = $("#puerta");
const aviso  = $("#pAviso");
const CLAVE_CORREO = "ea_correo_pendiente";

document.body.classList.add("sin-entrar");
$("#pDominio").textContent = "@" + DOMINIO;

function decir(txt, clase){ aviso.textContent = txt; aviso.className = "aviso " + (clase||""); }
function bloquear(b){ ["#bGoogle","#bEnlace","#pCorreo"].forEach(s => $(s).disabled = b); }
const delDominio = correo => (correo||"").toLowerCase().endsWith("@" + DOMINIO.toLowerCase());
const esAdmin    = correo => SUPERADMINS.map(c=>c.toLowerCase()).includes((correo||"").toLowerCase());

/* ---------- sin configurar todavía ---------- */
if(!CONFIGURADO){
  decir("Falta pegar la configuración de Firebase en public/config.js.", "mal");
  bloquear(true);
  throw new Error("Firebase sin configurar");
}

const app  = initializeApp(CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ---------- entrar con Google ---------- */
$("#bGoogle").addEventListener("click", async () => {
  const prov = new GoogleAuthProvider();
  prov.setCustomParameters({ hd: DOMINIO, prompt: "select_account" });
  bloquear(true); decir("Abriendo Google…");
  try { await signInWithPopup(auth, prov); }
  catch(e){
    bloquear(false);
    decir(e.code === "auth/popup-closed-by-user"
      ? "Se cerró la ventana de Google antes de terminar."
      : "No se pudo entrar: " + e.code, "mal");
  }
});

/* ---------- entrar con enlace por correo ---------- */
$("#bEnlace").addEventListener("click", async () => {
  const correo = $("#pCorreo").value.trim().toLowerCase();
  if(!delDominio(correo)){
    decir("Ese correo no es del dominio institucional.", "mal");
    return;
  }
  bloquear(true); decir("Enviando el enlace…");
  try{
    await sendSignInLinkToEmail(auth, correo, {
      url: location.origin + location.pathname,
      handleCodeInApp: true
    });
    localStorage.setItem(CLAVE_CORREO, correo);
    decir("Listo. Revisa tu correo y abre el enlace desde este mismo dispositivo.", "bien");
  }catch(e){
    bloquear(false);
    decir("No se pudo enviar: " + e.code, "mal");
  }
});

/* ---------- volver desde el enlace del correo ---------- */
if(isSignInWithEmailLink(auth, location.href)){
  const guardado = localStorage.getItem(CLAVE_CORREO) || "";
  const correo = delDominio(guardado) ? guardado : prompt("Confirma tu correo institucional:") || "";
  if(delDominio(correo)){
    bloquear(true); decir("Validando el enlace…");
    signInWithEmailLink(auth, correo, location.href)
      .then(() => { localStorage.removeItem(CLAVE_CORREO);
                    history.replaceState(null,"",location.pathname); })
      .catch(e => { bloquear(false); decir("El enlace no es válido o ya caducó (" + e.code + ").", "mal"); });
  } else {
    decir("Ese correo no es del dominio institucional.", "mal");
  }
}

/* ---------- el portero ---------- */
let dentro = false;
let escuchandoImportaciones = false;
onAuthStateChanged(auth, async usuario => {
  if(!usuario){ puerta.classList.remove("fuera"); bloquear(false); return; }

  if(!delDominio(usuario.email)){
    const ajeno = usuario.email;
    await signOut(auth);
    bloquear(false);
    decir(`${ajeno} no pertenece a @${DOMINIO}. Entra con tu correo institucional.`, "mal");
    return;
  }
  if(dentro) return;
  dentro = true;
  if(!escuchandoImportaciones){
    escuchandoImportaciones = true;
    let primeraLectura = true;
    let versionActual = null;
    onSnapshot(doc(db, "meta", "general"), snap => {
      const version = snap.exists() ? snap.data().subidoEl || "" : "";
      if(primeraLectura){ versionActual = version; primeraLectura = false; return; }
      if(version !== versionActual) location.reload();
    }, error => console.error("No se pudo observar la importación", error));
  }
  decir("Cargando el tablero…", "bien");
  try {
    await cargarTablero(usuario);
  } catch(e){
    dentro = false; bloquear(false);
    decir("Entraste, pero no se pudieron leer los datos: " + (e.code || e.message), "mal");
    if(e.message && e.message.includes("Firestore está vacío") && esAdmin(usuario.email)){
      const enlace=document.createElement("a");
      enlace.href="./cargar-datos.html";
      enlace.textContent="Abrir la carga de datos";
      enlace.style.display="block";
      aviso.appendChild(enlace);
    }
    console.error(e);
  }
});

/* ---------- traer los datos y arrancar el tablero ---------- */
async function cargarTablero(usuario){
  const partes = await Promise.all(AREAS.map(a => getDoc(doc(db, "poa", a))));
  const faltan = AREAS.filter((a,i) => !partes[i].exists());
  if(faltan.length === AREAS.length){
    throw new Error(esAdmin(usuario.email)
      ? "Firestore está vacío. Sube los datos una vez en /cargar-datos.html"
      : "Todavía no hay datos cargados. Avisa a un administrador.");
  }

  const eventos = [];
  partes.forEach(p => { if(p.exists()) eventos.push(...(p.data().events || [])); });
  eventos.sort((a,b) => a.id - b.id);

  const meta = await getDoc(doc(db, "meta", "general"));
  window.__DATOS__ = {
    generated: meta.exists() ? meta.data().generated : "",
    corrections: meta.exists() && Array.isArray(meta.data().corrections) ? meta.data().corrections : [],
    events: eventos
  };

  const admin = esAdmin(usuario.email);
  window.__ES_SUPERADMIN__ = admin;
  window.__GESTION__ = iniciarGestion(db, usuario, admin);
  identidad(usuario, admin);
  puerta.classList.add("fuera");
  document.body.classList.remove("sin-entrar");

  // el programa del tablero se descarga solo ahora, ya con sesión válida
  const s = document.createElement("script");
  s.src = "./tablero.js";
  document.body.appendChild(s);
}

/* ---------- barra de identidad ---------- */
function identidad(usuario, admin){
  document.body.dataset.acceso = admin ? "admin" : "lectura";

  const barra = document.createElement("div");
  barra.id = "quien";
  const correo = document.createElement("span");
  correo.className = "correo";
  correo.textContent = usuario.email || "";
  const rol = document.createElement("span");
  rol.className = "rol";
  rol.textContent = admin ? "Super administrador" : "Solo lectura";
  const salir = document.createElement("button");
  salir.type = "button";
  salir.id = "bSalir";
  salir.textContent = "Salir";
  barra.append(correo, rol, salir);

  const destino = document.querySelector(".role-bar") || document.querySelector("header.top");
  if(destino) destino.appendChild(barra);
  salir.addEventListener("click", () => signOut(auth).then(() => location.reload()));

  // Mientras no se definan los permisos finos, quien no es super
  // administrador no ve los controles que escriben.
  if(!admin){
    const css = document.createElement("style");
    css.textContent = `[data-acceso="lectura"] .admin-only,#rReset,.finding .actions button,#dClassBtn{display:none!important}`;
    document.head.appendChild(css);
  }
}
