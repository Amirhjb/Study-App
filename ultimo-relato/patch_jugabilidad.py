"""Arreglos de jugabilidad encontrados jugando 3 partidas con Playwright.

Uso: python3 patch_jugabilidad.py entrada.html salida.html
Se aplica después de patch_equilibrio.py. Cada reemplazo exige que el texto
original aparezca exactamente una vez, así que falla (sin escribir nada) si
se aplica dos veces o sobre otra build.

Injusto
1. Dormir: la ventana avisa de la probabilidad real de que te ataquen y de si
   la sed, el hambre o una enfermedad no te dejarán dormir; si es así, te
   despiertas antes en vez de morir dormido.
2. La intoxicación se cura descansando (como la fiebre) y el botiquín completo
   cura lo que su ficha decía. Las enfermedades dicen cómo se curan y cuándo
   empeoran.
3. Tiradas: ya no salen por un sustantivo suelto ("perro", "madera", "cable");
   el combate necesita un verbo de ataque. Mientras escribes, el juego dice qué
   tirada harás y con qué probabilidad.
4. El equipo cuenta: sin cuchillo atacas a puñetazos, sin arma o sin munición
   no se dispara bien, y las herramientas (caña, botiquín, herramientas, aguja,
   trampa...) suman o restan en su tirada. El mechero da algo de luz y un sitio
   cerrado y seguro (peligro 1) está iluminado.
5. La pantalla final explica qué te mató.
Sin opciones
6. Cada tirada da experiencia aunque el narrador lo olvide, y las recetas y
   construcciones bloqueadas dicen cómo subir la habilidad que falta.
7. La comida y el agua que inventa el narrador se pueden comer y beber desde la
   mochila; comer narrado ya no sale como "Pierdes". La trampa caza mientras
   duermes. Nuevos: Carne fresca, Pescado fresco y la receta Asar a la brasa.
8. Las sugerencias del narrador se quitan cuando ya no valen (has dormido,
   viajado o pasado más de media hora sin él).
Aburrido
9. El diario se escribe también al dormir con el botón.
Interfaz y textos
10. Móvil: la ficha del objeto ya no tapa la mochila; la barra de arriba cabe.
11. "Comida enlatada x3" y "Vendas x5" tienen 3 y 5 usos.
12. Fantasía: la comida, el agua y los materiales tienen nombres de época.
13. Textos: "Bebes agua…", la ficha muestra cordura, riesgo y usos; la zona
    inicial respeta lo que diga el narrador (interior, exterior...).
"""
import sys

src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf8").read()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f"Esperaba {count} coincidencia(s) y hay {n}: {old[:80]}")
    s = s.replace(old, new)


# ---------------------------------------------------------------- 1. dormir
rep('case"urSetPace":', 'case"sleep":return urSleep(a,l);case"urSetPace":')
rep('children:y?"🧱 El muro te protege":`Riesgo de la zona: ${g}/5`})]}),',
    'children:y?"🧱 El muro te protege":`Riesgo de la zona: ${g}/5`})]}),o.jsx(urSleepNote,{state:s,hours:d}),')

# ---------------------------------------------------------------- 2. enfermedades
rep('food_poison:{id:"food_poison",label:"Intoxicación",icon:"🤢",hue:120,progressEvery:5,restCures:!1',
    'food_poison:{id:"food_poison",label:"Intoxicación",icon:"🤢",hue:120,progressEvery:8,restCures:!0')
rep('use:{hp:28,healInjury:2,cures:["wound_infection"],minutes:25,verb:"Usar"}',
    'use:{hp:28,healInjury:2,cures:["wound_infection","fever","food_poison","respiratory"],minutes:25,verb:"Usar"}')
rep('children:y.desc})]},m.id)', 'children:y.desc}),urCureHint(m,a.genre)]},m.id)')

