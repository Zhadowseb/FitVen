// La página de Récords -la sala de trofeos- y la página de un ejercicio.
export default {
  eyebrow: "Biblioteca",
  title: "Récords",
  // La sala de trofeos: todo el historial, sin nada con lo que compararlo.
  trophy: {
    recordCount: { one: "récord logrado", other: "récords logrados" },
    heaviest: "Levantamiento más pesado",
    heaviestValue: "{weight} kg × {reps} · {name}",
    heaviestValuePerSide: "{weight} kg por lado × {reps} · {name}",
    since: "Desde {date}",
    emptyTitle: "Tu primer récord te está esperando",
    emptyBody: "Termina un entrenamiento de fuerza y tu colección empieza aquí.",
    podium: {
      title: "Tus levantamientos más fuertes",
      meta: "× {reps} · {date}",
      label: "Puesto {rank}: {name}, {weight} kg × {reps}",
      labelPerSide: "Puesto {rank}: {name}, {weight} kg por lado × {reps}",
      nextGoal: "Siguiente objetivo: {goal} kg en {name}",
      toGo: "Faltan {value} kg",
    },
    recent: {
      title: "Récords nuevos",
      new: "Nuevo",
      label: "{name}, {weight} kg × {reps}, {when}",
      labelPerSide: "{name}, {weight} kg por lado × {reps}, {when}",
    },
    milestones: {
      title: "Hitos",
      workouts: { one: "{value} entrenamiento", other: "{value} entrenamientos" },
      tonnes: { one: "{value} tonelada levantada", other: "{value} toneladas levantadas" },
      records: { one: "{value} récord", other: "{value} récords" },
      weekStreak: { one: "{value} semana seguida", other: "{value} semanas seguidas" },
      nextUp: "Siguiente: {label}",
      notYet: "Todavía no",
      maxed: "En lo más alto",
    },
    statistics: {
      title: "Ver tus estadísticas",
      body: "Volumen, frecuencia, intensidad y carreras",
    },
  },
  exercise: {
    overline: "Récords",
    estimate: "1RM estimado",
    changeInPeriod: "{change} % en el periodo",
    gapDays: "{count} días",
    nextStep: "Siguiente paso con {reps} reps",
    repsShort: "{reps} REPS",
    noSets: "No hay series con peso en este periodo.",
    bestSet: "Mejor serie {when} · {lift}",
    tryNext: "prueba {target} · hiciste {current}",
    repLadder: "Récord por repeticiones",
    noSet: "sin serie",
    // Bajo una casilla que rellena una serie más larga: 90 kg × 3 también son 90 kg para 1 y 2 reps.
    // Nunca un récord nuevo.
    fromReps: "desde {reps} reps",
    latestSets: "Últimas series",
    pr: "PR",
    periods: {
      "1m": "1M",
      "3m": "3M",
      "6m": "6M",
      "1y": "1A",
      all: "Todo",
    },
  },
};
