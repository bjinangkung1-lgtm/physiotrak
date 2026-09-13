import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2, TrendingUp, Calendar } from 'lucide-react';

interface DailyTrendPoint {
  date: string;
  day: number;
  total: number;
  fisio: number;
  okupasi: number;
  wicara: number;
}

interface MonthlyTrendPoint {
  month: number;
  total: number;
  fisio: number;
  okupasi: number;
  wicara: number;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Bar chart minimal tanpa dependency eksternal - satu bar per titik data,
// tinggi proporsional terhadap nilai maksimum pada set data yang sama.
const MiniBarChart: React.FC<{
  labels: string[];
  values: number[];
  color: string; // kelas tailwind bg-*
  formatTooltip: (idx: number) => string;
  heightClass?: string;
}> = ({ labels, values, color, formatTooltip, heightClass = 'h-32' }) => {
  const max = Math.max(1, ...values);
  return (
    <div className={`flex items-end gap-1 ${heightClass} w-full`}>
      {values.map((v, idx) => (
        <div
          key={idx}
          className="flex-1 min-w-[6px] flex flex-col items-center justify-end h-full group relative"
          title={formatTooltip(idx)}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap z-10 shadow-lg">
            {formatTooltip(idx)}
          </div>
          <div
            className={`w-full rounded-t-sm ${color} transition-all group-hover:opacity-80`}
            style={{ height: `${v > 0 ? Math.max(3, (v / max) * 100) : 1}%` }}
          />
          <span className="text-[9px] text-slate-400 font-bold mt-1 truncate max-w-full">{labels[idx]}</span>
        </div>
      ))}
    </div>
  );
};

// Grouped bar chart - 3 bar (Fisio/Okupasi/Wicara) berdampingan per titik data.
const GroupedBarChart: React.FC<{
  labels: string[];
  series: { key: string; label: string; color: string; values: number[] }[];
  formatTooltip: (idx: number) => string;
  heightClass?: string;
}> = ({ labels, series, formatTooltip, heightClass = 'h-32' }) => {
  const max = Math.max(1, ...series.flatMap(s => s.values));
  return (
    <div className={`flex items-end gap-1.5 ${heightClass} w-full`}>
      {labels.map((label, idx) => (
        <div key={idx} className="flex-1 min-w-[10px] flex flex-col items-center justify-end h-full group relative">
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg">
            {formatTooltip(idx)}
          </div>
          <div className="flex items-end gap-0.5 w-full h-full justify-center">
            {series.map((s) => (
              <div
                key={s.key}
                className={`flex-1 max-w-[8px] rounded-t-sm ${s.color} transition-all group-hover:opacity-80`}
                style={{ height: `${s.values[idx] > 0 ? Math.max(3, (s.values[idx] / max) * 100) : 1}%` }}
              />
            ))}
          </div>
          <span className="text-[9px] text-slate-400 font-bold mt-1 truncate max-w-full">{label}</span>
        </div>
      ))}
    </div>
  );
};

export const VisitTrendCharts: React.FC = () => {
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedYearMonth, setSelectedYearMonth] = useState(defaultYearMonth);
  const [daily, setDaily] = useState<DailyTrendPoint[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [yearStr, monthStr] = selectedYearMonth.split('-');
  const selectedYear = parseInt(yearStr, 10);
  const selectedMonth = parseInt(monthStr, 10);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    fetch(`/api/analytics/visit-trends?year=${selectedYear}&month=${selectedMonth}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.status === 'ok') {
          setDaily(Array.isArray(data.daily) ? data.daily : []);
          setMonthly(Array.isArray(data.monthly) ? data.monthly : []);
        } else {
          setError('Gagal memuat data grafik kunjungan.');
        }
      })
      .catch(() => {
        if (isMounted) setError('Gagal memuat data grafik kunjungan.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedYear, selectedMonth]);

  const dailyLabels = useMemo(() => daily.map((d) => String(d.day)), [daily]);
  const dailyTotals = useMemo(() => daily.map((d) => d.total), [daily]);
  const monthlyLabels = MONTH_SHORT_ID;
  const monthlyTotals = useMemo(() => {
    const arr = new Array(12).fill(0);
    monthly.forEach((m) => { arr[m.month - 1] = m.total; });
    return arr;
  }, [monthly]);

  const totalThisMonth = dailyTotals.reduce((a, b) => a + b, 0);
  const totalThisYear = monthlyTotals.reduce((a, b) => a + b, 0);
  const avgPerDay = daily.length > 0 ? Math.round((totalThisMonth / daily.length) * 10) / 10 : 0;

  return (
    <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Grafik Tren Kunjungan</h3>
            <p className="text-[11px] text-slate-500 font-medium">Total pasien unik per hari &amp; total kunjungan per bulan</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="month"
            value={selectedYearMonth}
            onChange={(e) => setSelectedYearMonth(e.target.value)}
            className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400">
          <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
          <p className="text-xs font-bold">Memuat data grafik...</p>
        </div>
      ) : error ? (
        <p className="text-xs text-rose-500 font-bold text-center py-8">{error}</p>
      ) : (
        <>
          {/* Grafik 1: Kunjungan Harian Total */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wide">
                Kunjungan Harian Total &bull; {MONTH_NAMES_ID[selectedMonth - 1]} {selectedYear}
              </p>
              <span className="text-[11px] font-bold text-slate-500">
                Total: <span className="text-teal-700 font-black">{totalThisMonth}</span> &bull; Rata-rata/hari: <span className="text-teal-700 font-black">{avgPerDay}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2 italic">
              1 pasien yang ditangani di Fisio, Okupasi &amp; Wicara pada hari yang sama dihitung 1 kunjungan.
            </p>
            <MiniBarChart
              labels={dailyLabels}
              values={dailyTotals}
              color="bg-teal-500"
              formatTooltip={(idx) => `Tgl ${daily[idx]?.day}: ${daily[idx]?.total} pasien`}
            />
          </div>

          {/* Grafik 2: Kunjungan Harian per Divisi */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wide">
                Kunjungan Harian per Divisi
              </p>
              <div className="flex items-center gap-2.5 text-[10px] font-bold">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-teal-600 inline-block" /> Fisio</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-600 inline-block" /> Okupasi</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> Wicara</span>
              </div>
            </div>
            <GroupedBarChart
              labels={dailyLabels}
              series={[
                { key: 'fisio', label: 'Fisio', color: 'bg-teal-600', values: daily.map(d => d.fisio) },
                { key: 'okupasi', label: 'Okupasi', color: 'bg-purple-600', values: daily.map(d => d.okupasi) },
                { key: 'wicara', label: 'Wicara', color: 'bg-amber-500', values: daily.map(d => d.wicara) },
              ]}
              formatTooltip={(idx) => (
                `Tgl ${daily[idx]?.day} - Fisio: ${daily[idx]?.fisio} | Okupasi: ${daily[idx]?.okupasi} | Wicara: ${daily[idx]?.wicara}`
              )}
            />
          </div>

          {/* Grafik 3: Kunjungan Bulanan */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wide">
                Kunjungan Bulanan &bull; Tahun {selectedYear}
              </p>
              <span className="text-[11px] font-bold text-slate-500">
                Total setahun: <span className="text-indigo-700 font-black">{totalThisYear}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2 italic">
              Jumlah kunjungan (bukan pasien unik) - 1 pasien yang datang beberapa hari berbeda dalam sebulan dihitung sejumlah hari kedatangannya.
            </p>
            <MiniBarChart
              labels={monthlyLabels}
              values={monthlyTotals}
              color="bg-indigo-500"
              formatTooltip={(idx) => `${MONTH_NAMES_ID[idx]} ${selectedYear}: ${monthlyTotals[idx]} kunjungan`}
              heightClass="h-36"
            />
          </div>
        </>
      )}
    </div>
  );
};
