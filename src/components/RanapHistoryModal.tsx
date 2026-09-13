import React, { useState, useEffect, useCallback } from 'react';
import { X, History, Search, Filter, Download, Calendar, BedDouble, RefreshCw, Loader2, DoorOpen, Stethoscope, FileText, CheckCircle2 } from 'lucide-react';
import { RanapCategory, RanapHistoryItem } from '../types';
import { databaseService } from '../utils/databaseService';
import { RANAP_CATEGORY_SHORT_LABELS, RANAP_CATEGORY_LABELS } from '../utils/ranapQueueUtils';
import * as XLSX from 'xlsx';

interface RanapHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RanapHistoryModal: React.FC<RanapHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [history, setHistory] = useState<RanapHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RanapCategory>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadHistoryData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await databaseService.getRanapHistory({
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        search: searchQuery.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setHistory(data);
    } catch (err) {
      console.error('Error fetching ranap history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, searchQuery, startDate, endDate]);

  useEffect(() => {
    if (isOpen) {
      loadHistoryData();
    }
  }, [isOpen, loadHistoryData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadHistoryData();
  };

  const handleExportExcel = () => {
    if (history.length === 0) return;

    const headers = [
      'No',
      'Tanggal Selesai',
      'Waktu Selesai',
      'Divisi Layanan',
      'Nama Pasien',
      'No. Rekam Medis (RM)',
      'No. Ruangan',
      'Diagnosis / Tindakan',
      'Catatan / Instruksi',
      'Terapis / Petugas'
    ];

    const rows = history.map((item, index) => {
      const completedDate = item.completedAt ? new Date(item.completedAt) : null;
      const dateStr = completedDate ? completedDate.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-';
      const timeStr = completedDate ? completedDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

      return [
        index + 1,
        dateStr,
        timeStr,
        RANAP_CATEGORY_SHORT_LABELS[item.category] || item.category,
        item.patientName,
        item.medicalRecordNo,
        item.roomNumber,
        item.diagnosis || '-',
        item.note || '-',
        item.officerName || '-'
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Ranap IRM');

    const fileName = `Riwayat_Ranap_IRM_RSPP_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (!isOpen) return null;

  const getCategoryBadgeClass = (category: RanapCategory) => {
    switch (category) {
      case 'fisio':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'okupasi':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'wicara':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    // z-70: sengaja lebih tinggi dari RanapQueueModal (z-60) yang membukanya,
    // supaya selalu tampil di depan tanpa bergantung urutan render DOM.
    <div
      id="modal-ranap-history-overlay"
      className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="modal-ranap-history-content"
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800 shadow-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <History className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Riwayat Selesai Antrean Ranap
                <span className="px-2 py-0.5 text-xs bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full font-semibold">
                  {history.length} Pasien
                </span>
              </h2>
              <p className="text-xs text-indigo-200/70">Arsip permanen tindakan rehabilitasi medis pasien rawat inap</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-export-ranap-history"
              type="button"
              onClick={handleExportExcel}
              disabled={history.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4" />
              Ekspor Excel
            </button>
            <button
              id="btn-close-ranap-history"
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, No RM, ruangan, diagnosis..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
              />
            </div>

            {/* Divisi Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-medium"
              >
                <option value="all">Semua Divisi Ranap</option>
                <option value="fisio">Fisioterapi</option>
                <option value="okupasi">Okupasi Terapi</option>
                <option value="wicara">Terapi Wicara</option>
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Tanggal Mulai"
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="Tanggal Akhir"
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-xl transition-colors"
                title="Reset Filter"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Content Body / Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Memuat data riwayat ranap...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Belum Ada Riwayat Tindakan Ranap</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Pasien ranap yang telah diselesaikan (diceklis) dari antrean aktif akan otomatis masuk ke dalam daftar riwayat ini secara permanen.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-3.5 py-3 w-12 text-center">No</th>
                    <th className="px-3.5 py-3 w-36">Waktu Selesai</th>
                    <th className="px-3.5 py-3 w-28">Divisi</th>
                    <th className="px-3.5 py-3">Nama Pasien & No. RM</th>
                    <th className="px-3.5 py-3 w-28">Ruangan</th>
                    <th className="px-3.5 py-3">Diagnosis & Catatan</th>
                    <th className="px-3.5 py-3 w-32">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                  {history.map((item, idx) => {
                    const completedDate = item.completedAt ? new Date(item.completedAt) : null;
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          {completedDate ? (
                            <div>
                              <div className="font-bold text-slate-800">
                                {completedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold">
                                {completedDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryBadgeClass(
                              item.category
                            )}`}
                          >
                            {RANAP_CATEGORY_SHORT_LABELS[item.category] || item.category}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="font-bold text-slate-900 text-sm">{item.patientName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                            <span>RM:</span>
                            <span className="font-bold text-slate-700">{item.medicalRecordNo}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg font-bold text-xs">
                            <DoorOpen className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{item.roomNumber}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-3 space-y-1">
                          {item.diagnosis ? (
                            <div className="text-xs text-slate-800 font-medium flex items-start gap-1">
                              <Stethoscope className="w-3 h-3 text-indigo-500 mt-0.5 shrink-0" />
                              <span>{item.diagnosis}</span>
                            </div>
                          ) : null}
                          {item.note ? (
                            <div className="text-[11px] text-slate-500 italic flex items-start gap-1">
                              <FileText className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                              <span>{item.note}</span>
                            </div>
                          ) : null}
                          {!item.diagnosis && !item.note ? <span className="text-slate-400">-</span> : null}
                        </td>
                        <td className="px-3.5 py-3 text-slate-600">
                          {item.officerName ? (
                            <span className="text-xs font-semibold text-slate-800">{item.officerName}</span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            Menampilkan <span className="font-bold text-slate-700">{history.length}</span> catatan riwayat ranap.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
