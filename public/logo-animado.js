/* Portada: el logo se arma con píxeles, se desintegra y forma la frase, en bucle. */
const FRASE = ["Un sistema organizado", "es un sistema exitoso"];
const COLOR_FRASE = [[238, 241, 255], [245, 208, 78]];
const LOGO = "./img/logo-eight-academy.png";

// S: dispersos alrededor del logo · L: logo · T: frase.
// Cada píxel viaja directo de su sitio en el logo a su sitio en la frase:
// sin una nube intermedia, el cambio no deja manchas a la vista.
const OPACIDAD = { S: 0, L: 1, T: 1 };
const TRAMOS = [
  { de: "S", a: "L", dur: 2200 },   // solo la primera vez
  { de: "L", a: "L", dur: 2800 },
  { de: "L", a: "T", dur: 2600 },
  { de: "T", a: "T", dur: 3600 },
  { de: "T", a: "L", dur: 2600 },
];
const CICLO = TRAMOS.slice(1).reduce((s, t) => s + t.dur, 0);
const T_LOGO = TRAMOS[0].dur + 200;
const T_FRASE = TRAMOS[0].dur + TRAMOS[1].dur + TRAMOS[2].dur + 200;
const DEMORA_MAX = 0.4;

const lienzo = document.getElementById("logoAnim");
if (lienzo) arrancar(lienzo);

