import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, Plus, Search, Phone, DollarSign, Edit3, Trash2, 
  UserCheck, HardHat, FolderTree, Settings, Check, Sparkles, Building, ChevronDown, CheckCircle2, AlertCircle,
  PauseCircle, PlayCircle, UserX, ShieldAlert
} from 'lucide-react';
import { Employee, Currency, Account, LinkedAccounts } from '../types';
import { PermissionGuard } from '../lib/permissions';
import { addAccount, updateAccount } from '../lib/dbService';
import { toast } from 'sonner';

interface EmployeesManagementProps {
  employees: Employee[];
  currencies: Currency[];
  accounts: Account[];
  linkedAccounts?: LinkedAccounts | null;
  onSaveLinkedAccounts?: (config: any) => Promise<void> | void;
  onSaveEmployee: (employee: Partial<Employee>) => void;
  onDeleteEmployee: (id: string) => void;
}

/**
 * Calculates the next sequential account code under a parent account in the Chart of Accounts
 */
function getNextChildAccountCode(parentId: string, accountsList: Account[]): string {
  if (!parentId) return "";
  const parentAcc = accountsList.find((a) => a.id === parentId || a.code === parentId);
  if (!parentAcc) return "";

  // Find all current direct children of this parent
  const children = accountsList.filter(
    (a) => a.parentId === parentAcc.id || a.parentId === parentAcc.code
  );

  let candidateCode = "";
  if (children.length > 0) {
    const numericCodes = children
      .map((c) => parseInt(c.code, 10))
      .filter((n) => !isNaN(n));

    if (numericCodes.length > 0) {
      const maxCode = Math.max(...numericCodes);
      candidateCode = (maxCode + 1).toString();
    } else {
      candidateCode = `${parentAcc.code}01`;
    }
  } else {
    // First child under this parent
    candidateCode = `${parentAcc.code}01`;
  }

  // Ensure code uniqueness in case of gaps or existing IDs
  let num = parseInt(candidateCode, 10);
  if (isNaN(num)) num = 1;
  while (accountsList.some((a) => a.code === candidateCode || a.id === candidateCode)) {
    num += 1;
    candidateCode = num.toString();
  }

  return candidateCode;
}

