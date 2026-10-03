"""Mecánicas nuevas: cordura, luz, desgaste, director de ritmo, compañeros,
trueque, escasez, libros y fichas de memoria.

Uso: python3 patch_mecanicas.py entrada.html salida.html
Se aplica después de patch_interfaz.py, patch_accesibilidad.py y patch_robustez.py.
Cada reemplazo exige que el texto original aparezca las veces indicadas, así que
falla (sin escribir nada) si se aplica dos veces o sobre otra build.
"""
import sys

src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf8").read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        sys.exit(f"Esperaba {n} coincidencia(s) y hay {c}: {old[:80]}")
    s = s.replace(old, new)


# --- Estado nuevo y partidas guardadas --------------------------------------
rep("deathCause:null,savedAt:null}", 'deathCause:null,savedAt:null,sanity:100,companions:[],lore:[],trade:null,pace:"clasico"}')
rep(
    "const items=x=>A(x).filter(i=>i&&S(i.name)&&N(i.qty,0)>=1).map(i=>({name:i.name.slice(0,60),qty:Math.min(999,Math.round(i.qty))}));",
    "const items=x=>A(x).filter(i=>i&&S(i.name)&&N(i.qty,0)>=1).map(i=>({name:i.name.slice(0,60),qty:Math.min(999,Math.round(i.qty)),...(N(i.cond,-1)>=0?{cond:Math.min(100,i.cond)}:{})}));",
)
rep(
    'stats:{...Xn.stats,...Object.fromEntries(Object.entries(O(r.stats)).filter(([,v])=>typeof v=="number"))}}',
    'stats:{...Xn.stats,...Object.fromEntries(Object.entries(O(r.stats)).filter(([,v])=>typeof v=="number"))},...urRepairExtra(r)}',
)

# --- Motor: envoltorios del paso del tiempo, del turno y del reductor --------
rep("function It(a,l,s){", "function It0(a,l,s){")
rep("function Dh(a,l,s,c){", "function Dh0(a,l,s,c){")
rep("function Ms(a,l){switch(l.type){", "function Ms0(a,l){switch(l.type){")
rep("case\"applyTurn\":return Dh(a,l.playerText,l.result,l.rng??vt);", "case\"applyTurn\":return Dh(a,l.playerText,l.result,l.rng??vt,l.roll);")
rep('type:"applyTurn",playerText:q,result:tn,rng:wt.fork()', 'type:"applyTurn",playerText:q,result:tn,rng:wt.fork(),roll:ie', n=2)
#    Penalizaciones por cordura y bonos de compañeros.
rep("s(c,d);return l}function If(", "s(c,d);urPen(a,s);return l}function If(")
#    Dificultad: oscuridad sin luz y mundo más hostil con los días.
rep("function Hh(a){return 8+(Dn(a.map)?.danger??2)*2}", "function Hh(a){return 8+(Dn(a.map)?.danger??2)*2+urHarder(a)}")
#    Libros: multiplicador de experiencia.
rep("function Rs(a,l,s){", "function Rs(a,l,s,u){")
rep("const h=s===\"model\"?se(Math.round(m),0,5)*50:Math.max(0,Math.round(m))*25;",
    "const h=(s===\"model\"?se(Math.round(m),0,5)*50:Math.max(0,Math.round(m))*25)*(u?.[f]??1);")
rep('Rs(a.skillXp,s.skillXp,"model")', 'Rs(a.skillXp,s.skillXp,"model",urBookMul(a))')
rep('Rs(a.skillXp,h,"recipe")', 'Rs(a.skillXp,h,"recipe",urBookMul(a))')
rep('Rs(a.skillXp,k,"recipe")', 'Rs(a.skillXp,k,"recipe",urBookMul(a))')
rep('Rs(a.skillXp,{[s.req.skill]:6},"recipe")', 'Rs(a.skillXp,{[s.req.skill]:6},"recipe",urBookMul(a))')
#    Causa de muerte por cordura.
rep('if(a.needs.temp>=40)return"Golpe de calor";', 'if(a.needs.temp>=40)return"Golpe de calor";if((a.sanity??100)<=0)return"Colapso mental";')
#    El estado de los objetos viaja con ellos (mezcla ponderada al juntar montones).
rep(
    "for(const{name:c,qty:d}of l){if(!c||d<=0)continue;const f=s.find(m=>m.name===c);f?f.qty+=d:s.push({name:c,qty:d})}return s}",
    "for(const{name:c,qty:d,cond:k}of l){if(!c||d<=0)continue;const f=s.find(m=>m.name===c);f?((f.cond!=null||k!=null)&&(f.cond=((f.cond??100)*f.qty+(k??100)*d)/(f.qty+d)),f.qty+=d):s.push(k!=null?{name:c,qty:d,cond:k}:{name:c,qty:d})}return s}",
)
rep("storage:xt(a.base.storage,[{name:l.name,qty:s}])", "storage:xt(a.base.storage,[{name:l.name,qty:s,cond:a.inventory.find(x=>x.name===l.name)?.cond}])")
rep("inventory:xt(a.inventory,[{name:l.name,qty:s}])", "inventory:xt(a.inventory,[{name:l.name,qty:s,cond:a.base.storage.find(x=>x.name===l.name)?.cond}])")

# --- Catálogo ---------------------------------------------------------------
rep('Linterna:{kg:.4,l:.5,tags:["tool","light","electronic"]},',
    'Linterna:{kg:.4,l:.5,tags:["tool","light","electronic"]},Pilas:{kg:.1,l:.05,tags:["electronic"],use:{minutes:2,verb:"Cambiar las pilas",urRecharge:!0},desc:"Devuelven la vida a una linterna gastada."},')
