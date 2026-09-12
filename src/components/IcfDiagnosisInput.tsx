import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ICF_DIAGNOSES, RehabilitationDiscipline } from '../data/icfDiagnoses';
import { Stethoscope, Search, X, Activity, Brain, MessageSquare, Check, Sparkles, Plus, BookOpen } from 'lucide-react';

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
  const [customInput, setCustomInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync custom input with current value when modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomInput(value || '');
      setSearchFilter('');
      // Auto-focus search input after portal mounts
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, value]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (diagText: string, icfCode?: string) => {
    const fullText = icfCode ? `${diagText} (${icfCode})` : diagText;
    onChange(fullText);
    setIsOpen(false);
    setSearchFilter('');
  };

  const handleApplyCustom = () => {
    if (customInput.trim()) {
      onChange(customInput.trim());
    }
    setIsOpen(false);
  };

  // Calculate counts per discipline
  const countFT = ICF_DIAGNOSES.filter(c => c.discipline === 'FT').reduce((acc, c) => acc + c.items.length, 0);
  const countOT = ICF_DIAGNOSES.filter(c => c.discipline === 'OT').reduce((acc, c) => acc + c.items.length, 0);
  const countTW = ICF_DIAGNOSES.filter(c => c.discipline === 'TW').reduce((acc, c) => acc + c.items.length, 0);
  const countALL = countFT + countOT + countTW;

  // Filter categories by discipline & search query
  const filteredCategories = ICF_DIAGNOSES.map((cat) => {
    const isDisciplineMatch = selectedDiscipline === 'ALL' || cat.discipline === selectedDiscipline;
    if (!isDisciplineMatch) {
      return { ...cat, items: [] };
    }

    const items = cat.items.filter((item) => {
      const q = searchFilter.toLowerCase().trim();
      if (!q) return true;
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

  const totalFilteredItems = filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  const isSmall = size === 'sm';

  // Full Screen Modal Dialog Content
  const modalContent = isOpen ? (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="relative w-full max-w-5xl h-[92vh] sm:h-[88vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white shrink-0 flex items-center justify-between border-b border-teal-800/40">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner">
              <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  Bank Diagnosis ICF (WHO)
                  <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-teal-500/30 text-teal-200 border border-teal-400/40">
                    Instalasi Rehabilitasi Medik
                  </span>
                </h2>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium">
                Standar Internasional Klasifikasi Fungsi & Disabilitas (Fisioterapi • Okupasi Terapi • Terapi Wicara)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700">
              ESC untuk tutup
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors cursor-pointer"
              title="Tutup (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Discipline Filter Tabs & Quick Search */}
        <div className="p-3 sm:p-4 bg-slate-100/90 border-b border-slate-200 shrink-0 space-y-3">
          {/* Discipline Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-200/80 rounded-2xl border border-slate-300/70">
            <button
              type="button"
              onClick={() => setSelectedDiscipline('ALL')}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                selectedDiscipline === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-700" />
              <span>Semua Disiplin</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 font-mono">
                {countALL}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDiscipline('FT')}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                selectedDiscipline === 'FT'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-blue-900 hover:bg-blue-100/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Fisioterapi (FT)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${selectedDiscipline === 'FT' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-900'}`}>
                {countFT}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDiscipline('OT')}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                selectedDiscipline === 'OT'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-emerald-900 hover:bg-emerald-100/60'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Okupasi Terapi (OT)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${selectedDiscipline === 'OT' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-900'}`}>
                {countOT}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDiscipline('TW')}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                selectedDiscipline === 'TW'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                  : 'text-rose-900 hover:bg-rose-100/60'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Terapi Wicara (TW)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${selectedDiscipline === 'TW' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-900'}`}>
                {countTW}
              </span>
            </button>
          </div>

          {/* Search Bar & Result Counter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Ketik kata kunci diagnosa, nama kasus (LBP, Stroke, Disfagia, CP), atau kode ICF (b280, b730, b310)..."
                className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 shadow-2xs font-medium"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchFilter('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="hidden sm:flex items-center px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-bold shrink-0 shadow-2xs">
              <span>{totalFilteredItems} Diagnosis</span>
            </div>
          </div>
        </div>

        {/* Diagnosis Cards List (Full Spacious Grid) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 space-y-5">
          {filteredCategories.length === 0 ? (
            <div className="py-16 text-center space-y-3 max-w-md mx-auto">
              <div className="w-14 h-14 bg-slate-200 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Tidak ada diagnosis ICF yang cocok</h3>
              <p className="text-xs text-slate-500">
                Tidak ditemukan diagnosis dengan kata kunci &quot;{searchFilter}&quot;. Anda dapat mengetik diagnosa kustom secara langsung di kolom bawah.
              </p>
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <div key={cat.category} className="space-y-2.5">
                {/* Category Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                      {cat.category}
                    </h3>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${cat.disciplineBadge}`}>
                    {cat.disciplineLabel} ({cat.items.length})
                  </span>
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {cat.items.map((item) => {
                    const isCurrentSelected = value && value.toLowerCase().includes(item.name.toLowerCase());
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleSelect(item.name, item.icfCode)}
                        className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                          isCurrentSelected
                            ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                            : 'bg-white hover:bg-teal-50/60 border-slate-200/90 hover:border-teal-300 hover:shadow-md'
                        }`}
                      >
                        {isCurrentSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}

                        <div className="space-y-1 pr-6">
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-teal-950 leading-snug">
                              {item.name}
                            </span>
                          </div>

                          {item.icfCode && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-900 px-1.5 py-0.5 rounded-md border border-teal-200">
                                ICF: {item.icfCode}
                              </span>
                            </div>
                          )}

                          {item.description && (
                            <p className="text-[11px] text-slate-500 group-hover:text-slate-700 line-clamp-2 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-teal-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Pilih Diagnosis Ini</span>
                          <span>➔</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer: Custom Input & Actions */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex-1 w-full flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 shrink-0 hidden sm:inline">
              Diagnosis Terpilih / Kustom:
            </span>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Atau ketik diagnosa kustom / tambahan di sini..."
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-teal-500 text-slate-900 font-medium"
            />
            {customInput && (
              <button
                type="button"
                onClick={handleApplyCustom}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Gunakan</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onClick={() => setIsOpen(true)}
          className={`w-full pr-24 cursor-pointer ${
            isSmall
              ? 'px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 transition-colors'
              : 'px-3 py-2 text-xs text-slate-900 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 transition-colors'
          }`}
        />
        <div className="absolute right-1 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              title="Hapus input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            className="px-2 py-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white rounded-md flex items-center gap-1 cursor-pointer font-bold text-[10px] shadow-xs active:scale-95 transition-all"
            title="Buka Bank Diagnosis ICF WHO (FT / OT / TW) Full Layar"
          >
            <Stethoscope className="w-3 h-3" />
            <span>ICF WHO</span>
          </button>
        </div>
      </div>

      {/* Render Breakout Full Modal via Portal */}
      {typeof document !== 'undefined' && modalContent && createPortal(modalContent, document.body)}
    </div>
  );
};

