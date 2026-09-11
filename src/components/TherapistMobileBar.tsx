import React from 'react';
import { QueueBox, PatientItem } from '../types';
import { Users, Clock, CheckCircle2, AlertOctagon, Sparkles, Filter, ChevronRight } from 'lucide-react';

interface TherapistMobileBarProps {
  boxes: QueueBox[];
  patients: PatientItem[];
  selectedBoxId: string | null;
  onSelectBox: (boxId: string | null) => void;
  onOpenSidebar: () => void;
}

export const TherapistMobileBar: React.FC<TherapistMobileBarProps> = ({
  boxes,
  patients,
  selectedBoxId,
  onSelectBox,
  onOpenSidebar,
}) => {
  const totalActivePatients = patients.filter(p => !p.completed).length;

  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-y border-slate-200/90 shadow-xs py-2 px-3 lg:hidden sticky top-[57px] z-20 transition-all">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
          <div className="w-5 h-5 rounded-md bg-teal-600 text-white flex items-center justify-center">
            <Users className="w-3.5 h-3.5" />
          </div>
          <span>Akses Cepat Terapis & Ruangan</span>
        </div>

        <button
          onClick={onOpenSidebar}
          className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-0.5 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-full border border-teal-200 cursor-pointer transition-colors"
        >
          <span>Daftar Lengkap</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Horizontal Swipeable Chip Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
        {/* "Semua" Button */}
        <button
          onClick={() => onSelectBox(null)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
            selectedBoxId === null
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-900/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
        >
          <Filter className="w-3 h-3" />
          <span>Semua Kotak</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
            selectedBoxId === null ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {totalActivePatients}
          </span>
        </button>

        {/* Individual Therapist Chips */}
        {boxes.map((box) => {
          const isSelected = selectedBoxId === box.id;
          const boxPatients = patients.filter(p => p.boxId === box.id);
          const activeCount = boxPatients.filter(p => !p.completed).length;
          const isOverloaded = activeCount > 5;

          const colorClasses: Record<string, { active: string; idle: string }> = {
            sage: { active: 'bg-emerald-700 text-white border-emerald-600 ring-emerald-500/30', idle: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
            purple: { active: 'bg-purple-700 text-white border-purple-600 ring-purple-500/30', idle: 'border-purple-200 bg-purple-50 text-purple-900' },
            orange: { active: 'bg-orange-600 text-white border-orange-500 ring-orange-500/30', idle: 'border-orange-200 bg-orange-50 text-orange-900' },
            coral: { active: 'bg-rose-700 text-white border-rose-600 ring-rose-500/30', idle: 'border-rose-200 bg-rose-50 text-rose-900' },
            green: { active: 'bg-teal-700 text-white border-teal-600 ring-teal-500/30', idle: 'border-teal-200 bg-teal-50 text-teal-900' },
            yellow: { active: 'bg-amber-600 text-white border-amber-500 ring-amber-500/30', idle: 'border-amber-200 bg-amber-50 text-amber-950' },
            blue: { active: 'bg-blue-700 text-white border-blue-600 ring-blue-500/30', idle: 'border-blue-200 bg-blue-50 text-blue-900' },
            pink: { active: 'bg-pink-700 text-white border-pink-600 ring-pink-500/30', idle: 'border-pink-200 bg-pink-50 text-pink-900' },
            gray: { active: 'bg-slate-700 text-white border-slate-600 ring-slate-500/30', idle: 'border-slate-200 bg-slate-100 text-slate-800' },
            'metallic-dark': { active: 'bg-slate-900 text-teal-300 border-slate-700 ring-teal-500/30', idle: 'border-slate-700 bg-slate-900 text-slate-100' },
            'metallic-bronze': { active: 'bg-stone-900 text-amber-300 border-amber-800 ring-amber-500/30', idle: 'border-amber-900/60 bg-stone-900 text-amber-100' },
            'metallic-emerald': { active: 'bg-teal-950 text-emerald-300 border-emerald-800 ring-emerald-500/30', idle: 'border-emerald-900/60 bg-teal-950 text-emerald-100' },
            'metallic-ocean': { active: 'bg-sky-950 text-sky-300 border-sky-800 ring-sky-500/30', idle: 'border-sky-900/60 bg-sky-950 text-sky-100' },
          };

          const styling = colorClasses[box.color] || colorClasses.green;
          const shortOfficer = box.officerName.split(',')[0].trim();

          return (
            <button
              key={box.id}
              onClick={() => onSelectBox(isSelected ? null : box.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isSelected
                  ? `${styling.active} shadow-xs ring-2 ring-offset-1`
                  : isOverloaded
                  ? 'bg-rose-50 text-rose-900 border-rose-300 ring-1 ring-rose-400/40 animate-pulse'
                  : styling.idle
              }`}
              title={`${box.officerName} - ${box.title} (${activeCount} pasien antri)`}
            >
              <span className={`w-2 h-2 rounded-full ${
                isOverloaded
                  ? 'bg-rose-500 animate-ping'
                  : activeCount > 0
                  ? 'bg-emerald-500'
                  : 'bg-slate-300'
              }`} />
              
              <span className="truncate max-w-[110px]">
                {shortOfficer}
              </span>

              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : isOverloaded
                  ? 'bg-rose-600 text-white'
                  : activeCount > 0
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'bg-black/5 text-slate-500'
              }`}>
                {activeCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
