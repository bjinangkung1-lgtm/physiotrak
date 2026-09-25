import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Volume2, 
  VolumeX, 
  FileText, 
  Monitor, 
  History, 
  FolderPlus,
  Bell,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Users,
  Smartphone,
  QrCode,
  Activity,
  ShieldAlert,
  Zap,
  Timer,
  Clock,
  Sparkles,
  Layers,
  Menu,
  ChevronDown,
  Check,
  UserCheck,
  MessageSquare,
  ChevronRight,
  TrendingDown,
  Lock,
  KeyRound,
  LogOut,
  BookOpen,
  GripVertical,
  ChevronUp,
  ArrowUpDown
} from 'lucide-react';
import { QueueBox, PatientItem } from '../types';
import { getTherapistCategory, getCanonicalTherapistKey, TherapyCategory } from '../utils/savedOfficersService';

interface HeaderProps {
  boxes?: QueueBox[];
  patients?: PatientItem[];
  selectedTherapistBoxId?: string | null;
  onSelectTherapist?: (boxId: string | null) => void;
  onReorderBoxes?: (newBoxes: QueueBox[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: 'all' | 'active' | 'completed' | 'warning';
  setStatusFilter: (f: 'all' | 'active' | 'completed' | 'warning') => void;
  onOpenDailyDatabase?: () => void;
  onOpenReport?: () => void;
  onOpenMonthlyReport?: () => void;
  therapistsCount?: number;
  totalActiveCount: number;
  totalCompletedCount: number;
  totalWarningCount: number;
  overloadCount?: number;
  avgWaitMinutes?: number;
  onOpenIntelligence?: () => void;
  onOpenResponseTimeAnalytics?: () => void;
  onOpenLainLain?: (tab?: 'kas' | 'rotasi' | 'sabtu' | 'cuti') => void;
  isRealtimeConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  boxes = [],
  patients = [],
  selectedTherapistBoxId = null,
  onSelectTherapist,
  onReorderBoxes,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onOpenDailyDatabase,
  onOpenReport,
  onOpenMonthlyReport,
  therapistsCount = 0,
  totalActiveCount,
  totalCompletedCount,
  totalWarningCount,
  overloadCount = 0,
  avgWaitMinutes = 0,
  onOpenIntelligence,
  onOpenResponseTimeAnalytics,
  onOpenLainLain,
  isRealtimeConnected = true,
}) => {
  const [activeCategoryDropdown, setActiveCategoryDropdown] = useState<TherapyCategory | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [draggedCategoryBoxId, setDraggedCategoryBoxId] = useState<string | null>(null);
  const [dragOverCategoryBoxId, setDragOverCategoryBoxId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Logo di tengah menonjol ke bawah saat di puncak halaman, lalu merapat ke
  // dalam bilah saat digulir. Ambang turun dan naik dibuat berbeda supaya tidak
  // berkedip bolak-balik di sekitar batas.
  const [isCondensed, setIsCondensed] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setIsCondensed(prev => (prev ? y > 24 : y > 80));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Standalone local ON/OFF status for dropdown list only (purely inside dropdown, does not affect anything else)
  const [dropdownTherapistStatus, setDropdownTherapistStatus] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('dropdown_therapist_on_off_status');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleDropdownTherapistStatus = (boxId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDropdownTherapistStatus(prev => {
      const current = prev[boxId] !== false; // default is true (ON)
      const next = { ...prev, [boxId]: !current };
      try {
        localStorage.setItem('dropdown_therapist_on_off_status', JSON.stringify(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveCategoryDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to identify Transport / Jemputan Ranap boxes
  const isJemputanBox = (b: QueueBox) => {
    const idLower = (b.id || '').toLowerCase();
    const nameLower = (b.officerName || '').toLowerCase();
    const titleLower = (b.title || '').toLowerCase();
    return (
      idLower === 'box-jemputan' ||
      idLower.includes('jemputan') ||
      idLower.includes('transport') ||
      nameLower.includes('transport') ||
      nameLower.includes('jemputan') ||
      titleLower.includes('jemputan') ||
      titleLower.includes('transport')
    );
  };

  // Helper to compute patient stats per box
  const getBoxPatientStats = (boxId: string) => {
    const boxPatients = patients.filter(p => p.boxId === boxId);
    const active = boxPatients.filter(p => !p.completed).length;
    const completed = boxPatients.filter(p => p.completed).length;
    const total = boxPatients.length;
    return { active, completed, total };
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveCategoryDropdown(null);
      }
    };

    if (activeCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeCategoryDropdown]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeCategoryDropdown) {
        setActiveCategoryDropdown(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCategoryDropdown]);

  const handleTherapistSelect = (boxId: string | null) => {
    setActiveCategoryDropdown(null);
    if (onSelectTherapist) {
      onSelectTherapist(boxId);
    }
  };

  const uniqueBoxes = boxes.filter((box, idx, arr) => {
    const key = getCanonicalTherapistKey(box.officerName, box.location, box.id);
    if (key === 'ft-tri' || key === 'ft-bustomi') return false;
    return arr.findIndex(b => b.id === box.id) === idx;
  });

  const fisioBoxes = uniqueBoxes.filter(b => getTherapistCategory(b.officerName, b.location, b.category) === 'fisio');
  const okupasiBoxes = uniqueBoxes.filter(b => getTherapistCategory(b.officerName, b.location, b.category) === 'okupasi');
  const wicaraBoxes = uniqueBoxes.filter(b => getTherapistCategory(b.officerName, b.location, b.category) === 'wicara');

  // Filter out transport/jemputan boxes for lowest patient count calculation
  const nonTransportFisioBoxes = useMemo(() => {
    return fisioBoxes.filter(b => !isJemputanBox(b));
  }, [fisioBoxes]);

  // Exclude the bottom 4 therapists in the fisio dropdown list from the least-patients algorithm
  const eligibleFisioBoxesForAlgorithm = useMemo(() => {
    if (nonTransportFisioBoxes.length <= 4) return nonTransportFisioBoxes;
    return nonTransportFisioBoxes.slice(0, nonTransportFisioBoxes.length - 4);
  }, [nonTransportFisioBoxes]);

  const nonTransportOkupasiBoxes = useMemo(() => {
    return okupasiBoxes.filter(b => !isJemputanBox(b));
  }, [okupasiBoxes]);

  const nonTransportWicaraBoxes = useMemo(() => {
    return wicaraBoxes.filter(b => !isJemputanBox(b));
  }, [wicaraBoxes]);

  // Dynamic calculation: find minimum total patient count (active + completed) among eligible fisio therapists (excluding bottom 4)
  const minFisioTotalCount = useMemo(() => {
    if (eligibleFisioBoxesForAlgorithm.length === 0) return null;
    const counts = eligibleFisioBoxesForAlgorithm.map(b => getBoxPatientStats(b.id).total);
    return Math.min(...counts);
  }, [eligibleFisioBoxesForAlgorithm, patients]);

  // Dynamic calculation: find minimum total patient count (active + completed) among okupasi therapists
  const minOkupasiTotalCount = useMemo(() => {
    if (nonTransportOkupasiBoxes.length === 0) return null;
    const counts = nonTransportOkupasiBoxes.map(b => getBoxPatientStats(b.id).total);
    return Math.min(...counts);
  }, [nonTransportOkupasiBoxes, patients]);

  // Dynamic calculation: find minimum total patient count (active + completed) among wicara therapists
  const minWicaraTotalCount = useMemo(() => {
    if (nonTransportWicaraBoxes.length === 0) return null;
    const counts = nonTransportWicaraBoxes.map(b => getBoxPatientStats(b.id).total);
    return Math.min(...counts);
  }, [nonTransportWicaraBoxes, patients]);

  // Set of box IDs that currently have the lowest total count (excluding transport and excluding bottom 4 in fisio dropdown)
  const lowestFisioTherapistIds = useMemo(() => {
    if (minFisioTotalCount === null || eligibleFisioBoxesForAlgorithm.length === 0) return new Set<string>();
    const ids = new Set<string>();
    eligibleFisioBoxesForAlgorithm.forEach(b => {
      if (getBoxPatientStats(b.id).total === minFisioTotalCount) {
        ids.add(b.id);
      }
    });
    return ids;
  }, [eligibleFisioBoxesForAlgorithm, minFisioTotalCount, patients]);

  const lowestOkupasiTherapistIds = useMemo(() => {
    if (minOkupasiTotalCount === null) return new Set<string>();
    const ids = new Set<string>();
    nonTransportOkupasiBoxes.forEach(b => {
      if (getBoxPatientStats(b.id).total === minOkupasiTotalCount) {
        ids.add(b.id);
      }
    });
    return ids;
  }, [nonTransportOkupasiBoxes, minOkupasiTotalCount, patients]);

  const lowestWicaraTherapistIds = useMemo(() => {
    if (minWicaraTotalCount === null) return new Set<string>();
    const ids = new Set<string>();
    nonTransportWicaraBoxes.forEach(b => {
      if (getBoxPatientStats(b.id).total === minWicaraTotalCount) {
        ids.add(b.id);
      }
    });
    return ids;
  }, [nonTransportWicaraBoxes, minWicaraTotalCount, patients]);

  const primaryLowestFisioBox = useMemo(() => {
    return eligibleFisioBoxesForAlgorithm.find(b => lowestFisioTherapistIds.has(b.id));
  }, [eligibleFisioBoxesForAlgorithm, lowestFisioTherapistIds]);

  const primaryLowestOkupasiBox = useMemo(() => {
    return nonTransportOkupasiBoxes.find(b => lowestOkupasiTherapistIds.has(b.id));
  }, [nonTransportOkupasiBoxes, lowestOkupasiTherapistIds]);

  const primaryLowestWicaraBox = useMemo(() => {
    return nonTransportWicaraBoxes.find(b => lowestWicaraTherapistIds.has(b.id));
  }, [nonTransportWicaraBoxes, lowestWicaraTherapistIds]);

  const selectedBox = boxes.find(b => b.id === selectedTherapistBoxId);
  const selectedCategory = selectedBox ? getTherapistCategory(selectedBox.officerName, selectedBox.location, selectedBox.category) : null;

  const getActiveCategoryBoxes = () => {
    let list: QueueBox[] = [];
    if (activeCategoryDropdown === 'fisio') list = fisioBoxes;
    else if (activeCategoryDropdown === 'okupasi') list = okupasiBoxes;
    else if (activeCategoryDropdown === 'wicara') list = wicaraBoxes;

    // Preserve each distinct box by ID
    const seenIds = new Set<string>();
    list = list.filter(b => {
      if (seenIds.has(b.id)) return false;
      seenIds.add(b.id);
      return true;
    });

    if (!categorySearch.trim()) return list;
    const q = categorySearch.toLowerCase();
    return list.filter(b =>
      b.officerName.toLowerCase().includes(q) ||
      b.title.toLowerCase().includes(q) ||
      b.location.toLowerCase().includes(q)
    );
  };

  const getCategoryBoxesUnfiltered = () => {
    let list: QueueBox[] = [];
    if (activeCategoryDropdown === 'fisio') list = fisioBoxes;
    else if (activeCategoryDropdown === 'okupasi') list = okupasiBoxes;
    else if (activeCategoryDropdown === 'wicara') list = wicaraBoxes;

    const seenIds = new Set<string>();
    return list.filter(b => {
      if (seenIds.has(b.id)) return false;
      seenIds.add(b.id);
      return true;
    });
  };

  const handleReorderCategory = (fromIndex: number, toIndex: number) => {
    if (!onReorderBoxes || !activeCategoryDropdown) return;
    const catBoxes = getCategoryBoxesUnfiltered();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= catBoxes.length ||
      toIndex >= catBoxes.length
    ) {
      return;
    }

    const categoryBoxIds = new Set(catBoxes.map(b => b.id));
    const reorderedCategory = [...catBoxes];
    const [movedBox] = reorderedCategory.splice(fromIndex, 1);
    reorderedCategory.splice(toIndex, 0, movedBox);

    let catPointer = 0;
    const nextBoxes = boxes.map(b => {
      if (categoryBoxIds.has(b.id)) {
        const replacement = reorderedCategory[catPointer];
        catPointer++;
        return replacement;
      }
      return b;
    });

    const orderedNextBoxes = nextBoxes.map((b, idx) => ({ ...b, order: idx }));
    onReorderBoxes(orderedNextBoxes);
  };

  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/80 shadow-lg shadow-black/20 px-3 sm:px-4 lg:px-6 xl:px-8 py-2 shrink-0 text-white">
      <div className="max-w-7xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2">
        {/* Kiri: pencarian & divisi terapis */}
        <div className="col-start-1 row-start-1 flex items-center gap-2 min-w-0">
          <div className="relative h-9 shrink-0">
            {isSearchOpen ? (
              <>
                <div className="w-9 h-9" />
                <div className="absolute left-0 top-0 z-40 w-[min(420px,calc(100vw-1.5rem))] animate-in fade-in zoom-in-95 duration-150 origin-left">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-teal-300 pointer-events-none" />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => setIsSearchOpen(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' || e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    placeholder="Cari pasien, no RM, tindakan, terapis..."
                    className="w-full h-9 pl-9 pr-9 text-xs bg-slate-900 border border-teal-400/60 rounded-xl outline-hidden ring-4 ring-teal-500/15 text-slate-100 placeholder-slate-400 font-medium shadow-2xl shadow-black/50"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white bg-slate-700/80 hover:bg-slate-600 rounded-full p-1 cursor-pointer transition-colors"
                      title="Hapus kata kunci pencarian"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                id="btn-header-search"
                onClick={() => setIsSearchOpen(true)}
                className={`h-9 flex items-center gap-1.5 rounded-xl border transition-all cursor-pointer ${
                  searchQuery
                    ? 'max-w-[160px] px-2.5 bg-teal-500/15 border-teal-400/50 text-teal-100'
                    : 'w-9 justify-center bg-slate-800/70 hover:bg-slate-700/80 border-slate-700/80 text-slate-200'
                }`}
                title="Cari pasien, no RM, tindakan, terapis"
                aria-label="Cari pasien"
              >
                <Search className="w-4 h-4 shrink-0 pointer-events-none" />
                {searchQuery && <span className="text-xs font-bold truncate pointer-events-none">{searchQuery}</span>}
              </button>
            )}
          </div>

          <div className="hidden sm:block shrink-0">
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-800/70 rounded-xl border border-slate-700/80">
                {/* 1. Tombol Fisio */}
                <button
                  id="btn-header-fisio"
                  type="button"
                  onClick={() => {
                    setActiveCategoryDropdown(prev => prev === 'fisio' ? null : 'fisio');
                    setCategorySearch('');
                  }}
                  className={`flex items-center gap-1 px-1.5 xl:px-2 h-8 text-xs font-black rounded-lg transition-all cursor-pointer border relative ${
                    selectedCategory === 'fisio'
                      ? 'bg-teal-600 text-white border-teal-500 shadow-xs ring-1 ring-teal-400'
                      : activeCategoryDropdown === 'fisio'
                      ? 'bg-slate-900 text-teal-300 border-teal-500/50 shadow-2xs'
                      : 'bg-transparent text-slate-300 hover:bg-slate-700/70 hover:text-teal-300 border-transparent'
                  }`}
                  title={`Divisi Fisioterapi (FT) — Total ${fisioBoxes.length} Terapis`}
                >
                  <Activity className={`hidden xl:block w-3.5 h-3.5 ${selectedCategory === 'fisio' ? 'text-teal-200' : 'text-teal-400'}`} />
                  <span>Fisio</span>
                  {selectedCategory === 'fisio' && selectedBox ? (
                    <span className="max-w-[70px] truncate text-[10px] bg-teal-950 text-teal-200 px-1 py-0.2 rounded font-bold">
                      {selectedBox.officerName.split(' ')[0]}
                    </span>
                  ) : (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      selectedCategory === 'fisio' ? 'bg-teal-900 text-teal-100' : 'bg-teal-950/80 text-teal-300 border border-teal-800/60'
                    }`}>
                      {fisioBoxes.length}
                    </span>
                  )}
                  {/* Dynamic pulse indicator for lowest total patient count among therapists */}
                  {minFisioTotalCount !== null && (
                    <span 
                      className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" 
                      title={`Terapis dengan total pasien paling sedikit: ${minFisioTotalCount} pasien (antre + selesai)`} 
                    />
                  )}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${activeCategoryDropdown === 'fisio' ? 'rotate-180' : ''}`} />
                </button>

                {/* 2. Tombol Okupasi */}
                <button
                  id="btn-header-okupasi"
                  type="button"
                  onClick={() => {
                    setActiveCategoryDropdown(prev => prev === 'okupasi' ? null : 'okupasi');
                    setCategorySearch('');
                  }}
                  className={`flex items-center gap-1 px-1.5 xl:px-2 h-8 text-xs font-black rounded-lg transition-all cursor-pointer border relative ${
                    selectedCategory === 'okupasi'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-xs ring-1 ring-purple-400'
                      : activeCategoryDropdown === 'okupasi'
                      ? 'bg-slate-900 text-purple-300 border-purple-500/50 shadow-2xs'
                      : 'bg-transparent text-slate-300 hover:bg-slate-700/70 hover:text-purple-300 border-transparent'
                  }`}
                  title={`Divisi Terapi Okupasi (OT) — Total ${okupasiBoxes.length} Terapis`}
                >
                  <Sparkles className={`hidden xl:block w-3.5 h-3.5 ${selectedCategory === 'okupasi' ? 'text-purple-200' : 'text-purple-400'}`} />
                  <span>Okupasi</span>
                  {selectedCategory === 'okupasi' && selectedBox ? (
                    <span className="max-w-[70px] truncate text-[10px] bg-purple-950 text-purple-200 px-1 py-0.2 rounded font-bold">
                      {selectedBox.officerName.split(' ')[0]}
                    </span>
                  ) : (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      selectedCategory === 'okupasi' ? 'bg-purple-900 text-purple-100' : 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                    }`}>
                      {okupasiBoxes.length}
                    </span>
                  )}
                  {/* Dynamic pulse indicator for lowest total patient count among therapists */}
                  {minOkupasiTotalCount !== null && (
                    <span 
                      className="w-2 h-2 rounded-full bg-purple-400 animate-ping shrink-0" 
                      title={`Terapis dengan total pasien paling sedikit Okupasi: ${minOkupasiTotalCount} pasien (antre + selesai)`} 
                    />
                  )}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${activeCategoryDropdown === 'okupasi' ? 'rotate-180' : ''}`} />
                </button>

                {/* 3. Tombol Wicara */}
                <button
                  id="btn-header-wicara"
                  type="button"
                  onClick={() => {
                    setActiveCategoryDropdown(prev => prev === 'wicara' ? null : 'wicara');
                    setCategorySearch('');
                  }}
                  className={`flex items-center gap-1 px-1.5 xl:px-2 h-8 text-xs font-black rounded-lg transition-all cursor-pointer border relative ${
                    selectedCategory === 'wicara'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-xs ring-1 ring-amber-400'
                      : activeCategoryDropdown === 'wicara'
                      ? 'bg-slate-900 text-amber-300 border-amber-500/50 shadow-2xs'
                      : 'bg-transparent text-slate-300 hover:bg-slate-700/70 hover:text-amber-300 border-transparent'
                  }`}
                  title={`Divisi Terapi Wicara (TW) — Total ${wicaraBoxes.length} Terapis`}
                >
                  <MessageSquare className={`hidden xl:block w-3.5 h-3.5 ${selectedCategory === 'wicara' ? 'text-amber-200' : 'text-amber-400'}`} />
                  <span>Wicara</span>
                  {selectedCategory === 'wicara' && selectedBox ? (
                    <span className="max-w-[70px] truncate text-[10px] bg-amber-950 text-amber-200 px-1 py-0.2 rounded font-bold">
                      {selectedBox.officerName.split(' ')[0]}
                    </span>
                  ) : (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      selectedCategory === 'wicara' ? 'bg-amber-900 text-amber-100' : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                    }`}>
                      {wicaraBoxes.length}
                    </span>
                  )}
                  {/* Dynamic pulse indicator for lowest total patient count among therapists */}
                  {minWicaraTotalCount !== null && (
                    <span 
                      className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" 
                      title={`Terapis dengan total pasien paling sedikit Wicara: ${minWicaraTotalCount} pasien (antre + selesai)`} 
                    />
                  )}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${activeCategoryDropdown === 'wicara' ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Dropdown Menu Popup - rata kiri (left-0), sebab tombol divisi kini di sisi kiri header */}
              {activeCategoryDropdown && (() => {
                const currentCategoryBoxes = 
                  activeCategoryDropdown === 'fisio' ? fisioBoxes :
                  activeCategoryDropdown === 'okupasi' ? okupasiBoxes : wicaraBoxes;

                return (
                  <div 
                    id="header-therapist-category-dropdown-panel"
                    className="absolute top-full left-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] overflow-hidden flex flex-col max-h-[82vh] animate-in fade-in zoom-in-95 duration-150"
                  >
                    {/* Dynamic Header based on active category */}
                    <div className={`p-3 text-white flex items-center justify-between shrink-0 gap-2 ${
                      activeCategoryDropdown === 'fisio' 
                        ? 'bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950' 
                        : activeCategoryDropdown === 'okupasi'
                        ? 'bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950'
                        : 'bg-gradient-to-r from-amber-900 via-slate-900 to-orange-950'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {activeCategoryDropdown === 'fisio' && <Activity className="w-4 h-4 text-teal-300 shrink-0" />}
                        {activeCategoryDropdown === 'okupasi' && <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />}
                        {activeCategoryDropdown === 'wicara' && <MessageSquare className="w-4 h-4 text-amber-300 shrink-0" />}
                        <div className="min-w-0">
                          <span className="text-xs font-black tracking-tight block truncate">
                            {activeCategoryDropdown === 'fisio' && 'Divisi Fisioterapi (FT)'}
                            {activeCategoryDropdown === 'okupasi' && 'Divisi Terapi Okupasi (OT)'}
                            {activeCategoryDropdown === 'wicara' && 'Divisi Terapi Wicara (TW)'}
                          </span>
                          <span className="text-[10px] text-slate-300 font-medium">
                            {currentCategoryBoxes.length} Kotak Terapis
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Shifting Recommendation Banner */}
                    {(() => {
                      const activeLowestBox = 
                        activeCategoryDropdown === 'fisio'
                          ? primaryLowestFisioBox
                          : activeCategoryDropdown === 'okupasi'
                          ? primaryLowestOkupasiBox
                          : primaryLowestWicaraBox;

                      const activeMinTotal = 
                        activeCategoryDropdown === 'fisio'
                          ? minFisioTotalCount
                          : activeCategoryDropdown === 'okupasi'
                          ? minOkupasiTotalCount
                          : minWicaraTotalCount;

                      if (!activeLowestBox || activeMinTotal === null || categorySearch) return null;
                      const lowestStats = getBoxPatientStats(activeLowestBox.id);

                      return (
                        <div className={`p-2.5 border-b flex items-center justify-between gap-2 shrink-0 transition-all duration-300 ${
                          activeCategoryDropdown === 'fisio'
                            ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-200/80'
                            : activeCategoryDropdown === 'okupasi'
                            ? 'bg-gradient-to-r from-purple-50 via-fuchsia-50 to-purple-50 border-purple-200/80'
                            : 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-200/80'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                activeCategoryDropdown === 'fisio' ? 'bg-emerald-400' : activeCategoryDropdown === 'okupasi' ? 'bg-purple-400' : 'bg-amber-400'
                              }`}></span>
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                activeCategoryDropdown === 'fisio' ? 'bg-emerald-500' : activeCategoryDropdown === 'okupasi' ? 'bg-purple-500' : 'bg-amber-500'
                              }`}></span>
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                                  activeCategoryDropdown === 'fisio'
                                    ? 'text-emerald-800 bg-emerald-100/90 border-emerald-300/60'
                                    : activeCategoryDropdown === 'okupasi'
                                    ? 'text-purple-800 bg-purple-100/90 border-purple-300/60'
                                    : 'text-amber-800 bg-amber-100/90 border-amber-300/60'
                                }`}>
                                  ⚡ Rekomendasi Antrean Terendah
                                </span>
                                <span className={`text-[10px] font-extrabold ${
                                  activeCategoryDropdown === 'fisio' ? 'text-emerald-700' : activeCategoryDropdown === 'okupasi' ? 'text-purple-700' : 'text-amber-700'
                                }`}>
                                  ({activeMinTotal} total: {lowestStats.active} antre, {lowestStats.completed} selesai)
                                </span>
                              </div>
                              <p className={`text-xs font-bold truncate mt-0.5 ${
                                activeCategoryDropdown === 'fisio' ? 'text-emerald-950' : activeCategoryDropdown === 'okupasi' ? 'text-purple-950' : 'text-amber-950'
                              }`}>
                                {activeLowestBox.officerName}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTherapistSelect(activeLowestBox.id)}
                            className={`px-2.5 py-1 text-[11px] font-black text-white rounded-lg transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1 ${
                              activeCategoryDropdown === 'fisio'
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : activeCategoryDropdown === 'okupasi'
                                ? 'bg-purple-600 hover:bg-purple-700'
                                : 'bg-amber-600 hover:bg-amber-700'
                            }`}
                          >
                            <span>Fokus</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })()}

                    {/* Quick Search */}
                    <div className="p-2 bg-slate-50 border-b border-slate-100 shrink-0">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder={`Cari nama ${activeCategoryDropdown === 'fisio' ? 'fisioterapis' : activeCategoryDropdown === 'okupasi' ? 'terapis okupasi' : 'terapis wicara'}...`}
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className={`w-full pl-8 pr-6 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none transition-all placeholder:text-slate-400 font-medium ${
                            activeCategoryDropdown === 'fisio'
                              ? 'focus:border-teal-500'
                              : activeCategoryDropdown === 'okupasi'
                              ? 'focus:border-purple-500'
                              : 'focus:border-amber-500'
                          }`}
                          autoFocus
                        />
                        {categorySearch && (
                          <button
                            onClick={() => setCategorySearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reorder Guidance Bar */}
                    {!categorySearch ? (
                      <div className="px-3 py-1.5 bg-slate-100/90 border-b border-slate-200/80 flex items-center justify-between text-[10px] text-slate-600 shrink-0">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          <span>Urutan Kotak Terapis</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">Tarik handle ⠿ atau klik ▲▼</span>
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-amber-50/80 border-b border-amber-200/60 flex items-center gap-1.5 text-[10px] text-amber-800 shrink-0">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>Pencarian aktif: bersihkan untuk menggeser urutan</span>
                      </div>
                    )}

                    {/* Therapist Name List */}
                    <div className="flex-1 overflow-y-auto p-1.5 divide-y divide-slate-100 max-h-80">
                      {/* Option: Show All Therapists */}
                      {!categorySearch && (
                        <button
                          type="button"
                          onClick={() => handleTherapistSelect(null)}
                          className={`w-full px-3 py-2 text-left rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer mb-1 ${
                            !selectedTherapistBoxId 
                              ? 'bg-slate-100 text-slate-900 font-black border border-slate-300' 
                              : 'hover:bg-slate-50 text-slate-700 font-semibold'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 border ${
                              !selectedTherapistBoxId ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              ★
                            </span>
                            <span className="text-xs truncate">
                              Tampilkan Semua Kotak (Reset Filter)
                            </span>
                          </div>
                          {!selectedTherapistBoxId && (
                            <Check className="w-4 h-4 text-slate-700 shrink-0" />
                          )}
                        </button>
                      )}

                      {getActiveCategoryBoxes().length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 font-medium flex flex-col items-center gap-2">
                          <span>Tidak ada terapis yang cocok</span>
                        </div>
                      ) : (
                        getActiveCategoryBoxes().map((box, index) => {
                          const isSelected = selectedTherapistBoxId === box.id;
                          const stats = getBoxPatientStats(box.id);
                          const isJemputan = isJemputanBox(box);
                          const isLowest = 
                            !isJemputan &&
                            ((activeCategoryDropdown === 'fisio' && lowestFisioTherapistIds.has(box.id)) ||
                            (activeCategoryDropdown === 'okupasi' && lowestOkupasiTherapistIds.has(box.id)) ||
                            (activeCategoryDropdown === 'wicara' && lowestWicaraTherapistIds.has(box.id)));

                          const isDraggingThis = draggedCategoryBoxId === box.id;
                          const isDragOverThis = dragOverCategoryBoxId === box.id && !isDraggingThis;
                          const canReorder = !categorySearch.trim();
                          const allCategoryBoxes = getCategoryBoxesUnfiltered();

                          return (
                            <div
                              key={box.id}
                              id={`category-item-${box.id}`}
                              role="button"
                              tabIndex={0}
                              draggable={canReorder}
                              onDragStart={(e) => {
                                if (!canReorder) return;
                                e.dataTransfer.setData('text/plain', box.id);
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedCategoryBoxId(box.id);
                              }}
                              onDragOver={(e) => {
                                if (!canReorder) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverCategoryBoxId !== box.id) {
                                  setDragOverCategoryBoxId(box.id);
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverCategoryBoxId === box.id) {
                                  setDragOverCategoryBoxId(null);
                                }
                              }}
                              onDrop={(e) => {
                                if (!canReorder) return;
                                e.preventDefault();
                                if (!draggedCategoryBoxId || draggedCategoryBoxId === box.id) {
                                  setDraggedCategoryBoxId(null);
                                  setDragOverCategoryBoxId(null);
                                  return;
                                }
                                const fromIdx = allCategoryBoxes.findIndex(b => b.id === draggedCategoryBoxId);
                                const toIdx = allCategoryBoxes.findIndex(b => b.id === box.id);
                                if (fromIdx !== -1 && toIdx !== -1) {
                                  handleReorderCategory(fromIdx, toIdx);
                                }
                                setDraggedCategoryBoxId(null);
                                setDragOverCategoryBoxId(null);
                              }}
                              onDragEnd={() => {
                                setDraggedCategoryBoxId(null);
                                setDragOverCategoryBoxId(null);
                              }}
                              onClick={() => handleTherapistSelect(box.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleTherapistSelect(box.id);
                                }
                              }}
                              className={`w-full px-2 py-2 text-left rounded-xl transition-all duration-150 flex items-center justify-between gap-2 group cursor-pointer relative select-none ${
                                isDraggingThis
                                  ? 'opacity-40 scale-[0.98] border-2 border-dashed border-slate-400 bg-slate-100'
                                  : isDragOverThis
                                  ? activeCategoryDropdown === 'fisio'
                                    ? 'border-2 border-teal-500 bg-teal-50 shadow-md ring-2 ring-teal-300/60'
                                    : activeCategoryDropdown === 'okupasi'
                                    ? 'border-2 border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-300/60'
                                    : 'border-2 border-amber-500 bg-amber-50 shadow-md ring-2 ring-amber-300/60'
                                  : isSelected
                                  ? activeCategoryDropdown === 'fisio'
                                    ? 'bg-teal-100/90 text-teal-950 font-black border border-teal-300 shadow-2xs'
                                    : activeCategoryDropdown === 'okupasi'
                                    ? 'bg-purple-100/90 text-purple-950 font-black border border-purple-300 shadow-2xs'
                                    : 'bg-amber-100/90 text-amber-950 font-black border border-amber-300 shadow-2xs'
                                  : isLowest
                                  ? activeCategoryDropdown === 'fisio'
                                    ? 'bg-emerald-50/90 hover:bg-emerald-100/90 text-slate-900 border border-emerald-300 ring-1 ring-emerald-400/40 shadow-2xs'
                                    : activeCategoryDropdown === 'okupasi'
                                    ? 'bg-purple-50/90 hover:bg-purple-100/90 text-slate-900 border border-purple-300 ring-1 ring-purple-400/40 shadow-2xs'
                                    : 'bg-amber-50/90 hover:bg-amber-100/90 text-slate-900 border border-amber-300 ring-1 ring-amber-400/40 shadow-2xs'
                                  : 'hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {/* Drag Handle */}
                                {canReorder && (
                                  <div
                                    className="p-1 text-slate-400 hover:text-slate-800 cursor-grab active:cursor-grabbing shrink-0 rounded hover:bg-slate-200/70 transition-colors"
                                    title="Tahan & tarik untuk mengubah urutan kotak"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </div>
                                )}

                                {/* Number Badge */}
                                <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 border transition-colors ${
                                  isSelected 
                                    ? activeCategoryDropdown === 'fisio'
                                      ? 'bg-teal-700 text-white border-teal-700'
                                      : activeCategoryDropdown === 'okupasi'
                                      ? 'bg-purple-700 text-white border-purple-700'
                                      : 'bg-amber-600 text-white border-amber-600'
                                    : isLowest
                                    ? activeCategoryDropdown === 'fisio'
                                      ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300 animate-pulse'
                                      : activeCategoryDropdown === 'okupasi'
                                      ? 'bg-purple-600 text-white border-purple-600 ring-2 ring-purple-300 animate-pulse'
                                      : 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300 animate-pulse'
                                    : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 border-slate-200'
                                }`}>
                                  {index + 1}
                                </span>

                                {/* Name & Details */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className={`text-xs truncate leading-tight ${
                                      isSelected 
                                        ? 'font-black' 
                                        : isLowest 
                                        ? activeCategoryDropdown === 'fisio'
                                          ? 'font-black text-emerald-950'
                                          : activeCategoryDropdown === 'okupasi'
                                          ? 'font-black text-purple-950'
                                          : 'font-black text-amber-950'
                                        : 'font-bold text-slate-800'
                                    }`}>
                                      {box.officerName}
                                    </p>

                                    {/* Dynamic Shifting Badge for Lowest Total Patient Count */}
                                    {isLowest && (
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[9px] font-extrabold text-white shadow-2xs tracking-tight animate-pulse shrink-0 ${
                                        activeCategoryDropdown === 'fisio'
                                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                                          : activeCategoryDropdown === 'okupasi'
                                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                                          : 'bg-gradient-to-r from-amber-600 to-orange-600'
                                      }`}>
                                        <Sparkles className="w-2.5 h-2.5" />
                                        <span>PALING SEDIKIT ({stats.total} total)</span>
                                      </span>
                                    )}
                                    {isJemputan && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 shrink-0">
                                        Antrian Jemputan
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {box.title.split('(')[0].trim()} • {box.location}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {/* Standalone Dropdown ON / OFF Switch */}
                                {(() => {
                                  const isDropdownOn = dropdownTherapistStatus[box.id] !== false;
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleDropdownTherapistStatus(box.id, e)}
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 select-none ${
                                        isDropdownOn
                                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 ring-1 ring-emerald-200'
                                          : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-300'
                                      }`}
                                      title={isDropdownOn ? 'Status Dropdown: ON (Klik untuk ubah ke OFF)' : 'Status Dropdown: OFF (Klik untuk ubah ke ON)'}
                                    >
                                      <span className={`w-2 h-2 rounded-full transition-colors ${isDropdownOn ? 'bg-emerald-500 shadow-xs' : 'bg-slate-400'}`} />
                                      <span>{isDropdownOn ? 'ON' : 'OFF'}</span>
                                    </button>
                                  );
                                })()}

                                {/* Total Patient Count Badge with active & completed breakdown */}
                                {!isJemputan ? (
                                  <div className="flex flex-col items-end">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-tight border ${
                                      isLowest
                                        ? activeCategoryDropdown === 'fisio'
                                          ? 'bg-emerald-200/80 text-emerald-950 border-emerald-400 font-black ring-1 ring-emerald-400/50'
                                          : activeCategoryDropdown === 'okupasi'
                                          ? 'bg-purple-200/80 text-purple-950 border-purple-400 font-black ring-1 ring-purple-400/50'
                                          : 'bg-amber-200/80 text-amber-950 border-amber-400 font-black ring-1 ring-amber-400/50'
                                        : stats.total === 0
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : stats.total <= 3
                                        ? activeCategoryDropdown === 'fisio'
                                          ? 'bg-teal-50 text-teal-700 border-teal-200'
                                          : activeCategoryDropdown === 'okupasi'
                                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}>
                                      {stats.total} Total
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                                      {stats.active} antre • {stats.completed} selesai
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                      {stats.total} Total
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                                      {stats.active} antre
                                    </span>
                                  </div>
                                )}

                                {isSelected ? (
                                  <Check className={`w-4 h-4 shrink-0 ${
                                    activeCategoryDropdown === 'fisio' ? 'text-teal-700' : activeCategoryDropdown === 'okupasi' ? 'text-purple-700' : 'text-amber-700'
                                  }`} />
                                ) : (
                                  <UserCheck className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                )}

                                {/* Quick Reorder Step Buttons (▲ / ▼) */}
                                {canReorder && (
                                  <div
                                    className="flex flex-col items-center gap-0.5 pl-1.5 border-l border-slate-200/80 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReorderCategory(index, index - 1);
                                      }}
                                      className={`p-0.5 rounded transition-all ${
                                        index === 0 
                                          ? 'text-slate-200 opacity-30 cursor-not-allowed' 
                                          : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/80 active:scale-90 cursor-pointer'
                                      }`}
                                      title="Geser urutan kotak ke atas"
                                    >
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === allCategoryBoxes.length - 1}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReorderCategory(index, index + 1);
                                      }}
                                      className={`p-0.5 rounded transition-all ${
                                        index === allCategoryBoxes.length - 1 
                                          ? 'text-slate-200 opacity-30 cursor-not-allowed' 
                                          : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/80 active:scale-90 cursor-pointer'
                                      }`}
                                      title="Geser urutan kotak ke bawah"
                                    >
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer Info */}
                    <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between font-medium">
                      <span>Klik ON/OFF untuk status dropdown • Klik nama untuk fokus antrean</span>
                      <button
                        onClick={() => setActiveCategoryDropdown(null)}
                        className={`font-bold hover:underline cursor-pointer ${
                          activeCategoryDropdown === 'fisio'
                            ? 'text-teal-700'
                            : activeCategoryDropdown === 'okupasi'
                            ? 'text-purple-700'
                            : 'text-amber-700'
                        }`}
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Tengah: logo menonjol dari tepi atas layar */}
        <div className="col-start-2 row-start-1 self-start relative z-10 flex justify-center">
          <div
            className={`relative -mt-2 flex items-center gap-2.5 pl-3 pr-4 rounded-b-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-x border-b border-teal-400/30 transition-all duration-300 ${
              isCondensed
                ? 'pt-2 pb-2 -mb-2 shadow-none'
                : 'pt-2 pb-2 -mb-2 lg:pt-4 lg:pb-4 lg:-mb-7 lg:shadow-[0_12px_28px_-10px_rgba(45,212,191,0.55)]'
            }`}
          >
            <span className="absolute bottom-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />
            <div className="relative group shrink-0">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 via-cyan-400 to-indigo-500 rounded-xl blur-xs opacity-70 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-9 h-9 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 rounded-xl border border-teal-400/40 flex items-center justify-center text-teal-300">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" className="text-cyan-400" />
                  <circle cx="12" cy="12" r="9" strokeWidth="1.5" stroke="currentColor" strokeDasharray="3 3" className="text-teal-400/60 animate-spin" style={{ animationDuration: '18s' }} />
                </svg>
              </div>
              <span
                className="absolute -top-1 -right-1 flex h-3 w-3"
                title={isRealtimeConnected ? 'Cloud Live - tersambung realtime' : 'Mode Lokal'}
              >
                {isRealtimeConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex h-3 w-3 rounded-full border-2 border-slate-900 ${isRealtimeConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-[15px] font-black text-white leading-tight tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                <span>Smart IRM RSPP</span>
                <span className="hidden xl:inline text-[9px] font-extrabold px-1 py-px bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded tracking-wider">
                  PRO
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold capitalize leading-tight whitespace-nowrap">
                {currentDateFormatted}
              </p>
            </div>
          </div>
        </div>

        {/* Kanan: saringan status. Hitungan MENUNGGU/DIPANGGIL yang dulu dipajang
            terpisah sama persis dengan angka Aktif/Selesai, jadi digabung ke sini. */}
        <div className="col-span-3 row-start-2 lg:col-span-1 lg:col-start-3 lg:row-start-1 flex justify-center lg:justify-end min-w-0">
          <div className="flex items-center gap-0.5 bg-slate-800/70 p-0.5 rounded-xl border border-slate-700/80 text-xs overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 h-8 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              Semua
            </button>

            <button
              onClick={() => setStatusFilter('active')}
              className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'active' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Pasien yang belum diceklis selesai"
            >
              <Clock className={`w-3.5 h-3.5 ${statusFilter === 'active' ? 'text-sky-100' : 'text-sky-400'}`} />
              <span>Menunggu</span>
              <span className={`text-sm font-black tabular-nums ${statusFilter === 'active' ? 'text-white' : 'text-cyan-300'}`}>
                {totalActiveCount}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('completed')}
              className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Pasien yang sudah diceklis selesai"
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${statusFilter === 'completed' ? 'text-emerald-100' : 'text-emerald-400'}`} />
              <span>Selesai</span>
              <span className={`text-sm font-black tabular-nums ${statusFilter === 'completed' ? 'text-white' : 'text-emerald-300'}`}>
                {totalCompletedCount}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('warning')}
              className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'warning' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${statusFilter === 'warning' ? 'text-rose-100' : 'text-rose-400'}`} />
              <span>Warning</span>
              <span className={`text-sm font-black tabular-nums ${statusFilter === 'warning' ? 'text-white' : 'text-rose-300'}`}>
                {totalWarningCount}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
