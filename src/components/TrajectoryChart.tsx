import React, { useRef, useState, useMemo } from 'react';
import { TrajectoryPoint } from '../types/navigation';
import { TrendingDown, ShieldAlert, Award, Info } from 'lucide-react';

interface Props {
  profile: TrajectoryPoint[];
  baselineProfile?: TrajectoryPoint[];
  currentDistanceKm: number;
  onSelectDistance: (km: number) => void;
}

export const TrajectoryChart: React.FC<Props> = ({
  profile,
  baselineProfile,
  currentDistanceKm,
  onSelectDistance
}) => {
  const [showVdop, setShowVdop] = useState<boolean>(true);
  const [showHdop, setShowHdop] = useState<boolean>(true);
  const [showPdop, setShowPdop] = useState<boolean>(false);
  const [showGdop, setShowGdop] = useState<boolean>(false);
  const [showBaseline, setShowBaseline] = useState<boolean>(true);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // SVG dimensions
  const svgWidth = 900;
  const svgHeight = 240;
  const padLeft = 55;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  // Max distance and max DOP for scale
  const maxDist = Math.max(...profile.map(p => p.distanceKm), 15);
  // Max DOP clamp to 8 for reasonable scale (anything above 8 is unacceptable anyway)
  const maxDOPScale = 6.5;

  const distToX = (d: number) => {
    // 15 km on the left -> 0 km (touchdown) on the right
    return padLeft + ((maxDist - d) / maxDist) * chartW;
  };

  const dopToY = (val: number) => {
    const clamped = Math.max(0, Math.min(val, maxDOPScale));
    return padTop + chartH - (clamped / maxDOPScale) * chartH;
  };

  // Build SVG path strings
  const buildPath = (pts: TrajectoryPoint[], accessor: (p: TrajectoryPoint) => number) => {
    if (pts.length === 0) return '';
    const sorted = [...pts].sort((a, b) => b.distanceKm - a.distanceKm);
    return sorted
      .map((pt, idx) => {
        const x = distToX(pt.distanceKm);
        const y = dopToY(accessor(pt));
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const pathVdop = useMemo(() => buildPath(profile, p => p.dop.vdop), [profile]);
  const pathHdop = useMemo(() => buildPath(profile, p => p.dop.hdop), [profile]);
  const pathPdop = useMemo(() => buildPath(profile, p => p.dop.pdop), [profile]);
  const pathGdop = useMemo(() => buildPath(profile, p => p.dop.gdop), [profile]);

  const pathBaseVdop = useMemo(() => {
    if (!baselineProfile || baselineProfile.length === 0) return '';
    return buildPath(baselineProfile, p => p.dop.vdop);
  }, [baselineProfile]);

  // Statistics
  const maxVdop = Math.max(...profile.map(p => p.dop.vdop));
  const meanVdop = profile.reduce((acc, p) => acc + p.dop.vdop, 0) / (profile.length || 1);
  const currentPt = profile.find(p => Math.abs(p.distanceKm - currentDistanceKm) < 0.3) || profile[0];

  return (
    <div className="w-full bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col gap-3">
      {/* Header & Metrics Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Профиль геометрических факторов точности (DOP) вдоль глиссады
            </h3>
            <p className="text-xs text-slate-400">
              От входа в зону (15 км, H=800м) до порога ВПП (0 км, H=15м)
            </p>
          </div>
        </div>

        {/* Legend toggles */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowVdop(v => !v)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono ${
              showVdop ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2.5 h-0.5 bg-amber-400 inline-block mr-1" />
            VDOP ({maxVdop.toFixed(2)})
          </button>
          <button
            onClick={() => setShowHdop(v => !v)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono ${
              showHdop ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2.5 h-0.5 bg-cyan-400 inline-block mr-1" />
            HDOP
          </button>
          <button
            onClick={() => setShowPdop(v => !v)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono ${
              showPdop ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2.5 h-0.5 bg-indigo-400 inline-block mr-1" />
            PDOP
          </button>
          <button
            onClick={() => setShowGdop(v => !v)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono ${
              showGdop ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2.5 h-0.5 bg-emerald-400 inline-block mr-1" />
            GDOP
          </button>
          {baselineProfile && baselineProfile.length > 0 && (
            <button
              onClick={() => setShowBaseline(v => !v)}
              className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono ${
                showBaseline ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-500'
              }`}
            >
              <span className="w-2.5 h-0.5 bg-rose-400 inline-block mr-1 border-b border-dashed" />
              До оптимизации
            </button>
          )}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden bg-slate-950/70 rounded-lg border border-slate-800/80">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto block select-none"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            if (clickX >= padLeft && clickX <= svgWidth - padRight) {
              const fraction = (clickX - padLeft) / chartW;
              const targetDist = maxDist - fraction * maxDist;
              onSelectDistance(Math.max(0, Math.min(maxDist, targetDist)));
            }
          }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            if (mouseX >= padLeft && mouseX <= svgWidth - padRight) {
              const fraction = (mouseX - padLeft) / chartW;
              const dist = maxDist - fraction * maxDist;
              const closestIdx = profile.reduce((prev, curr, idx) => {
                return Math.abs(curr.distanceKm - dist) < Math.abs(profile[prev].distanceKm - dist) ? idx : prev;
              }, 0);
              setHoverIndex(closestIdx);
            }
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* ICAO Category Threshold Background Bands */}
          {/* CAT III: VDOP <= 1.2 */}
          <rect
            x={padLeft}
            y={dopToY(1.2)}
            width={chartW}
            height={dopToY(0) - dopToY(1.2)}
            fill="rgba(34, 197, 94, 0.08)"
          />
          {/* CAT II: 1.2 < VDOP <= 1.8 */}
          <rect
            x={padLeft}
            y={dopToY(1.8)}
            width={chartW}
            height={dopToY(1.2) - dopToY(1.8)}
            fill="rgba(56, 189, 248, 0.06)"
          />
          {/* CAT I: 1.8 < VDOP <= 2.5 */}
          <rect
            x={padLeft}
            y={dopToY(2.5)}
            width={chartW}
            height={dopToY(1.8) - dopToY(2.5)}
            fill="rgba(245, 158, 11, 0.05)"
          />

          {/* Horizontal Grid lines & DOP scale */}
          {[1.0, 1.8, 2.5, 3.5, 5.0].map(val => {
            const y = dopToY(val);
            return (
              <g key={val}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke={val === 2.5 ? 'rgba(245, 158, 11, 0.4)' : val === 1.8 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(51, 65, 85, 0.35)'}
                  strokeDasharray={val === 2.5 || val === 1.8 ? '4 3' : '2 4'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="text-[9px] fill-slate-500 font-mono"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* ICAO Category Labels on right edge */}
          <text x={svgWidth - padRight + 4} y={dopToY(1.2) - 4} className="text-[8px] fill-emerald-500/70 font-mono">
            CAT III (1.2)
          </text>
          <text x={svgWidth - padRight + 4} y={dopToY(1.8) - 4} className="text-[8px] fill-cyan-500/70 font-mono">
            CAT II (1.8)
          </text>
          <text x={svgWidth - padRight + 4} y={dopToY(2.5) - 4} className="text-[8px] fill-amber-500/70 font-mono">
            CAT I (2.5)
          </text>

          {/* Vertical distance grid lines */}
          {[15, 12, 9, 6, 3, 0].map(d => {
            const x = distToX(d);
            return (
              <g key={d}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + chartH}
                  stroke={d === 0 ? 'rgba(34, 197, 94, 0.5)' : 'rgba(51, 65, 85, 0.3)'}
                />
                <text
                  x={x}
                  y={padTop + chartH + 18}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {d === 0 ? '0 (Порог)' : `${d} км`}
                </text>
              </g>
            );
          })}

          {/* Baseline Curve (Before optimization) */}
          {showBaseline && pathBaseVdop && (
            <path
              d={pathBaseVdop}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              opacity="0.75"
            />
          )}

          {/* Active Curves */}
          {showGdop && (
            <path
              d={pathGdop}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              opacity="0.85"
            />
          )}
          {showPdop && (
            <path
              d={pathPdop}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              opacity="0.85"
            />
          )}
          {showHdop && (
            <path
              d={pathHdop}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.2"
              opacity="0.9"
            />
          )}
          {showVdop && (
            <path
              d={pathVdop}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.8"
            />
          )}

          {/* Current Aircraft Marker Line */}
          {currentPt && (
            <g>
              <line
                x1={distToX(currentPt.distanceKm)}
                y1={padTop}
                x2={distToX(currentPt.distanceKm)}
                y2={padTop + chartH}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={distToX(currentPt.distanceKm)}
                cy={dopToY(currentPt.dop.vdop)}
                r="4.5"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Hover crosshair & tooltip indicator */}
          {hoverIndex !== null && profile[hoverIndex] && (
            <g>
              <line
                x1={distToX(profile[hoverIndex].distanceKm)}
                y1={padTop}
                x2={distToX(profile[hoverIndex].distanceKm)}
                y2={padTop + chartH}
                stroke="#38bdf8"
                strokeWidth="1"
              />
              <circle
                cx={distToX(profile[hoverIndex].distanceKm)}
                cy={dopToY(profile[hoverIndex].dop.vdop)}
                r="4"
                fill="#38bdf8"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Float */}
        {hoverIndex !== null && profile[hoverIndex] && (
          <div
            className="absolute top-2 pointer-events-none bg-slate-900/95 border border-slate-700/80 px-2.5 py-1.5 rounded-lg shadow-xl text-[11px] font-mono"
            style={{
              left: `${Math.min(svgWidth - 180, Math.max(padLeft + 10, distToX(profile[hoverIndex].distanceKm)))}px`
            }}
          >
            <div className="text-slate-200 font-semibold mb-0.5">
              Удаление: {profile[hoverIndex].distanceKm.toFixed(1)} км (H={profile[hoverIndex].altitudeM.toFixed(0)}м)
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <span className="text-amber-400">VDOP: {profile[hoverIndex].dop.vdop.toFixed(2)}</span>
              <span className="text-cyan-400">HDOP: {profile[hoverIndex].dop.hdop.toFixed(2)}</span>
              <span className="text-indigo-400">PDOP: {profile[hoverIndex].dop.pdop.toFixed(2)}</span>
              <span className="text-emerald-400">GDOP: {profile[hoverIndex].dop.gdop.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Trajectory Quality Assessment Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Макс. VDOP на глиссаде:</span>
          <span className={`font-mono font-bold ${
            maxVdop <= 2.5 ? 'text-emerald-400' : maxVdop <= 3.8 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {maxVdop.toFixed(2)}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Средний VDOP:</span>
          <span className="font-mono font-semibold text-slate-200">
            {meanVdop.toFixed(2)}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Категория посадки:</span>
          <span className={`font-mono font-bold flex items-center gap-1 ${
            maxVdop <= 1.2
              ? 'text-emerald-400'
              : maxVdop <= 1.8
              ? 'text-cyan-400'
              : maxVdop <= 2.5
              ? 'text-amber-400'
              : 'text-rose-400'
          }`}>
            {maxVdop <= 1.2 ? 'ICAO CAT III' : maxVdop <= 1.8 ? 'ICAO CAT II' : maxVdop <= 2.5 ? 'ICAO CAT I' : 'Неприемлемо'}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Точка касания (0 км):</span>
          <span className="font-mono text-cyan-300">
            VDOP: {profile[profile.length - 1]?.dop.vdop.toFixed(2) ?? '-'}
          </span>
        </div>
      </div>
    </div>
  );
};
