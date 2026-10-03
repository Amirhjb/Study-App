"""Arreglos de robustez de las pruebas de estrés (puntos 1-6) sobre jugar.html.

Uso: python3 patch_robustez.py entrada.html salida.html
Se aplica después de patch_interfaz.py y patch_accesibilidad.py. Cada reemplazo
exige que el texto original aparezca exactamente una vez, así que falla (sin
escribir nada) si se aplica dos veces o sobre otra build.
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


# ---------------------------------------------------------------------------
# 1. Objetos nuevos absorbidos por el catálogo («Venda de tela» -> Tela).
#    Un nombre más específico que uno conocido ya no se convierte en ese
#    objeto: en ganancias y fabricación se queda como objeto propio. Un nombre
#    más genérico («agua») sigue apuntando al del catálogo.
rep(
    r'function Ko(a,l=[]){const s=a.trim();if(!s)return null;if(Bd(s)||l.includes(s))return s;const c=On(s),d=pd.get(c);if(d)return d;for(const f of l)if(On(f)===c)return f;if(c.length<4)return null;for(const f of l){const m=On(f);if(m.includes(c)||c.includes(m))return f}for(const[f,m]of pd)if(f.includes(c)||c.includes(f))return m;return null}',
    r'function Ko(a,l=[],u=!1){const s=a.trim();if(!s||urBad(s))return null;if(Bd(s)||l.includes(s))return s;const c=On(s),d=pd.get(c);if(d)return d;for(const f of l)if(On(f)===c)return f;if(c.length<4)return null;for(const f of l){const m=On(f);if(m.length>=3&&m.includes(c))return f}for(const[f,m]of pd)if(f.includes(c))return m;for(const f of l){const m=On(f);if(m.length>=3&&c.includes(m))return u?wh(s):f}for(const[f,m]of pd)if(c.includes(f))return u?wh(s):m;return null}',
)
#    Un objeto declarado como nuevo solo se descarta si equivale a uno existente.
rep("||c.some(z=>z.name===m)||Ko(m,l))continue;", "||c.some(z=>z.name===m)||(Ko(m,l,!0)??m)!==m)continue;")
rep("function Ps(a,l,s=6){", "function Ps(a,l,s=6,u=!1){")
rep("const g=Ko(d,l);g&&c.push", "const g=Ko(d,l,u);g&&c.push")
rep("m=Ko(Te(f.name),l);if(!m)continue;", "m=Ko(Te(f.name),l,u);if(!m)continue;")
rep("itemsGained:Ps(d.itemsGained,h),", "itemsGained:Ps(d.itemsGained,h,6,!0),")
rep("g=Ps(c.produces,y,3);", "g=Ps(c.produces,y,3,!0);")
#    Los nombres del inventario también cuentan como conocidos (coincidencia exacta primero).
rep("ge=Object.keys(A.customItems);", "ge=[...new Set([...Object.keys(A.customItems),...A.inventory.map(x=>x.name)])];")
rep("zh(A,Object.keys(C.customItems))", "zh(A,[...new Set([...Object.keys(C.customItems),...C.inventory.map(x=>x.name)])])")

# ---------------------------------------------------------------------------
# 2. Nada que cambie la partida mientras el narrador escribe o se improvisa.
BUSY = 'urBusy(a),"data-act":!0'
rep('className:"btn btn--primary btn--block btn--lg",disabled:!m,onClick:()=>c({type:"establishBase"})',
    'className:"btn btn--primary btn--block btn--lg",disabled:!m||' + BUSY + ',onClick:()=>c({type:"establishBase"})')
rep('o.jsx("button",{className:"btn btn--primary",onClick:()=>{c({type:"returnToBase"}),l()}',
    'o.jsx("button",{className:"btn btn--primary",disabled:' + BUSY + ',onClick:()=>{c({type:"returnToBase"}),l()}')
rep('disabled:!d||!b||!w,onClick:()=>c({type:"build",structure:m})',
    'disabled:!d||!b||!w||' + BUSY + ',onClick:()=>c({type:"build",structure:m})')
rep('className:"inv__row",disabled:!d,onClick:()=>c({type:"withdraw",name:m.name,qty:1})',
    'className:"inv__row",disabled:!d||' + BUSY + ',onClick:()=>c({type:"withdraw",name:m.name,qty:1})')
rep('className:"inv__row",disabled:!d,onClick:()=>c({type:"deposit",name:m.name,qty:1})',
    'className:"inv__row",disabled:!d||' + BUSY + ',onClick:()=>c({type:"deposit",name:m.name,qty:1})')
rep('disabled:!g.canCraft,style:{marginTop:"auto"},onClick:()=>c({type:"craft",recipeId:g.recipe.id})',
    'disabled:!g.canCraft||' + BUSY + ',style:{marginTop:"auto"},onClick:()=>c({type:"craft",recipeId:g.recipe.id})')
rep('className:"btn btn--primary btn--sm",onClick:()=>{c({type:"useItem",name:d}),f(null)}',
    'className:"btn btn--primary btn--sm",disabled:' + BUSY + ',onClick:()=>{c({type:"useItem",name:d}),f(null)}')
rep('className:"btn btn--sm",onClick:()=>c({type:"deposit",name:d,qty:1})',
    'className:"btn btn--sm",disabled:' + BUSY + ',onClick:()=>c({type:"deposit",name:d,qty:1})')
rep('className:"btn btn--sm btn--danger",onClick:()=>{c({type:"dropItem",name:d,qty:1}),f(null)}',
    'className:"btn btn--sm btn--danger",disabled:' + BUSY + ',onClick:()=>{c({type:"dropItem",name:d,qty:1}),f(null)}')
rep('className:"btn btn--primary btn--block btn--lg",onClick:()=>{c({type:"sleep",hours:d}),l()}',
    'className:"btn btn--primary btn--block btn--lg",disabled:' + BUSY + ',onClick:()=>{c({type:"sleep",hours:d}),l()}')
#    Improvisar ya no cancela el turno en curso.
rep('d=a.status==="improvising"', "d=urBusy(a)")
rep('children:d?"Probando…":"Intentar"', 'children:a.status==="improvising"?"Probando…":"Intentar"')
rep('o.jsxs("div",{className:"app",children:[', 'o.jsxs("div",{className:"app","data-busy":urBusy(a),children:[')

# ---------------------------------------------------------------------------
# 3. Guardado: sin bucle de autoguardado, guardar al salir y aviso entre pestañas.
rep(
    "const D=V.useRef(s);D.current=s;",
    "const D=V.useRef(s);D.current=s;"
    "const urS=V.useRef(d);urS.current=d;"
    "const[urStale,urSetStale]=V.useState(!1),urStaleR=V.useRef(!1);urStaleR.current=urStale;"
    "const urDirty=V.useRef(!1),urPrev=V.useRef(null),urSkip=V.useRef(!1);"
    "const urD=V.useCallback(q=>{const k=urS.current;(k===\"thinking\"||k===\"improvising\")&&urBlock.has(q.type)||l(q)},[]);",
)
rep(
    'V.useEffect(()=>{if(a.screen!=="game"&&a.screen!=="death"||!a.charName)return;const q=setTimeout(()=>{const K=kd("auto",a);K.ok?l({type:"markSaved",at:Date.now()}):h(K.error??null)},800);return()=>clearTimeout(q)},[a])',
    # Guardar al ocultar o cerrar la pestaña si hay cambios sin guardar; detectar otra pestaña.
    'V.useEffect(()=>{const q=()=>{const K=P.current;urDirty.current&&!urStaleR.current&&(K.screen==="game"||K.screen==="death")&&K.charName&&kd("auto",K).ok&&(urDirty.current=!1)},'
    'K=()=>{document.visibilityState==="hidden"&&q()},'
    'H=C=>{if(C.key!==ol("auto")||C.newValue==null)return;const A=P.current;(A.screen==="game"||A.screen==="death")&&A.charName&&urSetStale(!0)};'
    'return window.addEventListener("pagehide",q),document.addEventListener("visibilitychange",K),window.addEventListener("storage",H),'
    '()=>{window.removeEventListener("pagehide",q),document.removeEventListener("visibilitychange",K),window.removeEventListener("storage",H)}},[]),'
    # Autoguardado: ignora el cambio que solo marca la hora de guardado (era un bucle cada 0,8 s).
    'V.useEffect(()=>{const C=urPrev.current;urPrev.current=a;if(C&&Object.keys(a).every(A=>A==="savedAt"||a[A]===C[A]))return;'
    'if(urSkip.current){urSkip.current=!1;return}'
    'if(a.screen!=="game"&&a.screen!=="death"||!a.charName||urStaleR.current)return;urDirty.current=!0;'
    'const q=setTimeout(()=>{const K=kd("auto",a);K.ok?(urDirty.current=!1,l({type:"markSaved",at:Date.now()})):h(K.error??null)},800);return()=>clearTimeout(q)},[a])',
)
rep(
    "{state:a,dispatch:l,settings:s,",
    "{state:a,dispatch:urD,stale:urStale,"
    "urLoadLatest:()=>{const K=ll(\"auto\");K?(urSkip.current=!0,Qe(K)):h(\"No se ha podido cargar la otra versión.\"),urSetStale(!1)},"
    "urKeep:()=>{urSetStale(!1);const K=kd(\"auto\",P.current);K.ok?(urDirty.current=!1,l({type:\"markSaved\",at:Date.now()})):h(K.error??null)},"
    "settings:s,",
)
#    Cargar la partida automática no la reescribe (así abrir otra pestaña no avisa sin motivo).
rep("yn=V.useCallback(q=>{const K=ll(q);return K?(Qe(K),!0):!1},[Qe])",
    'yn=V.useCallback(q=>{const K=ll(q);return K?(q==="auto"&&(urSkip.current=!0),Qe(K),!0):!1},[Qe])')
rep(
    'a.flash&&o.jsx("div",{className:"flash","aria-hidden":!0})]',
    'a.flash&&o.jsx("div",{className:"flash","aria-hidden":!0}),a.stale&&o.jsx(urStaleBanner,{api:a})]',
)

# ---------------------------------------------------------------------------
# 4. Nombres especiales (constructor, toString, __proto__…) desde la IA o un fichero.
rep("kr=Object.fromEntries(Jo.map(a=>[a.id,a]))", "kr=Object.assign(Object.create(null),Object.fromEntries(Jo.map(a=>[a.id,a])))")
rep('Od={"Manual de medicina":', 'Od=Object.assign(Object.create(null),{"Manual de medicina":')
rep("},el={Pistola:", "}),el=Object.assign(Object.create(null),{Pistola:")
rep("materials:{tela:.15}}},Mf=[[", "materials:{tela:.15}}}),Mf=[[")
rep("function en(a,l){return l?.[a]??el[a]??Dd(a)}",
    "function en(a,l){return(l&&Object.prototype.hasOwnProperty.call(l,a)?l[a]:void 0)??el[a]??Dd(a)}")
rep(
    r"return l.length<2||/^[\d\s.,;:_-]+$/.test(l)?null:l[0].toUpperCase()+l.slice(1)}function Xd(",
    r"const r=l.length<2||/^[\d\s.,;:_-]+$/.test(l)?null:l[0].toUpperCase()+l.slice(1);return r&&urBad(r)?null:r}function Xd(",
)
rep("g=Te(y?.currentZone)||Te(d.location)||l,", 'g=[Te(y?.currentZone),Te(d.location),l].find(x=>x&&!urBad(x))||"",')
rep(".map(w=>w.trim().slice(0,60)).filter(Boolean).slice(0,2):[]", ".map(w=>w.trim().slice(0,60)).filter(w=>w&&!urBad(w)).slice(0,2):[]")
#    Si preparar el turno falla, se muestra un error en vez de quedarse «escribiendo» para siempre.
rep(
    "const A=H??P.current,ae=gh(A),te=",
    'const A=H??P.current;let ae;try{ae=gh(A)}catch(__e){console.error(__e),h("No se ha podido preparar el turno: la partida tiene datos dañados."),f("error"),z.current===C&&(z.current=null);return}const te=',
)

# ---------------------------------------------------------------------------
# 5. Partidas importadas o guardadas con datos inválidos: se reparan al cargar,
#    y cualquier fallo de pantalla muestra un aviso en vez de dejarla en blanco.
rep("function nm(a){if(!a||typeof a!=\"object\")return null;", "function nm(a){const r=nm0(a);return r?urRepair(r):null}function nm0(a){if(!a||typeof a!=\"object\")return null;")
rep("mf.createRoot(im).render(o.jsx(V.StrictMode,{children:o.jsx(Rg,{})}))",
    "mf.createRoot(im).render(o.jsx(V.StrictMode,{children:o.jsx(urBoundary,{children:o.jsx(Rg,{})})}))")

# ---------------------------------------------------------------------------
# 6. Menores.
#    La zona provisional «Inicio» toma el nombre del primer lugar real.
rep(
    "let h=!1;if(d[m])d[m].visited||f.push(m)",
    'let h=!1;if(a.currentZone==="Inicio"&&m!=="Inicio"&&d.Inicio&&!d[m]){d[m]={...d.Inicio};delete d.Inicio;for(const k of Object.keys(d))d[k].connections=d[k].connections.map(x=>x==="Inicio"?m:x)}if(d[m])d[m].visited||f.push(m)',
)
rep(
    "const D={...a,inventory:y,customItems:h,knownRecipes:g,map:w,",
    "const D={...a,base:a.base.location===\"Inicio\"&&w.currentZone!==\"Inicio\"&&!w.nodes.Inicio&&w.nodes[w.currentZone]?.isBase?{...a.base,location:w.currentZone,name:`Refugio — ${w.currentZone}`}:a.base,inventory:y,customItems:h,knownRecipes:g,map:w,",
)
#    Cantidades cero o negativas ya no dan un objeto.
rep("y=se(Math.round(Ze(f.qty,1)),1,20);h?h.qty+=y:c.push({name:m,qty:y})",
    "y=se(Math.round(Ze(f.qty,1)),0,20);if(y<1)continue;h?h.qty+=y:c.push({name:m,qty:y})")
#    Nombre del fichero exportado sin tildes ni símbolos.
rep(
    '${a.charName.replace(/\\s+/g,"-").toLowerCase()||"partida"}',
    '${a.charName.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase()||"partida"}',
)

# ---------------------------------------------------------------------------
# Funciones auxiliares (antes de montar la app).
HELPERS = r"""
function urBad(a){return typeof a!="string"||a in Object.prototype}
function urBusy(a){return a.status==="thinking"||a.status==="improvising"}
const urBlock=new Set(["useItem","dropItem","deposit","withdraw","craft","sleep","build","establishBase","returnToBase"]);
function urRepair(r){try{
const own=(o,k)=>typeof k=="string"&&Object.prototype.hasOwnProperty.call(o,k),A=x=>Array.isArray(x)?x:[],O=x=>x&&typeof x=="object"&&!Array.isArray(x)?x:{},N=(x,d)=>typeof x=="number"&&Number.isFinite(x)?x:d,S=x=>typeof x=="string"&&x.trim().length>0&&!urBad(x);
const items=x=>A(x).filter(i=>i&&S(i.name)&&N(i.qty,0)>=1).map(i=>({name:i.name.slice(0,60),qty:Math.min(999,Math.round(i.qty))}));
const w=O(r.weather),mp=O(r.map),nodes={};
for(const[k,v]of Object.entries(O(mp.nodes))){if(!S(k)||!v||typeof v!="object")continue;nodes[k]={...v,type:own(gr,v.type)?v.type:"unknown",danger:se(Math.round(N(v.danger,1)),0,5),visited:!!v.visited,x:N(v.x,400),y:N(v.y,300),connections:A(v.connections).filter(c=>typeof c=="string")}}
for(const v of Object.values(nodes))v.connections=v.connections.filter(c=>own(nodes,c));
let cz=typeof mp.currentZone=="string"?mp.currentZone:"";
if(!own(nodes,cz)){cz=Object.keys(nodes)[0]??"Inicio";own(nodes,cz)||(nodes[cz]={type:"urban",danger:2,visited:!0,x:400,y:300,connections:[],discoveredDay:1})}
const ci={};for(const[k,v]of Object.entries(O(r.customItems)))S(k)&&v&&typeof v=="object"&&(ci[k]={...v,kg:N(v.kg,.3),l:N(v.l,.3),tags:A(v.tags).filter(t=>typeof t=="string")});
const nd=O(r.needs),b=O(r.base),kinds=["story","player","roll","good","bad","warn","system"];
return{...r,genre:own(Bn,r.genre)?r.genre:"apocalypse",charName:String(r.charName).slice(0,32),narrator:own(ma,r.narrator)?r.narrator:"cronista",
traits:A(r.traits).filter(t=>own(tl,t)),screen:r.screen==="death"?"death":"game",
weather:own(Sn,w.id)?{id:w.id,daysLeft:Math.max(1,Math.round(N(w.daysLeft,1)))}:{id:"clear",daysLeft:1},forecast:A(r.forecast).filter(f=>own(Sn,f)),
map:{nodes,currentZone:cz},location:typeof r.location=="string"&&r.location?r.location:cz,
inventory:items(r.inventory),base:{...Xn.base,...b,structures:A(b.structures).filter(t=>own(Is,t)),storage:items(b.storage),location:typeof b.location=="string"?b.location:""},
knownRecipes:A(r.knownRecipes).filter(k=>own(kr,k)),customItems:ci,
injuries:A(r.injuries).filter(i=>i&&own(dn,i.zone)).map(i=>({...i,severity:se(Math.round(N(i.severity,1)),1,3),label:typeof i.label=="string"?i.label:"Herida",age:N(i.age,0)})),
diseases:A(r.diseases).filter(d=>d&&own(nn,d.id)).map(d=>({...d,stage:se(Math.round(N(d.stage,0)),0,2),ticks:N(d.ticks,0)})),
modifiers:A(r.modifiers).filter(m=>m&&typeof m.label=="string"&&m.skills&&typeof m.skills=="object").map(m=>({...m,turns:N(m.turns,1)})),
log:A(r.log).filter(e=>e&&typeof e.text=="string").map((e,i)=>({...e,id:String(e.id??"r"+i),kind:kinds.includes(e.kind)?e.kind:"system",at:N(e.at,0)})),
history:A(r.history).filter(h=>h&&(h.role==="user"||h.role==="assistant")&&typeof h.content=="string"),
diary:A(r.diary).filter(d=>d&&typeof d.text=="string"),photos:A(r.photos).filter(p=>p&&typeof p.imageKey=="string"),
hp:N(r.hp,100),maxHp:Math.max(1,N(r.maxHp,100)),minutes:Math.max(0,N(r.minutes,480)),
needs:{hunger:se(N(nd.hunger,80),0,100),thirst:se(N(nd.thirst,80),0,100),sleep:se(N(nd.sleep,80),0,100),temp:se(N(nd.temp,36.5),30,43)},
skillXp:Object.fromEntries(Object.entries(O(r.skillXp)).filter(([k,v])=>Zn.includes(k)&&N(v,-1)>=0)),
basePenalty:O(r.basePenalty),counters:O(r.counters),stats:{...Xn.stats,...Object.fromEntries(Object.entries(O(r.stats)).filter(([,v])=>typeof v=="number"))}}
}catch(e){return console.error(e),null}}
function urStaleBanner({api:a}){return o.jsxs("div",{className:"notice notice--warn ur-stale",role:"alert",children:[o.jsx("span",{"aria-hidden":!0,children:"⚠"}),o.jsxs("div",{style:{flex:1},children:[o.jsx("b",{children:"Esta partida se ha guardado desde otra pestaña."})," Para no pisar ese progreso, aquí no se guarda nada hasta que elijas.",o.jsxs("div",{style:{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"},children:[o.jsx("button",{className:"btn btn--sm btn--primary",onClick:a.urLoadLatest,children:"Cargar la versión más reciente"}),o.jsx("button",{className:"btn btn--sm",onClick:a.urKeep,children:"Seguir con esta y guardarla"})]})]})]})}
class urBoundary extends V.Component{constructor(a){super(a),this.state={err:null}}static getDerivedStateFromError(a){return{err:a}}componentDidCatch(a){console.error(a)}render(){return this.state.err?o.jsx("div",{className:"setup",children:o.jsxs("div",{className:"setup__inner",style:{textAlign:"center"},children:[o.jsx("h1",{className:"title",children:"Algo ha fallado"}),o.jsx("p",{className:"subtitle",children:"El juego ha encontrado un error. Tus partidas guardadas siguen a salvo."}),o.jsx("button",{className:"btn btn--primary",onClick:()=>this.setState({err:null}),children:"Volver al inicio"})]})}):this.props.children}}
"""
rep('const im=document.getElementById("root");', HELPERS.strip().replace("\n", "") + 'const im=document.getElementById("root");')

CSS = """
.app[data-busy=true] .modal:has([data-act]) .modal__body:before{content:"El narrador está escribiendo. Espera a que termine para hacer otra cosa.";display:block;margin-bottom:14px;padding:10px 13px;border-radius:var(--r-sm);background:var(--warn-soft);border:1px solid #f2b0364d;color:var(--warn);font-size:12.5px;line-height:1.5}
.ur-stale{position:fixed;top:12px;left:50%;transform:translate(-50%);z-index:300;width:min(560px,calc(100% - 24px));background:var(--surface-2);border-color:var(--warn);box-shadow:var(--sh-lg)}
"""
rep("</style>", CSS.strip().replace("\n", "") + "</style>")

open(dst, "w", encoding="utf8").write(s)
print("ok", len(s))
