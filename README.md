# Eight Academy · Plataforma POA 2026–2027

Auditoría y gestión del calendario institucional: consolida los siete Planes
Operativos Anuales (Kids, Primaria, Secundaria, DECE, Marketing, Gestión de
Riesgos y Zoobotánica) y los compara entre sí.

**Sitio:** https://poaeightacademy.github.io

**Acceso restringido a `@eightacademy.edu.ec`.** Solo los super administradores
pueden escribir; el resto del personal entra en modo lectura.

---

## Cómo está montado

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Pantalla y programa | GitHub Pages (organización `poaeightacademy`) | Lo que se ve. No contiene ninguna actividad. |
| Identidad | Firebase Authentication | Verifica quién entra y que sea del dominio. |
| Las actividades | Firestore | Se descargan **después** de iniciar sesión. |
| Permisos | `firestore.rules` | La única barrera real. Vive en el servidor. |

El punto importante: **el sitio y el repositorio son públicos.** GitHub Pages
gratuito exige repositorio público. Por eso nada de lo publicado lleva datos
dentro: si las actividades estuvieran en el HTML o en el repositorio,
cualquiera las leería sin iniciar sesión. Lo que sí queda a la vista es el
código, las reglas y los correos de los super administradores.

```
public/              ← lo único que se publica
  index.html           cáscara del tablero + puerta de acceso
  tablero.js           el programa (sin datos)
  acceso.js            identidad, dominio, carga de datos
  config.js            configuración de Firebase y lista de administradores
  logo-animado.js      portada: el logo se arma con píxeles y forma la frase
  img/                 logo sin fondo
  editar-poa.html      edición e importación de documentos (super administradores)
  versiones.html       listado y restauración de importaciones
  cargar-datos.html    reemplazo completo desde JSON, solo para mantenimiento
  gestion.js           sincronización en tiempo real de revisiones y clasificaciones
datos/               ← NO se sube al repositorio (.gitignore)
  datos.json           las actividades originales
firestore.rules      ← se publican en la consola de Firebase
.github/workflows/pages.yml   publica public/ en cada push a main
```

---

## Publicar un cambio

```bash
git push origin main
```

El flujo de GitHub Actions publica la carpeta `public/` en uno o dos minutos.
Se puede seguir en la pestaña **Actions** del repositorio.

GitHub Pages permite al navegador guardar la página hasta **10 minutos**. Si
después de publicar se sigue viendo la versión anterior, recarga con
**Ctrl + F5** (en el iPhone, cierra la pestaña y vuelve a abrir el enlace).

---

## Acceso

- Un solo botón, **Iniciar sesión**, que abre la pantalla de Google para el
  correo y la contraseña institucionales.
- Si ya había sesión en ese navegador, la puerta muestra "Verificando tu
  sesión…" y pasa directo al tablero, sin abrir Google.
- Cualquier correo fuera de `@eightacademy.edu.ec` se rechaza: lo verifica
  Google (`hd`), la pantalla y, sobre todo, las reglas de Firestore.

### Dominios autorizados en Firebase

Firebase solo permite iniciar sesión desde direcciones de su lista:
**Authentication → Configuración → Dominios autorizados**. Hoy son:

- `eight-academy-poa.firebaseapp.com` y `eight-academy-poa.web.app` (propios de Firebase, no se tocan)
- `poaeightacademy.github.io` (el sitio)
- `eightacademy.edu.ec`

Si el sitio cambia de dirección (por ejemplo, a `poa.eightacademy.edu.ec`), hay
que añadirla ahí **antes** de usarla. Si falta, la ventana de Google muestra
"The requested action is invalid".

---

## Dar de alta a una persona

| Quiere… | Qué hacer |
|---|---|
| Solo consultar | Nada. Con tener correo `@eightacademy.edu.ec` entra. |
| Editar | Añadir su correo en `public/config.js` **y** en `firestore.rules` (función `esAdmin()`), publicar el sitio y publicar las reglas en Firebase. |

Si el correo solo se pone en `config.js`, la persona verá los botones pero el
servidor le rechazará cada cambio.

Super administradores actuales: `mibermeov@`, `dsroblesl@` y `lemaciasb@eightacademy.edu.ec`.

---

## El tablero

