"""Arreglos de equilibrio encontrados con simular.mjs (10.000 partidas).

Uso: python3 patch_equilibrio.py entrada.html salida.html
Se aplica después de patch_mecanicas.py. Cada reemplazo exige que el texto
original aparezca exactamente una vez, así que falla (sin escribir nada) si
se aplica dos veces o sobre otra build.

1. Clima: los efectos van por hora, no por acción. Antes, 12 acciones de 5 min
   con ola de calor subían la temperatura a 43 °C; una de 60 min, a 37,5 °C.
   También los redondeos de daño (antes 1 punto mínimo por acción en tormenta
   y 0 de daño por sed en acciones de 5 min) y la infección respiratoria.
   Comer, fabricar o dormir respetan si el narrador dijo que estás a cubierto.
2. Infección de heridas: depende de la gravedad (1 %, 2 % o 4 % por hora, antes
   12 %), avanza cada 10 h (antes 7) y descansar 5 h o más la hace retroceder.
3. La vida se recupera sola: +1/h descansando (+1,5 en el refugio), +0,2/h
   despierto, si no tienes hambre, sed, frío, calor ni una enfermedad avanzada.
4. Emboscadas al dormir: base 0,01 por peligro y hora (antes 0,028) y tope del
   60 % (antes 70 %), para que dormir a cubierto sirva también en zonas de peligro 3+.
5. Recetas: una receta no puede usar su propio resultado como ingrediente;
   las vendas ya no cuentan como tela; Rasgar trapos da 2 telas y Remendar ropa
   pide 3; Recuperar chatarra devuelve 1; el Destilador necesita agua sin tratar.
6. Críticos: hace falta superar la dificultad en 10 (antes 6) o sacar un 20.
7. Recetas de inicio: se corrigen los nombres del Soldado y del Químico, y las
   recetas que nadie conocía pasan a los oficios que encajan.
"""
import sys

src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf8").read()


def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit(f"Esperaba 1 coincidencia y hay {n}: {old[:80]}")
    s = s.replace(old, new)


# ---------------------------------------------------------------- 1. clima por hora
# g = horas de la acción (sin el mínimo de 15 min); p(x) = probabilidad x por hora.
rep('return a.id==="rain"&&!l&&(h.needs.temp=-.4,h.needs.thirst=5,',
    'return a.id==="rain"&&!l&&(h.needs.tempRate=-.4,h.needs.thirst=5*b,')
rep('function nh(a,l,s,c,d,f,m){',
    'function nh(a,l,s,c,d,f,m){const g=Math.min(Math.max(0,c/60),8),b=Math.min(3,g),p=x=>f()<1-(1-x)**g;')
rep('const g=se(c/60,.25,8),b=Math.min(3,g);if(l)return', 'if(l)return')
rep('h.hp-=Math.round(7*b)', 'h.hp-=urRnd(7*b,f)')
rep('w.length&&f()<.35', 'w.length&&p(.35)')
rep('if(h.hp-=Math.round(12*b),h.needs.hunger=-6,h.needs.thirst=-6,',
    'if(h.hp-=urRnd(12*b,f),h.needs.hunger=-6*b,h.needs.thirst=-6*b,')
rep('s.length&&f()<.4){', 's.length&&p(.4)){')
rep('h.needs.thirst=-10*b,h.needs.temp=1.2,h.hp-=Math.round(3*b)',
    'h.needs.thirst=-10*b,h.needs.tempRate=1.2,h.hp-=urRnd(3*b,f)')
rep('if(w.length&&f()<.4){', 'if(w.length&&p(.4)){')
rep('else h.hp-=Math.round(5*b)', 'else h.hp-=urRnd(5*b,f)')
rep('h.hp-=Math.round(6*b*S),h.needs.temp=-2.5*S', 'h.hp-=urRnd(6*b*S,f),h.needs.tempRate=-2.5*S')
# La temperatura del cuerpo se calcula en pasos de una hora como mucho: el clima
# empuja (tempRate, en °C por hora) y el cuerpo vuelve hacia 36,5 °C.
rep('{resting:s.resting});for(const J of P.warnings)',
    '{resting:s.resting,tempRate:b.needs.tempRate??0,rng:c});for(const J of P.warnings)')
rep('const P=se((36.5-T)*Math.min(1,m/6),-2,2);T+=P;',
    '{const n=Math.max(1,Math.ceil(m)),q=m/n;for(let i=0;i<n;i++){T+=(f.tempRate??0)*q;T+=se((36.5-T)*q/6,-2,2)}}')
