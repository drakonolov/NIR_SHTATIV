import {
  Station,
  TargetPoint,
  ObjectiveMetric,
  ClockModel,
  BoundaryLimits,
  HookeJeevesConfig,
  OptimizationStepLog,
  BenchmarkResult,
  AlgorithmType
} from '../types/navigation';
import { evaluateObjective } from '../utils/mathDOP';

/**
 * Deep clone a list of stations
 */
export function cloneStations(stations: Station[]): Station[] {
  return stations.map(s => ({ ...s }));
}

/**
 * Clamp station coordinates to boundary limits
 */
export function clampStationToBounds(station: Station, bounds: BoundaryLimits): Station {
  return {
    ...station,
    x: Math.max(bounds.minX, Math.min(bounds.maxX, station.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, station.y)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, station.z))
  };
}

/**
 * Hooke-Jeeves Pattern Search Generator
 * Yields state at each iteration for interactive step-by-step visualization and animation.
 */
export function* runHookeJeevesGenerator(
  initialStations: Station[],
  targets: TargetPoint[],
  bounds: BoundaryLimits,
  config: HookeJeevesConfig,
  metric: ObjectiveMetric,
  clockModel: ClockModel,
  elevationMaskDeg: number = 0
): Generator<OptimizationStepLog, Station[], unknown> {
  let evaluations = 0;
  let currentStep = config.initialStep;
  let baseStations = cloneStations(initialStations);

  const evalFn = (sts: Station[]) => {
    evaluations++;
    return evaluateObjective(sts, targets, metric, clockModel, elevationMaskDeg).score;
  };

  let bestScore = evalFn(baseStations);

  yield {
    iteration: 0,
    stepType: 'init',
    description: `Инициализация метода Хука-Дживса. Базовый функционал качества F = ${bestScore.toFixed(3)}, шаг Δ = ${currentStep}м`,
    bestValue: bestScore,
    currentStepSize: currentStep,
    evaluations,
    stations: cloneStations(baseStations)
  };

  let iteration = 0;

  while (currentStep >= config.tolerance && iteration < config.maxIterations) {
    iteration++;
    const probedPoints: { stationIdx: number; x: number; y: number; z: number; value: number }[] = [];

    // --- 1. EXPLORATORY MOVE (Исследовательский поиск) around baseStations ---
    let tempStations = cloneStations(baseStations);
    let improvedInExploration = false;

    for (let i = 0; i < tempStations.length; i++) {
      if (tempStations[i].fixed || !tempStations[i].enabled) continue;

      // Coordinate axes to explore: X, Y, and optionally Z
      const axes: ('x' | 'y' | 'z')[] = config.optimizeZ ? ['x', 'y', 'z'] : ['x', 'y'];

      for (const axis of axes) {
        const stepVal = axis === 'z' ? Math.max(2, currentStep * 0.15) : currentStep;
        const originalVal = tempStations[i][axis];

        // Try positive step: +step
        tempStations[i][axis] = originalVal + stepVal;
        tempStations[i] = clampStationToBounds(tempStations[i], bounds);
        const scorePlus = evalFn(tempStations);
        probedPoints.push({
          stationIdx: i,
          x: tempStations[i].x,
          y: tempStations[i].y,
          z: tempStations[i].z,
          value: scorePlus
        });

        if (scorePlus < bestScore) {
          bestScore = scorePlus;
          improvedInExploration = true;
          // Keep the positive coordinate
          continue;
        }

        // Try negative step: -step
        tempStations[i][axis] = originalVal - stepVal;
        tempStations[i] = clampStationToBounds(tempStations[i], bounds);
        const scoreMinus = evalFn(tempStations);
        probedPoints.push({
          stationIdx: i,
          x: tempStations[i].x,
          y: tempStations[i].y,
          z: tempStations[i].z,
          value: scoreMinus
        });

        if (scoreMinus < bestScore) {
          bestScore = scoreMinus;
          improvedInExploration = true;
          // Keep negative coordinate
          continue;
        }

        // Revert to original coordinate
        tempStations[i][axis] = originalVal;
      }
    }

    if (improvedInExploration) {
      // Successful exploratory move!
      yield {
        iteration,
        stepType: 'explore',
        description: `Итерация ${iteration}: Успешный исследовательский поиск. Найдено улучшение F = ${bestScore.toFixed(3)}`,
        bestValue: bestScore,
        currentStepSize: currentStep,
        evaluations,
        stations: cloneStations(tempStations),
        probedPoints
      };

      // --- 2. PATTERN MOVE (Поиск по образцу / Ускоряющий шаг) ---
      // Extrapolate in the direction of improvement: P = temp + factor * (temp - base)
      const patternStations = cloneStations(tempStations);
      for (let i = 0; i < patternStations.length; i++) {
        if (patternStations[i].fixed || !patternStations[i].enabled) continue;
        const dx = tempStations[i].x - baseStations[i].x;
        const dy = tempStations[i].y - baseStations[i].y;
        const dz = tempStations[i].z - baseStations[i].z;

        patternStations[i].x += config.patternFactor * dx;
        patternStations[i].y += config.patternFactor * dy;
        patternStations[i].z += config.patternFactor * dz;
        patternStations[i] = clampStationToBounds(patternStations[i], bounds);
      }

      // Perform exploratory move around pattern point
      let testStations = cloneStations(patternStations);
      let patternEvalScore = evalFn(testStations);

      for (let i = 0; i < testStations.length; i++) {
        if (testStations[i].fixed || !testStations[i].enabled) continue;
        const axes: ('x' | 'y' | 'z')[] = config.optimizeZ ? ['x', 'y', 'z'] : ['x', 'y'];

        for (const axis of axes) {
          const stepVal = axis === 'z' ? Math.max(2, currentStep * 0.15) : currentStep;
          const orig = testStations[i][axis];

          testStations[i][axis] = orig + stepVal;
          testStations[i] = clampStationToBounds(testStations[i], bounds);
          const scPlus = evalFn(testStations);
          if (scPlus < patternEvalScore) {
            patternEvalScore = scPlus;
            continue;
          }

          testStations[i][axis] = orig - stepVal;
          testStations[i] = clampStationToBounds(testStations[i], bounds);
          const scMinus = evalFn(testStations);
          if (scMinus < patternEvalScore) {
            patternEvalScore = scMinus;
            continue;
          }

          testStations[i][axis] = orig;
        }
      }

      // If pattern search improved beyond previous best
      if (patternEvalScore < bestScore) {
        bestScore = patternEvalScore;
        baseStations = cloneStations(tempStations);
        tempStations = cloneStations(testStations);

        yield {
          iteration,
          stepType: 'pattern',
          description: `Итерация ${iteration}: Успешный шаг по образцу (Pattern Move). Новое лучшее значение F = ${bestScore.toFixed(3)}`,
          bestValue: bestScore,
          currentStepSize: currentStep,
          evaluations,
          stations: cloneStations(tempStations)
        };
      } else {
        // Pattern move didn't help, establish tempStations as new base
        baseStations = cloneStations(tempStations);
      }

    } else {
      // --- 3. STEP SHRINK (Сжатие сетки шага) ---
      currentStep *= config.stepReduction;

      yield {
        iteration,
        stepType: 'shrink',
        description: `Итерация ${iteration}: Улучшений в окрестности нет. Сжатие шага Δ: ${ (currentStep / config.stepReduction).toFixed(1) }м → ${currentStep.toFixed(1)}м`,
        bestValue: bestScore,
        currentStepSize: currentStep,
        evaluations,
        stations: cloneStations(baseStations)
      };
    }
  }

  yield {
    iteration,
    stepType: 'converged',
    description: `Оптимизация завершена! Критерий остановки (Δ < ${config.tolerance}м или макс. итераций). F = ${bestScore.toFixed(3)}, обращений к целевой функции: ${evaluations}`,
    bestValue: bestScore,
    currentStepSize: currentStep,
    evaluations,
    stations: cloneStations(baseStations)
  };

  return baseStations;
}