Secciones: 01 Panorama · 02 Semáforo · 03 Calendario · 04 Coincidencias ·
05 Carga semanal · 06 Conflictos · 07 Matriz de riesgos · 08 Alertas 15 días ·
09 Exportar (.ics para Google Calendar).

**Semanas lectivas.** La semana 1 es la que contiene el 1 de septiembre (en
2026 empieza el lunes 31 de agosto) y el conteo sigue sin reiniciarse en enero.
Lo anterior al inicio del año lectivo (capacitación, planificación de agosto)
aparece como "Semana previa". El año lectivo siguiente vuelve a empezar en 1.

---

## Datos

### Carga inicial (una vez, mantenimiento)

Abre `https://poaeightacademy.github.io/cargar-datos.html`, entra como super
administrador, elige `datos/datos.json` y pulsa escribir. Se escriben siete
documentos de área y uno de metadatos, y se conserva una copia inmutable en
`importaciones/{version}`. **Reemplaza todo el POA vigente.**

### Editar e importar nuevos documentos

El enlace **Editar e importar POA** aparece en el tablero para los super
administradores. Allí pueden añadir o editar actividades y fechas, crear otra
fecha sin borrar la primera, destacarlas, archivarlas y restaurarlas. El
archivado conserva la actividad en Firestore y la quita del tablero. Cada
modificación queda registrada de forma inmutable en `ediciones`; los tableros
abiertos se recargan cuando cambia la versión del POA.

La pestaña **Importar documento** admite XLSX, CSV, TSV, DOCX, PPTX, PDF con
texto seleccionable y TXT. Las tablas permiten elegir encabezado y asociar
columnas; el texto con fechas completas genera propuestas editables. El super
administrador revisa las acciones **Añadir / Actualizar / Omitir** y aprueba
antes de escribir. Una coincidencia para actualizar requiere el mismo nombre y
área. Se guardan versiones antes y después de cada importación aprobada,
recuperables en `versiones.html` (restaurar crea otra versión antes de
activarla).

Los archivos se procesan en el navegador: **no se guarda una copia del
original**. Para escaneados, formatos Office antiguos (`.xls`, `.doc`, `.ppt`)
o iWork, conviértelos antes. Límite: 20 MB por archivo y 200 actividades por
aprobación.

Las marcas de hallazgos revisados y las clasificaciones se guardan en
`revisiones` y `clasificaciones`, sincronizadas entre sesiones con el último
autor y momento de cada cambio.

La recuperación point-in-time (PITR) de Firestore requiere facturación y no
está activada; las versiones de importación funcionan sin ella.

### Modificar el lector de documentos

```bash
npm ci
npm run build
npm test
```

El bundle generado dentro de `public/` se incluye en Git porque GitHub Pages
publica esa carpeta sin compilar.

---

## Qué falta

- [ ] **Avisos automáticos por correo:** construidos; falta la puesta en marcha (ver abajo).
- [x] Casilla "minuto a minuto entregado" en el calendario (neón / marca de agua).
- [ ] Definir qué puede editar exactamente cada super administrador.
- [ ] Roles intermedios (directivo, docente por área).

### Lógica de los avisos por correo

**Qué actividades.** Solo las que tienen estrellas (la clasificación que ponen
los super administradores). Una actividad sin estrellas no recibe correos.

**Fases, en días hábiles antes de la actividad:**

| Fase | ★★★ Grande | ★★ Mediana | ★ Pequeña |
|---|---|---|---|
| 1 · Anticipación | 50 | 30 | 15 |
| 2 · Recordatorio | 30 | 18 | 10 |
| 3 · Urgencia (llamado a la reflexión) | 15 | 10 | 5 |
| 4 · Incumplimiento (memo / llamado de atención) | 5 | 3 | 2 |
| 5 · Seguimiento | día de la actividad | día de la actividad | día de la actividad |

Marcar "minuto a minuto entregado" detiene todas las fases siguientes.
Seguimiento solo se envía si llegó el día y nunca se entregó.

**Actividades que entran tarde** (agregadas al POA con menos días que su
ventana, o que ya estaban dentro del plazo al arrancar el 5 de octubre de
2026): calendario comprimido. Anticipación el siguiente día hábil;
Recordatorio cuando quede el 60 % del tiempo; Urgencia al 30 %; Memo al 10 %.

- Memo solo si al entrar le quedaban 10 días hábiles o más.
- Al menos 2 días hábiles entre correos; si dos fases chocan se omite la más
  suave (primero el Recordatorio).