rep('hpDelta:Math.round(R)', 'hpDelta:urRnd(R,f.rng)')
rep('a.needs.temp<=34.5&&!f("respiratory")&&s()<.15*m', 'a.needs.temp<=34.5&&!f("respiratory")&&s()<1-(1-.15*m)**h')
# A cubierto: lo último que dijo el narrador sobre esta zona vale también para comer,
# fabricar o dormir aquí (antes solo contaba el tipo de zona), y el refugio siempre resguarda.
rep('const g=s.sheltered??Os(a.map),', 'const g=s.sheltered??urShelterOf(a),')
rep('g=Os(a.map)||f,b=[{kind:"player"', 'g=urShelterOf(a)||f,b=[{kind:"player"')
rep('c=Os(a.map),d=a.hp/(a.maxHp||100)', 'c=urShelterOf(a),d=a.hp/(a.maxHp||100)')
rep('const c=Dn(a.map)?.danger??1,d=Os(a.map),f=Sn[a.weather.id]', 'const c=Dn(a.map)?.danger??1,d=urShelterOf(a),f=Sn[a.weather.id]')
rep('function urAfterTurn(a,st0,s,roll){const st={...st0},m=[],sc=s.sanityChange||0;',
    'function urAfterTurn(a,st0,s,roll){const st={...st0},m=[],sc=s.sanityChange||0;typeof s.sheltered=="boolean"&&(st.urShelter={zone:st.map.currentZone,v:s.sheltered});')

# ---------------------------------------------------------------- 2. infección de heridas
rep('a.injuries.length>0&&!y&&!f("wound_infection")&&s()<.12*m*Math.min(3,h)',
    'a.injuries.length>0&&!y&&!f("wound_infection")&&s()<1-(1-([0,.01,.02,.04][Math.min(3,Math.max(0,...a.injuries.map(x=>x.severity|0)))]??0)*m)**h')
rep('progressEvery:7,restCures:!1', 'progressEvery:10,restCures:!0')

# ---------------------------------------------------------------- 3. la vida se recupera sola
rep('const d0=mn(a.minutes),d1=mn(st.minutes);',
    'st.counters=urRegen(st,h,s.resting,atBase);const d0=mn(a.minutes),d1=mn(st.minutes);')
# Daño por cordura a 0: redondeo sin sesgo (antes, 1 punto mínimo por acción).
rep('s1<=0&&(st.hp=se(st.hp-Math.max(1,Math.round(2*h)),0,st.maxHp)', 's1<=0&&(st.hp=se(st.hp-urRnd(2*h,opt.rng),0,st.maxHp)')

# ---------------------------------------------------------------- 4. emboscadas al dormir
rep('let T=z*.028*c;', 'let T=z*.01*c;')
rep('s()<Math.min(.7,T)', 's()<Math.min(.6,T)')

# ---------------------------------------------------------------- 5. recetas que multiplicaban material
rep('const m=f.ingredients.map(z=>Rh(z,l,d))', 'const m=f.ingredients.map(z=>Rh(z,l.filter(x=>x.name!==f.result.name),d))')
rep('"Vendas x5":{kg:.2,l:.3,tags:["medical"],materials:{tela:.1},use:', '"Vendas x5":{kg:.2,l:.3,tags:["medical"],use:')
rep('result:{name:"Chatarra",qty:3},category:"base"', 'result:{name:"Chatarra",qty:1},category:"base"')
rep('result:{name:"Tela",qty:3},category:"herramienta"', 'result:{name:"Tela",qty:2},category:"herramienta"')
rep('{name:"Aguja e hilo",material:"costura",qty:1,tool:!0},{name:"Tela",material:"tela",qty:1}]',
    '{name:"Aguja e hilo",material:"costura",qty:1,tool:!0},{name:"Tela",material:"tela",qty:3}]')
rep('je({id:"Destilador de agua",ingredients:[{name:"Chatarra",material:"metal",qty:2},{name:"Mechero",material:"ignicion",qty:1,tool:!0}]',
    'je({id:"Destilador de agua",ingredients:[{name:"Agua sin tratar",qty:3},{name:"Chatarra",material:"metal",qty:2,tool:!0},{name:"Mechero",material:"ignicion",qty:1,tool:!0}]')