export default function EmployeesManagement({ 
  employees, 
  currencies, 
  accounts, 
  linkedAccounts,
  onSaveLinkedAccounts,
  onSaveEmployee, 
  onDeleteEmployee 
}: EmployeesManagementProps) {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Parent Account Configuration State
  const [parentAccountId, setParentAccountId] = useState<string>(
    linkedAccounts?.employeeParentAccountId || ''
  );
  const [isSavingParentConfig, setIsSavingParentConfig] = useState(false);
  const [showParentConfigPanel, setShowParentConfigPanel] = useState(false);

  // Auto-create Account in Chart of Accounts toggle in the modal
  const [autoCreateAccount, setAutoCreateAccount] = useState<boolean>(true);
  const [modalParentAccountId, setModalParentAccountId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    position: '',
    phone: '',
    salary: 0,
    currency: 'YER',
    linkedAccountId: '',
    expenseAccountId: '',
    status: 'active',
  });

  // Sync parentAccountId when linkedAccounts updates
  useEffect(() => {
    if (linkedAccounts?.employeeParentAccountId) {
      setParentAccountId(linkedAccounts.employeeParentAccountId);
    }
  }, [linkedAccounts?.employeeParentAccountId]);

  // Current selected parent account details
  const selectedParentAccount = accounts.find(
    (a) => a.id === parentAccountId || a.code === parentAccountId
  );

  // Next child code preview
  const nextChildCodePreview = selectedParentAccount 
    ? getNextChildAccountCode(selectedParentAccount.id, accounts) 
    : '';

  const handleSaveParentAccount = async () => {
    if (!parentAccountId) {
      toast.error("يرجى اختيار حساب أب من القائمة أولاً");
      return;
    }
    setIsSavingParentConfig(true);
    try {
      if (onSaveLinkedAccounts) {
        await onSaveLinkedAccounts({
          ...(linkedAccounts || {}),
          employeeParentAccountId: parentAccountId,
        });
      }
      toast.success("تم حفظ واعتماد الحساب الأب للموظفين بنجاح في إعدادات النظام!");
      setShowParentConfigPanel(false);
    } catch (err) {
      console.error("Failed saving parent account:", err);
      toast.error("حدث خطأ أثناء حفظ الحساب الأب");
    } finally {
      setIsSavingParentConfig(false);
    }
  };

  const handleOpenAddModal = () => {
    resetForm();
    setAutoCreateAccount(true);
    setModalParentAccountId(parentAccountId);
    setFormData({
      name: '',
      position: '',
      phone: '',
      salary: 0,
      currency: 'YER',
      linkedAccountId: '',
      expenseAccountId: '',
      status: 'active',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      ...emp,
      status: emp.status || 'active',
    });
    setAutoCreateAccount(false);
    setModalParentAccountId(parentAccountId);
    setShowModal(true);
  };

  // Quick toggle employee status (active <-> suspended)
  const handleToggleEmployeeStatus = async (emp: Employee) => {
    const isCurrentlySuspended = emp.status === 'suspended';
    const nextStatus: 'active' | 'suspended' = isCurrentlySuspended ? 'active' : 'suspended';
    const actionLabel = isCurrentlySuspended ? 'تفعيل' : 'توقيف';

    try {
      await onSaveEmployee({
        ...emp,
        status: nextStatus,
        suspendedAt: nextStatus === 'suspended' ? new Date().toISOString() : undefined,
      });

      // Also sync linked financial account status in Chart of Accounts
      if (emp.linkedAccountId) {
        const linkedAcc = accounts.find(a => a.id === emp.linkedAccountId || a.code === emp.linkedAccountId);
        if (linkedAcc) {
          try {
            await updateAccount(linkedAcc.id, {
              status: nextStatus === 'suspended' ? 'suspended' : 'active',
            });
          } catch (accErr) {
            console.error("Could not sync account status:", accErr);
          }
        }
      }

      if (nextStatus === 'suspended') {
        toast.warning(`تم توقيف حساب الموظف "${emp.name}". لن يتم إنزاله في مسودة كشوفات الرواتب.`);
      } else {
        toast.success(`تم إعادة تفعيل حساب الموظف "${emp.name}" بنجاح.`);
      }
    } catch (err) {
      toast.error(`حدث خطأ أثناء ${actionLabel} الموظف`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let finalLinkedAccountId = formData.linkedAccountId;

      // When adding a new employee with autoCreateAccount checked
      if (!editingEmployee && autoCreateAccount) {
        const parentIdToUse = modalParentAccountId || parentAccountId;
        if (!parentIdToUse) {
          toast.error("يرجى تحديد الحساب الأب الرئيسي أولاً ليتم إنشاء حساب الموظف تحته!");
          setIsSubmitting(false);
          return;
        }

        const parentAcc = accounts.find(
          (a) => a.id === parentIdToUse || a.code === parentIdToUse
        );
        if (!parentAcc) {
          toast.error("الحساب الأب المحدد غير موجود بدليل الحسابات!");
          setIsSubmitting(false);
          return;
        }

        const newCode = getNextChildAccountCode(parentAcc.id, accounts);
        if (!newCode) {
          toast.error("تعذر توليد كود محاسبي للحساب الجديد");
          setIsSubmitting(false);
          return;
        }

        // 1. Create financial account in Chart of Accounts
        const newAccountPayload = {
          id: newCode,
          code: newCode,
          name: formData.name!.trim(),
          type: parentAcc.type,
          parentId: parentAcc.id,
          balance: 0,
          currency: formData.currency || parentAcc.currency || 'YER',
          notes: `حساب مالي للموظف: ${formData.name!.trim()} - المسمى: ${formData.position || 'موظف'}`,
          isTransactional: true,
          classification: 'employee' as const,
          category: 'employee' as const,
          status: (formData.status === 'suspended' ? 'suspended' : 'active') as any,
          createdAt: new Date().toISOString(),
        };

        await addAccount(newAccountPayload);
        finalLinkedAccountId = newCode;

        // Auto-save parent account if it wasn't saved yet
        if (!parentAccountId && onSaveLinkedAccounts) {
          setParentAccountId(parentIdToUse);
          await onSaveLinkedAccounts({
            ...(linkedAccounts || {}),
            employeeParentAccountId: parentIdToUse,
          });
        }

        toast.success(`تم إنشاء الحساب المالي بالدليل بنجاح (كود: ${newCode})`);
      } else if (!finalLinkedAccountId) {
        toast.error("يرجى اختيار الحساب المالي المرتبط بالموظف!");
        setIsSubmitting(false);
        return;
      }

      const employeePayload: Partial<Employee> = {
        ...formData,
        status: formData.status || 'active',
        linkedAccountId: finalLinkedAccountId,
      };

      if (editingEmployee) {
        employeePayload.id = editingEmployee.id;
      }

      await onSaveEmployee(employeePayload);

      // If editing and status changed, also update the linked account status
      if (editingEmployee && finalLinkedAccountId) {
        const linkedAcc = accounts.find(a => a.id === finalLinkedAccountId || a.code === finalLinkedAccountId);
        if (linkedAcc && linkedAcc.status !== formData.status) {
          try {
            await updateAccount(linkedAcc.id, {
              status: formData.status === 'suspended' ? 'suspended' : 'active',
            });
          } catch (accErr) {
            console.error("Could not sync account status:", accErr);
          }
        }
      }

      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Error saving employee with linked account:", err);
      toast.error("حدث خطأ أثناء حفظ بيانات الموظف أو إنشاء الحساب المالي");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      position: '',
      phone: '',
      salary: 0,
      currency: 'YER',
      linkedAccountId: '',
      expenseAccountId: '',
      status: 'active',
    });
    setEditingEmployee(null);
  };

  const activeEmployeesCount = employees.filter(e => e.status !== 'suspended').length;
  const suspendedEmployeesCount = employees.filter(e => e.status === 'suspended').length;

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = 
      (e.name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
      (e.position || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
      (e.phone || "").toLowerCase().includes((searchTerm || "").toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === 'active') return e.status !== 'suspended';
    if (statusFilter === 'suspended') return e.status === 'suspended';
    return true;
  });

  return (
    <div className="space-y-6 text-right">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <HardHat className="h-8 w-8 text-orange-500" />
            إدارة شؤون الموظفين
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">سجل الموظفين، الرواتب، والربط المالي بالدليل المحاسبي</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowParentConfigPanel(!showParentConfigPanel)}
            className={`flex items-center gap-2 font-bold py-2.5 px-4 rounded-xl text-xs transition-all border ${
              selectedParentAccount 
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 hover:bg-amber-100'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 animate-pulse'
            }`}
          >
            <FolderTree className="h-4 w-4" />
            {selectedParentAccount ? `الحساب الأب: ${selectedParentAccount.name}` : 'تحديد الحساب الأب للموظفين'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showParentConfigPanel ? 'rotate-180' : ''}`} />
          </button>

          <PermissionGuard permission="create-employee">
            <button 
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95 text-sm"
            >
              <Plus className="h-4 w-4" />
              إضافة موظف
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Parent Account Configuration Panel */}
      {(showParentConfigPanel || !selectedParentAccount) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50/50 dark:from-slate-900 dark:via-orange-950/20 dark:to-slate-900 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-5 shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-orange-200/60 dark:border-orange-900/40 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl">
                <FolderTree className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  الحساب الأب الرئيسي لحسابات الموظفين بالدليل المحاسبي
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  عند إضافة موظف جديد، سيتم إنشاء حساب مالي فرعي له تلقائياً تحت هذا الحساب مع توليد كود تسلسلي منتظم
                </p>
              </div>
            </div>

            {selectedParentAccount && (
              <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-black">
                <CheckCircle2 className="h-4 w-4" />
                معتمد: {selectedParentAccount.name} ({selectedParentAccount.code})
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-8">
              <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1.5">
                اختر الحساب الأب من دليل الحسابات (مثل: ذمم الموظفين، رواتب مستحقة، أو مخصص الرواتب):
              </label>
              <select
                value={parentAccountId}
                onChange={(e) => setParentAccountId(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-orange-500"
              >
                <option value="">-- اختر الحساب الأب الرئيسي --</option>
                {accounts
                  .filter((a) => a.type === 'liability' || a.type === 'expense' || a.type === 'asset')
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name} ({acc.type === 'liability' ? 'خصوم/التزامات' : acc.type === 'expense' ? 'مصروفات' : 'أصول'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveParentAccount}
                disabled={isSavingParentConfig || !parentAccountId}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {isSavingParentConfig ? (
                  <span>جاري الحفظ...</span>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    حفظ واعتماد الحساب الأب
                  </>
                )}
              </button>
            </div>
          </div>

          {selectedParentAccount && (
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1 text-slate-500">
                <Building className="h-3.5 w-3.5 text-orange-500" />
                نوع الحساب: <strong className="text-slate-700 dark:text-slate-200">{selectedParentAccount.type}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="flex items-center gap-1 text-slate-500">
                العملة: <strong className="text-slate-700 dark:text-slate-200">{selectedParentAccount.currency}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="h-3.5 w-3.5" />
                الكود المتوقع للموظف القادم: <strong className="font-mono underline">{nextChildCodePreview}</strong>
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Search, Filter Tabs and Stats bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، المسمى، أو الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pr-10 pl-4 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-right"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span>الكل</span>
            <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-full text-[10px] font-mono">
              {employees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-black'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>النشطون</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${statusFilter === 'active' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'}`}>
              {activeEmployeesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('suspended')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'suspended'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30 font-black'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>الموقوفون</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${statusFilter === 'suspended' ? 'bg-rose-700 text-white' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'}`}>
              {suspendedEmployeesCount}
            </span>
          </button>
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((emp) => {
          const isSuspended = emp.status === 'suspended';
          const linkedAcc = accounts.find(a => a.id === emp.linkedAccountId || a.code === emp.linkedAccountId);
          return (
            <motion.div 
              layout
              key={emp.id}
              className={`rounded-3xl border p-6 transition-all group relative overflow-hidden flex flex-col justify-between ${
                isSuspended
                  ? 'bg-slate-50/80 dark:bg-slate-900/70 border-rose-200 dark:border-rose-900/40 opacity-85 hover:opacity-100 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-xl'
              }`}
            >
              <div>
                {/* Suspended alert banner */}
                {isSuspended && (
                  <div className="bg-rose-500/10 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-[11px] font-black px-3 py-1.5 text-center mb-4 rounded-xl flex items-center justify-center gap-1.5">
                    <PauseCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>حساب موقوف (مستبعد من كشوفات الرواتب)</span>
                  </div>
                )}

                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl transition-all ${
                    isSuspended
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                  }`}>
                    {emp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-base font-black truncate ${isSuspended ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-white'}`}>
                      {emp.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-black bg-orange-50 dark:bg-orange-900/20 text-orange-600 px-2 py-0.5 rounded-full inline-block">
                        {emp.position}
                      </span>
                      {isSuspended ? (
                        <span className="text-[10px] font-black bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          موقوف
                        </span>
                      ) : (
                        <span className="text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          نشط
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mr-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <PermissionGuard permission="edit-employee">
                      <button 
                        onClick={() => handleOpenEditModal(emp)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-orange-500 cursor-pointer"
                        title="تعديل الموظف"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </PermissionGuard>
                    <PermissionGuard permission="delete-employee">
                      <button 
                        onClick={() => onDeleteEmployee(emp.id)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="حذف الموظف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </PermissionGuard>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <Phone className="h-4 w-4 text-orange-400" />
                    <span className="font-mono">{emp.phone}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">الراتب الأساسي</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1">
                      {emp.salary.toLocaleString()}
                      <span className="text-[10px] text-orange-500 font-bold">{emp.currency}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">الحساب المالي:</div>
                  <div className="text-[11px] font-black">
                    {linkedAcc ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-900/40">
                        {linkedAcc.code} - {linkedAcc.name}
                      </span>
                    ) : (
                      <span className="text-rose-500 text-[10px]">غير مربوط</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Toggle Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-slate-400">
                  {isSuspended ? "الحساب معطل حالياً" : "الحساب نشط ومعتمد"}
                </span>
                <PermissionGuard permission="edit-employee">
                  <button
                    type="button"
                    onClick={() => handleToggleEmployeeStatus(emp)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isSuspended
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95"
                        : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 active:scale-95"
                    }`}
                    title={isSuspended ? "إعادة تفعيل الموظف وإنزاله بكشوفات الرواتب" : "توقيف حساب الموظف واستبعاده من كشوفات الرواتب"}
                  >
                    {isSuspended ? (
                      <>
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span>تفعيل الحساب</span>
                      </>
                    ) : (
                      <>
                        <PauseCircle className="h-3.5 w-3.5" />
                        <span>توقيف الحساب</span>
                      </>
                    )}
                  </button>
                </PermissionGuard>
              </div>
            </motion.div>
          );
        })}

        {filteredEmployees.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
            <HardHat className="h-12 w-12 text-slate-300" />
            <p className="text-slate-500 font-bold">
              {statusFilter === 'suspended' ? 'لا يوجد موظفون موقوفون' : statusFilter === 'active' ? 'لا يوجد موظفون نشطون' : 'لا يوجد موظفين مسجلين'}
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-orange-600 p-6 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black">{editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h3>
                  <p className="text-white/80 text-xs font-medium">
                    {autoCreateAccount && !editingEmployee
                      ? 'سيتم إنشاء حساب مالي للموظف بالدليل تلقائياً تحت الحساب الأب المحدد'
                      : 'إدارة وتحديث الملف الوظيفي والحساب المالي'}
                  </p>
                </div>
                <Briefcase className="h-10 w-10 opacity-40" />
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">اسم الموظف</label>
                    <input 
                      type="text"
                      required
                      placeholder="الأسم الثلاثي"
                      value={formData.name || ""}
                      onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">المسمى الوظيفي</label>
                    <input 
                      type="text"
                      required
                      placeholder="مدير، محاسب، استقبال..."
                      value={formData.position || ""}
                      onChange={e => setFormData(p => ({...p, position: e.target.value}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">رقم الهاتف</label>
                    <input 
                      type="tel"
                      required
                      placeholder="000000000"
                      value={formData.phone || ""}
                      onChange={e => setFormData(p => ({...p, phone: e.target.value}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 text-right font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">العملة</label>
                    <select 
                      required
                      value={formData.currency || ""}
                      onChange={e => setFormData(p => ({...p, currency: e.target.value}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500"
                    >
                      {currencies.map(cur => (
                        <option key={cur.id} value={cur.code}>{cur.code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">الراتب الأساسي</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input 
                        type="number"
                        required
                        min="0"
                        value={formData.salary || ""}
                        onChange={e => setFormData(p => ({...p, salary: parseFloat(e.target.value) || 0}))}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 pl-10 text-sm font-black focus:ring-2 focus:ring-orange-500 text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">حالة الموظف</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={e => setFormData(p => ({...p, status: e.target.value as 'active' | 'suspended'}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-orange-500 cursor-pointer"
                    >
                      <option value="active">🟢 نشط (يُدرج بكشوفات الرواتب)</option>
                      <option value="suspended">🔴 موقوف (يُستبعد من كشوفات الرواتب)</option>
                    </select>
                  </div>
                </div>

                {/* Financial Account Section */}
                {!editingEmployee && (
                  <div className="border border-orange-200 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/20 rounded-2xl p-4 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCreateAccount}
                        onChange={(e) => setAutoCreateAccount(e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 cursor-pointer"
                      />
                      <span className="text-xs font-black text-slate-800 dark:text-white">
                        إنشاء حساب مالي جديد للموظف تلقائياً في الدليل المحاسبي
                      </span>
                    </label>

                    {autoCreateAccount ? (
                      <div className="space-y-2 pt-1 border-t border-orange-200/60 dark:border-orange-900/40">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1">
                            الحساب الأب المحدد بالدليل:
                          </label>
                          <select
                            value={modalParentAccountId || parentAccountId}
                            onChange={(e) => setModalParentAccountId(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-orange-300 dark:border-orange-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="">-- اختر الحساب الأب لإنشاء الحساب تحته --</option>
                            {accounts
                              .filter((a) => a.type === 'liability' || a.type === 'expense' || a.type === 'asset')
                              .map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name} ({acc.type === 'liability' ? 'خصوم' : acc.type === 'expense' ? 'مصروفات' : 'أصول'})
                                </option>
                              ))}
                          </select>
                        </div>

                        {(modalParentAccountId || parentAccountId) && (
                          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-orange-100 dark:border-orange-900/30 text-[11px] space-y-1">
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                              <span>اسم الحساب المالي الجديد:</span>
                              <strong className="text-slate-800 dark:text-white">{formData.name?.trim() || 'اسم الموظف'}</strong>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                              <span>الكود المحاسبي التسلسلي المتولد:</span>
                              <strong className="text-orange-600 font-mono font-black">
                                {getNextChildAccountCode(modalParentAccountId || parentAccountId, accounts)}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] font-black text-slate-500 block mb-1">اختيار حساب مالي موجود يدوياً</label>
                        <select 
                          required={!autoCreateAccount}
                          value={formData.linkedAccountId || ""}
                          onChange={e => setFormData(p => ({...p, linkedAccountId: e.target.value}))}
                          className="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-3 text-xs focus:ring-2 focus:ring-orange-500 font-bold"
                        >
                          <option value="">اختر الحساب...</option>
                          {accounts.filter(a => a.type === 'expense' || a.type === 'liability' || a.type === 'asset').map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* If editing employee */}
                {editingEmployee && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">الحساب المالي المرتبط</label>
                    <select 
                      required
                      value={formData.linkedAccountId || ""}
                      onChange={e => setFormData(p => ({...p, linkedAccountId: e.target.value}))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">اختر حساب الموظف...</option>
                      {accounts.filter(a => a.type === 'expense' || a.type === 'liability' || a.type === 'asset').map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Expense Account (Debit upon accrual) */}
                <div className="mt-4">
                  <label className="text-[10px] font-black text-slate-500 block mb-1">حساب مصروف الراتب (المدين عند الاستحقاق)</label>
                  <select 
                    value={formData.expenseAccountId || ""}
                    onChange={e => setFormData(p => ({...p, expenseAccountId: e.target.value}))}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-orange-500 font-bold"
                  >
                    <option value="">اختر حساب المصروف (افتراضي أو عام إن لم يُحدد)...</option>
                    {accounts.filter(a => a.type === 'expense' && a.isTransactional).map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                  >
                    {isSubmitting ? 'جاري الحفظ والإنشاء...' : 'حفظ الملف الوظيفي'}
                  </button>
                  <button 
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowModal(false)}
                    className="px-6 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
