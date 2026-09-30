import React from 'react';
import { Station } from '../types/navigation';
import { Plus, Trash2, Lock, Unlock, Radio, Eye, EyeOff } from 'lucide-react';
import { TOPOLOGY_PRESETS, TopologyPreset } from '../utils/presets';

interface Props {
  stations: Station[];
  onStationsChange: (stations: Station[]) => void;
  onSelectStation: (id: number) => void;
  selectedStationId?: number | null;
  onApplyPreset: (preset: TopologyPreset) => void;
}

export const StationTable: React.FC<Props> = ({
  stations,
  onStationsChange,
  onSelectStation,
  selectedStationId,
  onApplyPreset
}) => {
  const handleUpdate = (id: number, patch: Partial<Station>) => {
    onStationsChange(
      stations.map(st => (st.id === id ? { ...st, ...patch } : st))
    );
  };

  const handleAddStation = () => {
    const nextId = Math.max(...stations.map(s => s.id), 0) + 1;
    const colors = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f43f5e', '#a855f7'];
    const newStation: Station = {
      id: nextId,
      name: `НС-${nextId}`,
      x: Math.round((-6000 + Math.random() * 8000) / 100) * 100,
      y: Math.round(((Math.random() - 0.5) * 4000) / 100) * 100,
      z: 30,
      enabled: true,
      color: colors[nextId % colors.length]
    };
    onStationsChange([...stations, newStation]);
  };

  const handleRemoveStation = (id: number) => {
    if (stations.length <= 4) {
      alert('Минимум 4 станции необходимы для 4D псевдодальномерной навигации!');
      return;
    }
    onStationsChange(stations.filter(s => s.id !== id));
  };

  return (
    <div className="w-full bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col gap-3">
      {/* Header & Preset Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Наземные станции ЛДНС ({stations.filter(s => s.enabled).length}/{stations.length} активны)
            </h3>
            <p className="text-xs text-slate-400">
              Координаты опорных станций (радиомаяков/псевдолитов) и высоты мачт
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Пресет топологии:</span>
          <select
            onChange={e => {
              const p = TOPOLOGY_PRESETS.find(x => x.id === e.target.value);
              if (p) onApplyPreset(p);
            }}
            defaultValue=""
            className="bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono text-xs"
          >
            <option value="" disabled>
              Выбрать предустановку...
            </option>
            {TOPOLOGY_PRESETS.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleAddStation}
            className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1 transition shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить НС
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800/80">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
            <tr>
              <th className="p-2 w-8 text-center">Цвет</th>
              <th className="p-2">Название</th>
              <th className="p-2">X (ВПП, м)</th>
              <th className="p-2">Y (Бок, м)</th>
              <th className="p-2">Z (Мачта, м)</th>
              <th className="p-2 text-center">Фикс</th>
              <th className="p-2 text-center">Вкл</th>
              <th className="p-2 text-center">Удалить</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {stations.map(st => {
              const isSelected = st.id === selectedStationId;
              return (
                <tr
                  key={st.id}
                  onClick={() => onSelectStation(st.id)}
                  className={`cursor-pointer transition ${
                    isSelected ? 'bg-cyan-950/30' : 'hover:bg-slate-800/30'
                  } ${!st.enabled ? 'opacity-50' : ''}`}
                >
                  <td className="p-2 text-center">
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block border border-white/50"
                      style={{ backgroundColor: st.color || '#38bdf8' }}
                    />
                  </td>
                  <td className="p-2 font-sans font-medium text-slate-200">
                    <input
                      type="text"
                      value={st.name}
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleUpdate(st.id, { name: e.target.value })}
                      className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-cyan-500 focus:outline-none w-32 px-1 text-slate-200"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={st.x}
                      step="50"
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleUpdate(st.id, { x: parseFloat(e.target.value) || 0 })}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 w-24 text-right text-slate-100"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={st.y}
                      step="50"
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleUpdate(st.id, { y: parseFloat(e.target.value) || 0 })}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 w-24 text-right text-slate-100"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="5"
                      max="150"
                      value={st.z}
                      step="5"
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleUpdate(st.id, { z: Math.max(5, parseFloat(e.target.value) || 20) })}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 w-20 text-right text-amber-300 font-semibold"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleUpdate(st.id, { fixed: !st.fixed });
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 transition"
                      title={st.fixed ? 'Станция зафиксирована (не двигать алгоритмом)' : 'Свободна для оптимизации'}
                    >
                      {st.fixed ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleUpdate(st.id, { enabled: !st.enabled });
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 transition"
                      title={st.enabled ? 'Отключить станцию' : 'Включить станцию'}
                    >
                      {st.enabled ? (
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </button>
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleRemoveStation(st.id);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                      title="Удалить станцию"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
