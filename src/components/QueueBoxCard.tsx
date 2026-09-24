import React, { useState, useEffect, useMemo } from 'react';
import { 
  Pin, 
  ChevronDown, 
  ChevronUp, 
  Bell, 
  Plus, 
  History, 
  MoreVertical, 
  CheckSquare, 
  Square, 
  Image as ImageIcon, 
  Trash2, 
  AlertOctagon,
  Tag,
  Palette,
  Sparkles,
  PhoneCall,
  Edit3,
  Upload,
  ZoomIn,
  X,
  QrCode,
  Clock,
  Timer,
  ArrowRightLeft,
  Sun,
  RotateCcw,
  ThumbsUp,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  ArrowUpToLine,
  Lock,
  CheckCircle2,
  UserX,
  Camera,
  User,
  Stethoscope
} from 'lucide-react';
import { QueueBox, PatientItem, BoxColor } from '../types';
import { uploadImageToServer, getBoxImageUrls, saveBoxImagesToServer, getPatientImageUrls } from '../utils/imageUtils';
import { calculatePatientTimeMetrics } from '../utils/responseTimeAnalytics';
import { IcfDiagnosisInput } from './IcfDiagnosisInput';
import { QueueToAnotherBoxModal } from './QueueToAnotherBoxModal';
import { AlihkanKembaliModal } from './AlihkanKembaliModal';
import { ActionCodeBadge } from './ActionCodeBadge';
import { BoxPhotoCollage } from './BoxPhotoCollage';
import { BoxPhotoGalleryModal } from './BoxPhotoGalleryModal';
import { PatientPhotoModal } from './PatientPhotoModal';
import { PatientTimelineModal } from './PatientTimelineModal';
import { 
  getActionTokensOrFallback, 
  toggleCrossedToken, 
  formatRemainingCodes,
  appendActionCode 
} from '../utils/actionCodeUtils';
import { getJemputanTimerState } from '../utils/jemputanTimerService';
import { realtimeSync } from '../utils/syncService';

interface QueueBoxCardProps {
  box: QueueBox;
  patients: PatientItem[];
  allBoxes?: QueueBox[];
  onTogglePin: (boxId: string) => void;
  // opts.skipJemputan dipakai saat ceklis ini bagian dari PEMINDAHAN pasien, bukan
  // penyelesaian sungguhan. Pasien ranap tidak boleh langsung masuk antrean jemputan
  // hanya karena diserahkan ke terapis lain - tindakannya masih kurang.
  onToggleCompletePatient: (patientId: string, opts?: { skipJemputan?: boolean }) => void;
  onCallPatient: (patient: PatientItem, box: QueueBox) => void;
  onCallNextInBox: (box: QueueBox) => void;
  onAddPatientToBox: (boxId: string) => void;
  onViewHistory: (box: QueueBox) => void;
  onUpdateBoxColor: (boxId: string, color: BoxColor) => void;
  onUpdateBoxImage: (boxId: string, imageUrl: string) => void;
  onUpdateBoxImages?: (boxId: string, imageUrls: string[]) => void;
  onDeleteBox: (boxId: string, transferTargetBoxId?: string) => void;
  onClearBoxPatients?: (boxId: string) => void;
  onDeletePatient: (patientId: string, endedReason?: 'dipindahkan' | 'dihapus') => void;
  onRemovePatientFromBox?: (patientId: string, endedReason?: 'dipindahkan' | 'dihapus') => void;
  onUpdatePatient?: (updatedPatient: PatientItem) => void;
  onEditBox?: (box: QueueBox) => void;
  onOpenPatientQR?: (patient: PatientItem, box: QueueBox) => void;
  onClearUnread?: (boxId: string) => void;
  onAddPatient?: (patientData: Omit<PatientItem, 'id' | 'createdAt' | 'calledCount' | 'completed'>) => void;
  onTransferToPeralihanSiang?: (
    sourceBoxId: string, 
    selectedPatientIds?: string[], 
    patientConfigs?: Record<string, { isLepas: boolean; kurangTindakan: number }>
  ) => void;
  onTransferBackFromPeralihanSiang?: (updatedPatients: PatientItem[]) => void;
  isDragDisabled?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStartBox?: (boxId: string) => void;
  onDragEndBox?: () => void;
  onDragOverBox?: (e: React.DragEvent, boxId: string) => void;
  onDropBox?: (targetBoxId: string) => void;
  onMoveBoxStep?: (boxId: string, direction: 'left' | 'right' | 'first' | 'last') => void;
}

