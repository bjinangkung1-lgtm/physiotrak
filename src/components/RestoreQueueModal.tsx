import React, { useState, useEffect } from 'react';
import { X, Undo2, AlertTriangle, RefreshCcw, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { PatientItem, QueueBox, DailyPatientVisit } from '../types';
import { databaseService } from '../utils/databaseService';
import { getLocalDateStringWIB } from '../utils/dateHelper';

interface RestoreQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  livePatients: PatientItem[];
  boxes: QueueBox[];
  onRestorePatient: (visit: DailyPatientVisit) => void;
}

interface Candidate {
  visit: DailyPatientVisit;
  lastKnownActivity: string;
}

export const RestoreQueueModal: React.FC<RestoreQueueModalProps> = ({
  isOpen,
  onClose,
  livePatients,
  boxes,
  onRestorePatient,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [restoredIds, setRestoredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setRestoredIds(new Set());
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadCandidates = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const today = getLocalDateStringWIB();
      const [dailyDb, auditRes] = await Promise.all([
        databaseService.getDailyDatabase(today),
        fetch('/api/deletion-audit').then(r => r.ok ? r.json() : { entries: [] }).catch(() => ({ entries: [] })),
      ]);

      const visits: DailyPatientVisit[] = dailyDb.visits || [];
      const auditEntries: any[] = auditRes.entries || [];

      const livePatientIds = new Set(livePatients.map(p => p.id));

      // Pasien yang ID-nya sudah PERNAH tercatat sebagai penghapusan manual yang
      // sah (lewat popup password) TIDAK ditawarkan untuk dikembalikan - itu memang
      // sengaja dihapus, bukan hilang tanpa sebab.
      const explicitlyDeletedIds = new Set(
        auditEntries.filter(a => a.type === 'patient').map(a => a.targetId)
      );

      // Jam-jam "Bersihkan Antrean" tercatat di server. Pasien yang aktivitas
      // terakhirnya terjadi SEBELUM salah satu jam reset itu dianggap wajar hilang
      // (memang dibersihkan rutin), bukan kejadian aneh.
      const resetTimestamps = auditEntries
        .filter(a => a.type === 'reset')
        .map(a => new Date(a.timestamp).getTime())
        .filter(t => !isNaN(t));

      const found: Candidate[] = [];
      for (const v of visits) {
        if (!v || !v.id) continue;
        if (livePatientIds.has(v.id)) continue;
        if (explicitlyDeletedIds.has(v.id)) continue;

        const lastKnownActivity = v.completedAt || v.calledAt || v.registeredAt;
        const lastKnownMs = lastKnownActivity ? new Date(lastKnownActivity).getTime() : NaN;
        const explainedByReset = !isNaN(lastKnownMs) && resetTimestamps.some(rt => rt >= lastKnownMs);
        if (explainedByReset) continue;

        found.push({ visit: v, lastKnownActivity: lastKnownActivity || '-' });
      }

      // Urutkan dari yang paling baru terlihat aktif
      found.sort((a, b) => new Date(b.lastKnownActivity).getTime() - new Date(a.lastKnownActivity).getTime());
      setCandidates(found);
    } catch (err) {
      console.error('Failed to load restore candidates:', err);
      setErrorMessage('Gagal memuat data. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white flex items-center justify-between border-b border-amber-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Undo2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white">Restore Antrean</h2>
              <p className="text-[11px] text-amber-100 font-medium">Pasien yang hilang tanpa sebab hari ini</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-amber-100 hover:text-white bg-black/10 hover:bg-black/20 rounded-lg transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
            <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              Hanya menampilkan pasien yang tercatat di Database Pasien Harian tapi tidak ada di layar antrean, DAN tidak
              tercatat pernah dihapus manual atau ikut "Bersihkan Antrean". Cek dulu apakah memang wajar dikembalikan sebelum menekan tombol.
            </p>
          </div>

          <button
            type="button"
            onClick={loadCandidates}
            disabled={isLoading}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            <span>{isLoading ? 'Memuat...' : 'Cek Ulang'}</span>
          </button>

          {errorMessage && (
            <p className="text-xs text-rose-600 font-bold text-center">{errorMessage}</p>
          )}

          {!isLoading && candidates.length === 0 && !errorMessage && (
            <div className="p-6 text-center text-xs text-slate-400">
              Tidak ada pasien yang mencurigakan hilang hari ini.
            </div>
          )}

          <div className="space-y-2">
            {candidates.map(({ visit, lastKnownActivity }) => {
              const isRestored = restoredIds.has(visit.id);
              const box = boxes.find(b => b.id === visit.boxId);
              return (
                <div key={visit.id} className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900 truncate">{visit.patientName}</span>
                      <span className="text-[10px] font-mono bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-600">
                        RM: {visit.medicalRecordNo}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                      <span>{box?.title || visit.boxTitle || visit.boxId}</span>
                      <span>&middot;</span>
                      <span className={visit.completed ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                        {visit.completed ? 'Selesai' : 'Sedang Berjalan'}
                      </span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(lastKnownActivity)}
                      </span>
                    </div>
                  </div>
                  {isRestored ? (
                    <span className="text-[10px] font-black text-emerald-700 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Dikembalikan
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onRestorePatient(visit);
                        setRestoredIds(prev => new Set(prev).add(visit.id));
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      Kembalikan
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
