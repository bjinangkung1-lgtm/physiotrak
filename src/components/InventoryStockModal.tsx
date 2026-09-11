import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Package,
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Download,
  Printer,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Sparkles,
  Activity,
  Boxes,
  ClipboardList,
  SlidersHorizontal,
  ChevronDown,
  Info,
  ShieldCheck,
  Check,
  Building,
  RotateCcw
} from 'lucide-react';
import { InventoryItem, StockMutation, InventoryCategory, ToolCondition, QueueBox } from '../types';
import {
  getInventoryItems,
  saveInventoryItems,
  getStockMutations,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordStockMutation,
  resetInventoryToDefault,
  exportInventoryReportPDF,
  exportInventoryToCSV,
  fetchInventoryFromDb,
  subscribeInventorySync,
  INVENTORY_CATEGORIES,
  getInventoryCategoryLabel,
  getInventoryCategoryIcon,
  getInventoryCategoryBadgeClass,
  getStockStatus,
  getConditionBadge
} from '../utils/inventoryStockService';
import { extractTherapistsList } from '../utils/lainLainService';

interface InventoryStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes?: QueueBox[];
}

export const InventoryStockModal: React.FC<InventoryStockModalProps> = ({
  isOpen,
  onClose,
  boxes = []
}) => {
  const [activeTab, setActiveTab] = useState<'katalog' | 'mutasi_form' | 'riwayat' | 'kritis'>('katalog');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [mutations, setMutations] = useState<StockMutation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'menipis_habis' | 'aman'>('all');

  // Form State: Add/Edit Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState<InventoryCategory>('bhp');
  const [itemQuantity, setItemQuantity] = useState<string>('1');
  const [itemMinStock, setItemMinStock] = useState<string>('2');
  const [itemUnit, setItemUnit] = useState('Pcs');
  const [itemLocation, setItemLocation] = useState('Gudang IRM');
  const [itemCondition, setItemCondition] = useState<ToolCondition>('baik');
  const [itemBrand, setItemBrand] = useState('');
  const [itemSpec, setItemSpec] = useState('');
  const [itemExpiryDate, setItemExpiryDate] = useState('');
  const [itemNotes, setItemNotes] = useState('');

  // Form State: Quick Stock Mutation
  const [mutationItemId, setMutationItemId] = useState('');
  const [mutationType, setMutationType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [mutationQty, setMutationQty] = useState<string>('1');
  const [mutationDate, setMutationDate] = useState(new Date().toISOString().slice(0, 10));
  const [mutationOfficer, setMutationOfficer] = useState('');
  const [mutationRecipientOrSource, setMutationRecipientOrSource] = useState('');
  const [mutationNotes, setMutationNotes] = useState('');
  const [mutationFeedback, setMutationFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load staff/therapist names
  const therapistList = useMemo(() => extractTherapistsList(boxes), [boxes]);

  // Load data on open & subscribe to real-time database updates
  useEffect(() => {
    if (isOpen) {
      const loadedItems = getInventoryItems();
      const loadedMutations = getStockMutations();
      setItems(loadedItems);
      setMutations(loadedMutations);

      if (therapistList.length > 0 && !mutationOfficer) {
        setMutationOfficer(therapistList[0]);
      }

      // Fetch fresh data from central server / cloud DB
      fetchInventoryFromDb().then(fresh => {
        if (fresh) {
          if (Array.isArray(fresh.items)) setItems(fresh.items);
          if (Array.isArray(fresh.mutations)) setMutations(fresh.mutations);
        }
      });

      // Subscribe to real-time sync across devices
      const unsubscribe = subscribeInventorySync((data) => {
        if (data) {
          if (Array.isArray(data.items)) setItems(data.items);
          if (Array.isArray(data.mutations)) setMutations(data.mutations);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, therapistList]);

  // Reset feedback message after 4s
  useEffect(() => {
    if (mutationFeedback) {
      const t = setTimeout(() => setMutationFeedback(null), 4000);
      return () => clearTimeout(t);
    }
  }, [mutationFeedback]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (stockStatusFilter === 'menipis_habis') {
        if (item.quantity > item.minStock) return false;
      } else if (stockStatusFilter === 'aman') {
        if (item.quantity <= item.minStock) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchLoc = item.location.toLowerCase().includes(q);
        const matchBrand = (item.brand || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchLoc && !matchBrand) return false;
      }
      return true;
    });
  }, [items, selectedCategory, stockStatusFilter, searchQuery]);

  // Critical Stock items
  const criticalItems = useMemo(() => {
    return items.filter(i => i.quantity <= i.minStock);
  }, [items]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalItems = items.length;
    const criticalCount = criticalItems.length;
    const bhpCount = items.filter(i => i.category === 'bhp').length;
    const toolsCount = items.filter(i => i.category === 'alat_fisio' || i.category === 'alat_okupasi' || i.category === 'alat_wicara').length;
    const atkCount = items.filter(i => i.category === 'logistik_atk').length;
    return { totalItems, criticalCount, bhpCount, toolsCount, atkCount };
  }, [items, criticalItems]);

  // Open Add Item Modal
  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemCode(`BHP-00${items.length + 1}`);
    setItemName('');
    setItemCategory('bhp');
    setItemQuantity('1');
    setItemMinStock('2');
    setItemUnit('Pcs');
    setItemLocation('Gudang IRM');
    setItemCondition('baik');
    setItemBrand('');
    setItemSpec('');
    setItemExpiryDate('');
    setItemNotes('');
    setIsItemModalOpen(true);
  };

  // Open Edit Item Modal
  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemCode(item.code);
    setItemName(item.name);
    setItemCategory(item.category);
    setItemQuantity(item.quantity.toString());
    setItemMinStock(item.minStock.toString());
    setItemUnit(item.unit);
    setItemLocation(item.location);
    setItemCondition(item.condition || 'baik');
    setItemBrand(item.brand || '');
    setItemSpec(item.specification || '');
    setItemExpiryDate(item.expiryDate || '');
    setItemNotes(item.notes || '');
    setIsItemModalOpen(true);
  };

  // Save Item (Create / Edit)
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemCode.trim()) {
      alert('Mohon isi kode dan nama barang.');
      return;
    }

    const qty = parseInt(itemQuantity, 10) || 0;
    const minStk = parseInt(itemMinStock, 10) || 0;

    if (editingItem) {
      // Update
      const updated = updateInventoryItem(editingItem.id, {
        code: itemCode.trim().toUpperCase(),
        name: itemName.trim(),
        category: itemCategory,
        quantity: qty,
        minStock: minStk,
        unit: itemUnit.trim(),
        location: itemLocation.trim(),
        condition: itemCondition,
        brand: itemBrand.trim(),
        specification: itemSpec.trim(),
        expiryDate: itemExpiryDate || undefined,
        notes: itemNotes.trim()
      });
      setItems(updated);
    } else {
      // Add
      const created = addInventoryItem({
        code: itemCode.trim().toUpperCase(),
        name: itemName.trim(),
        category: itemCategory,
        quantity: qty,
        minStock: minStk,
        unit: itemUnit.trim(),
        location: itemLocation.trim(),
        condition: itemCondition,
        brand: itemBrand.trim(),
        specification: itemSpec.trim(),
        expiryDate: itemExpiryDate || undefined,
        notes: itemNotes.trim()
      });
      setItems(prev => [created, ...prev]);
    }

    setIsItemModalOpen(false);
  };

  // Delete Item
  const handleDeleteItem = (item: InventoryItem) => {
    if (window.confirm(`Yakin ingin menghapus data inventaris "${item.name}" (${item.code})?`)) {
      const updated = deleteInventoryItem(item.id);
      setItems(updated);
    }
  };

  // Open Quick Mutation for an item
  const handleOpenQuickMutation = (item: InventoryItem, type: 'in' | 'out') => {
    setMutationItemId(item.id);
    setMutationType(type);
    setMutationQty('1');
    setMutationDate(new Date().toISOString().slice(0, 10));
    setMutationRecipientOrSource(
      type === 'in' ? 'Penerimaan dari Logistik / Farmasi RS' : 'Penggunaan Ruang Terapi IRM'
    );
    setActiveTab('mutasi_form');
  };

  // Submit Stock Mutation
  const handleSubmitMutation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mutationItemId) {
      setMutationFeedback({ type: 'error', message: 'Silakan pilih barang yang akan dimutasi.' });
      return;
    }
    const qty = parseInt(mutationQty, 10);
    if (!qty || qty <= 0) {
      setMutationFeedback({ type: 'error', message: 'Jumlah barang harus lebih besar dari 0.' });
      return;
    }
    if (!mutationOfficer.trim()) {
      setMutationFeedback({ type: 'error', message: 'Silakan tentukan nama petugas penanggung jawab.' });
      return;
    }

    try {
      const result = recordStockMutation({
        itemId: mutationItemId,
        type: mutationType,
        quantity: qty,
        date: mutationDate,
        officerName: mutationOfficer.trim(),
        recipientOrSource: mutationRecipientOrSource.trim(),
        notes: mutationNotes.trim()
      });

      setItems(result.allItems);
      setMutations(result.allMutations);

      const target = result.allItems.find(i => i.id === mutationItemId);
      const actionName = mutationType === 'in' ? 'Masuk' : mutationType === 'out' ? 'Keluar' : 'Penyesuaian';
      setMutationFeedback({
        type: 'success',
        message: `Berhasil mencatat barang ${actionName}! Stok ${target?.name} saat ini: ${target?.quantity} ${target?.unit}.`
      });

      // Reset form fields
      setMutationQty('1');
      setMutationNotes('');
      setMutationRecipientOrSource('');
    } catch (err: any) {
      setMutationFeedback({ type: 'error', message: err?.message || 'Gagal mencatat mutasi stok.' });
    }
  };

  // Reset to default sample items
  const handleResetToDefault = () => {
    if (window.confirm('Reset data inventaris dan mutasi ke standar bawaan IRM RSPP? Tindakan ini akan mengembalikan daftar awal.')) {
      resetInventoryToDefault();
      setItems(getInventoryItems());
      setMutations(getStockMutations());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>Inventaris &amp; Stok IRM</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 bg-teal-500/30 text-teal-300 border border-teal-400/30 rounded-full">
                    Logistik Poli
                  </span>
                </h2>
              </div>
              <p className="text-xs text-teal-200/80 font-medium truncate mt-0.5">
                Manajemen Alat Terapi (FT, OT, TW), BMHP &amp; Logistik ATK Instalasi Rehabilitasi Medis RSPP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportInventoryReportPDF(items, mutations, selectedCategory)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 border border-teal-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Cetak Rekap Laporan PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak PDF</span>
            </button>

            <button
              onClick={() => exportInventoryToCSV(items)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Ekspor Data ke Excel/CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ekspor Excel</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
              title="Tutup (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metrics Summary Strip */}
        <div className="bg-slate-50 border-b border-slate-200/80 p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Item</p>
              <p className="text-base sm:text-lg font-black text-slate-900 leading-tight">{metrics.totalItems} <span className="text-xs font-semibold text-slate-500">Jenis</span></p>
            </div>
          </div>

          <div 
            onClick={() => {
              if (metrics.criticalCount > 0) {
                setActiveTab('kritis');
              }
            }}
            className={`p-2.5 sm:p-3 bg-white rounded-2xl border shadow-2xs flex items-center gap-3 cursor-pointer transition-all ${
              metrics.criticalCount > 0 
                ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50' 
                : 'border-slate-200'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              metrics.criticalCount > 0 ? 'bg-amber-500 text-white animate-pulse' : 'bg-emerald-50 text-emerald-700'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Stok Kritis / Menipis</p>
              <p className={`text-base sm:text-lg font-black leading-tight ${
                metrics.criticalCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                {metrics.criticalCount} <span className="text-xs font-semibold">Item</span>
              </p>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">BMHP Habis Pakai</p>
              <p className="text-base sm:text-lg font-black text-blue-900 leading-tight">{metrics.bhpCount} <span className="text-xs font-semibold text-slate-500">Item</span></p>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Alat Terapi FT/OT/TW</p>
              <p className="text-base sm:text-lg font-black text-purple-900 leading-tight">{metrics.toolsCount} <span className="text-xs font-semibold text-slate-500">Unit/Set</span></p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 border-b border-slate-200 bg-white shrink-0 overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('katalog')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'katalog'
                  ? 'border-teal-600 text-teal-900 bg-teal-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
              }`}
            >
              <Package className="w-4 h-4 text-teal-600" />
              <span>Katalog &amp; Stok Barang</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-slate-100 text-slate-700">
                {items.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('mutasi_form')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'mutasi_form'
                  ? 'border-blue-600 text-blue-900 bg-blue-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-blue-600" />
              <span>Catat Mutasi Stok</span>
            </button>

            <button
              onClick={() => setActiveTab('riwayat')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'riwayat'
                  ? 'border-indigo-600 text-indigo-900 bg-indigo-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
              }`}
            >
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              <span>Riwayat Mutasi</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-slate-100 text-slate-700">
                {mutations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('kritis')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'kritis'
                  ? 'border-amber-600 text-amber-900 bg-amber-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Peringatan Stok ({criticalItems.length})</span>
              {criticalItems.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>
          </div>

          {activeTab === 'katalog' && (
            <button
              onClick={handleOpenAddItem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer mb-1 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Barang</span>
            </button>
          )}
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60">
          
          {/* ======================================================== */}
          {/* TAB 1: KATALOG & DAFTAR STOK BARANG                      */}
          {/* ======================================================== */}
          {activeTab === 'katalog' && (
            <div className="space-y-4">
              {/* Filter and Search Bar */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari kode (BHP-001), nama barang, alat, atau ruangan..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Category Filter */}
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
                  >
                    <option value="all">📦 Semua Kategori</option>
                    {INVENTORY_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>

                  {/* Stock Level Filter */}
                  <select
                    value={stockStatusFilter}
                    onChange={e => setStockStatusFilter(e.target.value as any)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
                  >
                    <option value="all">📊 Semua Level Stok</option>
                    <option value="menipis_habis">⚠️ Stok Menipis / Habis</option>
                    <option value="aman">✅ Stok Aman</option>
                  </select>
                </div>
              </div>

              {/* Items Table / Cards */}
              {filteredItems.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">Tidak ada barang yang sesuai filter</p>
                    <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau kategori filter.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setStockStatusFilter('all');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredItems.map(item => {
                    const status = getStockStatus(item);
                    const cond = item.condition ? getConditionBadge(item.condition) : null;
                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 relative ${
                          item.quantity <= item.minStock ? 'border-amber-300/80 bg-amber-50/20' : 'border-slate-200/90'
                        }`}
                      >
                        <div>
                          {/* Header item: Code & Category */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded-md">
                                {item.code}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getInventoryCategoryBadgeClass(item.category)}`}>
                                {getInventoryCategoryIcon(item.category)} {getInventoryCategoryLabel(item.category).split(' ')[0]}
                              </span>
                            </div>

                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${status.badgeClass}`}>
                              {status.label}
                            </span>
                          </div>

                          {/* Item Name & Spec */}
                          <h4 className="text-sm font-black text-slate-900 mt-2 line-clamp-2 leading-snug">
                            {item.name}
                          </h4>

                          {item.brand && (
                            <p className="text-[11px] text-teal-800 font-semibold mt-0.5">
                              Merk: {item.brand}
                            </p>
                          )}

                          {item.specification && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 italic">
                              {item.specification}
                            </p>
                          )}

                          {/* Stock Quantity Highlight */}
                          <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Stok Tersedia</p>
                              <p className="text-lg font-black text-slate-900 leading-tight">
                                {item.quantity} <span className="text-xs font-bold text-slate-600">{item.unit}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Min Stok: {item.minStock} {item.unit}</p>
                              <p className="text-[11px] text-slate-600 font-medium truncate max-w-[130px]" title={item.location}>
                                📍 {item.location}
                              </p>
                            </div>
                          </div>

                          {/* Condition & Expiry Tags */}
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {cond && (
                              <span className={`px-2 py-0.5 rounded-md font-bold border ${cond.badgeClass}`}>
                                {cond.label}
                              </span>
                            )}
                            {item.expiryDate && (
                              <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-bold">
                                ED: {item.expiryDate}
                              </span>
                            )}
                            {item.lastRestockDate && (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                                Restock: {item.lastRestockDate}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenQuickMutation(item, 'in')}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Catat Barang Masuk (Restock)"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                              <span>+ Masuk</span>
                            </button>

                            <button
                              onClick={() => handleOpenQuickMutation(item, 'out')}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Catat Pemakaian / Barang Keluar"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                              <span>- Pakai</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditItem(item)}
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Data Barang"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Data Barang"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CATAT MUTASI STOK (MASUK / KELUAR / PENYESUAIAN)   */}
          {/* ======================================================== */}
          {activeTab === 'mutasi_form' && (
            <div className="max-w-2xl mx-auto bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm space-y-5">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5 text-blue-600" />
                  <span>Formulir Pencatatan Mutasi Stok IRM</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catat penambahan logistik (Restock), pemakaian harian tindakan pasien, atau penyesuaian opname stok.
                </p>
              </div>

              {mutationFeedback && (
                <div className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold ${
                  mutationFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border border-rose-200'
                }`}>
                  {mutationFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{mutationFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSubmitMutation} className="space-y-4">
                {/* 1. Pilih Jenis Mutasi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jenis Mutasi Stok *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMutationType('in')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        mutationType === 'in'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                      <span>Barang Masuk (Restock)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMutationType('out')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        mutationType === 'out'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Barang Keluar (Pakai)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMutationType('adjustment')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        mutationType === 'adjustment'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Penyesuaian Opname</span>
                    </button>
                  </div>
                </div>

                {/* 2. Pilih Barang */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Barang / Alat *
                  </label>
                  <select
                    value={mutationItemId}
                    onChange={e => setMutationItemId(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">-- Pilih Barang dari Inventaris --</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>
                        [{i.code}] {i.name} (Stok Saat Ini: {i.quantity} {i.unit}) - {i.location}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Jumlah dan Tanggal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {mutationType === 'adjustment' ? 'Jumlah Stok Hasil Opname Sebenarnya *' : 'Jumlah Mutasi *'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={mutationQty}
                      onChange={e => setMutationQty(e.target.value)}
                      required
                      placeholder="Contoh: 5"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tanggal Mutasi *
                    </label>
                    <input
                      type="date"
                      value={mutationDate}
                      onChange={e => setMutationDate(e.target.value)}
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* 4. Petugas & Asal/Tujuan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Petugas Penanggung Jawab *
                    </label>
                    {therapistList.length > 0 ? (
                      <select
                        value={mutationOfficer}
                        onChange={e => setMutationOfficer(e.target.value)}
                        required
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        {therapistList.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={mutationOfficer}
                        onChange={e => setMutationOfficer(e.target.value)}
                        placeholder="Nama Petugas IRM"
                        required
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {mutationType === 'in' ? 'Sumber Asal Barang' : 'Tujuan Penggunaan / Ruangan'}
                    </label>
                    <input
                      type="text"
                      value={mutationRecipientOrSource}
                      onChange={e => setMutationRecipientOrSource(e.target.value)}
                      placeholder={
                        mutationType === 'in'
                          ? 'Misal: Drop Gudang Farmasi RS, Pengadaan Baru'
                          : 'Misal: Ruang FT Bed 1, Ruang OT Anak, Pasien Ny. Siti'
                      }
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* 5. Catatan Tambahan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan / Keterangan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={mutationNotes}
                    onChange={e => setMutationNotes(e.target.value)}
                    placeholder="Keterangan kondisi barang, nomor surat jalan, atau keperluan khusus..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveTab('katalog')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Simpan &amp; Update Stok</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: RIWAYAT LOG MUTASI LENGKAP                        */}
          {/* ======================================================== */}
          {activeTab === 'riwayat' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Log Riwayat Mutasi Barang</h3>
                  <p className="text-xs text-slate-500">Daftar pencatatan barang masuk, barang keluar, dan penyesuaian stok IRM</p>
                </div>
                <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200">
                  Total: {mutations.length} Transaksi
                </span>
              </div>

              {mutations.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                  Belum ada riwayat mutasi stok.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Jenis</th>
                          <th className="p-3">Kode &amp; Nama Barang</th>
                          <th className="p-3">Jumlah</th>
                          <th className="p-3">Stok Sebelum &rarr; Sesudah</th>
                          <th className="p-3">Petugas</th>
                          <th className="p-3">Sumber / Tujuan</th>
                          <th className="p-3">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {mutations.map(m => (
                          <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-mono text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                              {m.date}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              {m.type === 'in' ? (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-black text-[10px] flex items-center gap-1 w-fit">
                                  <ArrowDownLeft className="w-3 h-3" /> MASUK
                                </span>
                              ) : m.type === 'out' ? (
                                <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md font-black text-[10px] flex items-center gap-1 w-fit">
                                  <ArrowUpRight className="w-3 h-3" /> KELUAR
                                </span>
                              ) : (
                                <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md font-black text-[10px] flex items-center gap-1 w-fit">
                                  <RefreshCw className="w-3 h-3" /> OPNAME
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-mono text-[10px] font-bold text-slate-500 mr-1.5">[{m.itemCode}]</span>
                              <strong className="text-slate-900">{m.itemName}</strong>
                            </td>
                            <td className="p-3 font-black text-slate-900 whitespace-nowrap">
                              {m.type === 'in' ? `+${m.quantity}` : m.type === 'out' ? `-${m.quantity}` : m.quantity} {m.unit}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {m.previousStock} &rarr; <strong className="text-slate-900">{m.newStock}</strong> {m.unit}
                            </td>
                            <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                              {m.officerName}
                            </td>
                            <td className="p-3 text-slate-600 text-[11px]">
                              {m.recipientOrSource || '-'}
                            </td>
                            <td className="p-3 text-slate-500 text-[11px] italic max-w-xs truncate" title={m.notes}>
                              {m.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: PERINGATAN STOK KRITIS & MENIPIS                  */}
          {/* ======================================================== */}
          {activeTab === 'kritis' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="text-xs sm:text-sm font-black text-amber-950">
                    Daftar Kebutuhan Amprahan &amp; Restock Barang IRM
                  </h4>
                  <p className="text-xs text-amber-800">
                    Barang-barang di bawah ini memiliki jumlah stok sama dengan atau kurang dari batas minimum yang ditentukan. Segera ajukan permohonan restock ke logistik / farmasi RS.
                  </p>
                </div>
              </div>

              {criticalItems.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Semua Stok Barang dalam Kondisi Aman!</p>
                  <p className="text-xs text-slate-400">Tidak ada barang yang habis atau di bawah batas minimum.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {criticalItems.map(item => {
                    const status = getStockStatus(item);
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-amber-300 p-4 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold bg-slate-900 text-white px-1.5 py-0.2 rounded">
                              {item.code}
                            </span>
                            <span className={`text-[10px] px-2 py-0.2 rounded-full font-black ${status.badgeClass}`}>
                              {status.label}
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-1 truncate">
                            {item.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Stok Saat Ini: <strong className="text-rose-600 font-black">{item.quantity} {item.unit}</strong> (Batas Minimum: {item.minStock} {item.unit})
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            📍 Lokasi: {item.location}
                          </p>
                        </div>

                        <button
                          onClick={() => handleOpenQuickMutation(item, 'in')}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs shrink-0 flex items-center gap-1"
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                          <span>Restock</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Bottom Footer Action */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToDefault}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-600 font-semibold transition-colors cursor-pointer"
              title="Reset ke Daftar Bawaan IRM"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standar IRM</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: TAMBAH / EDIT DATA INVENTARIS                     */}
      {/* ======================================================== */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-in fade-in duration-150">
          <div 
            className="bg-white w-full max-w-xl rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {editingItem ? 'Edit Data Barang Inventaris' : 'Tambah Barang Inventaris Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kode Barang *</label>
                  <input
                    type="text"
                    required
                    value={itemCode}
                    onChange={e => setItemCode(e.target.value)}
                    placeholder="BHP-001 / ALT-001"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori *</label>
                  <select
                    value={itemCategory}
                    onChange={e => setItemCategory(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-teal-500"
                  >
                    {INVENTORY_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Barang / Alat *</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="Contoh: Gel Ultrasound 5 Liter / TENS 4 Channel"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stok Saat Ini *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={itemQuantity}
                    onChange={e => setItemQuantity(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batas Min Stok *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={itemMinStock}
                    onChange={e => setItemMinStock(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Satuan *</label>
                  <input
                    type="text"
                    required
                    value={itemUnit}
                    onChange={e => setItemUnit(e.target.value)}
                    placeholder="Pcs, Unit, Box, Roll"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Ruangan Simpan *</label>
                  <input
                    type="text"
                    required
                    value={itemLocation}
                    onChange={e => setItemLocation(e.target.value)}
                    placeholder="Gudang IRM / Ruang Elektroterapi / Ruang OT"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kondisi Alat</label>
                  <select
                    value={itemCondition}
                    onChange={e => setItemCondition(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="baik">✅ Baik &amp; Siap Pakai</option>
                    <option value="perlu_servis">⚠️ Perlu Servis / Kalibrasi</option>
                    <option value="rusak">❌ Rusak / Afkir</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Merk / Produsen</label>
                  <input
                    type="text"
                    value={itemBrand}
                    onChange={e => setItemBrand(e.target.value)}
                    placeholder="Aquasonic, Enraf, BTL, OneMed"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Expired / ED (BHP)</label>
                  <input
                    type="date"
                    value={itemExpiryDate}
                    onChange={e => setItemExpiryDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Spesifikasi / Catatan Teknis</label>
                <input
                  type="text"
                  value={itemSpec}
                  onChange={e => setItemSpec(e.target.value)}
                  placeholder="Spesifikasi teknis alat atau bahan..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  value={itemNotes}
                  onChange={e => setItemNotes(e.target.value)}
                  placeholder="Catatan peruntukan atau informasi tambahan..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                >
                  {editingItem ? 'Simpan Perubahan' : 'Tambah ke Inventaris'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
