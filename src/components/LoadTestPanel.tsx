import React, { useState } from 'react';

// Panel tes beban tersembunyi. Hanya muncul kalau URL diakses dengan
// ?loadtest=IRM2026 di belakangnya, supaya tidak terlihat/tidak sengaja
// terpencet oleh staf saat pemakaian normal. Semua data yang dibuat panel
// ini diberi id berawalan "LOADTEST-" dan No. RM berawalan "TESLT" supaya
// jelas dibedakan dari data pasien asli dan mudah dibersihkan lagi.
const LoadTestPanel: React.FC = () => {
  const isActive = typeof window !== 'undefined' && window.location.search.includes('loadtest=IRM2026');
  const [running, setRunning] = useState(false);
  const [purging, setPurging] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  if (!isActive) return null;

  const addLog = (line: string) => setLog(prev => [...prev, line]);

  const runTest = async () => {
    setRunning(true);
    setLog([]);
    const DEVICE_COUNT = 30;
    const runId = Date.now();

    try {
      addLog('Mengambil daftar kotak aktif...');
      const stateRes = await fetch('/api/queue');
      const stateJson = await stateRes.json();
      const state = stateJson.state || {};
      const boxes: any[] = Array.isArray(state.boxes) ? state.boxes : [];
      if (boxes.length === 0) {
        addLog('GAGAL: tidak ada kotak ditemukan.');
        setRunning(false);
        return;
      }
      addLog(`Ditemukan ${boxes.length} kotak. Menyiapkan ${DEVICE_COUNT} pasien tes...`);

      const testPatients = Array.from({ length: DEVICE_COUNT }, (_, i) => {
        const box = boxes[i % boxes.length];
        return {
          id: `LOADTEST-${runId}-${i}`,
          boxId: box.id,
          boxTitle: box.title,
          officerName: box.officerName,
          category: box.category,
          queueNumber: `TES-${i + 1}`,
          patientName: `TES LOADTEST ${i + 1}`,
          medicalRecordNo: `TESLT${900000 + i}`,
          actionCode: 'TES',
          diagnosis: 'Data uji beban (bukan pasien asli)',
          completed: false,
          calledCount: 0,
          createdAt: new Date().toISOString(),
        };
      });

      const t0 = performance.now();
      addLog(`Menembak ${DEVICE_COUNT} permintaan tambah-pasien secara BERSAMAAN...`);
      const addResults = await Promise.allSettled(
        testPatients.map(p =>
          fetch('/api/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patients: [p],
              boxes: [],
              senderDeviceId: `loadtest-device-${p.id}`,
            }),
          })
        )
      );
      const addOk = addResults.filter(r => r.status === 'fulfilled').length;
      const t1 = performance.now();
      addLog(`Tambah-pasien selesai: ${addOk}/${DEVICE_COUNT} berhasil (${((t1 - t0) / 1000).toFixed(2)} detik).`);

      await new Promise(r => setTimeout(r, 1000));

      addLog(`Menembak ${DEVICE_COUNT} permintaan selesaikan-pasien secara BERSAMAAN...`);
      const t2 = performance.now();
      const completeResults = await Promise.allSettled(
        testPatients.map(p =>
          fetch('/api/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patients: [{ ...p, completed: true, completedAt: new Date().toISOString() }],
              boxes: [],
              senderDeviceId: `loadtest-device-${p.id}`,
            }),
          })
        )
      );
      const completeOk = completeResults.filter(r => r.status === 'fulfilled').length;
      const t3 = performance.now();
      addLog(`Selesaikan-pasien selesai: ${completeOk}/${DEVICE_COUNT} berhasil (${((t3 - t2) / 1000).toFixed(2)} detik).`);

      addLog('Memverifikasi data akhir di server...');
      const verifyRes = await fetch('/api/queue');
      const verifyJson = await verifyRes.json();
      const verifyState = verifyJson.state || {};
      const verifyPatients: any[] = Array.isArray(verifyState.patients) ? verifyState.patients : [];
      const found = testPatients.filter(p => verifyPatients.some(vp => vp.id === p.id));
      const foundCompleted = testPatients.filter(p => verifyPatients.some(vp => vp.id === p.id && vp.completed));

      addLog('=== HASIL AKHIR ===');
      addLog(`Total waktu: ${((t3 - t0) / 1000).toFixed(2)} detik untuk ${DEVICE_COUNT} perangkat simulasi.`);
      addLog(`Pasien berhasil tersimpan: ${found.length}/${DEVICE_COUNT}`);
      addLog(`Pasien berhasil ditandai selesai: ${foundCompleted.length}/${DEVICE_COUNT}`);
      addLog(found.length === DEVICE_COUNT && foundCompleted.length === DEVICE_COUNT
        ? '✅ TIDAK ADA DATA HILANG. Server aman menangani 30 perangkat bersamaan.'
        : '⚠️ ADA DATA YANG TIDAK SESUAI, cek ulang atau ulangi tes.');
      addLog('Tekan tombol "Hapus Semua Data Tes" untuk membersihkan.');
    } catch (err: any) {
      addLog(`GAGAL: ${err?.message || err}`);
    } finally {
      setRunning(false);
    }
  };

  const purgeTestData = async () => {
    setPurging(true);
    try {
      addLog('Menunggu sinkronisasi arsip selesai...');
      await new Promise(r => setTimeout(r, 2000));
      addLog('Membersihkan data tes...');
      const res = await fetch('/api/queue');
      const stateJson = await res.json();
      const state = stateJson.state || {};
      const patients: any[] = Array.isArray(state.patients) ? state.patients : [];
      const testIds = patients.filter(p => String(p.id || '').startsWith('LOADTEST-')).map(p => p.id);

      if (testIds.length === 0) {
        addLog('Tidak ada data tes tersisa di antrian aktif.');
      } else {
        await fetch('/api/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patients: [],
            boxes: [],
            deletedPatientIds: testIds,
            senderDeviceId: 'loadtest-cleanup',
          }),
        });
        addLog(`${testIds.length} data tes dihapus dari antrian aktif.`);
      }

      const purgeRes = await fetch('/api/loadtest/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idPrefix: 'LOADTEST-' }),
      });
      const purgeJson = await purgeRes.json();
      addLog(`Data tes dihapus dari arsip harian hari ini: ${purgeJson.removed ?? 0} entri.`);
      addLog('✅ Pembersihan selesai.');
    } catch (err: any) {
      addLog(`GAGAL membersihkan: ${err?.message || err}`);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 99999, width: 340, maxWidth: '90vw', background: '#111827', color: '#f9fafb', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 12, fontFamily: 'monospace' }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 13 }}>🧪 PANEL TES BEBAN (30 Perangkat)</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={runTest}
          disabled={running || purging}
          style={{ flex: 1, background: running ? '#4b5563' : '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '8px 10px', fontWeight: 'bold', cursor: running ? 'default' : 'pointer' }}
        >
          {running ? 'Sedang berjalan...' : 'Jalankan Tes 30 Perangkat'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={purgeTestData}
          disabled={running || purging}
          style={{ flex: 1, background: purging ? '#4b5563' : '#b91c1c', color: 'white', border: 'none', borderRadius: 8, padding: '8px 10px', fontWeight: 'bold', cursor: purging ? 'default' : 'pointer' }}
        >
          {purging ? 'Membersihkan...' : 'Hapus Semua Data Tes'}
        </button>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', background: '#000', borderRadius: 8, padding: 8, lineHeight: 1.5 }}>
        {log.length === 0 ? (
          <div style={{ opacity: 0.5 }}>Belum ada tes dijalankan.</div>
        ) : (
          log.map((l, i) => <div key={i}>{l}</div>)
        )}
      </div>
    </div>
  );
};

export default LoadTestPanel;