const COLOR_MAP: Record<BoxColor, { 
  bg: string; 
  border: string; 
  header: string; 
  badge: string; 
  accentGlow: string;
  isDark?: boolean;
  titleColor?: string;
  locationClass?: string;
  emptyStateClass?: string;
  instructionClass?: string;
  footerClass?: string;
  completedTrayClass?: string;
}> = {
  // Metalik Titanium & Klasik (Solid & Kuat)
  'metallic-dark': {
    isDark: true,
    bg: 'bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#090d16]',
    border: 'border-slate-600 shadow-[0_10px_28px_-5px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.25)]',
    header: 'bg-gradient-to-r from-slate-900/95 via-slate-800/90 to-slate-900/95 text-white border-b border-slate-700',
    badge: 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(56, 189, 248, 0.35)',
    titleColor: 'text-white font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-slate-900/90 text-cyan-200 border-slate-600 font-bold shadow-inner',
    emptyStateClass: 'bg-slate-900/70 border-slate-600 text-slate-200 shadow-inner',
    instructionClass: 'bg-slate-900/90 border-slate-600 text-white shadow-inner',
    footerClass: 'bg-slate-950/95 border-t border-slate-800 shadow-inner',
    completedTrayClass: 'bg-slate-950/90 border-t border-slate-800 text-slate-300'
  },
  'metallic-bronze': {
    isDark: true,
    bg: 'bg-gradient-to-b from-[#3d2a1c] via-[#241a12] to-[#120d09]',
    border: 'border-amber-600/90 shadow-[0_10px_28px_-5px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(251,191,36,0.35)]',
    header: 'bg-gradient-to-r from-stone-900/95 via-amber-950/90 to-stone-900/95 text-amber-100 border-b border-amber-700/80',
    badge: 'bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(245, 158, 11, 0.35)',
    titleColor: 'text-amber-100 font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-stone-900/90 text-amber-200 border-amber-700 font-bold shadow-inner',
    emptyStateClass: 'bg-stone-900/70 border-amber-800 text-amber-200 shadow-inner',
    instructionClass: 'bg-stone-900/90 border-amber-700 text-white shadow-inner',
    footerClass: 'bg-stone-950/95 border-t border-amber-950 shadow-inner',
    completedTrayClass: 'bg-stone-950/90 border-t border-amber-950 text-amber-200'
  },
  'metallic-emerald': {
    isDark: true,
    bg: 'bg-gradient-to-b from-[#064e3b] via-[#022c22] to-[#021812]',
    border: 'border-emerald-500/90 shadow-[0_10px_28px_-5px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(52,211,153,0.35)]',
    header: 'bg-gradient-to-r from-teal-950/95 via-emerald-950/90 to-teal-950/95 text-emerald-100 border-b border-emerald-700/80',
    badge: 'bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(52, 211, 153, 0.35)',
    titleColor: 'text-emerald-100 font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-teal-950/90 text-emerald-200 border-emerald-600 font-bold shadow-inner',
    emptyStateClass: 'bg-teal-950/70 border-emerald-700 text-emerald-200 shadow-inner',
    instructionClass: 'bg-teal-950/90 border-emerald-600 text-white shadow-inner',
    footerClass: 'bg-teal-950/95 border-t border-emerald-950 shadow-inner',
    completedTrayClass: 'bg-teal-950/90 border-t border-emerald-950 text-emerald-200'
  },
  'metallic-ocean': {
    isDark: true,
    bg: 'bg-gradient-to-b from-[#0c4a6e] via-[#082f49] to-[#02131f]',
    border: 'border-sky-500/90 shadow-[0_10px_28px_-5px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(56,189,248,0.35)]',
    header: 'bg-gradient-to-r from-slate-950/95 via-sky-950/90 to-slate-950/95 text-sky-100 border-b border-sky-700/80',
    badge: 'bg-gradient-to-r from-sky-300 via-cyan-300 to-blue-300 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(56, 189, 248, 0.35)',
    titleColor: 'text-sky-100 font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-slate-900/90 text-sky-200 border-sky-600 font-bold shadow-inner',
    emptyStateClass: 'bg-slate-950/70 border-sky-700 text-sky-200 shadow-inner',
    instructionClass: 'bg-slate-900/90 border-sky-600 text-white shadow-inner',
    footerClass: 'bg-slate-950/95 border-t border-sky-950 shadow-inner',
    completedTrayClass: 'bg-slate-950/90 border-t border-sky-950 text-sky-200'
  },

  // Warna Terang & Metalik Modern (Solid, Kuat & Berkontras Tinggi)
  'metallic-blue': {
    isDark: true,
    bg: 'bg-gradient-to-b from-blue-700 via-blue-800 to-indigo-950',
    border: 'border-blue-400 shadow-[0_10px_28px_-5px_rgba(29,78,216,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)]',
    header: 'bg-gradient-to-r from-blue-900/95 via-blue-800/90 to-indigo-950 text-white border-b border-blue-400/60',
    badge: 'bg-gradient-to-r from-cyan-300 to-sky-300 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(59, 130, 246, 0.35)',
    titleColor: 'text-white font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-blue-950/80 text-cyan-200 border-blue-400/60 font-bold shadow-inner',
    emptyStateClass: 'bg-blue-950/60 border-blue-400/50 text-blue-100 shadow-inner',
    instructionClass: 'bg-blue-950/80 border-blue-400/60 text-white shadow-inner',
    footerClass: 'bg-blue-950/90 border-t border-blue-800 shadow-inner',
    completedTrayClass: 'bg-blue-950/95 border-t border-blue-900 text-blue-200'
  },
  'metallic-purple': {
    isDark: true,
    bg: 'bg-gradient-to-b from-purple-700 via-purple-900 to-slate-950',
    border: 'border-purple-400 shadow-[0_10px_28px_-5px_rgba(147,51,234,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)]',
    header: 'bg-gradient-to-r from-purple-950/95 via-purple-900/90 to-fuchsia-950 text-white border-b border-purple-400/60',
    badge: 'bg-gradient-to-r from-fuchsia-300 to-purple-300 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(168, 85, 247, 0.35)',
    titleColor: 'text-white font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-purple-950/80 text-purple-200 border-purple-400/60 font-bold shadow-inner',
    emptyStateClass: 'bg-purple-950/60 border-purple-400/50 text-purple-100 shadow-inner',
    instructionClass: 'bg-purple-950/80 border-purple-400/60 text-white shadow-inner',
    footerClass: 'bg-purple-950/90 border-t border-purple-900 shadow-inner',
    completedTrayClass: 'bg-purple-950/95 border-t border-purple-900 text-purple-200'
  },
  'metallic-orange': {
    isDark: true,
    bg: 'bg-gradient-to-b from-amber-600 via-orange-700 to-amber-950',
    border: 'border-amber-400 shadow-[0_10px_28px_-5px_rgba(217,119,6,0.6),inset_0_1px_1px_rgba(255,255,255,0.45)]',
    header: 'bg-gradient-to-r from-amber-950/95 via-orange-900/90 to-amber-950 text-white border-b border-amber-400/60',
    badge: 'bg-gradient-to-r from-yellow-300 to-amber-300 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(249, 115, 22, 0.35)',
    titleColor: 'text-white font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-amber-950/80 text-amber-200 border-amber-400/60 font-bold shadow-inner',
    emptyStateClass: 'bg-amber-950/60 border-amber-400/50 text-amber-100 shadow-inner',
    instructionClass: 'bg-amber-950/80 border-amber-400/60 text-white shadow-inner',
    footerClass: 'bg-amber-950/90 border-t border-amber-900 shadow-inner',
    completedTrayClass: 'bg-amber-950/95 border-t border-amber-900 text-amber-200'
  },
  'metallic-red': {
    isDark: true,
    bg: 'bg-gradient-to-b from-rose-700 via-red-800 to-slate-950',
    border: 'border-rose-400 shadow-[0_10px_28px_-5px_rgba(225,29,72,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)]',
    header: 'bg-gradient-to-r from-rose-950/95 via-red-900/90 to-rose-950 text-white border-b border-rose-400/60',
    badge: 'bg-gradient-to-r from-rose-300 to-red-300 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(244, 63, 94, 0.35)',
    titleColor: 'text-white font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-rose-950/80 text-rose-200 border-rose-400/60 font-bold shadow-inner',
    emptyStateClass: 'bg-rose-950/60 border-rose-400/50 text-rose-100 shadow-inner',
    instructionClass: 'bg-rose-950/80 border-rose-400/60 text-white shadow-inner',
    footerClass: 'bg-rose-950/90 border-t border-rose-900 shadow-inner',
    completedTrayClass: 'bg-rose-950/95 border-t border-rose-900 text-rose-200'
  },
  'metallic-green': {
    isDark: true,
    bg: 'bg-gradient-to-b from-emerald-700 via-teal-800 to-slate-950',
    border: 'border-emerald-400 shadow-[0_10px_28px_-5px_rgba(16,185,129,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)]',
    header: 'bg-gradient-to-r from-emerald-950/95 via-teal-900/90 to-emerald-950 text-white border-b border-emerald-400/60',
    badge: 'bg-gradient-to-r from-emerald-300 to-teal-300 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
    titleColor: 'text-white font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-teal-950/80 text-emerald-200 border-emerald-400/60 font-bold shadow-inner',
    emptyStateClass: 'bg-teal-950/60 border-emerald-400/50 text-emerald-100 shadow-inner',
    instructionClass: 'bg-teal-950/80 border-emerald-400/60 text-white shadow-inner',
    footerClass: 'bg-teal-950/90 border-t border-teal-900 shadow-inner',
    completedTrayClass: 'bg-teal-950/95 border-t border-teal-900 text-emerald-200'
  },
  'metallic-sage': {
    isDark: true,
    bg: 'bg-gradient-to-b from-teal-700 via-emerald-800 to-slate-950',
    border: 'border-teal-400 shadow-[0_10px_28px_-5px_rgba(20,184,166,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)]',
    header: 'bg-gradient-to-r from-teal-950/95 via-emerald-950/90 to-teal-950 text-white border-b border-teal-400/60',
    badge: 'bg-gradient-to-r from-teal-300 to-emerald-300 text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(20, 184, 166, 0.35)',
    titleColor: 'text-white font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-teal-950/80 text-teal-200 border-teal-400/60 font-bold shadow-inner',
    emptyStateClass: 'bg-teal-950/60 border-teal-400/50 text-teal-100 shadow-inner',
    instructionClass: 'bg-teal-950/80 border-teal-400/60 text-white shadow-inner',
    footerClass: 'bg-teal-950/90 border-t border-teal-900 shadow-inner',
    completedTrayClass: 'bg-teal-950/95 border-t border-teal-900 text-teal-200'
  },
  'metallic-yellow': {
    isDark: false,
    bg: 'bg-gradient-to-b from-yellow-300 via-amber-300 to-yellow-400',
    border: 'border-yellow-500 shadow-[0_10px_28px_-5px_rgba(234,179,8,0.6),inset_0_1px_1px_rgba(255,255,255,0.8)]',
    header: 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 text-slate-950 font-black border-b border-yellow-600/50',
    badge: 'bg-slate-950 text-yellow-300 font-black shadow-md',
    accentGlow: 'rgba(234, 179, 8, 0.35)',
    titleColor: 'text-slate-950 font-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]',
    locationClass: 'bg-amber-950/15 text-slate-950 border-amber-600/70 font-black shadow-2xs',
    emptyStateClass: 'bg-yellow-200/70 border-amber-500/70 text-amber-950 font-bold shadow-2xs',
    instructionClass: 'bg-yellow-200/90 border-amber-500/70 text-slate-950 font-bold shadow-2xs',
    footerClass: 'bg-yellow-400/90 border-t border-amber-500/70 shadow-inner',
    completedTrayClass: 'bg-yellow-500/30 border-t border-amber-500/70 text-slate-950 font-bold'
  },
  'metallic-silver': {
    isDark: true,
    bg: 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950',
    border: 'border-slate-400 shadow-[0_10px_28px_-5px_rgba(100,116,139,0.6),inset_0_1px_1px_rgba(255,255,255,0.5)]',
    header: 'bg-gradient-to-r from-slate-850 via-slate-800 to-slate-900 text-white border-b border-slate-400/60',
    badge: 'bg-gradient-to-r from-slate-200 to-white text-slate-950 font-black shadow-md',
    accentGlow: 'rgba(100, 116, 139, 0.35)',
    titleColor: 'text-white font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
    locationClass: 'bg-slate-900/90 text-slate-200 border-slate-500/60 font-bold shadow-inner',
    emptyStateClass: 'bg-slate-900/60 border-slate-500/50 text-slate-200 shadow-inner',
    instructionClass: 'bg-slate-900/90 border-slate-500/60 text-white shadow-inner',
    footerClass: 'bg-slate-900/90 border-t border-slate-700 shadow-inner',
    completedTrayClass: 'bg-slate-950/95 border-t border-slate-800 text-slate-200'
  },

  // Warna Doff (Matte Pastel Lembut & Teks Sangat Jelas - Gaya Sticky Note / Google Keep)
  sage: {
    isDark: false,
    bg: 'bg-[#daf2ec]',
    border: 'border-[#a8e3d6] shadow-[0_4px_16px_-2px_rgba(20,184,166,0.18)]',
    header: 'bg-[#c9ebe2]/80 text-slate-900 border-b border-[#a8e3d6]/80',
    badge: 'bg-slate-900 text-teal-100 font-black shadow-xs',
    accentGlow: 'rgba(20, 184, 166, 0.2)',
    titleColor: 'text-slate-950 font-black',
    locationClass: 'bg-[#e8f8f4] text-slate-900 border-[#a8e3d6] font-bold shadow-2xs',
    emptyStateClass: 'bg-[#f2fbf8]/90 border-[#a8e3d6] text-slate-800 shadow-2xs',
    instructionClass: 'bg-[#f2fbf8]/95 border-[#a8e3d6] text-slate-900 shadow-2xs',
    footerClass: 'bg-[#c9ebe2]/80 border-t border-[#a8e3d6]/80 shadow-2xs',
    completedTrayClass: 'bg-[#c9ebe2]/60 border-t border-[#a8e3d6]/80 text-slate-800'
  },
  blue: {
    isDark: false,
    bg: 'bg-[#d2f3fc]',
    border: 'border-[#9ce3f5] shadow-[0_4px_16px_-2px_rgba(56,189,248,0.18)]',
    header: 'bg-[#c3eefa]/80 text-slate-900 border-b border-[#9ce3f5]/80',
    badge: 'bg-slate-900 text-sky-100 font-black shadow-xs',
    accentGlow: 'rgba(56, 189, 248, 0.2)',
    titleColor: 'text-slate-950 font-black',
    locationClass: 'bg-[#e0f7fd] text-slate-900 border-[#9ce3f5] font-bold shadow-2xs',
    emptyStateClass: 'bg-[#ebfaff]/90 border-[#9ce3f5] text-slate-800 shadow-2xs',
    instructionClass: 'bg-[#ebfaff]/95 border-[#9ce3f5] text-slate-900 shadow-2xs',
    footerClass: 'bg-[#c3eefa]/80 border-t border-[#9ce3f5]/80 shadow-2xs',
    completedTrayClass: 'bg-[#c3eefa]/60 border-t border-[#9ce3f5]/80 text-slate-800'
  },
  purple: {
    isDark: false,
    bg: 'bg-[#ede4f8]',
    border: 'border-[#d3bdf0] shadow-[0_4px_16px_-2px_rgba(168,85,247,0.18)]',
    header: 'bg-[#e2d4f3]/80 text-slate-900 border-b border-[#d3bdf0]/80',
    badge: 'bg-slate-900 text-purple-100 font-black shadow-xs',
    accentGlow: 'rgba(168, 85, 247, 0.2)',
    titleColor: 'text-slate-950 font-black',
    locationClass: 'bg-[#f4ecfb] text-slate-900 border-[#d3bdf0] font-bold shadow-2xs',
    emptyStateClass: 'bg-[#f8f4fd]/90 border-[#d3bdf0] text-slate-800 shadow-2xs',
    instructionClass: 'bg-[#f8f4fd]/95 border-[#d3bdf0] text-slate-900 shadow-2xs',
    footerClass: 'bg-[#e2d4f3]/80 border-t border-[#d3bdf0]/80 shadow-2xs',
    completedTrayClass: 'bg-[#e2d4f3]/60 border-t border-[#d3bdf0]/80 text-slate-800'
  },
  orange: {
    isDark: false,
    bg: 'bg-[#fee8d1]',
    border: 'border-[#fbcda1] shadow-[0_4px_16px_-2px_rgba(249,115,22,0.18)]',
    header: 'bg-[#feddbb]/80 text-slate-900 border-b border-[#fbcda1]/80',
    badge: 'bg-slate-900 text-orange-100 font-black shadow-xs',
    accentGlow: 'rgba(249, 115, 22, 0.2)',
    titleColor: 'text-slate-950 font-black',
    locationClass: 'bg-[#fff0e0] text-slate-900 border-[#fbcda1] font-bold shadow-2xs',
    emptyStateClass: 'bg-[#fff6ec]/90 border-[#fbcda1] text-slate-800 shadow-2xs',
    instructionClass: 'bg-[#fff6ec]/95 border-[#fbcda1] text-slate-900 shadow-2xs',
    footerClass: 'bg-[#feddbb]/80 border-t border-[#fbcda1]/80 shadow-2xs',
    completedTrayClass: 'bg-[#feddbb]/60 border-t border-[#fbcda1]/80 text-slate-800'
  },
  coral: {
    isDark: false,
    bg: 'bg-[#fed9dd]',
    border: 'border-[#fcaeb7] shadow-[0_4px_16px_-2px_rgba(244,63,94,0.18)]',
    header: 'bg-[#fec7cc]/80 text-slate-900 border-b border-[#fcaeb7]/80',
    badge: 'bg-slate-900 text-rose-100 font-black shadow-xs',
    accentGlow: 'rgba(244, 63, 94, 0.2)',
    titleColor: 'text-slate-950 font-black',
    locationClass: 'bg-[#ffe4e7] text-slate-900 border-[#fcaeb7] font-bold shadow-2xs',
    emptyStateClass: 'bg-[#fff0f2]/90 border-[#fcaeb7] text-slate-800 shadow-2xs',
    instructionClass: 'bg-[#fff0f2]/95 border-[#fcaeb7] text-slate-900 shadow-2xs',
    footerClass: 'bg-[#fec7cc]/80 border-t border-[#fcaeb7]/80 shadow-2xs',
    completedTrayClass: 'bg-[#fec7cc]/60 border-t border-[#fcaeb7]/80 text-slate-800'
  },
  green: {
    isDark: false,
    bg: 'bg-[#e2f9d7]',
    border: 'border-[#b8ed9f] shadow-[0_4px_16px_-2px_rgba(34,197,94,0.18)]',
    header: 'bg-[#d3f4c4]/80 text-slate-900 border-b border-[#b8ed9f]/80',
    badge: 'bg-slate-900 text-emerald-100 font-black shadow-xs',
    accentGlow: 'rgba(34, 197, 94, 0.2)',
    titleColor: 'text-slate-950 font-black',
    locationClass: 'bg-[#ecfde5] text-slate-900 border-[#b8ed9f] font-bold shadow-2xs',
    emptyStateClass: 'bg-[#f4fdf0]/90 border-[#b8ed9f] text-slate-800 shadow-2xs',
    instructionClass: 'bg-[#f4fdf0]/95 border-[#b8ed9f] text-slate-900 shadow-2xs',
    footerClass: 'bg-[#d3f4c4]/80 border-t border-[#b8ed9f]/80 shadow-2xs',
    completedTrayClass: 'bg-[#d3f4c4]/60 border-t border-[#b8ed9f]/80 text-slate-800'
  },
  yellow: {
    isDark: false,
    bg: 'bg-[#fff9b0]',
    border: 'border-[#f2dd6e] shadow-[0_4px_16px_-2px_rgba(217,170,30,0.18)]',
    header: 'bg-[#fff59d]/80 text-slate-900 border-b border-[#f2dd6e]/80',
    badge: 'bg-slate-900 text-yellow-100 font-black shadow-xs',
    accentGlow: 'rgba(234, 179, 8, 0.2)',
    titleColor: 'text-slate-950 font-black',
    locationClass: 'bg-[#fffaab] text-slate-900 border-[#edd047] font-bold shadow-2xs',
    emptyStateClass: 'bg-[#fffdeb]/90 border-[#f2dd6e] text-slate-800 shadow-2xs',
    instructionClass: 'bg-[#fffdeb]/95 border-[#f2dd6e] text-slate-900 shadow-2xs',
    footerClass: 'bg-[#fff59d]/80 border-t border-[#f2dd6e]/80 shadow-2xs',
    completedTrayClass: 'bg-[#fff59d]/60 border-t border-[#f2dd6e]/80 text-slate-800'
  },
  pink: {
    isDark: false,
    bg: 'bg-[#fde2ef]',
    border: 'border-[#f9bfde] shadow-[0_4px_16px_-2px_rgba(236,72,153,0.18)]',
    header: 'bg-[#fbd1e7]/80 text-slate-900 border-b border-[#f9bfde]/80',
    badge: 'bg-slate-900 text-pink-100 font-black shadow-xs',
    accentGlow: 'rgba(236, 72, 153, 0.2)',
    titleColor: 'text-slate-950 font-black',
    locationClass: 'bg-[#feecf5] text-slate-900 border-[#f9bfde] font-bold shadow-2xs',
    emptyStateClass: 'bg-[#fef4f9]/90 border-[#f9bfde] text-slate-800 shadow-2xs',
    instructionClass: 'bg-[#fef4f9]/95 border-[#f9bfde] text-slate-900 shadow-2xs',
    footerClass: 'bg-[#fbd1e7]/80 border-t border-[#f9bfde]/80 shadow-2xs',
    completedTrayClass: 'bg-[#fbd1e7]/60 border-t border-[#f9bfde]/80 text-slate-800'
  },
  gray: {
    isDark: false,
    bg: 'bg-[#edf0f2]',
    border: 'border-[#cbd3d9] shadow-[0_4px_16px_-2px_rgba(100,116,139,0.15)]',
    header: 'bg-[#e0e5e9]/80 text-slate-900 border-b border-[#cbd3d9]/80',
    badge: 'bg-slate-900 text-slate-100 font-black shadow-xs',
    accentGlow: 'rgba(100, 116, 139, 0.2)',
    titleColor: 'text-slate-950 font-black',
    locationClass: 'bg-[#f4f6f7] text-slate-900 border-[#cbd3d9] font-bold shadow-2xs',
    emptyStateClass: 'bg-[#f8fafb]/90 border-[#cbd3d9] text-slate-800 shadow-2xs',
    instructionClass: 'bg-[#f8fafb]/95 border-[#cbd3d9] text-slate-900 shadow-2xs',
    footerClass: 'bg-[#e0e5e9]/80 border-t border-[#cbd3d9]/80 shadow-2xs',
    completedTrayClass: 'bg-[#e0e5e9]/60 border-t border-[#cbd3d9]/80 text-slate-800'
  },
};

