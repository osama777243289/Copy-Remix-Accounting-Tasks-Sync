import React, { useState, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Calendar, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  Printer, 
  DollarSign, 
  ShieldAlert, 
  BookOpen, 
  Layers,
  ArrowRight,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { MasterJournalVoucher, MasterJournalLine, Account, Currency, Transaction, CompanySettings } from "../types";
import { isDateLocked } from "../utils/tafqeet";

interface MasterJournalsManagementProps {
  masterJournals: MasterJournalVoucher[];
  accounts: Account[];
  currencies: Currency[];
  globalCurrencyCode: string;
  onAddMasterJournal: (voucher: Omit<MasterJournalVoucher, "id" | "createdAt" | "sequenceCode" | "totalDebit" | "totalCredit">) => Promise<string>;
  onUpdateMasterJournal: (id: string, updates: Partial<MasterJournalVoucher>) => Promise<void>;
  onDeleteMasterJournal: (id: string) => Promise<void>;
  currentUser: any;
  companySettings?: CompanySettings | null;
}

export default function MasterJournalsManagement({
  masterJournals = [],
  accounts = [],
  currencies = [],
  globalCurrencyCode,
  onAddMasterJournal,
  onUpdateMasterJournal,
  onDeleteMasterJournal,
  currentUser,
  companySettings,
}: MasterJournalsManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<MasterJournalVoucher | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<MasterJournalVoucher | null>(null);

  // Form state for Master Journal Voucher
  const [formData, setFormData] = useState<{
    manualNumber: string;
    date: string;
    description: string;
    reference: string;
    currency: string;
    rate: number;
    lines: MasterJournalLine[];
  }>({
    manualNumber: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    reference: "",
    currency: globalCurrencyCode,
    rate: 1,
    lines: [
      { id: "1", accountId: "", type: "debit", amount: 0, description: "" },
      { id: "2", accountId: "", type: "credit", amount: 0, description: "" },
    ],
  });

  const handleOpenAdd = () => {
    setEditingVoucher(null);
    setFormData({
      manualNumber: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
      reference: "",
      currency: globalCurrencyCode,
      rate: 1,
      lines: [
        { id: Math.random().toString(), accountId: "", type: "debit" as const, amount: 0, description: "" },
        { id: Math.random().toString(), accountId: "", type: "credit" as const, amount: 0, description: "" },
      ],
    });
    setShowModal(true);
  };

  const handleOpenEdit = (voucher: MasterJournalVoucher) => {
    setEditingVoucher(voucher);
    setFormData({
      manualNumber: voucher.manualNumber || "",
      date: voucher.date,
      description: voucher.description,
      reference: voucher.reference || "",
      currency: voucher.currency,
      rate: voucher.rate || 1,
      lines: voucher.lines.map(l => ({ ...l, type: l.type as ('debit' | 'credit') })),
    });
    setShowModal(true);
  };

  const handleAddLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [
        ...prev.lines,
        { id: Math.random().toString(), accountId: "", type: "debit" as const, amount: 0, description: "" }
      ]
    }));
  };

  const handleRemoveLine = (id: string) => {
    if (formData.lines.length <= 2) {
      toast.error("يجب أن يحتوي السجل المركب على سطرين على الأقل (مدين ودائن)");
      return;
    }
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter(l => l.id !== id)
    }));
  };

  const handleLineChange = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map(l => l.id === id ? { ...l, [field]: value } : l)
    }));
  };

  // Calculations
  const totalDebit = useMemo(() => {
    return formData.lines.filter(l => l.type === 'debit').reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }, [formData.lines]);

  const totalCredit = useMemo(() => {
    return formData.lines.filter(l => l.type === 'credit').reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }, [formData.lines]);

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      toast.error("يرجى إدخال البيان العام للسجل");
      return;
    }
    if (!isBalanced) {
      toast.error(`القيد غير متوازن! إجمالي المدين (${totalDebit.toLocaleString()}) لا يساوي إجمالي الدائن (${totalCredit.toLocaleString()})`);
      return;
    }

    for (const line of formData.lines) {
      if (!line.accountId) {
        toast.error("يرجى اختيار الحساب المحاسبي لجميع الأسطر");
        return;
      }
      if (Number(line.amount) <= 0) {
        toast.error("يجب أن يكون مبلغ كل سطر أكبر من الصفر");
        return;
      }
    }

    // Master Lock Date Check
    if (isDateLocked(formData.date, companySettings)) {
      toast.error(`⚠️ لا يمكن حفظ القيد. التاريخ (${formData.date}) يقع ضمن التواريخ المقفلة نهائياً (حتى ${companySettings?.masterLockDate}).`);
      return;
    }

    if (editingVoucher && isDateLocked(editingVoucher.date, companySettings)) {
      toast.error(`⚠️ عذراً، لا يمكن تعديل هذا القيد لأنه يتبع فترة مالية مقفلة نهائياً (حتى ${companySettings?.masterLockDate}).`);
      return;
    }

    try {
      if (editingVoucher) {
        await onUpdateMasterJournal(editingVoucher.id, {
          manualNumber: formData.manualNumber,
          date: formData.date,
          description: formData.description,
          reference: formData.reference,
          currency: formData.currency,
          rate: formData.rate,
          lines: formData.lines,
          totalDebit,
          totalCredit,
        });
        toast.success("تم تحديث السجل العام للقيود بنجاح!");
      } else {
        await onAddMasterJournal({
          manualNumber: formData.manualNumber,
          date: formData.date,
          description: formData.description,
          reference: formData.reference,
          currency: formData.currency,
          rate: formData.rate,
          lines: formData.lines,
          status: 'pending_audit',
          createdBy: currentUser?.name || currentUser?.email || "مدير النظام",
        });
        toast.success("تم إنشاء وحفظ السجل العام للقيود اليومية المركبة بنجاح!");
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ السجل العام");
    }
  };

  const filteredJournals = useMemo(() => {
    return masterJournals.filter(j => 
      j.sequenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (j.manualNumber && j.manualNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [masterJournals, searchTerm]);

  const getAccountName = (accId: string) => {
    const acc = accounts.find(a => a.id === accId || a.code === accId);
    return acc ? `${acc.code} - ${acc.name}` : accId;
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <Layers className="h-8 w-8 text-indigo-600" />
            السجل العام للقيود اليومية (القيود المركبة متعددة الأسطر)
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            سندات القيود اليومية المركبة ذات الترقيم العام والمترابطة بعدة أسطر مالية متوازنة
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 text-sm cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          إضافة سجل عام جديد (قيد مركب)
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم السجل أو البيان العام..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pr-10 pl-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
          <span>إجمالي السجلات: <strong className="text-indigo-600">{masterJournals.length}</strong> سجل</span>
        </div>
      </div>

      {/* Master Journals Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="p-4">رقم السجل العام</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">البيان العام والشرح</th>
                <th className="p-4">عدد الأسطر</th>
                <th className="p-4">إجمالي المبلغ</th>
                <th className="p-4 text-center">الحالة</th>
                <th className="p-4 text-center">العمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
              {filteredJournals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 font-bold">
                    لا توجد سجلات قيود مركبة مسجلة حتى الآن.
                  </td>
                </tr>
              ) : (
                filteredJournals.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="p-4">
                      <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg font-mono">
                        {j.sequenceCode}
                      </span>
                      {j.manualNumber && (
                        <span className="block text-[10px] text-slate-400 mt-1">يدوي: {j.manualNumber}</span>
                      )}
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-600 dark:text-slate-400">
                      {(j.date || '').split(/[\sT]/)[0]}
                    </td>
                    <td className="p-4 max-w-xs truncate font-bold text-slate-900 dark:text-white">
                      {j.description}
                    </td>
                    <td className="p-4 font-bold">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-xs">
                        {j.lines.length} أسطر
                      </span>
                    </td>
                    <td className="p-4 font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {j.totalDebit.toLocaleString()} {j.currency}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        j.status === 'audited' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                      }`}>
                        {j.status === 'audited' ? 'معتمد' : 'قيد التدقيق'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedVoucher(j)}
                          className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 rounded-xl transition-colors cursor-pointer"
                          title="عرض تفاصيل السجل والأسطر"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(j)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                          title="تعديل"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (isDateLocked(j.date, companySettings)) {
                              toast.error(`⚠️ لا يمكن حذف القيد. التاريخ (${j.date}) يقع ضمن التواريخ المقفلة نهائياً (حتى ${companySettings?.masterLockDate}).`);
                              return;
                            }
                            if (confirm("هل أنت متأكد من حذف هذا السجل العام للقيود؟")) {
                              onDeleteMasterJournal(j.id);
                              toast.success("تم حذف السجل بنجاح");
                            }
                          }}
                          className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col z-10"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" />
                  {editingVoucher ? "تعديل السجل العام للقيد المركب" : "إنشاء سجل عام جديد للقيد المركب متعدد الأسطر"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Header metadata */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">تاريخ القيد *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">رقم السند اليدوي (اختياري)</label>
                    <input
                      type="text"
                      placeholder="رقم دفتري..."
                      value={formData.manualNumber}
                      onChange={(e) => setFormData({ ...formData, manualNumber: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">العملة *</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => {
                        const cur = currencies.find(c => c.code === e.target.value);
                        setFormData({ ...formData, currency: e.target.value, rate: cur ? cur.rateToBase : 1 });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      {currencies.map(c => (
                        <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">المرجع / المستند الخارجي</label>
                    <input
                      type="text"
                      placeholder="رقم المرجع..."
                      value={formData.reference}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">البيان العام والشرح للقيد المركب *</label>
                  <input
                    type="text"
                    required
                    placeholder="اكتب شرحاً وافياً للعملية المالية..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                  />
                </div>

                {/* Multi-line Sub-Entries */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      تفصيلي أسطر القيد (مدين / دائن):
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-xl cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      إضافة سطر جديد
                    </button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-3 w-1/3">الحساب المحاسبي</th>
                          <th className="p-3 w-28">نوع الحركة</th>
                          <th className="p-3 w-32">المبلغ</th>
                          <th className="p-3">بيان السطر (اختياري)</th>
                          <th className="p-3 w-12 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {formData.lines.map((line) => (
                          <tr key={line.id}>
                            <td className="p-2.5">
                              <select
                                required
                                value={line.accountId}
                                onChange={(e) => handleLineChange(line.id, "accountId", e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-bold"
                              >
                                <option value="">-- اختر الحساب --</option>
                                {accounts.filter(a => a.isTransactional).map(acc => (
                                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2.5">
                              <select
                                value={line.type}
                                onChange={(e) => handleLineChange(line.id, "type", e.target.value)}
                                className={`w-full border rounded-xl p-2 font-black ${
                                  line.type === 'debit' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400' 
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400'
                                }`}
                              >
                                <option value="debit">مدين (منه)</option>
                                <option value="credit">دائن (له)</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                required
                                value={line.amount || ""}
                                onChange={(e) => handleLineChange(line.id, "amount", parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-mono font-bold"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={line.description || ""}
                                onChange={(e) => handleLineChange(line.id, "description", e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                                placeholder="بيان تفصيلي للسطر..."
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(line.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Balance Check Footer */}
                  <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-3 ${
                    isBalanced 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/30' 
                      : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/30'
                  }`}>
                    <div className="flex items-center gap-2 font-black">
                      {isBalanced ? (
                        <>
                          <Check className="h-5 w-5 text-emerald-600" />
                          <span>القيد متوازن تماماً ومطابق محاسبياً</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-5 w-5 text-rose-600" />
                          <span>القيد غير متوازن! الفرق: {Math.abs(totalDebit - totalCredit).toLocaleString()} {formData.currency}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-6 font-mono font-black text-sm">
                      <div>إجمالي المدين: <span className="text-emerald-700">{totalDebit.toLocaleString()}</span></div>
                      <div>إجمالي الدائن: <span className="text-indigo-700">{totalCredit.toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!isBalanced}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    {editingVoucher ? "حفظ التعديلات" : "حفظ وترحيل السجل العام"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details View Modal */}
      <AnimatePresence>
        {selectedVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVoucher(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 z-10 p-6 space-y-6"
            >
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-lg font-mono">
                    {selectedVoucher.sequenceCode}
                  </span>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white mt-2">
                    {selectedVoucher.description}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedVoucher(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                <div>التاريخ: <span className="text-slate-800 dark:text-white font-mono">{(selectedVoucher.date || '').split(/[\sT]/)[0]}</span></div>
                <div>العملة: <span className="text-slate-800 dark:text-white font-mono">{selectedVoucher.currency}</span></div>
                <div>بواسطة: <span className="text-slate-800 dark:text-white">{selectedVoucher.createdBy}</span></div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">الحساب المحاسبي</th>
                      <th className="p-3">نوع الحركة</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedVoucher.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-bold text-slate-800 dark:text-white">{getAccountName(line.accountId)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                            line.type === 'debit' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {line.type === 'debit' ? 'مدين' : 'دائن'}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-black text-slate-900 dark:text-white">{line.amount.toLocaleString()}</td>
                        <td className="p-3 text-slate-500">{line.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedVoucher(null)}
                  className="px-6 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
