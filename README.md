# Studium

Panel para organizar tus estudios: apunta tus horas, mira estadísticas detalladas, marca objetivos diarios y semanales y lleva al día tus tareas, exámenes, notas y calificaciones. Inspirada en el panel de Athenify, sin suscripciones ni pagos.

## Qué incluye

- **Panel**: tiempo de hoy frente a tu objetivo, semana, racha, mes, gráfico semanal por asignatura, mapa de actividad de 6 meses, próximos exámenes, tareas pendientes, objetivos semanales por asignatura y sesiones recientes. Puedes elegir qué bloques ver.
- **Temporizador**: Pomodoro (duraciones configurables, descansos largos, inicio automático, sonido y avisos) o cronómetro. Sigue contando aunque cambies de página o cierres la pestaña. Tiene modo concentración a pantalla completa.
- **Sesiones**: historial con filtros, búsqueda, edición, sesiones añadidas a mano, valoración de concentración y exportación a CSV.
- **Estadísticas**: semana, mes, semestre, año, todo o un rango propio; filtro por asignatura; tiempo por día, semana o mes; acumulado frente al objetivo; reparto por asignatura y por actividad; hora del día; día de la semana; matrices asignatura × actividad y asignatura × semana; mapa de actividad. Cada gráfico de tiempo se puede ver como tabla.
- **Calendario**: horas estudiadas, entregas y exámenes de cada día.
- **Tareas**: deberes, trabajos, proyectos, lecturas… con fecha de entrega, prioridad, subtareas y estado. Vista de lista o tablero.
- **Exámenes**: cuenta atrás, temario, horas de preparación objetivo (cuenta lo que estudias de esa asignatura) y cuántas horas al día te faltan.
- **Calificaciones**: media ponderada por pesos y por créditos, estado de cada asignatura y calculadora de «¿qué nota necesito?». Escalas 0–10, 0–20, 0–100, 1–7 o GPA.
- **Notas**: apuntes con formato Markdown sencillo, etiquetas y notas fijadas.
- **Asignaturas**: color, semestre, profesor/a, créditos, objetivo semanal y horas objetivo del semestre.
- **Objetivos y logros**: objetivo por día de la semana (0 h = día de descanso, no rompe la racha), objetivo semanal, historial de 12 semanas y una sala de trofeos con 28 logros.
- Tema claro/oscuro, diseño para móvil y ordenador, y datos de ejemplo para probarla.

## Cómo usarla

**Opción 1: en internet con GitHub Pages (recomendado)**

1. En GitHub, ve a *Settings → Pages* y en *Source* elige **GitHub Actions**.
2. Pasa estos cambios a la rama `main`. Cada vez que se actualice `main`, la página se publica sola en `https://<tu-usuario>.github.io/Study-App/`.

**Opción 2: archivo local**

Ejecuta `npm install && npm run build` y abre `dist/index.html` con doble clic. Es un único archivo: puedes copiarlo donde quieras.

## Dónde se guardan tus datos

- En la versión de GitHub Pages o en el archivo local, los datos se guardan **en tu navegador** (no se envían a ningún servidor). Si borras los datos del navegador o cambias de dispositivo, se pierden: usa *Ajustes → Descargar copia* de vez en cuando y *Importar copia* para recuperarlos.
- Si abres la app como Artifact en claude.ai, además se guardan **en tu cuenta** y se sincronizan entre dispositivos.

## Desarrollo

```bash
npm install
npm run dev          # servidor de desarrollo
npm test             # pruebas (rachas, objetivos, temporizador, notas, sincronización)
npm run typecheck
npm run build        # genera dist/index.html (un solo archivo)
npm run build:artifact  # genera también dist/artifact.html para claude.ai
```

Hecha con React, TypeScript, Tailwind CSS, Zustand y date-fns. Los gráficos son SVG propios.
