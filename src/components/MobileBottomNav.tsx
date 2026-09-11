import React, { useState, useRef, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Monitor, 
  Database, 
  Menu, 
  ChevronUp, 
  Check, 
  Search,
  X,
  UserCheck,
  Activity,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { QueueBox } from '../types';
import { getTherapistCategory, TherapyCategory } from '../utils/savedOfficersService';

interface MobileBottomNavProps {
  boxes?: QueueBox[];
  selectedBoxId?: string | null;
  onSelectTherapist?: (boxId: string | null) => void;
  onToggleSidebar?: () => void;
  onOpenTherapistSidebar?: () => void;
  onOpenAddPatient: () => void;
  onOpenTVDisplay: () => void;
  onOpenDailyDatabase: () => void;
  onOpenResponseTime?: () => void;
  onOpenMore?: () => void;
  onOpenMoreMenu?: () => void;
  unreadCount?: number;
  activeCount?: number;
  completedCount?: number;
  therapistsCount?: number;
  activePatientsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  boxes = [],
  selectedBoxId = null,
  onSelectTherapist,
  onToggleSidebar,
  onOpenTherapistSidebar,
  onOpenAddPatient,
  onOpenTVDisplay,
  onOpenDailyDatabase,
  onOpenMore,
  onOpenMoreMenu,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | TherapyCategory>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen]);

  const handleTherapistClick = (boxId: string | null) => {
    setIsDropdownOpen(false);
    if (onSelectTherapist) {
      onSelectTherapist(boxId);
    } else if (onToggleSidebar) {
      onToggleSidebar();
    } else if (onOpenTherapistSidebar) {
      onOpenTherapistSidebar();
    }
  };

  const uniqueBoxes = boxes.filter((box, idx, arr) => {
    const norm = (box.officerName || '').trim().toLowerCase();
    return arr.findIndex(b => (b.officerName || '').trim().toLowerCase() === norm) === idx;
  });

  const fisioCount = uniqueBoxes.filter(b => getTherapistCategory(b.officerName, b.location, b.category) === 'fisio').length;
  const okupasiCount = uniqueBoxes.filter(b => getTherapistCategory(b.officerName, b.location, b.category) === 'okupasi').length;
  const wicaraCount = uniqueBoxes.filter(b => getTherapistCategory(b.officerName, b.location, b.category) === 'wicara').length;

  const filteredTherapists = uniqueBoxes.filter(box => {
    const boxCategory = getTherapistCategory(box.officerName, box.location, box.category);
    if (activeCategoryTab !== 'all' && boxCategory !== activeCategoryTab) {
      return false;
    }
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      box.officerName.toLowerCase().includes(q) ||
      box.title.toLowerCase().includes(q) ||
      box.location.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* Backdrop overlay for dropdown */}
      {isDropdownOpen && (
        <div 
          onClick={() => setIsDropdownOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-2xs transition-opacity lg:hidden"
        />
      )}

      {/* Custom Therapist Dropdown Menu with Fisio, Okupasi, Wicara */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          id="therapist-quick-dropdown"
          className="fixed bottom-18 left-3 right-3 sm:left-6 sm:right-auto sm:w-84 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Dropdown Header */}
          <div className="p-3 bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/30 border border-teal-400/40 flex items-center justify-center text-teal-300">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-tight leading-none text-white">
                  Pilih Divisi Terapis
                </h4>
                <p className="text-[10px] text-teal-200 font-medium mt-0.5">
                  {boxes.length} Terapis (Fisio, Okupasi, Wicara)
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsDropdownOpen(false)}
              className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Division Filter Tabs: Fisio, Okupasi, Wicara */}
          <div className="grid grid-cols-4 gap-1 p-1.5 bg-slate-100 border-b border-slate-200 shrink-0 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setActiveCategoryTab('all')}
              className={`py-1 rounded-md text-center transition-all ${
                activeCategoryTab === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({boxes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryTab('fisio')}
              className={`py-1 rounded-md text-center transition-all ${
                activeCategoryTab === 'fisio'
                  ? 'bg-teal-700 text-white shadow-2xs font-black'
                  : 'text-teal-800 hover:bg-teal-50'
              }`}
            >
              Fisio ({fisioCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryTab('okupasi')}
              className={`py-1 rounded-md text-center transition-all ${
                activeCategoryTab === 'okupasi'
                  ? 'bg-purple-700 text-white shadow-2xs font-black'
                  : 'text-purple-800 hover:bg-purple-50'
              }`}
            >
              Okupasi ({okupasiCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryTab('wicara')}
              className={`py-1 rounded-md text-center transition-all ${
                activeCategoryTab === 'wicara'
                  ? 'bg-amber-600 text-white shadow-2xs font-black'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Wicara ({wicaraCount})
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari nama terapis / ruangan..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                autoFocus
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Therapist Name List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5">
            {/* Show All Therapists Option */}
            {!searchFilter && (
              <button
                id="btn-select-all-therapists"
                onClick={() => handleTherapistClick(null)}
                className={`w-full px-3 py-2 text-left rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer mb-1 ${
                  !selectedBoxId 
                    ? 'bg-slate-100 text-slate-900 font-black border border-slate-300' 
                    : 'hover:bg-slate-50 text-slate-700 font-semibold'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 border ${
                    !selectedBoxId ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    ★
                  </span>
                  <span className="text-xs truncate">
                    Semua Terapis (Tampilkan Semua Kotak)
                  </span>
                </div>
                {!selectedBoxId && (
                  <Check className="w-4 h-4 text-slate-700 shrink-0" />
                )}
              </button>
            )}

            {filteredTherapists.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                Nama terapis tidak ditemukan di kategori ini
              </div>
            ) : (
              filteredTherapists.map((box, index) => {
                const isSelected = selectedBoxId === box.id;
                const cat = getTherapistCategory(box.officerName, box.location, box.category);
                return (
                  <button
                    key={box.id}
                    id={`btn-select-therapist-${box.id}`}
                    onClick={() => handleTherapistClick(box.id)}
                    className={`w-full px-3 py-2 text-left rounded-xl transition-colors flex items-center justify-between gap-2 group cursor-pointer ${
                      isSelected
                        ? cat === 'okupasi'
                          ? 'bg-purple-100/90 text-purple-950 font-black border border-purple-300 shadow-2xs'
                          : cat === 'wicara'
                          ? 'bg-amber-100/90 text-amber-950 font-black border border-amber-300 shadow-2xs'
                          : 'bg-teal-100/90 text-teal-950 font-black border border-teal-300 shadow-2xs'
                        : 'hover:bg-slate-50 active:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected 
                          ? cat === 'okupasi'
                            ? 'bg-purple-700 text-white border-purple-700'
                            : cat === 'wicara'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs truncate ${isSelected ? 'font-black' : 'font-bold text-slate-800'}`}>
                            {box.officerName}
                          </span>
                          <span className={`text-[9px] font-extrabold px-1 py-0.2 rounded shrink-0 ${
                            cat === 'okupasi' 
                              ? 'bg-purple-100 text-purple-800' 
                              : cat === 'wicara' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-teal-100 text-teal-800'
                          }`}>
                            {cat === 'okupasi' ? 'Okupasi' : cat === 'wicara' ? 'Wicara' : 'Fisio'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {box.location}
                        </p>
                      </div>
                    </div>

                    {isSelected ? (
                      <Check className={`w-4 h-4 shrink-0 ${
                        cat === 'okupasi' ? 'text-purple-700' : cat === 'wicara' ? 'text-amber-700' : 'text-teal-700'
                      }`} />
                    ) : (
                      <UserCheck className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main Mobile Navigation Bar */}
      <nav 
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 shadow-2xl py-1.5 px-3 lg:hidden flex items-center justify-around"
      >
        {/* 1. Terapis Button with Custom Dropdown Toggle */}
        <button
          ref={buttonRef}
          id="btn-nav-therapist-dropdown"
          onClick={() => setIsDropdownOpen(prev => !prev)}
          className={`flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all p-1 min-w-[54px] cursor-pointer ${
            isDropdownOpen ? 'text-teal-700' : 'text-slate-600 hover:text-teal-700'
          }`}
          title="Pilih Terapis"
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
            isDropdownOpen 
              ? 'bg-teal-600 text-white border-teal-600 shadow-sm' 
              : 'bg-teal-50 text-teal-700 border-teal-200/80 hover:bg-teal-100'
          }`}>
            <Users className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] font-bold text-slate-700">Terapis</span>
            <ChevronUp className={`w-2.5 h-2.5 text-slate-500 transition-transform ${isDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
          </div>
        </button>

        {/* 2. Database */}
        <button
          onClick={onOpenDailyDatabase}
          className="flex flex-col items-center justify-center gap-0.5 text-slate-600 hover:text-teal-700 active:scale-95 transition-all p-1 min-w-[54px] cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
            <Database className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold text-slate-700">Database</span>
        </button>

        {/* 3. CENTER PRIMARY: + PASIEN BARU */}
        <button
          onClick={onOpenAddPatient}
          className="flex flex-col items-center justify-center -mt-5 active:scale-95 transition-transform p-1 cursor-pointer group"
        >
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 border-2 border-white ring-2 ring-blue-600/20 group-hover:scale-105 transition-all">
            <UserPlus className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black text-blue-700 mt-0.5">+ Pasien</span>
        </button>

        {/* 4. Display TV */}
        <button
          onClick={onOpenTVDisplay}
          className="flex flex-col items-center justify-center gap-0.5 text-slate-600 hover:text-amber-700 active:scale-95 transition-all p-1 min-w-[54px] cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80">
            <Monitor className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold text-slate-700">Display TV</span>
        </button>

        {/* 5. Menu Lainnya */}
        <button
          onClick={onOpenMore || onOpenMoreMenu}
          className="flex flex-col items-center justify-center gap-0.5 text-slate-600 hover:text-indigo-700 active:scale-95 transition-all p-1 min-w-[54px] cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
            <Menu className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold text-slate-700">Menu</span>
        </button>
      </nav>
    </>
  );
};
