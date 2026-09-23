# Eight Academy · Plataforma POA 2026–2027

Auditoría y gestión del calendario institucional: consolida los siete Planes
Operativos Anuales (Kids, Primaria, Secundaria, DECE, Marketing, Gestión de
Riesgos y Zoobotánica) y los compara entre sí.

**Acceso restringido a `@eightacademy.edu.ec`.** Solo los super administradores
pueden escribir.

---

## Cómo está montado

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Pantalla y programa | Netlify | Lo que se ve. No contiene ninguna actividad. |
| Identidad | Firebase Authentication | Verifica quién entra y que sea del dominio. |
| Las 764 actividades | Firestore | Se descargan **después** de iniciar sesión. |
| Permisos | `firestore.rules` | La única barrera real. Vive en el servidor. |

El punto importante: **el sitio de Netlify es público**. Por eso el archivo que
se publica no lleva datos dentro. Si las actividades estuvieran incrustadas en
el HTML, cualquiera con el enlace las leería sin iniciar sesión, y el login no
serviría de nada.

```
public/            ← lo único que Netlify publica
  index.html         cáscara del tablero + puerta de acceso
  tablero.js         el programa (sin datos)
  acceso.js          identidad, dominio, carga de datos
  config.js          configuración de Firebase y lista de administradores
  editar-poa.html    edición y aprobación de documentos para super administradores
  cargar-datos.html  reemplazo completo desde JSON, solo para mantenimiento
  versiones.html     listado y restauración de importaciones; cambios recientes
  gestion.js         sincronización en tiempo real de revisiones y clasificaciones
datos/             ← NO se sube al repositorio (.gitignore)
  datos.json         las 764 actividades
firestore.rules    ← se pegan en la consola de Firebase
netlify.toml
```

---

## Puesta en marcha

### 1 · Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Agregar proyecto**.
   Nombre sugerido: `eight-academy-poa`. Puedes desactivar Google Analytics.
2. **Authentication → Comenzar**, y habilita:
   - **Google** (si el correo del colegio es Google Workspace: es un clic para entrar)
   - **Vínculo de correo electrónico (sin contraseña)** (funciona con cualquier proveedor)
3. **Authentication → Settings → Dominios autorizados**: añade el dominio que te dé
   Netlify (p. ej. `eight-poa.netlify.app`) y, si lo usas, el dominio propio.
4. **Firestore Database → Crear base de datos** → modo producción → región `nam5` o
   la más cercana.
5. **Firestore → Reglas**: pega el contenido de `firestore.rules` y publica.
6. **Configuración del proyecto → Tus apps → Web (`</>`)**: registra una app y copia
   el objeto `firebaseConfig`.

### 2 · Configurar el repositorio

Abre `public/config.js` y rellena:

- los seis valores de `CONFIG` (los que acabas de copiar);
- `SUPERADMINS` con los correos que podrán editar.

Los mismos correos van también en `firestore.rules`, en la función `esAdmin()`.
**Si solo los pones en `config.js`, verán los botones pero el servidor les
rechazará cada cambio.**

### 3 · GitHub

```bash
git remote add origin https://github.com/TU_USUARIO/eight-academy-poa.git
git branch -M main
git push -u origin main
```

> El repositorio debe ser **privado**. Aunque `datos/` está excluido, el resto
> revela la estructura interna de la institución.

### 4 · Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → GitHub.
2. Elige el repositorio. Netlify lee `netlify.toml`, así que no hay que configurar nada:
   carpeta de publicación `public`, sin comando de compilación.
3. Copia el dominio que te asigna y **añádelo a los dominios autorizados de Firebase**
   (paso 1.3). Sin eso, el inicio de sesión falla.

### 5 · Subir los datos, una vez

Abre `https://TU-SITIO.netlify.app/cargar-datos.html`, entra con tu correo de
super administrador, elige `datos/datos.json` del paquete original y pulsa
escribir. La carga escribe siete áreas y un documento de metadatos, y conserva
una copia inmutable en `importaciones/{version}`. El archivo fuente no se
publica en Netlify ni se incluye en GitHub.

Cada nueva importación reemplaza el POA vigente. Los tableros abiertos detectan
el cambio y se actualizan. En `versiones.html`, los super administradores pueden
restaurar una importación anterior; la restauración crea otra versión antes de
activarla.

Las marcas de hallazgos revisados y las clasificaciones de actividades se
guardan en `revisiones` y `clasificaciones`. Firestore las sincroniza entre
sesiones y registra el último autor y momento de cada modificación. Los datos
que existían únicamente en `localStorage` no se migran automáticamente.

La recuperación point-in-time (PITR) de Firestore requiere una cuenta de
facturación vinculada y tiene costo de almacenamiento adicional. Las versiones
de importación descritas arriba funcionan sin PITR, aunque no reemplazan la
recuperación de todos los cambios de la base a un minuto específico.

### Editar e importar nuevos documentos

El enlace **Editar e importar POA** aparece en el tablero para los tres super
administradores. Allí pueden añadir o editar actividades y fechas, crear otra
fecha sin borrar la primera, destacarlas, archivarlas y restaurarlas. El
archivado conserva la actividad en Firestore y la quita del tablero. Cada
modificación queda registrada de forma inmutable en `ediciones`; los demás
navegadores actualizan el tablero cuando cambia la versión del POA.

La pestaña **Importar documento** admite XLSX, CSV, TSV, DOCX, PPTX, PDF con
texto seleccionable y TXT. Las tablas permiten elegir encabezado y asociar
columnas; el texto con fechas completas genera propuestas que pueden editarse.
El super administrador revisa las acciones **Añadir / Actualizar / Omitir** y
aprueba antes de escribir. Una coincidencia para actualizar requiere el mismo
nombre y área; no se hacen sustituciones aproximadas. Se guardan versiones del
POA antes y después de cada importación aprobada, recuperables en
`versiones.html`.

Los archivos se procesan localmente en el navegador: **no se guarda una copia
del original**. Solo las actividades aprobadas y el nombre del archivo de
procedencia llegan a Firestore. Para documentos escaneados, formatos Office
antiguos (`.xls`, `.doc`, `.ppt`) o iWork, conviértelos a un formato admitido;
si el texto no tiene fechas completas, introduce o corrige las filas en la
vista previa. El límite por archivo es 20 MB y por aprobación 200 actividades.

Para modificar el lector de documentos: `npm ci`, `npm run build` y `npm test`.
El bundle generado dentro de `public/` se incluye en Git porque Netlify
publica esa carpeta sin ejecutar una compilación.

---

## Dar de alta a una persona

| Quiere… | Qué hacer |
|---|---|
| Solo consultar | Nada. Con tener correo `@eightacademy.edu.ec` entra. |
| Editar | Añadir su correo en `config.js` **y** en `firestore.rules`, y publicar ambos. |

---

## Qué falta

- [ ] Definir qué puede editar exactamente un super administrador
- [ ] Roles intermedios (directivo, docente por área)
- [ ] Importar los `.xlsx` desde la propia plataforma
- [ ] Avisos de 15 días por correo, automáticos
- [ ] Estado de ejecución de cada actividad

---

## Coste

Plan gratuito de Firebase (Spark) y plan gratuito de Netlify. Las actividades se
guardan en siete documentos, no en 764, para que abrir el tablero cueste siete
lecturas por persona y no setecientas.
