import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Station,
  TargetPoint,
  ScenarioType,
  ObjectiveMetric,
  AlgorithmType,
  ClockModel,
  HookeJeevesConfig,
  OptimizationStepLog,
  BenchmarkResult,
  BoundaryLimits,
  TrajectoryPoint
} from './types/navigation';
import {
  generateGlideSlopePoints,
  generateRunwayBoxPoints,
  generateAreaGridPoints,
  generateUAVCorridorPoints,
  calculateTrajectoryProfile,
  evaluateObjective
} from './utils/mathDOP';
import {
  runHookeJeevesGenerator,
  runHookeJeevesSync,
  runBenchmark,
  cloneStations
} from './algorithms/optimization';
import { TOPOLOGY_PRESETS, DEFAULT_BOUNDS, TopologyPreset } from './utils/presets';
import { NavigationScene3D } from './components/NavigationScene3D';
import { NavigationMap2D } from './components/NavigationMap2D';
import { TrajectoryChart } from './components/TrajectoryChart';
import { AlgorithmController } from './components/AlgorithmController';
import { StationTable } from './components/StationTable';
import { ScientificReferenceModal } from './components/ScientificReferenceModal';
import { ExportModal } from './components/ExportModal';

import {
  Navigation,
  Compass,
  Radio,
  BookOpen,
  Download,
  RotateCcw,
  Sparkles,
  Plane,
  Eye,
  Sliders,
  ShieldAlert,
  Award,
  Layers,
  Map,
  Rotate3d
} from 'lucide-react';