const COLOR_OPTIONS: { id: BoxColor; label: string; class: string }[] = [
  // Warna Terang & Metalik Modern
  { id: 'metallic-blue', label: '⚡ Biru Metalik', class: 'bg-blue-700 border-blue-400 text-white font-bold' },
  { id: 'metallic-purple', label: '⚡ Ungu Metalik', class: 'bg-purple-700 border-purple-400 text-white font-bold' },
  { id: 'metallic-orange', label: '⚡ Oranye Metalik', class: 'bg-amber-600 border-amber-400 text-white font-bold' },
  { id: 'metallic-red', label: '⚡ Merah Metalik', class: 'bg-rose-700 border-rose-400 text-white font-bold' },
  { id: 'metallic-green', label: '⚡ Hijau Metalik', class: 'bg-emerald-700 border-emerald-400 text-white font-bold' },
  { id: 'metallic-sage', label: '⚡ Sage Metalik', class: 'bg-teal-700 border-teal-400 text-white font-bold' },
  { id: 'metallic-yellow', label: '⚡ Kuning Metalik', class: 'bg-yellow-400 border-yellow-500 text-slate-950 font-black' },
  { id: 'metallic-silver', label: '⚡ Abu Platinum', class: 'bg-slate-700 border-slate-400 text-white font-bold' },

  // Metalik Titanium & Klasik
  { id: 'metallic-dark', label: '★ Metalik Titanium', class: 'bg-slate-900 border-slate-600 text-white font-bold' },
  { id: 'metallic-bronze', label: '★ Metalik Bronze', class: 'bg-stone-900 border-amber-600 text-amber-200 font-bold' },
  { id: 'metallic-emerald', label: '★ Metalik Jade', class: 'bg-teal-950 border-emerald-600 text-emerald-200 font-bold' },
  { id: 'metallic-ocean', label: '★ Metalik Sapphire', class: 'bg-sky-950 border-sky-600 text-sky-200 font-bold' },

  // Warna Doff (Matte Pastel Lembut & Teks Sangat Jelas)
  { id: 'yellow', label: 'Kuning Doff', class: 'bg-[#fff9b0] border-[#f2dd6e] text-slate-900 font-bold' },
  { id: 'blue', label: 'Biru Doff', class: 'bg-[#d2f3fc] border-[#9ce3f5] text-slate-900 font-bold' },
  { id: 'purple', label: 'Ungu Doff', class: 'bg-[#ede4f8] border-[#d3bdf0] text-slate-900 font-bold' },
  { id: 'orange', label: 'Oranye Doff', class: 'bg-[#fee8d1] border-[#fbcda1] text-slate-900 font-bold' },
  { id: 'coral', label: 'Merah Doff', class: 'bg-[#fed9dd] border-[#fcaeb7] text-slate-900 font-bold' },
  { id: 'green', label: 'Hijau Doff', class: 'bg-[#e2f9d7] border-[#b8ed9f] text-slate-900 font-bold' },
  { id: 'sage', label: 'Sage Doff', class: 'bg-[#daf2ec] border-[#a8e3d6] text-slate-900 font-bold' },
  { id: 'pink', label: 'Pink Doff', class: 'bg-[#fde2ef] border-[#f9bfde] text-slate-900 font-bold' },
  { id: 'gray', label: 'Abu Doff', class: 'bg-[#edf0f2] border-[#cbd3d9] text-slate-900 font-bold' },
];