function arrancar(cv) {
  const ctx = cv.getContext("2d");
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const img = new Image();
  img.src = LOGO;
  const listo = Promise.all([
    img.decode(),
    document.fonts ? document.fonts.load('600 48px "Source Serif 4"').catch(() => {}) : null,
  ]);
  listo.catch(() => { cv.hidden = true; });

  let W = 0, H = 0, dpr = 1, datos = null, buf = null;
  let N = 0, P = null, bloque = 1, quietoPintado = null;
  let visible = false, raf = 0, reloj = 0, ultimo = 0, primera = true;

  let espera;
  new ResizeObserver(() => { clearTimeout(espera); espera = setTimeout(medir, 120); }).observe(cv);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; mover(); }).observe(cv);
  document.addEventListener("visibilitychange", mover);
  if (reducido) setInterval(() => { if (N) { reloj = reloj === T_LOGO ? T_FRASE : T_LOGO; dibujar(); } }, 6000);

  async function medir() {
    const r = cv.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    try { await listo; } catch { return; }
    dpr = Math.min(matchMedia("(pointer: coarse)").matches ? 1.5 : 2, window.devicePixelRatio || 1);
    W = Math.round(r.width); H = Math.round(r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    datos = ctx.createImageData(cv.width, cv.height);
    buf = new Uint32Array(datos.data.buffer);
    construir();
    reloj = primera && !reducido ? 0 : T_LOGO;
    primera = false;
    dibujar();
    mover();
  }

  function muestrear(pintar, paso) {
    const oc = document.createElement("canvas");
    oc.width = W; oc.height = H;
    const c = oc.getContext("2d", { willReadFrequently: true });
    pintar(c);
    const d = c.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 0; y < H; y += paso) for (let x = 0; x < W; x += paso) {
      const k = (y * W + x) * 4;
      if (d[k + 3] > 140) pts.push([x, y, d[k], d[k + 1], d[k + 2]]);
    }
    return pts;
  }

  function construir() {
    quietoPintado = null;
    const paso = W < 900 ? 2 : 3;
    bloque = Math.max(1, Math.round(paso * 0.85 * dpr));

    const logo = muestrear(c => {
      const e = Math.min((W * 0.92) / img.width, (H * 0.56) / img.height);
      const w = img.width * e, h = img.height * e;
      c.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }, paso);

    const frase = muestrear(c => {
      let f = H * 0.2;
      c.font = `600 ${f}px "Source Serif 4", Georgia, serif`;
      const ancho = Math.max(...FRASE.map(l => c.measureText(l).width));
      if (ancho > W * 0.92) f *= (W * 0.92) / ancho;
      c.font = `600 ${f}px "Source Serif 4", Georgia, serif`;
      c.textAlign = "center"; c.textBaseline = "middle";
      FRASE.forEach((linea, i) => {
        c.fillStyle = `rgb(${COLOR_FRASE[i].join(",")})`;
        c.fillText(linea, W / 2, H / 2 + (i - 0.5) * f * 1.25);
      });
    }, paso);

    if (!logo.length || !frase.length) { N = 0; return; }
    N = Math.max(logo.length, frase.length);
    const rellenar = a => { while (a.length < N) a.push(a[(Math.random() * a.length) | 0]); };
    rellenar(logo); rellenar(frase);
    const porX = (a, b) => a[0] - b[0];
    logo.forEach(p => p[0] += Math.random() * 0.5); logo.sort(porX);
    frase.sort(porX);

    const f32 = () => new Float32Array(N);
    P = { x: {}, y: {}, cL: new Uint8Array(N * 3), cT: new Uint8Array(N * 3), demora: f32(), semilla: f32() };
    for (const k of "SLT") { P.x[k] = f32(); P.y[k] = f32(); }

    for (let i = 0; i < N; i++) {
      const [lx, ly, lr, lg, lb] = logo[i];
      const [tx, ty, tr, tg, tb] = frase[i];
      const ang = Math.random() * Math.PI * 2, radio = 30 + Math.random() * 110;
      P.x.S[i] = lx + Math.cos(ang) * radio; P.y.S[i] = ly + Math.sin(ang) * radio * 0.6;
      P.x.L[i] = lx;                         P.y.L[i] = ly;
      P.x.T[i] = tx;                         P.y.T[i] = ty;
      P.cL.set([lr, lg, lb], i * 3);
      P.cT.set([tr, tg, tb], i * 3);
      P.demora[i] = (lx / W) * (DEMORA_MAX - 0.08) + Math.random() * 0.08;
      P.semilla[i] = Math.random() * Math.PI * 2;
    }
  }

  function tramoActual() {
    if (reloj < TRAMOS[0].dur) return [TRAMOS[0], reloj / TRAMOS[0].dur];
    let r = (reloj - TRAMOS[0].dur) % CICLO;
    for (let i = 1; i < TRAMOS.length; i++) {
      if (r < TRAMOS[i].dur) return [TRAMOS[i], r / TRAMOS[i].dur];
      r -= TRAMOS[i].dur;
    }
    return [TRAMOS[1], 0];
  }

  const suave = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const colorDe = k => (k === "T" ? P.cT : P.cL);

  function dibujar() {
    if (!N) return;
    const [tramo, s] = tramoActual();
    const { de, a } = tramo;
    const quieto = de === a;
    // mientras el logo o la frase están quietos no hace falta repintar
    if (quieto && tramo === quietoPintado) return;
    quietoPintado = quieto ? tramo : null;
    const xa = P.x[de], ya = P.y[de], xb = P.x[a], yb = P.y[a];
    const ca = colorDe(de), cb = colorDe(a);
    const oa = OPACIDAD[de], ob = OPACIDAD[a];
    const cw = cv.width, ch = cv.height, t = reloj / 1000;

    buf.fill(0);
    for (let i = 0; i < N; i++) {
      let p = quieto ? 1 : Math.min(1, Math.max(0, (s - P.demora[i]) / (1 - DEMORA_MAX)));
      p = suave(p);
      const sem = P.semilla[i];
      const arco = quieto ? 0 : Math.sin(Math.PI * p);
      const giro = arco * 5;
      const x = xa[i] + (xb[i] - xa[i]) * p + Math.sin(t * 2.1 + sem) * giro;
      const y = ya[i] + (yb[i] - ya[i]) * p + Math.cos(t * 1.7 + sem) * giro
              - arco * (14 + sem * 4);
      const op = (oa + (ob - oa) * p) * (1 - 0.3 * arco);
      if (op <= 0.01) continue;
      const j = i * 3;
      const r = ca[j] + (cb[j] - ca[j]) * p;
      const g = ca[j + 1] + (cb[j + 1] - ca[j + 1]) * p;
      const b = ca[j + 2] + (cb[j + 2] - ca[j + 2]) * p;
      const px = (x * dpr) | 0, py = (y * dpr) | 0;
      if (px < 0 || py < 0 || px + bloque > cw || py + bloque > ch) continue;
      const v = (((op * 255) | 0) << 24) | (b << 16) | (g << 8) | r;
      for (let dy = 0; dy < bloque; dy++) {
        const fila = (py + dy) * cw + px;
        for (let dx = 0; dx < bloque; dx++) buf[fila + dx] = v;
      }
    }
    ctx.putImageData(datos, 0, 0);
  }

  function mover() {
    const animar = visible && document.visibilityState === "visible" && N > 0 && !reducido;
    if (animar && !raf) {
      ultimo = performance.now();
      raf = requestAnimationFrame(cuadro);
    } else if (!animar && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function cuadro(ahora) {
    reloj += Math.min(64, ahora - ultimo);
    ultimo = ahora;
    dibujar();
    raf = requestAnimationFrame(cuadro);
  }
}