# ---------------------------------------------------------------- 3. tiradas por intención
i = s.index('const Bh=[')
j = s.index('return null}', s.index('function Uh(a)', i)) + len('return null}')
s = s[:i] + r'''const Bh=[["Sigilo",/\b(sigilo|a escondidas|sin hacer ruido|me escondo|escondo|me oculto|agazap|furtiv|colarme|me cuelo|espío|espiar)/i],["Puntería",/\b(disparo|apunto|abro fuego|dispar|francotir|lanzo una flecha)/i],["Recarga",/\b(recargo|recargar)/i],["Primeros auxilios",/\b(curo|curar|vendo|vendar|coso la herida|trato la herida|suturo|desinfect)/i],["Rastreo",/\b(rastre|sigo el rastro|sigo las huellas|busco huellas|busco pistas|olfate|me oriento|orientarme)/i],["Trampas",/\b(pongo (una )?trampa|coloco (una )?trampa|monto (una )?trampa|armo (una )?trampa|desactivo (la )?trampa|pongo un cepo|pongo un lazo)/i],["Pesca",/\b(pesco|pescar|echo la caña|lanzo el sedal)/i],["Cultivo",/\b(planto|plantar|siembro|sembrar|cosecho|cosechar|riego)/i],["Cría de animales",/\b(amanso|amansar|domestic|ordeñ|calmo al (perro|animal|caballo)|cuido (del|al|de los) (perro|animal|caballo|ganado)|monto (a caballo|el caballo))/i],["Cocina",/\b(cocino|cocinar|guiso|preparo comida|aso |asar|hiervo|herv)/i],["Mecánica",/\b(reparo|reparar|arreglo|desmonto|engras|pongo en marcha)/i],["Electricidad",/\b(empalm|cableado|electrific|fusible|conecto los cables|hago un puente|cortocircuit|arranco el generador)/i],["Carpintería",/\b(serr|asierro|sierro|carpinter|clavo (las|los|unas|unos) |tallo|labro|hago tablones)/i],["Albañilería",/\b(levanto (un|el) muro|levanto una pared|apuntal|tapio|tapiar|refuerzo (la|el|una|un) (pared|muro)|pongo ladrillos|cemento)/i],["Herrería",/\b(forja|forjar|forjo|yunque|fundo metal|templar el acero)/i],["Sastrería",/\b(coso|coser|remiendo|remendar|zurzo)/i],["Fuerza",/\b(levanto|empujo|arrastro|fuerzo|derribo|cargo con|aparto el|trepo|escalo)/i]];const urCombat=/\b(ataco|atacar|golpeo|apuñal|acuchill|me lanzo contra|lucho|peleo|me defiendo|mato|hiero|embisto|le clavo|doy un hachazo|machaco)/i,urWeaponWords=[["Puntería",/\b(arco|pistola|escopeta|rifle|ballesta|fusil)/i],["Hoja corta",/\b(cuchillo|navaja|puñal|daga|bisturí)/i],["Hoja larga",/\b(espada|machete|sable|falcata)/i],["Hacha",/\b(hacha)/i],["Lanza",/\b(lanza|jabalina|pica)\b/i],["Contundente",/\b(bate|garrote|maza|porra|pico|palo|puños|puñetazo)/i]];function Uh(a){if(urCombat.test(a)){for(const[l,s]of urWeaponWords)if(s.test(a))return l;return"Contundente"}for(const[l,s]of Bh)if(s.test(a))return Zn.includes(l)?l:null;return null}''' + s[j:]
rep('te=K||!q?null:Uh(q)', 'te=K||!q?null:urSkillFor(A,q)')
rep('o.jsx("div",{id:"compose-hint",className:"compose__hint"', 'o.jsx(urRollHint,{state:l,text:y}),o.jsx("div",{id:"compose-hint",className:"compose__hint"')

# ---------------------------------------------------------------- 4. el equipo cuenta
rep('function Vh(a,l,s){const c=Yn(a,l),', 'function Vh(a,l,s){const urG=urGear(a,l),c=Math.max(0,Yn(a,l)+urG.mod),')
rep('label:`${l} ${c} + d20(${d})', 'label:`${l} ${c}${urG.note?` (${urG.note})`:""} + d20(${d})')
# Luz: el mechero alumbra poco; un interior seguro (peligro 1) está iluminado.
rep('if(k==="bat")return{item:i,kind:k};b=b||{item:i,kind:k}}return b}',
    'if(k==="bat")return{item:i,kind:k};b=b||{item:i,kind:k}}return b||urWeakLight(a)}')
