import React, { useMemo, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, Building2, Coins, Check, Filter, Printer } from "lucide-react";
import { PermissionGuard } from '../lib/permissions';

interface CashMovement {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'in' | 'out';
  accountName: string;
  correspondingAccountName: string;
  approved?: boolean;
  audited?: boolean;
}

interface CashMovementsProps {
  transactions: any[];
  accounts: any[];
}

const formatDateOnly = (dStr: any) => {
  if (!dStr) return '';
  return String(dStr).split(/[\sT]/)[0];
};

const isCashAccount = (acc: any) => {
  if (!acc) return false;
  if (acc.classification === 'cashbox' || acc.category === 'cash') return true;
  const name = (acc.name || '').toLowerCase();
  return name.includes('صندوق') || name.includes('نقدي') || name.includes('كاش') || name.includes('صناديق');
};

const isBankAccount = (acc: any) => {
  if (!acc) return false;
  if (acc.classification === 'bank' || acc.category === 'bank') return true;
  const name = (acc.name || '').toLowerCase();
  return name.includes('بنك') || name.includes('مصرف') || name.includes('بنوك') || name.includes('تحويل') || name.includes('حساب بنكي');
};

export default function CashMovementsView({ transactions, accounts }: CashMovementsProps) {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'audited' | 'unaudited'>('all');
  
  // Multi-select for Cash & Bank types
  const [selectedTypes, setSelectedTypes] = useState<('cash' | 'bank')[]>(['cash', 'bank']);
  
  // Specific Selected Accounts
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // Toggle type (Cash / Bank)
  const toggleType = (type: 'cash' | 'bank') => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter(t => t !== type));
      } else {
        // Switch to the other type if only 1 is active
        setSelectedTypes(type === 'cash' ? ['bank'] : ['cash']);
      }
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  // Filter available accounts based on selected types (Cash/Bank) - leaf sub-accounts only (not parent accounts)
  const availableAccounts = useMemo(() => {
    return accounts.filter(acc => {
      // Must be a leaf / transactional sub-account (not a parent account / ليس من الآباء)
      const isLeaf = (acc.isTransactional !== false) && !accounts.some(child => child.parentId === acc.id);
      if (!isLeaf) return false;

      const isCash = isCashAccount(acc);
      const isBank = isBankAccount(acc);

      if (selectedTypes.includes('cash') && isCash) return true;
      if (selectedTypes.includes('bank') && isBank) return true;

      // Fallback if not classified strictly but is in transactional accounts
      if (!isCash && !isBank) {
        if (selectedTypes.includes('cash') && acc.name.includes('صندوق')) return true;
        if (selectedTypes.includes('bank') && acc.name.includes('بنك')) return true;
      }
      return false;
    });
  }, [accounts, selectedTypes]);

  // Determine active accounts for calculation
  const activeCashAccounts = useMemo(() => {
    if (selectedAccountIds.length > 0) {
      return availableAccounts.filter(acc => selectedAccountIds.includes(acc.id));
    }
    return availableAccounts;
  }, [availableAccounts, selectedAccountIds]);

  const { movements, openingBalance, totalIn, totalOut } = useMemo(() => {
    const cashAccountIds = activeCashAccounts.map(acc => acc.id);
    
    // Filter all transactions to calculate opening balance
    const allRelevantTransactions = transactions.filter(t => {
      if (!t) return false;
      const hasCashEntry = t.entries && Array.isArray(t.entries) && t.entries.some((e: any) => cashAccountIds.includes(e.accountId));
      return hasCashEntry || (t.debitAccountId && cashAccountIds.includes(t.debitAccountId)) || (t.creditAccountId && cashAccountIds.includes(t.creditAccountId));
    });

    const prePeriodTransactions = allRelevantTransactions.filter(t => formatDateOnly(t.date) < startDate);
    const periodTransactions = allRelevantTransactions.filter(t => {
      const d = formatDateOnly(t.date);
      return d >= startDate && d <= endDate;
    });

    // Opening balance calculation: sum of all cash/bank entries before startDate
    let opening = 0;
    prePeriodTransactions.forEach(t => {
      if (t.entries) {
        t.entries.forEach((e: any) => {
          if (cashAccountIds.includes(e.accountId)) {
            opening += (e.debit || 0) - (e.credit || 0);
          }
        });
      } else {
        if (cashAccountIds.includes(t.debitAccountId)) opening += t.amount || 0;
        if (cashAccountIds.includes(t.creditAccountId)) opening -= t.amount || 0;
      }
    });

    const movements: CashMovement[] = periodTransactions.flatMap(t => {
      const dOnly = formatDateOnly(t.date);
      if (t.entries && Array.isArray(t.entries)) {
        return t.entries
          .filter((e: any) => cashAccountIds.includes(e.accountId))
          .map((e: any) => {
            const corresponding = t.entries.find((entry: any) => entry.accountId !== e.accountId);
            const amount = Math.abs(e.debit || e.credit || e.amount || 0);
            const isDebit = (e.debit || 0) > 0;
            return {
              id: t.id + e.accountId,
              date: dOnly,
              description: t.description || t.note || '',
              amount,
              type: isDebit ? 'in' : 'out',
              accountName: accounts.find(a => a.id === e.accountId)?.name || 'غير محدد',
              correspondingAccountName: (corresponding ? accounts.find(a => a.id === corresponding.accountId)?.name : null) || 'طرف آخر',
              approved: t.status === 'audited',
              audited: t.status === 'audited'
            };
          });
      } else {
        const isDebitCash = cashAccountIds.includes(t.debitAccountId);
        const isCreditCash = cashAccountIds.includes(t.creditAccountId);
        
        if (isDebitCash) {
          return [{ id: t.id, date: dOnly, description: t.description, amount: t.amount || 0, type: 'in', accountName: accounts.find(a => a.id === t.debitAccountId)?.name || 'غير محدد', correspondingAccountName: accounts.find(a => a.id === t.creditAccountId)?.name || 'طرف آخر', approved: t.status === 'audited', audited: t.status === 'audited' }];
        } else if (isCreditCash) {
          return [{ id: t.id, date: dOnly, description: t.description, amount: t.amount || 0, type: 'out', accountName: accounts.find(a => a.id === t.creditAccountId)?.name || 'غير محدد', correspondingAccountName: accounts.find(a => a.id === t.debitAccountId)?.name || 'طرف آخر', approved: t.status === 'audited', audited: t.status === 'audited' }];
        }
        return [];
      }
    });

    // Apply status filter
    const filteredMovements = movements.filter(m => {
      if (filterStatus === 'approved') return m.approved;
      if (filterStatus === 'audited') return m.audited;
      if (filterStatus === 'unaudited') return !m.audited;
      return true;
    });

    const tIn = filteredMovements.filter(m => m.type === 'in').reduce((sum, m) => sum + m.amount, 0);
    const tOut = filteredMovements.filter(m => m.type === 'out').reduce((sum, m) => sum + m.amount, 0);

    return { movements: filteredMovements.sort((a, b) => b.date.localeCompare(a.date)), openingBalance: opening, totalIn: tIn, totalOut: tOut };
  }, [transactions, activeCashAccounts, accounts, startDate, endDate, filterStatus]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const renderTable = (type: 'in' | 'out', title: string) => {
    const filtered = movements.filter(m => m.type === type);
    const tableTotal = filtered.reduce((sum, m) => sum + m.amount, 0);

    const grouped = filtered.reduce((acc, move) => {
      const group = move.correspondingAccountName;
      if (!acc[group]) acc[group] = { total: 0, moves: [] };
      acc[group].moves.push(move);
      acc[group].total += move.amount;
      return acc;
    }, {} as Record<string, { total: number, moves: CashMovement[] }>);

    const sortedGroups = Object.entries(grouped)
      .sort((a, b) => b[1].total - a[1].total);

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-3">
        <div className={`p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between ${type === 'in' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'}`}>
          <div className="flex items-center gap-1.5">
            {type === 'in' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
            <h2 className="font-black text-sm">{title}</h2>
          </div>
          <div className="font-black text-sm">الإجمالي: {tableTotal.toLocaleString()} YER</div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[380px] text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-2.5">الحساب المقابل</th>
                <th className="p-2.5">التاريخ</th>
                <th className="p-2.5">البيان</th>
                <th className="p-2.5 text-left">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedGroups.map(([group, { total, moves }]) => {
                const sortedMoves = [...moves].sort((a, b) => b.amount - a.amount);
                return (
                  <React.Fragment key={group}>
                    <tr className="bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))}>
                      <td className="p-2.5 font-bold" colSpan={3}>{group} ({moves.length})</td>
                      <td className="p-2.5 font-black text-left font-mono">{total.toLocaleString()}</td>
                    </tr>
                    {expandedGroups[group] && sortedMoves.map((move) => (
                      <tr key={move.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-2.5 pl-4 text-slate-600 dark:text-slate-300">{move.accountName}</td>
                        <td className="p-2.5 text-slate-500 font-mono whitespace-nowrap">{formatDateOnly(move.date)}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300 max-w-[220px] truncate" title={move.description}>{move.description}</td>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 text-left font-mono whitespace-nowrap">{move.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {sortedGroups.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400 font-medium">
                    لا توجد حركات في هذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-2 md:p-4 space-y-3 text-xs print-area max-w-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Wallet size={22} className="text-blue-600 dark:text-blue-400" /> حركة النقد والبنوك
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium print:hidden">
            متابعة المقبوضات والمدفوعات للصناديق النقدية والحسابات البنكية
          </p>
        </div>
        <PermissionGuard permission="print-cash-movements">
          <button 
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-3.5 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-md active:scale-95 print:hidden flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={15} />
            طباعة التقرير
          </button>
        </PermissionGuard>
      </div>
      
      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-3 space-y-3 print:hidden">
        {/* Row 1: Dates & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="flex items-center gap-1.5 min-w-[130px]">
              <label className="font-bold text-slate-600 dark:text-slate-300 text-[11px] whitespace-nowrap">من:</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="p-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-full" 
              />
            </div>
            <div className="flex items-center gap-1.5 min-w-[130px]">
              <label className="font-bold text-slate-600 dark:text-slate-300 text-[11px] whitespace-nowrap">إلى:</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="p-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-full" 
              />
            </div>
            <div className="flex items-center gap-1.5 min-w-[120px]">
              <label className="font-bold text-slate-600 dark:text-slate-300 text-[11px] whitespace-nowrap">الحالة:</label>
              <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value as any)} 
                className="p-1.5 text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="all">الكل</option>
                <option value="approved">معتمد</option>
                <option value="audited">مدقق</option>
                <option value="unaudited">غير مدقق</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Multi-select Type (Cash / Bank) & Specific Account Field */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          {/* Multi-Select Type (الصناديق النقدية / الحسابات البنكية) */}
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap flex items-center gap-1">
              <Filter size={13} className="text-indigo-500" /> نوع الحسابات:
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => toggleType('cash')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedTypes.includes('cash')
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Coins size={13} />
                <span>النقد والصناديق</span>
                {selectedTypes.includes('cash') && <Check size={12} className="stroke-[3]" />}
              </button>

              <button
                type="button"
                onClick={() => toggleType('bank')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedTypes.includes('bank')
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 size={13} />
                <span>البنوك والمصارف</span>
                {selectedTypes.includes('bank') && <Check size={12} className="stroke-[3]" />}
              </button>
            </div>
          </div>

          {/* Account Selection Field */}
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <label className="font-black text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">تحديد حساب معين:</label>
            <select
              value={selectedAccountIds.length === 1 ? selectedAccountIds[0] : (selectedAccountIds.length > 1 ? 'custom' : 'all')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') {
                  setSelectedAccountIds([]);
                } else if (val !== 'custom') {
                  setSelectedAccountIds([val]);
                }
              }}
              className="w-full p-1.5 text-xs font-black border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">
                كافة حسابات ({selectedTypes.map(t => t === 'cash' ? 'الصناديق النقدية' : 'الحسابات البنكية').join(' و ')})
              </option>
              {availableAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {isCashAccount(acc) ? '💵' : '🏦'} {acc.name} {acc.code ? `(${acc.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-800 text-white p-2.5 rounded-xl shadow-sm">
          <div className="text-[10px] sm:text-xs opacity-75 font-medium">أول المدة</div>
          <div className="text-xs sm:text-sm font-black font-mono truncate">{openingBalance.toLocaleString()} YER</div>
        </div>
        <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-sm">
          <div className="text-[10px] sm:text-xs opacity-75 font-medium">الداخل (المقبوضات)</div>
          <div className="text-xs sm:text-sm font-black font-mono truncate">{totalIn.toLocaleString()} YER</div>
        </div>
        <div className="bg-rose-600 text-white p-2.5 rounded-xl shadow-sm">
          <div className="text-[10px] sm:text-xs opacity-75 font-medium">الخارج (المدفوعات)</div>
          <div className="text-xs sm:text-sm font-black font-mono truncate">{totalOut.toLocaleString()} YER</div>
        </div>
        <div className="bg-blue-700 text-white p-2.5 rounded-xl shadow-sm">
          <div className="text-[10px] sm:text-xs opacity-75 font-medium">الرصيد المتبقي</div>
          <div className="text-xs sm:text-sm font-black font-mono truncate">{(openingBalance + totalIn - totalOut).toLocaleString()} YER</div>
        </div>
      </div>

      {/* Tables */}
      {renderTable('in', 'المقبوضات')}
      {renderTable('out', 'المدفوعات')}
    </div>
  );
}