/**
 * Fast synchronous Hooke-Jeeves execution
 */
export function runHookeJeevesSync(
  initialStations: Station[],
  targets: TargetPoint[],
  bounds: BoundaryLimits,
  config: HookeJeevesConfig,
  metric: ObjectiveMetric,
  clockModel: ClockModel,
  elevationMaskDeg: number = 0
): { stations: Station[]; evaluations: number; iterations: number; history: { iteration: number; value: number }[] } {
  const gen = runHookeJeevesGenerator(initialStations, targets, bounds, config, metric, clockModel, elevationMaskDeg);
  let result: Station[] = initialStations;
  const history: { iteration: number; value: number }[] = [];
  let evals = 0;
  let iters = 0;

  let step = gen.next();
  while (!step.done) {
    if (step.value) {
      evals = step.value.evaluations;
      iters = step.value.iteration;
      history.push({ iteration: step.value.iteration, value: step.value.bestValue });
      result = step.value.stations;
    }
    step = gen.next();
  }

  if (step.value) {
    result = step.value;
  }

  return { stations: result, evaluations: evals, iterations: iters, history };
}

/**
 * Particle Swarm Optimization (PSO) for station topology
 */
export function runPSOSync(
  initialStations: Station[],
  targets: TargetPoint[],
  bounds: BoundaryLimits,
  metric: ObjectiveMetric,
  clockModel: ClockModel,
  elevationMaskDeg: number = 0,
  swarmSize: number = 25,
  maxIterations: number = 60
): { stations: Station[]; evaluations: number; iterations: number; history: { iteration: number; value: number }[] } {
  let evaluations = 0;
  const evalFn = (sts: Station[]) => {
    evaluations++;
    return evaluateObjective(sts, targets, metric, clockModel, elevationMaskDeg).score;
  };

  // Extract variables: for each non-fixed station, x, y, and z
  const variableIndices: number[] = [];
  initialStations.forEach((s, idx) => {
    if (!s.fixed && s.enabled) variableIndices.push(idx);
  });

  const numVars = variableIndices.length * 3;
  if (numVars === 0) {
    return { stations: cloneStations(initialStations), evaluations: 0, iterations: 0, history: [] };
  }

  // Helper to convert vector to stations
  const vectorToStations = (vec: number[]): Station[] => {
    const copy = cloneStations(initialStations);
    let ptr = 0;
    for (const sIdx of variableIndices) {
      copy[sIdx].x = Math.max(bounds.minX, Math.min(bounds.maxX, vec[ptr++]));
      copy[sIdx].y = Math.max(bounds.minY, Math.min(bounds.maxY, vec[ptr++]));
      copy[sIdx].z = Math.max(bounds.minZ, Math.min(bounds.maxZ, vec[ptr++]));
    }
    return copy;
  };

  // Convert station to vector
  const stationsToVector = (sts: Station[]): number[] => {
    const vec: number[] = [];
    for (const sIdx of variableIndices) {
      vec.push(sts[sIdx].x, sts[sIdx].y, sts[sIdx].z);
    }
    return vec;
  };

  const initialVec = stationsToVector(initialStations);

  // Initialize swarm
  interface Particle {
    pos: number[];
    vel: number[];
    bestPos: number[];
    bestScore: number;
    currentScore: number;
  }

  const swarm: Particle[] = [];
  let gBestPos = [...initialVec];
  let gBestScore = evalFn(initialStations);

  // Particle 0 is seeded with initial stations
  swarm.push({
    pos: [...initialVec],
    vel: new Array(numVars).fill(0),
    bestPos: [...initialVec],
    bestScore: gBestScore,
    currentScore: gBestScore
  });

  // Random particles around initial position
  for (let p = 1; p < swarmSize; p++) {
    const pos: number[] = [];
    const vel: number[] = [];
    let ptr = 0;
    for (let v = 0; v < variableIndices.length; v++) {
      // x
      pos.push(bounds.minX + Math.random() * (bounds.maxX - bounds.minX));
      vel.push((Math.random() - 0.5) * 200);
      // y
      pos.push(bounds.minY + Math.random() * (bounds.maxY - bounds.minY));
      vel.push((Math.random() - 0.5) * 200);
      // z
      pos.push(bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ));
      vel.push((Math.random() - 0.5) * 10);
    }
    const score = evalFn(vectorToStations(pos));
    if (score < gBestScore) {
      gBestScore = score;
      gBestPos = [...pos];
    }
    swarm.push({
      pos,
      vel,
      bestPos: [...pos],
      bestScore: score,
      currentScore: score
    });
  }

  const history: { iteration: number; value: number }[] = [{ iteration: 0, value: gBestScore }];

  // PSO loop parameters
  const wMax = 0.9;
  const wMin = 0.4;
  const c1 = 1.6; // cognitive
  const c2 = 1.6; // social

  for (let iter = 1; iter <= maxIterations; iter++) {
    const w = wMax - ((wMax - wMin) * iter) / maxIterations;

    for (const particle of swarm) {
      for (let i = 0; i < numVars; i++) {
        const r1 = Math.random();
        const r2 = Math.random();
        // Update velocity
        particle.vel[i] =
          w * particle.vel[i] +
          c1 * r1 * (particle.bestPos[i] - particle.pos[i]) +
          c2 * r2 * (gBestPos[i] - particle.pos[i]);

        // Max velocity clamp
        const maxV = (i % 3 === 2) ? 25 : 500;
        particle.vel[i] = Math.max(-maxV, Math.min(maxV, particle.vel[i]));

        // Update position
        particle.pos[i] += particle.vel[i];

        // Bounds clamp
        const isX = i % 3 === 0;
        const isY = i % 3 === 1;
        const isZ = i % 3 === 2;
        if (isX) particle.pos[i] = Math.max(bounds.minX, Math.min(bounds.maxX, particle.pos[i]));
        if (isY) particle.pos[i] = Math.max(bounds.minY, Math.min(bounds.maxY, particle.pos[i]));
        if (isZ) particle.pos[i] = Math.max(bounds.minZ, Math.min(bounds.maxZ, particle.pos[i]));
      }

      // Evaluate
      const score = evalFn(vectorToStations(particle.pos));
      particle.currentScore = score;
      if (score < particle.bestScore) {
        particle.bestScore = score;
        particle.bestPos = [...particle.pos];

        if (score < gBestScore) {
          gBestScore = score;
          gBestPos = [...particle.pos];
        }
      }
    }

    history.push({ iteration: iter, value: gBestScore });
  }

  return {
    stations: vectorToStations(gBestPos),
    evaluations,
    iterations: maxIterations,
    history
  };
}