rep('"Botella de agua":{kg:.6,l:.6,tags:["water"],materials:{recipiente:0},use:{thirst:45,minutes:4,verb:"Beber"}},',
    '"Botella de agua":{kg:.6,l:.6,tags:["water"],materials:{recipiente:0},use:{thirst:45,minutes:4,verb:"Beber"}},'
    '"Agua sin tratar":{kg:.5,l:.5,tags:["water"],use:{thirst:30,minutes:3,verb:"Beber",urRisk:.35},desc:"De un río, un charco o la lluvia. Sin hervir puede sentar mal."},')
rep('&&Math.random()<.4&&(st.diseases=[...st.diseases,{id:"food_poison",stage:0,ticks:0}],m.push({kind:"bad",text:"Estaba en mal estado y te sienta fatal: intoxicación."}));',
    '&&Math.random()<.4&&(st.diseases=[...st.diseases,{id:"food_poison",stage:0,ticks:0}],m.push({kind:"bad",text:"Estaba en mal estado y te sienta fatal: intoxicación."}));'
    'u.urRisk&&!st.diseases.some(x=>x.id==="food_poison")&&Math.random()<u.urRisk&&(st.diseases=[...st.diseases,{id:"food_poison",stage:0,ticks:0}],m.push({kind:"bad",text:"El agua no estaba limpia: intoxicación."}));')
rep("'18. RITMO: sigue la indicación de RITMO del estado actual.']}",
    "'18. RITMO: sigue la indicación de RITMO del estado actual.','19. AGUA: el agua que el jugador recoja de un río, un charco o la lluvia es \"Agua sin tratar\"; \"Agua (500ml)\" es agua potable.']}")

# ---------------------------------------------------------------- 6. críticos
rep('m>=f+6?h="critico"', 'm>=f+10?h="critico"')

# ---------------------------------------------------------------- 7. recetas de inicio
rep('recipes:["Lanza improvisada","Trampa de caza"]', 'recipes:["Lanza de madera","Trampa de caza"]')
rep('recipes:["Explosivo casero","Analgésico casero","Suero de rehidratación"]',
    'recipes:["Carga explosiva","Analgésico casero","Suero de rehidratación","Destilar alcohol"]')
rep('recipes:["Ración de campo","Caldo medicinal","Suero de rehidratación"]',
    'recipes:["Ración de campo","Caldo medicinal","Suero de rehidratación","Carne curada"]')
rep('recipes:["Destilador de agua","Barricada de madera","Trampa de caza"]',
    'recipes:["Destilador de agua","Barricada de madera","Trampa de caza","Recuperar chatarra"]')
rep('recipes:["Barricada de madera","Antorcha","Mochila improvisada","Rasgar trapos"]',
    'recipes:["Barricada de madera","Antorcha","Mochila improvisada","Rasgar trapos","Aguja e hilo"]')
# Partidas guardadas con los nombres antiguos
rep('function nm(a){const r=nm0(a);return r?urRepair(r):null}', 'function nm(a){const r=nm0(a);return r?urRepair(urFixRecipes(r)):null}')

JS = r"""
function urRnd(x,r){const f=Math.floor(x);return f+((r??Math.random)()<x-f?1:0)}
function urShelterOf(a){const u=a.urShelter;return urAtBase(a)||(u&&typeof u=="object"&&u.zone===a.map?.currentZone?!!u.v:Os(a.map))}
function urRegen(st,h,resting,atBase){const c=st.counters??{},n=st.needs;
if(!(h>0)||st.hp<=0||st.hp>=st.maxHp||n.hunger<=20||n.thirst<=20||(!resting&&n.sleep<=10)||n.temp<34.5||n.temp>39||(st.sanity??100)<=0||(st.diseases||[]).some(x=>x.stage>=1))return c;
const sev=Math.max(0,...(st.injuries||[]).map(x=>x.severity|0)),acc=(c.urRegen??0)+(resting?1+(atBase?.5:0):.2)*(sev>=2?.5:1)*h,w=Math.floor(acc);
w&&(st.hp=Math.min(st.maxHp,st.hp+w));return{...c,urRegen:acc-w}}
function urFixRecipes(st){const m={"Lanza improvisada":"Lanza de madera","Explosivo casero":"Carga explosiva"};return Array.isArray(st.knownRecipes)?{...st,knownRecipes:[...new Set(st.knownRecipes.map(x=>typeof x=="string"&&Object.prototype.hasOwnProperty.call(m,x)?m[x]:x))]}:st}
"""
rep('const im=document.getElementById("root");', JS.strip().replace("\n", "") + 'const im=document.getElementById("root");')

open(dst, "w", encoding="utf8").write(s)
print("ok", len(s))
