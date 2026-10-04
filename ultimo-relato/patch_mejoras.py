"""Mejoras 4, 5 y 8 de la lista de recomendaciones.

Uso: python3 patch_mejoras.py entrada.html salida.html
Se aplica después de patch_jugabilidad.py. Cada reemplazo exige que el texto
original aparezca exactamente una vez, así que falla (sin escribir nada) si
se aplica dos veces o sobre otra build.

4. Menos clima severo: en posapocalipsis pasa del 34 % al 18 % de los cambios
   de tiempo, en ciencia ficción del 44 % al 20 % y en fantasía del 20 % al 15 %
   (terror, 12 %, y misterio, 4 %, se quedan igual). A las 20:00 el juego avisa
   si mañana llega clima severo, y la IA recibe el pronóstico para anunciarlo.
5. Más agua y un refugio que produce solo: el huerto y la recogida de agua
   producen con el paso del tiempo, estés o no en el refugio (antes solo al
   volver después de días fuera). Estar en el refugio cuenta como visita, así
   que el saqueo solo se comprueba por los días que de verdad estuviste fuera.
   La lluvia a la intemperie llena un recipiente de agua sin tratar cada 3 h.
8. Si recargas la página mientras el narrador escribe, la acción vuelve a la
   caja de texto en lugar de perderse.
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


# ---------------------------------------------------------------- 4. clima
rep('weather:{clear:34,overcast:16,rain:8,fog:8,acid_rain:8,ashstorm:10,heatstorm:7,electric:5,tornado:2,blizzard:2}',
    'weather:{clear:42,overcast:22,rain:10,fog:8,acid_rain:4,ashstorm:5,heatstorm:4,electric:3,tornado:1,blizzard:1}')
rep('weather:{clear:34,overcast:18,rain:14,fog:14,blizzard:8,electric:7,tornado:2,heatstorm:3}',
    'weather:{clear:37,overcast:20,rain:14,fog:14,blizzard:6,electric:5,tornado:1,heatstorm:3}')
rep('weather:{clear:30,overcast:14,fog:12,ashstorm:14,electric:12,heatstorm:8,blizzard:6,acid_rain:4}',
    'weather:{clear:46,overcast:20,fog:14,ashstorm:6,electric:5,heatstorm:4,blizzard:3,acid_rain:2}')
rep('L.push(urPaceLine(a));return L}',
    '{const t=urTomorrow(a);t&&Sn[t].severe&&L.push(`PRONÓSTICO: mañana llega ${Sn[t].label.toLowerCase()}. Si encaja, que se note antes (el cielo, los animales, la gente buscando refugio).`)}L.push(urPaceLine(a));return L}')

# ---------------------------------------------------------------- 5. agua y refugio
# La producción pasa a calcularse con el tiempo (urBaseTick); al volver ya no se cuenta otra vez.
rep('if(a.base.structures.includes("huerto")&&f>=2){', 'if(!1&&a.base.structures.includes("huerto")&&f>=2){')
rep('if(a.base.structures.includes("pozo")&&f>=1){', 'if(!1&&a.base.structures.includes("pozo")&&f>=1){')
rep('st.counters=urRegen(st,h,s.resting,atBase);const d0=mn(a.minutes),d1=mn(st.minutes);',
    'st.counters=urRegen(st,h,s.resting,atBase);urBaseTick(st,m);urRainTick(st,l,opt,m);urWeatherWarn(a,st,m);const d0=mn(a.minutes),d1=mn(st.minutes);')

# ---------------------------------------------------------------- 8. acción pendiente al recargar
rep('f("thinking"),h(null),T.current=q;', 'f("thinking"),h(null),T.current=q;q&&!K&&urSetPending(q,H??P.current);')
rep('g(tn.suggestions),f("idle");', 'urSetPending(null),g(tn.suggestions),f("idle");')
rep('[y,g]=V.useState(""),b=V.useRef(null),w=V.useRef(null)', '[y,g]=V.useState(()=>urTakePending(l)),b=V.useRef(null),w=V.useRef(null)')

JS = r"""
function urTomorrow(a){return a.weather?.daysLeft>1?a.weather.id:a.forecast?.[0]??null}
function urWeatherWarn(a,st,m){const k=x=>Math.floor((x-1200)/1440);if(k(a.minutes)>=k(st.minutes))return;const t=urTomorrow(st);if(!t||!Sn[t]?.severe)return;m.push({kind:"warn",text:t===st.weather.id?`${Sn[t].icon} Mañana seguirá ${Sn[t].label.toLowerCase()}. Busca un sitio a cubierto.`:`${Sn[t].icon} Se avecina para mañana: ${Sn[t].label.toLowerCase()}. ${Sn[t].desc} Busca un sitio a cubierto antes de que empiece.`})}
function urBaseTick(st,m){const b=st.base;if(!b?.established)return;const c={...st.counters};let stor=b.storage,ch=!1;for(const[k,per,item,cap,txt]of[["pozo",1440,"Agua (500ml)",6,n=>`💧 La recogida de agua del refugio ha llenado ${n} ${n===1?"cantimplora":"cantimploras"}.`],["huerto",2880,"Lata de comida",4,n=>`🌱 El huerto del refugio ha dado ${n} ${n===1?"ración":"raciones"}.`]]){if(!b.structures.includes(k))continue;const key="urProd_"+k,t=c[key];if(t==null){c[key]=st.minutes;ch=!0;continue}const n=Math.floor((st.minutes-t)/per);if(n<1)continue;c[key]=t+n*per;ch=!0;const add=Math.max(0,Math.min(n,cap-Je(stor,item)));add>0&&(stor=xt(stor,[{name:item,qty:add}]),m.push({kind:"good",text:txt(add)}))}const here=urAtBase(st);(here||stor!==b.storage)&&(st.base={...b,storage:stor,lastVisited:here?st.minutes:b.lastVisited});ch&&(st.counters=c)}
function urRainTick(st,l,opt,m){if(st.weather?.id!=="rain"||(opt.sheltered??urShelterOf(st))){return}const c={...st.counters},acc=(c.urRain??0)+l,n=Math.floor(acc/180);c.urRain=acc-n*180;st.counters=c;n>0&&(st.inventory=xt(st.inventory,[{name:"Agua sin tratar",qty:n}]),m.push({kind:"good",text:`🌧️ Recoges agua de lluvia: Agua sin tratar${n>1?` ×${n}`:""}.`}))}
function urSetPending(t,a){try{t?localStorage.setItem("ultimo-relato:pendiente",JSON.stringify({t,n:a?.charName,m:a?.minutes})):localStorage.removeItem("ultimo-relato:pendiente")}catch{}}
function urTakePending(a){try{const p=JSON.parse(localStorage.getItem("ultimo-relato:pendiente")||"null");localStorage.removeItem("ultimo-relato:pendiente");return p&&typeof p.t=="string"&&p.n===a?.charName&&p.m===a?.minutes?p.t.slice(0,500):""}catch{return""}}
"""
rep('const im=document.getElementById("root");', JS.strip().replace("\n", "") + 'const im=document.getElementById("root");')

open(dst, "w", encoding="utf8").write(s)
print("ok", len(s))
