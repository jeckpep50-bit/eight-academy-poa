/* Lógica de los avisos por correo: días hábiles, fases y calendario comprimido.
   Sin dependencias: corre igual en Apps Script y en las pruebas de Node. */
var Logica = (function () {
  var FASES = ['anticipacion', 'recordatorio', 'urgencia', 'memo', 'seguimiento'];
  var TABLA = {
    grande:  { anticipacion: 50, recordatorio: 30, urgencia: 15, memo: 5 },
    mediana: { anticipacion: 30, recordatorio: 18, urgencia: 10, memo: 3 },
    pequena: { anticipacion: 15, recordatorio: 10, urgencia: 5,  memo: 2 }
  };
  var PROPORCION = { recordatorio: 0.6, urgencia: 0.3, memo: 0.1 };
  var MINIMO_PARA_MEMO = 10;
  var SEPARACION_MINIMA = 2;

  function aFecha(iso) { var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function aISO(d) { return d.toISOString().slice(0, 10); }
  function sumarDias(iso, n) { var d = aFecha(iso); d.setUTCDate(d.getUTCDate() + n); return aISO(d); }

  function crearCalendario(noLaborables) {
    var cerrados = {};
    (noLaborables || []).forEach(function (f) { cerrados[f] = true; });
    function esHabil(iso) { var w = aFecha(iso).getUTCDay(); return w !== 0 && w !== 6 && !cerrados[iso]; }
    function siguienteHabil(iso) { while (!esHabil(iso)) iso = sumarDias(iso, 1); return iso; }
    function habilAnterior(iso) { do { iso = sumarDias(iso, -1); } while (!esHabil(iso)); return iso; }
    // k-ésimo día hábil antes de `iso` (1 = el día hábil inmediatamente anterior)
    function habilAntes(iso, k) { for (var i = 0; i < k; i++) iso = habilAnterior(iso); return iso; }
    // días hábiles d con desde <= d < hasta
    function habilesEntre(desde, hasta) {
      var n = 0;
      for (var d = desde; d < hasta; d = sumarDias(d, 1)) if (esHabil(d)) n++;
      return n;
    }
    return { esHabil: esHabil, siguienteHabil: siguienteHabil, habilAnterior: habilAnterior,
             habilAntes: habilAntes, habilesEntre: habilesEntre };
  }

  function separar(lista) {
    // Si dos correos quedan a menos de 2 días hábiles, se omite el más suave.
    ['recordatorio', 'urgencia'].forEach(function (blanda) {
      var i = lista.findIndex(function (x) { return x.fase === blanda; });
      if (i < 0) return;
      var antes = lista[i - 1], despues = lista[i + 1], dias = lista[i].dias;
      if ((antes && antes.dias - dias < SEPARACION_MINIMA) ||
          (despues && dias - despues.dias < SEPARACION_MINIMA)) lista.splice(i, 1);
    });
    return lista;
  }

  /* Plan de envíos de una actividad.
     clase: 'grande' | 'mediana' | 'pequena'. inicio: fecha de la actividad (ISO).
     entrada: día en que la actividad empezó a seguirse (ISO).
     Devuelve null si no corresponde enviar nada. */
  function planificar(clase, inicio, entrada, cal) {
    var tabla = TABLA[clase];
    if (!tabla || !inicio || !entrada) return null;
    var primero = cal.siguienteHabil(entrada);
    var disponibles = cal.habilesEntre(primero, inicio);
    if (disponibles < 1) return null;

    var comprimido = disponibles < tabla.anticipacion;
    var lista;
    if (!comprimido) {
      lista = ['anticipacion', 'recordatorio', 'urgencia', 'memo'].map(function (f) {
        return { fase: f, dias: tabla[f] };
      });
    } else {
      lista = [{ fase: 'anticipacion', dias: disponibles },
               { fase: 'recordatorio', dias: Math.round(disponibles * PROPORCION.recordatorio) },
               { fase: 'urgencia',     dias: Math.round(disponibles * PROPORCION.urgencia) }];
      if (disponibles >= MINIMO_PARA_MEMO)
        lista.push({ fase: 'memo', dias: Math.max(1, Math.round(disponibles * PROPORCION.memo)) });
      lista = lista.filter(function (x, i) { return i === 0 || x.dias >= 1; });
      lista = separar(lista);
    }

    var fases = lista.map(function (x) {
      return { fase: x.fase, dias: x.dias, fecha: cal.habilAntes(inicio, x.dias) };
    });
    fases.push({ fase: 'seguimiento', dias: 0, fecha: cal.siguienteHabil(inicio) });

    var memo = fases.find(function (x) { return x.fase === 'memo'; });
    return {
      clase: clase,
      inicio: inicio,
      entrada: entrada,
      disponibles: disponibles,
      comprimido: comprimido,
      fases: fases,
      fechaLimite: cal.habilAnterior(memo ? memo.fecha : inicio)
    };
  }

  /* Qué hacer hoy con una actividad. Si por algún motivo se acumulan varias
     fases vencidas, se envía solo la más avanzada y las demás se omiten. */
  function accionDelDia(plan, registro, hoy, entregado) {
    if (!plan || entregado) return { enviar: null, omitir: [] };
    registro = registro || {};
    var pendientes = plan.fases.filter(function (x) { return x.fecha <= hoy && !registro[x.fase]; });
    if (!pendientes.length) return { enviar: null, omitir: [] };
    var ultima = pendientes[pendientes.length - 1];
    return { enviar: ultima.fase, omitir: pendientes.slice(0, -1).map(function (x) { return x.fase; }) };
  }

  return {
    FASES: FASES, TABLA: TABLA, MINIMO_PARA_MEMO: MINIMO_PARA_MEMO,
    crearCalendario: crearCalendario, planificar: planificar, accionDelDia: accionDelDia,
    sumarDias: sumarDias
  };
})();
