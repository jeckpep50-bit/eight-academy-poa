/* ============================================================
   Configuración del proyecto.
   Este archivo SÍ se publica: las claves de Firebase para web son
   identificadores públicos, no secretos. Lo que protege los datos
   son las reglas de Firestore, que viven en el servidor.
   ============================================================ */

/* ---------- 1 · Pega aquí la configuración de tu proyecto ----------
   Firebase → Configuración del proyecto → Tus apps → Web → Configuración
   Reemplaza los cinco valores. Mientras digan PEGAR_, la plataforma
   muestra un aviso en vez de intentar conectarse.                    */
export const CONFIG = {
  apiKey:            "PEGAR_apiKey",
  authDomain:        "PEGAR_authDomain",        // p. ej. eight-poa.firebaseapp.com
  projectId:         "PEGAR_projectId",         // p. ej. eight-poa
  storageBucket:     "PEGAR_storageBucket",
  messagingSenderId: "PEGAR_messagingSenderId",
  appId:             "PEGAR_appId"
};

/* ---------- 2 · Dominio institucional ----------
   Único dominio admitido. Ojo con la "t" de eight.
   Si esto no coincide con el correo real, no entra nadie.           */
export const DOMINIO = "eightacademy.edu.ec";

/* ---------- 3 · Super administradores ----------
   Los únicos que podrán editar. Qué pueden editar exactamente se
   define más adelante; por ahora solo se distingue quién lo es.

   IMPORTANTE: esta lista es para la pantalla. La lista que manda es
   la de firestore.rules, en el servidor. Si añades a alguien aquí,
   añádelo también allí o no podrá escribir nada.                    */
export const SUPERADMINS = [
  "dsroblesl@eightacademy.edu.ec"
];

/* ---------- 4 · Áreas ----------
   Cada una es un documento en Firestore, para no cargar las 764
   actividades en una sola lectura.                                  */
export const AREAS = ["KIDS","PRIMARIA","SECUNDARIA","DECE","MARKETING","RIESGOS","ZOOBOTANICA"];

export const CONFIGURADO = !CONFIG.apiKey.startsWith("PEGAR_");
