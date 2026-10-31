/* Globología · gestión de eventos, cotizador y dashboard */
(function () {
  const CFG = window.APP_CONFIG || {};
  const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
  const sb = DEMO ? null : window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const TABLE = "globologia_eventos";

  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const ESTADOS = [["presupuesto","Presupuesto"],["confirmado","Confirmado"],["realizado","Realizado"],["cancelado","Cancelado"]];
  const ITEMS_BASE = ["Globos","Figuras","Estructura / alquiler","Flete / traslado","Ayudante"];
  const ESTRUCTURAS = ["Arco orgánico","Columnas","Panel / fondo","Guirnalda","Centros de mesa","Bouquets","Cartel / letras"];
  const ICON = {
    inicio:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/></svg>',
    eventos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke-linecap="round"/></svg>',
    nuevo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><ellipse cx="12" cy="9.5" rx="6" ry="7"/><path d="M12 16.5v5M9 9.5h6M12 6.5v6"/></svg>'
  };

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const hoy = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const MES_HOY = hoy().slice(0, 7);
  const addM = (m, k) => { let [y, mo] = m.split("-").map(Number); mo += k; while (mo > 12) { mo -= 12; y++; } while (mo < 1) { mo += 12; y--; } return y + "-" + String(mo).padStart(2, "0"); };
  const mLabel = (m) => MESES[+m.slice(5) - 1] + " " + m.slice(0, 4);
  const mShort = (m) => MESES[+m.slice(5) - 1].slice(0, 3);
  const fmt = (n) => (n < 0 ? "− " : "") + "$ " + Math.abs(Math.round(n || 0)).toLocaleString("es-AR");
  const fmtK = (n) => n >= 1e6 ? (n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M" : n >= 1e3 ? Math.round(n / 1e3) + " k" : String(Math.round(n));
  const fDate = (f) => f ? +f.slice(8) + " de " + MESES[+f.slice(5, 7) - 1] : "sin fecha";
  function parseMonto(s) { s = String(s ?? "").replace(/[$\s]/g, ""); if (!s) return 0; if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); const n = parseFloat(s); return isNaN(n) ? 0 : n; }
  const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const gastosDe = (e) => sum(e.items || [], (i) => i.monto);
  const ganDe = (e) => (Number(e.precio) || 0) - gastosDe(e);
  const cuenta = (e) => e.estado === "confirmado" || e.estado === "realizado";

  const S = { eventos: [], mes: MES_HOY, view: "inicio", editId: null, filtro: "todos", q: "" };

  /* ---------- datos ---------- */
  const LS = "globologia_demo_eventos";
  const api = {
    async list() {
      if (DEMO) { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } }
      const { data, error } = await sb.from(TABLE).select("*").order("fecha", { ascending: false, nullsFirst: false });
      if (error) throw error; return data;
    },
    async save(ev) {
      if (DEMO) {
        const all = await api.list();
        if (!ev.id) { ev.id = "d" + Date.now().toString(36); ev.created_at = new Date().toISOString(); all.push(ev); }
        else { const k = all.findIndex((x) => x.id === ev.id); all[k] = { ...all[k], ...ev }; }
        localStorage.setItem(LS, JSON.stringify(all)); return ev;
      }
      const { id, ...body } = ev;
      const q = id ? sb.from(TABLE).update(body).eq("id", id).select().single() : sb.from(TABLE).insert(body).select().single();
      const { data, error } = await q; if (error) throw error; return data;
    },
    async remove(id) {
      if (DEMO) { localStorage.setItem(LS, JSON.stringify((await api.list()).filter((x) => x.id !== id))); return; }
      const { error } = await sb.from(TABLE).delete().eq("id", id); if (error) throw error;
    }
  };
  async function reload() {
    try { S.eventos = (await api.list()).map((e) => ({ ...e, items: Array.isArray(e.items) ? e.items : [] })); }
    catch (e) { console.error(e); toast("No pude traer los eventos. Revisá la conexión."); }
    if (!(S.view === "evento" && $("#f-ev"))) render(); // no pisar un formulario a medio completar
  }

  /* ---------- auth ---------- */
  async function boot() {
    showApp(); // sin login: entra directo
  }
  function showLogin() { $("#app").hidden = true; $("#login").hidden = false; }
  function showApp() { $("#login").hidden = true; $("#app").hidden = false; route(); reload(); }
  $("#f-login").addEventListener("submit", async (e) => {
    e.preventDefault(); const err = $("#l-err"); err.hidden = true;
    const { error } = await sb.auth.signInWithPassword({ email: CFG.EMAIL, password: $("#l-pass").value });
    if (error) { err.textContent = "PIN incorrecto."; err.hidden = false; } else showApp();
  });
  $("#logout").addEventListener("click", () => { location.href = "../"; });

  /* ---------- render ---------- */
  function navHTML(mobile) {
    const items = [["inicio","Resumen"],["eventos","Eventos"],["nuevo","Nuevo evento"]];
    let h = items.map(([k, l]) => `<a href="#${k}" class="${S.view === k || (k === "nuevo" && S.view === "evento" && !S.editId) ? "on" : ""}">${ICON[k]}<span>${l}</span></a>`).join("");
    if (mobile) h += `<a href="../">${ICON.inicio.replace(/<path[^>]*>/, '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>')}<span>Apps</span></a>`;
    return h;
  }
  function render() {
    $("#nav-d").innerHTML = navHTML(false); $("#nav-m").innerHTML = navHTML(true);
        const banner = DEMO ? `<div class="banner">Modo prueba: los datos se guardan solo en este navegador. Completá <b>config.js</b> con tu Supabase para que se sincronicen entre dispositivos.</div>` : "";
    if (S.view === "evento") { $("#view").innerHTML = banner + vForm(); bindForm(); calc(); }
    else $("#view").innerHTML = banner + (S.view === "eventos" ? vEventos() : vInicio());
  }

  function monthSw() { return `<div class="monthsw"><button data-act="mes" data-k="-1" aria-label="Mes anterior">‹</button><span>${mLabel(S.mes)}</span><button data-act="mes" data-k="1" aria-label="Mes siguiente">›</button></div>`; }
  const delMes = (m) => S.eventos.filter((e) => e.fecha && e.fecha.slice(0, 7) === m);

  function chart(months) {
    const W = 640, H = 240, L = 46, B = 26, T = 22, R = 8;
    const d = months.map((m) => { const ev = delMes(m).filter(cuenta); return { m, n: ev.length, g: sum(ev, gastosDe), p: Math.max(0, sum(ev, ganDe)) }; });
    const mx = Math.max(1, ...d.map((x) => x.g + x.p));
    const pw = Math.pow(10, Math.floor(Math.log10(mx))); let st = pw; for (const s of [1, 2, 2.5, 5, 10]) if (mx / (s * pw) <= 4) { st = s * pw; break; }
    const top = Math.ceil(mx / st) * st, y = (v) => T + (H - T - B) * (1 - v / top);
    const slot = (W - L - R) / d.length, bw = Math.min(26, slot * 0.55);
    let g = "";
    for (let v = 0; v <= top + 1e-9; v += st) g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmtK(v)}</text>`;
    d.forEach((x, k) => {
      const cx = L + slot * k + slot / 2, x0 = cx - bw / 2;
      g += `<rect class="cg" x="${x0}" y="${y(x.g)}" width="${bw}" height="${y(0) - y(x.g)}" rx="3"><title>${mLabel(x.m)} · gastos ${fmt(x.g)}</title></rect>`;
      g += `<rect class="cp" x="${x0}" y="${y(x.g + x.p)}" width="${bw}" height="${y(x.g) - y(x.g + x.p)}" rx="3"><title>${mLabel(x.m)} · ganancia ${fmt(x.p)}</title></rect>`;
      if (x.n) g += `<text class="cnt" x="${cx}" y="${y(x.g + x.p) - 6}" text-anchor="middle">${x.n}</text>`;
      g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="${x.m === S.mes ? "cur" : ""}">${mShort(x.m)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Facturación por mes">${g}</svg>`;
  }
  function evRow(e) {
    const d = e.fecha ? `<span class="date"><b>${+e.fecha.slice(8)}</b><span>${mShort(e.fecha.slice(0, 7))}</span></span>` : `<span class="date"><b>–</b><span>s/f</span></span>`;
    const sub = [e.tematica, e.localidad, e.mesas ? e.mesas + " mesas" : ""].filter(Boolean).join(" · ");
    return `<a class="row" href="#evento-${e.id}">${d}<div class="rm"><div class="t">${esc(e.cliente)}</div><div class="s">${esc(sub) || "&nbsp;"}</div></div><span class="chip e-${e.estado}">${ESTADOS.find((x) => x[0] === e.estado)?.[1] || ""}</span><span class="amt">${fmt(e.precio)}<small>+${fmt(ganDe(e))}</small></span></a>`;
  }
  function rank(field, evs) {
    const c = {}; evs.forEach((e) => { const k = (e[field] || "").trim(); if (k) { const kk = k[0].toUpperCase() + k.slice(1).toLowerCase(); c[kk] = (c[kk] || 0) + 1; } });
    const r = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5); const mx = r.length ? r[0][1] : 1;
    return r.length ? `<div class="tags">${r.map(([k, v]) => `<div class="tg"><span>${esc(k)}</span><b>${v}</b><span class="tr"><i style="width:${v / mx * 100}%"></i></span></div>`).join("")}</div>` : `<div class="empty">Se completa a medida que cargues eventos.</div>`;
  }

  function vInicio() {
    const m = S.mes, ev = delMes(m), hechos = ev.filter(cuenta), pres = ev.filter((e) => e.estado === "presupuesto");
    const fact = sum(hechos, (e) => e.precio), gas = sum(hechos, gastosDe), gan = fact - gas;
    const porCobrar = sum(hechos.filter((e) => e.estado === "confirmado"), (e) => (Number(e.precio) || 0) - (Number(e.sena) || 0));
    const months = []; for (let k = 11; k >= 0; k--) months.push(addM(m, -k));
    const prox = S.eventos.filter((e) => e.fecha && e.fecha >= hoy() && (e.estado === "confirmado" || e.estado === "presupuesto")).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 6);
    const anio = S.eventos.filter((e) => cuenta(e) && e.fecha && e.fecha.slice(0, 4) === m.slice(0, 4));
    const totAnio = sum(anio, ganDe);
    return `<div class="top"><div><h1>Resumen</h1><p>Cómo viene ${mLabel(m)}</p></div><div class="top-r">${monthSw()}<a class="btn" href="#nuevo">+ Nuevo evento</a></div></div>
    <div class="tiles">
      <div class="tile c1"><span class="l">Eventos del mes</span><span class="v">${hechos.length}</span><span class="s">${pres.length ? pres.length + " presupuesto" + (pres.length > 1 ? "s" : "") + " sin confirmar" : "Confirmados y realizados"}</span></div>
      <div class="tile c4"><span class="l">Facturado</span><span class="v">${fmt(fact)}</span><span class="s">${porCobrar > 0 ? fmt(porCobrar) + " por cobrar" : "Lo que cobraste a clientes"}</span></div>
      <div class="tile c3"><span class="l">Gastos</span><span class="v">${fmt(gas)}</span><span class="s">Figuras, globos, flete…</span></div>
      <div class="tile c2"><span class="l">Ganancia</span><span class="v">${fmt(gan)}</span><span class="s">${fact > 0 ? Math.round(gan / fact * 100) + "% de lo facturado" : "Facturado menos gastos"}</span></div>
    </div>
    <div class="grid2">
      <section class="panel"><div class="ph"><h2>Facturación por mes</h2><div class="legend"><span><i class="dot" style="background:var(--mint)"></i>Ganancia</span><span><i class="dot" style="background:var(--butter)"></i>Gastos</span><span>Número = cantidad de eventos</span></div></div>${chart(months)}
        <div class="hint">Ganancia en ${m.slice(0, 4)}: <b class="num">${fmt(totAnio)}</b> en ${anio.length} eventos</div></section>
      <section class="panel"><div class="ph"><h2>Próximos eventos</h2><a class="linkbtn" href="#eventos">Ver todos</a></div>
        ${prox.length ? `<div class="list">${prox.map(evRow).join("")}</div>` : `<div class="empty">No hay eventos agendados desde hoy.<br><a class="btn sm" href="#nuevo">Cargar evento</a></div>`}</section>
    </div>
    <div class="grid2">
      <section class="panel"><div class="ph"><h2>Temáticas más pedidas</h2><span class="hint">Todos los eventos</span></div>${rank("tematica", S.eventos.filter((e) => e.estado !== "cancelado"))}</section>
      <section class="panel"><div class="ph"><h2>Localidades</h2></div>${rank("localidad", S.eventos.filter((e) => e.estado !== "cancelado"))}</section>
    </div>`;
  }

  function vEventos() {
    let ev = S.eventos.slice();
    if (S.filtro !== "todos") ev = ev.filter((e) => e.estado === S.filtro);
    if (S.q) { const q = S.q.toLowerCase(); ev = ev.filter((e) => [e.cliente, e.tematica, e.localidad, e.colores].join(" ").toLowerCase().includes(q)); }
    ev.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    return `<div class="top"><div><h1>Eventos</h1><p>${S.eventos.length} cargados</p></div><a class="btn" href="#nuevo">+ Nuevo evento</a></div>
    <section class="panel"><div class="ph"><div class="seg">${[["todos","Todos"], ...ESTADOS].map(([k, l]) => `<button data-act="filtro" data-k="${k}" class="${S.filtro === k ? "on" : ""}">${l === "Presupuesto" ? "Presupuestos" : l === "Confirmado" ? "Confirmados" : l === "Realizado" ? "Realizados" : l === "Cancelado" ? "Cancelados" : l}</button>`).join("")}</div>
      <input class="search" id="q" type="search" placeholder="Buscar cliente, temática…" value="${esc(S.q)}" aria-label="Buscar"></div>
      ${ev.length ? `<div class="list">${ev.map(evRow).join("")}</div>` : `<div class="empty">No hay eventos para mostrar.<br><a class="btn sm" href="#nuevo">Cargar evento</a></div>`}</section>`;
  }

  /* ---------- formulario / cotizador ---------- */
  function vForm() {
    const e = S.editId ? S.eventos.find((x) => x.id === S.editId) : null;
    if (S.editId && !e) return `<div class="empty">Cargando evento…</div>`;
    const v = e || { estado: "presupuesto", margen: 100, items: ITEMS_BASE.map((c) => ({ concepto: c, monto: "" })), fecha: "" };
    const items = (v.items && v.items.length ? v.items : [{ concepto: "", monto: "" }]);
    return `<div class="top"><div><h1>${e ? esc(e.cliente) : "Nuevo evento"}</h1><p>${e ? fDate(e.fecha) : "Cargalo como presupuesto y confirmalo cuando te den el OK"}</p></div><a class="linkbtn" href="#eventos">‹ Volver</a></div>
    <form id="f-ev" class="form" autocomplete="off">
      <div class="fset">
        <section class="panel"><h2>Evento</h2>
          <div class="two"><div class="fld"><label for="cliente">Cliente</label><input id="cliente" required value="${esc(v.cliente)}" placeholder="Nombre"></div>
            <div class="fld"><label for="contacto">Contacto</label><input id="contacto" value="${esc(v.contacto)}" placeholder="WhatsApp / Instagram"></div></div>
          <div class="two"><div class="fld"><label for="fecha">Fecha</label><input id="fecha" type="date" value="${esc(v.fecha)}"></div>
            <div class="fld"><label for="localidad">Localidad</label><input id="localidad" value="${esc(v.localidad)}" placeholder="Ej: Lanús" list="dl-loc"></div></div>
          <div class="two"><div class="fld"><label for="tematica">Temática</label><input id="tematica" value="${esc(v.tematica)}" placeholder="Ej: Frozen, safari, 15 años" list="dl-tem"></div>
            <div class="fld"><label for="colores">Colores</label><input id="colores" value="${esc(v.colores)}" placeholder="Ej: rosa, dorado y blanco"></div></div>
          <div class="three"><div class="fld"><label for="mesas">Mesas</label><input id="mesas" type="number" min="0" inputmode="numeric" value="${v.mesas ?? ""}"></div>
            <div class="fld" style="grid-column:span 2"><label for="mesas_detalle">Detalle de mesas</label><input id="mesas_detalle" value="${esc(v.mesas_detalle)}" placeholder="Ej: mesa principal + 6 centros"></div></div>
          <div class="fld"><label for="estructura">Estructura</label><input id="estructura" value="${esc(v.estructura)}" placeholder="Ej: arco orgánico + panel redondo" list="dl-est"></div>
          <div class="fld"><span class="lb">Estado</span><div class="pills">${ESTADOS.map(([k, l]) => `<label><input type="radio" name="estado" id="est-${k}" value="${k}" ${v.estado === k ? "checked" : ""}>${l}</label>`).join("")}</div></div>
        </section>
        <section class="panel"><div class="ph"><h2>Gastos del evento</h2><button type="button" class="linkbtn" data-act="add-item">+ Agregar gasto</button></div>
          <div class="items" id="items">${items.map(itemRow).join("")}</div></section>
        <section class="panel"><h2>Notas</h2><div class="fld"><textarea id="notas" aria-label="Notas" placeholder="Horario de armado, pedidos especiales, cómo llegar…">${esc(v.notas)}</textarea></div></section>
      </div>
      <aside class="quote" aria-label="Cotizador">
        <h2>Cotizador</h2>
        <div class="qrow"><span>Gastos</span><b id="q-gastos">$ 0</b></div>
        <div class="fld"><label for="margen">Ganancia que querés sacar</label><div class="range"><input type="range" id="margen-r" min="0" max="300" step="5" value="${v.margen ?? 100}" aria-label="Porcentaje de ganancia"><input id="margen" type="number" min="0" max="1000" style="width:84px" value="${v.margen ?? 100}"><span>%</span></div></div>
        <div class="sug"><span>Precio sugerido <b id="q-sug" class="num">$ 0</b></span><button type="button" class="btn sm mint" data-act="usar-sug">Usar este</button></div>
        <div class="fld"><label for="precio">Le cobro</label><input id="precio" inputmode="decimal" value="${v.precio ? v.precio : ""}" placeholder="$ 0" style="font-family:var(--f-display);font-size:1.4rem;font-weight:600"></div>
        <div class="qrow gan" id="q-ganrow"><span>Ganancia</span><b id="q-gan">$ 0</b></div>
        <div class="qrow"><span>Margen sobre el precio</span><b id="q-mar">0%</b></div>
        <div class="fld"><label for="sena">Seña cobrada</label><input id="sena" inputmode="decimal" value="${v.sena ? v.sena : ""}" placeholder="$ 0"></div>
        <div class="qrow total"><span>Resta cobrar</span><b id="q-resta">$ 0</b></div>
        <div class="acts"><button class="btn" type="submit">Guardar</button><button type="button" class="btn ghost" data-act="copiar">Copiar presupuesto</button></div>
        ${e ? `<button type="button" class="btn danger" data-act="borrar">Borrar evento</button>` : ""}
      </aside>
    </form>
    <datalist id="dl-loc">${uniq("localidad").map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
    <datalist id="dl-tem">${uniq("tematica").map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
    <datalist id="dl-est">${[...new Set([...ESTRUCTURAS, ...uniq("estructura")])].map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
  }
  const uniq = (f) => [...new Set(S.eventos.map((e) => (e[f] || "").trim()).filter(Boolean))].slice(0, 40);
  let itemSeq = 0;
  function itemRow(i) { const k = itemSeq++; return `<div class="item"><input id="ic-${k}" class="i-c" aria-label="Concepto" placeholder="Concepto" value="${esc(i.concepto)}"><input id="im-${k}" class="i-m" aria-label="Monto" inputmode="decimal" placeholder="$ 0" value="${i.monto !== "" && i.monto != null ? esc(i.monto) : ""}"><button type="button" class="x" data-act="del-item" aria-label="Quitar gasto">×</button></div>`; }

  function readItems() { return [...document.querySelectorAll("#items .item")].map((r) => ({ concepto: r.querySelector(".i-c").value.trim(), monto: parseMonto(r.querySelector(".i-m").value) })).filter((i) => i.concepto || i.monto); }
  const redondeo = (n) => n >= 10000 ? Math.ceil(n / 1000) * 1000 : Math.ceil(n / 100) * 100;
  function calc() {
    if (!$("#f-ev")) return;
    const g = sum(readItems(), (i) => i.monto), mg = Number($("#margen").value) || 0;
    const sug = g > 0 ? redondeo(g * (1 + mg / 100)) : 0, p = parseMonto($("#precio").value), sena = parseMonto($("#sena").value), gan = p - g;
    $("#q-gastos").textContent = fmt(g); $("#q-sug").textContent = fmt(sug); $("#q-sug").dataset.v = sug;
    $("#q-gan").textContent = fmt(gan); $("#q-ganrow").className = "qrow " + (gan < 0 ? "neg" : "gan");
    $("#q-mar").textContent = p > 0 ? Math.round(gan / p * 100) + "%" : "–"; $("#q-resta").textContent = fmt(Math.max(0, p - sena));
  }
  function bindForm() {
    const f = $("#f-ev"); if (!f) return;
    f.addEventListener("input", (e) => { if (e.target.id === "margen-r") $("#margen").value = e.target.value; if (e.target.id === "margen") $("#margen-r").value = e.target.value; calc(); });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ev = {
        cliente: $("#cliente").value.trim(), contacto: $("#contacto").value.trim(), fecha: $("#fecha").value || null,
        localidad: $("#localidad").value.trim(), tematica: $("#tematica").value.trim(), colores: $("#colores").value.trim(),
        mesas: parseInt($("#mesas").value, 10) || 0, mesas_detalle: $("#mesas_detalle").value.trim(), estructura: $("#estructura").value.trim(),
        items: readItems(), margen: Number($("#margen").value) || 0, precio: parseMonto($("#precio").value), sena: parseMonto($("#sena").value),
        estado: (document.querySelector('input[name="estado"]:checked') || {}).value || "presupuesto", notas: $("#notas").value
      };
      if (!ev.cliente) return toast("Poné el nombre del cliente");
      if (S.editId) ev.id = S.editId;
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      try { const saved = await api.save(ev); toast("Evento guardado"); await reload(); location.hash = "evento-" + saved.id; }
      catch (err) { console.error(err); toast("No se pudo guardar. Probá de nuevo."); }
      btn.disabled = false;
    });
  }
  function textoPresupuesto() {
    const g = (id) => ($("#" + id) || {}).value || "";
    const p = parseMonto(g("precio")), sena = parseMonto(g("sena"));
    const L = ["*Presupuesto Globología*", ""];
    if (g("cliente")) L.push("Cliente: " + g("cliente"));
    if (g("fecha")) L.push("Fecha: " + fDate(g("fecha")));
    if (g("localidad")) L.push("Lugar: " + g("localidad"));
    if (g("tematica")) L.push("Temática: " + g("tematica"));
    if (g("colores")) L.push("Colores: " + g("colores"));
    if (g("mesas") && g("mesas") !== "0") L.push("Mesas: " + g("mesas") + (g("mesas_detalle") ? " (" + g("mesas_detalle") + ")" : ""));
    else if (g("mesas_detalle")) L.push("Mesas: " + g("mesas_detalle"));
    if (g("estructura")) L.push("Estructura: " + g("estructura"));
    L.push("", "*Total: " + fmt(p) + "*");
    if (sena > 0) L.push("Seña abonada: " + fmt(sena), "Resta: " + fmt(p - sena));
    return L.join("\n");
  }

  /* ---------- eventos globales ---------- */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "mes") { S.mes = addM(S.mes, +b.dataset.k); render(); }
    else if (a === "filtro") { S.filtro = b.dataset.k; render(); }
    else if (a === "add-item") { $("#items").insertAdjacentHTML("beforeend", itemRow({ concepto: "", monto: "" })); $("#items .item:last-child .i-c").focus(); }
    else if (a === "del-item") { b.closest(".item").remove(); calc(); }
    else if (a === "usar-sug") { $("#precio").value = $("#q-sug").dataset.v || ""; calc(); }
    else if (a === "copiar") {
      const t = textoPresupuesto();
      try { await navigator.clipboard.writeText(t); toast("Presupuesto copiado: pegalo en WhatsApp"); }
      catch { toast("No pude copiar automáticamente"); }
    }
    else if (a === "borrar") {
      if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Tocá de nuevo para borrar"; setTimeout(() => { b.classList.remove("armed"); b.textContent = "Borrar evento"; }, 3500); return; }
      try { await api.remove(S.editId); toast("Evento borrado"); location.hash = "eventos"; await reload(); } catch { toast("No se pudo borrar"); }
    }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "q") { S.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $("#q"); q.focus(); q.setSelectionRange(pos, pos); } });

  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600); }
  function route() {
    const h = location.hash.slice(1);
    if (h.startsWith("evento-")) { S.view = "evento"; S.editId = h.slice(7); }
    else if (h === "nuevo") { S.view = "evento"; S.editId = null; }
    else { S.view = h === "eventos" ? "eventos" : "inicio"; S.editId = null; }
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  boot();
})();
