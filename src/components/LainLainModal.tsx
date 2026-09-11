import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Wallet,
  RefreshCw,
  Calendar,
  CalendarDays,
  Plus,
  Trash2,
  Download,
  Printer,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  Building,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  HelpCircle,
  FileCheck,
  Edit2,
  ShieldCheck,
  Send,
  Check,
  Users,
  CheckSquare,
  Square,
  Coins,
  Settings,
  TrendingUp,
  Lock,
  Unlock,
  Key,
  KeyRound,
  Eye,
  EyeOff,
  ShieldAlert,
  RotateCcw
} from 'lucide-react';
import {
  KasTransaction,
  StaffKasPayment,
  RotationSchedule,
  SaturdayDutyRecord,
  LeaveRequestRecord,
  QueueBox
} from '../types';
import {
  getKasTransactions,
  saveKasTransactions,
  getStaffKasPayments,
  saveStaffKasPayments,
  getRotationSchedules,
  saveRotationSchedules,
  getSaturdaySchedules,
  saveSaturdaySchedules,
  getLeaveRequests,
  saveLeaveRequests,
  saveLeaveRequestToDb,
  deleteLeaveRequestFromDb,
  calculateLeaveBalance,
  checkLeaveConflicts,
  fetchLainLainFromDb,
  subscribeLainLainSync,
  extractTherapistsList,
  formatRupiah,
  formatIndonesianDate,
  formatIndonesianShortDate,
  exportKasReportPDF,
  exportStaffKas12MonthsPDF,
  exportLeaveReportPDF,
  getSaturdaysInMonth,
  INDONESIAN_MONTHS,
  INDONESIAN_SHORT_MONTHS,
  getKasChecklistPassword,
  verifyKasChecklistPassword,
  setKasChecklistPassword,
  DEFAULT_KAS_CHECKLIST_PASSWORD,
  getChecklistTxId,
  createChecklistTx,
  syncStaffChecklistWithKas,
  clearAllKasData,
  getSavedKasNominal,
  setSavedKasNominal,
  resetStaffTherapistRoster
} from '../utils/lainLainService';
import { saveCustomOfficer } from '../utils/savedOfficersService';

interface LainLainModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: QueueBox[];
  initialTab?: 'kas' | 'rotasi' | 'sabtu' | 'cuti';
}

