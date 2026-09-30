import React, { useState } from 'react';
import {
  AlgorithmType,
  HookeJeevesConfig,
  OptimizationStepLog,
  BenchmarkResult,
  ObjectiveMetric,
  ClockModel
} from '../types/navigation';
import {
  Play,
  Pause,
  StepForward,
  FastForward,
  RotateCcw,
  Zap,
  Activity,
  Sliders,
  Sparkles,
  BarChart3,
  CheckCircle2
} from 'lucide-react';

interface Props {
  algorithm: AlgorithmType;
  onAlgorithmChange: (alg: AlgorithmType) => void;
  config: HookeJeevesConfig;
  onConfigChange: (cfg: HookeJeevesConfig) => void;
  metric: ObjectiveMetric;
  onMetricChange: (m: ObjectiveMetric) => void;
  clockModel: ClockModel;
  onClockModelChange: (cm: ClockModel) => void;
  elevationMaskDeg: number;
  onElevationMaskChange: (deg: number) => void;
  isRunning: boolean;
  onStartAnimation: () => void;
  onPauseAnimation: () => void;
  onStepOnce: () => void;
  onRunFast: () => void;
  onReset: () => void;
  currentStepLog: OptimizationStepLog | null;
  animationSpeedMs: number;
  onAnimationSpeedChange: (ms: number) => void;
  onRunBenchmark: () => void;
  isBenchmarking: boolean;
  benchmarkResults: BenchmarkResult[] | null;
}