rep('function urDark(a){return urAtBaseWith(a,"generador")?!1:',
    'function urDark(a){return urAtBaseWith(a,"generador")||Dn(a.map)?.type==="indoor"&&(Dn(a.map)?.danger??2)<=1&&!urAtBase(a)?!1:')
rep('return(urDark(a)&&!urHasLight(a)?2:0)', 'return(urDark(a)?urLightItem(a)?.kind==="weak"?1:urHasLight(a)?0:2:0)')
rep('if(L){lit=!0;const lb=', 'if(L&&L.kind==="weak")lit=.5;else if(L){lit=!0;const lb=')
rep('dark&&!lit&&!s.resting&&(loss+=3*h)', 'dark&&lit!==!0&&!s.resting&&(loss+=(lit?1.5:3)*h)')
rep('`LUZ: está oscuro; se alumbra con ${vr(lt.item.name,a.genre)}.`',
    '`LUZ: está oscuro; ${lt.kind==="weak"?"solo tiene la llama de":"se alumbra con"} ${vr(lt.item.name,a.genre)}.`')

rep('dk?lt?`${vr(lt.item.name,s.genre)}: ${Math.round(lt.item.cond??100)} %`',
    'dk?lt?lt.kind==="weak"?`Solo la llama de ${vr(lt.item.name,s.genre).toLowerCase()}: ves poco`:`${vr(lt.item.name,s.genre)}: ${Math.round(lt.item.cond??100)} %`')

# ---------------------------------------------------------------- 5. pantalla final
rep('children:l.deathCause??"Causa desconocida"})]}),h&&o.jsx("blockquote"',
    'children:l.deathCause??"Causa desconocida"}),o.jsx(urDeathWhy,{s:l})]}),h&&o.jsx("blockquote"')

# ---------------------------------------------------------------- 6. experiencia y pistas
rep('return Ot(m.length?Ce(st,m):st)}',
    'if(roll&&Zn.includes(roll.skill)&&!((s.skillXp||{})[roll.skill]>0))urGiveXp(st,roll.skill,{pifia:5,fallo:15,justo:30,exito:30,critico:40}[roll.outcome]??0,m);return Ot(m.length?Ce(st,m):st)}')
rep('g.failChance>0&&o.jsxs("span",{className:"chip",style:{color:"var(--warn)"},children:[Math.round(g.failChance*100)," % de fallo"]})]})',
    'g.failChance>0&&o.jsxs("span",{className:"chip",style:{color:"var(--warn)"},children:[Math.round(g.failChance*100)," % de fallo"]}),g.recipe.skillReq&&!g.hasSkill&&o.jsx("span",{style:{fontSize:11,color:"var(--text-dim)",flexBasis:"100%",lineHeight:1.45},children:urHowTo(g.recipe.skillReq.skill)})]})')
rep('children:[k.name," ",Je(s.inventory,k.name),"/",k.qty]},k.name))]}),',
    'children:[k.name," ",Je(s.inventory,k.name),"/",k.qty]},k.name))]}),!b&&o.jsx("p",{style:{fontSize:11,color:"var(--text-dim)",lineHeight:1.45},children:urHowTo(h.req.skill)}),')

# ---------------------------------------------------------------- 7. comida inventada, caza y trampas
rep('function en(a,l){return(l&&Object.prototype.hasOwnProperty.call(l,a)?l[a]:void 0)??el[a]??Dd(a)}',
    'function en0(a,l){return(l&&Object.prototype.hasOwnProperty.call(l,a)?l[a]:void 0)??el[a]??Dd(a)}'
    'function en(a,l){const d=en0(a,l);if(d.use||Object.prototype.hasOwnProperty.call(el,a))return d;const t=d.tags||[];'
    'return t.includes("food")?{...d,use:{hunger:22,minutes:10,verb:"Comer"}}:t.includes("water")?{...d,use:{thirst:25,minutes:3,verb:"Beber",urRisk:.2}}:d}')
rep('_.length&&(y=qn(y,_),d.push({kind:"bad",text:`Pierdes: ${',
    '_.length&&(y=qn(y,_),d.push({kind:urAte(s,_,a)?"system":"bad",text:`${urAte(s,_,a)?"Consumes":"Pierdes"}: ${')
