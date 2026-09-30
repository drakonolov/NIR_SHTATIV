import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Station, TargetPoint, DOPResult, ClockModel } from '../types/navigation';
import { calculateDOP } from '../utils/mathDOP';
import { Rotate3d, Compass, ZoomIn, ZoomOut, Eye, Layers } from 'lucide-react';

interface Props {
  stations: Station[];
  targets: TargetPoint[];
  aircraftDistanceKm: number;
  onAircraftDistanceChange: (km: number) => void;
  clockModel: ClockModel;
  elevationMaskDeg: number;
  highlightedStationId?: number | null;
  onStationSelect?: (id: number) => void;
  probedPoints?: { stationIdx: number; x: number; y: number; z: number; value: number }[];
}

export const NavigationScene3D: React.FC<Props> = ({
  stations,
  targets,
  aircraftDistanceKm,
  onAircraftDistanceChange,
  clockModel,
  elevationMaskDeg,
  highlightedStationId,
  onStationSelect,
  probedPoints
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera angles in radians
  const [azimuth, setAzimuth] = useState<number>(-0.85); // horizontal angle
  const [elevation, setElevation] = useState<number>(0.42); // vertical tilt
  const [zoom, setZoom] = useState<number>(0.038); // scale
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(40);

  const [showRays, setShowRays] = useState<boolean>(true);
  const [showErrorEllipsoid, setShowErrorEllipsoid] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showProbes, setShowProbes] = useState<boolean>(true);

  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef<boolean>(false);

  // Find target point corresponding to aircraft distance
  const aircraftPoint = targets.find(t => Math.abs((t.distanceToTouchdown ?? 0) - aircraftDistanceKm) < 0.3) || targets[0];
  const aircraftDOP: DOPResult = aircraftPoint
    ? calculateDOP(stations, aircraftPoint, clockModel, elevationMaskDeg)
    : { gdop: 0, pdop: 0, hdop: 0, vdop: 0, tdop: 0, isSingular: true, conditionNumber: 0 };

  // 3D projection function
  const project3D = useCallback((x: number, y: number, z: number, width: number, height: number) => {
    // Coordinate system: X is runway axis (+X along runway, -X towards approach)
    // Y is lateral cross-track
    // Z is altitude (up)
    const cosAz = Math.cos(azimuth);
    const sinAz = Math.sin(azimuth);
    const cosEl = Math.cos(elevation);
    const sinEl = Math.sin(elevation);

    // Rotate around Z axis (azimuth)
    const x1 = x * cosAz - y * sinAz;
    const y1 = x * sinAz + y * cosAz;
    const z1 = z;

    // Rotate around X' axis (elevation)
    const y2 = y1 * cosEl - z1 * sinEl;
    const z2 = y1 * sinEl + z1 * cosEl;

    // Screen coordinates
    const sx = width / 2 + (x1 * zoom) + panX;
    const sy = height / 2 - (z2 * zoom) + panY;
    const depth = y2; // for depth sorting

    return { sx, sy, depth };
  }, [azimuth, elevation, zoom, panX, panY]);

  // Main rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Draw subtle radial glow
    const grad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.7);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.6)');
    grad.addColorStop(1, 'rgba(9, 13, 22, 1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 1. Draw 3D Ground Grid (meters)
    if (showGrid) {
      ctx.lineWidth = 1;
      const gridStep = 2000;
      const minX = -16000;
      const maxX = 6000;
      const minY = -6000;
      const maxY = 6000;

      // Lines parallel to Y
      for (let x = minX; x <= maxX; x += gridStep) {
        const p1 = project3D(x, minY, 0, width, height);
        const p2 = project3D(x, maxY, 0, width, height);
        ctx.strokeStyle = x === 0 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(51, 65, 85, 0.25)';
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }

      // Lines parallel to X
      for (let y = minY; y <= maxY; y += gridStep) {
        const p1 = project3D(minX, y, 0, width, height);
        const p2 = project3D(maxX, y, 0, width, height);
        ctx.strokeStyle = y === 0 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(51, 65, 85, 0.25)';
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }
    }

    // 2. Draw Runway (ВПП: 3000m x 60m)
    const rwyP1 = project3D(0, -30, 0, width, height);
    const rwyP2 = project3D(3000, -30, 0, width, height);
    const rwyP3 = project3D(3000, 30, 0, width, height);
    const rwyP4 = project3D(0, 30, 0, width, height);

    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rwyP1.sx, rwyP1.sy);
    ctx.lineTo(rwyP2.sx, rwyP2.sy);
    ctx.lineTo(rwyP3.sx, rwyP3.sy);
    ctx.lineTo(rwyP4.sx, rwyP4.sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Centerline markings
    const clP1 = project3D(0, 0, 0, width, height);
    const clP2 = project3D(3000, 0, 0, width, height);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(clP1.sx, clP1.sy);
    ctx.lineTo(clP2.sx, clP2.sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Runway threshold marker (Порог ВПП)
    const thrP1 = project3D(300, -35, 0, width, height);
    const thrP2 = project3D(300, 35, 0, width, height);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(thrP1.sx, thrP1.sy);
    ctx.lineTo(thrP2.sx, thrP2.sy);
    ctx.stroke();

    // 3. Draw Glide Slope Path (3° descent line)
    if (targets.length > 0) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.beginPath();
      for (let i = 0; i < targets.length; i++) {
        const p = project3D(targets[i].x, targets[i].y, targets[i].z, width, height);
        if (i === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();

      // Draw drop shadows / vertical guides from glide slope down to ground every 3 km
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i < targets.length; i += 6) {
        const top = project3D(targets[i].x, targets[i].y, targets[i].z, width, height);
        const bot = project3D(targets[i].x, targets[i].y, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(top.sx, top.sy);
        ctx.lineTo(bot.sx, bot.sy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 4. Draw Probed Points (Hooke-Jeeves live exploration points)
    if (showProbes && probedPoints && probedPoints.length > 0) {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.7)';
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.9)';
      for (const pr of probedPoints) {
        const p = project3D(pr.x, pr.y, pr.z, width, height);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 5. Draw Ground Stations (3D Masts & Bases)
    for (const st of stations) {
      if (!st.enabled) continue;
      const isSelected = st.id === highlightedStationId;
      const base = project3D(st.x, st.y, 0, width, height);
      const top = project3D(st.x, st.y, st.z, width, height);

      // Station base shadow/circle on ground
      ctx.beginPath();
      ctx.ellipse(base.sx, base.sy, 8, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.4)' : 'rgba(148, 163, 184, 0.2)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#38bdf8' : (st.color || '#94a3b8');
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mast vertical line
      ctx.beginPath();
      ctx.moveTo(base.sx, base.sy);
      ctx.lineTo(top.sx, top.sy);
      ctx.strokeStyle = isSelected ? '#38bdf8' : (st.color || '#38bdf8');
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Mast cross-bracing if tall
      if (st.z > 30) {
        const mid = project3D(st.x, st.y, st.z * 0.5, width, height);
        ctx.beginPath();
        ctx.arc(mid.sx, mid.sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();
      }

      // Antenna beacon top
      ctx.beginPath();
      ctx.arc(top.sx, top.sy, isSelected ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#0284c7' : (st.color || '#0ea5e9');
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pulse ring animation / radio emission
      ctx.beginPath();
      ctx.arc(top.sx, top.sy, 9, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.8)' : 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Station label
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
      ctx.fillText(`${st.name} (h=${st.z}м)`, top.sx + 10, top.sy - 4);

      // Line of sight ray to aircraft
      if (showRays && aircraftPoint) {
        const acScreen = project3D(aircraftPoint.x, aircraftPoint.y, aircraftPoint.z, width, height);
        const distM = Math.hypot(aircraftPoint.x - st.x, aircraftPoint.y - st.y, aircraftPoint.z - st.z);
        const elevDeg = (Math.asin((aircraftPoint.z - st.z) / distM) * 180) / Math.PI;
        const isMasked = elevDeg < elevationMaskDeg;

        ctx.beginPath();
        ctx.moveTo(top.sx, top.sy);
        ctx.lineTo(acScreen.sx, acScreen.sy);
        ctx.strokeStyle = isMasked
          ? 'rgba(239, 68, 68, 0.25)'
          : isSelected
          ? 'rgba(56, 189, 248, 0.9)'
          : 'rgba(52, 211, 153, 0.4)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash(isMasked ? [3, 4] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 6. Draw Aircraft Position on Glide Slope
    if (aircraftPoint) {
      const ac = project3D(aircraftPoint.x, aircraftPoint.y, aircraftPoint.z, width, height);
      const acGround = project3D(aircraftPoint.x, aircraftPoint.y, 0, width, height);

      // Ground shadow of aircraft
      ctx.beginPath();
      ctx.ellipse(acGround.sx, acGround.sy, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Vertical altitude drop line
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(ac.sx, ac.sy);
      ctx.lineTo(acGround.sx, acGround.sy);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3D Error Ellipsoid / Vertical Uncertainty Column
      if (showErrorEllipsoid && !aircraftDOP.isSingular) {
        // Height proportional to VDOP, width proportional to HDOP
        const vScale = Math.min(aircraftDOP.vdop * 6 * zoom * 10, 80);
        const hScale = Math.min(aircraftDOP.hdop * 6 * zoom * 10, 60);

        // Draw vertical error cone/ellipse
        ctx.save();
        ctx.translate(ac.sx, ac.sy);
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(hScale, 6), Math.max(vScale, 8), 0, 0, Math.PI * 2);
        ctx.fillStyle = aircraftDOP.vdop > 3.0 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(56, 189, 248, 0.18)';
        ctx.fill();
        ctx.strokeStyle = aircraftDOP.vdop > 3.0 ? 'rgba(239, 68, 68, 0.75)' : 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Draw stylized aircraft icon / triangle
      ctx.save();
      ctx.translate(ac.sx, ac.sy);
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;

      // Airplane fuselage and wings
      ctx.beginPath();
      ctx.moveTo(12, 0); // nose towards runway (+X in 3D is to the right)
      ctx.lineTo(-6, -10); // left wing
      ctx.lineTo(-3, 0); // body
      ctx.lineTo(-10, 0); // tail
      ctx.lineTo(-8, -4); // tail fin
      ctx.lineTo(-8, 4);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 10); // right wing
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Aircraft HUD tag
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`Борт: ${aircraftDistanceKm.toFixed(1)} км (H=${aircraftPoint.z.toFixed(0)}м)`, ac.sx + 16, ac.sy - 12);
      ctx.fillStyle = aircraftDOP.vdop > 3.0 ? '#ef4444' : '#38bdf8';
      ctx.fillText(`VDOP: ${aircraftDOP.isSingular ? 'ВЫРОЖДЕНО' : aircraftDOP.vdop.toFixed(2)} | HDOP: ${aircraftDOP.hdop.toFixed(2)}`, ac.sx + 16, ac.sy + 4);
    }

    // 7. Coordinate Axes Compass Widget (bottom-left)
    const compassX = 50;
    const compassY = height - 50;
    const axisLen = 30;

    const cosAz = Math.cos(azimuth);
    const sinAz = Math.sin(azimuth);
    const cosEl = Math.cos(elevation);
    const sinEl = Math.sin(elevation);

    const drawAxis = (ax: number, ay: number, az: number, label: string, color: string) => {
      const x1 = ax * cosAz - ay * sinAz;
      const y1 = ax * sinAz + ay * cosAz;
      const z2 = y1 * sinEl + az * cosEl;

      ctx.beginPath();
      ctx.moveTo(compassX, compassY);
      ctx.lineTo(compassX + x1 * axisLen, compassY - z2 * axisLen);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(label, compassX + x1 * axisLen * 1.3 - 3, compassY - z2 * axisLen * 1.3 + 3);
    };

    drawAxis(1, 0, 0, 'X (ВПП)', '#38bdf8');
    drawAxis(0, 1, 0, 'Y (Бок)', '#34d399');
    drawAxis(0, 0, 1, 'Z (Высота)', '#f59e0b');

  }, [
    stations,
    targets,
    aircraftDistanceKm,
    aircraftPoint,
    aircraftDOP,
    azimuth,
    elevation,
    zoom,
    panX,
    panY,
    showRays,
    showErrorEllipsoid,
    showGrid,
    showProbes,
    highlightedStationId,
    clockModel,
    elevationMaskDeg,
    probedPoints,
    project3D
  ]);

  // Mouse interaction handlers for smooth 3D orbit, pan, zoom
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    isPanningRef.current = e.shiftKey || e.button === 1 || e.button === 2;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (isPanningRef.current) {
      setPanX(prev => prev + dx);
      setPanY(prev => prev + dy);
    } else {
      setAzimuth(prev => prev + dx * 0.008);
      setElevation(prev => Math.max(0.05, Math.min(Math.PI / 2 - 0.05, prev - dy * 0.008)));
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom(prev => Math.max(0.01, Math.min(0.25, prev * factor)));
  };

  // View Presets
  const setViewIsometric = () => {
    setAzimuth(-0.85);
    setElevation(0.42);
    setZoom(0.038);
    setPanX(0);
    setPanY(40);
  };

  const setViewTopDown = () => {
    setAzimuth(-Math.PI / 2);
    setElevation(Math.PI / 2 - 0.02);
    setZoom(0.035);
    setPanX(0);
    setPanY(0);
  };

  const setViewGlideSlopeProfile = () => {
    setAzimuth(0);
    setElevation(0.08);
    setZoom(0.045);
    setPanX(-50);
    setPanY(80);
  };

  const setViewCockpit = () => {
    setAzimuth(-Math.PI);
    setElevation(0.12);
    setZoom(0.06);
    setPanX(0);
    setPanY(100);
  };

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col shadow-2xl">
      {/* 3D Canvas */}
      <div className="relative flex-1 cursor-grab active:cursor-grabbing select-none">
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

        {/* View Controls Toolbar */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs">
          <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Rotate3d className="w-3.5 h-3.5 text-cyan-400" /> 3D Ракурс:
          </span>
          <button
            onClick={setViewIsometric}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-mono"
            title="Изометрический вид"
          >
            Изометрия
          </button>
          <button
            onClick={setViewTopDown}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-mono"
            title="Вид сверху (План)"
          >
            Сверху
          </button>
          <button
            onClick={setViewGlideSlopeProfile}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-mono"
            title="Профиль глиссады сбоку"
          >
            Профиль ВПП
          </button>
          <button
            onClick={setViewCockpit}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-mono"
            title="Створ захода на посадку"
          >
            Створ захода
          </button>
        </div>

        {/* Layer Toggles */}
        <div className="absolute top-3 right-3 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs">
          <button
            onClick={() => setShowRays(v => !v)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 ${
              showRays ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Eye className="w-3 h-3" /> Лучи (LOS)
          </button>
          <button
            onClick={() => setShowErrorEllipsoid(v => !v)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 ${
              showErrorEllipsoid ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
            }`}
            title="Отображение эллипсоида геометрической неопределенности VDOP/HDOP"
          >
            <Layers className="w-3 h-3" /> Эллипсоид DOP
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={() => setZoom(z => Math.min(0.2, z * 1.25))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Приблизить"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.015, z * 0.8))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Отдалить"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interaction Hint */}
        <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 bg-slate-900/70 px-2 py-1 rounded border border-slate-800 pointer-events-none">
          ЛКМ + перетаскивание: вращение 3D сцены • Shift + ЛКМ: сдвиг • Колесо мыши: масштаб
        </div>
      </div>

      {/* Flight Position Interactive Slider Bar */}
      <div className="bg-slate-900/90 border-t border-slate-800 px-4 py-2.5 flex items-center gap-4 text-xs">
        <span className="font-semibold text-amber-400 flex items-center gap-1.5 whitespace-nowrap">
          ✈ Положение борта на глиссаде:
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
          {aircraftDistanceKm.toFixed(1)} км (H = {aircraftPoint ? aircraftPoint.z.toFixed(0) : 0}м)
        </span>
        <div className="flex items-center gap-3 font-mono">
          <span className={`px-2 py-0.5 rounded border ${
            aircraftDOP.vdop <= 2.5
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : aircraftDOP.vdop <= 4.0
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}>
            VDOP: {aircraftDOP.isSingular ? 'ВЫРОЖДЕНО' : aircraftDOP.vdop.toFixed(2)}
          </span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            HDOP: {aircraftDOP.hdop.toFixed(2)}
          </span>
          <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            PDOP: {aircraftDOP.pdop.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
