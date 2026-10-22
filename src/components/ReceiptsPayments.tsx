import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Receipt, CreditCard, Plus, Search, Calendar, DollarSign, FileText, Trash2, Edit2, Edit3, ArrowRightLeft } from 'lucide-react';
import { ReceiptPayment, Account, Currency, User, MultiReceiptPayment } from '../types';
import { PermissionGuard, usePermissions } from '../lib/permissions';
import { toast } from 'sonner';
import OfficialVoucherPrintModal from './OfficialVoucherPrintModal';
import { isDateLocked } from '../utils/tafqeet';

interface ReceiptsPaymentsProps {
  accounts: Account[];
  currencies: Currency[];
  onSaveVoucher: (voucher: Partial<ReceiptPayment>) => void;
  onSaveMultiVoucher?: (voucher: Partial<MultiReceiptPayment>) => void;
  onDeleteVoucher?: (id: string) => Promise<void>;
  onPrint?: (voucher: ReceiptPayment) => void;
  vouchers: ReceiptPayment[];
  bookings?: any[];
  setPrintData: (data: any) => void;
  bookingSettings?: any;
  companySettings?: any;
  transactions?: any[];
  currentUser?: User | null;
}

export default function ReceiptsPayments({ accounts, currencies, onSaveVoucher, onSaveMultiVoucher, onDeleteVoucher, onPrint, vouchers, bookings, setPrintData, bookingSettings, companySettings, transactions = [], currentUser }: ReceiptsPaymentsProps) {
  const { hasPermission, canAccessAccount } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState<'receipt' | 'payment'>('receipt');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMultiAccount, setIsMultiAccount] = useState(false);
  const [selectedOfficialVoucher, setSelectedOfficialVoucher] = useState<ReceiptPayment | null>(null);
  const [isOfficialPrintModalOpen, setIsOfficialPrintModalOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<ReceiptPayment>>({
    type: 'receipt',
    manualNumber: '',
    date: new Date().toISOString().split('T')[0],
    voucherDate: new Date().toISOString().split('T')[0],
    amount: 0,
    currency: 'YER',
    description: '',
    fromToAccountId: '',
    cashBankAccountId: currentUser?.defaultCashboxId || '',
    concernedParty: { name: '', type: 'other' }
  });

  const [multiEntries, setMultiEntries] = useState<{ accountId: string; amount: number; description: string }[]>([
    { accountId: '', amount: 0, description: '' }
  ]);

  const addMultiEntry = () => {
    setMultiEntries([...multiEntries, { accountId: '', amount: 0, description: '' }]);
  };

  const removeMultiEntry = (index: number) => {
    if (multiEntries.length > 1) {
      setMultiEntries(multiEntries.filter((_, i) => i !== index));
    }
  };

  const updateMultiEntry = (index: number, field: string, value: any) => {
    const newEntries = [...multiEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setMultiEntries(newEntries);
  };

  const [editingVoucher, setEditingVoucher] = useState<ReceiptPayment | null>(null);

  const handleEditVoucher = (v: ReceiptPayment) => {
    if (!hasPermission("edit-voucher") && !hasPermission("create-voucher")) {
      toast.error("عذراً، ليس لديك صلاحية تعديل السندات المالية.");
      return;
    }
    setEditingVoucher(v);
    setType(v.type);
    setFormData({
      id: v.id,
      type: v.type,
      manualNumber: v.manualNumber || '',
      date: (v.date || v.voucherDate || new Date().toISOString()).split(/[T\s]/)[0],
      voucherDate: (v.voucherDate || v.date || new Date().toISOString()).split(/[T\s]/)[0],
      amount: v.amount || v.totalAmount || 0,
      currency: v.currency || 'YER',
      description: v.description || '',
      fromToAccountId: v.fromToAccountId || '',
      cashBankAccountId: v.cashBankAccountId || currentUser?.defaultCashboxId || '',
      concernedParty: v.concernedParty || { name: '', type: 'other' },
      linkedBookingId: v.linkedBookingId || (v as any).bookingId
    });

    if (v.entries && v.entries.length > 0) {
      setIsMultiAccount(true);
      setMultiEntries(v.entries);
    } else {
      setIsMultiAccount(false);
      setMultiEntries([{ accountId: '', amount: 0, description: '' }]);
    }
    setShowModal(true);
  };

  const handleDeleteVoucher = (v: ReceiptPayment) => {
    if (!hasPermission("delete-voucher")) {
      toast.error("عذراً، ليس لديك صلاحية حذف السندات المالية.");
      return;
    }

    // Master Lock Date Check
    const voucherDate = v.voucherDate || v.date;
    if (isDateLocked(voucherDate, companySettings)) {
      toast.error(`⚠️ عذراً، لا يمكن حذف السند. التاريخ (${voucherDate}) يقع ضمن التواريخ المقفلة نهائياً (حتى ${companySettings.masterLockDate}).`);
      return;
    }

    if (window.confirm(`هل أنت متأكد من حذف ${v.type === 'receipt' ? 'سند القبض' : 'سند الصرف'} رقم ${v.sequenceCode || v.id.slice(-6)}؟`)) {
      if (onDeleteVoucher) {
        onDeleteVoucher(v.id);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingVoucher) {
      if (!hasPermission("edit-voucher") && !hasPermission("create-voucher")) {
        toast.error("عذراً، ليس لديك صلاحية تعديل السندات المالية.");
        return;
      }
    } else {
      if (!hasPermission("create-voucher")) {
        toast.error("عذراً، ليس لديك صلاحية إنشاء سندات قبض أو صرف جديدة.");
        return;
      }
    }

    // Master Lock Date Check
    const effectiveDate = formData.date;
    const effectiveVoucherDate = formData.voucherDate || formData.date;
    
    if (isDateLocked(effectiveDate, companySettings) || isDateLocked(effectiveVoucherDate, companySettings)) {
      toast.error(`⚠️ عذراً، لا يمكن حفظ السند. التاريخ المختار يقع ضمن التواريخ المقفلة نهائياً (حتى ${companySettings.masterLockDate}).`);
      return;
    }

    // If editing, also check if the ORIGINAL date was locked
    if (editingVoucher) {
      const originalDate = editingVoucher.date;
      const originalVoucherDate = editingVoucher.voucherDate || editingVoucher.date;
      if (isDateLocked(originalDate, companySettings) || isDateLocked(originalVoucherDate, companySettings)) {
        toast.error(`⚠️ عذراً، لا يمكن تعديل هذا السند لأنه يتبع فترة مالية مقفلة نهائياً (حتى ${companySettings.masterLockDate}).`);
        return;
      }
    }
    
    // Suspended account check
    if (!isMultiAccount) {
      const targetAcc = accounts.find(a => a.id === formData.fromToAccountId);
      if (targetAcc?.status === 'suspended') {
        toast.error(`⚠️ لا يمكن إجراء سند على الحساب (${targetAcc.name}) لأن هذا الحساب موقوف حالياً.`);
        return;
      }
    } else {
      const suspendedEntry = multiEntries.find(e => {
        const acc = accounts.find(a => a.id === e.accountId);
        return acc?.status === 'suspended';
      });
      if (suspendedEntry) {
        const acc = accounts.find(a => a.id === suspendedEntry.accountId);
        toast.error(`⚠️ الحساب (${acc?.name || suspendedEntry.accountId}) موقوف حالياً ولا يمكن استخدامه بالسند.`);
        return;
      }
    }
    
    if (isMultiAccount && onSaveMultiVoucher) {
      const total = multiEntries.reduce((sum, entry) => sum + entry.amount, 0);
      onSaveMultiVoucher({
        id: editingVoucher?.id,
        type,
        manualNumber: formData.manualNumber?.trim() || "",
        date: formData.date,
        voucherDate: formData.voucherDate || formData.date,
        currency: formData.currency,
        cashBankAccountId: formData.cashBankAccountId,
        entries: multiEntries,
        totalAmount: total,
        description: formData.description
      });
    } else {
      const { concernedParty, ...rest } = formData;
      let description = formData.description || "";
      if (concernedParty && concernedParty.name?.trim() && !description.includes("الطرف المعني:")) {
        description = `الطرف المعني: ${concernedParty.name} - ${description}`;
      }
      onSaveVoucher({
        ...rest,
        id: editingVoucher?.id,
        type,
        description,
        manualNumber: formData.manualNumber?.trim() || "",
        voucherDate: formData.voucherDate || formData.date,
        concernedParty
      });
    }

    setShowModal(false);
    setEditingVoucher(null);
    resetForm();
  };

  const resetForm = () => {
    setEditingVoucher(null);
    setFormData({
      type: 'receipt',
      manualNumber: '',
      date: new Date().toISOString().split('T')[0],
      voucherDate: new Date().toISOString().split('T')[0],
      amount: 0,
      currency: 'YER',
      description: '',
      fromToAccountId: '',
      cashBankAccountId: currentUser?.defaultCashboxId || '',
      concernedParty: { name: '', type: 'other' }
    });
    setMultiEntries([{ accountId: '', amount: 0, description: '' }]);
    setIsMultiAccount(false);
  };

  const filteredVouchers = vouchers.filter(v => 
    (v.description || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
    (v.id || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
    (v.sequenceCode || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
    (v.manualNumber || "").includes(searchTerm)
  );

  const handlePrintVoucher = (voucher: ReceiptPayment) => {
    setSelectedOfficialVoucher(voucher);
    setIsOfficialPrintModalOpen(true);
  };

  const VoucherCard = ({ voucher }: { voucher: ReceiptPayment; key?: any }) => (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">رقم السند</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg font-mono">
              {voucher.sequenceCode || `#${voucher.id.slice(-6)}`}
            </span>
            {voucher.manualNumber && (
              <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800" title="رقم السند اليدوي">
                يدوي: {voucher.manualNumber}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">النوع</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            voucher.type === 'receipt' 
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
          }`}>
            {voucher.type === 'receipt' ? 'قبض' : 'صرف'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50 dark:border-slate-800/50">
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter block mb-1">التاريخ</span>
          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{(voucher.voucherDate || voucher.date || '').split(/[\sT]/)[0]}</span>
        </div>
        <div className="text-left">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter block mb-1 text-left">المبلغ</span>
          <div className="flex items-baseline gap-1 justify-end">
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono tracking-tighter">{(voucher.amount ?? voucher.totalAmount ?? 0).toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase">{voucher.currency}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter block mb-1">الحساب</span>
           <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
             {voucher.entries && voucher.entries.length > 0 ? (
               <div className="flex flex-wrap gap-1">
                 {voucher.entries.map((entry, idx) => {
                   const accName = accounts.find(a => a.id === entry.accountId)?.name || 'غير معروف';
                   return (
                     <span key={idx} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 text-[10px]">
                       {accName} ({entry.amount.toLocaleString()})
                     </span>
                   );
                 })}
               </div>
             ) : (
               accounts.find(a => a.id === voucher.fromToAccountId)?.name || 'غير محدد'
             )}
           </div>
        </div>
        <div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter block mb-1">البيان</span>
           <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{voucher.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-slate-800/50">
         {voucher.linkedBookingId ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 dark:text-indigo-400 font-extrabold text-[9px] border border-indigo-100">
               🔗 حجز #{voucher.linkedBookingId.slice(-6)}
            </span>
         ) : <div />}
         <div className="flex items-center gap-1.5">
           <PermissionGuard permission="edit-voucher">
             <button 
               onClick={() => handleEditVoucher(voucher)}
               className="p-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-bold transition-all border border-amber-200 dark:border-amber-800"
               title="تعديل السند"
             >
               <Edit2 className="h-3.5 w-3.5" />
             </button>
           </PermissionGuard>
           <PermissionGuard permission="delete-voucher">
             <button 
               onClick={() => handleDeleteVoucher(voucher)}
               className="p-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold transition-all border border-rose-200 dark:border-rose-800"
               title="حذف السند"
             >
               <Trash2 className="h-3.5 w-3.5" />
             </button>
           </PermissionGuard>
           <PermissionGuard permission="print-voucher">
             <button 
               onClick={() => handlePrintVoucher(voucher)}
               className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-[10px] font-black transition-all"
               title="معاينة وطباعة السند"
             >
               <FileText className="h-3.5 w-3.5 text-indigo-500" />
               معاينة وطباعة
             </button>
           </PermissionGuard>
         </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <Receipt className="h-8 w-8 text-indigo-500" />
            سندات القبض والصرف
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">إدارة التدفقات النقدية والعمليات المالية المباشرة</p>
        </div>
        
        <div className="flex items-center gap-3">
          <PermissionGuard permission="create-voucher">
            <button 
              onClick={() => { resetForm(); setType('receipt'); setFormData(p => ({...p, type: 'receipt'})); setShowModal(true); }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 text-sm"
            >
              <Plus className="h-4 w-4" />
              سند قبض
            </button>
          </PermissionGuard>
          <PermissionGuard permission="create-voucher">
            <button 
              onClick={() => { resetForm(); setType('payment'); setFormData(p => ({...p, type: 'payment'})); setShowModal(true); }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-rose-600/20 transition-all active:scale-95 text-sm"
            >
              <Plus className="h-4 w-4" />
              سند صرف
            </button>
          </PermissionGuard>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="البحث برقم السند أو البيان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl pr-10 pl-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">رقم السند</th>
                <th className="p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">التاريخ</th>
                <th className="p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">النوع</th>
                <th className="p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">الارتباط بالحجز</th>
                <th className="p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">الحساب</th>
                <th className="p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">البيان</th>
                <th className="p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">المبلغ</th>
                <th className="p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">العملة</th>
                <th className="p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredVouchers.map((voucher) => (
                <tr key={voucher.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono">{voucher.sequenceCode || `#${voucher.id.slice(-6)}`}</span>
                      {voucher.manualNumber && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 w-fit" title="رقم السند اليدوي">
                          يدوي: {voucher.manualNumber}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-xs font-mono text-slate-600 dark:text-slate-400">{(voucher.voucherDate || voucher.date || '').split(/[\sT]/)[0]}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      voucher.type === 'receipt' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                    }`}>
                      {voucher.type === 'receipt' ? 'قبض' : 'صرف'}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-bold">
                    {voucher.linkedBookingId ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-550/10 text-indigo-650 dark:text-indigo-400 font-extrabold text-[9px] border border-indigo-100 dark:border-indigo-900/20 w-fit">
                          🔗 حجز #{voucher.linkedBookingId.slice(-6)}
                        </span>
                        {bookings && bookings.find(b => b.id === voucher.linkedBookingId) && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            👤 {bookings.find(b => b.id === voucher.linkedBookingId)?.customerName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[10px]">-</span>
                    )}
                  </td>
                  <td className="p-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {voucher.entries && voucher.entries.length > 0 ? (
                      <div className="flex flex-col gap-1 max-w-[180px]">
                        {voucher.entries.map((entry, idx) => {
                          const accName = accounts.find(a => a.id === entry.accountId)?.name || 'غير معروف';
                          return (
                            <span key={idx} className="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate">
                              {accName} ({entry.amount.toLocaleString()})
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      accounts.find(a => a.id === voucher.fromToAccountId)?.name || 'غير محدد'
                    )}
                  </td>
                  <td className="p-4 text-xs text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{voucher.description}</td>
                  <td className="p-4 text-xs font-black text-slate-900 dark:text-white font-mono">
                    {(voucher.amount ?? voucher.totalAmount ?? 0).toLocaleString()}
                  </td>
                  <td className="p-4 text-[10px] font-bold text-slate-500">{voucher.currency}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <PermissionGuard permission="edit-voucher">
                        <button 
                          onClick={() => handleEditVoucher(voucher)}
                          className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg text-slate-500 hover:text-amber-600 transition-colors"
                          title="تعديل السند"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard permission="delete-voucher">
                        <button 
                          onClick={() => handleDeleteVoucher(voucher)}
                          className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg text-slate-500 hover:text-rose-600 transition-colors"
                          title="حذف السند"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard permission="print-voucher">
                        <button 
                          onClick={() => handlePrintVoucher(voucher)}
                          className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                          title="معاينة وطباعة السند"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVouchers.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                    لا توجد سندات مسجلة حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile/Tablet View - Flexible Grid */}
        <div className="lg:hidden p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
           {filteredVouchers.map((voucher) => (
             <VoucherCard key={voucher.id} voucher={voucher} />
           ))}
           {filteredVouchers.length === 0 && (
             <div className="col-span-full p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
               لا توجد سندات مسجلة حتى الآن
             </div>
           )}
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowModal(false); resetForm(); }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className={`p-6 text-white flex items-center justify-between ${type === 'receipt' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                <div>
                  <h3 className="text-xl font-black">
                    {editingVoucher 
                      ? (type === 'receipt' ? 'تعديل سند قبض' : 'تعديل سند صرف')
                      : (type === 'receipt' ? 'إنشاء سند قبض جديد' : 'إنشاء سند صرف جديد')}
                  </h3>
                  <p className="text-white/80 text-xs font-medium">
                    {editingVoucher ? 'تعديل بيانات السند وتحديث القيد المحاسبي المرتبط' : 'أكمل البيانات أدناه لتوليد القيد المحاسبي آلياً'}
                  </p>
                </div>
                {type === 'receipt' ? <Receipt className="h-10 w-10 opacity-40" /> : <CreditCard className="h-10 w-10 opacity-40" />}
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="multiAccount"
                        checked={isMultiAccount}
                        onChange={(e) => setIsMultiAccount(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="multiAccount" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        سند متعدد (أكثر من حساب)
                      </label>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 block mb-1">تاريخ السند (Voucher Date)</label>
                    <input 
                      type="date"
                      required
                      value={formData.voucherDate}
                      onChange={e => setFormData(p => ({...p, voucherDate: e.target.value}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 text-right font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1">تاريخ التسجيل</label>
                    <input 
                      type="date"
                      required
                      disabled={bookingSettings?.lockTransactionDate && !hasPermission("bypass-transaction-lock-date")}
                      value={formData.date}
                      onChange={e => setFormData(p => ({...p, date: e.target.value}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 text-right disabled:opacity-50"
                    />
                    {bookingSettings?.lockTransactionDate && (
                      <p className="text-[8px] text-rose-500 font-bold mt-1">
                        {hasPermission("bypass-transaction-lock-date") 
                          ? "🔓 تم تخطي قفل التاريخ بصلاحية المشرف الصارمة" 
                          : "⚠️ التاريخ مقفل من الإعدادات لمجموعتك"}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 block mb-1">
                    🔢 رقم السند اليدوي / الدفتري (أرقام فقط)
                  </label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="أدخل رقم السند الورقي (أرقام فقط - مثال: 1045)"
                    value={formData.manualNumber || ''}
                    onChange={e => setFormData(p => ({...p, manualNumber: e.target.value.replace(/\D/g, '')}))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 text-right font-mono font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1">حساب الصندوق / البنك</label>
                    <select 
                      required
                      value={formData.cashBankAccountId}
                      onChange={e => setFormData(p => ({...p, cashBankAccountId: e.target.value}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.filter(a => a.type === 'asset' && a.isTransactional && canAccessAccount(a.id) && (a.classification === 'cashbox' || a.classification === 'bank' || a.category === 'cash' || a.category === 'bank' || a.name?.includes('صندوق') || a.name?.includes('بنك'))).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isMultiAccount ? (
                  <>
                    <div>
                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 block mb-1">
                        {type === 'receipt' ? 'الحساب المستلم منه (العميل/أخرى)' : 'الحساب المصروف له (المورد/الموظف/أخرى)'}
                      </label>
                      <select 
                        required={!isMultiAccount}
                        value={formData.fromToAccountId}
                        onChange={e => setFormData(p => ({...p, fromToAccountId: e.target.value}))}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">اختر الحساب المقابل...</option>
                        {accounts.filter(a => a.isTransactional && canAccessAccount(a.id)).map(acc => (
                          <option key={acc.id} value={acc.id} disabled={acc.status === 'suspended'}>
                            {acc.name} ({acc.code}){acc.status === 'suspended' ? ' [حساب موقوف]' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 block mb-1">اسم الطرف المعني</label>
                        <input 
                          type="text"
                          placeholder="اسم العميل أو الموظف..."
                          value={formData.concernedParty?.name || ''}
                          onChange={e => setFormData(p => ({...p, concernedParty: { ...p.concernedParty!, name: e.target.value }}))}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 block mb-1">نوع الطرف</label>
                        <select
                          value={formData.concernedParty?.type || 'other'}
                          onChange={e => setFormData(p => ({...p, concernedParty: { ...p.concernedParty!, type: e.target.value as any }}))}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="other">أخرى</option>
                          <option value="client">عميل</option>
                          <option value="employee">موظف</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-500 dark:text-slate-400">توزيع المبالغ على الحسابات</label>
                      <button type="button" onClick={addMultiEntry} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded-lg font-bold flex items-center gap-1 hover:bg-indigo-700">
                        <Plus className="h-3 w-3" /> إضافة سطر
                      </button>
                    </div>
                    
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                      {multiEntries.map((entry, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <div className="flex-1 space-y-1">
                             <select 
                               required={isMultiAccount}
                               value={entry.accountId}
                               onChange={e => updateMultiEntry(idx, 'accountId', e.target.value)}
                               className="w-full bg-white dark:bg-slate-800 border-none rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                             >
                               <option value="">الحساب...</option>
                               {accounts.filter(a => a.isTransactional && canAccessAccount(a.id)).map(acc => (
                                 <option key={acc.id} value={acc.id} disabled={acc.status === 'suspended'}>
                                   {acc.name} ({acc.code}){acc.status === 'suspended' ? ' [حساب موقوف]' : ''}
                                 </option>
                               ))}
                             </select>
                             <input 
                               type="text" 
                               placeholder="وصف السطر..." 
                               value={entry.description}
                               onChange={e => updateMultiEntry(idx, 'description', e.target.value)}
                               className="w-full bg-white dark:bg-slate-800 border-none rounded-lg p-2 text-[10px] focus:ring-1 focus:ring-indigo-500"
                             />
                          </div>
                          <div className="w-24">
                            <input 
                              type="number"
                              required={isMultiAccount}
                              min="0"
                              step="0.01"
                              placeholder="المبلغ"
                              value={entry.amount || ""}
                              onChange={e => updateMultiEntry(idx, 'amount', parseFloat(e.target.value) || 0)}
                              className="w-full bg-white dark:bg-slate-800 border-none rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 font-bold text-center"
                            />
                          </div>
                          <button type="button" onClick={() => removeMultiEntry(idx)} className="p-2 text-slate-400 hover:text-rose-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center px-2">
                       <span className="text-[10px] font-black text-slate-500">الإجمالي:</span>
                       <span className="text-sm font-black text-indigo-600">{multiEntries.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {!isMultiAccount && (
                    <div>
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1">المبلغ</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                          type="number"
                          required={!isMultiAccount}
                          min="0"
                          step="0.01"
                          value={formData.amount || ""}
                          onChange={e => setFormData(p => ({...p, amount: parseFloat(e.target.value) || 0}))}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 font-black text-center"
                        />
                      </div>
                    </div>
                  )}
                  <div className={isMultiAccount ? "col-span-2" : ""}>
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1">العملة</label>
                    <select 
                      required
                      value={formData.currency}
                      onChange={e => setFormData(p => ({...p, currency: e.target.value}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      {currencies.map(cur => (
                        <option key={cur.id} value={cur.code}>{cur.code} - {cur.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1">البيان / الوصف الإجمالي</label>
                  <textarea 
                    rows={2}
                    required
                    placeholder="اكتب هنا تفاصيل العملية..."
                    value={formData.description}
                    onChange={e => setFormData(p => ({...p, description: e.target.value}))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 text-right"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit"
                    className={`flex-1 font-black py-3 rounded-xl shadow-lg transition-all active:scale-95 text-white ${type === 'receipt' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                  >
                    {editingVoucher ? 'حفظ تعديلات السند وترحيله' : 'حفظ السند وترحيله'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="px-6 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Official Printed Voucher Modal - Al-Zain Grand Hall Book Design */}
      <OfficialVoucherPrintModal
        isOpen={isOfficialPrintModalOpen}
        voucher={selectedOfficialVoucher}
        booking={
          selectedOfficialVoucher
            ? (bookings || []).find(
                (b: any) =>
                  b.id === (selectedOfficialVoucher.linkedBookingId || (selectedOfficialVoucher as any).bookingId) ||
                  b.sequenceCode === (selectedOfficialVoucher.linkedBookingId || (selectedOfficialVoucher as any).bookingId)
              )
            : null
        }
        company={companySettings || bookingSettings?.company || null}
        accounts={accounts}
        currencies={currencies}
        transactions={transactions}
        currentUser={currentUser}
        onClose={() => {
          setIsOfficialPrintModalOpen(false);
          setSelectedOfficialVoucher(null);
        }}
      />
    </div>
  );
}
