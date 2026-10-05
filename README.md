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

- [ ] **Avisos automáticos por correo.** Lógica acordada, pendiente de que se
      defina el responsable de cada área:
  - Correo 1: 30 / 21 / 14 días hábiles antes (prioridad Alta / Media / Baja).
  - Correo 2: 15 / 10 / 7 días hábiles antes.
  - Correo 3: 3 días hábiles antes, para todas las prioridades.
  - Correo 4: el día del evento, si nunca se entregó el minuto a minuto.
  - Envío lunes a viernes a las 09:10 (hora de Ecuador) desde
    `mibermeov@eightacademy.edu.ec`, al responsable del área con copia a los
    super administradores. Sin enlaces a la plataforma.
- [ ] **Marcador "minuto a minuto entregado"** en el calendario, solo para
      super administradores: detiene los correos y muestra la actividad en
      neón. Si se llega al correo 4 sin entrega, la actividad queda como marca
      de agua.
- [ ] Definir qué puede editar exactamente cada super administrador.
- [ ] Roles intermedios (directivo, docente por área).

---

## Coste

Plan gratuito de Firebase (Spark) y GitHub Pages gratuito. Las actividades se
guardan en siete documentos, uno por área, para que abrir el tablero cueste
siete lecturas por persona y no cientos.
