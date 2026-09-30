import React, { useState } from 'react';
import { Station, TrajectoryPoint, ObjectiveMetric, ClockModel } from '../types/navigation';
import { Download, Copy, Check, FileText, Code, Globe, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stations: Station[];
  trajectory: TrajectoryPoint[];
  metric: ObjectiveMetric;
  clockModel: ClockModel;
}

export const ExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  stations,
  trajectory,
  metric,
  clockModel
}) => {
  const [exportFormat, setExportFormat] = useState<'json' | 'geojson' | 'csv'>('json');
  const [copied, setCopied] = useState<boolean>(false);

  // Aerodrome reference lat/lon for GeoJSON (e.g. Saint Petersburg Pulkovo ULLI)
  const [refLat, setRefLat] = useState<number>(59.8003);
  const [refLon, setRefLon] = useState<number>(30.2625);

  if (!isOpen) return null;

  // Generate output content
  const generateExportContent = (): string => {
    if (exportFormat === 'json') {
      const data = {
        title: 'Оптимизированная топология наземных станций ЛДНС',
        generatedAt: new Date().toISOString(),
        settings: {
          metric,
          clockModel,
          activeStationsCount: stations.filter(s => s.enabled).length,
          maxVdopOnGlideSlope: Math.max(...trajectory.map(t => t.dop.vdop)),
          meanVdop: trajectory.reduce((acc, t) => acc + t.dop.vdop, 0) / (trajectory.length || 1)
        },
        stations,
        trajectorySummary: trajectory.map(t => ({
          distanceKm: t.distanceKm,
          altitudeM: t.altitudeM,
          vdop: t.dop.vdop,
          hdop: t.dop.hdop,
          pdop: t.dop.pdop,
          gdop: t.dop.gdop
        }))
      };
      return JSON.stringify(data, null, 2);
    }

    if (exportFormat === 'geojson') {
      // Local meters to WGS84 approximation
      const metersPerDegLat = 111320;
      const metersPerDegLon = 111320 * Math.cos((refLat * Math.PI) / 180);

      const features = stations.map(st => {
        const lon = refLon + st.x / metersPerDegLon;
        const lat = refLat + st.y / metersPerDegLat;
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lon, lat, st.z]
          },
          properties: {
            id: st.id,
            name: st.name,
            mastHeightM: st.z,
            enabled: st.enabled,
            localX: st.x,
            localY: st.y
          }
        };
      });

      const geojson = {
        type: 'FeatureCollection',
        crs: {
          type: 'name',
          properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
        },
        features
      };
      return JSON.stringify(geojson, null, 2);
    }

    if (exportFormat === 'csv') {
      let csv = '# НАЗЕМНЫЕ СТАНЦИИ ЛДНС\nID,Название,X_метры,Y_метры,Z_мачта_метры,Включена,Фиксирована\n';
      stations.forEach(st => {
        csv += `${st.id},"${st.name}",${st.x},${st.y},${st.z},${st.enabled},${!!st.fixed}\n`;
      });
      csv += '\n# ПРОФИЛЬ ТОЧНОСТИ DOP ПО ГЛИССАДЕ\nУдаление_км,Высота_м,VDOP,HDOP,PDOP,GDOP\n';
      trajectory.forEach(t => {
        csv += `${t.distanceKm.toFixed(2)},${t.altitudeM.toFixed(1)},${t.dop.vdop.toFixed(3)},${t.dop.hdop.toFixed(3)},${t.dop.pdop.toFixed(3)},${t.dop.gdop.toFixed(3)}\n`;
      });
      return csv;
    }

    return '';
  };

  const content = generateExportContent();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = exportFormat === 'geojson' ? 'geojson' : exportFormat === 'csv' ? 'csv' : 'json';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ldns_topology_${exportFormat}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Экспорт результатов оптимизации топологии
              </h2>
              <p className="text-xs text-slate-400">
                Координаты станций и геометрические факторы точности (DOP)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Формат данных:</span>
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 font-mono">
              <button
                onClick={() => setExportFormat('json')}
                className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                  exportFormat === 'json'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" /> JSON
              </button>
              <button
                onClick={() => setExportFormat('geojson')}
                className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                  exportFormat === 'geojson'
                    ? 'bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" /> GeoJSON (WGS84)
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                  exportFormat === 'csv'
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> CSV Таблица
              </button>
            </div>
          </div>

          {exportFormat === 'geojson' && (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-slate-400">Базовый аэродром:</span>
              <input
                type="number"
                step="0.001"
                value={refLat}
                onChange={e => setRefLat(parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-800 text-slate-200 border border-slate-700 px-1 py-0.5 rounded"
                title="Широта порога ВПП"
              />
              <span className="text-slate-500">N,</span>
              <input
                type="number"
                step="0.001"
                value={refLon}
                onChange={e => setRefLon(parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-800 text-slate-200 border border-slate-700 px-1 py-0.5 rounded"
                title="Долгота порога ВПП"
              />
              <span className="text-slate-500">E</span>
            </div>
          )}
        </div>

        {/* Code Preview Area */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <textarea
            readOnly
            value={content}
            className="w-full flex-1 bg-slate-950 font-mono text-xs text-slate-300 p-4 rounded-xl border border-slate-800 focus:outline-none resize-none selection:bg-cyan-500/30"
          />
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" /> Скопировано!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Копировать в буфер
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
          >
            <Download className="w-4 h-4" /> Скачать файл
          </button>
        </div>
      </div>
    </div>
  );
};