export const AlgorithmController: React.FC<Props> = ({
  algorithm,
  onAlgorithmChange,
  config,
  onConfigChange,
  metric,
  onMetricChange,
  clockModel,
  onClockModelChange,
  elevationMaskDeg,
  onElevationMaskChange,
  isRunning,
  onStartAnimation,
  onPauseAnimation,
  onStepOnce,
  onRunFast,
  onReset,
  currentStepLog,
  animationSpeedMs,
  onAnimationSpeedChange,
  onRunBenchmark,
  isBenchmarking,
  benchmarkResults
}) => {
  const [activeTab, setActiveTab] = useState<'hooke_jeeves' | 'benchmark' | 'parameters'>('hooke_jeeves');

  return (
    <div className="w-full bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col gap-4">
      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('hooke_jeeves')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === 'hooke_jeeves'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Метод Хука-Дживса (Pattern Search)
          </button>
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === 'benchmark'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            Бенчмарк алгоритмов (PSO / GA / Симплекс)
          </button>
          <button
            onClick={() => setActiveTab('parameters')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === 'parameters'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            Критерии и радиомодель
          </button>
        </div>

        {/* Global Reset Button */}
        <button
          onClick={onReset}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition border border-slate-700"
          title="Сбросить геометрию станций в исходное состояние"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Сброс в исходное
        </button>
      </div>

      {/* TAB 1: HOOKE-JEEVES PATTERN SEARCH CONTROLS */}
      {activeTab === 'hooke_jeeves' && (
        <div className="flex flex-col gap-4">
          {/* Main Action Execution Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <button
              onClick={isRunning ? onPauseAnimation : onStartAnimation}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition shadow-md ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4" /> Приостановить
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" /> Пошаговая анимация
                </>
              )}
            </button>

            <button
              onClick={onStepOnce}
              disabled={isRunning}
              className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700"
            >
              <StepForward className="w-4 h-4 text-cyan-400" />
              Один шаг (Итерация)
            </button>

            <button
              onClick={onRunFast}
              disabled={isRunning}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-md"
            >
              <FastForward className="w-4 h-4" />
              Мгновенный расчет
            </button>

            {/* Animation Speed Selector */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400">Скорость:</span>
              <div className="flex items-center gap-1">
                {[
                  { label: '0.5x', ms: 250 },
                  { label: '1x', ms: 120 },
                  { label: '2x', ms: 40 }
                ].map(spd => (
                  <button
                    key={spd.label}
                    onClick={() => onAnimationSpeedChange(spd.ms)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      animationSpeedMs === spd.ms
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spd.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hooke-Jeeves Configuration Knobs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">
                Начальный шаг Δ₀ (м):
              </label>
              <input
                type="number"
                min="50"
                max="2000"
                step="50"
                value={config.initialStep}
                onChange={e => onConfigChange({ ...config, initialStep: parseFloat(e.target.value) || 200 })}
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 px-2 py-1 rounded font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Коэфф. сжатия β:
              </label>
              <input
                type="number"
                min="0.1"
                max="0.9"
                step="0.05"
                value={config.stepReduction}
                onChange={e => onConfigChange({ ...config, stepReduction: parseFloat(e.target.value) || 0.5 })}
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 px-2 py-1 rounded font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Шаг по образцу α:
              </label>
              <input
                type="number"
                min="0.5"
                max="3.0"
                step="0.5"
                value={config.patternFactor}
                onChange={e => onConfigChange({ ...config, patternFactor: parseFloat(e.target.value) || 1.0 })}
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 px-2 py-1 rounded font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Точность останова ε (м):
              </label>
              <input
                type="number"
                min="1"
                max="50"
                step="1"
                value={config.tolerance}
                onChange={e => onConfigChange({ ...config, tolerance: parseFloat(e.target.value) || 5 })}
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 px-2 py-1 rounded font-mono"
              />
            </div>

            <div className="flex flex-col justify-center">
              <label className="text-slate-400 block mb-1.5">
                Высоты мачт (Z):
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={config.optimizeZ}
                  onChange={e => onConfigChange({ ...config, optimizeZ: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                />
                <span>Варьировать Z</span>
              </label>
            </div>
          </div>

          {/* Current Step State Card */}
          {currentStepLog && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  currentStepLog.stepType === 'pattern'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : currentStepLog.stepType === 'explore'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : currentStepLog.stepType === 'converged'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">
                    {currentStepLog.description}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Текущий шаг Δ = {currentStepLog.currentStepSize.toFixed(1)}м • Вычислений F: {currentStepLog.evaluations}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center font-mono">
                <span className="text-slate-400">Лучшее значение:</span>
                <span className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                  {currentStepLog.bestValue.toFixed(3)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MULTI-ALGORITHM BENCHMARK */}
      {activeTab === 'benchmark' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">
                Сравнение алгоритмов поисковой оптимизации топологии
              </h4>
              <p className="text-[11px] text-slate-400">
                Тестирование методов Хука-Дживса, роя частиц (PSO), генетического (GA), симплекс (Nelder-Mead) и отжига (SA)
              </p>
            </div>
            <button
              onClick={onRunBenchmark}
              disabled={isBenchmarking || isRunning}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isBenchmarking ? 'Выполняется расчет...' : 'Запустить сравнительный бенчмарк'}
            </button>
          </div>

          {benchmarkResults && benchmarkResults.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Алгоритм</th>
                    <th className="p-2.5">Время (мс)</th>
                    <th className="p-2.5">Вызовов F</th>
                    <th className="p-2.5">Исходный F</th>
                    <th className="p-2.5">Финальный F</th>
                    <th className="p-2.5">Улучшение</th>
                    <th className="p-2.5">Макс. VDOP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {benchmarkResults.map((res, idx) => {
                    const isBest = idx === 0 || res.finalMetric <= Math.min(...benchmarkResults.map(r => r.finalMetric)) + 0.001;
                    return (
                      <tr key={res.algorithm} className={isBest ? 'bg-indigo-950/20' : 'hover:bg-slate-800/30'}>
                        <td className="p-2.5 font-sans font-medium text-slate-200 flex items-center gap-1.5">
                          {isBest && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          {res.algorithmName}
                        </td>
                        <td className="p-2.5 text-slate-400">{res.executionTimeMs} мс</td>
                        <td className="p-2.5 text-slate-400">{res.evaluations}</td>
                        <td className="p-2.5 text-slate-500">{res.initialMetric.toFixed(2)}</td>
                        <td className="p-2.5 font-bold text-cyan-300">{res.finalMetric.toFixed(3)}</td>
                        <td className="p-2.5 text-emerald-400 font-semibold">+{res.improvementPercent.toFixed(1)}%</td>
                        <td className="p-2.5 text-amber-400">{res.maxVdop.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              Нажмите «Запустить сравнительный бенчмарк», чтобы протестировать все методы оптимизации на текущей расстановке станций.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OBJECTIVE METRIC & RADIO CHANNEL SETTINGS */}
      {activeTab === 'parameters' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Target Metric */}
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-2">
            <span className="font-semibold text-slate-200">Целевая функция оптимизации (F):</span>
            <select
              value={metric}
              onChange={e => onMetricChange(e.target.value as ObjectiveMetric)}
              className="bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono"
            >
              <option value="max_vdop">Минимизировать max(VDOP) на глиссаде</option>
              <option value="mean_vdop">Минимизировать средний VDOP</option>
              <option value="composite_vh">Комплексный: 75% VDOP + 25% HDOP</option>
              <option value="max_pdop">Минимизировать max(PDOP)</option>
              <option value="mean_gdop">Минимизировать средний GDOP</option>
            </select>
            <p className="text-[11px] text-slate-400">
              Статья Фокина & Филатченкова рекомендует минимизацию max(VDOP), так как ошибки высоты наиболее опасны при заходе на посадку.
            </p>
          </div>

          {/* Clock Model */}
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-2">
            <span className="font-semibold text-slate-200">Модель времени / измерений:</span>
            <select
              value={clockModel}
              onChange={e => onClockModelChange(e.target.value as ClockModel)}
              className="bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono"
            >
              <option value="4d_pseudorange">4D Псевдодальномерная (с уходом часов ВС)</option>
              <option value="3d_synchronized">3D Синхронизированная (истинная дальность)</option>
            </select>
            <p className="text-[11px] text-slate-400">
              В 4D-режиме требуется минимум 4 станции в зоне прямой видимости. В 3D — минимум 3.
            </p>
          </div>

          {/* Elevation Mask */}
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-200">Угол маски горизонта (Elevation Mask):</span>
              <span className="font-mono text-cyan-400 font-bold">{elevationMaskDeg}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={elevationMaskDeg}
              onChange={e => onElevationMaskChange(parseInt(e.target.value))}
              className="accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Исключает лучи станций, проходящие под малыми углами над землей (защита от переотражений и рельефа).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