rep('"Carne curada":{kg:.3,l:.3,tags:["food"],use:{hunger:28,thirst:-6,minutes:8,verb:"Comer"}},',
    '"Carne curada":{kg:.3,l:.3,tags:["food"],use:{hunger:28,thirst:-6,minutes:8,verb:"Comer"}},'
    '"Carne fresca":{kg:.5,l:.5,tags:["food"],use:{hunger:25,minutes:10,verb:"Comer",urRisk:.15},desc:"Recién cazada. Cruda a veces sienta mal; asada, no."},'
    '"Pescado fresco":{kg:.4,l:.4,tags:["food"],use:{hunger:22,minutes:10,verb:"Comer",urRisk:.15},desc:"Recién pescado. Mejor asado."},'
    '"Carne asada":{kg:.4,l:.4,tags:["food"],use:{hunger:38,minutes:10,verb:"Comer"},desc:"Asada a la brasa. Llena y no sienta mal."},')
rep('const urDecay={"Caldo caliente":2,', 'const urDecay={"Carne fresca":1.5,"Pescado fresco":1.5,"Carne asada":.8,"Caldo caliente":2,')
rep('je({id:"Recuperar chatarra",',
    'je({id:"Asar a la brasa",ingredients:[{name:"Carne fresca",qty:1,substitutes:[{name:"Pescado fresco",failChance:0}]},{name:"Mechero",material:"ignicion",qty:1,tool:!0}],result:{name:"Carne asada",qty:1},category:"comida",skillReq:{skill:"Cocina",level:1},minutes:20,xp:2,desc:"Un fuego pequeño y paciencia. Lo cazado deja de ser un riesgo."}),je({id:"Recuperar chatarra",')
rep('case"startRun":{const r=Ms0(a,l);return r.screen==="game"?{...r,pace:a.pace||"clasico"}:r}',
    'case"startRun":{const r=Ms0(a,l);return r.screen==="game"?{...r,pace:a.pace||"clasico",knownRecipes:[...new Set([...r.knownRecipes,"Asar a la brasa"])]}:r}')
rep('?m[x]:x))]}:st}', '?m[x]:x)),"Asar a la brasa"]}:st}')
rep("""'19. AGUA: el agua que el jugador recoja de un río, un charco o la lluvia es "Agua sin tratar"; "Agua (500ml)" es agua potable.']}""",
    """'19. AGUA: el agua que el jugador recoja de un río, un charco o la lluvia es "Agua sin tratar"; "Agua (500ml)" es agua potable.','20. CAZA Y PESCA: lo que se caza es "Carne fresca" y lo que se pesca, "Pescado fresco". Usa esos nombres.']}""")

# ---------------------------------------------------------------- 8. sugerencias viejas
rep('const urDirty=V.useRef(!1),urPrev=V.useRef(null),urSkip=V.useRef(!1);',
    'const urDirty=V.useRef(!1),urPrev=V.useRef(null),urSkip=V.useRef(!1);const urSugAt=V.useRef(null);'
    'V.useEffect(()=>{const t=urSugAt.current;t&&(a.minutes-t.m>30||a.map.currentZone!==t.z)&&(urSugAt.current=null,g([]))},[a.minutes,a.map.currentZone]);')
rep('P.current=wr,I(tn.sceneDescription)', 'P.current=wr,urSugAt.current={m:wr.minutes,z:wr.map.currentZone},I(tn.sceneDescription)')

# ---------------------------------------------------------------- 9. diario al dormir
rep('const urD=V.useCallback(q=>{const k=urS.current;(k==="thinking"||k==="improvising")&&urBlock.has(q.type)||l(q)},[]);',
    'const urD=V.useCallback(q=>{const k=urS.current;if((k==="thinking"||k==="improvising")&&urBlock.has(q.type))return;l(q);'
    'q.type==="sleep"&&setTimeout(()=>{try{pe(se(Math.round(q.hours),1,12)*60,P.current,new AbortController().signal)}catch(e){console.error(e)}},150)},[]);')

# ---------------------------------------------------------------- 10. móvil
rep('style:{display:"grid",gap:18,gridTemplateColumns:g?"minmax(0, 1fr) 250px":"1fr",alignItems:"start"}',
    'className:"ur-invgrid",style:{display:"grid",gap:18,gridTemplateColumns:g?"minmax(0, 1fr) 250px":"1fr",alignItems:"start"}')