export default function App() {
  // Scenario & Target points
  const [scenario, setScenario] = useState<ScenarioType>('glide_slope');
  const [metric, setMetric] = useState<ObjectiveMetric>('max_vdop');
  const [clockModel, setClockModel] = useState<ClockModel>('4d_pseudorange');
  const [elevationMaskDeg, setElevationMaskDeg] = useState<number>(3);

  // Bounds
  const [bounds] = useState<BoundaryLimits>(DEFAULT_BOUNDS);

  // Stations state: start with Fokin & Filatchenkov 2021 preset
  const [stations, setStations] = useState<Station[]>(() =>
    cloneStations(TOPOLOGY_PRESETS[0].stations)
  );

  // Baseline stations (for before/after comparison curves)
  const [baselineStations, setBaselineStations] = useState<Station[]>(() =>
    cloneStations(TOPOLOGY_PRESETS[0].stations)
  );

  // Aircraft position on glide slope (distance in km from touchdown threshold)
  const [aircraftDistanceKm, setAircraftDistanceKm] = useState<number>(6.0);

  // Selection
  const [highlightedStationId, setHighlightedStationId] = useState<number | null>(null);

  // View Layout mode: '3d' | '2d' | 'split'
  const [viewMode, setViewMode] = useState<'3d' | '2d' | 'split'>('3d');

  // Hooke-Jeeves Configuration
  const [hjConfig, setHjConfig] = useState<HookeJeevesConfig>({
    initialStep: 300,
    stepReduction: 0.5,
    tolerance: 10,
    patternFactor: 1.0,
    maxIterations: 150,
    optimizeZ: true
  });

  // Animation execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [animationSpeedMs, setAnimationSpeedMs] = useState<number>(120);
  const [currentStepLog, setCurrentStepLog] = useState<OptimizationStepLog | null>(null);
  const [probedPoints, setProbedPoints] = useState<{ stationIdx: number; x: number; y: number; z: number; value: number }[]>([]);

  // Generator reference for stepping
  const generatorRef = useRef<Generator<OptimizationStepLog, Station[], unknown> | null>(null);
  const animationTimerRef = useRef<number | null>(null);

  // Benchmark results
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[] | null>(null);

  // Modals
  const [isArticleModalOpen, setIsArticleModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Target points generator based on selected scenario
  const targetPoints = useMemo<TargetPoint[]>(() => {
    switch (scenario) {
      case 'glide_slope':
        return generateGlideSlopePoints(15, 0.4, 3.0);
      case 'runway_box':
        return generateRunwayBoxPoints();
      case 'area_grid':
        return generateAreaGridPoints(10, 2, 200);
      case 'uav_corridor':
        return generateUAVCorridorPoints();
      default:
        return generateGlideSlopePoints(15, 0.4, 3.0);
    }
  }, [scenario]);

  // Trajectory Profile calculation (active stations)
  const trajectoryProfile = useMemo<TrajectoryPoint[]>(() => {
    return calculateTrajectoryProfile(stations, targetPoints, clockModel, elevationMaskDeg);
  }, [stations, targetPoints, clockModel, elevationMaskDeg]);

  // Baseline Trajectory Profile calculation
  const baselineProfile = useMemo<TrajectoryPoint[]>(() => {
    return calculateTrajectoryProfile(baselineStations, targetPoints, clockModel, elevationMaskDeg);
  }, [baselineStations, targetPoints, clockModel, elevationMaskDeg]);

  // Max and mean VDOP for current topology
  const stats = useMemo(() => {
    const vdopVals = trajectoryProfile.map(p => p.dop.vdop);
    const hdopVals = trajectoryProfile.map(p => p.dop.hdop);
    const maxVdop = Math.max(...vdopVals);
    const meanVdop = vdopVals.reduce((a, b) => a + b, 0) / (vdopVals.length || 1);
    const maxHdop = Math.max(...hdopVals);
    return { maxVdop, meanVdop, maxHdop };
  }, [trajectoryProfile]);

  // Handlers for updating station coordinates manually (from 2D drag or table)
  const handleUpdateStationCoords = (id: number, x: number, y: number) => {
    setStations(prev =>
      prev.map(st => (st.id === id ? { ...st, x, y } : st))
    );
  };

  const handleApplyPreset = (preset: TopologyPreset) => {
    stopAnimation();
    const cloned = cloneStations(preset.stations);
    setStations(cloned);
    setBaselineStations(cloneStations(cloned));
    setCurrentStepLog(null);
    setProbedPoints([]);
  };

  const handleResetToBaseline = () => {
    stopAnimation();
    setStations(cloneStations(baselineStations));
    setCurrentStepLog(null);
    setProbedPoints([]);
  };

  // Stop running animation
  const stopAnimation = () => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    setIsRunning(false);
    generatorRef.current = null;
  };

  // Step generator execution
  const executeNextStep = useCallback(() => {
    if (!generatorRef.current) {
      generatorRef.current = runHookeJeevesGenerator(
        stations,
        targetPoints,
        bounds,
        hjConfig,
        metric,
        clockModel,
        elevationMaskDeg
      );
    }

    const step = generatorRef.current.next();

    if (!step.done && step.value) {
      const log = step.value;
      setCurrentStepLog(log);
      setStations(cloneStations(log.stations));
      if (log.probedPoints) {
        setProbedPoints(log.probedPoints);
      }
      return true; // continue
    } else {
      // Done
      setIsRunning(false);
      generatorRef.current = null;
      return false;
    }
  }, [stations, targetPoints, bounds, hjConfig, metric, clockModel, elevationMaskDeg]);

  // Start animated optimization
  const handleStartAnimation = () => {
    if (isRunning) return;
    setBaselineStations(cloneStations(stations));
    setIsRunning(true);
    generatorRef.current = runHookeJeevesGenerator(
      stations,
      targetPoints,
      bounds,
      hjConfig,
      metric,
      clockModel,
      elevationMaskDeg
    );
  };

  const handlePauseAnimation = () => {
    stopAnimation();
  };

  // Loop for animation
  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      const hasMore = executeNextStep();
      if (hasMore) {
        animationTimerRef.current = window.setTimeout(tick, animationSpeedMs);
      } else {
        stopAnimation();
      }
    };

    animationTimerRef.current = window.setTimeout(tick, animationSpeedMs);

    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, [isRunning, animationSpeedMs, executeNextStep]);

  // Single step button
  const handleStepOnce = () => {
    stopAnimation();
    executeNextStep();
  };

  // Fast synchronous run
  const handleRunFast = () => {
    stopAnimation();
    setBaselineStations(cloneStations(stations));
    const res = runHookeJeevesSync(
      stations,
      targetPoints,
      bounds,
      hjConfig,
      metric,
      clockModel,
      elevationMaskDeg
    );

    setStations(res.stations);
    setCurrentStepLog({
      iteration: res.iterations,
      stepType: 'converged',
      description: `Быстрая оптимизация завершена! Вызовов F: ${res.evaluations}`,
      bestValue: res.history[res.history.length - 1]?.value ?? 0,
      currentStepSize: hjConfig.tolerance,
      evaluations: res.evaluations,
      stations: res.stations
    });
    setProbedPoints([]);
  };

  // Run benchmark comparison
  const handleRunBenchmark = () => {
    setIsBenchmarking(true);
    // Allow UI to update before running heavy synchronous compute
    setTimeout(() => {
      const results = runBenchmark(
        stations,
        targetPoints,
        bounds,
        hjConfig,
        metric,
        clockModel,
        elevationMaskDeg
      );
      setBenchmarkResults(results);
      setIsBenchmarking(false);
    }, 50);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Top Engineering App Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">
                Оптимизация топологии станций ЛДНС
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Хук-Дживс (Pattern Search)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Имитационная модель Концерна ВКО «Алмаз - Антей» (Журнал «Радионавигация и время»)
            </p>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setIsArticleModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-medium flex items-center gap-1.5 transition"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Обоснование статьи (2021)
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Экспорт топологии
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        {/* Top Control & Scenario Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
          {/* Scenario Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Сценарий оценки:</span>
            <select
              value={scenario}
              onChange={e => setScenario(e.target.value as ScenarioType)}
              className="bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 font-mono text-xs"
            >
              <option value="glide_slope">Посадочная глиссада ИКАО 3° (15 км → 0 км)</option>
              <option value="runway_box">Приаэродромная зона (ВПП 3000м x 60м)</option>
              <option value="area_grid">Площадная зона 10x10 км (H=200м)</option>
              <option value="uav_corridor">Маршрут маневрирования БПЛА</option>
            </select>
          </div>

          {/* Quick Quality Metrics Badges */}
          <div className="flex items-center gap-3 font-mono">
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[11px]">max(VDOP):</span>
              <span className={`font-bold ${
                stats.maxVdop <= 2.5 ? 'text-emerald-400' : stats.maxVdop <= 4.0 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {stats.maxVdop.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[11px]">mean(VDOP):</span>
              <span className="text-cyan-300 font-semibold">{stats.meanVdop.toFixed(2)}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[11px]">Категория ICAO:</span>
              <span className={`font-bold ${
                stats.maxVdop <= 1.2 ? 'text-emerald-400' : stats.maxVdop <= 1.8 ? 'text-cyan-400' : stats.maxVdop <= 2.5 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {stats.maxVdop <= 1.2 ? 'CAT III' : stats.maxVdop <= 1.8 ? 'CAT II' : stats.maxVdop <= 2.5 ? 'CAT I' : 'Вне норм'}
              </span>
            </div>
          </div>

          {/* View Mode Toggle (3D, 2D, Split) */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                viewMode === '3d'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rotate3d className="w-3.5 h-3.5" /> 3D Сцена
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                viewMode === '2d'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Map className="w-3.5 h-3.5" /> 2D Радар & Теплокарта
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                viewMode === 'split'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Сплит (3D + 2D)
            </button>
          </div>
        </div>

        {/* Visualizers Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Visualizer Canvas Area */}
          <div className={`${viewMode === 'split' ? 'lg:col-span-12' : 'lg:col-span-12'}`}>
            {viewMode === '3d' && (
              <NavigationScene3D
                stations={stations}
                targets={targetPoints}
                aircraftDistanceKm={aircraftDistanceKm}
                onAircraftDistanceChange={setAircraftDistanceKm}
                clockModel={clockModel}
                elevationMaskDeg={elevationMaskDeg}
                highlightedStationId={highlightedStationId}
                onStationSelect={setHighlightedStationId}
                probedPoints={probedPoints}
              />
            )}

            {viewMode === '2d' && (
              <NavigationMap2D
                stations={stations}
                targets={targetPoints}
                bounds={bounds}
                aircraftDistanceKm={aircraftDistanceKm}
                onAircraftDistanceChange={setAircraftDistanceKm}
                onUpdateStationCoords={handleUpdateStationCoords}
                clockModel={clockModel}
                elevationMaskDeg={elevationMaskDeg}
                highlightedStationId={highlightedStationId}
                onStationSelect={setHighlightedStationId}
                probedPoints={probedPoints}
              />
            )}

            {viewMode === 'split' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <NavigationScene3D
                  stations={stations}
                  targets={targetPoints}
                  aircraftDistanceKm={aircraftDistanceKm}
                  onAircraftDistanceChange={setAircraftDistanceKm}
                  clockModel={clockModel}
                  elevationMaskDeg={elevationMaskDeg}
                  highlightedStationId={highlightedStationId}
                  onStationSelect={setHighlightedStationId}
                  probedPoints={probedPoints}
                />
                <NavigationMap2D
                  stations={stations}
                  targets={targetPoints}
                  bounds={bounds}
                  aircraftDistanceKm={aircraftDistanceKm}
                  onAircraftDistanceChange={setAircraftDistanceKm}
                  onUpdateStationCoords={handleUpdateStationCoords}
                  clockModel={clockModel}
                  elevationMaskDeg={elevationMaskDeg}
                  highlightedStationId={highlightedStationId}
                  onStationSelect={setHighlightedStationId}
                  probedPoints={probedPoints}
                />
              </div>
            )}
          </div>
        </div>

        {/* Trajectory Profile Continuous Graph */}
        <TrajectoryChart
          profile={trajectoryProfile}
          baselineProfile={baselineProfile}
          currentDistanceKm={aircraftDistanceKm}
          onSelectDistance={setAircraftDistanceKm}
        />

        {/* Algorithm Control Panel & Benchmark */}
        <AlgorithmController
          algorithm="hooke_jeeves"
          onAlgorithmChange={() => {}}
          config={hjConfig}
          onConfigChange={setHjConfig}
          metric={metric}
          onMetricChange={setMetric}
          clockModel={clockModel}
          onClockModelChange={setClockModel}
          elevationMaskDeg={elevationMaskDeg}
          onElevationMaskChange={setElevationMaskDeg}
          isRunning={isRunning}
          onStartAnimation={handleStartAnimation}
          onPauseAnimation={handlePauseAnimation}
          onStepOnce={handleStepOnce}
          onRunFast={handleRunFast}
          onReset={handleResetToBaseline}
          currentStepLog={currentStepLog}
          animationSpeedMs={animationSpeedMs}
          onAnimationSpeedChange={setAnimationSpeedMs}
          onRunBenchmark={handleRunBenchmark}
          isBenchmarking={isBenchmarking}
          benchmarkResults={benchmarkResults}
        />

        {/* Ground Station Topology Table & Editor */}
        <StationTable
          stations={stations}
          onStationsChange={setStations}
          onSelectStation={setHighlightedStationId}
          selectedStationId={highlightedStationId}
          onApplyPreset={handleApplyPreset}
        />
      </main>

      {/* Scientific Reference Modal */}
      <ScientificReferenceModal
        isOpen={isArticleModalOpen}
        onClose={() => setIsArticleModalOpen(false)}
      />

      {/* Export / GeoJSON Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        stations={stations}
        trajectory={trajectoryProfile}
        metric={metric}
        clockModel={clockModel}
      />
    </div>
  );
}