/**
 * Genetic Algorithm (GA) with real-valued encoding and elitism
 */
export function runGASync(
  initialStations: Station[],
  targets: TargetPoint[],
  bounds: BoundaryLimits,
  metric: ObjectiveMetric,
  clockModel: ClockModel,
  elevationMaskDeg: number = 0,
  popSize: number = 24,
  generations: number = 40
): { stations: Station[]; evaluations: number; iterations: number; history: { iteration: number; value: number }[] } {
  let evaluations = 0;
  const evalFn = (sts: Station[]) => {
    evaluations++;
    return evaluateObjective(sts, targets, metric, clockModel, elevationMaskDeg).score;
  };

  const variableIndices: number[] = [];
  initialStations.forEach((s, idx) => {
    if (!s.fixed && s.enabled) variableIndices.push(idx);
  });
  const numVars = variableIndices.length * 3;

  const vectorToStations = (vec: number[]): Station[] => {
    const copy = cloneStations(initialStations);
    let ptr = 0;
    for (const sIdx of variableIndices) {
      copy[sIdx].x = Math.max(bounds.minX, Math.min(bounds.maxX, vec[ptr++]));
      copy[sIdx].y = Math.max(bounds.minY, Math.min(bounds.maxY, vec[ptr++]));
      copy[sIdx].z = Math.max(bounds.minZ, Math.min(bounds.maxZ, vec[ptr++]));
    }
    return copy;
  };

  const stationsToVector = (sts: Station[]): number[] => {
    const vec: number[] = [];
    for (const sIdx of variableIndices) {
      vec.push(sts[sIdx].x, sts[sIdx].y, sts[sIdx].z);
    }
    return vec;
  };

  interface Individual {
    genome: number[];
    fitness: number;
  }

  let population: Individual[] = [];
  const baseVec = stationsToVector(initialStations);
  population.push({ genome: [...baseVec], fitness: evalFn(initialStations) });

  for (let i = 1; i < popSize; i++) {
    const genome: number[] = [];
    for (let v = 0; v < variableIndices.length; v++) {
      genome.push(bounds.minX + Math.random() * (bounds.maxX - bounds.minX));
      genome.push(bounds.minY + Math.random() * (bounds.maxY - bounds.minY));
      genome.push(bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ));
    }
    population.push({ genome, fitness: evalFn(vectorToStations(genome)) });
  }

  population.sort((a, b) => a.fitness - b.fitness);
  const history: { iteration: number; value: number }[] = [{ iteration: 0, value: population[0].fitness }];

  for (let gen = 1; gen <= generations; gen++) {
    const nextPop: Individual[] = [population[0]]; // Elitism (keep 1 best)

    while (nextPop.length < popSize) {
      // Tournament selection
      const tourney = (k = 3): Individual => {
        let best = population[Math.floor(Math.random() * population.length)];
        for (let i = 1; i < k; i++) {
          const cand = population[Math.floor(Math.random() * population.length)];
          if (cand.fitness < best.fitness) best = cand;
        }
        return best;
      };

      const parent1 = tourney();
      const parent2 = tourney();

      // BLX-alpha crossover
      const childGenome: number[] = [];
      const alpha = 0.3;
      for (let j = 0; j < numVars; j++) {
        const cmin = Math.min(parent1.genome[j], parent2.genome[j]);
        const cmax = Math.max(parent1.genome[j], parent2.genome[j]);
        const range = cmax - cmin;
        let val = cmin - alpha * range + Math.random() * (range + 2 * alpha * range);

        // Mutation (15% chance per gene)
        if (Math.random() < 0.15) {
          const isZ = j % 3 === 2;
          const noise = (Math.random() - 0.5) * (isZ ? 20 : 300);
          val += noise;
        }

        // Clamp
        const isX = j % 3 === 0;
        const isY = j % 3 === 1;
        const isZ = j % 3 === 2;
        if (isX) val = Math.max(bounds.minX, Math.min(bounds.maxX, val));
        if (isY) val = Math.max(bounds.minY, Math.min(bounds.maxY, val));
        if (isZ) val = Math.max(bounds.minZ, Math.min(bounds.maxZ, val));

        childGenome.push(val);
      }

      nextPop.push({ genome: childGenome, fitness: evalFn(vectorToStations(childGenome)) });
    }

    population = nextPop;
    population.sort((a, b) => a.fitness - b.fitness);
    history.push({ iteration: gen, value: population[0].fitness });
  }

  return {
    stations: vectorToStations(population[0].genome),
    evaluations,
    iterations: generations,
    history
  };
}

