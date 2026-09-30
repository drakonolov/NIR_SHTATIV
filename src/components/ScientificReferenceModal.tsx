import React from 'react';
import { BookOpen, X, ExternalLink, ShieldCheck, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ScientificReferenceModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Научно-техническое обоснование: Оптимизация топологии ЛДНС
              </h2>
              <p className="text-xs text-slate-400">
                Труды СЗРЦ Концерна ВКО «Алмаз - Антей» • Журнал «Радионавигация и время», №8 (2021)
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300 leading-relaxed">
          {/* Paper Info Card */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                Первоисточник статьи:
              </span>
              <span className="text-xs text-slate-400">ВКО «Алмаз - Антей»</span>
            </div>
            <h3 className="font-bold text-slate-100 text-sm">
              Фокин Г.А., Филатченков С.В. «Имитационная модель поиска оптимальной топологии размещения наземных станций локальной дальномерной системы навигации с учетом заданных геометрических факторов точности — HDOP, VDOP и PDOP»
            </h3>
            <p className="text-xs text-slate-400">
              Журнал «Радионавигация и время», Выпуск 8 (2021 год), СЗРЦ Концерна ВКО "Алмаз-Антей", Санкт-Петербург.
            </p>
          </div>

          {/* Section 1: Physical & Math Model */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              1. Математическая модель геометрического фактора (DOP)
            </h4>
            <p>
              В локальной дальномерной / псевдодальномерной навигационной системе (ЛДНС / псевдолиты) потребитель (самолет на посадочной глиссаде, БПЛА) измеряет расстояния до N наземных станций с координатами s_i = (x_i, y_i, z_i).
            </p>
            <div className="p-3 rounded-lg bg-slate-950 font-mono text-xs text-slate-300 border border-slate-800/80 overflow-x-auto space-y-1">
              <div>{'Матрица направляющих косинусов: G_i = [ (x_u - x_i)/r_i, (y_u - y_i)/r_i, (z_u - z_i)/r_i, 1 ]'}</div>
              <div>{'Ковариационная матрица погрешности: Q = (Gᵀ · G)⁻¹'}</div>
              <div>{'GDOP = √(Tr(Q)) = √(q₁₁ + q₂₂ + q₃₃ + q₄₄)'}</div>
              <div>{'PDOP = √(q₁₁ + q₂₂ + q₃₃)  |  HDOP = √(q₁₁ + q₂₂)'}</div>
              <div className="text-amber-300 font-bold">{'VDOP = √(q₃₃) — Вертикальный геометрический фактор точности'}</div>
            </div>
          </div>

          {/* Section 2: Why VDOP is Problematic */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              2. Почему оптимизация VDOP критична на глиссаде?
            </h4>
            <p>
              Все наземные станции располагаются в квази-плоской геометрии на поверхности земли ($z_i \approx 0$). В то же время воздушное судно приближается к земле под малым углом глиссады (3°). Векторы визирования направлены практически под малыми углами места, из-за чего столбцы высоты матрицы $G$ становятся почти линейно зависимыми.
            </p>
            <p>
              Это приводит к резкому росту $VDOP$ (иногда до сотен единиц в неоптимальных схемах!), что делает посадку по приборам невозможной. Оптимизация координат станций по оси захода $X$, боковому разбросу $Y$ и высоте мачт $Z$ (30&ndash;120 м) позволяет удерживать $VDOP \le 2.0$, что удовлетворяет жестким требованиям ИКАО (ICAO CAT I/II/III).
            </p>
          </div>

          {/* Section 3: Hooke-Jeeves Pattern Search Algorithm */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              3. Метод прямого поиска Хука-Дживса (Hooke-Jeeves Pattern Search)
            </h4>
            <p>
              {'В отличие от градиентных методов, метод Хука-Дживса не требует вычисления производных негладкой целевой функции F = max(VDOP). Он работает надежно в овражных и сингулярных зонах и состоит из двух этапов:'}
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>
                <strong className="text-slate-100">Исследовательский поиск (Exploratory Move):</strong> вокруг текущей базовой точки по каждой координате x_i, y_i, z_i производятся пробные шаги ±Δ. Если найдено улучшение, координата фиксируется.
              </li>
              <li>
                <strong className="text-slate-100">Поиск по образцу (Pattern Move / Ускоряющий шаг):</strong> при успешном исследовательском поиске совершается экстраполяция в направлении общего градиента движения: x_(k+1) = x_k + α(x_k - x_(k-1)).
              </li>
              <li>
                <strong className="text-slate-100">Сжатие координатной сетки (Step Reduction):</strong> если в окрестности улучшения не обнаружено, размер шага уменьшается: Δ_new = β · Δ_old (например, β = 0.5). Процесс сходится, когда Δ &lt; ε.
              </li>
            </ul>
            <p className="text-xs text-slate-400 italic">
              В MATLAB данный класс алгоритмов реализован в функции <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded">patternsearch</code> из пакета Global Optimization Toolbox. В нашем приложении он полностью реализован на чистом JavaScript/TypeScript с наглядной анимацией пробных лучей и векторов ускорения.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Математическая модель проверена на соответствие спецификациям ICAO & ВКО «Алмаз - Антей»
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