export const QueueBoxCard: React.FC<QueueBoxCardProps> = ({
  box,
  patients,
  allBoxes,
  onTogglePin,
  onToggleCompletePatient,
  onCallPatient,
  onCallNextInBox,
  onAddPatientToBox,
  onViewHistory,
  onUpdateBoxColor,
  onUpdateBoxImage,
  onUpdateBoxImages,
  onDeleteBox,
  onClearBoxPatients,
  onDeletePatient,
  onRemovePatientFromBox,
  onUpdatePatient,
  onEditBox,
  onOpenPatientQR,
  onClearUnread,
  onAddPatient,
  onTransferToPeralihanSiang,
  onTransferBackFromPeralihanSiang,
  isDragDisabled = false,
  isDragging = false,
  isDropTarget = false,
  onDragStartBox,
  onDragEndBox,
  onDragOverBox,
  onDropBox,
  onMoveBoxStep,
}) => {
  const [showCompleted, setShowCompleted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentTimeTick, setCurrentTimeTick] = useState(Date.now());
  const [forwardingPatient, setForwardingPatient] = useState<PatientItem | null>(null);
  const [showAlihkanKembaliModal, setShowAlihkanKembaliModal] = useState(false);
  const [transferTargetBoxId, setTransferTargetBoxId] = useState<string>('');
  const [deleteMode, setDeleteMode] = useState<'transfer' | 'all'>('transfer');
  const [showClearPatientsConfirm, setShowClearPatientsConfirm] = useState(false);
  const [selectedPatientForPhoto, setSelectedPatientForPhoto] = useState<PatientItem | null>(null);
  const [selectedPatientForTimeline, setSelectedPatientForTimeline] = useState<PatientItem | null>(null);

  // Identify special boxes that should not have "ALIHKAN SIANG" button
  const isPeralihanBox = box.id === 'box-peralihan-siang' || box.title.toUpperCase().includes('PERALIHAN SIANG');
  const isJemputanRanapBox = 
    box.id === 'box-jemputan' || 
    box.id.toLowerCase().includes('jemputan') || 
    box.title.toUpperCase().includes('JEMPUTAN') ||
    box.officerName.toUpperCase().includes('JEMPUTAN');

  const canShowAlihkanSiang = !isPeralihanBox && !isJemputanRanapBox;

  const handleDirectAlihkanSiang = () => {
    if (activePatients.length === 0) {
      alert(`Tidak ada pasien yang sedang mengantre di kotak "${box.title}" untuk dialihkan.`);
      return;
    }
    if (onTransferToPeralihanSiang) {
      onTransferToPeralihanSiang(box.id);
    }
  };

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Box Photo Gallery Modal & Collage State
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [galleryInitialTab, setGalleryInitialTab] = useState<'viewer' | 'manage' | 'database'>('viewer');

  // Auto-tick every 1 second for live countdown timer in jemputan box, or 15 seconds for general wait time updating
  useEffect(() => {
    // Pause ticking when an interaction modal is open on this box to prevent re-render flicker
    if (showAlihkanKembaliModal || !!forwardingPatient || galleryModalOpen || !!selectedPatientForPhoto || !!selectedPatientForTimeline) return;

    const interval = setInterval(() => {
      setCurrentTimeTick(Date.now());
    }, isJemputanRanapBox ? 1000 : 15000);
    return () => clearInterval(interval);
  }, [isJemputanRanapBox, showAlihkanKembaliModal, !!forwardingPatient, galleryModalOpen, !!selectedPatientForPhoto, !!selectedPatientForTimeline]);

  const boxImages = getBoxImageUrls(box);

  const handleUpdateBoxImagesInternal = (boxId: string, imageUrls: string[]) => {
    if (onUpdateBoxImages) {
      onUpdateBoxImages(boxId, imageUrls);
    } else {
      onUpdateBoxImage(boxId, imageUrls[0] || '');
    }
    // Also trigger asynchronous backend persist with senderDeviceId to prevent self-sync race condition
    saveBoxImagesToServer(boxId, imageUrls, realtimeSync.getDeviceId());
  };

  // Patient Inline Edit State
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [confirmDeletePatientId, setConfirmDeletePatientId] = useState<string | null>(null);
  const [editQueueNumber, setEditQueueNumber] = useState('');
  const [editPatientName, setEditPatientName] = useState('');
  const [editMedicalRecordNo, setEditMedicalRecordNo] = useState('');
  const [editActionCode, setEditActionCode] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editIsWarning, setEditIsWarning] = useState(false);
  const [editIsRanap, setEditIsRanap] = useState(false);

  const startEditPatient = (p: PatientItem) => {
    setConfirmDeletePatientId(null);
    setEditingPatientId(p.id);
    setEditQueueNumber(p.queueNumber || '');
    setEditPatientName(p.patientName || '');
    setEditMedicalRecordNo(p.medicalRecordNo || '');
    setEditActionCode(p.actionCode || '');
    setEditDiagnosis(p.diagnosis || '');
    setEditNote(p.note || '');
    setEditIsWarning(!!p.isWarning);
    setEditIsRanap(!!p.isRanap);
  };

  const handleSavePatientEdit = (patient: PatientItem) => {
    if (onUpdatePatient) {
      onUpdatePatient({
        ...patient,
        queueNumber: editQueueNumber.trim() || patient.queueNumber,
        patientName: editPatientName.trim().toUpperCase() || patient.patientName,
        medicalRecordNo: editMedicalRecordNo.trim() || patient.medicalRecordNo,
        actionCode: editActionCode.trim().toUpperCase() || undefined,
        diagnosis: editDiagnosis.trim() || undefined,
        note: editNote.trim() || undefined,
        isWarning: editIsWarning,
        isRanap: editIsRanap,
      });
    }
    setEditingPatientId(null);
  };

  // Smart color fallback: default Jemputan Ranap to metallic-dark and Peralihan Siang to metallic-bronze
  let effectiveColor: BoxColor = box.color;
  if (isJemputanRanapBox && (!effectiveColor || effectiveColor === 'sage' || effectiveColor === 'gray')) {
    effectiveColor = 'metallic-dark';
  } else if (isPeralihanBox && (!effectiveColor || effectiveColor === 'orange')) {
    effectiveColor = 'metallic-bronze';
  }

  const colorTheme = COLOR_MAP[effectiveColor] || COLOR_MAP.blue;

  // Urutan antrean: dari atas (pasien datang awal) ke bawah, input baru masuk di bawahnya
  // Deduplikasi pasien berdasarkan id untuk menjamin key uniqueness
  const activePatients = useMemo(() => {
    const map = new Map<string, PatientItem>();
    patients.filter(p => !p.completed).forEach(p => {
      if (p && p.id) map.set(p.id, p);
    });
    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  }, [patients]);

  const completedPatients = useMemo(() => {
    const map = new Map<string, PatientItem>();
    patients.filter(p => p.completed).forEach(p => {
      if (p && p.id) map.set(p.id, p);
    });
    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.completedAt ? new Date(a.completedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.completedAt ? new Date(b.completedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeA - timeB;
    });
  }, [patients]);
  const isOverloaded = activePatients.length > 5;
  const nextPatientToCall = activePatients[0];

  return (
    <div 
      id={`box-card-${box.id}`}
      onDragOver={(e) => {
        if (!isDragDisabled && onDragOverBox) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOverBox(e, box.id);
        }
      }}
      onDrop={(e) => {
        if (!isDragDisabled && onDropBox) {
          e.preventDefault();
          onDropBox(box.id);
        }
      }}
      className={`relative rounded-2xl border ${colorTheme.border} ${colorTheme.bg} shadow-[0_6px_20px_-4px_rgba(15,23,42,0.07),0_2px_6px_-1px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_14px_30px_-6px_rgba(15,23,42,0.12),0_4px_10px_-2px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,1)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between overflow-hidden group scroll-mt-24 ${
        isOverloaded ? 'ring-2 ring-rose-500 shadow-xl shadow-rose-200/50' : ''
      } ${
        isDragging ? 'opacity-40 scale-[0.98] ring-2 ring-teal-400 border-teal-500 border-dashed' : ''
      } ${
        isDropTarget ? 'ring-2 ring-teal-500 ring-offset-2 border-teal-500 scale-[1.01]' : ''
      }`}
    >
      {/* Subtle Top 3D Highlight Glaze */}
      <div className={`absolute inset-x-0 top-0 h-[2px] ${colorTheme.isDark ? 'bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent' : 'bg-gradient-to-r from-transparent via-white/80 to-transparent'} pointer-events-none z-10`} />

      {/* Photo Gallery Modal (Multi-Upload, Consecutive Uploads, Viewer, and Photo DB) */}
      {galleryModalOpen && (
        <BoxPhotoGalleryModal
          key={`${box.id}-${galleryInitialIndex}-${galleryInitialTab}`}
          isOpen={galleryModalOpen}
          box={box}
          initialIndex={galleryInitialIndex}
          initialTab={galleryInitialTab}
          onClose={() => setGalleryModalOpen(false)}
          onUpdateImages={handleUpdateBoxImagesInternal}
        />
      )}

      <div>
        {/* Card Header Title Bar (Embossed Plate Look) */}
        <div className="p-3.5 sm:p-4 pb-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`font-bold text-sm sm:text-base leading-snug tracking-tight ${colorTheme.titleColor || 'text-slate-900'}`}>
                  {isPeralihanBox ? 'PERALIHAN SIANG' : (box.title ? box.title.split('(')[0].trim() : '')}
                </h2>
                {isJemputanRanapBox && (
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 shadow-xs border border-cyan-300/40">
                    🛏️ JEMPUTAN RANAP
                  </span>
                )}
                {isPeralihanBox && (
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-stone-950 shadow-xs border border-amber-300/40">
                    ☀️ PERALIHAN SIANG
                  </span>
                )}
                {/* Total Pasien Badge (Antre + Selesai) */}
                {(activePatients.length > 0 || completedPatients.length > 0) && (
                  <span 
                    className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold shadow-2xs border ${
                      colorTheme.isDark 
                        ? 'bg-gradient-to-b from-cyan-400 to-teal-500 text-slate-950 border-cyan-300/50' 
                        : 'bg-gradient-to-b from-slate-800 to-slate-950 text-white border-slate-700/80 shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]'
                    }`}
                    title={`Total: ${activePatients.length + completedPatients.length} Pasien (${activePatients.length} Sedang Antri, ${completedPatients.length} Selesai)`}
                  >
                    {activePatients.length + completedPatients.length} Pasien
                    {completedPatients.length > 0 && (
                      <span className="opacity-75 font-normal text-[9px] ml-1">
                        ({activePatients.length} antri)
                      </span>
                    )}
                  </span>
                )}
              </div>
              {Boolean(box.location && box.location.trim()) && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs mt-1.5">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border shadow-2xs ${
                    colorTheme.locationClass || 'text-slate-700 bg-white/90 border-slate-200/80'
                  }`}>
                    📍 {box.location}
                  </span>
                </div>
              )}
            </div>

            {/* Drag Handle, Edit, Pin & Dropdown Options */}
            <div className="flex items-center gap-1 shrink-0">
              {onDragStartBox && (
                <div
                  draggable={!isDragDisabled}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', box.id);
                    onDragStartBox(box.id);
                  }}
                  onDragEnd={() => onDragEndBox?.()}
                  className={`p-2 sm:p-1.5 rounded-lg transition-all border select-none ${
                    isDragDisabled
                      ? 'opacity-30 cursor-not-allowed'
                      : 'cursor-grab active:cursor-grabbing hover:scale-105'
                  } ${
                    colorTheme.isDark 
                      ? 'text-slate-400 hover:text-white hover:bg-white/10 border-transparent' 
                      : 'text-slate-400 hover:text-slate-800 hover:bg-black/5 border-transparent'
                  }`}
                  title={isDragDisabled ? 'Pencarian aktif - reset filter untuk geser posisi' : 'Tahan dan geser untuk memindahkan posisi kotak antrean'}
                >
                  <GripVertical className="w-4 h-4" />
                </div>
              )}

              {onEditBox && (
                <button
                  onClick={() => onEditBox(box)}
                  className={`p-2 sm:p-1.5 rounded-lg transition-all cursor-pointer border ${
                    colorTheme.isDark 
                      ? 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent hover:border-slate-600' 
                      : 'text-slate-500 hover:text-blue-700 hover:bg-white/80 border-transparent hover:border-slate-200/80 hover:shadow-2xs'
                  }`}
                  title="Edit Judul Kotak & Ruangan"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => onTogglePin(box.id)}
                className={`p-2 sm:p-1.5 rounded-lg transition-all cursor-pointer ${
                  box.isPinned 
                    ? colorTheme.isDark
                      ? 'text-amber-300 bg-amber-950/80 hover:bg-amber-900/90 border border-amber-600/80 shadow-2xs'
                      : 'text-amber-700 bg-amber-100/90 hover:bg-amber-200/90 border border-amber-300/80 shadow-2xs' 
                    : colorTheme.isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-white/80 hover:border-slate-200/80'
                }`}
                title={box.isPinned ? 'Lepas Sematan (Unpin)' : 'Sematkan Kotak (Pin)'}
              >
                <Pin className={`w-4 h-4 ${box.isPinned ? 'fill-amber-500 rotate-45' : ''}`} />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={`p-2 sm:p-1.5 rounded-lg transition-all cursor-pointer ${
                    colorTheme.isDark
                      ? 'text-slate-300 hover:text-white hover:bg-white/10'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/80 hover:border-slate-200/80'
                  }`}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-8 z-30 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs animate-in fade-in zoom-in-95">
                    {onEditBox && (
                      <button
                        onClick={() => {
                          onEditBox(box);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-blue-700 font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Judul Kotak & Ruangan</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowColorPicker(!showColorPicker);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5 text-teal-600" />
                      <span>Ubah Warna Kotak</span>
                    </button>

                    <button
                      onClick={() => {
                        onViewHistory(box);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Lihat Riwayat Panggilan</span>
                    </button>

                    <button
                      onClick={() => {
                        setGalleryInitialIndex(0);
                        setGalleryInitialTab('manage');
                        setGalleryModalOpen(true);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                      <span>Kelola Foto Instruksi / SOP</span>
                    </button>

                    {canShowAlihkanSiang && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          handleDirectAlihkanSiang();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-2 text-amber-800 font-bold cursor-pointer"
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-600" />
                        <span>ALIHKAN SIANG {activePatients.length > 0 ? `(${activePatients.length})` : ''}</span>
                      </button>
                    )}

                    {isPeralihanBox && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          if (activePatients.length === 0) {
                            alert('Tidak ada pasien yang sedang mengantre di kotak PERALIHAN SIANG untuk dialihkan kembali.');
                            return;
                          }
                          setShowAlihkanKembaliModal(true);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-teal-50 flex items-center gap-2 text-teal-800 font-bold cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
                        <span>ALIHKAN KEMBALI {activePatients.length > 0 ? `(${activePatients.length})` : ''}</span>
                      </button>
                    )}

                    {/* Posisi & Urutan Kotak */}
                    {onMoveBoxStep && !isDragDisabled && (
                      <>
                        <div className="border-t border-slate-100 my-1" />
                        <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Urutan Posisi Kotak
                        </div>
                        <button
                          onClick={() => {
                            onMoveBoxStep(box.id, 'left');
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer font-medium"
                        >
                          <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                          <span>Geser Maju (Kiri/Atas)</span>
                        </button>
                        <button
                          onClick={() => {
                            onMoveBoxStep(box.id, 'right');
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer font-medium"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <span>Geser Mundur (Kanan/Bawah)</span>
                        </button>
                        <button
                          onClick={() => {
                            onMoveBoxStep(box.id, 'first');
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer font-medium"
                        >
                          <ArrowUpToLine className="w-3.5 h-3.5 text-slate-500" />
                          <span>Pindah ke Paling Depan</span>
                        </button>
                      </>
                    )}

                    <div className="border-t border-slate-100 my-1" />

                    {onClearBoxPatients && (
                      <button
                        onClick={() => {
                          setShowClearPatientsConfirm(true);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-amber-50 text-amber-700 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Kosongkan Pasien Kotak Ini</span>
                      </button>
                    )}

                    {isPeralihanBox ? (
                      <div className="px-3 py-2 text-slate-400 flex items-center gap-2 text-[11px] font-medium bg-slate-50">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Kotak Sistem (Tidak Bisa Dihapus)</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(true);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Kotak</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Color Picker Palette Panel */}
          {showColorPicker && (
            <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-md flex flex-wrap gap-2 z-20 animate-in fade-in">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onUpdateBoxColor(box.id, c.id);
                    setShowColorPicker(false);
                  }}
                  className={`w-7 h-7 rounded-full border border-slate-300 ${c.class} transition-transform hover:scale-110 cursor-pointer shadow-xs ${
                    box.color === c.id ? 'ring-2 ring-slate-900 scale-105' : ''
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          )}

          {/* Overload Alert Banner (> 5 Patients) */}
          {isOverloaded && (
            <div className="mt-3 p-3 bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 text-white rounded-xl shadow-[0_4px_12px_rgba(225,29,72,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] flex items-center justify-between gap-2 border border-rose-400 animate-pulse">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                  <AlertOctagon className="w-4 h-4 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-200 leading-none">
                    ⚠️ Peringatan Penumpukan Antrean &gt; 5
                  </p>
                  <p className="text-xs font-bold truncate mt-0.5 text-white">
                    {activePatients.length} Pasien Menunggu (Est: ~{activePatients.length * 15} mnt)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCallNextInBox(box)}
                className="px-2.5 py-1.5 bg-gradient-to-b from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 text-slate-950 text-[10px] font-black rounded-lg shrink-0 shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.6)] cursor-pointer transition-transform active:scale-95"
                title="Panggil pasien nomor berikutnya ke layar display"
              >
                Panggil Segera
              </button>
            </div>
          )}

          {/* General Instruction Notes Banner */}
          {box.instructionText && (
            <div className={`mt-2.5 p-2.5 rounded-xl border text-xs shadow-[0_1px_2px_rgba(0,0,0,0.03)] font-medium space-y-1 ${
              colorTheme.instructionClass || 'bg-white/90 border-slate-200/80 text-slate-700'
            }`}>
              <div className={`whitespace-pre-line font-semibold leading-relaxed ${
                colorTheme.isDark ? 'text-slate-100' : 'text-slate-800'
              }`}>
                {box.instructionText}
              </div>
            </div>
          )}
        </div>

        {/* Active Patients Queue List (Elevated Floating Cards with 3D Embossed Depth) */}
        <div className="px-3.5 sm:px-4 py-2 space-y-2.5">
          {activePatients.length === 0 ? (
            <div className={`py-5 text-center text-xs font-medium italic rounded-xl border border-dashed ${
              colorTheme.emptyStateClass || 'text-slate-500 bg-white/60 border-slate-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]'
            }`}>
              Tidak ada pasien antri saat ini ✨
            </div>
          ) : (
            activePatients.map((patient, index) => (
              <div 
                key={`active-${box.id}-${patient.id}-${index}`}
                className={`p-3 rounded-xl bg-white border transition-all duration-200 shadow-[0_2px_6px_-1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,1)] hover:shadow-[0_8px_16px_-3px_rgba(15,23,42,0.1),0_2px_6px_-1px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] hover:-translate-y-0.5 group/item ${
                  patient.isWarning 
                    ? 'border-rose-300/90 bg-rose-50/40 ring-1 ring-rose-300/60 shadow-[0_2px_8px_rgba(225,29,72,0.08)]' 
                    : patient.isReady === false
                    ? 'border-dashed border-slate-300 bg-slate-50/80'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {editingPatientId === patient.id ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                      <span className="flex items-center gap-1 text-teal-800">
                        <Edit3 className="w-3.5 h-3.5 text-teal-600" />
                        Edit Data & Kode Tindakan
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingPatientId(null)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Patient Name & RM & Action Code */}
                    <div className="space-y-1.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Nama Pasien *</label>
                        <input
                          type="text"
                          value={editPatientName}
                          onChange={(e) => setEditPatientName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 uppercase focus:ring-2 focus:ring-teal-500 focus:bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">No. RM *</label>
                          <input
                            type="text"
                            value={editMedicalRecordNo}
                            onChange={(e) => setEditMedicalRecordNo(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">C/J/P/PP Kode Tindakan</label>
                          <input
                            type="text"
                            value={editActionCode}
                            onChange={(e) => setEditActionCode(e.target.value)}
                            placeholder="e.g. 2.6.4 atau MWD+TENS"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-teal-800 uppercase focus:ring-2 focus:ring-teal-500 focus:bg-white"
                          />
                        </div>
                      </div>
                      {/* Quick Code Buttons */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {[
                          { code: '2', label: '2 MWD (15m)' },
                          { code: '6', label: '6 TENS (15m)' },
                          { code: '4', label: '4 US (10m)' },
                          { code: '1', label: '1 IRR (15m)' },
                          { code: '1+10', label: '1+10 IR+Rehab (30m)' },
                          { code: '9', label: '9 Manipulasi (15m)' },
                          { code: '10', label: '10 Rehab (20m)' },
                          { code: '14', label: '14 Paket Chest (30m)' },
                          { code: '15', label: '15 Parafin (20m)' },
                          { code: '18', label: '18 Nebu (15m)' },
                          { code: '47', label: '47 Cryo (10m)' },
                          { code: '74', label: '74 Vaccum (20m)' },
                          { code: '75', label: '75 Chest (20m)' },
                          { code: 'OT', label: 'OT Okupasi (30m)' },
                          { code: 'TW', label: 'TW Wicara (30m)' },
                        ].map((item) => (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => {
                              setEditActionCode(prev => appendActionCode(prev, item.code));
                            }}
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-teal-100 hover:text-teal-900 active:bg-teal-200 border border-slate-200 hover:border-teal-300 rounded text-[9px] font-mono text-slate-700 transition-colors cursor-pointer"
                            title={`Tambahkan kode ${item.label} (bisa diklik berkali-kali)`}
                          >
                            +{item.label}
                          </button>
                        ))}
                        {editActionCode && (
                          <button
                            type="button"
                            onClick={() => setEditActionCode('')}
                            className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[9px] font-semibold transition-colors cursor-pointer"
                            title="Hapus / Kosongkan Kode"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Diagnosa / ICF WHO</label>
                      <IcfDiagnosisInput
                        value={editDiagnosis}
                        onChange={setEditDiagnosis}
                        placeholder="Pilih dari daftar ICF atau ketik diagnosa..."
                        size="sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Catatan Klinis / Kondisi Pasien</label>
                      <textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Catatan klinis / kondisi pasien..."
                        rows={3}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-teal-500 focus:bg-white resize-none"
                      />
                    </div>

                    {/* Status Checkboxes (Warning & Ranap) */}
                    <div className="flex items-center gap-4 py-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-rose-800">
                        <input
                          type="checkbox"
                          checked={editIsWarning}
                          onChange={(e) => setEditIsWarning(e.target.checked)}
                          className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                        />
                        <span>Warning (🛑)</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-blue-900">
                        <input
                          type="checkbox"
                          checked={editIsRanap}
                          onChange={(e) => setEditIsRanap(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>Ranap (🛏️)</span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-1">
                      {/* Left: Delete Patient Option with Inline Confirmation */}
                      {confirmDeletePatientId === patient.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeletePatientId(null);
                              setEditingPatientId(null);
                              onDeletePatient(patient.id);
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                            title="Konfirmasi hapus pasien ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Ya, Hapus!</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePatientId(null)}
                            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePatientId(patient.id)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 hover:text-rose-800 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="Hapus pasien ini dari antrean"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Hapus Pasien</span>
                        </button>
                      )}

                      {/* Right: Cancel and Save Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeletePatientId(null);
                            setEditingPatientId(null);
                          }}
                          className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePatientEdit(patient)}
                          className="px-3.5 py-1 bg-gradient-to-b from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <span>Simpan</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* BARIS 1: Identitas Pasien (Luas, 1 Baris) + Tombol Klinis Utama (Siap/Jempol & Panggil/Bell) */}
                    <div className="flex items-start justify-between gap-2">
                      {/* Sisi Kiri: Checkbox, Nomor Urut, Nama Pasien (Luas), No RM, Indikator Warning, Timer */}
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        {/* Checkbox & Order Index */}
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <button
                            onClick={() => onToggleCompletePatient(patient.id)}
                            className="p-0.5 text-slate-400 hover:text-teal-600 transition-colors cursor-pointer shrink-0 rounded-md active:scale-95"
                            title="Tandai Selesai (Pindahkan ke bawah)"
                          >
                            <Square className="w-4 h-4 text-slate-400 group-hover/item:text-teal-600" />
                          </button>

                          {/* Tactile Queue Order Number Badge (Continuous from Completed Count + 1) */}
                          <span 
                            className="w-5 h-5 rounded-md bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_1px_2px_rgba(0,0,0,0.04)] text-[10px] font-bold text-slate-700 flex items-center justify-center shrink-0"
                            title={`Nomor Antrean: ${completedPatients.length + index + 1} (Lanjutan setelah ${completedPatients.length} pasien selesai)`}
                          >
                            {completedPatients.length + index + 1}
                          </span>
                        </div>

                        {/* Nama Pasien & Info RM */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span 
                              onClick={() => startEditPatient(patient)}
                              className={`font-bold text-[15px] tracking-tight break-words leading-snug cursor-pointer transition-colors ${
                                patient.isReady === false 
                                  ? 'text-slate-500 line-through opacity-85 hover:text-blue-700' 
                                  : 'text-slate-950 hover:text-blue-700 hover:underline decoration-blue-400 underline-offset-2'
                              }`}
                              title="Klik nama pasien untuk Edit Data & Tindakan"
                            >
                              {patient.patientName}
                            </span>

                            {/* Nomor RM membuka Riwayat Terapi.
                                SENGAJA di sini, bukan pada nama pasien: nama sudah dipakai
                                untuk "Edit Data & Tindakan" yang dipakai petugas tiap hari. */}
                            <button
                              type="button"
                              onClick={() => setSelectedPatientForTimeline(patient)}
                              title={`Klik untuk melihat Riwayat Terapi ${patient.patientName}`}
                              className="font-mono bg-slate-100 hover:bg-teal-50 px-1.5 py-0.2 rounded text-slate-700 hover:text-teal-800 font-semibold border border-slate-200/80 hover:border-teal-300 text-[14px] leading-[19.5px] shrink-0 cursor-pointer transition-colors"
                            >
                              RM: {patient.medicalRecordNo}
                            </button>

                            {/* Badge Kompak: 1st Terapis & Kunjungan K-X (Interaktif membuka Timeline) */}
                            {patient.firstOfficerName ? (
                              <button
                                type="button"
                                onClick={() => setSelectedPatientForTimeline(patient)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-950 font-bold border border-amber-300/80 hover:border-amber-400 rounded-md text-[9px] sm:text-[10px] shadow-2xs transition-all cursor-pointer group/hist shrink-0"
                                title={`Terapis Pertama (1st PJ): ${patient.firstOfficerName} • Kunjungan ke-${patient.visitCount || 1} • Klik untuk melihat Riwayat Lengkap`}
                              >
                                <span className="text-amber-700 font-extrabold flex items-center gap-0.5">
                                  <User className="w-2.5 h-2.5 text-amber-600" />
                                  <span>1st: {patient.firstOfficerName.split(',')[0].split(' ')[0]}</span>
                                </span>
                                <span className="bg-amber-200/80 text-amber-900 px-1 py-0.1 rounded text-[8px] sm:text-[9px] font-extrabold group-hover/hist:bg-amber-300">
                                  K-{patient.visitCount || 1}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedPatientForTimeline(patient)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold border border-teal-200/80 hover:border-teal-300 rounded-md text-[9px] sm:text-[10px] shadow-2xs transition-all cursor-pointer shrink-0"
                                title={`Kunjungan Terapi ke-${patient.visitCount || 1} • Klik untuk detail Riwayat`}
                              >
                                <span className="bg-teal-200/80 text-teal-900 px-1 py-0.1 rounded text-[8px] sm:text-[9px] font-extrabold">
                                  K-{patient.visitCount || 1}
                                </span>
                              </button>
                            )}

                            {/* Metallic Red Slow Pulsing Dot for Warning Status */}
                            {patient.isWarning && (
                              <div 
                                className="relative inline-flex items-center justify-center p-0.5 cursor-help"
                                title="Status Perhatian Khusus / Warning Pasien"
                              >
                                <span className="absolute w-3.5 h-3.5 rounded-full bg-rose-500/30 animate-ping" />
                                <span className="relative w-2.5 h-2.5 rounded-full bg-gradient-to-br from-rose-300 via-red-600 to-rose-950 border border-rose-300/80 shadow-[0_0_8px_rgba(225,29,72,0.8),inset_0_1px_1.5px_rgba(255,255,255,0.75)] animate-[pulse_2.5s_ease-in-out_infinite]" />
                              </div>
                            )}

                            {/* Timer Hitung Mundur untuk Kotak Antrian Jemputan Ranap */}
                            {isJemputanRanapBox && (() => {
                              const timerState = getJemputanTimerState(patient, currentTimeTick);
                              if (timerState.isExpired) {
                                return (
                                  <span 
                                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-purple-100/90 text-purple-950 border border-purple-400 shadow-2xs animate-[pulse_1.2s_ease-in-out_infinite]"
                                    title="Waktu tindakan pasien telah selesai (00:00). Pasien Siap Dijemput!"
                                  >
                                    <span className="relative flex h-2 w-2 items-center justify-center">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-80" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600" />
                                    </span>
                                    <span className="text-[9px] font-black tracking-tight text-purple-900 uppercase">
                                      SIAP JEMPUT
                                    </span>
                                  </span>
                                );
                              }
                              return (
                                <span 
                                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-950 border border-amber-300 shadow-2xs font-mono text-[10px] font-bold"
                                  title={`Hitung mundur penjemputan: ${timerState.durationMinutes} menit`}
                                >
                                  <Timer className="w-3 h-3 text-amber-600 animate-pulse" />
                                  <span>{timerState.formattedTimer}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Sisi Kanan Atas: Tombol Klinis Utama [👍 Siap] + [🔔 Panggil] + Waktu Tunggu */}
                      <div className="flex flex-col items-end shrink-0 ml-1">
                        <div className="flex items-center gap-1">
                          {/* Status Pasien Siap / Tidak Siap (Jempol OK) */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onUpdatePatient) {
                                const currentReady = patient.isReady !== false;
                                onUpdatePatient({
                                  ...patient,
                                  isReady: !currentReady
                                });
                              }
                            }}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                              patient.isReady !== false
                                ? 'bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 text-white border-emerald-600 shadow-[0_2px_5px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] hover:from-emerald-600 hover:to-emerald-800'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-700 border-slate-300 shadow-inner grayscale'
                            }`}
                            title={
                              patient.isReady !== false
                                ? 'Status Pasien: SIAP (Menyala Hijau) — Klik jika pasien tidak ada saat dipanggil'
                                : 'Status Pasien: TIDAK ADA SAAT DIPANGGIL (Hitam Putih) — Klik untuk ubah menjadi Siap'
                            }
                            aria-label={
                              patient.isReady !== false ? 'Pasien Siap' : 'Pasien Tidak Ada Saat Dipanggil'
                            }
                          >
                            <ThumbsUp className={`w-3.5 h-3.5 ${patient.isReady !== false ? 'fill-white/30 text-white' : 'text-slate-500'}`} />
                          </button>

                          {/* Tactile 3D Call Button */}
                          <button
                            onClick={() => {
                              if (onClearUnread) onClearUnread(box.id);
                              onCallPatient(patient, box);
                            }}
                            className="p-1.5 text-white bg-gradient-to-b from-teal-500 via-teal-600 to-teal-700 hover:from-teal-600 hover:to-teal-800 active:from-teal-700 active:to-teal-900 rounded-lg shadow-[0_2px_5px_rgba(13,148,136,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all cursor-pointer flex items-center justify-center active:scale-95 border border-teal-600"
                            title="Panggil Pasien (Tampilkan ke Layar TV)"
                          >
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Clean Metric Badges directly under speaker */}
                        {(() => {
                           const metrics = calculatePatientTimeMetrics(patient, [box], currentTimeTick, false);
                           return (
                            <div className="mt-0.5 flex items-center justify-end gap-1 text-[9px] font-mono leading-none">
                              <span 
                                className={`px-1 py-0.2 rounded font-semibold shadow-2xs ${
                                  metrics.waitMinutes > 45
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : metrics.waitMinutes > 30
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'text-slate-700 bg-slate-100 border border-slate-200/80'
                                }`}
                                title={`Waktu tunggu: ${metrics.formattedWait}`}
                              >
                                {metrics.formattedWait}
                              </span>
                              {patient.calledCount > 0 && (
                                <span 
                                  className="font-bold text-teal-800 bg-teal-50 px-1 py-0.2 rounded border border-teal-200 shadow-2xs"
                                  title={`Telah dipanggil ${patient.calledCount} kali`}
                                >
                                  {patient.calledCount}x
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* BARIS 2: Badge Info (RANAP, Foto Instruksi, Tindakan) & Tombol Manajemen Kompak (Alihkan, Hapus) */}
                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100/90 pl-6 sm:pl-7">
                      {/* Sisi Kiri: Badge RANAP, Foto Instruksi DPJP, Tindakan Badge */}
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {patient.isRanap && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded-md flex items-center gap-0.5 border border-blue-200 shadow-2xs">
                            🛏️ RANAP
                          </span>
                        )}

                        {/* Foto Lembar Instruksi Ranap / DPJP */}
                        {(() => {
                          const pImages = getPatientImageUrls(patient);
                          if (pImages.length > 0) {
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPatientForPhoto(patient);
                                }}
                                className="px-1.5 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-md text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Lihat Foto Lembar Instruksi DPJP / Ranap"
                              >
                                <Camera className="w-3 h-3 text-teal-600" />
                                <span>Foto ({pImages.length})</span>
                              </button>
                            );
                          } else if (patient.isRanap) {
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPatientForPhoto(patient);
                                }}
                                className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-dashed border-blue-300 rounded-md text-[9px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Tambah / Upload Foto Instruksi Ranap"
                              >
                                <Camera className="w-3 h-3 text-blue-500" />
                                <span>+ Foto</span>
                              </button>
                            );
                          }
                          return null;
                        })()}

                        {/* Action Code Badge (Tindakan) */}
                        <ActionCodeBadge
                          actionCode={patient.actionCode}
                          crossedCodes={patient.crossedActionCodes}
                          interactive={true}
                          showSummary={true}
                          onEditClick={() => startEditPatient(patient)}
                          onToggleToken={(tok) => {
                            if (onUpdatePatient) {
                              const allTokens = getActionTokensOrFallback(patient.actionCode);
                              const newCrossed = toggleCrossedToken(patient.crossedActionCodes, tok);
                              const remSummary = formatRemainingCodes(allTokens, newCrossed);
                              onUpdatePatient({
                                ...patient,
                                crossedActionCodes: newCrossed,
                                kurangTindakanKode: remSummary,
                                kurangTindakan: remSummary ? remSummary.split('.').length : 0
                              });
                            }
                          }}
                        />

                        {/* Diagnosis / ICF WHO Badge */}
                        {patient.diagnosis && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditPatient(patient);
                            }}
                            className="px-1.5 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-850 border border-teal-200/90 rounded-md text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs max-w-[160px] sm:max-w-[220px]"
                            title={`Diagnosa ICF WHO: ${patient.diagnosis} (Klik untuk edit / ubah)`}
                          >
                            <Stethoscope className="w-2.5 h-2.5 text-teal-600 shrink-0" />
                            <span className="truncate">{patient.diagnosis}</span>
                          </button>
                        )}

                        {patient.isReady === false && (
                          <span 
                            onClick={() => {
                              if (onUpdatePatient) {
                                onUpdatePatient({ ...patient, isReady: true });
                              }
                            }}
                            className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-bold rounded-md flex items-center gap-1 border border-slate-300 shadow-2xs cursor-pointer transition-colors" 
                            title="Status: Pasien tidak ada saat dipanggil (Klik untuk ubah menjadi Siap)"
                          >
                            <ThumbsUp className="w-2.5 h-2.5 text-slate-500" />
                            <span>TIDAK ADA</span>
                          </span>
                        )}

                        {/* KHUSUS KOTAK PERALIHAN SIANG: Ceklist Lepas & Asal */}
                        {isPeralihanBox && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (onUpdatePatient) {
                                  const newLepas = !patient.isLepas;
                                  onUpdatePatient({
                                    ...patient,
                                    isLepas: newLepas,
                                    kurangTindakan: newLepas ? undefined : (patient.kurangTindakan || 2),
                                    peralihanStatus: newLepas ? 'lepas' : 'kurang'
                                  });
                                }
                              }}
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                                patient.isLepas
                                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                  : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-500 hover:text-emerald-800'
                              }`}
                              title="Tandai Pasien Lepas: Tetap di Peralihan Siang saat tombol ALIHKAN KEMBALI ditekan"
                            >
                              <CheckSquare className={`w-2.5 h-2.5 ${patient.isLepas ? 'text-white' : 'text-slate-400'}`} />
                              <span>Lepas {patient.isLepas ? '✓' : ''}</span>
                            </button>

                            {patient.originBoxTitle && (
                              <span 
                                className="text-[9px] font-medium text-slate-600 truncate max-w-[120px] bg-white/80 px-1 py-0.5 rounded border border-slate-200" 
                                title={`Kotak Asal: ${patient.originBoxTitle}`}
                              >
                                ➔ {patient.originBoxTitle.split('(')[0].trim()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Sisi Kanan: Tombol Sekunder Kompak [⇄ Alihkan] & [🗑️ Hapus] */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setForwardingPatient(patient)}
                          className="p-1 text-teal-700 bg-teal-50/80 hover:bg-teal-100 border border-teal-200/80 hover:border-teal-300 rounded-md transition-colors cursor-pointer"
                          title="Antrekan Pasien Ini ke Kotak / Terapis Lain"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-teal-700" />
                        </button>

                        {confirmDeletePatientId === patient.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeletePatientId(null);
                                onDeletePatient(patient.id);
                              }}
                              className="px-1.5 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-md transition-colors cursor-pointer"
                              title="Konfirmasi hapus pasien ini"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePatientId(null)}
                              className="p-1 text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePatientId(patient.id)}
                            className="p-1 text-rose-600 bg-rose-50/60 hover:bg-rose-100 border border-rose-200/60 hover:border-rose-300 rounded-md transition-colors cursor-pointer"
                            title="Hapus Pasien Dari Antrean"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Collapsible Completed Section at Bottom (Recessed Tray Aesthetic) */}
        {completedPatients.length > 0 && (
          <div className={`mt-3 border-t px-3.5 sm:px-4 py-2.5 shadow-inner ${
            colorTheme.completedTrayClass || 'border-slate-200/90 bg-gradient-to-b from-slate-100/70 to-slate-150/80'
          }`}>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`w-full flex items-center justify-between text-xs font-bold py-1 cursor-pointer transition-colors ${
                colorTheme.isDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {showCompleted ? <ChevronUp className="w-4 h-4 opacity-75" /> : <ChevronDown className="w-4 h-4 opacity-75" />}
                <span>
                  {completedPatients.length} Item Selesai ({completedPatients.length} Selesai)
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-2xs ${
                colorTheme.isDark 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                ✓ Selesai
              </span>
            </button>

            {showCompleted && (
              <div className="mt-2 space-y-1.5 pt-1">
                {completedPatients.map((patient, cIndex) => (
                  <div 
                    key={`completed-${box.id}-${patient.id}-${cIndex}`}
                    className="p-2.5 rounded-xl bg-white/80 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2 text-xs text-slate-500 hover:bg-white transition-all"
                  >
                    <div className="flex items-start gap-1.5 min-w-0">
                      <button
                        onClick={() => onToggleCompletePatient(patient.id)}
                        className="mt-0.5 text-emerald-600 hover:text-slate-400 transition-colors cursor-pointer shrink-0"
                        title="Kembalikan ke antrian aktif"
                      >
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      </button>

                      {/* Tactile Queue Order Number Badge for Completed Patients (Starts from 1 to C) */}
                      <span 
                        className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-300 shadow-2xs text-[10px] font-bold text-emerald-800 flex items-center justify-center shrink-0 mt-0.5"
                        title={`Pasien Selesai ke-${cIndex + 1}`}
                      >
                        {cIndex + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <span className="line-through font-semibold text-slate-600 mr-2 break-words leading-snug">
                          {patient.patientName}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPatientForTimeline(patient)}
                          title={`Klik untuk melihat Riwayat Terapi ${patient.patientName}`}
                          className="text-[10px] text-slate-500 hover:text-teal-700 font-mono font-medium cursor-pointer hover:underline decoration-teal-400 underline-offset-2 transition-colors"
                        >
                          / {patient.medicalRecordNo}
                        </button>

                        {/* Badge 1st Terapis & Kunjungan K-X for Completed Patient */}
                        {patient.firstOfficerName ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPatientForTimeline(patient)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold border border-amber-300/80 rounded text-[9px] shadow-2xs transition-all cursor-pointer ml-1"
                            title={`Terapis Pertama: ${patient.firstOfficerName} • Kunjungan ke-${patient.visitCount || 1}`}
                          >
                            <User className="w-2.5 h-2.5 text-amber-600" />
                            <span>1st: {patient.firstOfficerName.split(',')[0].split(' ')[0]}</span>
                            <span className="bg-amber-200/80 text-amber-900 px-1 py-0.1 rounded text-[8px] font-extrabold">
                              K-{patient.visitCount || 1}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPatientForTimeline(patient)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-300/80 rounded text-[9px] shadow-2xs transition-all cursor-pointer ml-1"
                            title={`Kunjungan Terapi ke-${patient.visitCount || 1}`}
                          >
                            <span className="bg-slate-200 text-slate-800 px-1 py-0.1 rounded text-[8px] font-extrabold">
                              K-{patient.visitCount || 1}
                            </span>
                          </button>
                        )}
                        {patient.actionCode && (
                          <span className="inline-block ml-1 align-middle">
                            <ActionCodeBadge
                              actionCode={patient.actionCode}
                              crossedCodes={patient.crossedActionCodes}
                              size="sm"
                            />
                          </span>
                        )}
                        {/* Auto Response Time for Completed */}
                        {(() => {
                          const metrics = calculatePatientTimeMetrics(patient, [box], currentTimeTick);
                          return (
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500 font-mono font-medium">
                              <span>⏱️ Respon Time: {metrics.formattedResponseTime}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedPatientForPhoto(patient)}
                        className={`p-1 rounded-md transition-colors cursor-pointer border ${
                          getPatientImageUrls(patient).length > 0
                            ? 'text-teal-800 bg-teal-100/90 border-teal-300 hover:bg-teal-200'
                            : 'text-slate-400 hover:text-teal-700 hover:bg-teal-50 border-transparent'
                        }`}
                        title={getPatientImageUrls(patient).length > 0 ? `Lihat ${getPatientImageUrls(patient).length} Foto Instruksi Pasien` : 'Ambil / Upload Foto Instruksi Pasien'}
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setForwardingPatient(patient)}
                        className="p-1 text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
                        title="Antrekan Pasien Selesai Ini ke Kotak / Terapis Lain"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>

                      {onOpenPatientQR && (
                        <button
                          type="button"
                          onClick={() => onOpenPatientQR(patient, box)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors p-1 cursor-pointer"
                          title="QR Code & E-Ticket"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {confirmDeletePatientId === patient.id ? (
                        <>
                          <button
                            onClick={() => {
                              setConfirmDeletePatientId(null);
                              onDeletePatient(patient.id);
                            }}
                            className="text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors p-1 rounded-md cursor-pointer"
                            title="Konfirmasi hapus pasien ini"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeletePatientId(null)}
                            className="text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors p-1 rounded-md cursor-pointer"
                            title="Batal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeletePatientId(patient.id)}
                          className="text-slate-300 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Toolbar Actions (Tactile Embossed Buttons) */}
      <div className={`p-3 border-t flex flex-wrap items-center justify-between gap-2 ${
        colorTheme.footerClass || 'bg-white/80 border-slate-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,1)]'
      }`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onAddPatientToBox(box.id)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer active:translate-y-0.5 ${
              colorTheme.isDark 
                ? 'text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 shadow-[0_1px_3px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]' 
                : 'text-slate-800 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] hover:border-slate-300'
            }`}
          >
            <Plus className={`w-3.5 h-3.5 ${colorTheme.isDark ? 'text-cyan-400' : 'text-teal-600'}`} />
            <span>Tambah Item</span>
          </button>

          {/* ALIHKAN SIANG BUTTON - EKSEKUSI LANGSUNG */}
          {canShowAlihkanSiang && (
            <button
              type="button"
              onClick={handleDirectAlihkanSiang}
              className="flex items-center gap-1 text-xs font-bold text-amber-950 bg-gradient-to-b from-amber-200 via-amber-300 to-amber-400 hover:from-amber-100 hover:to-amber-300 border border-amber-500/70 shadow-[0_1px_3px_rgba(217,119,6,0.25),inset_0_1px_0_rgba(255,255,255,0.7)] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer active:translate-y-0.5 group/alihtool"
              title="Alihkan seluruh pasien yang masih mengantre di kotak ini langsung ke Kotak PERALIHAN SIANG"
            >
              <Sun className="w-3.5 h-3.5 text-amber-900 group-hover/alihtool:rotate-45 transition-transform" />
              <span>ALIHKAN SIANG</span>
              {activePatients.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-amber-900/20 text-amber-950 text-[10px] font-bold rounded-full border border-amber-900/30">
                  {activePatients.length}
                </span>
              )}
            </button>
          )}

          {/* ALIHKAN KEMBALI BUTTON (FOR KOTAK PERALIHAN SIANG) */}
          {isPeralihanBox && (
            <button
              type="button"
              onClick={() => {
                if (activePatients.length === 0) {
                  alert('Tidak ada pasien yang sedang mengantre di kotak PERALIHAN SIANG untuk dialihkan kembali.');
                  return;
                }
                setShowAlihkanKembaliModal(true);
              }}
              className="flex items-center gap-1 text-xs font-bold text-teal-950 bg-gradient-to-b from-teal-200 via-teal-300 to-teal-400 hover:from-teal-100 hover:to-teal-300 border border-teal-500/70 shadow-[0_1px_3px_rgba(13,148,136,0.25),inset_0_1px_0_rgba(255,255,255,0.7)] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer active:translate-y-0.5 group/kembalitool"
              title="Kembalikan pasien tindakan kurang ke kotak semula (pasien lepas tetap di sini)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-teal-900 group-hover/kembalitool:-rotate-45 transition-transform" />
              <span>ALIHKAN KEMBALI</span>
              {activePatients.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-teal-900/20 text-teal-950 text-[10px] font-bold rounded-full border border-teal-900/30">
                  {activePatients.filter(p => !p.isLepas).length} Balik / {activePatients.filter(p => p.isLepas).length} Tetap
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onViewHistory(box)}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              colorTheme.isDark 
                ? 'text-slate-300 hover:text-cyan-300 hover:bg-white/10' 
                : 'text-slate-600 hover:text-indigo-700 hover:bg-black/5'
            }`}
            title="Riwayat Panggilan Kotak Ini"
          >
            <History className={`w-3.5 h-3.5 ${colorTheme.isDark ? 'text-cyan-400' : 'text-indigo-600'}`} />
            <span className="hidden sm:inline">Riwayat</span>
          </button>
        </div>
      </div>

      {/* Delete Box Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            {isPeralihanBox ? (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-extrabold text-slate-900">Kotak Sistem Tidak Dapat Dihapus</h4>
                <p className="text-xs text-slate-600">
                  Kotak <strong>PERALIHAN SIANG</strong> adalah modul sistem utama yang digunakan untuk serah terima antrean shift siang dan operasional poli.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Konfirmasi Hapus Kotak Antrean</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Anda akan menghapus kotak <strong className="text-slate-900">"{box.title}"</strong>.
                    </p>
                  </div>
                </div>

                {activePatients.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                      <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Ada {activePatients.length} pasien yang masih aktif mengantre!</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteMode"
                          checked={deleteMode === 'transfer'}
                          onChange={() => setDeleteMode('transfer')}
                          className="mt-0.5 text-teal-600 focus:ring-teal-500"
                        />
                        <div className="flex-1">
                          <span className="font-semibold text-slate-800">Alihkan seluruh pasien ke kotak lain (Direkomendasikan)</span>
                          {deleteMode === 'transfer' && (
                            <div className="mt-1.5">
                              <select
                                value={transferTargetBoxId}
                                onChange={(e) => setTransferTargetBoxId(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
                              >
                                <option value="">-- Pilih Kotak Tujuan Pemindahan --</option>
                                {(allBoxes || []).filter(b => b.id !== box.id).map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.title} {b.location ? `(${b.location})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-amber-200/60">
                        <input
                          type="radio"
                          name="deleteMode"
                          checked={deleteMode === 'all'}
                          onChange={() => setDeleteMode('all')}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <div className="flex-1">
                          <span className="font-semibold text-rose-700">Hapus kotak beserta antrean pasien di dalamnya</span>
                          <p className="text-[10px] text-slate-500">Antrean aktif pasien akan otomatis dibatalkan dan dihapus.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    Kotak ini tidak memiliki pasien aktif. Menghapus kotak akan membersihkan bilik ini dari sistem secara permanen.
                  </p>
                )}

                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setTransferTargetBoxId('');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={activePatients.length > 0 && deleteMode === 'transfer' && !transferTargetBoxId}
                    onClick={() => {
                      if (activePatients.length > 0 && deleteMode === 'transfer') {
                        if (!transferTargetBoxId) {
                          alert('Pilih kotak tujuan pemindahan pasien terlebih dahulu.');
                          return;
                        }
                        onDeleteBox(box.id, transferTargetBoxId);
                      } else {
                        onDeleteBox(box.id);
                      }
                      setShowDeleteConfirm(false);
                      setTransferTargetBoxId('');
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    Ya, Hapus Kotak
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear Patients in this Box Confirmation Modal */}
      {showClearPatientsConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">Kosongkan Antrean Kotak?</h4>
              <p className="text-xs text-slate-600 mt-1">
                Seluruh antrean pasien (<strong className="text-slate-800">{patients.length} pasien</strong>) di kotak <strong className="text-slate-900">"{box.title}"</strong> akan dibersihkan dan diarsipkan ke riwayat harian. Kotak ini akan tetap ada.
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearPatientsConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearBoxPatients) {
                    onClearBoxPatients(box.id);
                  }
                  setShowClearPatientsConfirm(false);
                }}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Ya, Bersihkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue To Another Box / Therapist Modal */}
      {forwardingPatient && (
        <QueueToAnotherBoxModal
          isOpen={!!forwardingPatient}
          onClose={() => setForwardingPatient(null)}
          patient={forwardingPatient}
          currentBox={box}
          boxes={allBoxes || [box]}
          onAddPatient={(data) => {
            if (onAddPatient) {
              onAddPatient(data);
            }
          }}
          onCompleteSourcePatient={(pid) => {
            // Kotak asal tetap dapat poin ceklisnya, TAPI pasien ranap belum boleh
            // masuk antrean jemputan - ia baru diserahkan, tindakannya masih kurang.
            // Jemputan terbit saat terapis tujuan menceklis selesai.
            onToggleCompletePatient(pid, { skipJemputan: true });
          }}
          onDeleteSourcePatient={(pid) => {
            if (onRemovePatientFromBox) {
              onRemovePatientFromBox(pid, 'dipindahkan');
            } else {
              onDeletePatient(pid, 'dipindahkan');
            }
          }}
        />
      )}

      {/* Alihkan Kembali Modal (Kembali ke Kotak Semula) */}
      {showAlihkanKembaliModal && (
        <AlihkanKembaliModal
          isOpen={showAlihkanKembaliModal}
          onClose={() => setShowAlihkanKembaliModal(false)}
          peralihanBox={box}
          patients={patients}
          allBoxes={allBoxes || [box]}
          onConfirmReturn={(updatedPatients) => {
            if (onTransferBackFromPeralihanSiang) {
              onTransferBackFromPeralihanSiang(updatedPatients);
            }
          }}
        />
      )}

      {/* Patient Instruction Photo Viewer & Uploader Modal */}
      {selectedPatientForPhoto && (
        <PatientPhotoModal
          isOpen={!!selectedPatientForPhoto}
          onClose={() => setSelectedPatientForPhoto(null)}
          patient={selectedPatientForPhoto}
          onUpdatePatientPhotos={(photos, urls) => {
            if (onUpdatePatient) {
              onUpdatePatient({
                ...selectedPatientForPhoto,
                instructionPhotos: photos,
                instructionImageUrls: urls,
                instructionImageUrl: urls[0] || undefined,
              });
            }
            setSelectedPatientForPhoto((prev) => prev ? {
              ...prev,
              instructionPhotos: photos,
              instructionImageUrls: urls,
              instructionImageUrl: urls[0] || undefined,
            } : null);
          }}
        />
      )}

      {/* Patient Visit & Therapist History Timeline Modal */}
      {selectedPatientForTimeline && (
        <PatientTimelineModal
          isOpen={!!selectedPatientForTimeline}
          onClose={() => setSelectedPatientForTimeline(null)}
          patient={selectedPatientForTimeline}
          boxes={allBoxes || [box]}
        />
      )}
    </div>
  );
};