/**
 * Nelder-Mead Simplex optimization
 */
export function runNelderMeadSync(
  initialStations: Station[],
  targets: TargetPoint[],
  bounds: BoundaryLimits,
  metric: ObjectiveMetric,
  clockModel: ClockModel,
  elevationMaskDeg: number = 0,
  maxIters: number = 100
): { stations: Station[]; evaluations: number; iterations: number; history: { iteration: number; value: number }[] } {
  let evaluations = 0;
  const evalFn = (sts: Station[]) => {
    evaluations++;
    return evaluateObjective(sts, targets, metric, clockModel, elevationMaskDeg).score;
  };

  const variableIndices: number[] = [];
  initialStations.forEach((s, idx) => {
    if (!s.fixed && s.enabled) variableIndices.push(idx);
  });
  const dim = variableIndices.length * 3;

  const vectorToStations = (vec: number[]): Station[] => {
    const copy = cloneStations(initialStations);
    let ptr = 0;
    for (const sIdx of variableIndices) {
      copy[sIdx].x = Math.max(bounds.minX, Math.min(bounds.maxX, vec[ptr++]));
      copy[sIdx].y = Math.max(bounds.minY, Math.min(bounds.maxY, vec[ptr++]));
      copy[sIdx].z = Math.max(bounds.minZ, Math.min(bounds.maxZ, vec[ptr++]));
    }
    return copy;
  };

  const stationsToVector = (sts: Station[]): number[] => {
    const vec: number[] = [];
    for (const sIdx of variableIndices) {
      vec.push(sts[sIdx].x, sts[sIdx].y, sts[sIdx].z);
    }
    return vec;
  };

  const x0 = stationsToVector(initialStations);

  // Build simplex of dim + 1 points
  interface SimplexVertex {
    point: number[];
    score: number;
  }

  const simplex: SimplexVertex[] = [];
  simplex.push({ point: [...x0], score: evalFn(initialStations) });

  for (let i = 0; i < dim; i++) {
    const pt = [...x0];
    const isZ = i % 3 === 2;
    pt[i] += isZ ? 20 : 300;
    simplex.push({ point: pt, score: evalFn(vectorToStations(pt)) });
  }

  const history: { iteration: number; value: number }[] = [];

  const alpha = 1.0; // reflection
  const gamma = 2.0; // expansion
  const rho = 0.5;   // contraction
  const sigma = 0.5; // shrink

  for (let iter = 0; iter < maxIters; iter++) {
    simplex.sort((a, b) => a.score - b.score);
    history.push({ iteration: iter, value: simplex[0].score });

    const best = simplex[0];
    const worst = simplex[dim];
    const secondWorst = simplex[dim - 1];

    // Compute centroid of all vertices except worst
    const centroid = new Array(dim).fill(0);
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        centroid[j] += simplex[i].point[j];
      }
    }
    for (let j = 0; j < dim; j++) {
      centroid[j] /= dim;
    }

    // 1. Reflection
    const xr = new Array(dim).fill(0);
    for (let j = 0; j < dim; j++) {
      xr[j] = centroid[j] + alpha * (centroid[j] - worst.point[j]);
    }
    const scoreR = evalFn(vectorToStations(xr));

    if (scoreR < secondWorst.score && scoreR >= best.score) {
      simplex[dim] = { point: xr, score: scoreR };
      continue;
    }

    // 2. Expansion
    if (scoreR < best.score) {
      const xe = new Array(dim).fill(0);
      for (let j = 0; j < dim; j++) {
        xe[j] = centroid[j] + gamma * (xr[j] - centroid[j]);
      }
      const scoreE = evalFn(vectorToStations(xe));
      if (scoreE < scoreR) {
        simplex[dim] = { point: xe, score: scoreE };
      } else {
        simplex[dim] = { point: xr, score: scoreR };
      }
      continue;
    }

    // 3. Contraction
    const xc = new Array(dim).fill(0);
    for (let j = 0; j < dim; j++) {
      xc[j] = centroid[j] + rho * (worst.point[j] - centroid[j]);
    }
    const scoreC = evalFn(vectorToStations(xc));
    if (scoreC < worst.score) {
      simplex[dim] = { point: xc, score: scoreC };
      continue;
    }

    // 4. Shrink
    for (let i = 1; i <= dim; i++) {
      for (let j = 0; j < dim; j++) {
        simplex[i].point[j] = best.point[j] + sigma * (simplex[i].point[j] - best.point[j]);
      }
      simplex[i].score = evalFn(vectorToStations(simplex[i].point));
    }
  }

  simplex.sort((a, b) => a.score - b.score);
  return {
    stations: vectorToStations(simplex[0].point),
    evaluations,
    iterations: maxIters,
    history
  };
}

