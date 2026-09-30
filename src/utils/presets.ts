import { Station, BoundaryLimits } from '../types/navigation';

export interface TopologyPreset {
  id: string;
  name: string;
  description: string;
  stations: Station[];
}

export const DEFAULT_BOUNDS: BoundaryLimits = {
  minX: -16000, // up to 16 km out along glide slope
  maxX: 6000,   // past runway end
  minY: -6000,  // lateral width 12 km
  maxY: 6000,
  minZ: 5,      // mast base
  maxZ: 150     // max mast height in meters
};

export const TOPOLOGY_PRESETS: TopologyPreset[] = [
  {
    id: 'fokin_filatchenkov',
    name: 'Статья Фокина-Филатченкова (2021)',
    description: 'Конфигурация из 6 станций с перепадом высот мачт (30-100м) для эффективного снижения VDOP на глиссаде.',
    stations: [
      { id: 1, name: 'НС-1 (Ближний порог L)', x: -200, y: -450, z: 25, enabled: true, color: '#38bdf8' },
      { id: 2, name: 'НС-2 (Ближний порог R)', x: -100, y: 500, z: 25, enabled: true, color: '#38bdf8' },
      { id: 3, name: 'НС-3 (Дальний створ L)', x: -4500, y: -1800, z: 75, enabled: true, color: '#818cf8' },
      { id: 4, name: 'НС-4 (Дальний створ R)', x: -5200, y: 1600, z: 80, enabled: true, color: '#818cf8' },
      { id: 5, name: 'НС-5 (Конец ВПП)', x: 3400, y: 0, z: 35, enabled: true, color: '#34d399' },
      { id: 6, name: 'НС-6 (Дальний привод X=-10км)', x: -9800, y: -2200, z: 110, enabled: true, color: '#fbbf24' }
    ]
  },
  {
    id: 'flank_runway',
    name: 'Фланговая (Параллельно ВПП)',
    description: 'Традиционное размещение станций параллельно полосе. Хороший HDOP, но повышенный VDOP на удалении.',
    stations: [
      { id: 1, name: 'НС-1 (Торец L)', x: 0, y: -600, z: 20, enabled: true, color: '#38bdf8' },
      { id: 2, name: 'НС-2 (Торец R)', x: 0, y: 600, z: 20, enabled: true, color: '#38bdf8' },
      { id: 3, name: 'НС-3 (Середина L)', x: 1500, y: -800, z: 20, enabled: true, color: '#38bdf8' },
      { id: 4, name: 'НС-4 (Середина R)', x: 1500, y: 800, z: 20, enabled: true, color: '#38bdf8' },
      { id: 5, name: 'НС-5 (Выкат L)', x: 3000, y: -600, z: 20, enabled: true, color: '#34d399' },
      { id: 6, name: 'НС-6 (Выкат R)', x: 3000, y: 600, z: 20, enabled: true, color: '#34d399' }
    ]
  },
  {
    id: 'perimeter_ring',
    name: 'Кольцевой периметр (R = 4 км)',
    description: 'Круговое распределение станций вокруг аэродромной зоны. Стабильный круговой HDOP.',
    stations: [
      { id: 1, name: 'НС-1 (Север)', x: 1500, y: 3500, z: 30, enabled: true, color: '#38bdf8' },
      { id: 2, name: 'НС-2 (Северо-Восток)', x: 4000, y: 2500, z: 30, enabled: true, color: '#38bdf8' },
      { id: 3, name: 'НС-3 (Юго-Восток)', x: 4000, y: -2500, z: 30, enabled: true, color: '#38bdf8' },
      { id: 4, name: 'НС-4 (Юг)', x: 1500, y: -3500, z: 30, enabled: true, color: '#38bdf8' },
      { id: 5, name: 'НС-5 (Юго-Запад)', x: -2500, y: -2500, z: 50, enabled: true, color: '#818cf8' },
      { id: 6, name: 'НС-6 (Северо-Запад)', x: -2500, y: 2500, z: 50, enabled: true, color: '#818cf8' }
    ]
  },
  {
    id: 'collinear_bad',
    name: 'Неоптимальная (Коллинеарная вдоль оси)',
    description: 'Худший случай: станции расположены почти на одной линии. Приводит к вырождению матрицы G и катастрофическому VDOP/HDOP!',
    stations: [
      { id: 1, name: 'НС-1', x: -3000, y: 50, z: 15, enabled: true, color: '#f87171' },
      { id: 2, name: 'НС-2', x: -1000, y: -50, z: 15, enabled: true, color: '#f87171' },
      { id: 3, name: 'НС-3', x: 500, y: 30, z: 15, enabled: true, color: '#f87171' },
      { id: 4, name: 'НС-4', x: 2000, y: -40, z: 15, enabled: true, color: '#f87171' },
      { id: 5, name: 'НС-5', x: 3500, y: 20, z: 15, enabled: true, color: '#f87171' }
    ]
  },
  {
    id: 'extended_8',
    name: 'Расширенная группировка (8 станций)',
    description: 'Группировка с глубоким эшелонированием по глиссаде вплоть до удаления 14 км.',
    stations: [
      { id: 1, name: 'НС-1 (Вход в глиссаду L)', x: -13000, y: -3000, z: 120, enabled: true, color: '#c084fc' },
      { id: 2, name: 'НС-2 (Вход в глиссаду R)', x: -12500, y: 2800, z: 110, enabled: true, color: '#c084fc' },
      { id: 3, name: 'НС-3 (Промежуточный L)', x: -7000, y: -2200, z: 85, enabled: true, color: '#818cf8' },
      { id: 4, name: 'НС-4 (Промежуточный R)', x: -6500, y: 2000, z: 90, enabled: true, color: '#818cf8' },
      { id: 5, name: 'НС-5 (Ближний привод L)', x: -1800, y: -1200, z: 40, enabled: true, color: '#38bdf8' },
      { id: 6, name: 'НС-6 (Ближний привод R)', x: -1500, y: 1300, z: 45, enabled: true, color: '#38bdf8' },
      { id: 7, name: 'НС-7 (ВПП лево)', x: 1200, y: -700, z: 25, enabled: true, color: '#34d399' },
      { id: 8, name: 'НС-8 (ВПП право)', x: 1800, y: 750, z: 25, enabled: true, color: '#34d399' }
    ]
  }
];
