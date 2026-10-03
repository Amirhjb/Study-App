#!/usr/bin/env node
/**
 * Simula partidas de Último Relato con decisiones al azar y resume el equilibrio.
 *
 * Uso:
 *   node simular.mjs                       10.000 partidas por política, 30 días como máximo
 *   node simular.mjs 2000 --dias 15        menos partidas, partidas más cortas
 *   node simular.mjs --semilla 7 --json resultados.json
 *
 * Qué es real y qué es supuesto:
 * - REAL: el motor se carga tal cual desde jugar.html (reducer, hambre/sed/sueño, tiradas d20,
 *   recetas, refugio, clima, enfermedades, cordura, luz, desgaste, escasez, compañeros, trueque).
 *   La respuesta de la "IA" pasa por el mismo intérprete (fd) que usa el juego.
 * - SUPUESTO: lo que haría la IA (daño, objetos encontrados, XP, zonas nuevas...). En el juego lo
 *   decide el modelo de lenguaje; aquí lo decide la tabla IA de abajo. Cambia esas cifras para
 *   probar un narrador más duro o más blando.
 *
 * Tres tandas de partidas:
 * - "azar": cada turno elige al azar un tipo de opción disponible (acción libre, usar objeto,
 *   fabricar, dormir, refugio, comerciar, compañero) y luego una opción concreta, también al azar.
 * - "sensato": igual de aleatorio, pero bebe, come, se cura y duerme cuando lo necesita.
 * - "sensato, IA inofensiva": el mismo jugador con una IA que nunca hace daño, ni hiere, ni enferma.
 *   Lo que mate aquí lo mata el motor (hambre, sed, clima, infecciones, emboscadas al dormir...).
 * - "sensato, IA inofensiva, sin clima severo": control para medir cuánto mata el clima.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

// ---------------------------------------------------------------- argumentos
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def;
};
const PARTIDAS = Number(argv.find((a, i) => /^\d+$/.test(a) && !argv[i - 1]?.startsWith("--")) ?? 10000);
const DIAS_MAX = Number(opt("--dias", 30));
const SEMILLA = Number(opt("--semilla", 1));
const SALIDA_JSON = opt("--json", null);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML = opt("--html", path.join(AQUI, "jugar.html"));

// ---------------------------------------------------------------- SUPUESTOS DE LA IA
// Nada de esto está en el motor: es lo que imagino que haría un narrador "medio".
const IA = {
  // Acciones sin tirada (explorar, buscar, viajar, hablar): resultado al azar con estos pesos.
  resultadoSinTirada: { pifia: 5, fallo: 25, justo: 25, exito: 35, critico: 10 },
  // Daño base por resultado [mín, máx]; se multiplica por (0,6 + 0,2 × peligro) y por 1,5 en combate.
  dano: { pifia: [6, 14], fallo: [1, 6], justo: [1, 3] },
  probDanoFallo: 0.4, // fuera de combate, un fallo hace daño el 40 % de las veces (en combate, siempre)
  probDanoJusto: 0.25, // "con algún coste": rasguño
  // Cuántos objetos da según el resultado.
  objetos: { justo: [0, 1], exito: [1, 2], critico: [2, 3] },
  // Minutos que dura cada tipo de acción [mín, máx] (regla 7 del prompt).
  minutos: {
    combate: [5, 20], sigilo: [15, 45], oficio: [20, 60], caza: [60, 180], nada: [10, 30],
    explorar: [45, 90], buscar: [20, 60], viajar: [90, 150], hablar: [15, 40], comer: [5, 15],
  },
  xp: { justo: 1, exito: 1, critico: 2, fallo: 0.3 }, // el número es el que manda la IA (×50 en el motor); 0.3 = 30 % de dar 1
  probLesionPifia: 0.4,
  probLesionFalloCombate: 0.2,
  probEnfermedadPifia: 0.05,
  probRadiacion: 0.03, // por acción en subterráneo de peligro ≥ 4 (apocalipsis y ciencia ficción)
  probPerderObjetoPifia: 0.2,
  probGastarMunicion: 0.3,
  probReceta: { hablar: 0.15, explorarCritico: 0.2 },
  probCompanero: { exito: 0.08, critico: 0.15 },
  probTrueque: { hablar: 0.25, explorar: 0.03 },
  cordura: { pifia: -5, falloPeligroso: -3, critico: 3, hablarBien: 2, amenaza: -3 },
  // Respeta el RITMO: con "respiro" no hace daño; con "amenaza" añade un golpe el 50 % de las veces.
  ritmo: { probGolpeAmenaza: 0.5, golpe: [2, 8] },
  peligroZonaNueva: { 1: 20, 2: 30, 3: 25, 4: 15, 5: 10 },
  tipoZonaNueva: { urban: 30, wilderness: 30, indoor: 20, underground: 10, water: 10 },
  // Botín: grupos y pesos de cada objeto del catálogo.
  botin: {
    comida: { "Lata de comida": 5, "Comida enlatada x3": 1, "Barrita energética": 3, "Agua (500ml)": 5, "Botella de agua": 2, "Semillas variadas": 1 },
    material: { Chatarra: 4, Madera: 3, Tela: 2, "Cuerda (5m)": 2, Trapos: 2, Alambre: 1, "Cinta adhesiva": 1, Pegamento: 0.5, "Resina de pino": 0.5, Tablones: 1 },
    medico: { "Vendas x5": 2, "Botiquín pequeño": 1, Antibióticos: 0.7, Alcohol: 1, Morfina: 0.3, "Carbón activado": 0.3, "Yoduro de potasio": 0.3, "Suero oral": 0.3, "Materiales químicos": 0.5, "Botiquín completo": 0.2 },
    equipo: { Pilas: 1.5, Mechero: 1, Linterna: 0.4, Antorcha: 0.5, "Ropa de abrigo": 0.8, "Chaqueta de cuero": 0.3, "Mochila pequeña": 0.3, "Herramientas básicas": 0.3, "Kit de reparación": 0.2, "Manual de medicina": 0.1, "Manual de ingeniería": 0.1, Biblia: 0.1, Ganzúas: 0.2, Brújula: 0.2, "Mapa de la zona": 0.2, Pedernal: 0.3, "Aguja e hilo": 0.3 },
    arma: { Cuchillo: 0.5, Machete: 0.3, "Bate de béisbol": 0.3, "Hacha de mano": 0.3, Pistola: 0.1, "Cargador 9mm": 0.6, "Flechas x10": 0.3, "Cartuchos escopeta x10": 0.2 },
  },
  perfilBotin: {
    buscar: { comida: 70, material: 15, medico: 10, equipo: 5 },
    explorar: { comida: 30, material: 35, medico: 15, equipo: 15, arma: 5 },
    combate: { arma: 30, medico: 25, comida: 30, equipo: 15 },
    oficio: { material: 80, equipo: 20 },
    sigilo: { comida: 40, material: 30, equipo: 30 },
    viajar: { comida: 30, material: 35, medico: 15, equipo: 15, arma: 5 },
    trueque: { comida: 30, material: 25, medico: 20, equipo: 15, arma: 10 },
  },
  // Caza, pesca, cultivo: comida inventada por la IA (sin botón de "Comer": hay que pedírselo al narrador).
  comidaCazada: { Pesca: "Pescado fresco", Trampas: "Carne de conejo", Rastreo: "Carne de conejo", "Cría de animales": "Huevos", Cultivo: "Verduras" },
  hambreComidaInventada: 25,
};

// Acciones libres. El texto está elegido para que el motor detecte esa habilidad (se comprueba al arrancar).
const ACCIONES = [
  ["Sigilo", "Me escondo y avanzo sin hacer ruido", "sigilo"],
  ["Puntería", "Disparo contra lo que se acerca", "combate"],
  ["Recarga", "Recargo el arma", "nada"],
  ["Primeros auxilios", "Vendo la herida", "curar"],
  ["Rastreo", "Sigo el rastro de unas huellas", "caza"],
  ["Trampas", "Pongo una trampa", "caza"],
  ["Pesca", "Pesco en el agua", "caza"],
  ["Cultivo", "Planto unas semillas", "caza"],
  ["Cría de animales", "Intento amansar a un perro", "caza"],
  ["Cocina", "Cocino algo caliente", "nada"],
  ["Mecánica", "Reparo un mecanismo", "oficio"],
  ["Electricidad", "Empalmo un cable suelto", "oficio"],
  ["Carpintería", "Asierro madera", "oficio"],
  ["Albañilería", "Refuerzo una pared", "oficio"],
  ["Herrería", "Intento forjar una herramienta", "oficio"],
  ["Sastrería", "Coso un remiendo", "nada"],
  ["Fuerza", "Fuerzo la puerta", "oficio"],
  ["Hoja corta", "Ataco con el cuchillo", "combate"],
  ["Hoja larga", "Ataco con el machete", "combate"],
  ["Hacha", "Ataco con el hacha", "combate"],
  ["Lanza", "Ataco con la lanza", "combate"],
  ["Contundente", "Golpeo con el bate", "combate"],
  [null, "Exploro los alrededores", "explorar"],
  [null, "Busco comida y agua", "buscar"],
  [null, "Camino hacia otra zona", "viajar"],
  [null, "Hablo con quien encuentre", "hablar"],
];

// ---------------------------------------------------------------- cargar el motor real
function cargarMotor(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const tag = '<script type="module" crossorigin>';
  const a = html.indexOf(tag);
  if (a < 0) throw new Error("No encuentro el script del juego en " + htmlPath);
  let src = html.slice(a + tag.length, html.indexOf("</script>", a));
  const corte = src.indexOf('const im=document.getElementById("root");');
  if (corte < 0) throw new Error("No encuentro el punto de arranque de React en el script");
  // Todo lo anterior al arranque de React: datos y funciones del juego. Se exportan las que hacen falta.
  src = src.slice(0, corte) +
    ";globalThis.__motor={Ms,Xn,Ad,kr,Jo,Is,el,en,Je,Yd,Yn,Zd,Uh,Vh,Hh,Zn,Dn,mn,fd,nn,Fd,Af,Od,Bn," +
    "Sn,urPaceLine,urPrice,urValue,urLightKind,urScarcity,Ut};";
  const nada = () => {};
  const nodo = { setAttribute: nada, appendChild: nada, addEventListener: nada, style: {}, relList: { supports: () => true }, classList: { add: nada, remove: nada } };
  const ctx = {
    console, setTimeout, clearTimeout, queueMicrotask,
    document: { createElement: () => ({ ...nodo }), querySelectorAll: () => [], querySelector: () => null, getElementById: () => null, addEventListener: nada, head: nodo, body: nodo, documentElement: nodo },
    window: { addEventListener: nada, matchMedia: () => ({ matches: false, addEventListener: nada }), location: { href: "" } },
    navigator: { userAgent: "node" },
    localStorage: { getItem: () => null, setItem: nada, removeItem: nada },
    MutationObserver: class { observe() {} },
    performance: { now: () => Date.now() },
  };
  ctx.window.document = ctx.document;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "jugar.html" });
  const motor = ctx.__motor;
  // El juego usa Math.random en algunos sitios: se sustituye por un generador con semilla.
  const mathDelMotor = vm.runInContext("Math", ctx);
  motor.ponerAzar = (f) => { mathDelMotor.random = f; };
  return motor;
}

// ---------------------------------------------------------------- utilidades
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const elegir = (lista, r) => lista[Math.floor(r() * lista.length)];
const entre = ([a, b], r) => a + Math.floor(r() * (b - a + 1));
function elegirPeso(pesos, r) {
  const e = Object.entries(pesos);
  let x = r() * e.reduce((s, [, p]) => s + p, 0);
  for (const [k, p] of e) if ((x -= p) < 0) return k;
  return e[e.length - 1][0];
}
const pct = (x, n) => (n ? `${((100 * x) / n).toFixed(1)} %` : "—");
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const mediana = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const r1 = (x) => Math.round(x * 10) / 10;

// ---------------------------------------------------------------- la IA simulada
function iaResponde(M, st, accion, roll, r, juego) {
  const [skill, , tipo] = accion;
  const k = juego.dureza; // 1 = narrador medio; 0 = nunca hace daño
  const zona = st.map.currentZone || "Inicio";
  const nodo = M.Dn(st.map) ?? { type: "urban", danger: 2 };
  const peligro = nodo.danger || 2;
  const res = roll ? roll.outcome : elegirPeso(IA.resultadoSinTirada, r);
  const ritmo = M.urPaceLine(st);
  const respiro = /respiro/.test(ritmo);
  const amenaza = /amenaza|complicaci/.test(ritmo);
  const combate = tipo === "combate";
  const esc = 0.6 + 0.2 * peligro;
  const out = {
    narrative: `(simulado) ${accion[1]}: ${res}.`,
    hpChange: 0, itemsGained: [], itemsLost: [], skillXp: {}, timeMinutes: entre(IA.minutos[tipo] ?? [15, 45], r),
    hungerChange: 0, thirstChange: 0, sleepChange: 0, tempChange: 0, sceneDescription: "", location: zona,
    injuriesUpdate: [], diseasesUpdate: [],
    mapUpdate: { currentZone: zona, type: nodo.type === "unknown" ? "urban" : nodo.type, danger: peligro, connections: [] },
    suggestions: [], newItems: [], recipesLearned: [], sanityChange: 0, companionsUpdate: [], tradeOffer: null, loreUpdate: [],
  };

  // Daño
  let dano = 0;
  if (res === "pifia") dano = entre(IA.dano.pifia, r) * esc * (combate ? 1.5 : 1);
  else if (res === "fallo" && (combate || r() < IA.probDanoFallo)) dano = entre(IA.dano.fallo, r) * esc * (combate ? 1.5 : 1);
  else if (res === "justo" && r() < IA.probDanoJusto) dano = entre(IA.dano.justo, r);
  let cordura = 0;
  if (amenaza && r() < IA.ritmo.probGolpeAmenaza) { dano += entre(IA.ritmo.golpe, r) * esc; cordura += IA.cordura.amenaza; }
  if (respiro) dano = 0;
  out.hpChange = -Math.round(dano * k);

  // Curarse con una acción libre ("Vendo la herida")
  if (tipo === "curar" && (res === "exito" || res === "critico" || res === "justo")) {
    out.hpChange += res === "justo" ? 2 : entre([3, 8], r);
    const vendas = st.inventory.find((x) => x.name === "Vendas x5");
    if (vendas && res !== "justo") {
      out.itemsLost.push({ name: "Vendas x5", qty: 1 });
      if (st.injuries.length) out.injuriesUpdate.push({ zone: st.injuries[0].zone, action: "remove" });
    }
  }

  // Lesiones, enfermedades, pérdidas
  if (!respiro && res === "pifia" && r() < IA.probLesionPifia * k)
    out.injuriesUpdate.push({ zone: elegir(["cabeza", "torso", "brazo_izq", "brazo_der", "pierna_izq", "pierna_der"], r), severity: entre([1, 2], r), label: "Herida", action: "add" });
  if (!respiro && res === "fallo" && combate && r() < IA.probLesionFalloCombate * k)
    out.injuriesUpdate.push({ zone: elegir(["brazo_izq", "brazo_der", "torso"], r), severity: 1, label: "Corte", action: "add" });
  if (res === "pifia" && r() < IA.probEnfermedadPifia * k)
    out.diseasesUpdate.push({ id: elegir(["fever", "food_poison", "respiratory"], r), action: "add" });
  if (nodo.type === "underground" && peligro >= 4 && ["apocalypse", "scifi"].includes(st.genre) && r() < IA.probRadiacion * k)
    out.diseasesUpdate.push({ id: "radiation", action: "add" });
  if (res === "pifia" && st.inventory.length && r() < IA.probPerderObjetoPifia * k)
    out.itemsLost.push({ name: elegir(st.inventory, r).name, qty: 1 });
  if (skill === "Puntería") {
    const mun = st.inventory.find((x) => ["Cargador 9mm", "Cartuchos escopeta x10", "Flechas x10"].includes(x.name));
    if (mun && r() < IA.probGastarMunicion) out.itemsLost.push({ name: mun.name, qty: 1 });
  }

  // Objetos encontrados
  const rango = IA.objetos[res];
  if (rango) {
    let n = entre(rango, r);
    if (tipo === "viajar") n = r() < 0.5 ? Math.min(n, 1) : 0;
    if (tipo === "caza") {
      if (n > 0) {
        const nombre = IA.comidaCazada[skill];
        out.newItems.push({ name: nombre, kg: 0.5, l: 0.5, tags: ["food"], desc: "Comida fresca." });
        out.itemsGained.push({ name: nombre, qty: n });
      }
    } else if (IA.perfilBotin[tipo]) {
      for (let i = 0; i < n; i++) {
        const nombre = elegirPeso(IA.botin[elegirPeso(IA.perfilBotin[tipo], r)], r);
        const qty = ["Chatarra", "Madera", "Tela", "Trapos"].includes(nombre) ? entre([1, 2], r) : 1;
        out.itemsGained.push({ name: nombre, qty });
      }
    }
  }

  // Experiencia
  if (skill) {
    const x = IA.xp[res] ?? 0;
    const v = x > 0 && x < 1 ? (r() < x ? 1 : 0) : x;
    if (v) out.skillXp[skill] = v;
  }

  // Cordura
  if (res === "pifia") cordura += IA.cordura.pifia;
  if (res === "fallo" && peligro >= 4) cordura += IA.cordura.falloPeligroso;
  if (res === "critico") cordura += IA.cordura.critico;
  if (tipo === "hablar" && (res === "exito" || res === "critico")) cordura += IA.cordura.hablarBien;
  out.sanityChange = cordura < 0 ? Math.round(cordura * k) : cordura;

  // Recetas, compañeros, trueque
  const pendientes = M.Jo.map((x) => x.id).filter((id) => !st.knownRecipes.includes(id));
  if (pendientes.length && ((tipo === "hablar" && (res === "exito" || res === "critico") && r() < IA.probReceta.hablar) ||
    (tipo === "explorar" && res === "critico" && r() < IA.probReceta.explorarCritico)))
    out.recipesLearned.push(elegir(pendientes, r));
  if (tipo === "hablar" && (st.companions?.length ?? 0) < 2 && r() < (IA.probCompanero[res] ?? 0)) {
    juego.companeros += 1;
    out.companionsUpdate.push({ name: `Compañero ${juego.companeros}`, action: "join", role: "superviviente", skill: elegir(M.Zn, r) });
  }
  if (combate && res === "pifia" && st.companions?.length && r() < 0.3 * k)
    out.companionsUpdate.push({ name: elegir(st.companions, r).name, action: "hurt", hpChange: -entre([15, 40], r) });
  const quiereTruque = (tipo === "hablar" && res !== "pifia" && res !== "fallo" && r() < IA.probTrueque.hablar) ||
    (tipo === "explorar" && res === "exito" && r() < IA.probTrueque.explorar);
  if (quiereTruque) {
    const items = [];
    for (let i = entre([2, 4], r); i > 0; i--) {
      const nombre = elegirPeso(IA.botin[elegirPeso(IA.perfilBotin.trueque, r)], r);
      if (!items.some((x) => x.name === nombre)) items.push({ name: nombre, qty: entre([1, 2], r) });
    }
    out.tradeOffer = { trader: "Comerciante", items };
  }

  // Mapa y refugio del clima
  if (tipo === "viajar") {
    const vecinas = (st.map.nodes[zona]?.connections ?? []).filter((z) => st.map.nodes[z]);
    let destino, tipoZ, pel;
    if (vecinas.length && r() < 0.5) {
      destino = elegir(vecinas, r);
      const n = st.map.nodes[destino];
      tipoZ = n.type === "unknown" ? elegirPeso(IA.tipoZonaNueva, r) : n.type;
      pel = n.visited ? n.danger : Number(elegirPeso(IA.peligroZonaNueva, r));
    } else {
      destino = `Zona ${++juego.zonas}`;
      tipoZ = elegirPeso(IA.tipoZonaNueva, r);
      pel = Number(elegirPeso(IA.peligroZonaNueva, r));
    }
    out.mapUpdate = { currentZone: destino, type: tipoZ, danger: pel, connections: [] };
    out.location = destino;
    const nc = r() < 0.5 ? 1 : r() < 0.6 ? 2 : 0;
    for (let i = 0; i < nc; i++) out.mapUpdate.connections.push(`Zona ${++juego.zonas}`);
  } else if (tipo === "explorar" && r() < 0.4) {
    out.mapUpdate.connections.push(`Zona ${++juego.zonas}`);
  }
  const tz = out.mapUpdate.type;
  out.sheltered = tz === "indoor" || tz === "underground" ? true : tz === "urban" ? r() < 0.3 : r() < 0.1;
  return JSON.stringify(out);
}

// Respuesta a "Me como ..." (comida inventada, que no tiene botón de usar).
function iaComer(st, nombre, cond, r) {
  const zona = st.map.currentZone || "Inicio";
  const nodo = st.map.nodes[zona] ?? { type: "urban", danger: 2 };
  const out = {
    narrative: `(simulado) Te comes ${nombre}.`, hpChange: 0, itemsGained: [], itemsLost: [{ name: nombre, qty: 1 }], skillXp: {},
    timeMinutes: entre(IA.minutos.comer, r), hungerChange: IA.hambreComidaInventada, thirstChange: 0, sleepChange: 0, tempChange: 0,
    location: zona, injuriesUpdate: [], diseasesUpdate: [],
    mapUpdate: { currentZone: zona, type: nodo.type === "unknown" ? "urban" : nodo.type, danger: nodo.danger || 2, connections: [] },
    suggestions: [], newItems: [], recipesLearned: [], sanityChange: 0, companionsUpdate: [], tradeOffer: null, loreUpdate: [],
    sheltered: nodo.type === "indoor" || nodo.type === "underground",
  };
  if (cond != null && cond < 30 && r() < 0.4) out.diseasesUpdate.push({ id: "food_poison", action: "add" });
  return JSON.stringify(out);
}

// ---------------------------------------------------------------- opciones del jugador
function enBase(st) {
  return st.base.established && st.map.currentZone === st.base.location;
}
function valorInventario(M, st) {
  return st.inventory.reduce((s, x) => s + M.urValue(x.name, st.customItems, x.cond) * x.qty, 0);
}
function opciones(M, st) {
  const ops = [];
  for (const a of ACCIONES) ops.push({ id: `acción: ${a[1]}`, cat: "acción", accion: a });
  const ci = st.customItems;
  const improvisada = st.inventory.filter((x) => { const d = M.en(x.name, ci); return !d.use && (d.tags ?? []).includes("food"); });
  if (improvisada.length) ops.push({ id: "acción: comer comida inventada por la IA", cat: "acción", comer: improvisada });
  const tieneBateria = st.inventory.some((x) => M.urLightKind(x.name, ci) === "bat");
  for (const it of st.inventory) {
    const d = M.en(it.name, ci);
    if (!d.use || (d.use.urRecharge && !tieneBateria)) continue;
    ops.push({ id: `usar: ${it.name}`, cat: "usar", nombre: it.name, use: d.use });
  }
  for (const id of st.knownRecipes) {
    const p = M.Yd(id, st.inventory, (s) => M.Yn(st, s), M.Zd(st), ci);
    if (p?.canCraft) ops.push({ id: `fabricar: ${id}`, cat: "fabricar", receta: id });
  }
  ops.push({ id: "dormir", cat: "dormir" });
  const nodo = M.Dn(st.map);
  const base = enBase(st);
  if (nodo && nodo.danger <= 2 && !base) ops.push({ id: "refugio: establecer aquí", cat: "refugio", tipo: "establishBase" });
  if (st.base.established && !base) ops.push({ id: "refugio: volver", cat: "refugio", tipo: "returnToBase" });
  if (base) {
    for (const [id, s] of Object.entries(M.Is)) {
      if (st.base.structures.includes(id) || M.Yn(st, s.req.skill) < s.req.level) continue;
      if (s.mats.some((m) => M.Je(st.inventory, m.name) < m.qty)) continue;
      ops.push({ id: `construir: ${s.label}`, cat: "refugio", tipo: "build", estructura: id });
    }
    if (st.inventory.length) ops.push({ id: "refugio: guardar algo", cat: "refugio", tipo: "deposit" });
    if (st.base.storage.length) ops.push({ id: "refugio: sacar algo", cat: "refugio", tipo: "withdraw" });
  }
  if (st.trade?.items?.length) {
    const barato = Math.min(...st.trade.items.map((x) => M.urPrice(x.name, ci)));
    if (valorInventario(M, st) >= barato) ops.push({ id: "comerciar", cat: "comerciar" });
  }
  const hayComida = st.inventory.some((x) => (M.en(x.name, ci).use?.hunger ?? 0) > 0);
  if (st.companions?.length && hayComida) ops.push({ id: "compañero: dar de comer", cat: "compañero" });
  return ops;
}

function alAzar(ops, r) {
  const cats = [...new Set(ops.map((o) => o.cat))];
  const cat = elegir(cats, r);
  return elegir(ops.filter((o) => o.cat === cat), r);
}

function sensato(M, st, ops, r) {
  const n = st.needs;
  const usar = ops.filter((o) => o.cat === "usar");
  const de = (f) => usar.filter((o) => f(o.use));
  const noche = (() => { const h = Math.floor(st.minutes / 60) % 24; return h >= 21 || h < 6; })();
  if (n.thirst < 40) { const o = de((u) => (u.thirst ?? 0) > 0); if (o.length) return elegir(o, r); }
  if (n.hunger < 40) {
    const o = de((u) => (u.hunger ?? 0) > 0);
    const inv = ops.find((x) => x.comer);
    if (o.length || inv) return o.length ? elegir(o, r) : inv;
  }
  if (st.hp < st.maxHp * 0.5) { const o = de((u) => (u.hp ?? 0) > 0); if (o.length) return elegir(o, r); }
  if (st.diseases.length) {
    const ids = st.diseases.filter((d) => !(d.treated > 0)).map((d) => d.id);
    const o = de((u) => (u.cures ?? []).concat(u.curesNow ?? []).some((c) => ids.includes(c)));
    if (o.length) return elegir(o, r);
  }
  if (n.sleep < 25 || (noche && n.sleep < 70)) return { ...ops.find((o) => o.id === "dormir"), horas: 8 };
  const tieneAgua = de((u) => (u.thirst ?? 0) > 20).length > 0;
  const tieneComida = de((u) => (u.hunger ?? 0) > 20).length > 0 || ops.some((x) => x.comer);
  if (!tieneAgua || !tieneComida) return ops.find((o) => o.id === "acción: Busco comida y agua");
  // Al azar, pero sin tonterías: no come lleno, no duerme descansado, no se cura sano.
  const utiles = ops.filter((o) => {
    if (o.cat === "usar") {
      const u = o.use;
      if ((u.hunger ?? 0) > 0 && n.hunger > 70) return false;
      if ((u.thirst ?? 0) > 0 && n.thirst > 70) return false;
      if ((u.hp ?? 0) > 0 && st.hp > st.maxHp * 0.8 && !(u.cures || u.curesNow || u.healInjury)) return false;
    }
    if (o.id === "dormir" && n.sleep > 70) return false;
    return true;
  });
  const o = alAzar(utiles.length ? utiles : ops, r);
  return o.id === "dormir" ? { ...o, horas: 8 } : o;
}

// ---------------------------------------------------------------- una partida
const CORTES_DIA = [2, 4, 8, 15, 22, 30];

function recursos(M, st) {
  const r = { comida: 0, agua: 0, medicinas: 0, materiales: 0, luz: 0, objetos: 0 };
  for (const it of st.inventory) {
    const d = M.en(it.name, st.customItems), t = d.tags ?? [], u = d.use ?? {};
    r.objetos += it.qty;
    if ((u.thirst ?? 0) > (u.hunger ?? 0)) r.agua += it.qty;
    else if ((u.hunger ?? 0) > 0 || (!d.use && t.includes("food"))) r.comida += it.qty;
    if (t.includes("medical")) r.medicinas += it.qty;
    if (t.includes("craft")) r.materiales += it.qty;
    if (t.includes("light")) r.luz += it.qty;
  }
  return r;
}

function jugar(M, politica, dureza, semilla, cuenta) {
  const r = mulberry32(semilla);
  M.ponerAzar(r);
  const juego = { zonas: 1, companeros: 0, dureza };
  const genero = elegir(Object.keys(M.Bn), r);
  const arquetipo = elegir(M.Ad, r).id;
  let rasgos = [];
  for (let intento = 0; intento < 20; intento++) {
    const n = entre([0, 4], r), lista = [];
    for (let i = 0; i < n; i++) { const t = elegir(M.Fd, r).id; if (!lista.includes(t)) lista.push(t); }
    if (M.Af(lista) >= 0) { rasgos = lista; break; }
  }
  let st = { ...M.Xn, genre: genero, charName: "Sim", archetypeId: arquetipo, traits: rasgos };
  st = M.Ms(st, { type: "startRun", rng: r });
  // Turno de presentación: la IA bautiza la zona inicial.
  const intro = JSON.stringify({
    narrative: "(simulado) Empieza la historia.", timeMinutes: 10, location: "Zona 1",
    mapUpdate: { currentZone: "Zona 1", type: elegirPeso(IA.tipoZonaNueva, r), danger: 2, connections: ["Zona 2"] }, sheltered: false,
  });
  juego.zonas = 2;
  st = M.Ms(st, { type: "applyTurn", playerText: null, result: M.fd(intro, "Inicio", []).result, rng: r, roll: null });

  const g = {
    politica, genero, arquetipo, rasgos, muerto: false, causa: null, dia: 1, turnos: 0,
    snapshots: {}, minCordura: 100, emboscadas: 0, suenos: 0, suenosFuera: 0, emboscadasFuera: 0,
    estropeados: 0, armasRotas: 0, luzAgotada: 0, unidos: 0, muertosComp: 0, idosComp: 0, trueques: 0,
    fabricadoOk: {}, fabricadoMal: {}, construido: [], tiradas: {},
    dano: { ia: 0, emboscadas: 0, motor: 0, camino: 0 }, curado: { objetos: 0, ia: 0 }, turnosClimaSevero: 0,
  };
  let ultimoCorte = 0;
  while (st.screen !== "death" && M.mn(st.minutes) <= DIAS_MAX && g.turnos < 3000) {
    const ops = opciones(M, st);
    for (const o of ops) cuenta.disp[o.id] = (cuenta.disp[o.id] ?? 0) + 1;
    const o = politica === "azar" ? alAzar(ops, r) : sensato(M, st, ops, r);
    cuenta.elegida[o.id] = (cuenta.elegida[o.id] ?? 0) + 1;
    const antes = st;
    const ultimo = st.log.at(-1)?.id;
    let danoIA = 0;
    if (M.Sn[st.weather.id]?.severe) g.turnosClimaSevero++;
    if (o.cat === "acción" && o.comer) {
      const it = elegir(o.comer, r);
      const res = M.fd(iaComer(st, it.name, it.cond, r), st.map.currentZone, [...Object.keys(st.customItems), ...st.inventory.map((x) => x.name)]).result;
      st = M.Ms(st, { type: "applyTurn", playerText: `Me como ${it.name}`, result: res, rng: r, roll: null });
    } else if (o.cat === "acción") {
      const [skill] = o.accion;
      const roll = skill ? M.Vh(st, skill, r) : null;
      if (roll) {
        const k = `${roll.difficulty}`;
        g.tiradas[k] ??= { n: 0, ok: 0 };
        g.tiradas[k].n++;
        if (roll.outcome !== "fallo" && roll.outcome !== "pifia") g.tiradas[k].ok++;
        cuenta.resultados[roll.outcome] = (cuenta.resultados[roll.outcome] ?? 0) + 1;
      }
      const conocidos = [...new Set([...Object.keys(st.customItems), ...st.inventory.map((x) => x.name)])];
      const { result } = M.fd(iaResponde(M, st, o.accion, roll, r, juego), st.map.currentZone || "Inicio", conocidos);
      st = M.Ms(st, { type: "applyTurn", playerText: o.accion[1], result, rng: r, roll });
      danoIA = Math.max(0, -result.hpChange);
      g.curado.ia += Math.max(0, result.hpChange);
    } else if (o.cat === "usar") {
      st = M.Ms(st, { type: "useItem", name: o.nombre, rng: r });
      g.curado.objetos += Math.max(0, Math.min(o.use.hp ?? 0, antes.maxHp - antes.hp));
    } else if (o.cat === "fabricar") {
      st = M.Ms(st, { type: "craft", recipeId: o.receta, rng: r });
    } else if (o.cat === "dormir") {
      const fuera = !(M.Dn(st.map)?.type === "indoor" || M.Dn(st.map)?.type === "underground" || enBase(st));
      g.suenos++; if (fuera) g.suenosFuera++;
      st = M.Ms(st, { type: "sleep", hours: o.horas ?? entre([1, 12], r), rng: r });
      const nuevos = st.log.slice(st.log.findIndex((e) => e.id === ultimo) + 1);
      if (nuevos.some((e) => /no estabas solo|golpea el muro/.test(e.text))) { g.emboscadas++; if (fuera) g.emboscadasFuera++; }
    } else if (o.cat === "refugio") {
      if (o.tipo === "deposit" || o.tipo === "withdraw") {
        const lista = o.tipo === "deposit" ? st.inventory : st.base.storage;
        st = M.Ms(st, { type: o.tipo, name: elegir(lista, r).name, qty: 1 });
      } else st = M.Ms(st, { type: o.tipo, structure: o.estructura, rng: r });
      if (o.tipo === "build" && st.base.structures.length > antes.base.structures.length) g.construido.push(o.estructura);
    } else if (o.cat === "comerciar") {
      const quiero = elegir(st.trade.items, r);
      const precio = M.urPrice(quiero.name, st.customItems);
      const doy = [];
      let valor = 0;
      for (const x of [...st.inventory].sort(() => r() - 0.5)) {
        if (valor >= precio) break;
        doy.push({ name: x.name, qty: 1 });
        valor += M.urValue(x.name, st.customItems, x.cond);
      }
      st = M.Ms(st, { type: "urTrade", give: doy, get: [{ name: quiero.name, qty: 1 }] });
      if (st !== antes && !st.log.at(-1)?.text.includes("no acepta")) g.trueques++;
    } else if (o.cat === "compañero") {
      st = M.Ms(st, { type: "urFeed", id: elegir(st.companions, r).id });
    }
    g.turnos++;
    // Vida perdida: la IA (supuesto) aparte del motor. stats.damageTaken suma el daño de la IA y el
    // del paso del tiempo (clima, sed, hambre, sueño, enfermedades); las emboscadas y el camino van aparte.
    g.dano.ia += danoIA;
    g.dano.motor += Math.max(0, st.stats.damageTaken - antes.stats.damageTaken - danoIA);
    // Sucesos de este turno, leídos del registro del juego
    const i = st.log.findIndex((e) => e.id === ultimo);
    for (const e of st.log.slice(i + 1)) {
      const emb = /(?:no estabas solo|golpea el muro).*?(\d+) de vida/.exec(e.text);
      if (emb) g.dano.emboscadas += Number(emb[1]);
      const cam = /Llegas al refugio con (\d+) de vida menos/.exec(e.text);
      if (cam) g.dano.camino += Number(cam[1]);
      if (/echado a perder/.test(e.text)) g.estropeados++;
      else if (/^Se te rompe/.test(e.text)) g.armasRotas++;
      else if (/se ha agotado\. Necesitas pilas/.test(e.text)) g.luzAgotada++;
      else if (/ se une a ti/.test(e.text)) g.unidos++;
      else if (/^Compañero \d+ ha muerto/.test(e.text)) g.muertosComp++;
      else if (/se marcha\.$|se separa de ti/.test(e.text)) g.idosComp++;
      else if (o.cat === "fabricar" && /^Fabricas /.test(e.text)) g.fabricadoOk[o.receta] = (g.fabricadoOk[o.receta] ?? 0) + 1;
      else if (o.cat === "fabricar" && /sale mal/.test(e.text)) g.fabricadoMal[o.receta] = (g.fabricadoMal[o.receta] ?? 0) + 1;
    }
    g.minCordura = Math.min(g.minCordura, st.sanity ?? 100);
    const dia = M.mn(st.minutes);
    for (const c of CORTES_DIA) {
      if (dia >= c && ultimoCorte < c && st.screen !== "death") {
        g.snapshots[c] = { hp: st.hp, hambre: st.needs.hunger, sed: st.needs.thirst, sueno: st.needs.sleep, cordura: st.sanity ?? 100, ...recursos(M, st) };
        ultimoCorte = c;
      }
    }
  }
  g.muerto = st.screen === "death";
  g.causa = st.deathCause;
  g.climaSeveroAlFinal = !!M.Sn[st.weather.id]?.severe;
  g.dia = Math.min(DIAS_MAX, M.mn(st.minutes));
  g.diasVividos = (st.minutes - 480) / 1440;
  g.minutos = st.minutes;
  g.final = { hp: st.hp, cordura: st.sanity ?? 100, ...recursos(M, st) };
  g.niveles = Object.fromEntries(M.Zn.map((s) => [s, M.Ut(st.skillXp[s] ?? 0)]));
  g.nivelMax = Math.max(...Object.values(g.niveles));
  g.inventarioFinal = st.inventory.map((x) => [x.name, x.qty]);
  return g;
}

// ---------------------------------------------------------------- comprobaciones directas del motor
// No dependen de la IA simulada: llaman a las funciones del juego con estados preparados.
function comprobaciones(M) {
  const out = [];
  const r = mulberry32(99);
  M.ponerAzar(r);
  const base = (extra = {}) => {
    let st = { ...M.Xn, genre: "apocalypse", charName: "Prueba", archetypeId: "builder", traits: [] };
    st = M.Ms(st, { type: "startRun", rng: r });
    return { ...st, basePenalty: {}, ...extra }; // sin los lastres del arquetipo, para medir solo el motor
  };
  const conHabilidad = (st, skill, nivel) => ({ ...st, skillXp: { ...st.skillXp, [skill]: [0, 0, 150, 400, 700, 1050, 1450, 1900, 2400, 2950, 3550][nivel] } });

  // 1. Recetas que crean material de la nada
  const bucles = [];
  {
    let st = base({ inventory: [{ name: "Tela", qty: 1 }], knownRecipes: ["Rasgar trapos"] });
    st = M.Ms(st, { type: "craft", recipeId: "Rasgar trapos", rng: r });
    bucles.push({ receta: "Rasgar trapos", entra: "Tela ×1", sale: `Tela ×${M.Je(st.inventory, "Tela")}` });
  }
  {
    let st = conHabilidad(base({ inventory: [{ name: "Tablones", qty: 2 }, { name: "Herramientas básicas", qty: 1 }], knownRecipes: ["Barricada de madera"] }), "Carpintería", 2);
    st = M.Ms(st, { type: "craft", recipeId: "Barricada de madera", rng: r });
    bucles.push({ receta: "Barricada de madera", entra: "Tablones ×2", sale: `Tablones ×${M.Je(st.inventory, "Tablones")}` });
  }
  {
    let st = conHabilidad(base({ inventory: [{ name: "Chatarra", qty: 2 }, { name: "Herramientas básicas", qty: 1 }], knownRecipes: ["Kit de reparación", "Recuperar chatarra"] }), "Mecánica", 3);
    st = M.Ms(st, { type: "craft", recipeId: "Kit de reparación", rng: r });
    st = M.Ms(st, { type: "craft", recipeId: "Recuperar chatarra", rng: r });
    bucles.push({ receta: "Kit de reparación + Recuperar chatarra", entra: "Chatarra ×2", sale: `Chatarra ×${M.Je(st.inventory, "Chatarra")}` });
  }
  {
    let st = base({ inventory: [{ name: "Vendas x5", qty: 1 }], knownRecipes: ["Rasgar trapos"] });
    st = M.Ms(st, { type: "craft", recipeId: "Rasgar trapos", rng: r });
    bucles.push({ receta: "Rasgar trapos (con vendas)", entra: "Vendas x5 ×1", sale: `Tela ×${M.Je(st.inventory, "Tela")}` });
  }
  {
    let st = { ...base({ inventory: [{ name: "Tela", qty: 1 }], knownRecipes: ["Rasgar trapos", "Vendas improvisadas"] }), hp: 20 };
    const m0 = st.minutes;
    for (let i = 0; i < 10; i++) {
      st = M.Ms(st, { type: "craft", recipeId: "Rasgar trapos", rng: r });
      st = M.Ms(st, { type: "craft", recipeId: "Vendas improvisadas", rng: r });
      st = M.Ms(st, { type: "useItem", name: "Vendas x5", rng: r });
    }
    bucles.push({ receta: "Rasgar trapos + Vendas improvisadas, 10 veces", entra: "Tela ×1, vida 20", sale: `Tela ×${M.Je(st.inventory, "Tela")}, vida ${st.hp}, en ${r1((st.minutes - m0) / 60)} h` });
  }
  out.push({ titulo: "Recetas que multiplican material", filas: bucles });

  // 2. Recetas iniciales que no existen
  const recetasMalas = [];
  for (const a of M.Ad) for (const id of a.recipes) if (!M.kr[id]) recetasMalas.push({ arquetipo: a.skins?.apocalypse?.label ?? a.id, receta: id });
  out.push({ titulo: "Recetas de inicio con un nombre que no existe", filas: recetasMalas });

  // 3. Recetas que nadie conoce al empezar
  const conocidas = new Set(M.Ad.flatMap((a) => [...a.recipes, ...a.items.flatMap((i) => M.Od[i] ?? [])]));
  out.push({ titulo: "Recetas que ningún personaje conoce al empezar (solo si la IA las enseña)", filas: M.Jo.filter((x) => !conocidas.has(x.id)).map((x) => ({ receta: x.id })) });

  // 4. Probabilidad de que te ataquen al dormir 8 h (se mide llamando al motor 4.000 veces por caso)
  const suenos = [];
  for (const peligro of [1, 2, 3, 4, 5]) {
    const fila = { peligro };
    for (const [caso, tipo, refugio, muro] of [["intemperie", "wilderness", false, false], ["a cubierto", "indoor", false, false], ["refugio", "wilderness", true, false], ["refugio + muro", "wilderness", true, true]]) {
      if (refugio && peligro > 2) { fila[caso] = "—"; continue; }
      let st = base();
      st = { ...st, map: { nodes: { Z: { type: tipo, danger: peligro, visited: true, x: 0, y: 0, connections: [] } }, currentZone: "Z" },
        base: refugio ? { ...st.base, established: true, location: "Z", structures: muro ? ["muro"] : [] } : st.base };
      let n = 0;
      for (let i = 0; i < 4000; i++) {
        const s2 = M.Ms(st, { type: "sleep", hours: 8, rng: r });
        if (s2.log.slice(-6).some((e) => /no estabas solo|golpea el muro/.test(e.text))) n++;
      }
      fila[caso] = pct(n, 4000);
    }
    suenos.push(fila);
  }
  out.push({ titulo: "Probabilidad de que te ataquen al dormir 8 horas", filas: suenos });

  // 5. Probabilidad de éxito (justo o mejor) en una tirada, exacta (se recorren las 20 caras del dado)
  const tiradas = [];
  for (const [dia, oscuro, cordura] of [[1, false, 100], [8, false, 100], [15, false, 100], [15, true, 100], [15, true, 15]]) {
    for (const nivel of [1, 3, 5]) {
      const fila = { situación: `día ${dia}${oscuro ? ", a oscuras" : ""}${cordura < 20 ? ", cordura 15" : ""}`, nivel };
      for (const peligro of [1, 2, 3, 4, 5]) {
        let st = conHabilidad(base(), "Sigilo", nivel);
        st = { ...st, sanity: cordura, inventory: oscuro ? [] : st.inventory, minutes: (dia - 1) * 1440 + (oscuro ? 23 * 60 : 12 * 60),
          map: { nodes: { Z: { type: "urban", danger: peligro, visited: true, x: 0, y: 0, connections: [] } }, currentZone: "Z" } };
        let ok = 0;
        for (let cara = 0; cara < 20; cara++) {
          const t = M.Vh(st, "Sigilo", () => (cara + 0.5) / 20);
          if (t.outcome !== "fallo" && t.outcome !== "pifia") ok++;
        }
        fila[`peligro ${peligro}`] = `${ok * 5} %`;
      }
      tiradas.push(fila);
    }
  }
  out.push({ titulo: "Probabilidad de éxito de una tirada (Sigilo)", filas: tiradas });

  // 6. Cuánto tarda en morir alguien que no come ni bebe (espera a cubierto, de hora en hora)
  {
    let st = base({ inventory: [], map: { nodes: { Z: { type: "indoor", danger: 1, visited: true, x: 0, y: 0, connections: [] } }, currentZone: "Z" } });
    const espera = M.fd(JSON.stringify({ narrative: "Esperas.", timeMinutes: 60, sheltered: true, mapUpdate: { currentZone: "Z", type: "indoor", danger: 1 } }), "Z", []).result;
    let h = 0;
    const marcas = [];
    while (st.screen !== "death" && h < 500) {
      st = M.Ms(st, { type: "applyTurn", playerText: "Espero", result: espera, rng: r, roll: null });
      h++;
      if (!marcas.sed && st.needs.thirst <= 0) marcas.sed = h;
      if (!marcas.hambre && st.needs.hunger <= 0) marcas.hambre = h;
      if (!marcas.cordura && (st.sanity ?? 100) <= 0) marcas.cordura = h;
    }
    out.push({ titulo: "Sin comer ni beber, esperando a cubierto (empieza con hambre y sed 80)", filas: [{
      "sed a 0": `${marcas.sed ?? "—"} h`, "hambre a 0": `${marcas.hambre ?? "—"} h`, "cordura a 0": `${marcas.cordura ?? "—"} h`,
      muere: `${h} h`, causa: st.deathCause ?? "—" }] });
  }
  const zona = (tipo, peligro = 1) => ({ nodes: { Z: { type: tipo, danger: peligro, visited: true, x: 0, y: 0, connections: [] } }, currentZone: "Z" });
  const turno = (min, tipo, cubierto) => M.fd(JSON.stringify({ narrative: "x", timeMinutes: min, sheltered: cubierto, mapUpdate: { currentZone: "Z", type: tipo, danger: 1 } }), "Z", []).result;

  // 7. Reparto de resultados de una tirada a dificultad 12 (peligro 2, día 1, de día), exacto
  {
    const filas = [];
    for (const nivel of [1, 3, 5, 8, 10]) {
      const st = { ...conHabilidad(base(), "Sigilo", nivel), map: zona("urban", 2), minutes: 12 * 60 };
      const c = { pifia: 0, fallo: 0, justo: 0, exito: 0, critico: 0 };
      for (let cara = 0; cara < 20; cara++) c[M.Vh(st, "Sigilo", () => (cara + 0.5) / 20).outcome]++;
      filas.push({ nivel, pifia: `${c.pifia * 5} %`, fallo: `${c.fallo * 5} %`, justo: `${c.justo * 5} %`, éxito: `${c.exito * 5} %`, crítico: `${c.critico * 5} %` });
    }
    out.push({ titulo: "Resultados de una tirada a dificultad 12 según el nivel", filas });
  }

  // 8. Una herida leve sin antibióticos (con comida, agua y sueño de sobra, a cubierto)
  {
    const N = 1000;
    let infectadas = 0, muertes = 0;
    const espera = turno(60, "indoor", true);
    for (let i = 0; i < N; i++) {
      let st = base({ inventory: [], injuries: [{ zone: "brazo_izq", severity: 1, label: "Corte", age: 0 }], weather: { id: "clear", daysLeft: 99 }, forecast: [], map: zona("indoor") });
      let inf = false;
      for (let h = 0; h < 120 && st.screen !== "death"; h++) {
        st = { ...st, needs: { hunger: 80, thirst: 80, sleep: 80, temp: 36.5 }, sanity: 100 };
        st = M.Ms(st, { type: "applyTurn", playerText: "Espero", result: espera, rng: r, roll: null });
        inf ||= st.diseases.some((d) => d.id === "wound_infection");
      }
      if (inf) infectadas++;
      if (st.screen === "death") muertes++;
    }
    out.push({ titulo: "Una herida leve sin antibióticos, en 5 días (todo lo demás cubierto)", filas: [{ "se infecta": pct(infectadas, N), "muere de la infección": pct(muertes, N) }] });
  }

  // 9. Clima severo a la intemperie: la misma hora, en una acción larga o en 12 cortas
  {
    const filas = [];
    for (const [id, nombre] of [["heatstorm", "Ola de calor"], ["blizzard", "Ventisca"], ["acid_rain", "Lluvia corrosiva"], ["tornado", "Tornado"]]) {
      for (const [veces, min] of [[1, 60], [12, 5]]) {
        let st = base({ weather: { id, daysLeft: 99 }, forecast: [], inventory: [], map: zona("wilderness"), minutes: 12 * 60 });
        const hp0 = st.hp, sed0 = st.needs.thirst;
        for (let i = 0; i < veces; i++) st = M.Ms(st, { type: "applyTurn", playerText: "x", result: turno(min, "wilderness", false), rng: r, roll: null });
        filas.push({ clima: nombre, "una hora en": veces === 1 ? "1 acción de 60 min" : "12 acciones de 5 min", temperatura: `${st.needs.temp} °C`, vida: `-${hp0 - st.hp}`, sed: `-${Math.round(sed0 - st.needs.thirst)}` });
      }
    }
    out.push({ titulo: "Una hora a la intemperie con clima severo", filas });
  }

  // 10. Recetas de comida, agua y curas: lo que entra frente a lo que sale
  {
    const val = (n, q) => { const u = M.el[n]?.use ?? {}; return { hambre: (u.hunger ?? 0) * q, sed: (u.thirst ?? 0) * q, vida: (u.hp ?? 0) * q }; };
    const txt = (v) => Object.entries(v).filter(([, x]) => x).map(([k, x]) => `${k} ${x > 0 ? "+" : ""}${x}`).join(", ") || "nada que se coma";
    const filas = [];
    for (const rc of M.Jo) {
      const u = M.el[rc.result.name]?.use;
      if (!u || !(u.hunger || u.thirst || u.hp)) continue;
      const e = { hambre: 0, sed: 0, vida: 0 };
      for (const ing of rc.ingredients) if (!ing.tool && ing.name) { const v = val(ing.name, ing.qty); e.hambre += v.hambre; e.sed += v.sed; e.vida += v.vida; }
      filas.push({ receta: rc.id, entra: `${rc.ingredients.filter((i) => !i.tool).map((i) => `${i.name} ×${i.qty}`).join(" + ")} (${txt(e)})`, sale: `${rc.result.name} ×${rc.result.qty} (${txt(val(rc.result.name, rc.result.qty))})` });
    }
    out.push({ titulo: "Recetas de comida, agua y curas", filas });
  }
  return out;
}

// ---------------------------------------------------------------- informe
function informe(M, politica, juegos, cuenta) {
  const L = [];
  const n = juegos.length;
  const muertos = juegos.filter((g) => g.muerto);
  L.push(`\n================ Jugador "${politica}" — ${n} partidas, máximo ${DIAS_MAX} días ================`);
  L.push(`Muertes: ${muertos.length} (${pct(muertos.length, n)}). Sobreviven ${DIAS_MAX} días: ${n - muertos.length}.`);
  L.push(`Días vividos: media ${r1(media(juegos.map((g) => g.diasVividos)))}, mediana ${r1(mediana(juegos.map((g) => g.diasVividos)))}. Turnos por partida: media ${Math.round(media(juegos.map((g) => g.turnos)))}.`);
  const vivosEn = (d) => juegos.filter((g) => !g.muerto || g.minutos >= (d - 1) * 1440).length;
  L.push(`Siguen vivos al empezar el día: ${[2, 4, 8, 15, 22, 30].filter((d) => d <= DIAS_MAX).map((d) => `${d} → ${pct(vivosEn(d), n)}`).join(" · ")}`);
  const causas = {};
  for (const g of muertos) causas[g.causa] = (causas[g.causa] ?? 0) + 1;
  L.push("Causas de muerte: " + Object.entries(causas).sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c} ${pct(k, muertos.length)}`).join(" · "));
  const turnosSev = juegos.reduce((a, g) => a + g.turnosClimaSevero, 0), turnosTot = juegos.reduce((a, g) => a + g.turnos, 0);
  L.push(`Mueren con clima severo encima: ${pct(muertos.filter((g) => g.climaSeveroAlFinal).length, muertos.length)} (el clima es severo en el ${pct(turnosSev, turnosTot)} de los turnos).`);
  const dm = (k) => r1(media(juegos.map((g) => g.dano[k])));
  L.push(`Vida perdida por partida: IA ${dm("ia")} · emboscadas al dormir ${dm("emboscadas")} · clima, sed, hambre, sueño y enfermedades ${dm("motor")} · camino al refugio ${dm("camino")}. Vida recuperada: objetos ${r1(media(juegos.map((g) => g.curado.objetos)))} · IA ${r1(media(juegos.map((g) => g.curado.ia)))}.`);
  const porArq = {};
  for (const g of juegos) { porArq[g.arquetipo] ??= [0, 0]; porArq[g.arquetipo][0]++; if (g.muerto) porArq[g.arquetipo][1]++; }
  L.push("Muertes por arquetipo: " + Object.entries(porArq).sort((a, b) => b[1][1] / b[1][0] - a[1][1] / a[1][0]).map(([k, [t, m]]) => `${k} ${pct(m, t)}`).join(" · "));

  L.push("\nRecursos promedio (unidades) entre los que siguen vivos:");
  L.push("  día  | vida | hambre | sed | sueño | cordura | comida | agua | medicinas | materiales | luz | objetos");
  for (const d of CORTES_DIA.filter((x) => x <= DIAS_MAX)) {
    const s = juegos.map((g) => g.snapshots[d]).filter(Boolean);
    if (!s.length) continue;
    const m = (k) => r1(media(s.map((x) => x[k])));
    L.push(`  ${String(d).padStart(3)}  | ${String(m("hp")).padStart(4)} | ${String(m("hambre")).padStart(6)} | ${String(m("sed")).padStart(3)} | ${String(m("sueno")).padStart(5)} | ${String(m("cordura")).padStart(7)} | ${String(m("comida")).padStart(6)} | ${String(m("agua")).padStart(4)} | ${String(m("medicinas")).padStart(9)} | ${String(m("materiales")).padStart(10)} | ${String(m("luz")).padStart(3)} | ${m("objetos")}   (n=${s.length})`);
  }
  const fin = (k) => r1(media(juegos.map((g) => g.final[k])));
  L.push(`Al terminar (todas): comida ${fin("comida")}, agua ${fin("agua")}, medicinas ${fin("medicinas")}, materiales ${fin("materiales")}, luz ${fin("luz")}, objetos ${fin("objetos")}.`);

  const tot = Object.values(cuenta.resultados).reduce((a, b) => a + b, 0);
  L.push(`\nTiradas: ${["pifia", "fallo", "justo", "exito", "critico"].map((k) => `${k} ${pct(cuenta.resultados[k] ?? 0, tot)}`).join(" · ")}`);
  const dif = {};
  for (const g of juegos) for (const [k, v] of Object.entries(g.tiradas)) { dif[k] ??= { n: 0, ok: 0 }; dif[k].n += v.n; dif[k].ok += v.ok; }
  L.push("Éxito por dificultad: " + Object.keys(dif).sort((a, b) => a - b).map((k) => `${k}: ${pct(dif[k].ok, dif[k].n)}`).join(" · "));
  const s = (k) => juegos.reduce((a, g) => a + g[k], 0);
  L.push(`Dormir: ${s("suenos")} veces, te atacan en ${pct(s("emboscadas"), s("suenos"))} (a la intemperie: ${pct(s("emboscadasFuera"), s("suenosFuera"))}).`);
  L.push(`Cordura mínima media ${r1(media(juegos.map((g) => g.minCordura)))}; bajan de 40: ${pct(juegos.filter((g) => g.minCordura < 40).length, n)}; de 20: ${pct(juegos.filter((g) => g.minCordura < 20).length, n)}.`);
  L.push(`Por partida: ${r1(s("estropeados") / n)} objetos estropeados, ${r1(s("armasRotas") / n)} armas rotas, ${r1(s("luzAgotada") / n)} linternas agotadas, ${r1(s("unidos") / n)} compañeros (mueren ${r1(s("muertosComp") / n)}, se van ${r1(s("idosComp") / n)}), ${r1(s("trueques") / n)} trueques.`);
  const niveles = juegos.map((g) => g.nivelMax);
  L.push(`Nivel más alto alcanzado: media ${r1(media(niveles))}; llegan a 6+: ${pct(niveles.filter((x) => x >= 6).length, n)}; a 10: ${pct(niveles.filter((x) => x >= 10).length, n)}.`);
  const est = {};
  for (const g of juegos) for (const e of g.construido) est[e] = (est[e] ?? 0) + 1;
  L.push("Construcciones (partidas que la levantan): " + Object.keys(M.Is).map((k) => `${M.Is[k].label} ${pct(est[k] ?? 0, n)}`).join(" · "));
  const fab = {}, mal = {};
  for (const g of juegos) {
    for (const [k, v] of Object.entries(g.fabricadoOk)) fab[k] = (fab[k] ?? 0) + v;
    for (const [k, v] of Object.entries(g.fabricadoMal)) mal[k] = (mal[k] ?? 0) + v;
  }
  L.push("Fabricado por partida (bien/mal): " + Object.keys(fab).sort((a, b) => fab[b] - fab[a]).map((k) => `${k} ${r1(fab[k] / n)}/${r1((mal[k] ?? 0) / n)}`).join(" · "));

  // Opciones
  const todas = [
    ...ACCIONES.map((a) => `acción: ${a[1]}`), "acción: comer comida inventada por la IA",
    ...Object.entries(M.el).filter(([, d]) => d.use).map(([k]) => `usar: ${k}`),
    ...M.Jo.map((x) => `fabricar: ${x.id}`),
    "dormir", "refugio: establecer aquí", "refugio: volver", "refugio: guardar algo", "refugio: sacar algo",
    ...Object.values(M.Is).map((x) => `construir: ${x.label}`), "comerciar", "compañero: dar de comer",
  ];
  const turnos = juegos.reduce((a, g) => a + g.turnos, 0);
  const nunca = todas.filter((k) => !cuenta.elegida[k]);
  L.push(`\nOpciones que NUNCA se eligen (${nunca.length} de ${todas.length}):`);
  for (const k of nunca) L.push(`  - ${k}${cuenta.disp[k] ? ` (disponible ${cuenta.disp[k]} veces)` : " (nunca estuvo disponible)"}`);
  const raras = todas.filter((k) => cuenta.elegida[k] && cuenta.elegida[k] / n < 0.05).sort((a, b) => cuenta.elegida[a] - cuenta.elegida[b]);
  L.push(`Opciones casi nunca elegidas (menos de 1 vez cada 20 partidas):`);
  for (const k of raras) L.push(`  - ${k}: ${cuenta.elegida[k]} veces en ${n} partidas`);
  const top = Object.entries(cuenta.elegida).sort((a, b) => b[1] - a[1]).slice(0, 8);
  L.push("Las más elegidas: " + top.map(([k, v]) => `${k} ${pct(v, turnos)}`).join(" · "));
  return L.join("\n");
}

// ---------------------------------------------------------------- principal
const TANDAS = [
  { nombre: "azar", politica: "azar", dureza: 1 },
  { nombre: "sensato", politica: "sensato", dureza: 1 },
  { nombre: "sensato, IA inofensiva", politica: "sensato", dureza: 0 },
  // Prueba de control: igual que la anterior, pero el clima severo no hace nada (para medir cuánto mata).
  { nombre: "sensato, IA inofensiva, sin clima severo", politica: "sensato", dureza: 0, sinClimaSevero: true },
];

function correrTanda(M, tanda, desde, hasta) {
  const cuenta = { disp: {}, elegida: {}, resultados: {} };
  const juegos = [];
  for (let i = desde; i < hasta; i++) juegos.push(jugar(M, tanda.politica, tanda.dureza, SEMILLA * 1_000_003 + i, cuenta));
  return { cuenta, juegos };
}

function sumar(a, b) {
  for (const [k, v] of Object.entries(b)) a[k] = (a[k] ?? 0) + v;
  return a;
}

if (!isMainThread) {
  const { tanda, desde, hasta } = workerData;
  const M = cargarMotor(HTML);
  if (tanda.sinClimaSevero) for (const clima of Object.values(M.Sn)) clima.severe = false;
  parentPort.postMessage(correrTanda(M, tanda, desde, hasta));
} else {
  const M = cargarMotor(HTML);
  for (const [skill, texto] of ACCIONES) {
    const detectada = M.Uh(texto);
    if (detectada !== skill) throw new Error(`"${texto}" debería tirar ${skill ?? "nada"} y el juego tira ${detectada ?? "nada"}`);
  }
  const hilos = Math.max(1, Math.min(os.availableParallelism?.() ?? os.cpus().length, Number(opt("--hilos", 64)), PARTIDAS));
  const t0 = Date.now();
  const resultados = {};
  let salida = `Último Relato — simulación con el motor de ${path.basename(HTML)} · ${PARTIDAS} partidas por tanda · semilla ${SEMILLA}\n`;
  salida += "Las decisiones de la IA son SUPUESTOS (tabla IA en simular.mjs); el resto es el código real del juego.\n";
  for (const tanda of TANDAS) {
    const trozos = Array.from({ length: hilos }, (_, h) => [Math.floor((PARTIDAS * h) / hilos), Math.floor((PARTIDAS * (h + 1)) / hilos)]);
    const partes = await Promise.all(trozos.map(([desde, hasta]) => new Promise((ok, mal) => {
      const w = new Worker(new URL(import.meta.url), { workerData: { tanda, desde, hasta }, argv: process.argv.slice(2) });
      w.once("message", ok);
      w.once("error", mal);
    })));
    const cuenta = { disp: {}, elegida: {}, resultados: {} };
    const juegos = [];
    for (const p of partes) {
      for (const k of Object.keys(cuenta)) sumar(cuenta[k], p.cuenta[k]);
      juegos.push(...p.juegos);
    }
    salida += informe(M, tanda.nombre, juegos, cuenta) + "\n";
    resultados[tanda.nombre] = { cuenta, juegos: juegos.map(({ snapshots, tiradas, ...g }) => g) };
  }
  const comp = comprobaciones(M);
  salida += "\n================ Comprobaciones directas del motor (no dependen de la IA) ================\n";
  for (const c of comp) {
    if (!c.filas.length) continue;
    salida += `\n${c.titulo}:\n`;
    const cols = Object.keys(c.filas[0]);
    salida += "  " + cols.join(" | ") + "\n";
    for (const f of c.filas) salida += "  " + cols.map((k) => f[k]).join(" | ") + "\n";
  }
  salida += `\nTiempo: ${((Date.now() - t0) / 1000).toFixed(0)} s con ${hilos} hilos\n`;
  console.log(salida);
  if (SALIDA_JSON) fs.writeFileSync(SALIDA_JSON, JSON.stringify({ semilla: SEMILLA, partidas: PARTIDAS, dias: DIAS_MAX, IA, resultados, comprobaciones: comp }, null, 1));
}