/**
 * Simulated Annealing
 */
export function runSimulatedAnnealingSync(
  initialStations: Station[],
  targets: TargetPoint[],
  bounds: BoundaryLimits,
  metric: ObjectiveMetric,
  clockModel: ClockModel,
  elevationMaskDeg: number = 0,
  maxIters: number = 150
): { stations: Station[]; evaluations: number; iterations: number; history: { iteration: number; value: number }[] } {
  let evaluations = 0;
  const evalFn = (sts: Station[]) => {
    evaluations++;
    return evaluateObjective(sts, targets, metric, clockModel, elevationMaskDeg).score;
  };

  let currentStations = cloneStations(initialStations);
  let currentScore = evalFn(currentStations);

  let bestStations = cloneStations(currentStations);
  let bestScore = currentScore;

  let temp = 100.0;
  const coolingRate = 0.96;
  const history: { iteration: number; value: number }[] = [];

  for (let iter = 0; iter < maxIters; iter++) {
    history.push({ iteration: iter, value: bestScore });

    // Generate neighbor
    const neighbor = cloneStations(currentStations);
    // Perturb one random station
    const activeIndices = neighbor
      .map((s, idx) => (!s.fixed && s.enabled ? idx : -1))
      .filter(idx => idx >= 0);

    if (activeIndices.length > 0) {
      const idx = activeIndices[Math.floor(Math.random() * activeIndices.length)];
      const stepScale = (temp / 100.0) * 400 + 30;
      neighbor[idx].x += (Math.random() - 0.5) * stepScale;
      neighbor[idx].y += (Math.random() - 0.5) * stepScale;
      neighbor[idx].z += (Math.random() - 0.5) * (stepScale * 0.1);
      neighbor[idx] = clampStationToBounds(neighbor[idx], bounds);

      const nScore = evalFn(neighbor);
      const delta = nScore - currentScore;

      if (delta < 0 || Math.exp(-delta / temp) > Math.random()) {
        currentStations = neighbor;
        currentScore = nScore;
        if (nScore < bestScore) {
          bestScore = nScore;
          bestStations = cloneStations(neighbor);
        }
      }
    }

    temp *= coolingRate;
  }

  return {
    stations: bestStations,
    evaluations,
    iterations: maxIters,
    history
  };
}

