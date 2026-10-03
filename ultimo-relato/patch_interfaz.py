"""Aplica las 3 mejoras de interfaz sobre el HTML compilado de Último Relato.

Uso: python3 patch_interfaz.py entrada.html salida.html
Cada reemplazo exige que el texto original aparezca exactamente una vez,
así que falla (sin escribir nada) si se aplica dos veces o sobre otra build.
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


# ---------- 1. Avisos del turno agrupados en etiquetas ----------
# Las notas (good/bad/warn/system) seguidas y del mismo minuto se juntan
# en un solo bloque; un separador de día o cualquier otra entrada lo corta.
rep(
    'for(const B of l.log){const L=mn(B.at);L!==R&&(R=L,D.push(o.jsxs("div",{className:"day-sep",children:["Día ",L]},`d${L}-${B.id}`))),D.push(o.jsx(dg,{entry:B},B.id))}',
    'let __ng=null;for(const B of l.log){const L=mn(B.at);L!==R&&(R=L,__ng=null,D.push(o.jsxs("div",{className:"day-sep",children:["Día ",L]},`d${L}-${B.id}`)));if(B.kind in cg){if(__ng&&__ng.at===B.at){__ng.items.push(B);continue}__ng={at:B.at,items:[B]},D.push(__ng);continue}__ng=null,D.push(o.jsx(dg,{entry:B},B.id))}for(let __i=0;__i<D.length;__i++)D[__i].items&&(D[__i]=o.jsx(urNotes,{items:D[__i].items},`n-${D[__i].items[0].id}`));',
)
URNOTES = (
    'function urNotes({items:a}){return o.jsx("div",{className:"entry notes",children:a.map(l=>'
    'o.jsxs("span",{className:"note","data-kind":l.kind,children:['
    'o.jsx("span",{className:"note__icon","aria-hidden":!0,children:cg[l.kind]}),'
    'o.jsx("span",{children:l.text})]},l.id))})}'
)

# ---------- 2. Franja de constantes (pantallas sin la columna izquierda) ----------
URVITALS = (
    'function urVitals({state:a,onOpen:l}){const s=a.hp/a.maxHp*100,'
    'c=[{k:"hp",icon:"❤",label:"Vida",v:Math.round(a.hp),pct:s,st:s<=25?"crit":s<=50?"warn":"ok"},'
    '...[["Hambre","🍖",a.needs.hunger],["Sed","💧",a.needs.thirst],["Sueño","😴",a.needs.sleep]]'
    '.map(([d,f,m])=>({k:d,icon:f,label:d,v:Math.round(m),pct:m,st:m<=20?"crit":m<=50?"warn":"ok"}))];'
    'return o.jsx("button",{type:"button",className:"vitalbar",onClick:l,'
    '"aria-label":`Ver estado completo. ${c.map(d=>`${d.label} ${d.v}`).join(", ")}`,'
    'children:o.jsx("span",{className:"vitalbar__inner",children:c.map(d=>'
    'o.jsxs("span",{className:"vitalbar__item","data-state":d.st,title:d.label,children:['
    'o.jsxs("span",{className:"vitalbar__top",children:['
    'o.jsx("span",{"aria-hidden":!0,children:d.icon}),'
    'o.jsx("span",{className:"vitalbar__label",children:d.label}),'
    'o.jsx("b",{className:"vitalbar__value u-num",children:d.v})]}),'
    'o.jsx("span",{className:"vitalbar__track",children:o.jsx("span",{className:"vitalbar__fill",'
    'style:{width:`${Math.max(0,Math.min(100,d.pct))}%`}})})]},d.k))})})}'
)

rep("function mg({api:a}){", URNOTES + URVITALS + "function mg({api:a,onStatus:__os}){")
rep(
    'children:z?"El narrador está escribiendo…":c?`Error: ${c}`:""}),o.jsx("div",{className:"story",',
    'children:z?"El narrador está escribiendo…":c?`Error: ${c}`:""}),o.jsx(urVitals,{state:l,onOpen:__os}),o.jsx("div",{className:"story",',
)
rep("o.jsx(mg,{api:a})", 'o.jsx(mg,{api:a,onStatus:()=>m("status")})')

# ---------- 3. Botones de la barra superior con nombre y atajo ----------
def tool(icon, label, key=None):
    kbd = f',o.jsx("kbd",{{className:"tool__key","aria-hidden":!0,children:{key}}})' if key else ""
    return (
        f'[o.jsx("span",{{className:"tool__icon","aria-hidden":!0,children:{icon}}}),'
        f'o.jsx("span",{{className:"tool__label","aria-hidden":!0,children:{label}}}){kbd}]'
    )


rep(
    '!h&&k.map(S=>o.jsx("button",{className:"btn btn--icon btn--ghost",title:`${S.label} · atajo ${S.key}`,"aria-label":S.label,onClick:()=>m(S.id),children:S.icon},S.id)),o.jsx("button",{className:"btn btn--icon btn--ghost",title:"Partidas","aria-label":"Partidas",onClick:()=>m("saves"),children:"💾"}),o.jsx("button",{className:"btn btn--icon btn--ghost",title:"Ajustes","aria-label":"Ajustes",onClick:l,children:"⚙"})',
    '!h&&k.map(S=>o.jsxs("button",{className:"btn btn--icon btn--ghost tool",title:`${S.label} · atajo ${S.key}`,"aria-label":S.label,"aria-keyshortcuts":S.key,onClick:()=>m(S.id),children:'
    + tool("S.icon", "S.label", "S.key")
    + '},S.id)),o.jsxs("button",{className:"btn btn--icon btn--ghost tool",title:"Partidas","aria-label":"Partidas",onClick:()=>m("saves"),children:'
    + tool('"💾"', '"Partidas"')
    + '}),o.jsxs("button",{className:"btn btn--icon btn--ghost tool",title:"Ajustes","aria-label":"Ajustes",onClick:l,children:'
    + tool('"⚙"', '"Ajustes"')
    + "})",
)

# ---------- CSS ----------
CSS = """
.notes{display:flex;flex-wrap:wrap;gap:6px;margin-top:-6px}
.note{display:inline-flex;align-items:baseline;gap:6px;max-width:100%;padding:3px 9px;border-radius:var(--r-xs);border:1px solid var(--line);font-size:12px;line-height:1.45;color:var(--text-dim);animation:fade-in var(--dur-2) var(--ease) both}
.note__icon{flex:none;font-weight:700}
.note[data-kind=good] .note__icon{color:var(--ok)}
.note[data-kind=warn]{color:var(--warn);background:var(--warn-soft);border-color:#f2b03638}
.note[data-kind=bad]{color:var(--bad);background:var(--bad-soft);border-color:#f0565366;font-weight:550}
.vitalbar{display:none}
.tool__label,.tool__key{display:none}
@media(max-width:1180px){
.vitalbar{display:block;width:100%;padding:8px clamp(16px,4vw,48px);border-bottom:1px solid var(--line);background:var(--bg-deep);text-align:left;font-size:14px;transition:background var(--dur-1) var(--ease)}
.vitalbar:hover{background:var(--surface-1)}
.vitalbar:focus-visible{outline-offset:-2px}
.vitalbar__inner{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;max-width:68ch;margin:0 auto}
.vitalbar__item{display:flex;flex-direction:column;gap:5px;min-width:0}
.vitalbar__top{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-dim);white-space:nowrap}
.vitalbar__label{overflow:hidden;text-overflow:ellipsis}
.vitalbar__value{margin-left:auto;font-weight:600;color:var(--text-mid)}
.vitalbar__track{height:3px;border-radius:var(--r-full);background:var(--surface-2);overflow:hidden}
.vitalbar__fill{display:block;height:100%;border-radius:var(--r-full);background:var(--ok);transition:width var(--dur-3) var(--ease)}
.vitalbar__item[data-state=warn] .vitalbar__fill{background:var(--warn)}
.vitalbar__item[data-state=warn] .vitalbar__value{color:var(--warn)}
.vitalbar__item[data-state=crit] .vitalbar__fill{background:var(--bad);animation:pulse-soft 1.8s var(--ease) infinite}
.vitalbar__item[data-state=crit] .vitalbar__value,.vitalbar__item[data-state=crit] .vitalbar__label{color:var(--bad)}
}
@media(max-width:480px){.vitalbar__label{display:none}.vitalbar__inner{gap:12px}.vitalbar__value{margin-left:0}}
@media(max-width:860px){
.suggest__list{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:calc(-1 * clamp(12px,4vw,48px));padding-inline:clamp(12px,4vw,48px);scroll-padding-inline:clamp(12px,4vw,48px);scroll-snap-type:x proximity}
.suggest__list::-webkit-scrollbar{display:none}
.suggest__btn{flex:none;white-space:nowrap;scroll-snap-align:start}
}
@media(hover:none){.compose__hint{display:none}}
@media(min-width:1280px){
.btn--icon.tool{width:auto;padding:6px 9px;gap:6px}
.tool__label{display:inline;font-size:12.5px;font-weight:500}
}
@media(min-width:1440px){
.tool__key{display:inline-block;min-width:16px;padding:0 4px;border:1px solid var(--line-strong);border-radius:4px;font-family:var(--font-mono);font-size:10px;line-height:15px;text-align:center;color:var(--text-faint)}
}
"""
rep("</style>", CSS.strip().replace("\n", "") + "</style>")

open(dst, "w", encoding="utf8").write(s)
print("ok", len(s))