# ---------------------------------------------------------------- 11. objetos con varios usos
rep('"Comida enlatada x3":{kg:1.2,l:1.5,tags:["food"],use:{hunger:32,thirst:3,minutes:10,verb:"Comer"}}',
    '"Comida enlatada x3":{kg:1.2,l:1.5,tags:["food"],use:{hunger:35,thirst:3,minutes:10,verb:"Comer",consumed:!1,urCharges:3}}')
rep('"Vendas x5":{kg:.2,l:.3,tags:["medical"],use:{hp:8,healInjury:1,minutes:8,verb:"Vendar"}}',
    '"Vendas x5":{kg:.2,l:.3,tags:["medical"],use:{hp:5,healInjury:1,minutes:8,verb:"Vendar",consumed:!1,urCharges:5}}')
rep('u.sanity&&(st.sanity=', 'u.urCharges&&(st.inventory=urWearItem(st.inventory,l.name,100/u.urCharges+1e-6,m,`Se te acaba: ${vr(l.name,st.genre)}.`));u.sanity&&(st.sanity=')
rep('(d.tags||[]).includes("food")&&pc!=null&&pc<30&&', '(d.tags||[]).includes("food")&&!u.urCharges&&pc!=null&&pc<30&&')
rep('Math.round(k.cond)+" %"', 'urCondTxt(k)', count=2)

# ---------------------------------------------------------------- 12. fantasía
rep('Pilas:"Aceite para el farol"}',
    'Pilas:"Aceite para el farol","Lata de comida":"Pan y queso","Comida enlatada x3":"Hatillo de víveres x3","Barrita energética":"Torta de avena",'
    '"Agua (500ml)":"Odre de agua","Botella de agua":"Cantimplora de cuero","Ración sellada":"Cecina en salazón",Chatarra:"Hierro viejo",'
    '"Herramientas básicas":"Herramientas de artesano","Kit de reparación":"Bolsa de remiendos","Cinta adhesiva":"Brea",Pegamento:"Cola de hueso",'
    '"Mochila pequeña":"Zurrón","Mochila grande":"Petate","Bolsa de lona":"Saco de lona","Botiquín pequeño":"Bolsa de hierbas",'
    '"Botiquín completo":"Maletín de cirujano","Suero oral":"Tisana de sales","Materiales químicos":"Reactivos de alquimista",'
    '"Manual de medicina":"Tratado del físico","Manual de ingeniería":"Tratado de ingenios",Biblia:"Libro de horas","Ropa de abrigo":"Capa de lana",'
    '"Chaqueta de cuero":"Jubón de cuero",Alcohol:"Aguardiente","Libreta y lápiz":"Cuaderno y carboncillo",Machete:"Falcata"}')
rep('if(Bd(s)||l.includes(s))return s;', 'if(Bd(s)||l.includes(s))return s;{const r=urSkinRev(s);if(r)return r}')
rep('"CATÁLOGO DE OBJETOS (usa estos nombres tal cual cuando encajen):",ph,',
    '"CATÁLOGO DE OBJETOS (usa estos nombres tal cual cuando encajen):",Ud.map(x=>vr(x,a.genre)).join(" · "),')

# ---------------------------------------------------------------- 13. textos y zona inicial
rep('m=[{kind:"system",text:`${c.verb??"Usas"} ${l.name}.`}]', 'm=[{kind:"system",text:urVerbo(c,l.name,a.genre)}]')
rep('g.use.cures?.length?o.jsx("li",{children:"Cura enfermedades"}):null,',
    'g.use.cures?.length?o.jsx("li",{children:"Cura enfermedades"}):null,...urUseLines(g.use),')
rep('d[m]={...d.Inicio};delete d.Inicio;', 'd[m]={...d.Inicio,type:l.type||d.Inicio.type};delete d.Inicio;')