- Ningún correo se repite; si la fecha cambia, se recalcula lo que falta.

**Días hábiles.** Lunes a viernes, descontando feriados oficiales (incluido el
descanso del 20 de noviembre de 2026, Decreto 507) y las vacaciones de
Navidad. Las vacaciones solo de estudiantes (Carnaval y Semana Santa) se
cuentan, porque el personal trabaja. Si la actividad cae en día no laborable,
el Seguimiento sale el siguiente día hábil.

**Envío.** 09:10, hora de Ecuador, desde `mibermeov@eightacademy.edu.ec`, firmado
por Marisol Bermeo, Departamento de Planificación. Contenido: actividad, fecha
límite, responsable, objetivo y descripción, sin enlace a la plataforma. El
minuto a minuto se entrega a `planificacion@` con copia a `mibermeov@`.
Fecha límite: el día hábil anterior al memo (o a la actividad, si no hay memo).

**Destinatarios.** Los responsables de cada área reciben cada correo. Las
personas en copia (Dirección de Planificación, Inspección, Talento Humano,
Secretaría, Rectorado y otras) reciben un solo **resumen diario**, con los memos
destacados; si ese día no salió nada, no hay resumen. Las listas se editan en
`avisos.html` y se guardan en Firestore (`config/avisos`), no en el repositorio.

### Cómo está construido el envío

| Pieza | Qué hace |
|---|---|
| `apps-script/Logica.js` | Días hábiles, fases y calendario comprimido. Probado en `tests/avisos-logica.test.mjs`. |
| `apps-script/Avisos.js` | Decide qué sale cada día, redacta los correos y el resumen, y los envía. Simulación completa en `tests/avisos-envio.test.mjs`. |
| Google Apps Script | Ejecuta `Avisos.js` con la cuenta de Marisol Bermeo: el correo sale de su buzón y no se guarda ninguna contraseña. |
| `public/avisos.html` | Configuración para super administradores: modo, responsables, copias, días no laborables y registro de envíos. |
| Casilla en el detalle de cada actividad | "Minuto a minuto entregado" (solo super administradores). Entregada = neón; incumplida = marca de agua. |

Colecciones nuevas en Firestore: `entregas` (la casilla), `avisos` (fases
enviadas y estado de cada actividad), `registroAvisos` (cada correo enviado) y
`config/avisos`. Las dos intermedias solo las escribe el script.

**Modos.** *Prueba*: todo llega solo al correo de prueba (máximo 5 al día) y no
se guarda nada. *Activo*: llega a los responsables. *En pausa*: no sale nada.

### Puesta en marcha del envío (una sola vez)

1. **Permiso sobre Firestore para la cuenta que envía.** En
   [IAM del proyecto](https://console.cloud.google.com/iam-admin/iam?project=eight-academy-poa):
   *Otorgar acceso* → `mibermeov@eightacademy.edu.ec` → rol **Usuario de Cloud Datastore**.
2. **Subir el script.** Desde esta carpeta, con [clasp](https://github.com/google/clasp):
   `npx @google/clasp login`, luego `npx @google/clasp create --type standalone --title "Avisos POA" --rootDir apps-script`
   y `npx @google/clasp push`. Compartir el proyecto con `mibermeov@` como editora.
3. **Instalar.** Con la cuenta de Marisol Bermeo, abrir el proyecto, elegir la
   función `instalar` y pulsar *Ejecutar*. Aceptar los permisos (enviar correo,
   conectarse a Firestore, programar la hora de envío).
4. **Configurar.** En `avisos.html`, *Cargar archivo inicial* con
   `datos/avisos-config.json` (no está en el repositorio) y *Guardar* en modo Prueba.
5. **Probar.** La función `simularHoy` muestra en el registro lo que saldría
   hoy, sin enviar. En modo Prueba, a las 09:10 llegan hasta 5 correos al correo
   de prueba. Cuando todo esté bien, cambiar a **Activo**.

Si se cambia el código de `apps-script/`, basta `npx @google/clasp push`; si se
añaden permisos nuevos, Marisol debe volver a ejecutar `instalar`.

---

## Coste

Plan gratuito de Firebase (Spark) y GitHub Pages gratuito. Las actividades se
guardan en siete documentos, uno por área, para que abrir el tablero cueste
siete lecturas por persona y no cientos.
