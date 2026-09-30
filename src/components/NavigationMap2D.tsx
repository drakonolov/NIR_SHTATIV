import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Station, TargetPoint, ClockModel, BoundaryLimits } from '../types/navigation';
import { calculateDOP } from '../utils/mathDOP';
import { Map, Layers, Crosshair, ZoomIn, ZoomOut, Move, Eye } from 'lucide-react';

interface Props {
  stations: Station[];
  targets: TargetPoint[];
  bounds: BoundaryLimits;
  aircraftDistanceKm: number;
  onAircraftDistanceChange: (km: number) => void;
  onUpdateStationCoords: (id: number, x: number, y: number) => void;
  clockModel: ClockModel;
  elevationMaskDeg: number;
  highlightedStationId?: number | null;
  onStationSelect?: (id: number) => void;
  probedPoints?: { stationIdx: number; x: number; y: number; z: number; value: number }[];
}

export const NavigationMap2D: React.FC<Props> = ({
  stations,
  targets,
  bounds,
  aircraftDistanceKm,
  onAircraftDistanceChange,
  onUpdateStationCoords,
  clockModel,
  elevationMaskDeg,
  highlightedStationId,
  onStationSelect,
  probedPoints
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Map viewport bounds in world coordinates (meters)
  const [centerX, setCenterX] = useState<number>(-4000);
  const [centerY, setCenterY] = useState<number>(0);
  const [scale, setScale] = useState<number>(0.038); // pixels per meter

  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [heatmapType, setHeatmapType] = useState<'vdop' | 'hdop' | 'pdop'>('vdop');
  const [heatmapAltitude, setHeatmapAltitude] = useState<number>(200); // 200m AGL
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCoverageRings, setShowCoverageRings] = useState<boolean>(true);

  // Dragging state for stations or map panning
  const [draggingStationId, setDraggingStationId] = useState<number | null>(null);
  const isPanningRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Coordinate transforms
  const worldToScreen = useCallback((wx: number, wy: number, width: number, height: number) => {
    const sx = width / 2 + (wx - centerX) * scale;
    const sy = height / 2 - (wy - centerY) * scale;
    return { sx, sy };
  }, [centerX, centerY, scale]);

  const screenToWorld = useCallback((sx: number, sy: number, width: number, height: number) => {
    const wx = centerX + (sx - width / 2) / scale;
    const wy = centerY - (sy - height / 2) / scale;
    return { wx, wy };
  }, [centerX, centerY, scale]);

  // Color map helper for DOP values (Turbo / Jet colormap)
  const getDOPColor = (dop: number, alpha: number = 0.5): string => {
    if (dop > 10 || isNaN(dop)) return `rgba(180, 20, 20, ${alpha * 0.9})`;
    // normalized 1.0 -> 6.0
    const t = Math.max(0, Math.min(1, (dop - 1.2) / 4.0));
    // Blue (0) -> Cyan (0.25) -> Green (0.5) -> Yellow (0.75) -> Red (1.0)
    let r = 0, g = 0, b = 0;
    if (t < 0.25) {
      const f = t / 0.25;
      r = 0;
      g = Math.floor(200 * f);
      b = 255;
    } else if (t < 0.5) {
      const f = (t - 0.25) / 0.25;
      r = 0;
      g = 255;
      b = Math.floor(255 * (1 - f));
    } else if (t < 0.75) {
      const f = (t - 0.5) / 0.25;
      r = Math.floor(255 * f);
      g = 255;
      b = 0;
    } else {
      const f = (t - 0.75) / 0.25;
      r = 255;
      g = Math.floor(255 * (1 - f * 0.8));
      b = 0;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Main canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, width, height);

    // 1. Render DOP Heatmap if enabled
    if (showHeatmap) {
      const stepPx = 28; // grid cell size in screen pixels for smooth real-time perf
      const cols = Math.ceil(width / stepPx);
      const rows = Math.ceil(height / stepPx);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const sx = c * stepPx;
          const sy = r * stepPx;
          const world = screenToWorld(sx + stepPx / 2, sy + stepPx / 2, width, height);
          
          const targetPt: TargetPoint = {
            id: 0,
            x: world.wx,
            y: world.wy,
            z: heatmapAltitude
          };

          const dopRes = calculateDOP(stations, targetPt, clockModel, elevationMaskDeg);
          const val = heatmapType === 'vdop' ? dopRes.vdop : heatmapType === 'hdop' ? dopRes.hdop : dopRes.pdop;

          ctx.fillStyle = getDOPColor(val, 0.42);
          ctx.fillRect(sx, sy, stepPx, stepPx);
        }
      }
    }

    // 2. Coordinate Grid Lines
    if (showGrid) {
      ctx.lineWidth = 1;
      const gridStepM = 2000;
      const minX = -18000;
      const maxX = 8000;
      const minY = -8000;
      const maxY = 8000;

      // Vertical lines (constant X)
      for (let x = minX; x <= maxX; x += gridStepM) {
        const p1 = worldToScreen(x, minY, width, height);
        const p2 = worldToScreen(x, maxY, width, height);
        ctx.strokeStyle = x === 0 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(51, 65, 85, 0.3)';
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();

        // X coordinate labels
        if (p1.sy > 0 && p1.sy < height - 20) {
          ctx.fillStyle = '#64748b';
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.fillText(`${(x / 1000).toFixed(0)} км`, p1.sx + 4, height - 8);
        }
      }

      // Horizontal lines (constant Y)
      for (let y = minY; y <= maxY; y += gridStepM) {
        const p1 = worldToScreen(minX, y, width, height);
        const p2 = worldToScreen(maxX, y, width, height);
        ctx.strokeStyle = y === 0 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(51, 65, 85, 0.3)';
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();

        // Y coordinate labels
        if (p1.sx > 0 && p1.sx < width - 40) {
          ctx.fillStyle = '#64748b';
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.fillText(`${(y / 1000).toFixed(0)} км`, 8, p1.sy - 4);
        }
      }
    }

    // 3. Permissible Optimization Boundary Polygon
    const b1 = worldToScreen(bounds.minX, bounds.maxY, width, height);
    const b2 = worldToScreen(bounds.maxX, bounds.maxY, width, height);
    const b3 = worldToScreen(bounds.maxX, bounds.minY, width, height);
    const b4 = worldToScreen(bounds.minX, bounds.minY, width, height);

    ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(b1.sx, b1.sy);
    ctx.lineTo(b2.sx, b2.sy);
    ctx.lineTo(b3.sx, b3.sy);
    ctx.lineTo(b4.sx, b4.sy);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(234, 179, 8, 0.6)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText('Граница допустимого размещения НС', b1.sx + 10, b1.sy + 16);

    // 4. Runway (ВПП)
    const rwyP1 = worldToScreen(0, -30, width, height);
    const rwyP2 = worldToScreen(3000, -30, width, height);
    const rwyP3 = worldToScreen(3000, 30, width, height);
    const rwyP4 = worldToScreen(0, 30, width, height);

    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rwyP1.sx, rwyP1.sy);
    ctx.lineTo(rwyP2.sx, rwyP2.sy);
    ctx.lineTo(rwyP3.sx, rwyP3.sy);
    ctx.lineTo(rwyP4.sx, rwyP4.sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Threshold line
    const thrP1 = worldToScreen(300, -30, width, height);
    const thrP2 = worldToScreen(300, 30, width, height);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(thrP1.sx, thrP1.sy);
    ctx.lineTo(thrP2.sx, thrP2.sy);
    ctx.stroke();

    // Runway label
    const rwyCenter = worldToScreen(1500, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ВПП 09/27 (3000м)', rwyCenter.sx, rwyCenter.sy - 15);
    ctx.textAlign = 'left';

    // 5. Glide Slope Axis & Approach Corridor
    const appStart = worldToScreen(-15000, 0, width, height);
    const appEnd = worldToScreen(300, 0, width, height);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(appStart.sx, appStart.sy);
    ctx.lineTo(appEnd.sx, appEnd.sy);
    ctx.stroke();

    // Approach corridor boundaries (+-150m at threshold expanding to +-1200m at 15km)
    const corStartL = worldToScreen(-15000, -1200, width, height);
    const corStartR = worldToScreen(-15000, 1200, width, height);
    const corEndL = worldToScreen(300, -150, width, height);
    const corEndR = worldToScreen(300, 150, width, height);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(corStartL.sx, corStartL.sy);
    ctx.lineTo(corEndL.sx, corEndL.sy);
    ctx.moveTo(corStartR.sx, corStartR.sy);
    ctx.lineTo(corEndR.sx, corEndR.sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Probed Exploration Points (Hooke-Jeeves live steps)
    if (probedPoints && probedPoints.length > 0) {
      for (const pr of probedPoints) {
        const p = worldToScreen(pr.x, pr.y, width, height);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.8)';
        ctx.strokeStyle = 'rgba(202, 138, 4, 1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 7. Ground Stations
    for (const st of stations) {
      if (!st.enabled) continue;
      const isSelected = st.id === highlightedStationId;
      const isDragging = st.id === draggingStationId;
      const p = worldToScreen(st.x, st.y, width, height);

      // Coverage radius rings
      if (showCoverageRings) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 3000 * scale, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Station icon
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, isDragging ? 10 : isSelected ? 8 : 6.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#0284c7' : (st.color || '#38bdf8');
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Station pulse ring
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, isDragging ? 15 : 11, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.9)' : 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Station Name & Coordinates
      ctx.font = isSelected ? 'bold 11px JetBrains Mono, monospace' : '10px JetBrains Mono, monospace';
      ctx.fillStyle = isSelected ? '#38bdf8' : '#f1f5f9';
      ctx.fillText(`${st.name}`, p.sx + 14, p.sy - 6);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`X:${(st.x / 1000).toFixed(2)}k, Y:${(st.y / 1000).toFixed(2)}k, Z:${st.z}м`, p.sx + 14, p.sy + 7);
    }

    // 8. Aircraft Marker on Map
    const currentTarget = targets.find(t => Math.abs((t.distanceToTouchdown ?? 0) - aircraftDistanceKm) < 0.3) || targets[0];
    if (currentTarget) {
      const ac = worldToScreen(currentTarget.x, currentTarget.y, width, height);

      // Radar scan ring around aircraft
      ctx.beginPath();
      ctx.arc(ac.sx, ac.sy, 16, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Airplane marker
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ac.sx, ac.sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Heading arrow pointing along runway (+X direction)
      ctx.beginPath();
      ctx.moveTo(ac.sx + 6, ac.sy);
      ctx.lineTo(ac.sx + 18, ac.sy);
      ctx.lineTo(ac.sx + 13, ac.sy - 4);
      ctx.moveTo(ac.sx + 18, ac.sy);
      ctx.lineTo(ac.sx + 13, ac.sy + 4);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Aircraft Label
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`Борт (${aircraftDistanceKm.toFixed(1)} км)`, ac.sx + 22, ac.sy - 4);
    }

  }, [
    stations,
    targets,
    bounds,
    centerX,
    centerY,
    scale,
    showHeatmap,
    heatmapType,
    heatmapAltitude,
    showGrid,
    showCoverageRings,
    draggingStationId,
    highlightedStationId,
    clockModel,
    elevationMaskDeg,
    aircraftDistanceKm,
    probedPoints,
    worldToScreen,
    screenToWorld
  ]);

  // Mouse handlers for dragging stations and panning the 2D map
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Check if clicked near any station
    const hitRadius = 14;
    for (const st of stations) {
      if (!st.enabled) continue;
      const p = worldToScreen(st.x, st.y, canvas.width, canvas.height);
      const dist = Math.hypot(p.sx - mouseX, p.sy - mouseY);
      if (dist <= hitRadius) {
        setDraggingStationId(st.id);
        if (onStationSelect) onStationSelect(st.id);
        return;
      }
    }

    // Otherwise, initiate map pan
    isPanningRef.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draggingStationId !== null) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const world = screenToWorld(mouseX, mouseY, canvas.width, canvas.height);

      // Clamp to bounds
      const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, Math.round(world.wx / 50) * 50));
      const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, Math.round(world.wy / 50) * 50));

      onUpdateStationCoords(draggingStationId, clampedX, clampedY);
      return;
    }

    if (isPanningRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      setCenterX(prev => prev - dx / scale);
      setCenterY(prev => prev + dy / scale);
    }
  };

  const handleMouseUp = () => {
    setDraggingStationId(null);
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setScale(prev => Math.max(0.01, Math.min(0.25, prev * factor)));
  };

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col shadow-2xl">
      {/* 2D Canvas Area */}
      <div className="relative flex-1 cursor-crosshair select-none">
        <canvas
          ref={canvasRef}
          width={1000}
          height={480}
          className="w-full h-full block"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Tactical Map Controls */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs">
          <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Map className="w-3.5 h-3.5 text-cyan-400" /> Тепловая карта:
          </span>
          <button
            onClick={() => setShowHeatmap(v => !v)}
            className={`px-2 py-1 rounded transition font-mono ${
              showHeatmap ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {showHeatmap ? 'Вкл' : 'Выкл'}
          </button>
          {showHeatmap && (
            <>
              <div className="h-4 w-px bg-slate-700" />
              <button
                onClick={() => setHeatmapType('vdop')}
                className={`px-2 py-1 rounded font-mono ${
                  heatmapType === 'vdop' ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-800 text-slate-300'
                }`}
              >
                VDOP
              </button>
              <button
                onClick={() => setHeatmapType('hdop')}
                className={`px-2 py-1 rounded font-mono ${
                  heatmapType === 'hdop' ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-800 text-slate-300'
                }`}
              >
                HDOP
              </button>
              <button
                onClick={() => setHeatmapType('pdop')}
                className={`px-2 py-1 rounded font-mono ${
                  heatmapType === 'pdop' ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-800 text-slate-300'
                }`}
              >
                PDOP
              </button>
              <div className="h-4 w-px bg-slate-700" />
              <span className="text-slate-400">Срез H:</span>
              <select
                value={heatmapAltitude}
                onChange={e => setHeatmapAltitude(parseInt(e.target.value))}
                className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded border border-slate-700 text-xs font-mono"
              >
                <option value={50}>50 м</option>
                <option value={100}>100 м</option>
                <option value={200}>200 м</option>
                <option value={500}>500 м</option>
                <option value={1000}>1000 м</option>
              </select>
            </>
          )}
        </div>

        {/* Color Legend for DOP */}
        {showHeatmap && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs">
            <span className="text-slate-400 font-medium">Шкала {heatmapType.toUpperCase()}:</span>
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span className="w-3.5 h-3.5 rounded-sm bg-blue-600 inline-block" />
              <span className="text-blue-300 mr-1.5">&lt; 1.5 (отл)</span>
              <span className="w-3.5 h-3.5 rounded-sm bg-cyan-400 inline-block" />
              <span className="text-cyan-300 mr-1.5">2.0</span>
              <span className="w-3.5 h-3.5 rounded-sm bg-emerald-400 inline-block" />
              <span className="text-emerald-300 mr-1.5">2.5 (ICAO I)</span>
              <span className="w-3.5 h-3.5 rounded-sm bg-amber-400 inline-block" />
              <span className="text-amber-300 mr-1.5">3.5</span>
              <span className="w-3.5 h-3.5 rounded-sm bg-rose-500 inline-block" />
              <span className="text-rose-300">&gt; 5.0 (плохо)</span>
            </div>
          </div>
        )}

        {/* Reset View & Navigation tools */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs">
          <button
            onClick={() => {
              setCenterX(-4000);
              setCenterY(0);
              setScale(0.038);
            }}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-mono flex items-center gap-1"
          >
            <Crosshair className="w-3 h-3 text-cyan-400" /> Центр полосы
          </button>
          <button
            onClick={() => setShowCoverageRings(v => !v)}
            className={`px-2 py-1 rounded transition font-mono ${
              showCoverageRings ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Зоны действия
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={() => setScale(s => Math.min(0.2, s * 1.25))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Приблизить"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScale(s => Math.max(0.015, s * 0.8))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Отдалить"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Drag Hint */}
        <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 bg-slate-900/70 px-2 py-1 rounded border border-slate-800 pointer-events-none">
          Перетаскивайте станции мышью для ручной корректировки • Зажмите фон для сдвига карты
        </div>
      </div>

      {/* Flight Position Interactive Slider Bar */}
      <div className="bg-slate-900/90 border-t border-slate-800 px-4 py-2.5 flex items-center gap-4 text-xs">
        <span className="font-semibold text-amber-400 flex items-center gap-1.5 whitespace-nowrap">
          ✈ Удаление ВС по глиссаде:
        </span>
        <input
          type="range"
          min="0"
          max="15"
          step="0.2"
          value={aircraftDistanceKm}
          onChange={e => onAircraftDistanceChange(parseFloat(e.target.value))}
          className="flex-1 accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
        />
        <span className="font-mono text-slate-200 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
          {aircraftDistanceKm.toFixed(1)} км
        </span>
      </div>
    </div>
  );
};
