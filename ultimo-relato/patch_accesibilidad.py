"""Correcciones de accesibilidad (puntos 1-4 de la auditoría) sobre jugar.html.

Uso: python3 patch_accesibilidad.py entrada.html salida.html
Se aplica después de patch_interfaz.py. Cada reemplazo exige que el texto
original aparezca exactamente una vez, así que falla (sin escribir nada) si
se aplica dos veces o sobre otra build.
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


# 1. Contraste de texto: el texto tenue pasa de 56 % a 62 % de luminosidad
#    (4,27:1 -> 5,45:1 sobre el fondo; 3,8:1 -> 4,86:1 sobre --surface-2).
rep("--text-faint: oklch(56% .01 var(--h))", "--text-faint: oklch(62% .01 var(--h))")
#    Etiquetas rojas de penalización: el rojo de texto se aclara (4,34:1 antes).
rep(
    ".chip--neg{background:var(--bad-soft);border-color:#f056534d;color:var(--bad)}",
    ".chip--neg{background:var(--bad-soft);border-color:#f056534d;color:oklch(72% .17 25)}",
)

# 2. Atajos: Esc en la caja de texto le quita el foco, y entonces I/C/M/B/Z/D/F
#    funcionan. La pista lo dice y queda asociada a la caja para lectores de pantalla.
rep(
    'onKeyDown:B=>{B.key==="Enter"&&!B.shiftKey&&(B.preventDefault(),P())}',
    'onKeyDown:B=>{B.key==="Enter"&&!B.shiftKey&&(B.preventDefault(),P()),B.key==="Escape"&&(B.preventDefault(),B.currentTarget.blur())}',
)
rep('className:"field compose__input",', 'className:"field compose__input","aria-label":"¿Qué haces?","aria-describedby":"compose-hint",')
rep(
    'o.jsx("div",{className:"compose__hint",children:"Intro para enviar · Mayús+Intro para salto de línea"})',
    'o.jsx("div",{id:"compose-hint",className:"compose__hint",children:"Intro para enviar · Mayús+Intro para salto de línea · Esc para usar los atajos (I, C, M…)"})',
)

# 3. Bordes de campos: gris propio con 3,2-3,7:1 frente a todos los fondos
#    (antes 1,33:1). Al enfocar, anillo de 2 px en el color de acento.
rep(
    ".field{width:100%;background:var(--bg-deep);border:1px solid var(--line-strong)",
    ".field{width:100%;background:var(--bg-deep);border:1px solid var(--line-field)",
)
rep(
    ".field:focus{outline:none;border-color:var(--accent);background:var(--surface-1)}",
    ".field:focus{outline:none;border-color:var(--accent);background:var(--surface-1);box-shadow:0 0 0 1px var(--accent)}",
)

# 4. Barras deslizantes (horas de sueño, volumen): 32 px de alto y mando de 24 px.
CSS = """
:root{--line-field: oklch(52% .01 var(--h))}
input[type=range]{-webkit-appearance:none;appearance:none;height:32px;background:transparent;cursor:pointer}
input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:var(--r-full);background:var(--line-field)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;box-sizing:border-box;width:24px;height:24px;margin-top:-9px;border-radius:50%;background:var(--accent);border:3px solid var(--surface-1);box-shadow:0 0 0 1px var(--accent)}
input[type=range]::-moz-range-track{height:6px;border-radius:var(--r-full);background:var(--line-field)}
input[type=range]::-moz-range-thumb{box-sizing:border-box;width:24px;height:24px;border-radius:50%;background:var(--accent);border:3px solid var(--surface-1);box-shadow:0 0 0 1px var(--accent)}
"""
rep("</style>", CSS.strip().replace("\n", "") + "</style>")

open(dst, "w", encoding="utf8").write(s)
print("ok", len(s))