/**
 * Benchmark runner comparing all algorithms on identical setup
 */
export function runBenchmark(
  initialStations: Station[],
  targets: TargetPoint[],
  bounds: BoundaryLimits,
  config: HookeJeevesConfig,
  metric: ObjectiveMetric,
  clockModel: ClockModel,
  elevationMaskDeg: number = 0
): BenchmarkResult[] {
  const algorithms: { type: AlgorithmType; name: string }[] = [
    { type: 'hooke_jeeves', name: 'Хука-Дживса (Pattern Search)' },
    { type: 'pso', name: 'Рой частиц (PSO)' },
    { type: 'ga', name: 'Генетический алгоритм (GA)' },
    { type: 'nelder_mead', name: 'Нелдера-Мида (Simplex)' },
    { type: 'simulated_annealing', name: 'Имитация отжига (SA)' }
  ];

  const initEval = evaluateObjective(initialStations, targets, metric, clockModel, elevationMaskDeg);
  const initialMetric = initEval.score;

  return algorithms.map(alg => {
    const t0 = performance.now();
    let res: { stations: Station[]; evaluations: number; iterations: number; history: { iteration: number; value: number }[] };

    switch (alg.type) {
      case 'hooke_jeeves':
        res = runHookeJeevesSync(initialStations, targets, bounds, config, metric, clockModel, elevationMaskDeg);
        break;
      case 'pso':
        res = runPSOSync(initialStations, targets, bounds, metric, clockModel, elevationMaskDeg, 20, 45);
        break;
      case 'ga':
        res = runGASync(initialStations, targets, bounds, metric, clockModel, elevationMaskDeg, 20, 30);
        break;
      case 'nelder_mead':
        res = runNelderMeadSync(initialStations, targets, bounds, metric, clockModel, elevationMaskDeg, 80);
        break;
      case 'simulated_annealing':
        res = runSimulatedAnnealingSync(initialStations, targets, bounds, metric, clockModel, elevationMaskDeg, 120);
        break;
    }

    const t1 = performance.now();
    const finalEval = evaluateObjective(res.stations, targets, metric, clockModel, elevationMaskDeg);
    const improvement = Math.max(0, ((initialMetric - finalEval.score) / (initialMetric || 1)) * 100);

    return {
      algorithm: alg.type,
      algorithmName: alg.name,
      executionTimeMs: Math.round(t1 - t0),
      evaluations: res.evaluations,
      iterations: res.iterations,
      initialMetric,
      finalMetric: finalEval.score,
      improvementPercent: improvement,
      maxVdop: finalEval.maxVdop,
      meanVdop: finalEval.meanVdop,
      maxHdop: finalEval.maxHdop,
      converged: true,
      stations: res.stations,
      convergenceHistory: res.history
    };
  });
}