export const LainLainModal: React.FC<LainLainModalProps> = ({
  isOpen,
  onClose,
  boxes,
  initialTab = 'kas'
}) => {
  const [activeTab, setActiveTab] = useState<'kas' | 'rotasi' | 'sabtu' | 'cuti'>(initialTab);

  // Synchronize initialTab when opened
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const therapists = useMemo(() => extractTherapistsList(boxes), [boxes]);

  // ==========================================
  // TAB 1: KAS IRM STATE & LOGIC
  // ==========================================
  const [kasSubTab, setKasSubTab] = useState<'ceklist_petugas' | 'transaksi'>('ceklist_petugas');
  const [kasList, setKasList] = useState<KasTransaction[]>([]);
  const [isKasFormOpen, setIsKasFormOpen] = useState(false);
  const [kasDate, setKasDate] = useState(new Date().toISOString().slice(0, 10));
  const [kasType, setKasType] = useState<'in' | 'out'>('in');
  const [kasCategory, setKasCategory] = useState('Iuran Kas Bulanan');
  const [kasAmount, setKasAmount] = useState('');
  const [kasDescription, setKasDescription] = useState('');
  const [kasRecordedBy, setKasRecordedBy] = useState(therapists[0] || 'Bendahara IRM');
  const [kasFilterMonth, setKasFilterMonth] = useState('');
  const [kasSearchQuery, setKasSearchQuery] = useState('');

  // 12-Month Staff Kas Payment Checklist State
  const [selectedKasYear, setSelectedKasYear] = useState<number>(2026);
  const [staffPayments, setStaffPayments] = useState<StaffKasPayment[]>([]);
  const [nominalPerMonth, setNominalPerMonth] = useState<number>(() => getSavedKasNominal());
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'lunas' | 'berjalan' | 'belum'>('all');
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [isEditNominalOpen, setIsEditNominalOpen] = useState(false);
  const [tempNominalInput, setTempNominalInput] = useState(() => String(getSavedKasNominal()));

  // Edit Staff / Terapis State
  const [editingStaff, setEditingStaff] = useState<StaffKasPayment | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffNominal, setEditStaffNominal] = useState('50000');

  // Password & Read-Only / Edit Access Protection for Kas Checklist
  const [isKasUnlocked, setIsKasUnlocked] = useState<boolean>(false);
  const [isKasAuthModalOpen, setIsKasAuthModalOpen] = useState(false);
  const [kasAuthInput, setKasAuthInput] = useState('');
  const [kasAuthError, setKasAuthError] = useState('');
  const [showKasAuthPassword, setShowKasAuthPassword] = useState(false);
  const [pendingKasAction, setPendingKasAction] = useState<(() => void) | null>(null);

  // Change Password Modal
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currPasswordInput, setCurrPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // ==========================================
  // TAB 2: ROTASI FISIOTERAPIS STATE & LOGIC
  // ==========================================
  const [rotationList, setRotationList] = useState<RotationSchedule[]>([]);
  const [selectedRotationIndex, setSelectedRotationIndex] = useState(0);
  const [isEditRotationOpen, setIsEditRotationOpen] = useState(false);
  const [editRotationTitle, setEditRotationTitle] = useState('');
  const [editRotationNotes, setEditRotationNotes] = useState('');
  const [editAssignments, setEditAssignments] = useState<Array<{ therapistName: string; station: string; shiftNotes?: string }>>([]);

  // ==========================================
  // TAB 3: JADWAL SABTU STATE & LOGIC
  // ==========================================
  const [saturdayList, setSaturdayList] = useState<SaturdayDutyRecord[]>([]);
  const [saturdayMonthFilter, setSaturdayMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [isSaturdayFormOpen, setIsSaturdayFormOpen] = useState(false);
  const [editingSaturdayId, setEditingSaturdayId] = useState<string | null>(null);
  const [satDate, setSatDate] = useState('');
  const [satPrimary, setSatPrimary] = useState(therapists[0] || '');
  const [satAssistant, setSatAssistant] = useState(therapists[1] || '');
  const [satSupervisor, setSatSupervisor] = useState('dr. Sp.KFR');
  const [satHours, setSatHours] = useState('07:30 - 13:00 WIB');
  const [satStatus, setSatStatus] = useState<'scheduled' | 'completed' | 'swapped' | 'cancelled'>('scheduled');
  const [satNotes, setSatNotes] = useState('');

  // ==========================================
  // TAB 4: JADWAL CUTI STATE & LOGIC
  // ==========================================
  const [leaveList, setLeaveList] = useState<LeaveRequestRecord[]>([]);
  const [leaveTherapist, setLeaveTherapist] = useState(therapists[0] || '');
  const [leaveType, setLeaveType] = useState('Cuti Tahunan');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveReplacement, setLeaveReplacement] = useState(therapists[1] || '');
  const [isAccordingToPlan, setIsAccordingToPlan] = useState(true); // "Cuti ini sesuai rencana cuti yang sudah dibuat"
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [calendarViewMonth, setCalendarViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [leaveSearch, setLeaveSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load all initial data on modal open or year change & synchronize checklist with kas
  useEffect(() => {
    if (isOpen) {
      const rawKas = getKasTransactions();
      const rawStaff = getStaffKasPayments(selectedKasYear, boxes);
      const syncedKas = syncStaffChecklistWithKas(rawKas, rawStaff, selectedKasYear, nominalPerMonth);
      setKasList(syncedKas);
      saveKasTransactions(syncedKas);
      setStaffPayments(rawStaff);
      setRotationList(getRotationSchedules());
      setSaturdayList(getSaturdaySchedules());
      setLeaveList(getLeaveRequests());

      // Fetch fresh data from central server & Cloud Firestore
      fetchLainLainFromDb().then(fresh => {
        if (fresh) {
          if (Array.isArray(fresh.kasTransactions)) setKasList(fresh.kasTransactions);
          if (Array.isArray(fresh.rotationSchedules)) setRotationList(fresh.rotationSchedules);
          if (Array.isArray(fresh.saturdaySchedules)) setSaturdayList(fresh.saturdaySchedules);
          if (Array.isArray(fresh.leaveRequests)) setLeaveList(fresh.leaveRequests);
          if (fresh.staffKasPayments && fresh.staffKasPayments[selectedKasYear]) {
            setStaffPayments(fresh.staffKasPayments[selectedKasYear]);
          }
        }
      });

      // Real-time synchronization across all tabs and devices
      const unsubscribe = subscribeLainLainSync((data) => {
        if (data) {
          if (Array.isArray(data.kasTransactions)) setKasList(data.kasTransactions);
          if (Array.isArray(data.rotationSchedules)) setRotationList(data.rotationSchedules);
          if (Array.isArray(data.saturdaySchedules)) setSaturdayList(data.saturdaySchedules);
          if (Array.isArray(data.leaveRequests)) setLeaveList(data.leaveRequests);
          if (data.staffKasPayments && data.staffKasPayments[selectedKasYear]) {
            setStaffPayments(data.staffKasPayments[selectedKasYear]);
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, selectedKasYear, boxes, nominalPerMonth]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ----------------------------------------------------
  // KAS CALCULATIONS
  // ----------------------------------------------------
  const filteredKas = useMemo(() => {
    return kasList.filter(item => {
      const matchMonth = !kasFilterMonth || item.date.startsWith(kasFilterMonth);
      const matchSearch = !kasSearchQuery ||
        item.description.toLowerCase().includes(kasSearchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(kasSearchQuery.toLowerCase()) ||
        item.recordedBy.toLowerCase().includes(kasSearchQuery.toLowerCase());
      return matchMonth && matchSearch;
    });
  }, [kasList, kasFilterMonth, kasSearchQuery]);

  const totalIn = useMemo(() => {
    return filteredKas.filter(i => i.type === 'in').reduce((sum, i) => sum + i.amount, 0);
  }, [filteredKas]);

  const totalOut = useMemo(() => {
    return filteredKas.filter(i => i.type === 'out').reduce((sum, i) => sum + i.amount, 0);
  }, [filteredKas]);

  const allTotalIn = useMemo(() => {
    return kasList.filter(i => i.type === 'in').reduce((sum, i) => sum + i.amount, 0);
  }, [kasList]);

  const allTotalOut = useMemo(() => {
    return kasList.filter(i => i.type === 'out').reduce((sum, i) => sum + i.amount, 0);
  }, [kasList]);

  const overallBalance = allTotalIn - allTotalOut;

  // ----------------------------------------------------
  // STAFF 12-MONTH CHECKLIST CALCULATIONS & HANDLERS
  // ----------------------------------------------------
  const requireKasAuth = (action: () => void) => {
    if (isKasUnlocked) {
      action();
    } else {
      setPendingKasAction(() => action);
      setKasAuthInput('');
      setKasAuthError('');
      setIsKasAuthModalOpen(true);
    }
  };

  const handleUnlockKas = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (verifyKasChecklistPassword(kasAuthInput)) {
      setIsKasUnlocked(true);
      setIsKasAuthModalOpen(false);
      const pending = pendingKasAction;
      setPendingKasAction(null);
      setKasAuthInput('');
      setKasAuthError('');
      showToast('🔓 Akses Diberikan! Mode Edit Checklist Kas Berhasil Dibuka.');
      if (pending) {
        pending();
      }
    } else {
      setKasAuthError('Password salah! Masukkan password bendahara yang benar (Default: irm2026).');
    }
  };

  const handleLockKas = () => {
    setIsKasUnlocked(false);
    showToast('🔒 Mode Edit Dikunci. Tabel kas kembali ke Mode Lihat Saja.');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyKasChecklistPassword(currPasswordInput)) {
      setChangePasswordError('Password saat ini salah.');
      return;
    }
    if (!newPasswordInput || newPasswordInput.trim().length < 3) {
      setChangePasswordError('Password baru minimal 3 karakter.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setChangePasswordError('Konfirmasi password baru tidak cocok.');
      return;
    }
    setKasChecklistPassword(newPasswordInput.trim());
    setIsChangePasswordOpen(false);
    setCurrPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setChangePasswordError('');
    showToast('🔑 Password Bendahara Kas berhasil diperbarui!');
  };

  const filteredStaffPayments = useMemo(() => {
    return staffPayments.filter(item => {
      const matchSearch = !staffSearchQuery || item.staffName.toLowerCase().includes(staffSearchQuery.toLowerCase());
      if (!matchSearch) return false;

      const paidCount = Object.values(item.months).filter(Boolean).length;
      if (staffStatusFilter === 'lunas') return paidCount === 12;
      if (staffStatusFilter === 'berjalan') return paidCount > 0 && paidCount < 12;
      if (staffStatusFilter === 'belum') return paidCount === 0;
      return true;
    });
  }, [staffPayments, staffSearchQuery, staffStatusFilter]);

  const totalStaffCount = staffPayments.length;
  const currentMonthNum = new Date().getMonth() + 1; // 1-12
  const totalPaidCurrentMonth = staffPayments.filter(p => !!p.months[currentMonthNum]).length;

  const totalPaidMonthsAllStaff = staffPayments.reduce((acc, p) => {
    return acc + Object.values(p.months).filter(Boolean).length;
  }, 0);

  const totalKasCollectedYear = staffPayments.reduce((sum, p) => {
    const paidCount = Object.values(p.months).filter(Boolean).length;
    return sum + paidCount * (p.nominalPerMonth || nominalPerMonth);
  }, 0);

  const totalKasTargetYear = totalStaffCount * 12 * nominalPerMonth;
  const completionPercentage = totalKasTargetYear > 0 ? Math.round((totalKasCollectedYear / totalKasTargetYear) * 100) : 0;
  const fullyPaidStaffCount = staffPayments.filter(p => Object.values(p.months).filter(Boolean).length === 12).length;

  // Toggle single month for a staff member (protected) - Otomatis sinkron ke Catat Pemasukan Kas & Saldo
  const handleToggleStaffMonth = (staffId: string, monthNum: number) => {
    requireKasAuth(() => {
      let isNowPaid = false;
      let targetStaff: StaffKasPayment | undefined;

      const updated = staffPayments.map(p => {
        if (p.id === staffId) {
          targetStaff = p;
          const currentVal = !!p.months[monthNum];
          isNowPaid = !currentVal;
          const newMonths = { ...p.months, [monthNum]: isNowPaid };
          return { ...p, months: newMonths, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      setStaffPayments(updated);
      saveStaffKasPayments(selectedKasYear, updated);

      if (targetStaff) {
        const staff = targetStaff;
        const txId = getChecklistTxId(staff.id, selectedKasYear, monthNum);
        const mName = INDONESIAN_MONTHS[monthNum - 1];
        const nominal = staff.nominalPerMonth || nominalPerMonth;

        let updatedKas: KasTransaction[];
        if (isNowPaid) {
          const newTx = createChecklistTx(staff, selectedKasYear, monthNum, nominalPerMonth);
          const filtered = kasList.filter(t => t.id !== txId);
          updatedKas = [newTx, ...filtered];
          showToast(`✓ ${staff.staffName} (${mName}): LUNAS! +${formatRupiah(nominal)} dicatat ke Pemasukan Kas & Saldo bertambah.`);
        } else {
          updatedKas = kasList.filter(t => t.id !== txId);
          showToast(`✕ ${staff.staffName} (${mName}): BELUM BAYAR. -${formatRupiah(nominal)} disesuaikan dari Pemasukan Kas & Saldo.`);
        }
        setKasList(updatedKas);
        saveKasTransactions(updatedKas);
      }
    });
  };

  // Toggle all 12 months for a staff member (protected) - Otomatis sinkron ke Catat Pemasukan Kas & Saldo
  const handleToggleStaffAllMonths = (staffId: string, markAllPaid: boolean) => {
    requireKasAuth(() => {
      let targetStaff: StaffKasPayment | undefined;
      const updated = staffPayments.map(p => {
        if (p.id === staffId) {
          targetStaff = p;
          const newMonths: { [m: number]: boolean } = {};
          for (let m = 1; m <= 12; m++) newMonths[m] = markAllPaid;
          return { ...p, months: newMonths, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      setStaffPayments(updated);
      saveStaffKasPayments(selectedKasYear, updated);

      if (targetStaff) {
        const staff = targetStaff;
        const nominal = staff.nominalPerMonth || nominalPerMonth;
        let updatedKas = kasList.filter(t => !t.id.startsWith(`kas-tx-staff-${staff.id}-${selectedKasYear}-`));

        if (markAllPaid) {
          const newTxs: KasTransaction[] = [];
          for (let m = 1; m <= 12; m++) {
            newTxs.push(createChecklistTx(staff, selectedKasYear, m, nominalPerMonth));
          }
          updatedKas = [...newTxs, ...updatedKas];
          showToast(`✓ ${staff.staffName}: Lunas Penuh 12 Bulan! +${formatRupiah(nominal * 12)} ditambahkan ke Total Pemasukan & Saldo.`);
        } else {
          showToast(`✕ ${staff.staffName}: 12 Bulan direset ke BELUM BAYAR. Seluruh iuran disesuaikan dari Pemasukan & Saldo.`);
        }
        setKasList(updatedKas);
        saveKasTransactions(updatedKas);
      }
    });
  };

  // Mark all staff paid for a specific month (protected) - Otomatis sinkron ke Catat Pemasukan Kas & Saldo
  const handleMarkMonthAllStaff = (monthNum: number, markPaid: boolean) => {
    requireKasAuth(() => {
      const mName = INDONESIAN_MONTHS[monthNum - 1];
      if (window.confirm(`Tandai SEMUA petugas (${staffPayments.length} orang) sebagai ${markPaid ? 'SUDAH BAYAR' : 'BELUM BAYAR'} untuk bulan ${mName} ${selectedKasYear}?`)) {
        const updated = staffPayments.map(p => ({
          ...p,
          months: { ...p.months, [monthNum]: markPaid },
          updatedAt: new Date().toISOString()
        }));
        setStaffPayments(updated);
        saveStaffKasPayments(selectedKasYear, updated);

        let updatedKas = kasList.filter(t => {
          const isChecklistTxForThisMonth = t.id.startsWith('kas-tx-staff-') && t.id.endsWith(`-${selectedKasYear}-${monthNum}`);
          return !isChecklistTxForThisMonth;
        });

        if (markPaid) {
          const newTxs: KasTransaction[] = updated.map(staff =>
            createChecklistTx(staff, selectedKasYear, monthNum, nominalPerMonth)
          );
          updatedKas = [...newTxs, ...updatedKas];
          const totalAdded = updated.length * nominalPerMonth;
          showToast(`✓ Bulan ${mName} ${selectedKasYear} untuk semua petugas (${updated.length} orang) LUNAS! +${formatRupiah(totalAdded)} dicatat ke Kas.`);
        } else {
          showToast(`✕ Bulan ${mName} ${selectedKasYear} direset belum bayar untuk semua petugas. Pemasukan & Saldo Kas disesuaikan.`);
        }
        setKasList(updatedKas);
        saveKasTransactions(updatedKas);
      }
    });
  };

  // Add new staff member to table (protected)
  const handleAddStaffMember = (e: React.FormEvent) => {
    e.preventDefault();
    requireKasAuth(() => {
      if (!newStaffName.trim()) return;
      const cleanName = newStaffName.trim();
      const monthsObj: { [m: number]: boolean } = {};
      for (let m = 1; m <= 12; m++) monthsObj[m] = false;

      const newRecord: StaffKasPayment = {
        id: `kas-staff-${selectedKasYear}-${Date.now()}`,
        staffName: cleanName,
        year: selectedKasYear,
        months: monthsObj,
        nominalPerMonth: nominalPerMonth,
        notes: '',
        updatedAt: new Date().toISOString()
      };
      const updated = [...staffPayments, newRecord];
      setStaffPayments(updated);
      saveStaffKasPayments(selectedKasYear, updated);

      // Permanently register to saved officers list as well
      saveCustomOfficer({
        name: cleanName,
        role: 'Fisioterapis / Petugas IRM',
      });

      setNewStaffName('');
      setIsAddStaffOpen(false);
      showToast(`Petugas "${newRecord.staffName}" berhasil disimpan ke sistem dan daftar kas!`);
    });
  };

  // Delete staff member (protected) - Otomatis bersihkan transaksi kas terkait
  const handleDeleteStaffMember = (staffId: string, name: string) => {
    requireKasAuth(() => {
      if (window.confirm(`Hapus "${name}" dari tabel ceklist uang kas tahun ${selectedKasYear}?`)) {
        const updated = staffPayments.filter(p => p.id !== staffId);
        setStaffPayments(updated);
        saveStaffKasPayments(selectedKasYear, updated);

        const updatedKas = kasList.filter(t => !t.id.startsWith(`kas-tx-staff-${staffId}-`));
        setKasList(updatedKas);
        saveKasTransactions(updatedKas);
        showToast(`"${name}" dihapus dari daftar & mutasi kas disinkronkan.`);
      }
    });
  };

  // Update nominal per month (protected) - Otomatis perbarui nominal transaksi checklist
  const handleSaveNominal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    requireKasAuth(() => {
      const num = parseInt(tempNominalInput.replace(/\D/g, ''), 10);
      if (!num || num <= 0) {
        alert('Masukkan nominal iuran yang valid.');
        return;
      }
      setNominalPerMonth(num);
      setSavedKasNominal(num);
      const updated = staffPayments.map(p => ({ ...p, nominalPerMonth: num }));
      setStaffPayments(updated);
      saveStaffKasPayments(selectedKasYear, updated);

      const updatedKas = kasList.map(t => {
        if (t.id.startsWith('kas-tx-staff-') && t.id.includes(`-${selectedKasYear}-`)) {
          return { ...t, amount: num };
        }
        return t;
      });
      setKasList(updatedKas);
      saveKasTransactions(updatedKas);

      setIsEditNominalOpen(false);
      showToast(`✓ Nominal iuran kas per bulan diperbarui ke ${formatRupiah(num)}! Seluruh catatan kas disesuaikan.`);
    });
  };

  // Reset therapist names in the dues table to official default therapist roster
  const handleResetStaffTherapists = () => {
    requireKasAuth(() => {
      if (window.confirm(`PERINGATAN: Apakah Anda yakin ingin ME-RESET daftar nama terapis dalam tabel iuran ke daftar terapis resmi IRM terbaru?\n\nSemua baris terapis akan dimuat ulang sesuai master data terapis resmi dengan status iuran 0 (belum bayar).`)) {
        const resetStaff = resetStaffTherapistRoster(selectedKasYear, boxes, nominalPerMonth);
        setStaffPayments(resetStaff);
        saveStaffKasPayments(selectedKasYear, resetStaff);
        
        // Clean any stale checklist transactions in kas for this year
        const cleanedKas = kasList.filter(t => !t.id.startsWith('kas-tx-staff-') || !t.id.includes(`-${selectedKasYear}-`));
        setKasList(cleanedKas);
        saveKasTransactions(cleanedKas);
        showToast('✓ Daftar nama terapis berhasil di-reset ke master terapis IRM resmi.');
      }
    });
  };

  // Open Edit Staff Modal (Protected)
  const handleOpenEditStaff = (staff: StaffKasPayment) => {
    requireKasAuth(() => {
      setEditingStaff(staff);
      setEditStaffName(staff.staffName);
      setEditStaffNominal(String(staff.nominalPerMonth || nominalPerMonth));
    });
  };

  // Save Edited Staff
  const handleSaveEditedStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    const cleanName = editStaffName.trim();
    if (!cleanName) {
      alert('Nama terapis/petugas tidak boleh kosong.');
      return;
    }
    const parsedNominal = parseInt(editStaffNominal.replace(/\D/g, ''), 10) || nominalPerMonth;
    const oldName = editingStaff.staffName;
    const staffId = editingStaff.id;

    const updated = staffPayments.map(p => {
      if (p.id === staffId) {
        return {
          ...p,
          staffName: cleanName,
          nominalPerMonth: parsedNominal,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    setStaffPayments(updated);
    saveStaffKasPayments(selectedKasYear, updated);

    // Update mutasi transactions if needed
    const updatedKas = kasList.map(t => {
      if (t.id.startsWith(`kas-tx-staff-${staffId}-`)) {
        return {
          ...t,
          description: t.description.replace(oldName, cleanName),
          amount: parsedNominal
        };
      }
      return t;
    });
    setKasList(updatedKas);
    saveKasTransactions(updatedKas);

    saveCustomOfficer({
      name: cleanName,
      role: 'Fisioterapis / Petugas IRM',
    });

    setEditingStaff(null);
    showToast(`✓ Data terapis "${cleanName}" berhasil diperbarui!`);
  };

  // Auto record monthly staff dues to Cash Transactions (Pemasukan) (protected)
  const handleSyncMonthToTransactions = (monthNum: number) => {
    requireKasAuth(() => {
      const mName = INDONESIAN_MONTHS[monthNum - 1];
      const paidStaff = staffPayments.filter(p => !!p.months[monthNum]);
      if (paidStaff.length === 0) {
        alert(`Belum ada petugas yang lunas pada bulan ${mName}. Centang petugas terlebih dahulu.`);
        return;
      }
      const totalAmount = paidStaff.length * nominalPerMonth;
      const txDate = `${selectedKasYear}-${String(monthNum).padStart(2, '0')}-05`;

      const newTx: KasTransaction = {
        id: `kas-sync-${selectedKasYear}-${monthNum}-${Date.now()}`,
        date: txDate,
        type: 'in',
        category: 'Iuran Kas Bulanan',
        amount: totalAmount,
        description: `Iuran Kas Bulanan ${mName} ${selectedKasYear} (${paidStaff.length} Petugas @${formatRupiah(nominalPerMonth)})`,
        recordedBy: 'Bendahara IRM',
        createdAt: new Date().toISOString()
      };

      const updated = [newTx, ...kasList];
      setKasList(updated);
      saveKasTransactions(updated);
      showToast(`Pemasukan kas iuran ${mName} (${formatRupiah(totalAmount)}) berhasil dicatat ke Buku Kas!`);
    });
  };

  const handleAddKas = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(kasAmount.replace(/\D/g, ''), 10);
    if (!amountNum || amountNum <= 0) {
      alert('Mohon masukkan nominal kas yang valid.');
      return;
    }
    if (!kasDescription.trim()) {
      alert('Mohon masukkan uraian / keterangan transaksi.');
      return;
    }

    const newTx: KasTransaction = {
      id: `kas-${Date.now()}`,
      date: kasDate,
      type: kasType,
      category: kasCategory,
      amount: amountNum,
      description: kasDescription.trim(),
      recordedBy: kasRecordedBy,
      createdAt: new Date().toISOString()
    };

    const updated = [newTx, ...kasList];
    setKasList(updated);
    saveKasTransactions(updated);
    setIsKasFormOpen(false);
    setKasAmount('');
    setKasDescription('');
    showToast('Transaksi kas berhasil dicatat!');
  };

  const handleDeleteKas = (id: string) => {
    requireKasAuth(() => {
      if (window.confirm('Apakah Anda yakin ingin menghapus catatan transaksi kas ini?')) {
        const updated = kasList.filter(item => item.id !== id);
        setKasList(updated);
        saveKasTransactions(updated);

        // If this was a checklist transaction: kas-tx-staff-{staffId}-{year}-{monthNum}
        if (id.startsWith('kas-tx-staff-')) {
          const parts = id.split('-');
          const monthNum = parseInt(parts[parts.length - 1], 10);
          const year = parseInt(parts[parts.length - 2], 10);
          const staffId = parts.slice(3, parts.length - 2).join('-');

          if (staffId && year === selectedKasYear && monthNum >= 1 && monthNum <= 12) {
            const updatedPayments = staffPayments.map(p => {
              if (p.id === staffId) {
                return { ...p, months: { ...p.months, [monthNum]: false }, updatedAt: new Date().toISOString() };
              }
              return p;
            });
            setStaffPayments(updatedPayments);
            saveStaffKasPayments(selectedKasYear, updatedPayments);
          }
        }

        showToast('✓ Transaksi kas berhasil dihapus & status ceklist disinkronkan.');
      }
    });
  };

  const handleResetAllKasToZero = () => {
    requireKasAuth(() => {
      if (window.confirm(`PERINGATAN: Apakah Anda yakin ingin MENGOSONGKAN & ME-RESET seluruh angka laporan kas (semua catatan mutasi dan angka ceklist iuran 12 bulan) menjadi 0 (Nol)?\n\nSemua angka laporan kas akan bersih menjadi Rp 0 untuk pengisian baru.`)) {
        const cleared = clearAllKasData(selectedKasYear, boxes, nominalPerMonth);
        setKasList([]);
        setStaffPayments(cleared.staff);
        saveKasTransactions([]);
        saveStaffKasPayments(selectedKasYear, cleared.staff);
        showToast('✓ Seluruh angka laporan kas & buku mutasi telah berhasil di-reset menjadi Rp 0.');
      }
    });
  };

  // ----------------------------------------------------
  // ROTASI LOGIC
  // ----------------------------------------------------
  const currentRotation = rotationList[selectedRotationIndex] || rotationList[0];

  const handleOpenEditRotation = (rot: RotationSchedule) => {
    setEditRotationTitle(rot.periodName);
    setEditRotationNotes(rot.notes || '');
    setEditAssignments([...rot.assignments]);
    setIsEditRotationOpen(true);
  };

  const handleSaveRotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRotation) return;

    const updated: RotationSchedule = {
      ...currentRotation,
      periodName: editRotationTitle,
      notes: editRotationNotes,
      assignments: editAssignments,
      updatedAt: new Date().toISOString()
    };

    const newRotList = rotationList.map((r, i) => i === selectedRotationIndex ? updated : r);
    setRotationList(newRotList);
    saveRotationSchedules(newRotList);
    setIsEditRotationOpen(false);
    showToast('Jadwal rotasi berhasil disimpan!');
  };

  const STATIONS_LIST = [
    'Poli Rawat Inap (Ranap) & Jemputan',
    'Ruang Latihan Aktif / Gimnasium',
    'Elektroterapi & Modalitas (SWD/TENS/US)',
    'Fisioterapi Dada & Anak (Pediatrik)',
    'Poli Eksekutif / VIP & Konsul Dokter',
    'Ruang Traksi & Terapi Manual'
  ];

  const handleGenerateAutoRotation = () => {
    if (therapists.length === 0) return;
    const shuffledTherapists = [...therapists];
    // Rotate by 1 step
    const shifted = [...shuffledTherapists.slice(1), shuffledTherapists[0]];
    const newAssignments = shifted.slice(0, STATIONS_LIST.length).map((th, idx) => ({
      therapistName: th,
      station: STATIONS_LIST[idx % STATIONS_LIST.length],
      shiftNotes: 'Pagi 07:30 - 15:30'
    }));

    const nextMonthDate = new Date();
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const yMonth = nextMonthDate.toISOString().slice(0, 7);
    const monthName = nextMonthDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const newSchedule: RotationSchedule = {
      id: `rot-${Date.now()}`,
      periodMonth: yMonth,
      periodName: `${monthName} - Rencana Rotasi Baru`,
      startDate: `${yMonth}-01`,
      endDate: `${yMonth}-28`,
      assignments: newAssignments,
      notes: `Rotasi otomatis digenerate untuk periode ${monthName}.`,
      updatedAt: new Date().toISOString()
    };

    const updated = [newSchedule, ...rotationList];
    setRotationList(updated);
    saveRotationSchedules(updated);
    setSelectedRotationIndex(0);
    showToast(`Jadwal rotasi baru untuk ${monthName} berhasil dibuat!`);
  };

  // ----------------------------------------------------
  // JADWAL SABTU LOGIC
  // ----------------------------------------------------
  const filteredSaturdayList = useMemo(() => {
    return saturdayList.filter(s => !saturdayMonthFilter || s.date.startsWith(saturdayMonthFilter));
  }, [saturdayList, saturdayMonthFilter]);

  const handleAutoGenerateSaturdays = (monthStr: string) => {
    const dates = getSaturdaysInMonth(monthStr);
    if (dates.length === 0) {
      alert('Tidak ada tanggal Sabtu pada bulan yang dipilih.');
      return;
    }

    const existingDates = new Set(saturdayList.map(s => s.date));
    const newRecords: SaturdayDutyRecord[] = [];

    dates.forEach((dateStr, idx) => {
      if (!existingDates.has(dateStr)) {
        const primary = therapists[idx % therapists.length] || 'Fisioterapis Utama';
        const assistant = therapists[(idx + 1) % therapists.length] || 'Fisioterapis Pendamping';
        newRecords.push({
          id: `sat-${dateStr}-${Date.now()}`,
          date: dateStr,
          primaryTherapist: primary,
          assistantTherapist: assistant,
          supervisor: 'dr. Sp.KFR',
          shiftHours: '07:30 - 13:00 WIB',
          status: 'scheduled',
          notes: 'Jadwal piket layanan Sabtu reguler.',
          updatedAt: new Date().toISOString()
        });
      }
    });

    if (newRecords.length === 0) {
      showToast('Semua tanggal Sabtu pada bulan ini sudah memiliki jadwal!');
      return;
    }

    const updated = [...saturdayList, ...newRecords].sort((a, b) => a.date.localeCompare(b.date));
    setSaturdayList(updated);
    saveSaturdaySchedules(updated);
    showToast(`${newRecords.length} jadwal Sabtu berhasil digenerate!`);
  };

  const handleSaveSaturday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!satDate) {
      alert('Pilih tanggal hari Sabtu.');
      return;
    }

    if (editingSaturdayId) {
      const updated = saturdayList.map(item => item.id === editingSaturdayId ? {
        ...item,
        date: satDate,
        primaryTherapist: satPrimary,
        assistantTherapist: satAssistant,
        supervisor: satSupervisor,
        shiftHours: satHours,
        status: satStatus,
        notes: satNotes,
        updatedAt: new Date().toISOString()
      } : item);
      setSaturdayList(updated);
      saveSaturdaySchedules(updated);
      showToast('Jadwal Sabtu berhasil diperbarui!');
    } else {
      const newSat: SaturdayDutyRecord = {
        id: `sat-${satDate}-${Date.now()}`,
        date: satDate,
        primaryTherapist: satPrimary,
        assistantTherapist: satAssistant,
        supervisor: satSupervisor,
        shiftHours: satHours,
        status: satStatus,
        notes: satNotes,
        updatedAt: new Date().toISOString()
      };
      const updated = [...saturdayList, newSat].sort((a, b) => a.date.localeCompare(b.date));
      setSaturdayList(updated);
      saveSaturdaySchedules(updated);
      showToast('Jadwal Sabtu berhasil ditambahkan!');
    }

    setIsSaturdayFormOpen(false);
    setEditingSaturdayId(null);
  };

  const handleDeleteSaturday = (id: string) => {
    if (window.confirm('Hapus jadwal Sabtu ini?')) {
      const updated = saturdayList.filter(s => s.id !== id);
      setSaturdayList(updated);
      saveSaturdaySchedules(updated);
      showToast('Jadwal Sabtu dihapus.');
    }
  };

  // ----------------------------------------------------
  // JADWAL CUTI - INTERACTIVE MULTI-DATE PICKER LOGIC
  // ----------------------------------------------------
  // Toggle selection of any date on the calendar
  const handleToggleDate = (dateStr: string) => {
    setSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr).sort();
      } else {
        return [...prev, dateStr].sort();
      }
    });
  };

  // Calendar matrix generator for current viewing month
  const calendarDays = useMemo(() => {
    const year = calendarViewMonth.getFullYear();
    const month = calendarViewMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
    // Shift so Monday is index 0: (day + 6) % 7
    const adjustedFirstDay = (firstDayIndex + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ dateStr: string; dayNumber: number; isCurrentMonth: boolean; isWeekend: boolean }> = [];

    // Empty lead slots
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push({ dateStr: '', dayNumber: 0, isCurrentMonth: false, isWeekend: false });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isWeekend
      });
    }

    return days;
  }, [calendarViewMonth]);

  // Set of dates already taken by other therapists
  const existingLeaveDatesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    leaveList.forEach(l => {
      if (l.status !== 'rejected') {
        l.selectedDates.forEach(d => {
          const existing = map.get(d) || [];
          if (!existing.includes(l.therapistName)) {
            existing.push(l.therapistName);
          }
          map.set(d, existing);
        });
      }
    });
    return map;
  }, [leaveList]);

  // Selected therapist leave balance for current year
  const currentLeaveYear = useMemo(() => calendarViewMonth.getFullYear(), [calendarViewMonth]);
  const therapistLeaveBalance = useMemo(() => {
    return calculateLeaveBalance(leaveTherapist, currentLeaveYear, leaveList, 12);
  }, [leaveTherapist, currentLeaveYear, leaveList]);

  // Real-time conflict checks on selected dates
  const leaveConflicts = useMemo(() => {
    if (selectedDates.length === 0) return [];
    return checkLeaveConflicts(selectedDates, leaveTherapist, leaveList, 2);
  }, [selectedDates, leaveTherapist, leaveList]);

  // Quick preset to select multiple consecutive dates
  const handleQuickSelectDates = (daysCount: number) => {
    const year = calendarViewMonth.getFullYear();
    const month = calendarViewMonth.getMonth();
    const today = new Date();
    // start from today if in this month, otherwise 1st of viewed month
    let startDate = new Date(year, month, 1);
    if (today.getFullYear() === year && today.getMonth() === month) {
      startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }

    const generated: string[] = [];
    let cur = new Date(startDate);
    while (generated.length < daysCount) {
      // skip sundays (0)
      if (cur.getDay() !== 0) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        generated.push(`${y}-${m}-${d}`);
      }
      cur.setDate(cur.getDate() + 1);
    }
    setSelectedDates(generated);
  };

  // Handle submit leave request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveTherapist) {
      alert('Pilih nama staf fisioterapis.');
      return;
    }
    if (selectedDates.length === 0) {
      alert('Silakan klik tanggal-tanggal pada kalender untuk memilih hari cuti.');
      return;
    }

    const newLeave: LeaveRequestRecord = {
      id: `leave-${Date.now()}`,
      therapistName: leaveTherapist,
      leaveType,
      selectedDates: [...selectedDates].sort(),
      totalDays: selectedDates.length,
      reason: leaveReason.trim() || 'Cuti Sesuai Rencana Tahunan',
      replacementStaff: leaveReplacement,
      isAccordingToPlan,
      status: 'approved',
      submittedAt: new Date().toISOString(),
      approvedBy: 'Koordinator IRM'
    };

    const updated = [newLeave, ...leaveList];
    setLeaveList(updated);
    await saveLeaveRequestToDb(newLeave);

    // Reset inputs
    setSelectedDates([]);
    setLeaveReason('');
    showToast(`✓ Jadwal cuti ${newLeave.totalDays} hari untuk ${leaveTherapist} berhasil disimpan ke database!`);
  };

  const handleUpdateLeaveStatus = async (id: string, newStatus: 'approved' | 'pending' | 'rejected') => {
    const updated = leaveList.map(l => l.id === id ? {
      ...l,
      status: newStatus,
      approvedBy: newStatus === 'approved' ? 'Koordinator IRM' : l.approvedBy
    } : l);
    setLeaveList(updated);
    saveLeaveRequests(updated);
    const target = updated.find(l => l.id === id);
    if (target) {
      saveLeaveRequestToDb(target);
    }
    showToast(`Status cuti diubah menjadi "${newStatus.toUpperCase()}".`);
  };

  const handleDeleteLeave = async (id: string) => {
    if (window.confirm('Hapus permohonan / jadwal cuti ini dari database?')) {
      const updated = leaveList.filter(l => l.id !== id);
      setLeaveList(updated);
      await deleteLeaveRequestFromDb(id);
      showToast('✓ Jadwal cuti berhasil dihapus dari database.');
    }
  };

  const filteredLeaveList = useMemo(() => {
    return leaveList.filter(l => {
      if (leaveStatusFilter !== 'all' && l.status !== leaveStatusFilter) return false;
      if (!leaveSearch) return true;
      const q = leaveSearch.toLowerCase();
      return (
        l.therapistName.toLowerCase().includes(q) ||
        l.leaveType.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q) ||
        (l.replacementStaff && l.replacementStaff.toLowerCase().includes(q))
      );
    });
  }, [leaveList, leaveSearch, leaveStatusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-1 sm:p-4 overflow-hidden">
      <div className="bg-white w-full max-w-5xl rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-full max-h-[96vh] sm:max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-2 sm:gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shadow-inner shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-base md:text-lg font-black tracking-tight text-white flex items-center gap-1.5 leading-tight truncate">
                <span className="truncate">Lain-Lain & Administrasi IRM</span>
                <span className="hidden md:inline-block text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded-full font-bold shrink-0">
                  Multi-Fitur
                </span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium truncate leading-tight mt-0.5">
                Kas Keuangan, Jadwal Rotasi, Pelayanan Sabtu & Cuti Staf IRM
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Tutup (ESC)"
            aria-label="Tutup Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="bg-slate-100/90 border-b border-slate-200/90 px-2 sm:px-6 flex items-center gap-1 sm:gap-2.5 overflow-x-auto custom-scrollbar pt-2 sm:pt-2.5 shrink-0">
          <button
            onClick={() => setActiveTab('kas')}
            id="tab-kas-irm"
            className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-lg sm:rounded-t-xl text-xs flex items-center gap-1.5 sm:gap-2.5 transition-all cursor-pointer border-t-2 border-x whitespace-nowrap shrink-0 ${
              activeTab === 'kas'
                ? 'bg-white text-emerald-950 font-black border-t-emerald-600 border-x-slate-200 shadow-xs translate-y-[1px] z-10'
                : 'bg-slate-200/40 hover:bg-white/80 text-slate-600 hover:text-slate-900 font-bold border-transparent hover:border-slate-200'
            }`}
          >
            <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center ${activeTab === 'kas' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/70 text-slate-500'}`}>
              <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <span className="tracking-tight hidden sm:inline">1. Laporan Kas IRM</span>
            <span className="tracking-tight sm:hidden">1. Kas IRM</span>
            <span className={`text-[9px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded font-bold border ${
              activeTab === 'kas' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300/80 shadow-2xs' 
                : 'bg-slate-200/80 text-slate-700 border-slate-300'
            }`}>
              {formatRupiah(overallBalance)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rotasi')}
            id="tab-rotasi-fisioterapis"
            className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-lg sm:rounded-t-xl text-xs flex items-center gap-1.5 sm:gap-2.5 transition-all cursor-pointer border-t-2 border-x whitespace-nowrap shrink-0 ${
              activeTab === 'rotasi'
                ? 'bg-white text-blue-950 font-black border-t-blue-600 border-x-slate-200 shadow-xs translate-y-[1px] z-10'
                : 'bg-slate-200/40 hover:bg-white/80 text-slate-600 hover:text-slate-900 font-bold border-transparent hover:border-slate-200'
            }`}
          >
            <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center ${activeTab === 'rotasi' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200/70 text-slate-500'}`}>
              <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <span className="tracking-tight hidden sm:inline">2. Jadwal Rotasi</span>
            <span className="tracking-tight sm:hidden">2. Rotasi</span>
            <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded font-bold border ${
              activeTab === 'rotasi' 
                ? 'bg-blue-50 text-blue-800 border-blue-300/80 shadow-2xs' 
                : 'bg-slate-200/80 text-slate-700 border-slate-300'
            }`}>
              Pos
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sabtu')}
            id="tab-sabtu-fisioterapis"
            className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-lg sm:rounded-t-xl text-xs flex items-center gap-1.5 sm:gap-2.5 transition-all cursor-pointer border-t-2 border-x whitespace-nowrap shrink-0 ${
              activeTab === 'sabtu'
                ? 'bg-white text-amber-950 font-black border-t-amber-600 border-x-slate-200 shadow-xs translate-y-[1px] z-10'
                : 'bg-slate-200/40 hover:bg-white/80 text-slate-600 hover:text-slate-900 font-bold border-transparent hover:border-slate-200'
            }`}
          >
            <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center ${activeTab === 'sabtu' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200/70 text-slate-500'}`}>
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <span className="tracking-tight hidden sm:inline">3. Jadwal Sabtu</span>
            <span className="tracking-tight sm:hidden">3. Sabtu</span>
            <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded font-bold border ${
              activeTab === 'sabtu' 
                ? 'bg-amber-50 text-amber-900 border-amber-300/80 shadow-2xs' 
                : 'bg-slate-200/80 text-slate-700 border-slate-300'
            }`}>
              Piket
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cuti')}
            id="tab-cuti-fisioterapis"
            className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-lg sm:rounded-t-xl text-xs flex items-center gap-1.5 sm:gap-2.5 transition-all cursor-pointer border-t-2 border-x whitespace-nowrap shrink-0 ${
              activeTab === 'cuti'
                ? 'bg-white text-teal-950 font-black border-t-teal-600 border-x-slate-200 shadow-xs translate-y-[1px] z-10'
                : 'bg-slate-200/40 hover:bg-white/80 text-slate-600 hover:text-slate-900 font-bold border-transparent hover:border-slate-200'
            }`}
          >
            <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center ${activeTab === 'cuti' ? 'bg-teal-100 text-teal-700' : 'bg-slate-200/70 text-slate-500'}`}>
              <CalendarDays className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <span className="tracking-tight hidden sm:inline">4. Jadwal Cuti Staf</span>
            <span className="tracking-tight sm:hidden">4. Cuti Staf</span>
            <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded font-bold border ${
              activeTab === 'cuti' 
                ? 'bg-teal-600 text-white border-teal-700 shadow-xs' 
                : 'bg-slate-200/80 text-slate-700 border-slate-300'
            }`}>
              Cuti
            </span>
          </button>
        </div>

        {/* Toast Notification Alert */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-3 sm:px-4 py-2 flex items-center justify-between animate-in slide-in-from-top shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-[11px] sm:text-xs">{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white cursor-pointer px-1">
              ✕
            </button>
          </div>
        )}

        {/* Main Tab Body */}
        <div className="p-2.5 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 smooth-scroll-container custom-scrollbar">
          {/* ========================================================================= */}
          {/* TAB 1: LAPORAN KAS KEUANGAN IRM & CEKLIST 12 BULAN PETUGAS */}
          {/* ========================================================================= */}
          {activeTab === 'kas' && (
            <div className="space-y-3.5 sm:space-y-5 animate-in fade-in duration-200">
              {/* Sub-Tab Navigation Switcher */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setKasSubTab('ceklist_petugas')}
                    className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-md text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                      kasSubTab === 'ceklist_petugas'
                        ? 'bg-white text-teal-800 shadow-2xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="hidden sm:inline">Tabel Ceklist Uang Kas 12 Bulan</span>
                    <span className="sm:hidden">Ceklist 12 Bulan</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold bg-teal-100 text-teal-800">
                      {totalStaffCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setKasSubTab('transaksi')}
                    className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-md text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                      kasSubTab === 'transaksi'
                        ? 'bg-white text-teal-800 shadow-2xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span className="hidden sm:inline">Buku Kas & Catatan Mutasi</span>
                    <span className="sm:hidden">Buku Kas Mutasi</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold bg-slate-200 text-slate-700">
                      {kasList.length}
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-semibold text-slate-600 px-1 sm:px-0">
                  <span className="text-[10px] sm:text-[11px] text-slate-500">Saldo Akhir:</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs sm:text-sm">
                    {formatRupiah(overallBalance)}
                  </span>
                </div>
              </div>

              {/* ------------------------------------------------------------------- */}
              {/* SUB-VIEW 1: TABEL CEKLIST 12 BULAN IURAN KAS PETUGAS */}
              {/* ------------------------------------------------------------------- */}
              {kasSubTab === 'ceklist_petugas' && (
                <div className="space-y-3 sm:space-y-4 animate-in fade-in">
                  {/* Password Protection & Edit Mode Status Banner */}
                  {!isKasUnlocked ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50 via-amber-50/80 to-slate-50 border-2 border-amber-300/80 p-3 sm:p-3.5 rounded-xl shadow-2xs">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="text-[11px] sm:text-xs font-black text-amber-950 uppercase tracking-wide">
                              Mode Lihat Saja (Read-Only)
                            </span>
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-200/90 text-amber-900 border border-amber-300">
                              Terkunci
                            </span>
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-amber-800 leading-tight mt-0.5">
                            Semua petugas dapat melihat laporan. Buka kunci untuk ceklist iuran kas.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setKasAuthInput('');
                          setKasAuthError('');
                          setIsKasAuthModalOpen(true);
                        }}
                        className="w-full sm:w-auto px-3.5 py-2 sm:py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Buka Kunci Edit Kas</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 border-2 border-emerald-400 p-3 sm:p-3.5 rounded-xl shadow-2xs animate-in fade-in">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs animate-pulse">
                          <Unlock className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="text-[11px] sm:text-xs font-black text-emerald-950 uppercase tracking-wide">
                              Mode Edit Aktif (Akses Bendahara)
                            </span>
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-200 text-emerald-900 border border-emerald-300">
                              Full Access
                            </span>
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-emerald-800 leading-tight mt-0.5">
                            Bebas mencentang status iuran, edit petugas, dan sinkronisasi ke buku kas.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCurrPasswordInput('');
                            setNewPasswordInput('');
                            setConfirmPasswordInput('');
                            setChangePasswordError('');
                            setIsChangePasswordOpen(true);
                          }}
                          className="flex-1 sm:flex-initial px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                          title="Ubah kata sandi bendahara kas"
                        >
                          <Key className="w-3.5 h-3.5 text-slate-500" />
                          <span>Ganti Password</span>
                        </button>
                        <button
                          onClick={handleLockKas}
                          className="flex-1 sm:flex-initial px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Kunci Kembali</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Summary Metric Cards for Staff Checklist */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Terkumpul {selectedKasYear}</span>
                        <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                      </div>
                      <div className="mt-1.5">
                        <div className="text-sm sm:text-lg md:text-xl font-black text-slate-900 font-mono truncate">
                          {formatRupiah(totalKasCollectedYear)}
                        </div>
                        <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-500 mt-0.5">
                          <span className="truncate">Target: {formatRupiah(totalKasTargetYear)}</span>
                          <span className="font-bold text-teal-700 ml-1 shrink-0">{completionPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="bg-teal-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, completionPercentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-emerald-50/60 p-2.5 sm:p-3.5 rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider truncate">Bulan Ini ({INDONESIAN_MONTHS[currentMonthNum - 1]})</span>
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                      </div>
                      <div className="mt-1.5">
                        <div className="text-sm sm:text-lg md:text-xl font-black text-emerald-700 font-mono truncate">
                          {totalPaidCurrentMonth} / {totalStaffCount} Petugas
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-emerald-600 mt-0.5 flex items-center justify-between">
                          <span>Sudah Bayar</span>
                          <span className="font-bold">{Math.round((totalPaidCurrentMonth / (totalStaffCount || 1)) * 100)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-teal-50/60 p-2.5 sm:p-3.5 rounded-xl border border-teal-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-[11px] font-bold text-teal-800 uppercase tracking-wider truncate">Iuran / Bulan</span>
                        <button
                          onClick={() => {
                            requireKasAuth(() => {
                              setTempNominalInput(String(nominalPerMonth));
                              setIsEditNominalOpen(true);
                            });
                          }}
                          className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Ubah Nominal Iuran Kas"
                        >
                          <Coins className="w-3 h-3 text-amber-700" />
                          <span>Ubah</span>
                        </button>
                      </div>
                      <div className="mt-1.5">
                        <div className="text-sm sm:text-lg md:text-xl font-black text-teal-700 font-mono truncate">
                          {formatRupiah(nominalPerMonth)}
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-teal-600 mt-0.5 block truncate">Wajib Tiap Petugas</span>
                      </div>
                    </div>

                    <div className="bg-slate-800 text-white p-2.5 sm:p-3.5 rounded-xl border border-slate-700 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">Status 1 Tahun</span>
                        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-300 shrink-0" />
                      </div>
                      <div className="mt-1.5">
                        <div className="text-sm sm:text-lg md:text-xl font-black text-teal-300 font-mono truncate">
                          {fullyPaidStaffCount} Petugas
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-slate-300 mt-0.5 block truncate">Lunas Penuh (12 Bln)</span>
                      </div>
                    </div>
                  </div>

                  {/* Toolbar & Filters */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {/* Year Selector */}
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <label className="text-[11px] font-bold text-slate-600">Thn:</label>
                        <select
                          value={selectedKasYear}
                          onChange={(e) => setSelectedKasYear(parseInt(e.target.value, 10))}
                          className="text-xs font-bold text-teal-800 bg-transparent focus:outline-none cursor-pointer"
                        >
                          <option value={2024}>2024</option>
                          <option value={2025}>2025</option>
                          <option value={2026}>2026</option>
                          <option value={2027}>2027</option>
                          <option value={2028}>2028</option>
                        </select>
                      </div>

                      {/* Change Dues Amount Button */}
                      <button
                        onClick={() => {
                          requireKasAuth(() => {
                            setTempNominalInput(String(nominalPerMonth));
                            setIsEditNominalOpen(true);
                          });
                        }}
                        className="px-2.5 sm:px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                        title="Ubah Besaran Nominal Iuran Kas Tiap Bulan"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>Ubah Jumlah Iuran</span>
                      </button>

                      {/* Add Staff Button */}
                      <button
                        onClick={() => setIsAddStaffOpen(true)}
                        className="px-2.5 sm:px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Petugas</span>
                      </button>

                      {/* Export PDF Button */}
                      <button
                        onClick={() => exportStaffKas12MonthsPDF(staffPayments, selectedKasYear, nominalPerMonth)}
                        className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Unduh Tabel Ceklist 12 Bulan dalam format PDF Lanskap"
                      >
                        <Download className="w-3.5 h-3.5 text-teal-300" />
                        <span className="hidden sm:inline">Cetak PDF 12 Bulan</span>
                        <span className="sm:hidden">Cetak PDF</span>
                      </button>

                      {/* Sync to Cashbook Button */}
                      <button
                        onClick={() => handleSyncMonthToTransactions(currentMonthNum)}
                        className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Catat Iuran Bulan Ini ke Mutasi Buku Kas"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Catat Iuran Bln Ini ke Buku Kas</span>
                        <span className="sm:hidden">Catat ke Buku Kas</span>
                      </button>

                      {/* Reset Therapist Roster */}
                      <button
                        onClick={handleResetStaffTherapists}
                        className="px-2 sm:px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                        title="Reset & muat ulang daftar nama terapis resmi IRM ke tabel iuran"
                      >
                        <RotateCcw className="w-3 h-3 text-sky-600" />
                        <span>Reset Terapis</span>
                      </button>

                      {/* Reset / Bersihkan Semua Data Kas Menjadi Nol */}
                      <button
                        onClick={handleResetAllKasToZero}
                        className="px-2 sm:px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                        title="Bersihkan seluruh angka laporan kas & buat menjadi 0 (Nol) untuk pengisian manual"
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                        <span>Reset Angka (Nol-kan)</span>
                      </button>
                    </div>

                    {/* Search & Status Filter */}
                    <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-52">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Cari nama petugas..."
                          value={staffSearchQuery}
                          onChange={(e) => setStaffSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <select
                        value={staffStatusFilter}
                        onChange={(e) => setStaffStatusFilter(e.target.value as any)}
                        className="px-2 sm:px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                      >
                        <option value="all">Semua ({staffPayments.length})</option>
                        <option value="lunas">Lunas ({fullyPaidStaffCount})</option>
                        <option value="berjalan">Berjalan ({staffPayments.filter(p => {
                          const c = Object.values(p.months).filter(Boolean).length;
                          return c > 0 && c < 12;
                        }).length})</option>
                        <option value="belum">Belum ({staffPayments.filter(p => Object.values(p.months).filter(Boolean).length === 0).length})</option>
                      </select>
                    </div>
                  </div>

                  {/* Add Staff Inline Modal */}
                  {isAddStaffOpen && (
                    <form onSubmit={handleAddStaffMember} className="bg-teal-50/70 p-4 rounded-xl border-2 border-teal-500/40 shadow-sm space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
                        <h4 className="text-xs font-black text-teal-900 flex items-center gap-2">
                          <Users className="w-4 h-4 text-teal-700" />
                          <span>Tambah Petugas / Fisioterapis ke Daftar Iuran Kas {selectedKasYear}</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setIsAddStaffOpen(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Nama Lengkap & Gelar Petugas</label>
                          <input
                            type="text"
                            placeholder="Contoh: dr. Spesialis KFR / Fisioterapis..."
                            value={newStaffName}
                            onChange={(e) => setNewStaffName(e.target.value)}
                            required
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Pilih dari Daftar Kotak</label>
                          <select
                            onChange={(e) => {
                              if (e.target.value) setNewStaffName(e.target.value);
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 cursor-pointer"
                          >
                            <option value="">-- Pilih Rekomendasi Petugas --</option>
                            {therapists.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddStaffOpen(false)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Simpan Petugas
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Edit Nominal Inline Modal */}
                  {isEditNominalOpen && (
                    <form onSubmit={handleSaveNominal} className="bg-amber-50/80 p-4 rounded-xl border-2 border-amber-500/50 shadow-md space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                        <h4 className="text-xs font-black text-amber-900 flex items-center gap-2">
                          <Coins className="w-4 h-4 text-amber-700" />
                          <span>Atur / Ubah Jumlah Iuran Kas Bulanan ({selectedKasYear})</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setIsEditNominalOpen(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Quick Presets */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Pilihan Cepat Nominal:</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[20000, 30000, 50000, 75000, 100000].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setTempNominalInput(String(val))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                parseInt(tempNominalInput, 10) === val
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                  : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/60'
                              }`}
                            >
                              {formatRupiah(val)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Nominal Iuran per Petugas per Bulan (Rp)</label>
                          <input
                            type="number"
                            value={tempNominalInput}
                            onChange={(e) => setTempNominalInput(e.target.value)}
                            required
                            min="5000"
                            step="5000"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-amber-200">
                          Total target iuran per tahun ({totalStaffCount} petugas): <strong className="text-teal-800 font-mono">{formatRupiah((parseInt(tempNominalInput, 10) || 0) * totalStaffCount * 12)}</strong>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditNominalOpen(false)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Terapkan Nominal Baru
                        </button>
                      </div>
                    </form>
                  )}

                  {/* 12-MONTH INTERACTIVE CHECKLIST TABLE */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-teal-400 shrink-0" />
                        <span className="truncate">TABEL CEKLIST UANG KAS ({selectedKasYear})</span>
                      </div>
                      <div className="flex items-center gap-2.5 sm:gap-3 text-[10px] sm:text-[11px] text-slate-300 font-normal">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded bg-emerald-500 inline-block text-[9px] text-white text-center font-bold">✓</span>
                          <span>Lunas</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded bg-slate-200 inline-block text-[9px] text-slate-600 text-center font-bold">-</span>
                          <span>Belum</span>
                        </span>
                        <span className="text-teal-300 font-semibold font-mono hidden sm:inline">
                          Iuran: {formatRupiah(nominalPerMonth)}/Bln
                        </span>
                      </div>
                    </div>

                    {/* Mobile swipe hint banner */}
                    <div className="sm:hidden flex items-center justify-between px-3 py-1.5 bg-teal-50 border-b border-teal-200/60 text-[10px] text-teal-900 font-medium">
                      <span className="flex items-center gap-1">
                        <span>👉</span>
                        <span>Geser tabel ke kanan untuk ceklist 12 bulan</span>
                      </span>
                      <span className="font-mono font-bold text-teal-700 bg-white px-1.5 py-0.5 rounded border border-teal-200">
                        12 Bulan
                      </span>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 border-b border-slate-300 text-slate-700 font-bold text-[11px]">
                            <th className="py-2.5 px-2 w-8 text-center border-r border-slate-200">No</th>
                            <th className="py-2.5 px-3 min-w-[170px] sm:min-w-[200px] border-r border-slate-200 sticky left-0 bg-slate-100/95 z-20 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                              Nama Petugas / Fisioterapis
                            </th>
                            {INDONESIAN_SHORT_MONTHS.map((mShort, idx) => {
                              const monthNum = idx + 1;
                              const isCurrent = monthNum === currentMonthNum;
                              const monthPaidCount = staffPayments.filter(p => !!p.months[monthNum]).length;
                              return (
                                <th
                                  key={mShort}
                                  className={`py-2 px-1 text-center w-11 border-r border-slate-200 group relative ${
                                    isCurrent ? 'bg-teal-50 text-teal-900 font-black' : ''
                                  }`}
                                  title={`Bulan ${INDONESIAN_MONTHS[idx]} - Klik opsi untuk tandai semua`}
                                >
                                  <div className="flex flex-col items-center">
                                    <span>{mShort}</span>
                                    <span className="text-[9px] font-normal text-slate-400 font-mono">
                                      {monthPaidCount}/{totalStaffCount}
                                    </span>
                                    {/* Mini action to bulk check/uncheck */}
                                    <div className="flex items-center gap-0.5 mt-0.5 opacity-60 hover:opacity-100">
                                      <button
                                        onClick={() => handleMarkMonthAllStaff(monthNum, true)}
                                        className="text-[8px] px-1 py-0.2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold cursor-pointer"
                                        title={`Tandai SEMUA lunas di bulan ${mShort}`}
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={() => handleMarkMonthAllStaff(monthNum, false)}
                                        className="text-[8px] px-1 py-0.2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold cursor-pointer"
                                        title={`Reset SEMUA jadi belum bayar di bulan ${mShort}`}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                </th>
                              );
                            })}
                            <th className="py-2.5 px-2 text-center w-16 sm:w-20 border-r border-slate-200">Total Bln</th>
                            <th className="py-2.5 px-2.5 sm:px-3 text-right w-24 sm:w-28 border-r border-slate-200">Total Kas</th>
                            <th className="py-2.5 px-2 text-center w-20 sm:w-24 border-r border-slate-200">Status</th>
                            <th className="py-2.5 px-2 text-center w-20">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredStaffPayments.length === 0 ? (
                            <tr>
                              <td colSpan={18} className="py-8 text-center text-slate-400 text-xs">
                                Tidak ada petugas yang sesuai dengan pencarian atau filter status.
                              </td>
                            </tr>
                          ) : (
                            filteredStaffPayments.map((staff, idx) => {
                              const paidMonthsCount = Object.values(staff.months).filter(Boolean).length;
                              const totalStaffPaid = paidMonthsCount * (staff.nominalPerMonth || nominalPerMonth);
                              const isAllPaid = paidMonthsCount === 12;

                              return (
                                <tr key={staff.id} className="hover:bg-teal-50/30 transition-colors">
                                  {/* No */}
                                  <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100">
                                    {idx + 1}
                                  </td>

                                  {/* Staff Name - Sticky on horizontal scroll */}
                                  <td className="py-2 px-2.5 sm:px-3 border-r border-slate-100 sticky left-0 bg-white z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center justify-between gap-1.5 sm:gap-2 group">
                                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[9px] sm:text-[10px] shrink-0 border border-teal-200">
                                          {staff.staffName.slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                          <span className="font-bold text-slate-800 text-xs leading-tight block truncate max-w-[120px] sm:max-w-none">
                                            {staff.staffName}
                                          </span>
                                          {staff.nominalPerMonth && staff.nominalPerMonth !== nominalPerMonth && (
                                            <span className="text-[8px] sm:text-[9px] text-amber-700 font-mono font-semibold block truncate">
                                              Tarif: {formatRupiah(staff.nominalPerMonth)}/bln
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleOpenEditStaff(staff)}
                                        className="opacity-70 group-hover:opacity-100 hover:bg-teal-100 text-teal-700 p-1 rounded transition-colors duration-75 cursor-pointer shrink-0"
                                        title={`Edit Data Terapis: ${staff.staffName}`}
                                        aria-label={`Edit ${staff.staffName}`}
                                      >
                                        <Edit2 className="w-3 h-3 text-teal-700" />
                                      </button>
                                    </div>
                                  </td>

                                  {/* 12 Months Checkboxes */}
                                  {INDONESIAN_SHORT_MONTHS.map((_, mIdx) => {
                                    const monthNum = mIdx + 1;
                                    const isPaid = !!staff.months[monthNum];
                                    const isCurrent = monthNum === currentMonthNum;

                                    return (
                                      <td
                                        key={monthNum}
                                        className={`py-1.5 px-1 text-center border-r border-slate-100 ${
                                          isCurrent ? 'bg-teal-50/50' : ''
                                        }`}
                                      >
                                        <button
                                          onClick={() => handleToggleStaffMonth(staff.id, monthNum)}
                                          className={`w-7 h-7 rounded-md text-xs font-bold transition-colors duration-75 flex items-center justify-center mx-auto cursor-pointer ${
                                            isPaid
                                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white ring-1 ring-emerald-600'
                                              : 'bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 border border-slate-200'
                                          }`}
                                          title={`${staff.staffName} - Bulan ${INDONESIAN_MONTHS[mIdx]}: ${isPaid ? 'LUNAS (Klik untuk batalkan)' : 'BELUM BAYAR (Klik untuk tandai lunas)'}`}
                                        >
                                          {isPaid ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '-'}
                                        </button>
                                      </td>
                                    );
                                  })}

                                  {/* Total Months */}
                                  <td className="py-2 px-2 text-center border-r border-slate-100">
                                    <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold font-mono ${
                                      isAllPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {paidMonthsCount}/12
                                    </span>
                                  </td>

                                  {/* Total Amount Paid */}
                                  <td className="py-2 px-2 sm:px-3 text-right font-mono font-bold text-teal-700 text-[11px] sm:text-xs border-r border-slate-100">
                                    {formatRupiah(totalStaffPaid)}
                                  </td>

                                  {/* Status Badge */}
                                  <td className="py-2 px-1.5 sm:px-2 text-center border-r border-slate-100">
                                    {isAllPaid ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                                        <span>Lunas</span>
                                      </span>
                                    ) : paidMonthsCount > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                        <span>Berjalan</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                        <span>Belum</span>
                                      </span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="py-2 px-1 sm:px-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => handleOpenEditStaff(staff)}
                                        className="p-1 rounded text-teal-700 hover:text-teal-900 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer"
                                        title={`Edit Data Terapis: ${staff.staffName}`}
                                        aria-label={`Edit ${staff.staffName}`}
                                      >
                                        <Edit2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleToggleStaffAllMonths(staff.id, !isAllPaid)}
                                        className={`p-1 rounded text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer ${
                                          isAllPaid
                                            ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                            : 'text-emerald-700 hover:bg-emerald-100'
                                        }`}
                                        title={isAllPaid ? 'Reset semua bulan jadi belum bayar' : 'Tandai lunas penuh 12 bulan'}
                                      >
                                        {isAllPaid ? 'Reset' : '12B'}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteStaffMember(staff.id, staff.staffName)}
                                        className="p-1 text-slate-300 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                        title="Hapus dari daftar tabel"
                                      >
                                        <Trash2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>

                        {/* Table Footer: Column Summaries */}
                        <tfoot>
                          <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-700">
                            <td colSpan={2} className="py-3 px-3 text-right uppercase tracking-wider text-[10px] sm:text-[11px] text-teal-300 border-r border-slate-700 sticky left-0 bg-slate-900 z-20">
                              TOTAL PETUGAS LUNAS:
                            </td>
                            {INDONESIAN_SHORT_MONTHS.map((_, mIdx) => {
                              const monthNum = mIdx + 1;
                              const count = staffPayments.filter(p => !!p.months[monthNum]).length;
                              const isAll = count === totalStaffCount && totalStaffCount > 0;
                              return (
                                <td key={monthNum} className="py-3 px-1 text-center font-mono border-r border-slate-700">
                                  <div className="flex flex-col items-center">
                                    <span className={isAll ? 'text-emerald-400 font-black' : 'text-slate-200'}>
                                      {count}
                                    </span>
                                    <span className="text-[8px] text-slate-400">
                                      {Math.round((count / (totalStaffCount || 1)) * 100)}%
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="py-3 px-2 text-center font-mono text-teal-300 border-r border-slate-700">
                              {totalPaidMonthsAllStaff} Bln
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-emerald-400 text-xs font-black border-r border-slate-700">
                              {formatRupiah(totalKasCollectedYear)}
                            </td>
                            <td colSpan={2} className="py-3 px-2 text-center text-[10px] text-slate-300">
                              {completionPercentage}% Target
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* SUB-VIEW 2: BUKU KAS & MUTASI TRANSAKSI */}
              {/* ------------------------------------------------------------------- */}
              {kasSubTab === 'transaksi' && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Saldo Kas Saat Ini</span>
                      <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
                        {formatRupiah(overallBalance)}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">Kas Instalasi Rehabilitasi Medis</span>
                    </div>

                    <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Total Pemasukan (+)</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1 font-mono">
                        {formatRupiah(totalIn)}
                      </div>
                      <span className="text-[10px] text-emerald-600 mt-1 block">Iuran bulanan & dana masuk</span>
                    </div>

                    <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">Total Pengeluaran (-)</span>
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1 font-mono">
                        {formatRupiah(totalOut)}
                      </div>
                      <span className="text-[10px] text-rose-600 mt-1 block">Konsumsi, ATK, operasional & logistik</span>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setKasType('in');
                          setKasCategory('Iuran Kas Bulanan');
                          setIsKasFormOpen(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Catat Pemasukan</span>
                      </button>

                      <button
                        onClick={() => {
                          setKasType('out');
                          setKasCategory('Konsumsi / Snack');
                          setIsKasFormOpen(true);
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>- Catat Pengeluaran</span>
                      </button>

                      <button
                        onClick={() => exportKasReportPDF(filteredKas, overallBalance, totalIn, totalOut, kasFilterMonth)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Unduh PDF Laporan Kas"
                      >
                        <Download className="w-3.5 h-3.5 text-teal-300" />
                        <span>Cetak PDF Kas</span>
                      </button>

                      <button
                        onClick={handleResetAllKasToZero}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                        title="Bersihkan seluruh angka laporan kas & buat menjadi 0 (Nol) untuk pengisian manual"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Reset Angka (Nol-kan)</span>
                      </button>
                    </div>

                    {/* Filter & Search */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          placeholder="Cari transaksi / keterangan..."
                          value={kasSearchQuery}
                          onChange={(e) => setKasSearchQuery(e.target.value)}
                          className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 w-44 sm:w-56"
                        />
                      </div>

                      <input
                        type="month"
                        value={kasFilterMonth}
                        onChange={(e) => setKasFilterMonth(e.target.value)}
                        className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        title="Filter Bulan"
                      />
                      {kasFilterMonth && (
                        <button
                          onClick={() => setKasFilterMonth('')}
                          className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form Input Kas (Modal / Drawer Inline) */}
                  {isKasFormOpen && (
                    <form onSubmit={handleAddKas} className="bg-white p-4 sm:p-5 rounded-xl border-2 border-teal-500/40 shadow-md space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${kasType === 'in' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{kasType === 'in' ? 'Formulir Catat Pemasukan Kas' : 'Formulir Catat Pengeluaran Kas'}</span>
                        </h3>
                        <button
                          type="button"
                          onClick={() => setIsKasFormOpen(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs"
                        >
                          Batal
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Tanggal Transaksi</label>
                          <input
                            type="date"
                            value={kasDate}
                            onChange={(e) => setKasDate(e.target.value)}
                            required
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Kategori</label>
                          <select
                            value={kasCategory}
                            onChange={(e) => setKasCategory(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          >
                            {kasType === 'in' ? (
                              <>
                                <option value="Iuran Kas Bulanan">Iuran Kas Bulanan Staf</option>
                                <option value="Saldo Awal Kas">Saldo Awal Kas</option>
                                <option value="Donasi / Sumbangan">Donasi / Sumbangan</option>
                                <option value="Pengembalian Dana">Pengembalian Dana</option>
                                <option value="Lain-lain">Lain-lain</option>
                              </>
                            ) : (
                              <>
                                <option value="Konsumsi / Snack">Konsumsi / Snack / Air Minum</option>
                                <option value="ATK & Logistik">ATK & Kertas Struk Antrean</option>
                                <option value="Operasional Poli">Operasional & Perlengkapan Poli</option>
                                <option value="Sosial / Santunan">Sosial / Santunan / Duka</option>
                                <option value="Pemeliharaan Alat">Pemeliharaan / Servis Alat</option>
                                <option value="Lain-lain">Lain-lain</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Nominal (Rupiah)</label>
                          <input
                            type="number"
                            placeholder="Contoh: 150000"
                            value={kasAmount}
                            onChange={(e) => setKasAmount(e.target.value)}
                            required
                            min="1"
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Uraian / Keterangan Lengkap</label>
                          <input
                            type="text"
                            placeholder="Uraikan peruntukan transaksi secara jelas..."
                            value={kasDescription}
                            onChange={(e) => setKasDescription(e.target.value)}
                            required
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Petugas Pencatat / Bendahara</label>
                          <select
                            value={kasRecordedBy}
                            onChange={(e) => setKasRecordedBy(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          >
                            <option value="Bendahara IRM">Bendahara IRM</option>
                            {therapists.map(th => (
                              <option key={th} value={th}>{th}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsKasFormOpen(false)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className={`px-4 py-1.5 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer ${
                            kasType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                          }`}
                        >
                          Simpan Transaksi Kas
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Transactions Table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Daftar Mutasi Kas ({filteredKas.length} Transaksi)</span>
                      <span className="text-[11px] text-slate-500">Urut berdasarkan tanggal terbaru</span>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                            <th className="py-2.5 px-3 w-10 text-center">No</th>
                            <th className="py-2.5 px-3 w-28">Tanggal</th>
                            <th className="py-2.5 px-3">Uraian / Keterangan</th>
                            <th className="py-2.5 px-3 w-36">Kategori</th>
                            <th className="py-2.5 px-3 w-32">Pencatat</th>
                            <th className="py-2.5 px-3 w-32 text-right">Pemasukan</th>
                            <th className="py-2.5 px-3 w-32 text-right">Pengeluaran</th>
                            <th className="py-2.5 px-3 w-14 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredKas.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                                Belum ada catatan mutasi kas pada filter ini.
                              </td>
                            </tr>
                          ) : (
                            filteredKas.map((t, idx) => (
                              <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                                  {formatIndonesianDate(t.date, false)}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{t.description}</span>
                                    {t.id.startsWith('kas-tx-staff-') && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200" title="Tercatat otomatis dari tabel ceklist 12 bulan">
                                        <CheckSquare className="w-2.5 h-2.5 text-teal-600" />
                                        <span>Ceklist Otomatis</span>
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    {t.category}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-600 text-[11px]">
                                  {t.recordedBy}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                                  {t.type === 'in' ? formatRupiah(t.amount) : '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                                  {t.type === 'out' ? formatRupiah(t.amount) : '-'}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    onClick={() => handleDeleteKas(t.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                                    title="Hapus catatan mutasi kas ini"
                                    aria-label="Hapus catatan transaksi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ========================================================================= */}
          {/* TAB 2: JADWAL ROTASI FISIOTERAPIS */}
          {/* ========================================================================= */}
          {activeTab === 'rotasi' && (
            <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
              {/* Header Selector & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                  <label className="text-xs font-bold text-slate-700">Pilih Periode Rotasi:</label>
                  <select
                    value={selectedRotationIndex}
                    onChange={(e) => setSelectedRotationIndex(parseInt(e.target.value, 10))}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    {rotationList.map((rot, idx) => (
                      <option key={rot.id} value={idx}>
                        {rot.periodName} ({rot.periodMonth})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleGenerateAutoRotation}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Buat jadwal rotasi bulan depan otomatis bergiliran"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>+ Generate Rotasi Otomatis</span>
                  </button>

                  {currentRotation && (
                    <button
                      onClick={() => handleOpenEditRotation(currentRotation)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-300" />
                      <span>Ubah Pos / Shift</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Current Rotation View Matrix */}
              {currentRotation ? (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                          <Building className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{currentRotation.periodName}</span>
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                          Rentang Berlaku: {formatIndonesianDate(currentRotation.startDate, false)} s/d {formatIndonesianDate(currentRotation.endDate, false)}
                        </p>
                      </div>
                      <span className="self-start sm:self-auto text-[10px] sm:text-[11px] bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full font-bold">
                        {currentRotation.assignments.length} Fisioterapis Terjadwal
                      </span>
                    </div>

                    {/* Cards Grid for Stations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentRotation.assignments.map((asg, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/20 transition-colors duration-75 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Posisi #{idx + 1}
                              </span>
                              <span className="text-[10px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                                {asg.shiftNotes || 'Pagi'}
                              </span>
                            </div>
                            <h4 className="text-xs font-black text-blue-900 mt-1 leading-snug">
                              {asg.station}
                            </h4>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                              {asg.therapistName.charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">
                                {asg.therapistName}
                              </span>
                              <span className="text-[10px] text-slate-500">Petugas Bertanggung Jawab</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {currentRotation.notes && (
                      <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold">Catatan Khusus Rotasi: </strong>
                          <span>{currentRotation.notes}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-xl text-center text-slate-400 text-xs">
                  Belum ada jadwal rotasi. Klik <strong>+ Generate Rotasi Otomatis</strong> untuk membuat.
                </div>
              )}

              {/* Modal Edit Rotasi */}
              {isEditRotationOpen && (
                <form onSubmit={handleSaveRotation} className="bg-white p-4 sm:p-5 rounded-xl border-2 border-blue-500/40 shadow-md space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-black text-slate-900">Ubah Posisi Rotasi Fisioterapis</h3>
                    <button
                      type="button"
                      onClick={() => setIsEditRotationOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Judul / Nama Periode</label>
                      <input
                        type="text"
                        value={editRotationTitle}
                        onChange={(e) => setEditRotationTitle(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Catatan Tambahan</label>
                      <input
                        type="text"
                        value={editRotationNotes}
                        onChange={(e) => setEditRotationNotes(e.target.value)}
                        placeholder="Contoh: Pertukaran pos atas koordinasi..."
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[11px] font-bold text-slate-700 block">Penugasan Fisioterapis per Pos:</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {editAssignments.map((asg, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 items-center">
                          <span className="text-xs font-bold text-blue-900">{asg.station}</span>
                          <select
                            value={asg.therapistName}
                            onChange={(e) => {
                              const newArr = [...editAssignments];
                              newArr[idx].therapistName = e.target.value;
                              setEditAssignments(newArr);
                            }}
                            className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-semibold"
                          >
                            {therapists.map(th => (
                              <option key={th} value={th}>{th}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={asg.shiftNotes || ''}
                            onChange={(e) => {
                              const newArr = [...editAssignments];
                              newArr[idx].shiftNotes = e.target.value;
                              setEditAssignments(newArr);
                            }}
                            placeholder="Catatan shift (misal: Pagi)"
                            className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditRotationOpen(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: JADWAL SABTU FISIOTERAPIS */}
          {/* ========================================================================= */}
          {activeTab === 'sabtu' && (
            <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
              {/* Header & Generator Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">Pilih Bulan:</label>
                  <input
                    type="month"
                    value={saturdayMonthFilter}
                    onChange={(e) => setSaturdayMonthFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                  <button
                    onClick={() => handleAutoGenerateSaturdays(saturdayMonthFilter)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Generate jadwal Sabtu otomatis untuk bulan ini"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Auto-Generate</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    setEditingSaturdayId(null);
                    setSatDate('');
                    setSatNotes('');
                    setIsSaturdayFormOpen(true);
                  }}
                  className="w-full sm:w-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah / Atur Jadwal Sabtu</span>
                </button>
              </div>

              {/* Saturday Form Drawer */}
              {isSaturdayFormOpen && (
                <form onSubmit={handleSaveSaturday} className="bg-white p-4 sm:p-5 rounded-xl border-2 border-amber-500/40 shadow-md space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-black text-slate-900">
                      {editingSaturdayId ? 'Edit Jadwal Sabtu' : 'Tambah Jadwal Hari Sabtu'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsSaturdayFormOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Tanggal Hari Sabtu</label>
                      <input
                        type="date"
                        value={satDate}
                        onChange={(e) => setSatDate(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Petugas Utama</label>
                      <select
                        value={satPrimary}
                        onChange={(e) => setSatPrimary(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                      >
                        {therapists.map(th => (
                          <option key={th} value={th}>{th}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Petugas Pendamping</label>
                      <select
                        value={satAssistant}
                        onChange={(e) => setSatAssistant(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                      >
                        <option value="">- Tanpa Pendamping -</option>
                        {therapists.map(th => (
                          <option key={th} value={th}>{th}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Jam Pelayanan</label>
                      <input
                        type="text"
                        value={satHours}
                        onChange={(e) => setSatHours(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Status Pelayanan</label>
                      <select
                        value={satStatus}
                        onChange={(e) => setSatStatus(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                      >
                        <option value="scheduled">Terjadwal</option>
                        <option value="completed">Selesai</option>
                        <option value="swapped">Tukar Jadwal</option>
                        <option value="cancelled">Dibatalkan</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Catatan / Petugas Pengganti</label>
                      <input
                        type="text"
                        value={satNotes}
                        onChange={(e) => setSatNotes(e.target.value)}
                        placeholder="Contoh: Tukar dengan..."
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsSaturdayFormOpen(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Simpan Jadwal Sabtu
                    </button>
                  </div>
                </form>
              )}

              {/* Saturday Duty List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSaturdayList.length === 0 ? (
                  <div className="col-span-full bg-white p-8 rounded-xl text-center text-slate-400 text-xs">
                    Belum ada jadwal Sabtu untuk bulan ini. Klik <strong>Auto-Generate</strong> di atas.
                  </div>
                ) : (
                  filteredSaturdayList.map((sat) => (
                    <div
                      key={sat.id}
                      className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-400 transition-colors duration-75 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            <span>{formatIndonesianDate(sat.date)}</span>
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sat.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sat.status === 'swapped'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sat.status === 'completed' ? 'Selesai' : sat.status === 'swapped' ? 'Tukar' : 'Terjadwal'}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2 text-xs">
                          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-bold">
                              1
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Petugas Utama</span>
                              <span className="font-bold text-slate-900">{sat.primaryTherapist}</span>
                            </div>
                          </div>

                          {sat.assistantTherapist && (
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <div className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center text-[11px] font-bold">
                                2
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-semibold">Petugas Pendamping</span>
                                <span className="font-bold text-slate-900">{sat.assistantTherapist}</span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span className="font-mono">{sat.shiftHours}</span>
                            <span>{sat.supervisor}</span>
                          </div>

                          {sat.notes && (
                            <p className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded">
                              {sat.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setEditingSaturdayId(sat.id);
                            setSatDate(sat.date);
                            setSatPrimary(sat.primaryTherapist);
                            setSatAssistant(sat.assistantTherapist || '');
                            setSatSupervisor(sat.supervisor || 'dr. Sp.KFR');
                            setSatHours(sat.shiftHours);
                            setSatStatus(sat.status);
                            setSatNotes(sat.notes || '');
                            setIsSaturdayFormOpen(true);
                          }}
                          className="text-[11px] text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Tukar / Edit</span>
                        </button>

                        <button
                          onClick={() => handleDeleteSaturday(sat.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Hapus jadwal Sabtu ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: JADWAL CUTI FISIOTERAPIS (INTERACTIVE MULTI-DATE PICKER) */}
          {/* ========================================================================= */}
          {activeTab === 'cuti' && (
            <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
              {/* Top Banner Guide */}
              <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-3.5 sm:p-5 rounded-2xl shadow-md border border-teal-700/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-400/20 text-teal-300 border border-teal-400/40 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                        <span>Sistem Pengajuan & Jadwal Cuti Staf</span>
                        <span className="text-[9px] sm:text-[10px] bg-teal-400 text-slate-950 font-black px-2 py-0.5 rounded-full">
                          Interaktif
                        </span>
                      </h3>
                      <p className="text-[11px] sm:text-xs text-teal-100/90 mt-0.5 leading-tight">
                        Pilih nama staf, klik tanggal pada kalender, sistem otomatis membuat list tanggal dan verifikasi rencana cuti.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => exportLeaveReportPDF(leaveList)}
                    className="self-start sm:self-auto px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-300" />
                    <span>Cetak Rekap Cuti (PDF)</span>
                  </button>
                </div>
              </div>

              {/* Leave Creation Section (2 Columns: Left = Interactive Calendar, Right = Form & Dynamic List) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
                {/* LEFT COLUMN: INTERACTIVE MULTI-DATE CALENDAR (7 COLS) */}
                <div className="lg:col-span-7 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 sm:space-y-4">
                  {/* Calendar Navigation Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        {calendarViewMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const prev = new Date(calendarViewMonth);
                          prev.setMonth(prev.getMonth() - 1);
                          setCalendarViewMonth(prev);
                        }}
                        className="p-1 sm:p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors"
                        title="Bulan Sebelumnya"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          setCalendarViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                        }}
                        className="px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                      >
                        Bulan Ini
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const next = new Date(calendarViewMonth);
                          next.setMonth(next.getMonth() + 1);
                          setCalendarViewMonth(next);
                        }}
                        className="p-1 sm:p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors"
                        title="Bulan Berikutnya"
                      >
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Instructions & Legend */}
                  <div className="flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] text-slate-500 gap-2 bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-100">
                    <span className="font-semibold text-slate-700">
                      💡 Klik tanggal untuk memilih/batal cuti:
                    </span>
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                        <span>Dipilih ({selectedDates.length})</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                        <span>Staf Lain</span>
                      </span>
                    </div>
                  </div>

                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-[11px] font-black text-slate-500">
                    <div className="py-1">Sen</div>
                    <div className="py-1">Sel</div>
                    <div className="py-1">Rab</div>
                    <div className="py-1">Kam</div>
                    <div className="py-1">Jum</div>
                    <div className="py-1 text-amber-600">Sab</div>
                    <div className="py-1 text-rose-600">Min</div>
                  </div>

                  {/* Calendar Grid Tiles */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {calendarDays.map((day, idx) => {
                      if (!day.isCurrentMonth) {
                        return <div key={`empty-${idx}`} className="h-9 sm:h-11 rounded-lg sm:rounded-xl bg-slate-50/50" />;
                      }

                      const isSelected = selectedDates.includes(day.dateStr);
                      const isOthersOnLeave = existingLeaveDatesMap.has(day.dateStr);
                      const othersCount = existingLeaveDatesMap.get(day.dateStr)?.length || 0;

                      return (
                        <button
                          key={day.dateStr}
                          type="button"
                          onClick={() => handleToggleDate(day.dateStr)}
                          className={`h-9 sm:h-11 rounded-lg sm:rounded-xl font-mono text-xs font-bold flex flex-col items-center justify-center relative transition-colors duration-75 cursor-pointer border ${
                            isSelected
                              ? 'bg-teal-600 text-white border-teal-700 shadow-sm ring-2 ring-teal-400/50 z-10'
                              : isOthersOnLeave
                              ? 'bg-amber-50/80 text-amber-950 border-amber-200 hover:bg-amber-100'
                              : day.isWeekend
                              ? 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                              : 'bg-white text-slate-800 border-slate-200 hover:border-teal-400 hover:bg-teal-50/30'
                          }`}
                          title={`Klik untuk ${isSelected ? 'batalkan' : 'pilih'} tanggal ${formatIndonesianDate(day.dateStr)}`}
                        >
                          <span className="text-xs sm:text-sm font-black">{day.dayNumber}</span>
                          {isSelected ? (
                            <span className="text-[8px] sm:text-[9px] font-sans font-bold leading-none text-teal-100">
                              ✓ Cuti
                            </span>
                          ) : isOthersOnLeave ? (
                            <span className="text-[8px] sm:text-[9px] font-sans font-bold leading-none text-amber-700">
                              {othersCount} Cuti
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().slice(0, 10);
                          if (!selectedDates.includes(today)) {
                            setSelectedDates(prev => [...prev, today].sort());
                          }
                        }}
                        className="px-2 sm:px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer"
                      >
                        + Hari Ini
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          const dates: string[] = [];
                          for (let i = 0; i < 3; i++) {
                            const d = new Date(today);
                            d.setDate(today.getDate() + i);
                            dates.push(d.toISOString().slice(0, 10));
                          }
                          setSelectedDates(dates);
                        }}
                        className="px-2 sm:px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer"
                      >
                        + 3 Hari Kerja
                      </button>
                    </div>

                    {selectedDates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDates([])}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                      >
                        Reset Pilihan
                      </button>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: DYNAMIC LIST & SUBMISSION FORM (5 COLS) */}
                <div className="lg:col-span-5 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3 sm:space-y-4">
                  <form onSubmit={handleSubmitLeave} className="space-y-3">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-teal-600" />
                        <span>Formulir Pengajuan Cuti</span>
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">Lengkapi data petugas & konfirmasi rencana cuti</p>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Nama Staf Fisioterapis <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={leaveTherapist}
                        onChange={(e) => setLeaveTherapist(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
                      >
                        {therapists.map(th => (
                          <option key={th} value={th}>{th}</option>
                        ))}
                      </select>
                    </div>

                    {/* SALDO KUOTA CUTI TAHUNAN CARD */}
                    {leaveTherapist && (
                      <div className="p-2.5 bg-gradient-to-br from-teal-50/90 to-emerald-50/70 rounded-xl border border-teal-200/90">
                        <div className="flex items-center justify-between text-[10px] font-bold text-teal-900 mb-1.5">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                            <span>Saldo Kuota Cuti Tahunan {currentLeaveYear}</span>
                          </span>
                          <span className="font-mono text-teal-700">Maks. 12 Hari/Th</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="bg-white/90 p-1.5 rounded-lg border border-teal-100 shadow-2xs">
                            <span className="text-[9px] text-slate-500 block font-medium">Terpakai</span>
                            <span className="text-xs font-black text-slate-800 font-mono">
                              {therapistLeaveBalance.usedDays} Hari
                            </span>
                          </div>
                          <div className="bg-white/90 p-1.5 rounded-lg border border-teal-100 shadow-2xs">
                            <span className="text-[9px] text-slate-500 block font-medium">Sisa Kuota</span>
                            <span className={`text-xs font-black font-mono ${
                              therapistLeaveBalance.remainingDays <= 2 ? 'text-rose-600' : 'text-emerald-700'
                            }`}>
                              {therapistLeaveBalance.remainingDays} Hari
                            </span>
                          </div>
                          <div className="bg-white/90 p-1.5 rounded-lg border border-teal-100 shadow-2xs">
                            <span className="text-[9px] text-slate-500 block font-medium">Pengajuan Ini</span>
                            <span className="text-xs font-black text-teal-700 font-mono">
                              {selectedDates.length} Hari
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Jenis Cuti</label>
                        <select
                          value={leaveType}
                          onChange={(e) => setLeaveType(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                        >
                          <option value="Cuti Tahunan">Cuti Tahunan</option>
                          <option value="Cuti Alasan Penting">Cuti Alasan Penting</option>
                          <option value="Cuti Sakit">Cuti Sakit</option>
                          <option value="Cuti Melahirkan">Cuti Melahirkan</option>
                          <option value="Cuti Bersama">Cuti Bersama</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Petugas Pengganti</label>
                        <select
                          value={leaveReplacement}
                          onChange={(e) => setLeaveReplacement(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                        >
                          <option value="">- Belum Ditunjuk -</option>
                          {therapists.filter(t => t !== leaveTherapist).map(th => (
                            <option key={th} value={th}>{th}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Alasan / Keperluan Cuti</label>
                      <input
                        type="text"
                        placeholder="Contoh: Keperluan keluarga / Rencana tahunan..."
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    {/* CONFLICT WARNING BANNER */}
                    {leaveConflicts.length > 0 && (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-black text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Pemberitahuan Tabrakan Jadwal Cuti:</span>
                        </div>
                        <ul className="text-[11px] list-disc list-inside text-amber-800 space-y-0.5">
                          {leaveConflicts.map((c, ci) => (
                            <li key={ci}>
                              Tanggal <strong>{formatIndonesianShortDate(c.date)}</strong> sudah diambil oleh: {c.conflictingTherapists.join(', ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* DYNAMIC LIST OF SELECTED DATES CARD */}
                    <div className="bg-teal-50/70 rounded-xl p-2.5 sm:p-3 border border-teal-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-teal-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-teal-600" />
                          <span>Daftar Tanggal Terpilih</span>
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold bg-teal-600 text-white px-2 py-0.5 rounded-full font-mono">
                          {selectedDates.length} Hari
                        </span>
                      </div>

                      {selectedDates.length === 0 ? (
                        <div className="p-2.5 bg-white/70 rounded-lg border border-teal-100 text-center text-xs text-teal-800/70 italic">
                          Belum ada tanggal dipilih. Silakan klik tanggal pada kalender di atas/samping.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-32 sm:max-h-36 overflow-y-auto custom-scrollbar pr-1">
                          <p className="text-[10px] sm:text-[11px] text-teal-900 font-bold">
                            Berikut daftar {selectedDates.length} tanggal yang diajukan:
                          </p>
                          <div className="space-y-1">
                            {selectedDates.map((dateStr, idx) => (
                              <div
                                key={dateStr}
                                className="flex items-center justify-between bg-white px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-teal-200 text-xs font-semibold text-slate-800 shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[9px] sm:text-[10px] font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="font-mono font-bold text-slate-900 text-[11px] sm:text-xs">
                                    {formatIndonesianDate(dateStr)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleToggleDate(dateStr)}
                                  className="text-slate-400 hover:text-rose-600 text-xs p-0.5 cursor-pointer"
                                  title="Hapus tanggal ini"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CONFIRMATION BUTTON */}
                    <div
                      onClick={() => setIsAccordingToPlan(prev => !prev)}
                      className={`p-2.5 sm:p-3 rounded-xl border-2 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        isAccordingToPlan
                          ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/20'
                          : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md flex items-center justify-center text-white text-xs ${
                          isAccordingToPlan ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}>
                          {isAccordingToPlan ? '✓' : ''}
                        </div>
                        <div>
                          <span className="text-[11px] sm:text-xs font-black block leading-tight">
                            Cuti ini sesuai rencana cuti yang dibuat
                          </span>
                          <span className="text-[9px] sm:text-[10px] text-slate-500 block">
                            {isAccordingToPlan ? '✅ Terverifikasi rencana tahunan' : '⚠️ Di luar rencana reguler'}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 ${
                        isAccordingToPlan ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {isAccordingToPlan ? 'SESUAI' : 'DI LUAR'}
                      </span>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                      type="submit"
                      disabled={selectedDates.length === 0}
                      className={`w-full py-2 sm:py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer ${
                        selectedDates.length > 0
                          ? 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Simpan & Ajukan Jadwal Cuti ({selectedDates.length} Hari)</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* LIST OF SAVED LEAVES TABLE */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="px-3 sm:px-6 py-3 sm:py-3.5 bg-slate-100/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>Rekapitulasi Jadwal Cuti Staf IRM ({filteredLeaveList.length} Data)</span>
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-500">Histori permohonan & status cuti tersinkronisasi database</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status filter buttons */}
                    <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setLeaveStatusFilter('all')}
                        className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                          leaveStatusFilter === 'all' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaveStatusFilter('approved')}
                        className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                          leaveStatusFilter === 'approved' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Disetujui
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaveStatusFilter('pending')}
                        className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                          leaveStatusFilter === 'pending' ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Menunggu
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Cari nama / alasan..."
                        value={leaveSearch}
                        onChange={(e) => setLeaveSearch(e.target.value)}
                        className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3 w-36">Nama Fisioterapis</th>
                        <th className="py-2.5 px-3 w-28">Jenis Cuti</th>
                        <th className="py-2.5 px-3 w-20 text-center">Durasi</th>
                        <th className="py-2.5 px-3">Tanggal-Tanggal Cuti</th>
                        <th className="py-2.5 px-3 w-28">Pengganti</th>
                        <th className="py-2.5 px-3 w-28 text-center">Status</th>
                        <th className="py-2.5 px-3 w-28 text-center">Rencana Cuti</th>
                        <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLeaveList.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                            Belum ada jadwal cuti yang tersimpan di database.
                          </td>
                        </tr>
                      ) : (
                        filteredLeaveList.map((leave, idx) => (
                          <tr key={leave.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {leave.therapistName}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {leave.leaveType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-teal-700">
                              {leave.totalDays} Hari
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1">
                                {leave.selectedDates.map((d) => (
                                  <span
                                    key={d}
                                    className="bg-teal-50 text-teal-900 border border-teal-200/80 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                                  >
                                    {formatIndonesianShortDate(d)}
                                  </span>
                                ))}
                              </div>
                              {leave.reason && (
                                <span className="text-[10px] text-slate-500 block mt-1">
                                  Ket: {leave.reason}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 text-[11px]">
                              {leave.replacementStaff || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {leave.status === 'approved' ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateLeaveStatus(leave.id, 'pending')}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 cursor-pointer"
                                  title="Klik untuk mengubah status"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Disetujui</span>
                                </button>
                              ) : leave.status === 'pending' ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateLeaveStatus(leave.id, 'approved')}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 cursor-pointer"
                                  title="Klik untuk menyetujui cuti"
                                >
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Menunggu</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <span>Ditolak</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {leave.isAccordingToPlan ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Sesuai</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <span>Di Luar</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleDeleteLeave(leave.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Hapus jadwal cuti ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="font-semibold text-slate-700">Instalasi Rehabilitasi Medis (IRM)</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold cursor-pointer transition-colors"
          >
            Tutup Dialog
          </button>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* MODAL 1: PASSWORD AUTH PROMPT (Buka Kunci Ceklist Kas) */}
        {/* ------------------------------------------------------------------- */}
        {isKasAuthModalOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide">Akses Terproteksi Password</h3>
                    <p className="text-[11px] text-amber-100 font-medium">Buka Kunci Ceklist Pembayaran Kas</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsKasAuthModalOpen(false);
                    setKasAuthInput('');
                    setKasAuthError('');
                    setPendingKasAction(null);
                  }}
                  className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleUnlockKas} className="p-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tabel ceklist pembayaran uang kas hanya dapat dicentang atau diubah oleh petugas / bendahara berwenang. Masukkan password untuk mengaktifkan <strong>Mode Edit</strong>.
                </p>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    Password Bendahara Kas:
                  </label>
                  <div className="relative">
                    <input
                      type={showKasAuthPassword ? 'text' : 'password'}
                      placeholder="Masukkan kata sandi..."
                      value={kasAuthInput}
                      onChange={(e) => {
                        setKasAuthInput(e.target.value);
                        if (kasAuthError) setKasAuthError('');
                      }}
                      autoFocus
                      required
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKasAuthPassword(!showKasAuthPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showKasAuthPassword ? 'Sembunyikan' : 'Tampilkan password'}
                    >
                      {showKasAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {kasAuthError && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold mt-2 bg-rose-50 p-2 rounded-lg border border-rose-200">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{kasAuthError}</span>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Informasi:</span> Password standar bawaan sistem adalah <code className="px-1.5 py-0.5 bg-white rounded border border-amber-300 font-mono font-black text-amber-950">irm2026</code>. Anda dapat mengubah password ini kapan saja setelah membuka kunci.
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsKasAuthModalOpen(false);
                      setKasAuthInput('');
                      setKasAuthError('');
                      setPendingKasAction(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Batal (Tetap Lihat Saja)
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-2 transition-transform active:scale-95"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Buka Kunci Akses</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* MODAL 2: GANTI PASSWORD BENDAHARA */}
        {/* ------------------------------------------------------------------- */}
        {isChangePasswordOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
              {/* Header */}
              <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide">Ganti Password Bendahara</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Ubah kata sandi proteksi ceklist uang kas</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Password Saat Ini:
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Masukkan password saat ini..."
                    value={currPasswordInput}
                    onChange={(e) => setCurrPasswordInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Password Baru:
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Minimal 4 karakter..."
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    required
                    minLength={4}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Konfirmasi Password Baru:
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Ketik ulang password baru..."
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={showNewPassword}
                      onChange={(e) => setShowNewPassword(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Perlihatkan karakter password</span>
                  </label>
                </div>

                {changePasswordError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{changePasswordError}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsChangePasswordOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-2 transition-transform active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Password Baru</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Terapis / Petugas Modal */}
        {editingStaff && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
              <div className="bg-linear-to-r from-teal-700 to-emerald-700 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Edit2 className="w-4 h-4 text-teal-200" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm">Edit Data Terapis / Petugas</h3>
                    <p className="text-[11px] text-teal-100/80">Perbarui nama dan tarif iuran kas</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditedStaff} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Terapis / Petugas <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editStaffName}
                    onChange={(e) => setEditStaffName(e.target.value)}
                    required
                    placeholder="Nama lengkap dan gelar terapis..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nama akan otomatis disinkronkan di tabel kas dan daftar pilihan petugas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Besaran Iuran Kas Bulanan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={editStaffNominal}
                      onChange={(e) => setEditStaffNominal(e.target.value)}
                      required
                      min="0"
                      step="5000"
                      className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-bold text-slate-800"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Standar umum: {formatRupiah(nominalPerMonth)}/bulan
                  </p>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingStaff(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-2 transition-transform active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
