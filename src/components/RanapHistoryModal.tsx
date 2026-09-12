import React, { useEffect, useState } from 'react';
import { X, History, Search, RefreshCw, FileSpreadsheet, DoorOpen, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { RanapCategory, RanapHistoryItem } from '../types';
import { RANAP_CATEGORY_LABELS, RANAP_CATEGORY_SHORT_LABELS } from '../utils/ranapQueueUtils';
import { databaseService } from '../utils/databaseService';
import { getLocalDateStringWIB } from '../utils/dateHelper';

interface RanapHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RanapHistoryModal: React.FC<RanapHistoryModalProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<RanapHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RanapCategory>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await databaseService.getRanapHistory({
        category: categoryFilter,
        search: searchQuery.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setHistory(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = ['Tanggal Selesai', 'Jam Selesai', 'Divisi', 'Nama Pasien', 'No. RM', 'No. Ruangan', 'Diagnosis', 'Catatan'];
    const rows = history.map((h) => {
      const completed = new Date(h.completedAt);
      return [
        !isNaN(completed.getTime()) ? completed.toLocaleDateString('id-ID') : '-',
        !isNaN(completed.getTime()) ? completed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
        RANAP_CATEGORY_SHORT_LABELS[h.category] || h.category,
        h.patientName,
        h.medicalRecordNo,
        h.roomNumber,
        h.diagnosis || '-',
        h.note || '-',
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([['RIWAYAT ANTREAN RANAP IRM RSPP'], [], headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Ranap');
    XLSX.writeFile(wb, `Riwayat_Antrean_Ranap_${getLocalDateStringWIB()}.xlsx`);
  };

  return (
    // z-70: sengaja lebih tinggi dari RanapQueueModal (z-60) yang membukanya,
    // supaya selalu tampil di depan tanpa bergantung urutan render DOM.
    <div className="fixed inset-0 z-70 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-rose-800 to-slate-900 text-white p-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-600/40 border border-rose-400/40 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black tracking-tight truncate">Riwayat Antrean Ranap</h2>
              <p className="text-[11px] text-rose-200/90 truncate">Pasien rawat inap yang sudah selesai dikerjakan</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFilterSubmit} className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, RM, atau ruangan..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-rose-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="all">Semua Divisi</option>
            <option value="fisio">{RANAP_CATEGORY_LABELS.fisio}</option>
            <option value="okupasi">{RANAP_CATEGORY_LABELS.okupasi}</option>
            <option value="wicara">{RANAP_CATEGORY_LABELS.wicara}</option>
          </select>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs text-slate-700 focus:outline-hidden" />
            <span className="text-slate-400 text-xs">-</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs text-slate-700 focus:outline-hidden" />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Cari</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={history.length === 0}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor</span>
          </button>
        </form>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-16 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-rose-600 mb-2" />
              <p className="text-xs font-bold">Memuat riwayat...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-16 text-center text-slate-400 italic text-xs">
              Belum ada riwayat antrean ranap yang cocok dengan filter.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3">Selesai</th>
                  <th className="p-3">Divisi</th>
                  <th className="p-3">Nama Pasien / RM</th>
                  <th className="p-3">Ruangan</th>
                  <th className="p-3">Diagnosis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => {
                  const completed = new Date(h.completedAt);
                  return (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {!isNaN(completed.getTime())
                          ? `${completed.toLocaleDateString('id-ID')} ${completed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                          : '-'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                          {RANAP_CATEGORY_SHORT_LABELS[h.category] || h.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{h.patientName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">RM: {h.medicalRecordNo}</p>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                          <DoorOpen className="w-3.5 h-3.5 text-rose-500" /> {h.roomNumber}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{h.diagnosis || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">{history.length} riwayat ditemukan</span>
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