rep('Biblia:{kg:.5,l:.6,tags:["book"]}', 'Biblia:{kg:.5,l:.6,tags:["book"],use:{sanity:10,minutes:60,verb:"Leer",consumed:!1}}')
rep('use:{hp:-3,sleep:10,temp:.3,minutes:5,verb:"Beber"}}', 'use:{hp:-3,sleep:10,temp:.3,sanity:8,minutes:5,verb:"Beber"}}')
rep('"Manual de medicina":{kg:.6,l:.8,tags:["book"]}', '"Manual de medicina":{kg:.6,l:.8,tags:["book"],urBook:["Primeros auxilios"]}')
rep('"Manual de ingeniería":{kg:.7,l:.9,tags:["book"]}', '"Manual de ingeniería":{kg:.7,l:.9,tags:["book"],urBook:["Mecánica","Electricidad"]}')
rep('Morfina:"Adormidera"}', 'Morfina:"Adormidera",Pilas:"Aceite para el farol"}')
rep('"Herramientas básicas":"Multiherramienta de servicio"}', '"Herramientas básicas":"Multiherramienta de servicio",Pilas:"Célula de energía"}')
#    Los libros nuevos que invente la IA pueden enseñar una habilidad.
rep("materials:Object.keys(S).length?S:void 0,improvised:!0})",
    "materials:Object.keys(S).length?S:void 0,improvised:!0,skill:Zn.find(z=>On(z)===On(Te(f.skill)))})")

# --- IA: lo que se le cuenta, lo que se le pide y cómo se lee -----------------
rep("`REFUGIO: ${z}.`,", "`REFUGIO: ${z}.`,...urPromptLines(a),")
rep(
    'return`${vr(T.name,a.genre)}${T.qty>1?` ×${T.qty}`:""}${D}`',
    'return`${vr(T.name,a.genre)}${T.qty>1?` ×${T.qty}`:""}${D}${T.cond!=null&&T.cond<100?` (estado ${Math.round(T.cond)} %)`:""}${urBookSkills(T.name,a.customItems).length?` [libro: aprende el doble de ${urBookSkills(T.name,a.customItems).join(" y ")}]`:""}`',
)
rep('...hh(a),"","FORMATO:', '...urRules(a),...hh(a),"","FORMATO:')
rep(
    '"recipesLearned": ["nombre exacto de una receta del listado de las que aún no conoce"],\n  "sheltered": false\n}',
    '"recipesLearned": ["nombre exacto de una receta del listado de las que aún no conoce"],\n  "sanityChange": 0,\n  "companionsUpdate": [],\n  "tradeOffer": null,\n  "loreUpdate": [],\n  "sheltered": false\n}',
)
rep(
    "recipesLearned:Sh(d.recipesLearned)},fallbackNarrative:null}",
    "recipesLearned:Sh(d.recipesLearned),sanityChange:se(Math.round(Ze(d.sanityChange)),-20,20),companionsUpdate:urParseComp(d.companionsUpdate),tradeOffer:urParseTrade(d.tradeOffer,h),loreUpdate:urParseLore(d.loreUpdate)},fallbackNarrative:null}",
)
rep("try{ae=gh(A)}", "try{ae=gh(A)+urLoreBlock(A,q)}")

# --- Interfaz -----------------------------------------------------------------
rep('o.jsx(Dt,{label:"Sueño",icon:"😴",value:a.needs.sleep,critAt:20,warnAt:50,color:"var(--ok)"}),',
    'o.jsx(Dt,{label:"Sueño",icon:"😴",value:a.needs.sleep,critAt:20,warnAt:50,color:"var(--ok)"}),o.jsx(Dt,{label:"Cordura",icon:"🧠",value:a.sanity??100,critAt:20,warnAt:40,color:"var(--ok)"}),')
rep('["Sueño","😴",a.needs.sleep]]', '["Sueño","😴",a.needs.sleep],["Cordura","🧠",a.sanity??100]]')
rep(".vitalbar__inner{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))", ".vitalbar__inner{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))")
rep('children:["×",k.qty]}),o.jsx("span",{className:"inv__weight",children:Xo(S.kg*k.qty)})',
    'children:["×",k.qty]}),k.cond!=null&&k.cond<100&&o.jsx("span",{className:"inv__cond","data-low":k.cond<30,title:"Estado",children:Math.round(k.cond)+" %"}),o.jsx("span",{className:"inv__weight",children:Xo(S.kg*k.qty)})', n=2)
rep('o.jsx(bt,{title:"Mochila",action:', 'o.jsx(urExtras,{api:a,onOpen:l}),o.jsx(bt,{title:"Mochila",action:')
rep('f==="saves"&&o.jsx(sm,{api:a,onClose:g})', 'f==="saves"&&o.jsx(sm,{api:a,onClose:g}),f==="urtrade"&&o.jsx(urTrade,{api:a,onClose:g})')
rep('!f&&o.jsxs("div",{className:"notice notice--warn",style:{marginTop:20}', 'o.jsx(urPacePicker,{state:s,dispatch:c,h:"h2"}),!f&&o.jsxs("div",{className:"notice notice--warn",style:{marginTop:20}')
rep('o.jsxs("section",{children:[o.jsx("h3",{className:"u-eyebrow",style:{marginBottom:12},children:"Experiencia"})',
    'd.screen==="game"&&o.jsx("section",{style:P,children:o.jsx(urPacePicker,{state:d,dispatch:f})}),o.jsxs("section",{children:[o.jsx("h3",{className:"u-eyebrow",style:{marginBottom:12},children:"Experiencia"})')
