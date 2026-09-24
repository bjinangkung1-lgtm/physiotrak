import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Calendar, Users, Search, Download, Printer, Filter, 
  CheckCircle2, Clock, AlertOctagon, Hospital, Plus, Edit2, 
  Trash2, ArrowRightCircle, Phone, User, RefreshCw, ChevronRight, FileSpreadsheet, Zap,
  Upload, Database, FileText, AlertCircle, Check, FileDown, Layers, HelpCircle,
  Lock, Unlock, KeyRound, Eye, EyeOff, ShieldCheck, ShieldAlert
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MasterPatient, DailyPatientVisit, QueueBox, PatientItem } from '../types';
import { 
  databaseService, 
  DailyDatabaseResponse,
  getDatabasePassword,
  setDatabasePassword,
  setDatabasePasswordAsync,
  verifyDatabasePassword,
  verifyDatabasePasswordAsync,
  DEFAULT_DB_PASSWORD
} from '../utils/databaseService';
import { appendActionCode } from '../utils/actionCodeUtils';
import { getLocalDateStringWIB } from '../utils/dateHelper';

interface DailyPatientDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: QueueBox[];
  currentPatients: PatientItem[];
  onAddPatientToQueue: (patientData: Omit<PatientItem, 'id' | 'createdAt' | 'calledCount' | 'completed'>) => void;
  onResetAllData?: () => void;
}

