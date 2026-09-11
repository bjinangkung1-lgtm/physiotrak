import React, { useState, useRef, useEffect } from 'react';
import { ICF_DIAGNOSES, RehabilitationDiscipline } from '../data/icfDiagnoses';
import { ChevronDown, Stethoscope, Search, X, Activity, Brain, MessageSquare } from 'lucide-react';

interface IcfDiagnosisInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const IcfDiagnosisInput: React.FC<IcfDiagnosisInputProps> = ({
  value,
  onChange,
  placeholder = 'Pilih atau ketik diagnosis ICF...',
  className = '',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<RehabilitationDiscipline>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (diagText: string, icfCode?: string) => {
    const fullText = icfCode ? `${diagText} (${icfCode})` : diagText;
    onChange(fullText);
    setIsOpen(false);
    setSearchFilter('');
  };

  // Filter categories by discipline & search query
  const filteredCategories = ICF_DIAGNOSES.map((cat) => {
    const isDisciplineMatch = selectedDiscipline === 'ALL' || cat.discipline === selectedDiscipline;
    if (!isDisciplineMatch) {
      return { ...cat, items: [] };
    }

    const items = cat.items.filter((item) => {
      const q = searchFilter.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchCode = item.icfCode?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q));

      return matchName || matchCode || matchDesc || matchKeywords;
    });

    return {
      ...cat,
      items,
    };
  }).filter((cat) => cat.items.length > 0);

  const isSmall = size === 'sm';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pr-14 ${
            isSmall
              ? 'px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900 focus:bg-white'
              : 'px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500'
          }`}
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              title="Hapus input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) setSearchFilter('');
            }}
            className="p-1 text-teal-700 hover:bg-teal-50 rounded flex items-center gap-0.5 cursor-pointer font-bold text-[10px]"
            title="Buka Bank Diagnosis ICF (FT / OT / TW)"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full sm:w-[420px] right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-96 flex flex-col">
          {/* Header & Quick Search */}
          <div className="p-3 bg-gradient-to-r from-teal-50 via-slate-50 to-indigo-50/40 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-teal-950 flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-teal-600" />
                Daftar Diagnosis ICF (WHO) - IRM
              </span>
              <span className="text-[10px] font-medium text-slate-500">
                Fisioterapi • Okupasi • Wicara
              </span>
            </div>

            {/* Discipline Tabs: ALL, FT, OT, TW */}
            <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedDiscipline('ALL')}
                className={`py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                  selectedDiscipline === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedDiscipline('FT')}
                className={`py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedDiscipline === 'FT'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-blue-900 hover:bg-blue-100/50'
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>FT (Fisio)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDiscipline('OT')}
                className={`py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedDiscipline === 'OT'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-900 hover:bg-emerald-100/50'
                }`}
              >
                <Brain className="w-3 h-3" />
                <span>OT (Okupasi)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDiscipline('TW')}
                className={`py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedDiscipline === 'TW'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-900 hover:bg-rose-100/50'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>TW (Wicara)</span>
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari kasus, kode ICF (b280, b730, b310), atau gejala..."
                autoFocus
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List of ICF Categories & Items */}
          <div className="overflow-y-auto p-2 divide-y divide-slate-100 flex-1 space-y-2">
            {filteredCategories.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <p>Tidak ada diagnosis ICF yang cocok dengan filter atau kata kunci.</p>
                <p className="text-[11px] text-teal-700 font-medium">
                  Anda tetap dapat mengetik diagnosis spesifik secara manual pada formulir.
                </p>
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.category} className="pt-2 first:pt-0">
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/70 mb-1">
                    <span className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wide truncate">
                      {cat.category}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${cat.disciplineBadge}`}>
                      {cat.disciplineLabel}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {cat.items.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleSelect(item.name, item.icfCode)}
                        className="w-full text-left p-2 rounded-xl hover:bg-teal-50/80 border border-transparent hover:border-teal-200 transition-all flex flex-col group cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-teal-950 leading-snug">
                            {item.name}
                          </span>
                          {item.icfCode && (
                            <span className="text-[10px] font-mono font-bold bg-teal-100/90 text-teal-900 px-1.5 py-0.2 rounded-md shrink-0 border border-teal-200">
                              {item.icfCode}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <span className="text-[10px] text-slate-500 group-hover:text-slate-700 line-clamp-2 mt-0.5">
                            {item.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