rep('const urBlock=new Set([', 'const urBlock=new Set(["urTrade","urFeed",')

# --- Código nuevo ---------------------------------------------------------------
HELPERS = r"""
const urOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function urNorm(t){return String(t??"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function urName(x,n){const t=typeof x=="string"?x.trim().replace(/\s+/g," ").slice(0,n):"";return t.length>=2&&!urBad(t)?t:null}
function urNight(m){const h=Math.floor(m/60)%24;return h>=21||h<6}
function urAtBase(a){return!!(a.base?.established&&a.map.currentZone===a.base.location)}
function urAtBaseWith(a,k){return urAtBase(a)&&a.base.structures.includes(k)}
function urDark(a){return urAtBaseWith(a,"generador")?!1:urNight(a.minutes)||Dn(a.map)?.type==="underground"}
function urLightKind(n,ci){const t=en(n,ci).tags||[];return t.includes("light")?(t.includes("electronic")?"bat":"fire"):null}
function urLightItem(a){let b=null;for(const i of a.inventory){const k=urLightKind(i.name,a.customItems);if(!k||(i.cond??100)<=0)continue;if(k==="bat")return{item:i,kind:k};b=b||{item:i,kind:k}}return b}
function urHasLight(a){return!!urLightItem(a)}
function urScarcity(a){return Math.min(.6,Math.max(0,(mn(a.minutes)-3)*.04))}
function urHarder(a){const d=mn(a.minutes);return(urDark(a)&&!urHasLight(a)?2:0)+(d>=15?2:d>=8?1:0)}
const urDecay={"Caldo caliente":2,"Carne curada":.2,"Suero oral":1};
const urKeeps=/lata|conserva|enlatad|raci[oó]n|barrita|galleta|curad|ahumad|miel|az[uú]car|arroz|legumbre|pasta|sal\b|seca?\b/i;
function urDecayRate(n,ci){if(urOwn(urDecay,n))return urDecay[n];if(urOwn(el,n))return 0;const d=en(n,ci);return(d.tags||[]).includes("food")&&!urKeeps.test(n)?.6:0}
const urWeaponSkills={"Hoja corta":["Cuchillo","Navaja multiusos"],"Hoja larga":["Machete"],Hacha:["Hacha de mano"],Contundente:["Bate de béisbol","Pico"],Lanza:["Lanza improvisada"]};
function urWearItem(inv,n,amt,msgs,txt){const i=inv.findIndex(x=>x.name===n);if(i<0)return inv;const s=[...inv],it={...s[i]};it.cond=(it.cond??100)-amt;if(it.cond>0){s[i]=it;return s}msgs.push({kind:"bad",text:txt});if(it.qty>1){it.qty-=1;it.cond=100;s[i]=it}else s.splice(i,1);return s}
function urBurn(inv,n,amt,msgs,label){const i=inv.findIndex(x=>x.name===n);if(i<0)return inv;const s=[...inv],it={...s[i]};let c=(it.cond??100)-amt,u=0;while(c<=0&&it.qty>0){it.qty-=1;c+=100;u++}u&&msgs.push({kind:"warn",text:`Se ${u>1?`te han consumido ${u} unidades de`:"te ha consumido"} ${label.toLowerCase()}.`});if(it.qty<=0){s.splice(i,1);return s}it.cond=c;s[i]=it;return s}
function urRot(list,h,ci,msgs,where){return list.flatMap(x=>{const r=urDecayRate(x.name,ci);if(!r)return[x];const c=(x.cond??100)-r*h;if(c<=0){msgs.push({kind:"bad",text:`Se ${where?"ha echado a perder en el refugio":"te ha echado a perder"}: ${x.name}.`});return[]}return[{...x,cond:Math.round(c*10)/10}]})}
function It(a,l,s){const r=It0(a,l,s);try{return urTick(a,r,l,s||{})}catch(e){return console.error(e),r}}
function urTick(a,r,l,opt){const h=l/60;if(!(h>0))return r;const s={...opt,resting:opt.resting||(opt.needsDelta?.sleep??0)>=20},st={...r.state},m=r.messages,mid={...st,minutes:a.minutes+l/2},dark=urDark(mid);let inv=st.inventory,lit=!1;
if(dark&&!s.resting){const L=urLightItem({...st,inventory:inv});if(L){lit=!0;const lb=vr(L.item.name,st.genre);if(L.kind==="bat"){const i=inv.findIndex(x=>x.name===L.item.name),b=inv[i].cond??100,c=Math.max(0,b-8*h);inv=[...inv];inv[i]={...inv[i],cond:Math.round(c*10)/10};c<=0&&m.push({kind:"warn",text:`${lb}: se ha agotado. Necesitas pilas.`})}else inv=urBurn(inv,L.item.name,66*h,m,lb)}}
inv=urRot(inv,h,st.customItems,m,!1);st.inventory=inv;
st.base?.storage?.length&&(st.base={...st.base,storage:urRot(st.base.storage,h,st.customItems,m,!0)});
const atBase=urAtBase(st),danger=Dn(st.map)?.danger??1,comp=st.companions||[];let loss=0,gain=0;
dark&&!lit&&!s.resting&&(loss+=3*h);danger>=4&&(loss+=2*h);s.resting&&(gain+=1.5*h+(atBase?1.5*h:0));comp.length&&(gain+=h);
const tm=(st.traits.includes("valiente")?.75:1)*(st.traits.includes("cobarde")?1.25:1)*(st.genre==="horror"?1.5:1),s0=st.sanity??100,s1=se(s0-loss*tm+gain,0,100);
s0>=40&&s1<40&&m.push({kind:"warn",text:"Te tiemblan las manos y cuesta pensar con claridad (cordura baja)."});
s0>=20&&s1<20&&m.push({kind:"bad",text:"Empiezas a ver cosas que no están ahí (cordura muy baja)."});
st.sanity=Math.round(s1*10)/10;s1<=0&&(st.hp=se(st.hp-Math.max(1,Math.round(2*h)),0,st.maxHp),m.push({kind:"bad",text:"Tu mente se está rompiendo y el cuerpo lo paga."}));
if(comp.length){const out=[];for(const c0 of comp){const c={...c0};c.hunger=se(c.hunger-2*h*(s.resting?.4:1),0,100);c.hunger<=0&&(c.hp-=2*h,c.morale-=2*h);danger>=3&&(c.morale-=.5*h);s.resting&&atBase&&(c.morale+=h);st.sanity<30&&(c.morale-=.5*h);s.resting&&c.hunger>50&&(c.hp+=.5*h);c.hp=se(Math.round(c.hp*10)/10,0,100);c.morale=se(Math.round(c.morale*10)/10,0,100);c.hunger=Math.round(c.hunger*10)/10;
if(c.hp<=0){m.push({kind:"bad",text:`${c.name} ha muerto.`});st.sanity=se(st.sanity-20,0,100);continue}if(c.morale<=0){m.push({kind:"bad",text:`${c.name} ha perdido la fe en ti y se marcha.`});continue}out.push(c)}st.companions=out}
const d0=mn(a.minutes),d1=mn(st.minutes);d0<8&&d1>=8&&m.push({kind:"warn",text:"Han pasado días: quedan menos cosas que encontrar y el mundo se vuelve más hostil."});d0<15&&d1>=15&&m.push({kind:"warn",text:"El mundo está cada vez más vacío. Cada hallazgo cuenta."});
return{state:st,messages:m}}
function urScarce(a,items,rng){const e=urScarcity(a);return e?items.map(i=>{const v=i.qty*(1-e),f=Math.floor(v);return{...i,qty:f+(rng()<v-f?1:0)}}).filter(i=>i.qty>0):items}
function Dh(a,l,s,c,roll){s={...s,itemsGained:urScarce(a,s.itemsGained||[],c)};const st=Dh0(a,l,s,c);if(st.screen==="death")return st;try{return urAfterTurn(a,st,s,roll)}catch(e){return console.error(e),st}}
function urAfterTurn(a,st0,s,roll){const st={...st0},m=[],sc=s.sanityChange||0;
if(sc){st.sanity=se((st.sanity??100)+sc,0,100);Math.abs(sc)>=5&&m.push({kind:sc<0?"warn":"good",text:sc<0?`Lo que has visto te pesa (cordura ${sc}).`:`Algo te devuelve la calma (cordura +${sc}).`})}
let comp=[...(st.companions||[])];
for(const u of s.companionsUpdate||[]){const i=comp.findIndex(c=>urNorm(c.name)===urNorm(u.name));
if(u.action==="join"){i<0&&comp.length<2?(comp.push({id:Go("c"),name:u.name,role:u.role||"superviviente",skill:u.skill||null,hp:100,hunger:70,morale:60,day:mn(st.minutes)}),m.push({kind:"good",text:`${u.name} se une a ti${u.skill?` (sabe de ${u.skill.toLowerCase()})`:""}.`})):i<0&&m.push({kind:"system",text:`${u.name} querría acompañarte, pero no puedes cuidar de más gente.`});continue}
if(i<0)continue;const c={...comp[i]};
if(u.action==="leave"){comp.splice(i,1);m.push({kind:"warn",text:`${c.name} se separa de ti.`});continue}
c.hp=se(c.hp+(u.hpChange||0),0,100);c.morale=se(c.morale+(u.moraleChange||0),0,100);
if(u.action==="die"||c.hp<=0){comp.splice(i,1);st.sanity=se((st.sanity??100)-20,0,100);m.push({kind:"bad",text:`${c.name} ha muerto.`});continue}
(u.hpChange||0)<0&&m.push({kind:"bad",text:`${c.name} está herido (${Math.round(c.hp)} de vida).`});comp[i]=c}
st.companions=comp;
st.trade=s.tradeOffer?.items?.length?{trader:s.tradeOffer.trader,items:s.tradeOffer.items}:null;st.trade&&m.push({kind:"system",text:`🤝 ${st.trade.trader} ofrece un trueque. Ábrelo con «Comerciar».`});
if((s.loreUpdate||[]).length){let lo=[...(st.lore||[])];for(const f of s.loreUpdate){const i=lo.findIndex(x=>urNorm(x.name)===urNorm(f.name)),e={name:f.name,kind:f.kind,text:f.text,day:mn(st.minutes)};i>=0?lo.splice(i,1,e):lo.push(e)}st.lore=lo.slice(-40)}
const bad=(s.hpChange||0)<0||(s.injuriesUpdate||[]).some(x=>x.action==="add")||(s.diseasesUpdate||[]).some(x=>x.action==="add")||st.hp<a.hp-5;
st.counters={...st.counters,urCalm:bad?0:(a.counters?.urCalm??0)+1,urLoss:Math.max(0,a.hp-st.hp)};
if(roll&&urOwn(urWeaponSkills,roll.skill)){const w=urWeaponSkills[roll.skill].find(n=>st.inventory.some(i=>i.name===n));w&&(st.inventory=urWearItem(st.inventory,w,roll.outcome==="pifia"||roll.outcome==="fallo"?10:5,m,`Se te rompe: ${vr(w,st.genre)}.`))}
return Ot(m.length?Ce(st,m):st)}
function urPen(a,add){const v=a.sanity??100,p=v<20?2:v<40?1:0;if(p)for(const k of Zn)add(k,p);for(const c of a.companions||[])c.skill&&Zn.includes(c.skill)&&add(c.skill,-1)}
function urBookSkills(n,ci){const d=en(n,ci);return Array.isArray(d.urBook)?d.urBook:(d.tags||[]).includes("book")&&Zn.includes(d.skill)?[d.skill]:[]}
function urBookMul(a){const r={};for(const i of a.inventory||[])for(const k of urBookSkills(i.name,a.customItems))Ut(a.skillXp?.[k]??0)<6&&(r[k]=2);return r}
const urTagVal={cure:8,weapon:8,medical:6,electronic:5,container:5,ammo:4,tool:4,light:3,food:3,clothing:3,book:3,water:2,fire:2,craft:1,junk:.5};
function urValue(n,ci,c){let v=1;for(const k of en(n,ci).tags||[])v=Math.max(v,urTagVal[k]??0);return Math.max(.5,Math.round(v*(.3+.7*((c??100)/100))*2)/2)}
function urPrice(n,ci){return Math.round(urValue(n,ci)*1.5*2)/2}
function Ms(a,l){switch(l.type){
case"startRun":{const r=Ms0(a,l);return r.screen==="game"?{...r,pace:a.pace||"clasico"}:r}
case"urSetPace":return["clasico","tranquilo","caotico"].includes(l.pace)?{...a,pace:l.pace}:a;
case"useItem":{const u=en(l.name,a.customItems).use;if(u?.urRecharge&&!a.inventory.some(x=>urLightKind(x.name,a.customItems)==="bat"))return Ce(a,[{kind:"warn",text:"No llevas nada donde poner las pilas."}]);const r=Ms0(a,l);return r===a?r:urAfterUse(a,r,l)}
case"urFeed":return urFeed(a,l);
case"urTrade":return urTradeDo(a,l);
default:return Ms0(a,l)}}
function urAfterUse(a,r,l){const d=en(l.name,a.customItems),u=d.use||{},m=[],st={...r};
u.sanity&&(st.sanity=se((st.sanity??100)+u.sanity,0,100),m.push({kind:"good",text:`Te calma un poco (cordura +${u.sanity}).`}));
if(u.urRecharge){const i=st.inventory.findIndex(x=>urLightKind(x.name,st.customItems)==="bat");if(i>=0){st.inventory=[...st.inventory];st.inventory[i]={...st.inventory[i],cond:100};m.push({kind:"good",text:`${vr(st.inventory[i].name,st.genre)}: carga nueva.`})}}
const pc=a.inventory.find(x=>x.name===l.name)?.cond;
(d.tags||[]).includes("food")&&pc!=null&&pc<30&&!st.diseases.some(x=>x.id==="food_poison")&&Math.random()<.4&&(st.diseases=[...st.diseases,{id:"food_poison",stage:0,ticks:0}],m.push({kind:"bad",text:"Estaba en mal estado y te sienta fatal: intoxicación."}));
return m.length?Ot(Ce(st,m)):st}
function urFeed(a,l){const i=(a.companions||[]).findIndex(c=>c.id===l.id);if(i<0)return a;let best=null,bv=0;for(const x of a.inventory){const u=en(x.name,a.customItems).use;(u?.hunger??0)>bv&&(bv=u.hunger,best=x)}if(!best)return Ce(a,[{kind:"warn",text:"No tienes comida que darle."}]);
const c={...a.companions[i],hunger:se(a.companions[i].hunger+bv,0,100),morale:se(a.companions[i].morale+5,0,100)},comp=[...a.companions];comp[i]=c;
const t=It({...a,inventory:qn(a.inventory,[{name:best.name,qty:1}]),companions:comp},5,{rng:vt});return Ot(Ce(t.state,[{kind:"good",text:`Compartes ${best.name.toLowerCase()} con ${c.name}.`},...t.messages]))}
function urTradeDo(a,l){const t=a.trade;if(!t)return a;const give=(l.give||[]).filter(g=>g.qty>0),get=(l.get||[]).filter(g=>g.qty>0);if(!give.length||!get.length)return a;
for(const g of give)if(Je(a.inventory,g.name)<g.qty)return Ce(a,[{kind:"warn",text:`No tienes ${g.name} ×${g.qty}.`}]);
for(const g of get)if((t.items.find(x=>x.name===g.name)?.qty??0)<g.qty)return a;
const ci=a.customItems,gv=give.reduce((x,g)=>x+urValue(g.name,ci,a.inventory.find(y=>y.name===g.name)?.cond)*g.qty,0),pv=get.reduce((x,g)=>x+urPrice(g.name,ci)*g.qty,0);
if(gv<pv)return Ce(a,[{kind:"warn",text:`${t.trader} no acepta: ofreces ${gv} y pide ${pv}.`}]);
const items=t.items.map(x=>{const g=get.find(y=>y.name===x.name);return g?{...x,qty:x.qty-g.qty}:x}).filter(x=>x.qty>0),r=It({...a,inventory:xt(qn(a.inventory,give),get),trade:items.length?{...t,items}:null},15,{rng:vt});
return Ot(Ce(r.state,[{kind:"good",text:`Cambias ${give.map(g=>`${g.name} ×${g.qty}`).join(", ")} por ${get.map(g=>`${g.name} ×${g.qty}`).join(", ")}.`},...r.messages]))}
const urPaces=[{id:"clasico",label:"Clásico",icon:"📈",desc:"La tensión sube poco a poco, con respiros después de los golpes fuertes."},{id:"tranquilo",label:"Tranquilo",icon:"🌿",desc:"Mucho tiempo entre desastres para explorar y construir."},{id:"caotico",label:"Caótico",icon:"🎲",desc:"Cualquier cosa puede pasar en cualquier momento."}];
function urPaceLine(a){const p=a.pace||"clasico",d=mn(a.minutes),calm=a.counters?.urCalm??0,loss=a.counters?.urLoss??0,hp=a.hp/(a.maxHp||100),lv=d<=3?"baja":d<=7?"media":"alta";
if(p==="caotico"){const r=Math.random();return r<.3?`RITMO: introduce ahora una complicación seria e inesperada (intensidad ${lv}).`:r<.5?"RITMO: este turno, nada nuevo y grave: un respiro.":"RITMO: deja que la escena siga su curso."}
const t=p==="tranquilo";if(loss>=(t?10:15)||hp<(t?.5:.35))return"RITMO: acaba de recibir un golpe fuerte. No añadas amenazas nuevas este turno: dale un respiro.";
if(calm>=(t?8:4))return`RITMO: lleva ${calm} turnos tranquilos. Introduce una amenaza o un problema serio (intensidad ${t?(lv==="alta"?"media":"baja"):lv}).`;
return"RITMO: mantén la tensión propia de la escena, sin forzar sucesos."}
function urPromptLines(a){const L=[],v=a.sanity??100,lt=urLightItem(a),dk=urDark(a),e=urScarcity(a),c=a.companions||[];
L.push(`CORDURA: ${Math.round(v)}/100${v<20?" — al borde: alucina y desconfía de todo":v<40?" — muy afectado: le tiemblan las manos":""}.`);
L.push(dk?lt?`LUZ: está oscuro; se alumbra con ${vr(lt.item.name,a.genre)}.`:"LUZ: VA A OSCURAS. Apenas ve: todo le cuesta más y da más miedo.":"LUZ: hay luz suficiente.");
L.push(`MUNDO: día ${mn(a.minutes)}, escasez ${Math.round(e*100)} %${e>0?": los sitios ya están muy saqueados; los hallazgos son pocos y pequeños":""}.`);
L.push(`COMPAÑEROS: ${c.length?c.map(x=>`${x.name} (${x.role}${x.skill?`, ${x.skill}`:""}; vida ${Math.round(x.hp)}, hambre ${Math.round(x.hunger)}, ánimo ${Math.round(x.morale)})`).join("; "):"ninguno, va solo"}.`);
a.trade&&L.push(`TRUEQUE ABIERTO con ${a.trade.trader}: ofrece ${a.trade.items.map(x=>`${x.name}×${x.qty}`).join(", ")}.`);
L.push(urPaceLine(a));return L}
function urRules(){return['13. CORDURA: usa "sanityChange" (de -20 a +20) solo para sucesos que asusten o reconforten de verdad. Si la cordura es baja, que se note en la narración.','14. COMPAÑEROS: "companionsUpdate" es [] casi siempre. Solo si alguien se une de verdad (como mucho 2 compañeros), se va, resulta herido o muere: [{"name","action":"join|leave|hurt|heal|die","role","skill":"una habilidad del juego","hpChange","moraleChange"}]. Los compañeros actúan, opinan y necesitan comer.','15. TRUEQUE: "tradeOffer" es null salvo que alguien en la escena quiera comerciar: {"trader":"nombre","items":[{"name","qty"}]} con 2 a 4 objetos (decláralos en newItems si son nuevos). El intercambio lo resuelve el juego, no tú.','16. FICHAS: "loreUpdate" guarda lo que importa recordar de personas, lugares y grupos con nombre propio: [{"name","kind":"persona|lugar|grupo|objeto","text":"1-2 frases"}]. Úsalo cuando aparezca alguien o algo nuevo y relevante, o cuando cambie lo que se sabe. Respeta siempre las FICHAS que recibas.','17. LIBROS: un libro nuevo puede llevar "skill" (una habilidad) en newItems; mientras lo lleve, aprende el doble de esa habilidad hasta el nivel 5.','18. RITMO: sigue la indicación de RITMO del estado actual.']}
function urParseComp(x){if(!Array.isArray(x))return[];const r=[];for(const c of x.slice(0,2)){if(!c||typeof c!="object")continue;const n=urName(c.name,30),ac=["join","leave","hurt","heal","die"].includes(c.action)?c.action:null;if(!n||!ac)continue;r.push({name:n,action:ac,role:urName(c.role,30)||"",skill:typeof c.skill=="string"?Zn.find(z=>On(z)===On(c.skill))??null:null,hpChange:se(Math.round(Ze(c.hpChange)),-50,50),moraleChange:se(Math.round(Ze(c.moraleChange)),-30,30)})}return r}
function urParseTrade(x,known){if(!x||typeof x!="object")return null;const t=urName(x.trader,30);if(!t)return null;const it=Ps(x.items,known,4,!0);return it.length?{trader:t,items:it}:null}
function urParseLore(x){if(!Array.isArray(x))return[];const r=[];for(const f of x.slice(0,3)){if(!f||typeof f!="object")continue;const n=urName(f.name,40),t=typeof f.text=="string"?f.text.trim().slice(0,220):"";n&&t.length>=3&&r.push({name:n,kind:["persona","lugar","grupo","objeto"].includes(f.kind)?f.kind:"persona",text:t})}return r}
function urLoreBlock(a,q){const lo=a.lore||[];if(!lo.length)return"";const src=" "+urNorm([q||"",...a.log.filter(e=>e.kind==="story").slice(-2).map(e=>e.text),a.map.currentZone||"",...(a.companions||[]).map(c=>c.name)].join(" "))+" ",pick=lo.filter(f=>{const k=urNorm(f.name);return k.length>=2&&src.includes(" "+k+" ")}).slice(-6);return pick.length?"\n\nFICHAS (lo que ya se sabe; respétalo):\n"+pick.map(f=>`- ${f.name} (${f.kind}): ${f.text}`).join("\n"):""}
function urRepairExtra(r){const A=x=>Array.isArray(x)?x:[],N=(x,d)=>typeof x=="number"&&Number.isFinite(x)?x:d;
return{sanity:se(N(r.sanity,100),0,100),pace:["clasico","tranquilo","caotico"].includes(r.pace)?r.pace:"clasico",
companions:A(r.companions).filter(c=>c&&urName(c.name,30)).slice(0,2).map(c=>({id:String(c.id??Go("c")),name:urName(c.name,30),role:typeof c.role=="string"?c.role.slice(0,30):"",skill:Zn.includes(c.skill)?c.skill:null,hp:se(N(c.hp,100),0,100),hunger:se(N(c.hunger,70),0,100),morale:se(N(c.morale,60),0,100),day:N(c.day,1)})),
lore:A(r.lore).filter(f=>f&&urName(f.name,40)&&typeof f.text=="string").slice(-40).map(f=>({name:urName(f.name,40),kind:["persona","lugar","grupo","objeto"].includes(f.kind)?f.kind:"persona",text:f.text.slice(0,220),day:N(f.day,1)})),
trade:r.trade&&typeof r.trade=="object"&&urName(r.trade.trader,30)&&Array.isArray(r.trade.items)?{trader:urName(r.trade.trader,30),items:r.trade.items.filter(i=>i&&urName(i.name,60)&&N(i.qty,0)>=1).slice(0,4).map(i=>({name:urName(i.name,60),qty:Math.min(20,Math.round(i.qty))}))}:null}}
function urExtras({api:a,onOpen:l}){const s=a.state,lt=urLightItem(s),dk=urDark(s),e=urScarcity(s),busy=urBusy(a),books=Object.keys(urBookMul(s)),comp=s.companions||[],lore=s.lore||[];
return o.jsxs(bt,{title:"Supervivencia",children:[o.jsxs("div",{className:"ur-x",children:[
o.jsxs("div",{className:"ur-x__row",children:[o.jsx("span",{"aria-hidden":!0,children:dk?lt?"🔦":"🌑":"☀️"}),o.jsx("span",{children:dk?lt?`${vr(lt.item.name,s.genre)}: ${Math.round(lt.item.cond??100)} %`:"A oscuras: las tiradas cuestan más":"Hay luz"})]}),
o.jsxs("div",{className:"ur-x__row",children:[o.jsx("span",{"aria-hidden":!0,children:"🏚️"}),o.jsx("span",{children:e>0?`Escasez ${Math.round(e*100)} %: encuentras menos`:"El mundo aún tiene recursos"})]}),
books.length>0&&o.jsxs("div",{className:"ur-x__row",children:[o.jsx("span",{"aria-hidden":!0,children:"📖"}),o.jsx("span",{children:`Aprendes el doble: ${books.join(", ")}`})]}),
s.trade&&o.jsx("button",{className:"btn btn--sm btn--primary",disabled:busy,onClick:()=>l("urtrade"),children:`🤝 Comerciar con ${s.trade.trader}`})]}),
comp.length>0&&o.jsxs("div",{className:"ur-comp",children:[o.jsx("div",{className:"u-eyebrow",children:"Compañeros"}),comp.map(c=>o.jsxs("div",{className:"ur-comp__card",children:[o.jsxs("div",{className:"ur-comp__head",children:[o.jsx("b",{children:c.name}),o.jsx("span",{className:"ur-comp__role",children:c.role+(c.skill?` · +1 ${c.skill}`:"")})]}),o.jsx(Dt,{label:"Vida",value:c.hp,critAt:25,warnAt:50,color:"var(--ok)"}),o.jsx(Dt,{label:"Hambre",value:c.hunger,critAt:20,warnAt:50,color:"var(--ok)"}),o.jsx(Dt,{label:"Ánimo",value:c.morale,critAt:20,warnAt:50,color:"var(--ok)"}),o.jsx("button",{className:"btn btn--sm",disabled:busy,"data-act":!0,onClick:()=>a.dispatch({type:"urFeed",id:c.id}),children:"Dar de comer"})]},c.id))]}),
lore.length>0&&o.jsxs("details",{className:"ur-lore",children:[o.jsx("summary",{children:`Lo que recuerdas (${lore.length})`}),o.jsx("ul",{children:lore.slice().reverse().map(f=>o.jsxs("li",{children:[o.jsx("b",{children:f.name})," · ",f.text]},f.name))})]})]})}
function urTrade({api:a,onClose:l}){const s=a.state,t=s.trade,[g,sg]=V.useState({}),[w,sw]=V.useState({});
if(!t)return o.jsx(Cn,{title:"Comerciar",icon:"🤝",onClose:l,children:o.jsx("p",{style:{fontSize:13,color:"var(--text-dim)"},children:"Ya no hay nadie con quien comerciar aquí."})});
const ci=s.customItems,gv=Object.entries(g).reduce((x,[n,q])=>x+urValue(n,ci,s.inventory.find(i=>i.name===n)?.cond)*q,0),pv=Object.entries(w).reduce((x,[n,q])=>x+urPrice(n,ci)*q,0),busy=urBusy(a),ok=pv>0&&gv>=pv&&!busy,
step=(set,obj,n,max,d)=>set({...obj,[n]:Math.max(0,Math.min(max,(obj[n]??0)+d))}),
row=(n,max,price,obj,set,verb)=>o.jsxs("div",{className:"ur-tr__row",children:[o.jsx("span",{className:"ur-tr__name",title:n,children:vr(n,s.genre)}),o.jsxs("span",{className:"u-num ur-tr__price",children:[price," c/u"]}),o.jsx("button",{className:"btn btn--sm","aria-label":`Una menos: ${n}`,disabled:!(obj[n]>0),onClick:()=>step(set,obj,n,max,-1),children:"−"}),o.jsxs("span",{className:"u-num",children:[obj[n]??0,"/",max]}),o.jsx("button",{className:"btn btn--sm","aria-label":`${verb}: ${n}`,disabled:(obj[n]??0)>=max,onClick:()=>step(set,obj,n,max,1),children:"+"})]},n);
return o.jsxs(Cn,{title:`Trueque con ${t.trader}`,icon:"🤝",onClose:l,wide:!0,footer:o.jsxs("div",{style:{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",width:"100%"},children:[o.jsxs("span",{className:"u-num",style:{flex:1,fontSize:13},children:["Das ",gv," · pide ",pv]}),o.jsx("button",{className:"btn btn--primary",disabled:!ok,"data-act":!0,onClick:()=>{a.dispatch({type:"urTrade",give:Object.entries(g).filter(([,q])=>q>0).map(([name,qty])=>({name,qty})),get:Object.entries(w).filter(([,q])=>q>0).map(([name,qty])=>({name,qty}))}),sg({}),sw({})},children:"Hacer el cambio"})]}),
children:[o.jsx("p",{style:{fontSize:12.5,color:"var(--text-dim)",marginBottom:14,lineHeight:1.5},children:"Elige lo que quieres y lo que das a cambio. Los comerciantes piden un 50 % más de lo que valen las cosas, y lo gastado vale menos."}),o.jsxs("div",{className:"grid grid--2",style:{alignItems:"start"},children:[o.jsxs("div",{className:"card",style:{padding:12},children:[o.jsx("div",{className:"u-eyebrow",style:{marginBottom:8},children:`Ofrece ${t.trader}`}),t.items.map(i=>row(i.name,i.qty,urPrice(i.name,ci),w,sw,"Una más"))]}),o.jsxs("div",{className:"card",style:{padding:12},children:[o.jsx("div",{className:"u-eyebrow",style:{marginBottom:8},children:"Tú das"}),s.inventory.length?s.inventory.map(i=>row(i.name,i.qty,urValue(i.name,ci,i.cond),g,sg,"Dar una más")):o.jsx("p",{style:{fontSize:12,color:"var(--text-faint)"},children:"No llevas nada."})]})]})]})}
function urPacePicker({state:s,dispatch:c,h:H="h3"}){return o.jsxs("div",{style:{marginTop:22},children:[o.jsx(H,{className:"u-eyebrow",style:{marginBottom:10},children:"Ritmo de la historia"}),o.jsx("div",{className:"grid grid--3",children:urPaces.map(p=>o.jsxs("button",{className:"pick","aria-pressed":(s.pace||"clasico")===p.id,style:{padding:"11px 13px",gap:3},onClick:()=>c({type:"urSetPace",pace:p.id}),children:[o.jsxs("span",{className:"pick__title",style:{fontSize:13.5},children:[o.jsx("span",{"aria-hidden":!0,children:p.icon}),p.label]}),o.jsx("span",{className:"pick__desc",style:{fontSize:12},children:p.desc})]},p.id))})]})}
"""
rep('const im=document.getElementById("root");', HELPERS.strip().replace("\n", "") + 'const im=document.getElementById("root");')

CSS = """
.ur-x{display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--text-dim)}
.ur-x__row{display:flex;gap:8px;align-items:center;line-height:1.4}
.ur-comp{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.ur-comp__card{display:flex;flex-direction:column;gap:7px;padding:10px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface-1)}
.ur-comp__head{display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:13px}
.ur-comp__role{font-size:11px;color:var(--text-dim);text-align:right}
.ur-lore{margin-top:14px;font-size:12px;color:var(--text-dim)}
.ur-lore summary{cursor:pointer;color:var(--text-mid);font-weight:550;padding:4px 0}
.ur-lore ul{display:flex;flex-direction:column;gap:6px;margin-top:6px;line-height:1.45}
.ur-tr__row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line);font-size:12.5px}
.ur-tr__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ur-tr__price{font-size:11px;color:var(--text-dim)}
.inv__cond{font-family:var(--font-mono);font-size:10px;color:var(--text-dim)}
.inv__cond[data-low=true]{color:var(--warn)}
"""
rep("</style>", CSS.strip().replace("\n", "") + "</style>")

open(dst, "w", encoding="utf8").write(s)
print("ok", len(s))
