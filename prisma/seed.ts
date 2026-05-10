import { PrismaClient } from '@prisma/client';
import { TRAINING_DB } from '@butterfly/shared';

const prisma = new PrismaClient();

type MetadataSeed = {
  kind: 'compound' | 'isolation';
  primaryMuscles: string[];
  secondaryMuscles: string[];
  stabilizerMuscles: string[];
  instructions: string[];
  commonMistakes: string[];
  technicalCues: string[];
  overloadRecommendation: string;
};

function videoUrl(name: string) {
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(`${name} tecnica ejercicio hipertrofia`)}`;
}

const defaults = {
  instructions: [
    'Controla la fase excentrica y evita rebotes.',
    'Mantene una posicion estable antes de iniciar cada repeticion.',
    'Termina la serie cuando la tecnica deje de ser consistente.'
  ],
  commonMistakes: ['Usar impulso excesivo.', 'Perder rango util de movimiento.', 'Cambiar la postura para mover mas peso.'],
  technicalCues: ['Tension constante.', 'Respiracion ordenada.', 'Repeticiones iguales entre si.']
};

const METADATA: Record<string, MetadataSeed> = {
  e1: { kind: 'compound', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts', 'triceps'], stabilizerMuscles: ['core'], instructions: ['Retracta escapulas y deja el pecho alto antes de sacar la barra.', 'Baja la barra con control hacia la linea media del pecho sin rebotar.', 'Empuja manteniendo gluteos y espalda alta firmes sobre el banco.'], commonMistakes: ['Perder retraccion escapular al final de la serie.', 'Rebotar la barra para completar reps.', 'Subir hombros hacia adelante y sacar tension del pecho.'], technicalCues: ['Pecho arriba.', 'Escapulas clavadas.', 'Empuja en diagonal natural.'], overloadRecommendation: 'Subi 2.5 kg cuando completes 3x8 con RIR 1-2 y sin dolor.' },
  e2: { kind: 'compound', primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps', 'upper_chest'], stabilizerMuscles: ['core'], instructions: ['Arranca con abdomen y gluteos activos para no arquear de mas la espalda.', 'Baja las mancuernas hasta una profundidad estable sin perder muñeca neutra.', 'Empuja arriba siguiendo una linea vertical natural sobre hombro y codo.'], commonMistakes: ['Extender demasiado la zona lumbar.', 'Chocar mancuernas arriba y perder control.', 'Bajar corto por falta de estabilidad.'], technicalCues: ['Costillas abajo.', 'Codos bajo muñeca.', 'Subi sin balanceo.'], overloadRecommendation: 'Subi 1-2 kg por mancuerna cuando completes 3x10 limpio.' },
  e3: { kind: 'isolation', primaryMuscles: ['side_delts'], secondaryMuscles: ['traps'], stabilizerMuscles: ['core'], instructions: ['Inclinate apenas hacia adelante para darle mejor linea al deltoide lateral.', 'Eleva con codos guiando el movimiento y manos relajadas.', 'Baja lento sin perder tension ni soltar las mancuernas de golpe.'], commonMistakes: ['Encoger trapecio para levantar mas peso.', 'Convertirlo en un swing de cuerpo entero.', 'Subir con manos por encima de los codos.'], technicalCues: ['Codo lidera.', 'Trapecio quieto.', 'Bajada lenta.'], overloadRecommendation: 'Primero aumenta reps hasta 15-20; despues subi el minimo peso posible.' },
  e4: { kind: 'compound', primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'front_delts'], stabilizerMuscles: ['core'], instructions: ['Inclina el torso solo lo justo para mantenerte estable y sin dolor.', 'Baja hasta que el hombro tolere un rango fuerte y controlado.', 'Empuja buscando extension potente de codo sin perder posicion corporal.'], commonMistakes: ['Hundir hombros al fondo del movimiento.', 'Acortar demasiado el rango por miedo o fatiga.', 'Rebotar entre reps para sacar impulso.'], technicalCues: ['Hombro estable.', 'Pecho abierto.', 'Subi con codos firmes.'], overloadRecommendation: 'Agrega reps antes de lastrar; si llegas a 12 en todas, suma carga pequena.' },
  e5: { kind: 'isolation', primaryMuscles: ['triceps'], secondaryMuscles: [], stabilizerMuscles: ['core'], instructions: ['Clava los codos cerca del torso antes de iniciar la extension.', 'Empuja la polea hasta bloquear fuerte el triceps sin adelantar hombros.', 'Controla la subida sin perder la posicion de los codos.'], commonMistakes: ['Mover codos hacia adelante en cada rep.', 'Inclinar el torso para convertirlo en empuje corporal.', 'Soltar la fase excentrica.'], technicalCues: ['Codos quietos.', 'Bloqueo fuerte.', 'Subida controlada.'], overloadRecommendation: 'Subi una placa cuando completes 3x15 con codos fijos.' },
  e6: { kind: 'compound', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'upper_back'], stabilizerMuscles: ['core'], instructions: ['Cuelgate con hombros activos antes de empezar cada repeticion.', 'Lleva el pecho hacia la barra pensando en bajar los codos.', 'Desciende completo sin perder control ni soltar la tension.'], commonMistakes: ['Tirar solo con biceps desde el inicio.', 'Acortar el rango sin extender bien abajo.', 'Balancearte para pasar la barbilla.'], technicalCues: ['Pecho a la barra.', 'Codos al bolsillo.', 'Bajada completa.'], overloadRecommendation: 'Suma reps totales; cuando superes el rango con control, agrega lastre.' },
  e7: { kind: 'compound', primaryMuscles: ['upper_back'], secondaryMuscles: ['lats', 'biceps', 'rear_delts'], stabilizerMuscles: ['spinal_erectors', 'core'], instructions: ['Fija una bisagra de cadera estable antes de despegar la barra.', 'Rema llevando codos hacia atras sin cambiar demasiado el angulo del torso.', 'Baja la barra con control hasta sentir estiramiento entre repeticiones.'], commonMistakes: ['Enderezar el torso para hacer trampa.', 'Rebotar la barra desde el suelo o piernas.', 'Acortar rango por fatiga de agarre.'], technicalCues: ['Torso fijo.', 'Barra al ombligo.', 'Estira sin colgarte.'], overloadRecommendation: 'Subi 2.5 kg cuando completes 3x10 sin perder angulo del torso.' },
  e8: { kind: 'compound', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'upper_back'], stabilizerMuscles: ['core'], instructions: ['Inicia cada tiron deprimiendo escapulas antes de flexionar codos.', 'Lleva la barra al pecho alto sin encorvarte hacia adelante.', 'Vuelve arriba manteniendo control y estiramiento del dorsal.'], commonMistakes: ['Tirar la barra con lumbar y torso atras.', 'Subir demasiado rapido y perder tension.', 'Bajar la barra al abdomen en vez del pecho.'], technicalCues: ['Escapula abajo.', 'Pecho arriba.', 'Codos al costado.'], overloadRecommendation: 'Subi carga cuando llegues a 12 reps con depresion escapular clara.' },
  e9: { kind: 'isolation', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], stabilizerMuscles: ['core'], instructions: ['Parte con gluteos y abdomen activos para eliminar el balanceo.', 'Flexiona codo manteniendo hombro quieto y antebrazos como protagonistas.', 'Baja lento hasta casi extender sin relajar completamente el brazo.'], commonMistakes: ['Usar cadera para iniciar cada rep.', 'Despegar codos del cuerpo.', 'Acortar la bajada para sobrevivir la serie.'], technicalCues: ['Sin envion.', 'Codo clavado.', 'Bajada completa.'], overloadRecommendation: 'Subi poco peso cuando completes 3x10 sin balanceo.' },
  e10: { kind: 'isolation', primaryMuscles: ['rear_delts'], secondaryMuscles: ['upper_back'], stabilizerMuscles: ['core'], instructions: ['Mantene pecho apoyado o torso fijo para aislar mejor la parte posterior.', 'Abri con codos suaves buscando separar las manos, no elevar hombros.', 'Hace una pausa breve atras antes de volver con control.'], commonMistakes: ['Elevar trapecios en lugar de abrir hombros.', 'Convertirlo en remo corto.', 'Perder control en la vuelta.'], technicalCues: ['Abri y pausa.', 'Trapecio quieto.', 'No remes.'], overloadRecommendation: 'Prioriza reps y pausa atras antes de aumentar carga.' },
  e11: { kind: 'compound', primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'hamstrings'], stabilizerMuscles: ['core', 'spinal_erectors'], instructions: ['Coloca pies donde puedas bajar profundo manteniendo talon firme y rodilla estable.', 'Inhala grande y bloquea el torso antes de cada repeticion.', 'Baja con control y subi empujando el piso sin colapsar cadera o torso.'], commonMistakes: ['Cortar profundidad por cargar de mas.', 'Levantar talones o desplazar el peso a puntas.', 'Perder rigidez lumbar en el fondo.'], technicalCues: ['Talon pesado.', 'Rodilla sigue pie.', 'Torso duro.'], overloadRecommendation: 'Subi 2.5-5 kg cuando completes 4x8 con profundidad estable.' },
  e12: { kind: 'compound', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings'], stabilizerMuscles: ['core'], instructions: ['Da una zancada que te permita bajar vertical y estable, sin acortar de mas.', 'Controla la rodilla delantera y mantene la pelvis neutra.', 'Empuja desde el pie delantero sin rebotar al subir.'], commonMistakes: ['Dar pasos demasiado cortos y cargar la rodilla.', 'Perder equilibrio y girar el torso.', 'Rebotar abajo para cambiar de pierna.'], technicalCues: ['Paso estable.', 'Pecho alto.', 'Empuja el suelo.'], overloadRecommendation: 'Primero iguala reps por pierna; despues subi mancuernas de a poco.' },
  e13: { kind: 'compound', primaryMuscles: ['upper_chest'], secondaryMuscles: ['front_delts', 'triceps'], stabilizerMuscles: ['core'], instructions: ['Ajusta la inclinacion para sentir pecho superior sin convertirlo en press de hombro.', 'Baja con antebrazos verticales y pecho alto.', 'Empuja en arco corto hacia arriba manteniendo escapulas estables.'], commonMistakes: ['Usar una inclinacion demasiado alta.', 'Perder pecho alto al fatigarte.', 'Rebotar la barra en la parte baja.'], technicalCues: ['Pecho alto.', 'Escapulas firmes.', 'Empuja sin hombrear.'], overloadRecommendation: 'Subi 2.5 kg cuando completes 3x12 con bajada controlada.' },
  e14: { kind: 'isolation', primaryMuscles: ['quads'], secondaryMuscles: [], stabilizerMuscles: [], instructions: ['Alinea la maquina para que la rodilla coincida con el eje de giro.', 'Eleva fuerte hasta contraer cuadriceps y pausa un instante arriba.', 'Baja controlando el peso para no perder tension.'], commonMistakes: ['Levantar la cadera del asiento.', 'Soltar la carga en la bajada.', 'Acortar el bloqueo por quemazon.'], technicalCues: ['Pausa arriba.', 'Cadera quieta.', 'Bajada lenta.'], overloadRecommendation: 'Aumenta reps y pausa arriba; luego subi una placa.' },
  e15: { kind: 'isolation', primaryMuscles: ['calves'], secondaryMuscles: [], stabilizerMuscles: [], instructions: ['Busca maximo estiramiento abajo sin despegar la punta del pie.', 'Subi hasta contraer fuerte gemelo y soleo, con pausa breve.', 'Evita rebotar: cada rep tiene que ser completa y controlada.'], commonMistakes: ['Hacer reps cortas y rapidas.', 'Rebotar en el fondo del movimiento.', 'No pausar arriba.'], technicalCues: ['Estira abajo.', 'Pausa arriba.', 'Nada de rebote.'], overloadRecommendation: 'Subi reps hasta 20 con estiramiento abajo; luego aumenta carga.' },
  e16: { kind: 'isolation', primaryMuscles: ['side_delts'], secondaryMuscles: ['traps'], stabilizerMuscles: ['core'], instructions: ['Sentate firme y deja el torso quieto para que el deltoide lateral haga el trabajo.', 'Eleva con codos guiando el movimiento, no con manos tirando del peso.', 'Baja lento manteniendo tension para que cada rep sea estricta.'], commonMistakes: ['Encoger trapecios para terminar la serie.', 'Usar envion de torso o piernas.', 'Subir con manos por encima de codos.'], technicalCues: ['Codo lidera.', 'Torso quieto.', 'Bajada lenta.'], overloadRecommendation: 'Gana reps estrictas antes de subir peso.' },
  e17: { kind: 'isolation', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts'], stabilizerMuscles: ['core'], instructions: ['Ajusta la polea para sentir estiramiento del pecho sin perder hombro estable.', 'Cierra en abrazo amplio pensando en juntar biceps al frente del torso.', 'Vuelve controlado para cargar la apertura sin soltarte.'], commonMistakes: ['Doblar demasiado codos y convertirlo en press.', 'Acortar rango por usar mas peso del que controlas.', 'Perder pecho arriba al cerrar.'], technicalCues: ['Abraza fuerte.', 'Pecho arriba.', 'Estira sin soltar.'], overloadRecommendation: 'Subi una placa cuando completes 20 reps con cierre fuerte.' },
  e18: { kind: 'isolation', primaryMuscles: ['biceps', 'forearms'], secondaryMuscles: [], stabilizerMuscles: ['core'], instructions: ['Mantene mu?eca neutra y codo cerca del cuerpo desde la primera rep.', 'Flexiona pensando en llevar el pulgar hacia el hombro sin balancear.', 'Baja con control para no perder tension del braquial y antebrazo.'], commonMistakes: ['Girar demasiado la mu?eca y perder el foco martillo.', 'Balancear el torso para iniciar el movimiento.', 'Acortar la excentrica por fatiga.'], technicalCues: ['Mu?eca neutra.', 'Sin balanceo.', 'Bajada completa.'], overloadRecommendation: 'Subi peso solo si no aparece balanceo y mantenes mu?eca neutra.' },
  e19: { kind: 'compound', primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'front_delts'], stabilizerMuscles: ['core'], instructions: ['Apoya manos firmes y coloca los pies donde puedas bajar sin dolor de hombro.', 'Desciende hasta un rango fuerte y seguro manteniendo codos bajo control.', 'Empuja buscando fallo tecnico real, no reps deformadas.'], commonMistakes: ['Ir demasiado profundo y perder hombro estable.', 'Separar codos de forma excesiva.', 'Seguir despues de perder el control tecnico.'], technicalCues: ['Controla fondo.', 'Empuja limpio.', 'Fallo tecnico, no caos.'], overloadRecommendation: 'Suma reps al fallo tecnico; despues agrega carga si es seguro.' },
  e20: { kind: 'compound', primaryMuscles: ['lats'], secondaryMuscles: ['chest', 'triceps'], stabilizerMuscles: ['core'], instructions: ['Acostate transversal o longitudinal segun mejor controle tu caja toracica.', 'Baja la mancuerna en arco sintiendo expansion y estiramiento del dorsal.', 'Vuelve cerrando costillas y llevando brazos al punto inicial sin doblar de mas el codo.'], commonMistakes: ['Convertirlo en extension de triceps.', 'Perder costillas y arquear demasiado la lumbar.', 'Acortar el recorrido por miedo al estiramiento.'], technicalCues: ['Arco largo.', 'Costillas controladas.', 'Senti el dorsal.'], overloadRecommendation: 'Subi reps hasta 15 con arco estable; luego aumenta mancuerna.' },
  e21: { kind: 'compound', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'front_delts'], stabilizerMuscles: ['core'], instructions: ['Arma una plancha fuerte desde hombros hasta tobillos antes de arrancar.', 'Baja con control hasta un rango donde el pecho siga llevando el movimiento.', 'Empuja sin romper alineacion corporal ni sacar la cadera.'], commonMistakes: ['Colgar la cadera y perder la plancha.', 'Acortar rango por fatiga.', 'Sacar cabeza al frente para completar reps.'], technicalCues: ['Cuerpo en bloque.', 'Pecho al piso.', 'Empuja sin colapsar.'], overloadRecommendation: 'Suma reps totales o eleva pies antes de agregar carga.' },
  e22: { kind: 'compound', primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes', 'spinal_erectors'], stabilizerMuscles: ['core', 'upper_back'], instructions: ['Clava axilas y abdomen antes de iniciar la bisagra.', 'Empuja cadera hacia atras manteniendo barra pegada a piernas y espalda neutra.', 'Sube apretando gluteos sin hiperextender la lumbar al final.'], commonMistakes: ['Doblar rodillas de mas y volverlo sentadilla.', 'Separar la barra del cuerpo.', 'Perder neutralidad lumbar por buscar mas rango del que controlas.'], technicalCues: ['Cadera atras.', 'Barra pegada.', 'Subi con gluteo.'], overloadRecommendation: 'Subi 2.5-5 kg cuando completes 4x10 manteniendo bisagra y espalda neutra.' },
  e23: { kind: 'compound', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'quads'], stabilizerMuscles: ['core'], instructions: ['Coloca espalda alta firme en el banco y pies donde el tibial quede estable arriba.', 'Empuja con talones buscando retroversion pelvica al final del movimiento.', 'Pausa arriba apretando gluteos antes de bajar controlado.'], commonMistakes: ['Subir con lumbar en vez de gluteos.', 'Poner pies demasiado lejos o demasiado cerca.', 'No pausar arriba y rebotar abajo.'], technicalCues: ['Talon firme.', 'Pausa arriba.', 'Gluteo manda.'], overloadRecommendation: 'Subi carga cuando completes 3x12 con pausa arriba.' },
  e24: { kind: 'isolation', primaryMuscles: ['abs'], secondaryMuscles: [], stabilizerMuscles: ['core'], instructions: ['Arrodillate estable y fija la cadera para que el abdomen flexione la columna.', 'Lleva costillas hacia pelvis en vez de tirar solo con brazos.', 'Regresa lento sin perder la tension del abdomen.'], commonMistakes: ['Transformarlo en jalon de brazos.', 'Mover demasiado la cadera.', 'No cerrar realmente el torso en la contraccion.'], technicalCues: ['Costillas a pelvis.', 'Brazos acompa?an.', 'Contrae fuerte.'], overloadRecommendation: 'Aumenta reps o carga si podes flexionar columna sin tirar con brazos.' },
  e25: { kind: 'isolation', primaryMuscles: ['abs', 'hip_flexors'], secondaryMuscles: [], stabilizerMuscles: ['core'], instructions: ['Arranca con pelvis en retroversion para que el abdomen participe de verdad.', 'Eleva piernas sin balancear ni despegar el torso de forma caotica.', 'Baja lento evitando perder control lumbar.'], commonMistakes: ['Hacer swing con piernas para sumar reps.', 'No controlar la bajada.', 'Trabajar solo flexores sin cerrar pelvis.'], technicalCues: ['Retroversion primero.', 'Sin swing.', 'Bajada controlada.'], overloadRecommendation: 'Suma reps estrictas antes de agregar lastre.' },
  e26: { kind: 'isolation', primaryMuscles: ['calves'], secondaryMuscles: [], stabilizerMuscles: [], instructions: ['Apoya la parte delantera del pie donde puedas lograr buen estiramiento abajo.', 'Subi fuerte hasta maxima contraccion sin desviar tobillos.', 'Baja controlado buscando rango completo en cada repeticion.'], commonMistakes: ['Hacer reps cortas y rapidas.', 'Dejar caer el peso sin controlar.', 'No usar pausa arriba.'], technicalCues: ['Rango completo.', 'Pausa arriba.', 'Nada de rebote.'], overloadRecommendation: 'Aumenta reps con pausa arriba y estiramiento abajo antes de subir peso.' }
};

function planSnapshot() {
  return Object.entries(TRAINING_DB).map(([cycleDay, day]) => ({
    cycleDay: Number(cycleDay),
    name: day.name,
    exercises: day.exercises.map((exercise, index) => ({ ...exercise, order: index + 1, active: true }))
  }));
}

async function main() {
  const snapshot = planSnapshot();

  await prisma.planTemplate.upsert({
    where: { name: 'Butterfly Base Hypertrophy Plan' },
    update: { data: snapshot },
    create: { name: 'Butterfly Base Hypertrophy Plan', data: snapshot }
  });

  const activePlan = await prisma.userPlan.findFirst({ where: { active: true } });
  if (!activePlan) {
    await prisma.userPlan.create({ data: { name: 'Agustin Active Plan', active: true, data: snapshot } });
  }

  for (const [cycleDayRaw, day] of Object.entries(TRAINING_DB)) {
    const cycleDay = Number(cycleDayRaw);
    const trainingDay = await prisma.trainingDay.upsert({
      where: { cycleDay },
      update: { name: day.name },
      create: { cycleDay, name: day.name }
    });

    for (const [index, exercise] of day.exercises.entries()) {
      const savedExercise = await prisma.exercise.upsert({
        where: { sourceId: exercise.id },
        update: {
          trainingDayId: trainingDay.id,
          name: exercise.name,
          sets: exercise.sets,
          targetReps: exercise.reps,
          rpe: String(exercise.rpe),
          restSeconds: exercise.rest,
          breath: exercise.breath,
          warmup: exercise.warmup,
          active: true,
          order: index + 1
        },
        create: {
          trainingDayId: trainingDay.id,
          sourceId: exercise.id,
          name: exercise.name,
          sets: exercise.sets,
          targetReps: exercise.reps,
          rpe: String(exercise.rpe),
          restSeconds: exercise.rest,
          breath: exercise.breath,
          warmup: exercise.warmup,
          active: true,
          order: index + 1
        }
      });

      const metadata = METADATA[exercise.id];
      if (metadata) {
        await prisma.exerciseMetadata.upsert({
          where: { exerciseId: savedExercise.id },
          update: { ...metadata, videoUrl: videoUrl(exercise.name) },
          create: { exerciseId: savedExercise.id, ...metadata, videoUrl: videoUrl(exercise.name) }
        });
      }
    }
  }
}

main().finally(async () => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