JS = r"""
function urHasItem(a,re){return a.inventory.some(i=>re.test(i.name)||re.test(vr(i.name,a.genre)))}
const urWeaponCls={"Hoja corta":/cuchill|navaja|puñal|daga|bisturí/i,"Hoja larga":/machete|espada|sable|falcata/i,Hacha:/hacha/i,Lanza:/lanza|jabalina|\bpica\b/i};
function urSkillFor(a,t){const k=Uh(t);return k&&urWeaponCls[k]&&!urHasItem(a,urWeaponCls[k])?"Contundente":k}
const urGearT={Pesca:[[/caña|sedal|anzuelo|red de pesca/i,2,"con caña"],[0,-2,"sin caña"]],Trampas:[[/trampa|cepo/i,2,"con trampa"],[/cuerda|alambre|cordel/i,1,"con cuerda"],[0,-2,"sin material"]],"Primeros auxilios":[[/botiquín|vendas|bisturí|aguja|bolsa de hierbas|maletín/i,2,"con material médico"],[0,-2,"sin material"]],Mecánica:[[/herramientas|kit de reparación|navaja multiusos|llave|remiendos/i,2,"con herramientas"],[0,-2,"sin herramientas"]],Electricidad:[[/herramientas|kit de reparación|alambre|cinta/i,1,"con material"],[0,-2,"sin herramientas"]],Carpintería:[[/herramientas|hacha|sierra|martillo/i,2,"con herramientas"],[0,-2,"sin herramientas"]],Albañilería:[[/herramientas|pico|pala/i,1,"con herramientas"]],Herrería:[[/herramientas|martillo/i,1,"con herramientas"],[0,-2,"sin herramientas"]],Sastrería:[[/aguja/i,2,"con aguja"],[0,-2,"sin aguja"]],Cocina:[[/mechero|pedernal|yesca|cerilla/i,1,"con fuego"],[0,-2,"sin fuego"]],Rastreo:[[/brújula|mapa/i,1,"con brújula o mapa"]],"Cría de animales":[[/sedante|adormidera/i,1,"con sedante"]],Fuerza:[[/palanca|\bpico\b/i,1,"con palanca"]],Contundente:[[/bate|maza|garrote|porra|\bpico\b|palo|tubería|martillo|barra/i,0,""],[0,-1,"a puñetazos"]],Puntería:[[/pistola|escopeta|rifle|arco|ballesta|fusil/i,"ammo",""],[0,-6,"sin arma"]]};
function urGear(a,k){for(const[re,mod,note]of urGearT[k]||[]){if(re===0)return{mod,note};if(urHasItem(a,re))return mod==="ammo"?urHasItem(a,/cargador|cartucho|flecha|virote|bala|munici/i)?{mod:0,note:""}:{mod:-4,note:"sin munición"}:{mod,note}}return{mod:0,note:""}}
function urRollHint({state:s,text:t}){const q=(t||"").trim();if(q.length<4||s.screen!=="game")return null;const k=urSkillFor(s,q);if(!k)return o.jsx("div",{className:"ur-roll",children:"Sin tirada: lo resuelve el narrador."});const g=urGear(s,k),lv=Math.max(0,Yn(s,k)+g.mod),f=Hh(s);let ok=0;for(let d=2;d<=20;d++)(d===20||d+lv>=f)&&ok++;return o.jsxs("div",{className:"ur-roll",children:["🎲 Tirada de ",o.jsx("b",{children:k}),` · nivel ${lv}${g.note?` (${g.note})`:""} contra ${f} · `,o.jsxs("b",{children:[ok*5," %"]})," de que salga bien"]})}
function urWeakLight(a){const i=a.inventory.find(x=>/mechero|yesca|cerilla|vela|candil/i.test(x.name)&&(en(x.name,a.customItems).tags||[]).includes("fire"));return i?{item:i,kind:"weak"}:null}
function urSleepWhy(a,t){if(t.screen==="death")return"no habrías vuelto a despertar";const n=t.needs;if(n.thirst<=0)return"la sed no te deja dormir";if(n.hunger<=0)return"el hambre no te deja dormir";if(n.temp<=33)return"tiritas de frío";if(t.hp<a.hp&&t.hp<=t.maxHp*.2)return"te encuentras demasiado mal";return""}
function urSleepPlan(a,H){const dry=h=>urSleepWhy(a,Ms0(a,{type:"sleep",hours:h,rng:()=>.999}));const why=dry(H);let h=H;if(why)for(;h>1&&dry(h);)h--;return{h,why}}
function urAmbush(a,c){const f=urAtBase(a),m=f&&a.base.structures.includes("muro"),y=f&&a.base.structures.includes("generador"),g=urShelterOf(a)||f,z=Dn(a.map)?.danger??2;let T=z*.01*c;m&&(T*=.12),y&&(T*=.5),f&&(T*=.6),g||(T*=1.8);return Math.round(Math.min(.6,T)*100)}
function urSleep(a,l){const H=se(Math.round(l.hours),1,12),p=urSleepPlan(a,H);let r=Ms0(a,{...l,hours:p.h});if(r===a)return r;r=urTrapCatch(a,r,p.h,l.rng??vt);return p.why&&r.screen!=="death"?Ce(r,[{kind:"warn",text:p.h<H?`Te despiertas tras ${p.h} ${p.h===1?"hora":"horas"}: ${p.why}.`:`Duermes mal: ${p.why}.`}]):r}
function urSleepNote({state:s,hours:H}){const p=V.useMemo(()=>urSleepPlan(s,H),[s,H]),r=urAmbush(s,p.h);return o.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:8,marginBottom:18},children:[o.jsxs("div",{style:{fontSize:12.5,color:"var(--text-mid)"},children:["Probabilidad de que te ataquen: ",o.jsxs("b",{style:{color:r>=30?"var(--bad)":r>=15?"var(--warn)":void 0},children:[r," %"]})]}),p.why&&o.jsxs("div",{className:"notice notice--warn",children:[o.jsx("span",{"aria-hidden":!0,children:"⚠"}),o.jsx("span",{children:p.h<H?`Te despertarás tras ${p.h} ${p.h===1?"hora":"horas"}: ${p.why}. Come o bebe antes.`:`Ojo: ${p.why}. Come o bebe antes de dormir.`})]})]})}
function urTrapCatch(a,r,h,rng){if(h<4||r.screen==="death"||!r.inventory.some(x=>x.name==="Trampa metálica"))return r;if(rng()>=Math.min(.75,.2+.06*Yn(a,"Trampas")))return r;const st={...r,inventory:xt(r.inventory,[{name:"Carne fresca",qty:1}])},m=[{kind:"good",text:"🪤 La trampa ha cazado algo mientras dormías: Carne fresca."}];urGiveXp(st,"Trampas",10,m);return Ce(st,m)}
function urGiveXp(st,k,pts,m){if(!(pts>0))return;const c=st.skillXp?.[k]??0,b=Ut(c),n=Math.min(pa[10],c+pts*(urBookMul(st)[k]??1)),nb=Ut(n);st.skillXp={...st.skillXp,[k]:n};nb>b&&(m.push({kind:"good",text:`⬆ ${k} → nivel ${nb}`}),st.stats={...st.stats,levelsGained:(st.stats?.levelsGained??0)+1})}
const urHowEx={Sigilo:"Me escondo y avanzo sin hacer ruido",Puntería:"Disparo a una lata",Recarga:"Recargo el arma","Primeros auxilios":"Vendo la herida",Rastreo:"Sigo el rastro",Trampas:"Pongo una trampa",Pesca:"Pesco en el río",Cultivo:"Planto unas semillas","Cría de animales":"Intento amansar al perro",Cocina:"Cocino algo caliente",Mecánica:"Reparo el mecanismo",Electricidad:"Empalmo los cables",Carpintería:"Asierro unos tablones",Albañilería:"Refuerzo la pared",Herrería:"Forjo una herramienta",Sastrería:"Coso un remiendo",Fuerza:"Fuerzo la puerta","Hoja corta":"Ataco con el cuchillo","Hoja larga":"Ataco con el machete",Hacha:"Ataco con el hacha",Lanza:"Ataco con la lanza",Contundente:"Golpeo con el bate"};
function urHowTo(k){return`Para subir ${k}, practica: escribe por ejemplo «${urHowEx[k]??k}». Cada tirada da experiencia, aunque falle.`}
function urCureHint(d,genre){const def=nn[d.id];if(!def)return null;const items=Object.entries(el).filter(([,x])=>x.use&&((x.use.cures||[]).includes(d.id)||(x.use.curesNow||[]).includes(d.id))).map(([k])=>vr(k,genre)),p=[];items.length&&p.push(`Se cura con: ${items.join(", ")}`);def.restCures&&p.push("dormir 5 h o más la hace retroceder");d.id==="radiation"&&p.push("remite poco a poco");(d.treated??0)>0?p.push("en tratamiento"):d.stage<2&&p.push(`empeora en unas ${Math.max(1,Math.ceil(def.progressEvery-(d.ticks??0)))} h`);return p.length?o.jsx("div",{style:{fontSize:11,color:"var(--text-mid)",marginTop:4,lineHeight:1.4},children:p.join(" · ")+"."}):null}
function urDeathWhy({s}){const L=s.log;let i=L.length-1;for(;i>=0&&L[i].kind!=="player";)i--;const pl=L[i],bad=L.slice(i+1).filter(e=>(e.kind==="bad"||e.kind==="warn")&&!/^Aquí termina/.test(e.text)).slice(-4);return bad.length?o.jsxs("div",{style:{marginTop:16,fontSize:13,color:"var(--text-mid)",lineHeight:1.6,textAlign:"left"},children:[o.jsx("div",{className:"u-eyebrow",style:{marginBottom:6,textAlign:"center"},children:pl&&/^Duermo/.test(pl.text)?"Mientras dormías":"En tus últimos momentos"}),o.jsx("ul",{style:{display:"flex",flexDirection:"column",gap:4,paddingLeft:18,listStyle:"disc"},children:bad.map(e=>o.jsx("li",{children:e.text},e.id))})]}):null}
function urAte(s,lost,a){return((s.hungerChange??0)>0||(s.thirstChange??0)>0)&&lost.every(I=>{const t=en(I.name,a.customItems).tags||[];return t.includes("food")||t.includes("water")})}
function urCondTxt(k){const n=Object.prototype.hasOwnProperty.call(el,k.name)?el[k.name].use?.urCharges:0;return n?`${Math.max(1,Math.ceil(k.cond/100*n-1e-6))}/${n} usos`:Math.round(k.cond)+" %"}
let urSkinMap=null;function urSkinRev(s){urSkinMap||(urSkinMap=new Map(Object.values(Bn).flatMap(g=>Object.entries(g.itemSkin||{}).map(([k,v])=>[On(v),k]))));return urSkinMap.get(On(s))??null}
function urVerbo(c,n,g){const x=vr(n,g),y=/^(Biblia|Libro de horas)$/.test(x)?x:x.charAt(0).toLowerCase()+x.slice(1);if(c.urRecharge)return"Cambias las pilas.";const v={Comer:"Comes",Beber:"Bebes",Usar:"Usas",Vendar:"Te vendas con",Inyectar:"Te inyectas",Tomar:"Tomas",Leer:"Lees"}[c.verb]??c.verb??"Usas";return`${v} ${y}.`}
function urUseLines(u){return[u.sanity?o.jsxs("li",{children:["Cordura ",u.sanity>0?"+":"",u.sanity]},"s"):null,u.urCharges?o.jsx("li",{children:`${u.urCharges} usos por unidad`},"c"):null,u.curesNow?.length?o.jsx("li",{children:"Cura al momento"},"n"):null,u.urRecharge?o.jsx("li",{children:"Recarga una linterna gastada"},"r"):null,u.urRisk?o.jsx("li",{style:{color:"var(--warn)"},children:`Riesgo de intoxicación: ${Math.round(u.urRisk*100)} %`},"k"):null].filter(Boolean)}
"""
rep('const im=document.getElementById("root");', JS.strip().replace("\n", "") + 'const im=document.getElementById("root");')

CSS = """
.ur-roll{font-size:12px;color:var(--text-dim);margin:7px 2px 0;line-height:1.4}
.ur-roll b{color:var(--text-mid);font-weight:600}
@media (max-width:640px){.ur-invgrid{grid-template-columns:1fr!important}.ur-invgrid>:nth-child(2){position:sticky;bottom:0;z-index:2;box-shadow:0 -10px 24px rgba(0,0,0,.45)}}
@media (max-width:480px){.topbar__brand{font-size:14px;margin-right:0}.topbar__meta{gap:4px}.topbar__meta .chip{padding-left:7px;padding-right:7px}}
"""
rep("</style>", CSS.strip().replace("\n", "") + "</style>")

open(dst, "w", encoding="utf8").write(s)
print("ok", len(s))
