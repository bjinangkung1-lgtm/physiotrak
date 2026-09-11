import React, { useState } from 'react';
import { X, History, Search, Bell, Trash2, Calendar } from 'lucide-react';
import { CallHistoryRecord, QueueBox } from '../types';

interface CallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  callLogs: CallHistoryRecord[];
  boxes: QueueBox[];
  selectedBox?: QueueBox | null;
  onClearHistory: () => void;
}

export const CallHistoryModal: React.FC<CallHistoryModalProps> = ({
  isOpen,
  onClose,
  callLogs,
  boxes,
  selectedBox,
  onClearHistory,
}) => {
  const [filterBoxId, setFilterBoxId] = useState<string>(selectedBox?.id || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  if (!isOpen) return null;

  const filteredLogs = callLogs.filter((log) => {
    const matchesBox = filterBoxId === 'all' || log.boxId === filterBoxId;
    const matchesSearch = 
      log.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.queueNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.medicalRecordNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.boxTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBox && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="bg-indigo-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-300" />
            <h3 className="font-extrabold text-base tracking-tight">
              {selectedBox ? `Riwayat Panggilan - ${selectedBox.title}` : 'Riwayat Panggilan Seluruh Kotak'}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pasien, RM, atau nomor..."
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterBoxId}
              onChange={(e) => setFilterBoxId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="all">Semua Kotak</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>

            {showConfirmClear ? (
              <div className="flex items-center gap-1.5 bg-rose-100 p-1 rounded-lg border border-rose-300">
                <span className="text-[11px] font-bold text-rose-800 px-1">Kosongkan riwayat?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearHistory();
                    setShowConfirmClear(false);
                  }}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                >
                  Ya
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmClear(false)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-[10px] font-bold cursor-pointer border border-slate-300"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmClear(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Riwayat</span>
              </button>
            )}
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs italic">
              Belum ada data riwayat panggilan yang tersimpan.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, lIdx) => (
                <div
                  key={`call-log-${log.id || lIdx}-${lIdx}`}
                  className="p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 shadow-2xs flex flex-wrap items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-xs">
                          {log.patientName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md font-semibold">
                          RM: {log.medicalRecordNo}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <span className="font-semibold text-indigo-900">📍 Kotak: {log.boxTitle}</span>
                        <span>•</span>
                        <span>👤 Petugas: {log.officerName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold justify-end">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{new Date(log.calledAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>

                    <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                      log.status === 'completed' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : log.status === 'recalled' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {log.status === 'completed' ? '✓ Selesai' : log.status === 'recalled' ? '🔄 Dipanggil Ulang' : 'Dipanggil'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between shrink-0">
          <span>Total {filteredLogs.length} Log Panggilan Terekam</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