export const DailyPatientDatabaseModal: React.FC<DailyPatientDatabaseModalProps> = ({
  isOpen,
  onClose,
  boxes,
  currentPatients,
  onAddPatientToQueue,
  onResetAllData,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'master'>('daily');
  
  // Daily Database State
  const todayStr = getLocalDateStringWIB();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dailyData, setDailyData] = useState<DailyDatabaseResponse | null>(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState<boolean>(false);
  const [dailySearch, setDailySearch] = useState<string>('');
  const [selectedBoxFilter, setSelectedBoxFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [selectedSpecialFilter, setSelectedSpecialFilter] = useState<'ALL' | 'WARNING' | 'RANAP'>('ALL');

  // Master Patients State
  const [masterPatients, setMasterPatients] = useState<MasterPatient[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState<boolean>(false);
  const [masterSearch, setMasterSearch] = useState<string>('');
  
  // Master Patient Form (New / Edit)
  const [isEditingMaster, setIsEditingMaster] = useState<boolean>(false);
  const [editingPatient, setEditingPatient] = useState<Partial<MasterPatient> | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [patientToDelete, setPatientToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isConfirmClearMasterOpen, setIsConfirmClearMasterOpen] = useState<boolean>(false);
  const [clearMasterPasswordInput, setClearMasterPasswordInput] = useState<string>('');
  const [showClearMasterPassword, setShowClearMasterPassword] = useState<boolean>(false);
  const [clearMasterPasswordError, setClearMasterPasswordError] = useState<string>('');

  // Import / Restore State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importFileType, setImportFileType] = useState<'excel' | 'json' | null>(null);
  const [parsedImportPatients, setParsedImportPatients] = useState<Partial<MasterPatient>[]>([]);
  const [parsedBackupData, setParsedBackupData] = useState<any | null>(null);
  const [restoreBoxesOption, setRestoreBoxesOption] = useState<boolean>(false);
  const [isProcessingImport, setIsProcessingImport] = useState<boolean>(false);
  const [importStats, setImportStats] = useState<{ total: number; valid: number; newCount: number; updateCount: number }>({
    total: 0,
    valid: 0,
    newCount: 0,
    updateCount: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Therapist boxes only (excluding Tim Transport Ranap / Jemputan Ranap)
  const therapistBoxes = useMemo(() => {
    return boxes.filter(
      (b) =>
        b.id !== 'box-jemputan' &&
        !b.id.toLowerCase().includes('jemputan') &&
        !b.id.toLowerCase().includes('transport') &&
        !b.title.toLowerCase().includes('jemputan') &&
        !b.title.toLowerCase().includes('transport') &&
        !b.officerName?.toLowerCase().includes('transport') &&
        !b.officerName?.toLowerCase().includes('transport') &&
        !b.officerName?.toLowerCase().includes('jemputan')
    );
  }, [boxes]);

  // Database Authentication & Password Protection State
  const [isDbUnlocked, setIsDbUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('irm_db_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [dbPasswordInput, setDbPasswordInput] = useState<string>('');
  const [showDbPassword, setShowDbPassword] = useState<boolean>(false);
  const [dbAuthError, setDbAuthError] = useState<string>('');
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState<string>('');
  const [changePasswordError, setChangePasswordError] = useState<string>('');
  const [showChangePasswordFields, setShowChangePasswordFields] = useState<boolean>(false);

  const handleUnlockDatabase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDbAuthError('');
    if (!dbPasswordInput) {
      setDbAuthError('Silakan masukkan password database');
      return;
    }

    const isValid = await verifyDatabasePasswordAsync(dbPasswordInput);
    if (isValid) {
      setIsDbUnlocked(true);
      try {
        sessionStorage.setItem('irm_db_unlocked', 'true');
      } catch {}
      setDbPasswordInput('');
      setDbAuthError('');
      showToast('Akses Database berhasil dibuka', 'success');
    } else {
      setDbAuthError('Password database salah. Masukkan password yang aktif atau hubungi admin.');
    }
  };

  const handleLockDatabase = () => {
    setIsDbUnlocked(false);
    try {
      sessionStorage.removeItem('irm_db_unlocked');
    } catch {}
    setDbPasswordInput('');
    setDbAuthError('');
    showToast('Database telah dikunci kembali', 'info');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');

    const isOldValid = await verifyDatabasePasswordAsync(currentPasswordInput);
    if (!isOldValid) {
      setChangePasswordError('Password lama tidak sesuai!');
      return;
    }

    if (!newPasswordInput || newPasswordInput.trim().length < 3) {
      setChangePasswordError('Password baru minimal 3 karakter!');
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      setChangePasswordError('Konfirmasi password baru tidak cocok!');
      return;
    }

    const success = await setDatabasePasswordAsync(newPasswordInput.trim());
    if (success) {
      setIsChangePasswordModalOpen(false);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setChangePasswordError('');
      showToast('Password database berhasil diperbarui di semua perangkat!', 'success');
    } else {
      setChangePasswordError('Gagal menyimpan password baru.');
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Load Daily Database
  const loadDailyDatabase = async (date: string) => {
    setIsLoadingDaily(true);
    try {
      const data = await databaseService.getDailyDatabase(date);
      setDailyData(data);
    } catch (err) {
      console.error('Failed to load daily database:', err);
    } finally {
      setIsLoadingDaily(false);
    }
  };

  // Load Master Patients
  const loadMasterPatients = async (query = '') => {
    setIsLoadingMaster(true);
    try {
      const data = await databaseService.getMasterPatients(query);
      setMasterPatients(data);
    } catch (err) {
      console.error('Failed to load master patients:', err);
    } finally {
      setIsLoadingMaster(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDailyDatabase(selectedDate);
      loadMasterPatients(masterSearch);
    }
  }, [isOpen, selectedDate]);

  useEffect(() => {
    if (isOpen && activeTab === 'master') {
      const timer = setTimeout(() => {
        loadMasterPatients(masterSearch);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [masterSearch, activeTab]);

  // If modal is not open, return null after all hooks have run
  if (!isOpen) return null;

  // Filter daily visits
  const filteredVisits = (dailyData?.visits || []).filter((v) => {
    if (dailySearch) {
      const q = dailySearch.toLowerCase();
      const matchText = (
        v.patientName.toLowerCase().includes(q) ||
        v.medicalRecordNo.toLowerCase().includes(q) ||
        (v.queueNumber && v.queueNumber.toLowerCase().includes(q)) ||
        (v.diagnosis && v.diagnosis.toLowerCase().includes(q)) ||
        (v.actionCode && v.actionCode.toLowerCase().includes(q))
      );
      if (!matchText) return false;
    }

    if (selectedBoxFilter !== 'ALL' && v.boxId !== selectedBoxFilter) {
      return false;
    }

    if (selectedStatusFilter === 'COMPLETED' && !v.completed) return false;
    if (selectedStatusFilter === 'PENDING' && v.completed) return false;

    if (selectedSpecialFilter === 'WARNING' && !v.isWarning) return false;
    if (selectedSpecialFilter === 'RANAP' && !v.isRanap) return false;

    return true;
  });

  // Handle Save Master Patient
  const handleSaveMasterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient || !editingPatient.patientName || !editingPatient.medicalRecordNo) {
      showToast('Mohon lengkapi Nama Pasien dan No. RM', 'error');
      return;
    }

    const saved = await databaseService.saveMasterPatient(editingPatient);
    if (saved) {
      setIsEditingMaster(false);
      setEditingPatient(null);
      loadMasterPatients(masterSearch);
      showToast(`Master data "${saved.patientName}" berhasil disimpan`, 'success');
    }
  };

  // Handle Delete Master Patient
  const handleDeleteMasterPatient = async (id: string, name: string) => {
    setPatientToDelete({ id, name });
  };

  const confirmDeleteMasterPatient = async () => {
    if (!patientToDelete) return;
    await databaseService.deleteMasterPatient(patientToDelete.id);
    loadMasterPatients(masterSearch);
    showToast(`Master data "${patientToDelete.name}" berhasil dihapus`, 'info');
    setPatientToDelete(null);
  };

  const handleOpenClearMasterModal = () => {
    setClearMasterPasswordInput('');
    setClearMasterPasswordError('');
    setShowClearMasterPassword(false);
    setIsConfirmClearMasterOpen(true);
  };

  const confirmClearAllMasterPatients = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setClearMasterPasswordError('');

    if (!clearMasterPasswordInput) {
      setClearMasterPasswordError('Silakan masukkan password database untuk verifikasi pembersihan master.');
      return;
    }

    if (!verifyDatabasePassword(clearMasterPasswordInput)) {
      setClearMasterPasswordError(`Password database salah! Masukkan password yang sama dengan password masuk database (Default: ${DEFAULT_DB_PASSWORD}).`);
      return;
    }

    setIsConfirmClearMasterOpen(false);
    setClearMasterPasswordInput('');
    setClearMasterPasswordError('');
    setIsLoadingMaster(true);
    try {
      await databaseService.clearAllMasterPatients();
      setMasterPatients([]);
      showToast('Seluruh data master database pasien berhasil dibersihkan', 'success');
    } catch (err) {
      showToast('Gagal membersihkan master database pasien', 'error');
    } finally {
      setIsLoadingMaster(false);
    }
  };

  // Export Daily to CSV
  const handleExportCSV = () => {
    if (!dailyData || dailyData.visits.length === 0) {
      showToast('Tidak ada data kunjungan untuk diekspor pada tanggal ini', 'error');
      return;
    }

    const headers = [
      'Tanggal',
      'No. Antrean',
      'No. RM',
      'Nama Pasien',
      'No. HP',
      'Poli / Petugas',
      'Kode Tindakan',
      'Diagnosis',
      'Pasien Warning',
      'Pasien Ranap',
      'Waktu Terdaftar',
      'Waktu Selesai',
      'Status'
    ];

    const rows = dailyData.visits.map((v) => {
      const box = boxes.find((b) => b.id === v.boxId);
      return [
        `"${v.visitDate}"`,
        `"${v.queueNumber || '-'}"`,
        `"${v.medicalRecordNo}"`,
        `"${v.patientName}"`,
        `"${v.phoneNumber || '-'}"`,
        `"${box ? `${box.title} (${box.officerName})` : v.boxId}"`,
        `"${v.actionCode || '-'}"`,
        `"${v.diagnosis ? v.diagnosis.replace(/"/g, '""') : '-'}"`,
        `"${v.isWarning ? 'YA (WARNING)' : 'TIDAK'}"`,
        `"${v.isRanap ? 'YA (RANAP)' : 'TIDAK'}"`,
        `"${v.registeredAt ? new Date(v.registeredAt).toLocaleTimeString('id-ID') : '-'}"`,
        `"${v.completedAt ? new Date(v.completedAt).toLocaleTimeString('id-ID') : '-'}"`,
        `"${v.completed ? 'SELESAI' : 'MENUNGGU'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Database_Pasien_IRM_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV berhasil diunduh', 'success');
  };

  // Export Master Patients to formatted Excel
  const handleExportMasterExcel = () => {
    if (masterPatients.length === 0) {
      showToast('Belum ada data master pasien untuk diekspor', 'error');
      return;
    }
    databaseService.exportMasterPatientsToExcel(masterPatients);
    showToast(`Master data (${masterPatients.length} pasien) berhasil diekspor ke Excel`, 'success');
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    databaseService.downloadMasterPatientTemplate();
    showToast('Template Excel import pasien berhasil diunduh', 'success');
  };

  // Full Database Backup JSON
  const handleExportFullBackup = async () => {
    try {
      showToast('Menyiapkan file cadangan lengkap sistem...', 'info');
      await databaseService.exportFullDatabaseBackup();
      showToast('Cadangan database sistem (JSON) berhasil diunduh', 'success');
    } catch (e) {
      showToast('Gagal mengunduh cadangan sistem', 'error');
    }
  };

  // Parse and Handle Uploaded File (Excel / CSV / JSON)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setIsProcessingImport(true);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'json') {
        // Parse JSON
        const text = await file.text();
        const json = JSON.parse(text);

        if (json.data && (json.data.masterPatients || json.data.dailyArchive)) {
          // Full Database Backup
          setImportFileType('json');
          setParsedBackupData(json);
          const patientsCount = Array.isArray(json.data.masterPatients) ? json.data.masterPatients.length : 0;
          setImportStats({
            total: patientsCount,
            valid: patientsCount,
            newCount: patientsCount,
            updateCount: 0
          });
          setParsedImportPatients(json.data.masterPatients || []);
        } else if (Array.isArray(json)) {
          // JSON array of patients
          setImportFileType('excel');
          setParsedBackupData(null);
          processRawPatientRows(json);
        } else {
          showToast('Format JSON tidak dikenali sebagai backup atau daftar pasien', 'error');
          return;
        }
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        // Parse Excel / CSV using SheetJS
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        setImportFileType('excel');
        setParsedBackupData(null);
        processRawPatientRows(rawJson);
      } else {
        showToast('Format berkas tidak didukung. Gunakan file .xlsx, .xls, .csv, atau .json', 'error');
        return;
      }

      setIsImportModalOpen(true);
    } catch (err: any) {
      console.error('Error reading import file:', err);
      showToast(`Gagal membaca berkas: ${err?.message || 'Format tidak valid'}`, 'error');
    } finally {
      setIsProcessingImport(false);
      // Reset input value so same file can be re-selected if needed
      if (e.target) e.target.value = '';
    }
  };

  // Process rows with flexible column headers
  const processRawPatientRows = (rows: any[]) => {
    if (!rows || rows.length === 0) {
      showToast('File tidak memiliki data atau baris kosong', 'error');
      return;
    }

    const findVal = (row: any, aliases: string[]) => {
      const keys = Object.keys(row);
      for (const alias of aliases) {
        const foundKey = keys.find(k => k.trim().toLowerCase() === alias.toLowerCase());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
          return String(row[foundKey]).trim();
        }
      }
      return '';
    };

    const parsedList: Partial<MasterPatient>[] = [];
    let validCount = 0;
    let newCount = 0;
    let updateCount = 0;

    for (const row of rows) {
      const norm = findVal(row, ['no. rm', 'no rm', 'norm', 'no_rm', 'medicalrecordno', 'no rekam medis', 'no. rekam medis', 'rekam medis', 'rm']);
      const name = findVal(row, ['nama pasien', 'nama', 'patientname', 'patient name', 'nama lengkap', 'nama_pasien', 'pasien']);
      
      if (!norm && !name) continue;

      const nik = findVal(row, ['nik', 'identitynumber', 'no ktp', 'ktp', 'nik / identitas', 'no. identitas', 'no identitas']);
      const phone = findVal(row, ['no hp', 'no. hp', 'no telepon', 'telepon', 'phone', 'phonenumber', 'wa', 'no. wa', 'whatsapp', 'no. hp / wa']);
      const rawGender = findVal(row, ['jenis kelamin', 'gender', 'jk', 'sex']);
      let normalizedGender: 'L' | 'P' | '' = '';
      if (rawGender.toUpperCase().startsWith('L') || rawGender.toLowerCase().includes('pria') || rawGender.toLowerCase().includes('laki')) {
        normalizedGender = 'L';
      } else if (rawGender.toUpperCase().startsWith('P') || rawGender.toLowerCase().includes('wanita') || rawGender.toLowerCase().includes('perempuan')) {
        normalizedGender = 'P';
      }

      const birthDate = findVal(row, ['tanggal lahir', 'tgl lahir', 'birthdate', 'dob', 'tgl_lahir']);
      const address = findVal(row, ['alamat', 'address', 'domisili', 'tempat tinggal']);
      const diagnosis = findVal(row, ['diagnosa utama', 'diagnosa', 'diagnosis', 'defaultdiagnosis', 'keluhan', 'diagnosa_utama']);
      const actionCode = findVal(row, ['tindakan rutin', 'tindakan', 'actioncode', 'defaultactioncode', 'kode tindakan', 'tindakan_rutin']);
      const notes = findVal(row, ['catatan', 'notes', 'keterangan', 'riwayat', 'catatan khusus']);

      const isExisting = masterPatients.some(
        mp => mp.medicalRecordNo.toLowerCase() === norm.toLowerCase()
      );

      if (isExisting) {
        updateCount++;
      } else {
        newCount++;
      }

      parsedList.push({
        medicalRecordNo: norm || `RM-${Date.now().toString().slice(-4)}`,
        patientName: name ? name.toUpperCase() : 'TANPA NAMA',
        identityNumber: nik,
        phoneNumber: phone,
        gender: normalizedGender,
        birthDate,
        address,
        defaultDiagnosis: diagnosis,
        defaultActionCode: actionCode,
        notes,
      });

      if (norm && name) {
        validCount++;
      }
    }

    setParsedImportPatients(parsedList);
    setImportStats({
      total: rows.length,
      valid: validCount,
      newCount,
      updateCount
    });
  };

  // Confirm and Execute Import
  const handleExecuteImport = async () => {
    setIsProcessingImport(true);
    try {
      if (importFileType === 'json' && parsedBackupData) {
        // Restore full JSON backup
        const ok = await databaseService.restoreFullDatabaseBackup(parsedBackupData, {
          restoreQueueState: restoreBoxesOption,
          restoreBoxes: restoreBoxesOption
        });
        if (ok) {
          showToast('Seluruh data cadangan sistem (Master Pasien & Kunjungan) berhasil dipulihkan!', 'success');
          loadMasterPatients();
          loadDailyDatabase(selectedDate);
          setIsImportModalOpen(false);
        } else {
          showToast('Gagal memulihkan cadangan sistem', 'error');
        }
      } else {
        // Save Master Patients batch
        if (parsedImportPatients.length === 0) {
          showToast('Tidak ada data pasien yang valid untuk disimpan', 'error');
          return;
        }
        const result = await databaseService.saveMasterPatientsBatch(parsedImportPatients);
        showToast(`Sukses! ${result.added} pasien baru ditambahkan & ${result.updated} pasien diperbarui. Total: ${result.total} pasien.`, 'success');
        loadMasterPatients();
        loadDailyDatabase(selectedDate);
        setIsImportModalOpen(false);
      }
    } catch (err: any) {
      console.error('Failed to execute import:', err);
      showToast(`Gagal mengimpor data: ${err?.message || 'Terjadi kesalahan sistem'}`, 'error');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Find previous therapist box for a master patient (excluding transport ranap)
  const getPrevBoxForMasterPatient = (mp: MasterPatient): QueueBox => {
    if (mp.lastBoxId) {
      const found = therapistBoxes.find((bx) => bx.id === mp.lastBoxId);
      if (found) return found;
    }
    // Search in daily visits
    const foundVisit = (dailyData?.visits || []).find(
      (v) => v.medicalRecordNo === mp.medicalRecordNo && therapistBoxes.some((tb) => tb.id === v.boxId)
    );
    if (foundVisit) {
      const found = therapistBoxes.find((bx) => bx.id === foundVisit.boxId);
      if (found) return found;
    }
    return therapistBoxes[0] || boxes[0] || { id: 'box-1', title: 'Poli', officerName: 'Terapis', color: 'blue', isPinned: false, createdAt: '' };
  };

  // Find previous therapist box for a daily visit (excluding transport ranap)
  const getPrevBoxForVisit = (v: DailyPatientVisit): QueueBox => {
    if (v.boxId) {
      const found = therapistBoxes.find((bx) => bx.id === v.boxId);
      if (found) return found;
    }
    const mp = masterPatients.find((p) => p.medicalRecordNo === v.medicalRecordNo);
    if (mp?.lastBoxId) {
      const found = therapistBoxes.find((bx) => bx.id === mp.lastBoxId);
      if (found) return found;
    }
    return therapistBoxes[0] || boxes[0] || { id: 'box-1', title: 'Poli', officerName: 'Terapis', color: 'blue', isPinned: false, createdAt: '' };
  };

  // Generic enroll handler to any specific target box
  const handleEnrollPatientWithBox = (
    patientData: {
      patientName: string;
      medicalRecordNo: string;
      actionCode?: string;
      diagnosis?: string;
      phoneNumber?: string;
      patientId?: string;
      isWarning?: boolean;
      isRanap?: boolean;
      note?: string;
    },
    targetBoxId: string
  ) => {
    const targetBox = therapistBoxes.find((b) => b.id === targetBoxId) || boxes.find((b) => b.id === targetBoxId) || therapistBoxes[0] || boxes[0];
    const boxId = targetBox?.id || 'box-1';

    onAddPatientToQueue({
      boxId,
      patientName: patientData.patientName.trim().toUpperCase(),
      medicalRecordNo: patientData.medicalRecordNo.trim(),
      queueNumber: '',
      actionCode: patientData.actionCode || '',
      diagnosis: patientData.diagnosis || '',
      phoneNumber: patientData.phoneNumber || '',
      patientId: patientData.patientId,
      isWarning: patientData.isWarning || false,
      isRanap: patientData.isRanap || false,
      note: patientData.note || '',
    });

    // Update master patient lastBoxId & lastOfficerName
    databaseService.saveMasterPatient({
      id: patientData.patientId,
      medicalRecordNo: patientData.medicalRecordNo,
      patientName: patientData.patientName,
      lastBoxId: boxId,
      lastOfficerName: targetBox?.officerName,
      phoneNumber: patientData.phoneNumber,
      defaultDiagnosis: patientData.diagnosis,
      defaultActionCode: patientData.actionCode,
      notes: patientData.note,
    });

    const therapistName = targetBox?.officerName || targetBox?.title.split('(')[0] || 'Terapis';
    const boxLabel = targetBox?.title.split('(')[0].trim() || 'Kotak Antrean';
    showToast(`Pasien "${patientData.patientName}" berhasil diantrekan ke: ${therapistName} (${boxLabel})!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1520px] h-[92vh] max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0 flex-1">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-teal-600/90 text-white flex items-center justify-center shadow-md shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white leading-snug truncate">
                  Database Pasien & Register Harian
                </h2>
              </div>
            </div>

            {/* Close Button on Mobile (Top Right) */}
            <button
              onClick={onClose}
              className="sm:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer shrink-0"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            {/* Lock / Password Control Button */}
            {isDbUnlocked ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Ubah Password Database"
                >
                  <KeyRound className="w-3.5 h-3.5 text-teal-400" />
                  <span className="hidden md:inline">Ganti Password</span>
                </button>
                <button
                  type="button"
                  onClick={handleLockDatabase}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Kunci Akses Database"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kunci Kembali</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold">
                <Lock className="w-3.5 h-3.5" />
                <span>Terkunci</span>
              </div>
            )}

            {/* Tab Switches */}
            {isDbUnlocked && (
              <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab('daily')}
                  className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'daily'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="truncate">Per Hari</span>
                </button>
                <button
                  onClick={() => setActiveTab('master')}
                  className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'master'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="truncate">Master ({masterPatients.length})</span>
                </button>
              </div>
            )}

            {/* Close Button on Desktop */}
            <button
              onClick={onClose}
              className="hidden sm:block p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              title="Tutup (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Locked Database Authentication Screen */}
        {!isDbUnlocked && (
          <div className="flex-1 bg-slate-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-xs">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                  Proteksi Keamanan Database
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Database Pasien & Master Rekam Medis IRM diproteksi password untuk menjaga privasi data medis pasien.
                </p>
              </div>

              <form onSubmit={handleUnlockDatabase} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Masukkan Password Database:
                  </label>
                  <div className="relative">
                    <input
                      type={showDbPassword ? 'text' : 'password'}
                      value={dbPasswordInput}
                      onChange={(e) => {
                        setDbPasswordInput(e.target.value);
                        if (dbAuthError) setDbAuthError('');
                      }}
                      autoFocus
                      placeholder="Ketik password database..."
                      className={`w-full pl-3.5 pr-11 py-2.5 border rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 transition-all ${
                        dbAuthError
                          ? 'border-rose-400 bg-rose-50/40 focus:ring-rose-400'
                          : 'border-slate-300 bg-white focus:ring-teal-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowDbPassword(!showDbPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                      title={showDbPassword ? 'Sembunyikan' : 'Tampilkan'}
                    >
                      {showDbPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {dbAuthError && (
                    <div className="flex items-center gap-1.5 text-rose-600 text-xs font-semibold mt-2 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{dbAuthError}</span>
                    </div>
                  )}
                </div>

                <div className="pt-1 space-y-2.5">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Buka Akses Database</span>
                  </button>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Informasi:</span> Password bawaan standar sistem adalah <code className="px-1.5 py-0.5 bg-white rounded border border-amber-300 font-mono font-black text-amber-950">admin</code>. Anda dapat mengubahnya sewaktu-waktu setelah berhasil masuk.
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Content Tab 1: Daily Database */}
        {isDbUnlocked && activeTab === 'daily' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Top Toolbar: Date Picker & Quick Actions */}
            <div className="bg-white p-3 md:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Date Navigation */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-700">Tanggal Kunjungan:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 cursor-pointer"
                />

                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === todayStr
                      ? 'bg-teal-100 text-teal-900 border border-teal-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Hari Ini
                </button>

                <button
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    setSelectedDate(getLocalDateStringWIB(yesterday));
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Kemarin
                </button>

                <button
                  onClick={() => loadDailyDatabase(selectedDate)}
                  title="Segarkan Data"
                  className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingDaily ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Export & Actions */}
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Import data pasien dari file Excel, CSV, atau file cadangan JSON"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import / Pulihkan Data</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Excel / CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportFullBackup}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Cadangkan seluruh database (Master, Kunjungan, Kas, Cuti, dll) ke berkas JSON"
                >
                  <Database className="w-4 h-4" />
                  <span className="hidden sm:inline">Backup Lengkap</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Cetak</span>
                </button>

                {/* Bersihkan Antrean Hari Ini Button */}
                {onResetAllData && (
                  <button
                    type="button"
                    onClick={onResetAllData}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer hover:scale-[1.02] shrink-0"
                    title="Bersihkan seluruh antrean pasien aktif hari ini dan arsipkan ke riwayat harian (Memerlukan PIN Otorisasi)"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Bersihkan Antrean</span>
                  </button>
                )}
              </div>
            </div>

            {/* Summary Statistics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 md:p-4 bg-slate-100/70 border-b border-slate-200 shrink-0">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Pasien</span>
                <span className="text-xl font-black text-slate-900">{dailyData?.summary.total || 0}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Selesai Dilayani</span>
                <span className="text-xl font-black text-emerald-700">{dailyData?.summary.completed || 0}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Sedang Menunggu</span>
                <span className="text-xl font-black text-amber-700">{dailyData?.summary.pending || 0}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">Pasien Warning (🛑)</span>
                <span className="text-xl font-black text-rose-700">{dailyData?.summary.warning || 0}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Pasien Ranap (🛏️)</span>
                <span className="text-xl font-black text-blue-700">{dailyData?.summary.ranap || 0}</span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <input
                  type="text"
                  value={dailySearch}
                  onChange={(e) => setDailySearch(e.target.value)}
                  placeholder="Cari nama pasien, no. RM, diagnosa..."
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2 pointer-events-none" />
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Box Filter */}
                <select
                  value={selectedBoxFilter}
                  onChange={(e) => setSelectedBoxFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-700 bg-white"
                >
                  <option value="ALL">Semua Poli / Petugas</option>
                  {boxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-700 bg-white"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="COMPLETED">Hanya Selesai</option>
                  <option value="PENDING">Hanya Menunggu</option>
                </select>

                {/* Special Filter */}
                <select
                  value={selectedSpecialFilter}
                  onChange={(e) => setSelectedSpecialFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-700 bg-white"
                >
                  <option value="ALL">Semua Kategori</option>
                  <option value="WARNING">🛑 Pasien Warning</option>
                  <option value="RANAP">🛏️ Pasien Ranap</option>
                </select>
              </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-3 sm:p-4">
              {filteredVisits.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-bold text-slate-700 text-sm">Tidak ada data pasien untuk tanggal {selectedDate}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {dailySearch ? 'Coba ubah kata kunci pencarian atau filter.' : 'Belum ada kunjungan yang tercatat pada hari ini.'}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full min-w-[1080px] text-left border-collapse text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="py-3 px-3.5 whitespace-nowrap w-24">No. Antrean</th>
                          <th className="py-3 px-3.5 whitespace-nowrap w-28">No. RM</th>
                          <th className="py-3 px-3.5 min-w-[180px]">Nama Pasien</th>
                          <th className="py-3 px-3.5 min-w-[160px]">Poli / Petugas</th>
                          <th className="py-3 px-3.5 min-w-[180px] max-w-[260px]">Tindakan & Diagnosa</th>
                          <th className="py-3 px-3.5 whitespace-nowrap w-28">Waktu Terdaftar</th>
                          <th className="py-3 px-3.5 text-center whitespace-nowrap w-28">Status</th>
                          <th className="py-3 px-3.5 pr-4 text-right whitespace-nowrap min-w-[280px]">Aksi Antrekan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredVisits.map((v, vIdx) => {
                          const prevBox = getPrevBoxForVisit(v);
                          const prevTherapistName = prevBox?.officerName || prevBox?.title.split('(')[0].trim() || 'Terapis';
                          const isCurrentlyActive = currentPatients.some(p => p.medicalRecordNo === v.medicalRecordNo && !p.completed);

                          return (
                            <tr key={`visit-${v.id || v.medicalRecordNo || vIdx}-${vIdx}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {v.queueNumber ? (
                                  <span className="px-2 py-0.5 bg-slate-900 text-white rounded-md text-xs">
                                    {v.queueNumber}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono font-bold text-teal-800 whitespace-nowrap">
                                {v.medicalRecordNo}
                              </td>
                              <td className="py-2.5 px-3.5 min-w-[180px]">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                  <span>{v.patientName}</span>
                                  {v.isWarning && <span title="Pasien Warning" className="text-rose-600 font-bold">🛑</span>}
                                  {v.isRanap && <span title="Pasien Rawat Inap" className="text-blue-600 font-bold">🛏️</span>}
                                  {isCurrentlyActive && (
                                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded-sm">
                                      Sedang Aktif
                                    </span>
                                  )}
                                </div>
                                {v.phoneNumber && (
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    📞 {v.phoneNumber}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-700 min-w-[160px]">
                                <div className="font-semibold text-slate-900">{prevBox?.title || v.boxId}</div>
                                <div className="text-[10px] text-slate-500">{prevBox?.officerName || '-'}</div>
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-700 min-w-[180px] max-w-[260px]">
                                {v.actionCode && (
                                  <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px] mr-1 mb-0.5">
                                    {v.actionCode}
                                  </span>
                                )}
                                <span className="text-slate-600 truncate block text-[11px]">
                                  {v.diagnosis || '-'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                                {v.registeredAt ? new Date(v.registeredAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                              <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                {v.completed ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Selesai</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
                                    <Clock className="w-3 h-3" />
                                    <span>Menunggu</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 pr-4 text-right whitespace-nowrap min-w-[280px]">
                                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                  {/* Target 1: Langsung ke terapis sebelumnya */}
                                  <button
                                    type="button"
                                    onClick={() => handleEnrollPatientWithBox({
                                      patientName: v.patientName,
                                      medicalRecordNo: v.medicalRecordNo,
                                      actionCode: v.actionCode,
                                      diagnosis: v.diagnosis,
                                      phoneNumber: v.phoneNumber,
                                      patientId: v.patientId,
                                      isWarning: v.isWarning,
                                      isRanap: v.isRanap,
                                      note: v.note,
                                    }, prevBox.id)}
                                    title={`Langsung Antrekan ke Terapis Sebelumnya: ${prevTherapistName} (${prevBox.title.split('(')[0].trim()})`}
                                    className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-95"
                                  >
                                    <Zap className="w-3.5 h-3.5 text-teal-200 fill-teal-200" />
                                    <span>Antrekan ({prevTherapistName})</span>
                                  </button>

                                  {/* Target 2: Ganti terapis dengan menu dropdown */}
                                  <div className="relative inline-block">
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleEnrollPatientWithBox({
                                            patientName: v.patientName,
                                            medicalRecordNo: v.medicalRecordNo,
                                            actionCode: v.actionCode,
                                            diagnosis: v.diagnosis,
                                            phoneNumber: v.phoneNumber,
                                            patientId: v.patientId,
                                            isWarning: v.isWarning,
                                            isRanap: v.isRanap,
                                            note: v.note,
                                          }, e.target.value);
                                        }
                                      }}
                                      title="Ganti terapis / Pilih terapis lain untuk mengantrekan"
                                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-teal-500 cursor-pointer max-w-[140px] truncate"
                                    >
                                      <option value="" disabled>
                                        🔄 Ganti Terapis...
                                      </option>
                                      {therapistBoxes.map((b) => (
                                        <option key={b.id} value={b.id}>
                                          {b.officerName ? `${b.officerName} (${b.title.split('(')[0].trim()})` : b.title}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Tab 2: Master Patient Database */}
        {isDbUnlocked && activeTab === 'master' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Top Toolbar: Search, Import, Export & Add Master Patient */}
            <div className="bg-white p-3 md:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input
                  type="text"
                  value={masterSearch}
                  onChange={(e) => setMasterSearch(e.target.value)}
                  placeholder="Cari master pasien (Nama, No. RM, NIK, No. HP)..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>

              <div className="flex items-center flex-wrap gap-2">
                {/* Import / Restore Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Import data pasien dari file Excel, CSV, atau file cadangan JSON"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import / Pulihkan Data</span>
                </button>

                {/* Export Master Excel */}
                <button
                  type="button"
                  onClick={handleExportMasterExcel}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Unduh seluruh master data pasien ke file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">Ekspor Excel</span>
                </button>

                {/* Download Template */}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-all cursor-pointer"
                  title="Unduh format template Excel untuk pengisian data pasien"
                >
                  <FileDown className="w-4 h-4 text-slate-600" />
                  <span className="hidden md:inline">Template Excel</span>
                </button>

                {/* Full Backup */}
                <button
                  type="button"
                  onClick={handleExportFullBackup}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Cadangkan seluruh database sistem ke berkas JSON"
                >
                  <Database className="w-4 h-4" />
                  <span className="hidden lg:inline">Backup Lengkap</span>
                </button>

                {/* Clear All Master Patients Button */}
                <button
                  type="button"
                  onClick={handleOpenClearMasterModal}
                  disabled={masterPatients.length === 0}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold flex items-center gap-1.5 border border-rose-200 transition-all cursor-pointer"
                  title="Bersihkan / kosongkan semua data master pasien (Memerlukan verifikasi password)"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Bersihkan Master</span>
                </button>

                {/* Add New Master Patient */}
                <button
                  onClick={() => {
                    setEditingPatient({
                      id: '',
                      medicalRecordNo: '',
                      patientName: '',
                      identityNumber: '',
                      phoneNumber: '',
                      birthDate: '',
                      gender: '',
                      address: '',
                      defaultDiagnosis: '',
                      defaultActionCode: '',
                      notes: '',
                      totalVisits: 1,
                    });
                    setIsEditingMaster(true);
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Pasien Baru</span>
                </button>
              </div>
            </div>

            {/* Master Patient Table */}
            <div className="flex-1 overflow-auto p-3 sm:p-4">
              {masterPatients.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-bold text-slate-700 text-sm">Tidak ada data master pasien</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Gunakan tombol "+ Daftarkan Master Pasien Baru" di atas untuk menambahkan pasien.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full min-w-[1100px] text-left border-collapse text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="py-3 px-3.5 whitespace-nowrap w-28">No. RM</th>
                          <th className="py-3 px-3.5 min-w-[200px]">Nama Pasien & NIK</th>
                          <th className="py-3 px-3.5 min-w-[150px]">Kontak / No. HP</th>
                          <th className="py-3 px-3.5 min-w-[160px]">Diagnosa Utama</th>
                          <th className="py-3 px-3.5 whitespace-nowrap w-28">Tindakan Rutin</th>
                          <th className="py-3 px-3.5 text-center whitespace-nowrap w-28">Total Kunjungan</th>
                          <th className="py-3 px-3.5 pr-4 text-right whitespace-nowrap min-w-[340px]">Aksi Antrekan & Kelola</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {masterPatients.map((mp, mpIdx) => {
                          const prevBox = getPrevBoxForMasterPatient(mp);
                          const prevTherapistName = prevBox?.officerName || prevBox?.title.split('(')[0].trim() || 'Terapis';
                          const isCurrentlyActive = currentPatients.some(p => p.medicalRecordNo === mp.medicalRecordNo && !p.completed);

                          return (
                            <tr key={`master-${mp.id || mp.medicalRecordNo || mpIdx}-${mpIdx}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3.5 font-mono font-bold text-teal-800 text-sm whitespace-nowrap">
                                {mp.medicalRecordNo}
                              </td>
                              <td className="py-2.5 px-3.5 min-w-[200px]">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                  <span>{mp.patientName}</span>
                                  {isCurrentlyActive && (
                                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded-sm">
                                      Sedang Aktif
                                    </span>
                                  )}
                                </div>
                                {mp.identityNumber && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    NIK: {mp.identityNumber}
                                  </div>
                                )}
                                {mp.address && (
                                  <div className="text-[10px] text-slate-500 truncate max-w-xs">
                                    📍 {mp.address}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-700 min-w-[150px]">
                                {mp.phoneNumber ? (
                                  <a
                                    href={`https://wa.me/${mp.phoneNumber.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold"
                                  >
                                    <Phone className="w-3 h-3 text-emerald-600" />
                                    <span>{mp.phoneNumber}</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-700 min-w-[160px] max-w-xs">
                                <span className="text-[11px] font-medium text-slate-800">
                                  {mp.defaultDiagnosis || '-'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap">
                                {mp.defaultActionCode ? (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px]">
                                    {mp.defaultActionCode}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-center font-mono whitespace-nowrap">
                                <span className="px-2 py-1 bg-teal-50 text-teal-800 rounded-full font-bold text-xs">
                                  {mp.totalVisits || 1}x Datang
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 pr-4 text-right whitespace-nowrap min-w-[340px]">
                                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                  {/* Target 1: Langsung ke Terapis Sebelumnya */}
                                  <button
                                    type="button"
                                    onClick={() => handleEnrollPatientWithBox({
                                      patientName: mp.patientName,
                                      medicalRecordNo: mp.medicalRecordNo,
                                      actionCode: mp.defaultActionCode,
                                      diagnosis: mp.defaultDiagnosis,
                                      phoneNumber: mp.phoneNumber,
                                      patientId: mp.id,
                                      isWarning: false,
                                      isRanap: false,
                                      note: mp.notes,
                                    }, prevBox.id)}
                                    title={`Langsung Antrekan ke Terapis Sebelumnya: ${prevTherapistName} (${prevBox.title.split('(')[0].trim()})`}
                                    className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-95"
                                  >
                                    <Zap className="w-3.5 h-3.5 text-teal-200 fill-teal-200" />
                                    <span>Antrekan ({prevTherapistName})</span>
                                  </button>

                                  {/* Target 2: Ganti Terapis dengan Menu Dropdown */}
                                  <div className="relative inline-block">
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleEnrollPatientWithBox({
                                            patientName: mp.patientName,
                                            medicalRecordNo: mp.medicalRecordNo,
                                            actionCode: mp.defaultActionCode,
                                            diagnosis: mp.defaultDiagnosis,
                                            phoneNumber: mp.phoneNumber,
                                            patientId: mp.id,
                                            isWarning: false,
                                            isRanap: false,
                                            note: mp.notes,
                                          }, e.target.value);
                                        }
                                      }}
                                      title="Ganti terapis / Pilih terapis lain untuk mengantrekan"
                                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-teal-500 cursor-pointer max-w-[140px] truncate"
                                    >
                                      <option value="" disabled>
                                        🔄 Ganti Terapis...
                                      </option>
                                      {therapistBoxes.map((b) => (
                                        <option key={b.id} value={b.id}>
                                          {b.officerName ? `${b.officerName} (${b.title.split('(')[0].trim()})` : b.title}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPatient(mp);
                                      setIsEditingMaster(true);
                                    }}
                                    title="Edit Data Master Pasien"
                                    className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMasterPatient(mp.id, mp.patientName)}
                                    title="Hapus Master Pasien"
                                    className="p-1.5 text-rose-600 hover:text-rose-800 rounded-lg hover:bg-rose-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Create or Edit Master Patient */}
        {isEditingMaster && editingPatient && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-teal-800 text-white p-4 flex items-center justify-between">
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-300" />
                  <span>{editingPatient.id ? 'Edit Master Data Pasien' : 'Daftarkan Master Pasien Baru'}</span>
                </h3>
                <button
                  onClick={() => setIsEditingMaster(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMasterPatient} className="p-5 space-y-3.5 text-xs text-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">No. Rekam Medis (RM) *</label>
                    <input
                      type="text"
                      required
                      value={editingPatient.medicalRecordNo || ''}
                      onChange={(e) => setEditingPatient({ ...editingPatient, medicalRecordNo: e.target.value })}
                      placeholder="e.g. 273267"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Nama Pasien *</label>
                    <input
                      type="text"
                      required
                      value={editingPatient.patientName || ''}
                      onChange={(e) => setEditingPatient({ ...editingPatient, patientName: e.target.value.toUpperCase() })}
                      placeholder="e.g. MUFLIHATI, NY"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">NIK / No. BPJS</label>
                    <input
                      type="text"
                      value={editingPatient.identityNumber || ''}
                      onChange={(e) => setEditingPatient({ ...editingPatient, identityNumber: e.target.value })}
                      placeholder="16 Digit NIK"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">No. HP / WhatsApp</label>
                    <input
                      type="text"
                      value={editingPatient.phoneNumber || ''}
                      onChange={(e) => setEditingPatient({ ...editingPatient, phoneNumber: e.target.value })}
                      placeholder="08123456789"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={editingPatient.birthDate || ''}
                      onChange={(e) => setEditingPatient({ ...editingPatient, birthDate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Jenis Kelamin</label>
                    <select
                      value={editingPatient.gender || ''}
                      onChange={(e) => setEditingPatient({ ...editingPatient, gender: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Pilih Jenis Kelamin</option>
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Alamat Domisili</label>
                  <input
                    type="text"
                    value={editingPatient.address || ''}
                    onChange={(e) => setEditingPatient({ ...editingPatient, address: e.target.value })}
                    placeholder="Nama jalan, kelurahan, kota"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Diagnosa Bawaan / Utama</label>
                    <input
                      type="text"
                      value={editingPatient.defaultDiagnosis || ''}
                      onChange={(e) => setEditingPatient({ ...editingPatient, defaultDiagnosis: e.target.value })}
                      placeholder="e.g. Low Back Pain / Post Stroke"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Kode Tindakan / Utilisasi Alat</label>
                    <input
                      type="text"
                      value={editingPatient.defaultActionCode || ''}
                      onChange={(e) => setEditingPatient({ ...editingPatient, defaultActionCode: e.target.value.toUpperCase() })}
                      placeholder="e.g. 2, 6 (MWD, TENS) atau C 2+4"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 uppercase"
                    />
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {[
                        { code: '2', label: '2 MWD' },
                        { code: '6', label: '6 TENS' },
                        { code: '4', label: '4 US' },
                        { code: '1', label: '1 IRR' },
                        { code: '9', label: '9 Manipulasi' },
                        { code: '10', label: '10 Rehab' },
                        { code: '14', label: '14 Paket Chest+Inhalasi' },
                        { code: '15', label: '15 Parafin' },
                        { code: '18', label: '18 Nebu' },
                        { code: '47', label: '47 Cryo' },
                        { code: '74', label: '74 Vaccum' },
                        { code: '75', label: '75 Chest' },
                      ].map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => {
                            setEditingPatient({
                              ...editingPatient,
                              defaultActionCode: appendActionCode(editingPatient.defaultActionCode, item.code)
                            });
                          }}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-teal-100 rounded text-[9px] font-mono text-slate-700 cursor-pointer"
                          title={`Tambahkan kode ${item.label} (bisa diklik berkali-kali)`}
                        >
                          +{item.label}
                        </button>
                      ))}
                      {editingPatient.defaultActionCode && (
                        <button
                          type="button"
                          onClick={() => setEditingPatient({ ...editingPatient, defaultActionCode: '' })}
                          className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[9px] font-semibold cursor-pointer"
                          title="Hapus Kode"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Terapis Rutin / Sebelumnya (Poli Default)</label>
                  <select
                    value={editingPatient.lastBoxId || ''}
                    onChange={(e) => {
                      const selectedBox = therapistBoxes.find(b => b.id === e.target.value) || boxes.find(b => b.id === e.target.value);
                      setEditingPatient({ 
                        ...editingPatient, 
                        lastBoxId: e.target.value,
                        lastOfficerName: selectedBox?.officerName 
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Pilih Terapis Default...</option>
                    {therapistBoxes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.officerName ? `${b.officerName} — ${b.title}` : b.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Catatan Riwayat / Alergi / Khusus</label>
                  <input
                    type="text"
                    value={editingPatient.notes || ''}
                    onChange={(e) => setEditingPatient({ ...editingPatient, notes: e.target.value })}
                    placeholder="e.g. Pasien menggunakan alat pacu jantung / kursi roda"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsEditingMaster(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shadow-md cursor-pointer"
                  >
                    Simpan Data Master Pasien
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Hidden File Input for Import / Restore */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".xlsx,.xls,.csv,.json"
          className="hidden"
        />

        {/* Modal Import & Pulihkan Data Pasien */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Import & Pulihkan Data Pasien</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-800 text-teal-200 border border-teal-700 font-mono">
                        {importFileType === 'json' ? 'BACKUP JSON' : 'EXCEL / CSV'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Berkas: <span className="font-semibold text-teal-300 font-mono">{importFileName}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-slate-50">
                {/* Stats & Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Baris</span>
                    <span className="text-xl font-black text-slate-900 font-mono">{importStats.total}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">data dalam file</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-2xs bg-teal-50/40">
                    <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block">Format Valid</span>
                    <span className="text-xl font-black text-teal-800 font-mono">{importStats.valid}</span>
                    <span className="text-[10px] text-teal-600 block mt-0.5">siap diimpor</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/40">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Pasien Baru</span>
                    <span className="text-xl font-black text-emerald-800 font-mono">+{importStats.newCount}</span>
                    <span className="text-[10px] text-emerald-600 block mt-0.5">akan ditambahkan</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-sky-200 shadow-2xs bg-sky-50/40">
                    <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">Pembaruan</span>
                    <span className="text-xl font-black text-sky-800 font-mono">↻{importStats.updateCount}</span>
                    <span className="text-[10px] text-sky-600 block mt-0.5">sudah ada di DB</span>
                  </div>
                </div>

                {importFileType === 'json' && parsedBackupData && (
                  <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl text-xs text-indigo-900 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <Database className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Berkas Cadangan Lengkap Sistem Ditemukan</strong>
                        <p className="mt-0.5 text-indigo-700">
                          File ini berisi master data pasien ({Array.isArray(parsedBackupData.data?.masterPatients) ? parsedBackupData.data.masterPatients.length : 0} pasien),
                          arsip register kunjungan harian, data inventaris, kas, dan cuti terapis.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2.5 pt-2 border-t border-indigo-200/80 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={restoreBoxesOption}
                        onChange={(e) => setRestoreBoxesOption(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-indigo-300"
                      />
                      <span className="text-xs text-indigo-900 font-medium">
                        Timpa susunan & warna kotak antrean aktif dengan kotak lama dari file backup (Biarkan <strong>tidak dicentang</strong> agar warna kotak saat ini tidak ter-reset).
                      </span>
                    </label>
                  </div>
                )}

                {/* Preview Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Pratinjau Data yang Akan Disimpan ({parsedImportPatients.length} Pasien)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 italic">
                      Menampilkan maksimal 10 baris pertama
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                          <th className="py-2 px-3">No. RM</th>
                          <th className="py-2 px-3">Nama Pasien</th>
                          <th className="py-2 px-3">NIK / HP</th>
                          <th className="py-2 px-3">Diagnosa</th>
                          <th className="py-2 px-3">Tindakan</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedImportPatients.slice(0, 10).map((p, idx) => {
                          const isExisting = masterPatients.some(
                            (mp) => mp.medicalRecordNo.toLowerCase() === (p.medicalRecordNo || '').toLowerCase()
                          );
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                {p.medicalRecordNo || '-'}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-800 uppercase">
                                {p.patientName || '-'}
                              </td>
                              <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                                {p.phoneNumber || p.identityNumber || '-'}
                              </td>
                              <td className="py-2 px-3 text-slate-700 max-w-[150px] truncate">
                                {p.defaultDiagnosis || '-'}
                              </td>
                              <td className="py-2 px-3 font-mono font-semibold text-teal-700">
                                {p.defaultActionCode || '-'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {isExisting ? (
                                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-bold">
                                    Update
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    Baru
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Helper notice */}
                <div className="bg-slate-100/90 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Kolom yang didukung: <strong>No. RM, Nama Pasien, NIK, No. HP, Diagnosa, Tindakan</strong>.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="text-teal-700 hover:text-teal-900 font-bold underline flex items-center gap-1 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Unduh Format Template Excel</span>
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-white p-3.5 md:p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Pilih Berkas Lain
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingImport || parsedImportPatients.length === 0}
                    onClick={handleExecuteImport}
                    className="px-5 py-2 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    {isProcessingImport ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Menyimpan ke Database...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Terapkan & Simpan ke Database ({parsedImportPatients.length} Pasien)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* In-App Delete Confirmation Modal */}
        {patientToDelete && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Hapus Master Pasien?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Yakin ingin menghapus master data pasien <strong className="text-slate-900">"{patientToDelete.name}"</strong>? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setPatientToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteMasterPatient}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  Ya, Hapus Pasien
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-App Clear All Master Database Confirmation Modal with Password Verification */}
        {isConfirmClearMasterOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Verifikasi Bersihkan Master Database</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin mengosongkan seluruh data master pasien (<strong className="text-slate-900">{masterPatients.length} pasien</strong>)? Tindakan ini akan menghapus seluruh data master pasien secara permanen.
                </p>
              </div>

              {/* Password Verification Form */}
              <form onSubmit={confirmClearAllMasterPatients} className="space-y-3 pt-1 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                    <span>Masukkan Password Database:</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showClearMasterPassword ? 'text' : 'password'}
                      value={clearMasterPasswordInput}
                      onChange={(e) => {
                        setClearMasterPasswordInput(e.target.value);
                        setClearMasterPasswordError('');
                      }}
                      placeholder="Ketik password masuk database..."
                      autoFocus
                      className={`w-full pl-3 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 ${
                        clearMasterPasswordError 
                          ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/50' 
                          : 'border-slate-300 focus:ring-rose-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowClearMasterPassword(!showClearMasterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showClearMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {clearMasterPasswordError && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{clearMasterPasswordError}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    *Gunakan password yang sama dengan password saat membuka database (Default: <code className="font-bold text-slate-600">{DEFAULT_DB_PASSWORD}</code>).
                  </p>
                </div>

                <div className="flex gap-2.5 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmClearMasterOpen(false);
                      setClearMasterPasswordInput('');
                      setClearMasterPasswordError('');
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Verifikasi &amp; Bersihkan Master</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Database Password Modal */}
        {isChangePasswordModalOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Ganti Password Database</h3>
                    <p className="text-[11px] text-slate-500">Perbarui kunci akses keamanan database</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangePasswordModalOpen(false);
                    setCurrentPasswordInput('');
                    setNewPasswordInput('');
                    setConfirmNewPasswordInput('');
                    setChangePasswordError('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password Lama Saat Ini:
                  </label>
                  <input
                    type={showChangePasswordFields ? 'text' : 'password'}
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Masukkan password saat ini..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password Baru:
                  </label>
                  <input
                    type={showChangePasswordFields ? 'text' : 'password'}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Masukkan password baru..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Konfirmasi Password Baru:
                  </label>
                  <input
                    type={showChangePasswordFields ? 'text' : 'password'}
                    value={confirmNewPasswordInput}
                    onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                    placeholder="Ketik ulang password baru..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showChangePasswordFields}
                      onChange={(e) => setShowChangePasswordFields(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span>Perlihatkan karakter</span>
                  </label>
                </div>

                {changePasswordError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{changePasswordError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePasswordModalOpen(false);
                      setCurrentPasswordInput('');
                      setNewPasswordInput('');
                      setConfirmNewPasswordInput('');
                      setChangePasswordError('');
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-all"
                  >
                    Simpan Password Baru
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5">
            <div className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
              toastMessage.type === 'success' ? 'bg-teal-900 text-teal-100 border-teal-700' :
              toastMessage.type === 'error' ? 'bg-rose-900 text-rose-100 border-rose-700' :
              'bg-slate-900 text-slate-100 border-slate-700'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
