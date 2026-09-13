import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Activity, 
  BarChart3, 
  Users, 
  Stethoscope, 
  Layers, 
  Info,
  Sparkles
} from 'lucide-react';
import { getLocalDateStringWIB } from '../utils/dateHelper';

interface DailyTrendItem {
  date: string;
  day: number;
  total: number;
  fisio: number;
  okupasi: number;
  wicara: number;
}

interface MonthlyTrendItem {
  month: number;
  total: number;
  fisio: number;
  okupasi: number;
  wicara: number;
}

interface VisitTrendsResponse {
  status: string;
  year: number;
  month: number;
  daily: DailyTrendItem[];
  monthly: MonthlyTrendItem[];
  error?: string;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export const VisitTrendCharts: React.FC = () => {
  const todayStr = getLocalDateStringWIB();
  const currentYearMonth = todayStr.slice(0, 7); // "YYYY-MM"
  
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(currentYearMonth);
  const [data, setData] = useState<VisitTrendsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [hoveredDaily, setHoveredDaily] = useState<DailyTrendItem | null>(null);
  const [hoveredMonthly, setHoveredMonthly] = useState<MonthlyTrendItem | null>(null);

  const [targetYear, targetMonth] = useMemo(() => {
    const parts = selectedMonthStr.split('-');
    const y = parseInt(parts[0], 10) || new Date().getFullYear();
    const m = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    return [y, m];
  }, [selectedMonthStr]);

  const fetchTrends = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/analytics/visit-trends?year=${year}&month=${month}`);
      if (!res.ok) {
        throw new Error(`Gagal mengambil data (${res.status})`);
      }
      const json: VisitTrendsResponse = await res.json();
      if (json.status === 'ok') {
        setData(json);
      } else {
        throw new Error(json.error || 'Format data tidak valid');
      }
    } catch (err: any) {
      console.error('Error loading visit trends:', err);
      setErrorMsg(err?.message || 'Gagal memuat tren kunjungan');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrends(targetYear, targetMonth);
  }, [targetYear, targetMonth, fetchTrends]);

  const handlePrevMonth = () => {
    let y = targetYear;
    let m = targetMonth - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonthStr(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    let y = targetYear;
    let m = targetMonth + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonthStr(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleTodayMonth = () => {
    setSelectedMonthStr(currentYearMonth);
  };

  // Summaries
  const monthSummary = useMemo(() => {
    if (!data || !Array.isArray(data.daily)) {
      return { total: 0, fisio: 0, okupasi: 0, wicara: 0, activeDays: 0, avgPerActiveDay: 0, maxDayTotal: 0, maxDayCat: 0 };
    }

    let total = 0;
    let fisio = 0;
    let okupasi = 0;
    let wicara = 0;
    let activeDays = 0;
    let maxDayTotal = 1;
    let maxDayCat = 1;

    data.daily.forEach((d) => {
      total += d.total;
      fisio += d.fisio;
      okupasi += d.okupasi;
      wicara += d.wicara;
      if (d.total > 0) activeDays++;
      if (d.total > maxDayTotal) maxDayTotal = d.total;
      const catMax = Math.max(d.fisio, d.okupasi, d.wicara);
      if (catMax > maxDayCat) maxDayCat = catMax;
    });

    const avgPerActiveDay = activeDays > 0 ? (total / activeDays).toFixed(1) : '0';

    return {
      total,
      fisio,
      okupasi,
      wicara,
      activeDays,
      avgPerActiveDay,
      maxDayTotal,
      maxDayCat
    };
  }, [data]);

  // Max value for yearly monthly chart
  const maxMonthlyTotal = useMemo(() => {
    if (!data || !Array.isArray(data.monthly)) return 10;
    const max = Math.max(...data.monthly.map(m => m.total), 1);
    return max;
  }, [data]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-7">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4 text-teal-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Grafik Tren Kunjungan Pasien IRM
            </h3>
            <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 text-[11px] font-black rounded-full uppercase tracking-wider">
              {MONTH_NAMES_ID[targetMonth - 1]} {targetYear}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Visualisasi analitik kunjungan harian terdeduplikasi, proporsi per divisi, dan akumulasi tahunan.
          </p>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Bulan Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="month"
            value={selectedMonthStr}
            onChange={(e) => {
              if (e.target.value) setSelectedMonthStr(e.target.value);
            }}
            className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
          />

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Bulan Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleTodayMonth}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              selectedMonthStr === currentYearMonth
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Bulan Ini
          </button>

          <button
            type="button"
            onClick={() => fetchTrends(targetYear, targetMonth)}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => fetchTrends(targetYear, targetMonth)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-1 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Kunjungan
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono">{monthSummary.total}</span>
            <span className="text-[11px] text-slate-300">kunjungan</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium block">
            {monthSummary.activeDays} hari operasional
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-100 space-y-1">
          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
            Fisioterapi
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-teal-900 font-mono">{monthSummary.fisio}</span>
            <span className="text-[11px] text-teal-700">kunjungan</span>
          </div>
          <span className="text-[10px] text-teal-600 font-medium block">
            {monthSummary.total > 0 ? `${((monthSummary.fisio / (monthSummary.fisio + monthSummary.okupasi + monthSummary.wicara || 1)) * 100).toFixed(0)}% porsi layanan` : '0%'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100 space-y-1">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
            Terapi Okupasi
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-900 font-mono">{monthSummary.okupasi}</span>
            <span className="text-[11px] text-purple-700">kunjungan</span>
          </div>
          <span className="text-[10px] text-purple-600 font-medium block">
            {monthSummary.total > 0 ? `${((monthSummary.okupasi / (monthSummary.fisio + monthSummary.okupasi + monthSummary.wicara || 1)) * 100).toFixed(0)}% porsi layanan` : '0%'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100 space-y-1">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
            Terapi Wicara
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-900 font-mono">{monthSummary.wicara}</span>
            <span className="text-[11px] text-amber-700">kunjungan</span>
          </div>
          <span className="text-[10px] text-amber-600 font-medium block">
            {monthSummary.total > 0 ? `${((monthSummary.wicara / (monthSummary.fisio + monthSummary.okupasi + monthSummary.wicara || 1)) * 100).toFixed(0)}% porsi layanan` : '0%'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Rata-rata Harian
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">{monthSummary.avgPerActiveDay}</span>
            <span className="text-[11px] text-slate-500">pasien / hari</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            Maks: {monthSummary.maxDayTotal} pasien/hari
          </span>
        </div>
      </div>

      {/* CHART 1: Kunjungan Harian Total */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
              1. Kunjungan Harian Total ({MONTH_NAMES_ID[targetMonth - 1]} {targetYear})
            </h4>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                <strong>Aturan Dedup:</strong> 1 pasien yang ditangani di Fisio, Okupasi, dan Wicara pada hari yang sama dihitung 1 kunjungan (dedup No. RM / Nama).
              </span>
            </p>
          </div>
          {hoveredDaily && (
            <div className="text-xs font-mono bg-slate-900 text-white px-3 py-1 rounded-lg shadow-sm shrink-0">
              Tgl {hoveredDaily.day}: <strong>{hoveredDaily.total}</strong> Pasien (F: {hoveredDaily.fisio}, O: {hoveredDaily.okupasi}, W: {hoveredDaily.wicara})
            </div>
          )}
        </div>

        {/* Daily Bar Chart Container */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200">
          <div className="h-44 flex items-end gap-1 sm:gap-1.5 pt-6 pb-2 overflow-x-auto no-scrollbar">
            {data?.daily.map((item) => {
              const isToday = item.date === todayStr;
              const heightPercent = monthSummary.maxDayTotal > 0
                ? Math.round((item.total / monthSummary.maxDayTotal) * 100)
                : 0;

              return (
                <div
                  key={item.date}
                  onMouseEnter={() => setHoveredDaily(item)}
                  onMouseLeave={() => setHoveredDaily(null)}
                  className="flex-1 min-w-[20px] sm:min-w-[24px] h-full flex flex-col justify-end items-center group cursor-pointer relative"
                >
                  {/* Bar Value Tooltip */}
                  {item.total > 0 && (
                    <span className="text-[10px] font-mono font-bold text-slate-700 mb-1 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                      {item.total}
                    </span>
                  )}

                  {/* Bar Column */}
                  <div className="w-full bg-slate-200 rounded-t-md relative flex items-end overflow-hidden" style={{ height: '100%' }}>
                    <div
                      className={`w-full transition-all duration-300 rounded-t-md ${
                        isToday
                          ? 'bg-gradient-to-t from-teal-700 to-teal-500 shadow-sm'
                          : item.total > 0
                          ? 'bg-gradient-to-t from-slate-800 to-slate-600 group-hover:from-teal-600 group-hover:to-teal-500'
                          : 'bg-transparent'
                      }`}
                      style={{ height: `${Math.max(heightPercent, item.total > 0 ? 6 : 0)}%` }}
                    />
                  </div>

                  {/* Day Label */}
                  <span className={`text-[10px] font-mono mt-1.5 transition-colors ${
                    isToday
                      ? 'font-black text-teal-700 bg-teal-100 px-1 rounded-sm'
                      : 'text-slate-500 group-hover:text-slate-900 font-semibold'
                  }`}>
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CHART 2: Kunjungan Harian per Divisi */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                2. Kunjungan Harian per Divisi (Fisio / Okupasi / Wicara)
              </h4>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="flex items-center gap-1 text-teal-700">
                  <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 inline-block" /> Fisio ({monthSummary.fisio})
                </span>
                <span className="flex items-center gap-1 text-purple-700">
                  <span className="w-2.5 h-2.5 rounded-xs bg-purple-500 inline-block" /> Okupasi ({monthSummary.okupasi})
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> Wicara ({monthSummary.wicara})
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                <strong>Aturan Dedup:</strong> Tiap divisi dihitung terpisah (dedup di dalam divisi yang sama). Pasien lintas divisi tetap muncul di masing-masing grafik divisinya.
              </span>
            </p>
          </div>
        </div>

        {/* Grouped Bar Chart Container */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200">
          <div className="h-48 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 overflow-x-auto no-scrollbar">
            {data?.daily.map((item) => {
              const isToday = item.date === todayStr;
              const maxCat = Math.max(monthSummary.maxDayCat, 1);
              const hFisio = Math.round((item.fisio / maxCat) * 100);
              const hOkupasi = Math.round((item.okupasi / maxCat) * 100);
              const hWicara = Math.round((item.wicara / maxCat) * 100);

              return (
                <div
                  key={`cat-${item.date}`}
                  onMouseEnter={() => setHoveredDaily(item)}
                  onMouseLeave={() => setHoveredDaily(null)}
                  className="flex-1 min-w-[28px] sm:min-w-[34px] h-full flex flex-col justify-end items-center group cursor-pointer"
                >
                  {/* Grouped 3 bars */}
                  <div className="w-full flex items-end justify-center gap-0.5 h-full bg-slate-100/60 rounded-t-md p-0.5">
                    {/* Fisio */}
                    <div
                      className="flex-1 rounded-t-xs bg-teal-500 hover:bg-teal-600 transition-all"
                      style={{ height: `${item.fisio > 0 ? Math.max(hFisio, 8) : 0}%` }}
                      title={`Fisioterapi: ${item.fisio}`}
                    />
                    {/* Okupasi */}
                    <div
                      className="flex-1 rounded-t-xs bg-purple-500 hover:bg-purple-600 transition-all"
                      style={{ height: `${item.okupasi > 0 ? Math.max(hOkupasi, 8) : 0}%` }}
                      title={`Okupasi Terapi: ${item.okupasi}`}
                    />
                    {/* Wicara */}
                    <div
                      className="flex-1 rounded-t-xs bg-amber-500 hover:bg-amber-600 transition-all"
                      style={{ height: `${item.wicara > 0 ? Math.max(hWicara, 8) : 0}%` }}
                      title={`Terapi Wicara: ${item.wicara}`}
                    />
                  </div>

                  {/* Day Label */}
                  <span className={`text-[10px] font-mono mt-1.5 transition-colors ${
                    isToday
                      ? 'font-black text-teal-700 bg-teal-100 px-1 rounded-sm'
                      : 'text-slate-500 group-hover:text-slate-900 font-semibold'
                  }`}>
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CHART 3: Kunjungan Bulanan (Jan - Des) */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
              3. Kunjungan Bulanan Sepanjang Tahun {targetYear} (Jan - Des)
            </h4>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                <strong>Aturan Akumulasi:</strong> Jumlah kunjungan pasien (pasien yang datang 5 hari berbeda dalam sebulan dihitung 5 kunjungan), dijumlahkan dari total harian terdeduplikasi.
              </span>
            </p>
          </div>
          {hoveredMonthly && (
            <div className="text-xs font-mono bg-indigo-950 text-white px-3 py-1 rounded-lg shadow-sm shrink-0">
              {MONTH_NAMES_ID[hoveredMonthly.month - 1]}: <strong>{hoveredMonthly.total}</strong> Kunjungan (F: {hoveredMonthly.fisio}, O: {hoveredMonthly.okupasi}, W: {hoveredMonthly.wicara})
            </div>
          )}
        </div>

        {/* Monthly Bar Chart Container */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200">
          <div className="h-44 flex items-end gap-2 sm:gap-4 pt-6 pb-2">
            {data?.monthly.map((item) => {
              const isSelected = item.month === targetMonth;
              const heightPercent = maxMonthlyTotal > 0
                ? Math.round((item.total / maxMonthlyTotal) * 100)
                : 0;

              return (
                <div
                  key={`month-${item.month}`}
                  onMouseEnter={() => setHoveredMonthly(item)}
                  onMouseLeave={() => setHoveredMonthly(null)}
                  onClick={() => setSelectedMonthStr(`${targetYear}-${String(item.month).padStart(2, '0')}`)}
                  className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                >
                  {/* Bar Value Tooltip */}
                  {item.total > 0 && (
                    <span className="text-[11px] font-mono font-bold text-slate-700 mb-1 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                      {item.total}
                    </span>
                  )}

                  {/* Bar Column */}
                  <div className="w-full bg-slate-200 rounded-t-lg relative flex items-end overflow-hidden" style={{ height: '100%' }}>
                    <div
                      className={`w-full transition-all duration-300 rounded-t-lg ${
                        isSelected
                          ? 'bg-gradient-to-t from-indigo-700 to-indigo-500 shadow-md ring-2 ring-indigo-400/50'
                          : item.total > 0
                          ? 'bg-gradient-to-t from-slate-700 to-slate-500 group-hover:from-indigo-600 group-hover:to-indigo-500'
                          : 'bg-transparent'
                      }`}
                      style={{ height: `${Math.max(heightPercent, item.total > 0 ? 6 : 0)}%` }}
                    />
                  </div>

                  {/* Month Label */}
                  <span className={`text-[11px] font-bold mt-1.5 transition-colors ${
                    isSelected
                      ? 'text-indigo-700 font-black bg-indigo-100 px-2 py-0.5 rounded-md'
                      : 'text-slate-600 group-hover:text-slate-900'
                  }`}>
                    {MONTH_SHORT_ID[item.month - 1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
