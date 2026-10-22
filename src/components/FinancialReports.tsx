import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Account, Transaction, Currency, CompanySettings, Client, Booking, ReceiptPayment } from '../types';
import { FileText, Download, BarChart3, TrendingUp, PieChart, Info, CheckSquare, Printer, Calendar, BookOpen, X, Eye, Filter, ArrowUpRight, Sparkles, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import AccountStatementModal from './AccountStatementModal';

interface FinancialReportsProps {
  accounts: Account[];
  transactions: Transaction[];
  currencies: Currency[];
  globalCurrencyCode: string;
  users?: any[];
  bookings?: any[];
  clients?: any[];
  services?: any[];
  vouchers?: any[];
  companySettings?: CompanySettings | null;
  setPrintData?: (data: any) => void;
}

export default function FinancialReports({
  accounts,
  transactions,
  currencies,
  globalCurrencyCode,
  users = [],
  bookings = [],
  clients = [],
  services = [],
  vouchers = [],
  companySettings,
  setPrintData
}: FinancialReportsProps) {
  const [activeTab, setActiveTab] = useState<'trial_balance' | 'income_statement' | 'balance_sheet' | 'journal_entries' | 'cash_flow'>('trial_balance');

  const selectedGlobalCurrencyObj = currencies.find(c => c.code === globalCurrencyCode) || { symbol: "$" };

  // Date Period Filter State at top level
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  // Account Statement Modal State
  const [selectedAccountForStatement, setSelectedAccountForStatement] = useState<Account | null>(null);

  // Official Print Preview Modal State
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false);

  // Quick Date Range Presets
  const handleSetPresetDate = (preset: 'today' | 'this_month' | 'q1' | 'q2' | 'q3' | 'q4' | 'this_year' | 'all') => {
    const today = new Date();
    const currentYear = today.getFullYear();

    if (preset === 'today') {
      const dateStr = today.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (preset === 'this_month') {
      const firstDay = new Date(currentYear, today.getMonth(), 1).toISOString().split('T')[0];
      const dateStr = today.toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(dateStr);
    } else if (preset === 'this_year') {
      setStartDate(`${currentYear}-01-01`);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'all') {
      setStartDate('2020-01-01');
      setEndDate(today.toISOString().split('T')[0]);
    }
  };

  // Helper formatting function to exclude decimal zeros but keep significant cents
  const formatReportAmount = (val: number | undefined | null) => {
    if (val === undefined || val === null || Math.abs(val) < 0.005) return '-';
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  const formatDebitBalance = (val: number | undefined | null) => {
    if (val === undefined || val === null || val <= 0.005) return '-';
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  const formatMovementAmount = (val: number | undefined | null) => {
    if (val === undefined || val === null || val <= 0.005) return '-';
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  // Helper: Get transaction amount in global currency using its historical rate
  const getTxAmountInGlobal = (tx: any): number => {
    let amountInBase = tx.baseAmount;
    if (amountInBase === undefined) {
      amountInBase = tx.amount * (tx.rate || 1);
    }
    const toCurr = currencies.find(c => c.code === globalCurrencyCode);
    if (!toCurr || toCurr.rateToBase === 1) return amountInBase;
    return amountInBase / toCurr.rateToBase;
  };

  // Analytical View State
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [analyticalDimension, setAnalyticalDimension] = useState<'client' | 'date' | 'month' | 'user' | 'service' | 'event'>('client');
  const [reportMode, setReportMode] = useState<'balance' | 'movement'>('balance');
  const [hideZero, setHideZero] = useState(true);
  const [accountLevel, setAccountLevel] = useState<'all' | 'main' | 'sub'>('all');

  // Print Customization States
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [printDensity, setPrintDensity] = useState<'ultra' | 'compact' | 'normal'>('ultra');
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [compactHeader, setCompactHeader] = useState<boolean>(true);
  const [balanceSheetView, setBalanceSheetView] = useState<'side_by_side' | 'stacked'>('side_by_side');
  const [printScale, setPrintScale] = useState<number>(100);

  // Trial Balance & Financial Reports Tree Row Calculation with Harmonious Accounting Themes
  const renderTreeRow = (node: any, depth: number = 0, index: number = 0, mode: 'trial_balance' | 'income_statement' | 'balance_sheet' = 'trial_balance'): any[] => {
    const hasActivity = Math.abs(node.beginDebitAgg || 0) > 0.01 || Math.abs(node.beginCreditAgg || 0) > 0.01 || Math.abs(node.endDebitAgg || 0) > 0.01 || Math.abs(node.endCreditAgg || 0) > 0.01 || Math.abs(node.moveDebitAgg || 0) > 0.01 || Math.abs(node.moveCreditAgg || 0) > 0.01;
    if (hideZero && !hasActivity) return [];

    const isParent = node.children && node.children.length > 0;

    // Harmonious Color Themes based on mode and account type:
    let rowBgClass = '';
    let borderAccent = 'border-b border-slate-200';

    if (mode === 'balance_sheet') {
      const isAsset = node.type === 'asset';
      if (depth === 0) {
        rowBgClass = isAsset 
          ? 'bg-emerald-100/90 text-emerald-950 font-black border-r-4 border-r-emerald-600 border-b border-emerald-300' 
          : 'bg-indigo-100/90 text-indigo-950 font-black border-r-4 border-r-indigo-600 border-b border-indigo-300';
      } else if (isParent) {
        rowBgClass = isAsset 
          ? 'bg-emerald-50/60 text-slate-900 font-bold border-r-2 border-r-emerald-400 border-b border-slate-200' 
          : 'bg-indigo-50/60 text-slate-900 font-bold border-r-2 border-r-indigo-400 border-b border-slate-200';
      } else {
        rowBgClass = index % 2 === 0 
          ? 'bg-white text-slate-800 hover:bg-slate-50 border-b border-slate-100' 
          : 'bg-slate-50/50 text-slate-800 hover:bg-slate-100 border-b border-slate-100';
      }
    } else if (mode === 'trial_balance') {
      if (depth === 0) {
        rowBgClass = 'bg-slate-800 text-white font-black border-b border-slate-900';
      } else if (isParent) {
        rowBgClass = 'bg-indigo-50/70 font-black text-indigo-950 border-r-4 border-r-indigo-600 border-b border-slate-300';
      } else {
        rowBgClass = index % 2 === 0 
          ? 'bg-white text-slate-800 hover:bg-slate-50 border-b border-slate-200' 
          : 'bg-slate-50/70 text-slate-800 hover:bg-slate-100 border-b border-slate-200';
      }
    } else {
      // Income statement
      if (isParent) {
        rowBgClass = 'bg-slate-100 font-black text-slate-950 border-t-2 border-slate-300';
      } else {
        rowBgClass = 'bg-white text-slate-800 border-b border-slate-200';
      }
    }

    const balanceAmount = mode === 'trial_balance' 
      ? formatMovementAmount(node.endDebitAgg || node.endCreditAgg)
      : formatReportAmount(node.type === 'revenue' || node.type === 'liability' || node.type === 'equity' ? (node.endCreditAgg - node.endDebitAgg) : (node.endDebitAgg - node.endCreditAgg));

    const cellPadding = printDensity === 'ultra'
      ? 'py-[1px] px-1 print:py-[0.5px] print:px-[1px] leading-tight'
      : printDensity === 'compact'
      ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px] leading-tight'
      : 'py-1.5 px-2 print:py-1 print:px-1.5';

    const cellFont = printDensity === 'ultra'
      ? 'text-[8px] print:text-[7px]'
      : printDensity === 'compact'
      ? 'text-[9px] print:text-[8px]'
      : 'text-xs print:text-[9.5px]';

    const depthPadding = printDensity === 'ultra'
      ? `${depth * 6 + 3}px`
      : printDensity === 'compact'
      ? `${depth * 10 + 5}px`
      : `${depth * 14 + 6}px`;

    const rowNum = depth === 0 ? (index + 1) : '-';

    const res = [
      <tr key={node.id} className={`${rowBgClass} ${cellFont}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <td className={`${cellPadding} text-center border-l border-slate-300 font-mono ${printDensity === 'ultra' ? 'text-[7.5px] print:text-[6.5px]' : 'text-[9px] print:text-[8px]'} ${depth === 0 ? 'font-black' : 'text-slate-400'}`}>
          {rowNum}
        </td>
        <td className={`${cellPadding} font-mono text-center border-l border-slate-300 font-bold ${depth === 0 ? 'text-indigo-900' : 'text-slate-700'}`}>
          {node.code}
        </td>
        <td className={`${cellPadding} border-l border-slate-300`} style={{ paddingRight: depthPadding }}>
          {depth > 0 && <span className="text-slate-400 ml-0.5 text-[7px]">↳</span>}
          {isParent ? (
            <span className={`font-black ${mode === 'trial_balance' && depth === 0 ? 'text-white' : 'text-slate-950'}`}>
              {node.name}
            </span>
          ) : (
            <span className="text-slate-800">{node.name}</span>
          )}
        </td>
        {mode === 'trial_balance' && reportMode === 'movement' && (
          <>
            <td className={`${cellPadding} text-center font-mono border-l border-slate-300 bg-blue-50/30 text-blue-950 font-bold`}>
              {formatMovementAmount(node.beginDebitAgg)}
            </td>
            <td className={`${cellPadding} text-center font-mono border-l border-slate-300 bg-blue-50/30 text-blue-950 font-bold`}>
              {formatMovementAmount(node.beginCreditAgg)}
            </td>
            <td className={`${cellPadding} text-center font-mono border-l border-slate-300 bg-indigo-50/30 text-indigo-950 font-bold`}>
              {formatMovementAmount(node.moveDebitAgg)}
            </td>
            <td className={`${cellPadding} text-center font-mono border-l border-slate-300 bg-indigo-50/30 text-indigo-950 font-bold`}>
              {formatMovementAmount(node.moveCreditAgg)}
            </td>
          </>
        )}
        {mode === 'trial_balance' ? (
          <>
            <td className={`${cellPadding} text-center font-mono border-l border-slate-300 bg-emerald-50/30 text-slate-950 font-black`}>
              {formatMovementAmount(node.endDebitAgg)}
            </td>
            <td className={`${cellPadding} text-center font-mono bg-emerald-50/30 text-slate-950 font-black`}>
              {formatMovementAmount(node.endCreditAgg)}
            </td>
          </>
        ) : (
          <td className={`${cellPadding} text-left font-mono font-black ${node.type === 'asset' ? 'text-emerald-950' : 'text-indigo-950'}`}>
            {balanceAmount}
          </td>
        )}
      </tr>
    ];
    
    node.children?.forEach((child: any, childIndex: number) => {
      res.push(...renderTreeRow(child, depth + 1, childIndex, mode));
    });
    
    return res;
  };

  const trialBalanceData = useMemo(() => {
    const filteredTransactions = (transactions || []).filter(t => {
      const d = (t.date || '').split(/[\sT]/)[0];
      return d >= startDate && d <= endDate;
    });

    const balances = accounts.map(acc => {
      // 1. Opening Balance (Date < startDate)
      const openingTx = (transactions || []).filter(t => {
        const d = (t.date || '').split(/[\sT]/)[0];
        return d < startDate && (t.debitAccountId === acc.id || t.creditAccountId === acc.id);
      });
      let openDebit = 0;
      let openCredit = 0;
      openingTx.forEach(tx => {
        if (tx.debitAccountId === acc.id) openDebit += getTxAmountInGlobal(tx);
        if (tx.creditAccountId === acc.id) openCredit += getTxAmountInGlobal(tx);
      });
      const isDebitNormal = acc.type === 'asset' || acc.type === 'expense';
      const openingBalance = isDebitNormal ? (openDebit - openCredit) : (openCredit - openDebit);

      // 2. Period Movements (startDate <= Date <= endDate)
      const periodTx = filteredTransactions.filter(t => t.debitAccountId === acc.id || t.creditAccountId === acc.id);
      let movementDebit = 0;
      let movementCredit = 0;
      periodTx.forEach(tx => {
        if (tx.debitAccountId === acc.id) movementDebit += getTxAmountInGlobal(tx);
        if (tx.creditAccountId === acc.id) movementCredit += getTxAmountInGlobal(tx);
      });

      // 3. Closing Balance
      const movementNet = isDebitNormal ? (movementDebit - movementCredit) : (movementCredit - movementDebit);
      const endBalance = openingBalance + movementNet;

      const debit = isDebitNormal ? (endBalance > 0 ? endBalance : 0) : (endBalance < 0 ? Math.abs(endBalance) : 0);
      const credit = isDebitNormal ? (endBalance < 0 ? Math.abs(endBalance) : 0) : (endBalance > 0 ? endBalance : 0);

      return {
        ...acc,
        beginBalance: openingBalance,
        movementDebit,
        movementCredit,
        endBalance,
        debit,
        credit,
        hasActivity: (periodTx.length > 0 || Math.abs(openingBalance) > 0.01)
      };
    });

    // Build hierarchy
    const buildTree = (flatBalances: any[]) => {
      const map: Record<string, any> = {};
      const root: any[] = [];

      flatBalances.forEach(acc => {
        map[acc.id] = { ...acc, children: [] };
      });

      flatBalances.forEach(acc => {
        if (acc.parentId && map[acc.parentId]) {
          map[acc.parentId].children.push(map[acc.id]);
        } else {
          root.push(map[acc.id]);
        }
      });

      const computeAggregates = (node: any) => {
        const isDebitNormal = node.type === 'asset' || node.type === 'expense';

        node.beginDebitAgg = isDebitNormal ? (node.beginBalance > 0 ? node.beginBalance : 0) : (node.beginBalance < 0 ? Math.abs(node.beginBalance) : 0);
        node.beginCreditAgg = isDebitNormal ? (node.beginBalance < 0 ? Math.abs(node.beginBalance) : 0) : (node.beginBalance > 0 ? node.beginBalance : 0);
        node.moveDebitAgg = node.movementDebit;
        node.moveCreditAgg = node.movementCredit;
        node.endDebitAgg = node.debit;
        node.endCreditAgg = node.credit;

        node.children.forEach((child: any) => {
          computeAggregates(child);
          node.beginDebitAgg += child.beginDebitAgg;
          node.beginCreditAgg += child.beginCreditAgg;
          node.moveDebitAgg += child.moveDebitAgg;
          node.moveCreditAgg += child.moveCreditAgg;
          node.endDebitAgg += child.endDebitAgg;
          node.endCreditAgg += child.endCreditAgg;
        });
      };
      root.forEach(computeAggregates);

      const filterTree = (nodes: any[]): any[] => {
        return nodes.filter(node => {
          if (accountLevel === 'main' && node.parentId) return false;
          if (accountLevel === 'sub' && !node.parentId) return false;

          node.children = filterTree(node.children);

          const hasActivity = (
            Math.abs(node.moveDebitAgg) > 0.01 ||
            Math.abs(node.moveCreditAgg) > 0.01 ||
            Math.abs(node.beginDebitAgg) > 0.01 ||
            Math.abs(node.beginCreditAgg) > 0.01 ||
            Math.abs(node.endDebitAgg) > 0.01 ||
            Math.abs(node.endCreditAgg) > 0.01
          );

          return (!hideZero || hasActivity);
        });
      };

      const typeOrder: Record<string, number> = { asset: 1, liability: 2, equity: 3, revenue: 4, expense: 5 };
      const compareCodes = (a: any, b: any) => {
        const codeA = String(a.code || '').trim();
        const codeB = String(b.code || '').trim();
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      };

      const sortNodesRecursively = (nodes: any[]) => {
        nodes.sort(compareCodes);
        nodes.forEach(node => {
          if (node.children && node.children.length > 0) {
            sortNodesRecursively(node.children);
          }
        });
      };

      const filtered = filterTree(root);
      sortNodesRecursively(filtered);

      return filtered.sort((a, b) => {
        const tDiff = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        if (tDiff !== 0) return tDiff;
        return compareCodes(a, b);
      });
    };

    const hierarchicalBalances = buildTree(balances);

    let totalBeginDebit = 0;
    let totalBeginCredit = 0;
    let totalMoveDebit = 0;
    let totalMoveCredit = 0;
    let totalEndDebit = 0;
    let totalEndCredit = 0;

    hierarchicalBalances.forEach(node => {
      totalBeginDebit += node.beginDebitAgg;
      totalBeginCredit += node.beginCreditAgg;
      totalMoveDebit += node.moveDebitAgg;
      totalMoveCredit += node.moveCreditAgg;
      totalEndDebit += node.endDebitAgg;
      totalEndCredit += node.endCreditAgg;
    });

    return {
      hierarchicalBalances,
      balances,
      totalBeginDebit,
      totalBeginCredit,
      totalMoveDebit,
      totalMoveCredit,
      totalEndDebit,
      totalEndCredit
    };
  }, [accounts, transactions, currencies, globalCurrencyCode, startDate, endDate, hideZero, accountLevel]);

  const analyticalData = useMemo(() => {
    if (!expandedAccountId) return [];

    const relatedTx = (transactions || []).filter(t => {
      const d = (t.date || '').split(/[\sT]/)[0];
      return (t.debitAccountId === expandedAccountId || t.creditAccountId === expandedAccountId) &&
        d >= startDate && d <= endDate;
    });

    const groups: Record<string, { label: string, debit: number, credit: number }> = {};

    relatedTx.forEach(tx => {
      let key = 'Other';
      let label = 'غير محدد';
      const txDesc = tx.description || '';

      let booking = bookings.find(b => tx.sourceId && (tx.sourceId === b.id || tx.sourceId.startsWith(`${b.id}-`)));
      const voucher = vouchers.find(v => tx.sourceId && v.id === tx.sourceId);
      if (!booking && voucher && voucher.linkedBookingId) {
        booking = bookings.find(b => b.id === voucher.linkedBookingId);
      }

      let client = booking ? clients.find(c =>
        c.id === (booking as any).clientId ||
        c.name === booking.customerName ||
        c.phone === booking.customerPhone
      ) : null;

      if (!client) {
        const searchString = `${txDesc} ${voucher?.customerName || ''} ${voucher?.description || ''} ${booking?.customerName || ''}`.toLowerCase();
        client = clients.find(c => c.name && searchString.includes(c.name.trim().toLowerCase())) || null;
      }

      if (analyticalDimension === 'client') {
        if (client) {
          key = client.id;
          label = client.name;
        } else if (booking) {
          key = booking.customerPhone || booking.customerName || booking.id;
          label = booking.customerName || 'عميل غير محدد';
        } else if (voucher && voucher.customerName) {
          key = voucher.customerName;
          label = voucher.customerName;
        } else {
          const clientMatch = txDesc.match(/العميل:\s*([^-\n]+)/) || voucher?.description?.match(/العميل:\s*([^-\n]+)/);
          if (clientMatch && clientMatch[1]) {
            const extractedName = clientMatch[1].trim();
            key = extractedName;
            label = extractedName;
          } else {
            key = 'manual';
            label = txDesc || 'عملية يدوية';
          }
        }
      } else if (analyticalDimension === 'date') {
        const date = (booking && booking.days && booking.days[0]?.date) ? booking.days[0].date : (booking?.eventDate || tx.date);
        key = date;
        label = date;
      } else if (analyticalDimension === 'month') {
        const date = (booking && booking.days && booking.days[0]?.date) ? booking.days[0].date : (booking?.eventDate || tx.date);
        key = date.substring(0, 7);
        label = date.substring(0, 7);
      } else if (analyticalDimension === 'user') {
        key = tx.createdBy || 'system';
        label = tx.createdBy || 'النظام';
      } else if (analyticalDimension === 'service') {
        if (booking) {
          const isServices = tx.sourceId?.includes('-accrue-services') || txDesc.includes('خدمات إضافية');
          const isHallRent = tx.sourceId?.includes('-accrue-hall') || txDesc.includes('إيجار قاعة');

          if (isServices) {
            const services = booking.additionalServices || (booking as any).services || [];
            if (services.length > 0) {
              key = booking.id + '-services';
              label = services.map((s: any) => s.name).join(' + ');
            } else {
              key = booking.id + '-services';
              label = 'خدمات إضافية (غير مفصلة)';
            }
          } else if (isHallRent) {
            key = booking.id + '-hall';
            label = 'إيجار القاعة';
          } else {
            key = tx.sourceId || 'manual';
            label = txDesc || 'عملية يدوية';
          }
        } else {
          key = 'manual';
          label = txDesc || 'عملية يدوية';
        }
      } else if (analyticalDimension === 'event') {
        if (booking) {
          const date = (booking && booking.days && booking.days[0]?.date) ? booking.days[0].date : (booking?.eventDate || '');
          key = booking.id;
          const customerName = client ? client.name : (booking.customerName || 'عميل غير محدد');
          label = `فعالية: ${booking.eventType || 'حجز'} - ${customerName} - ${date}`;
        } else {
          key = 'manual';
          label = txDesc || 'عملية يدوية';
        }
      }

      if (!groups[key]) groups[key] = { label, debit: 0, credit: 0 };

      const convertedAmount = getTxAmountInGlobal(tx);
      if (tx.debitAccountId === expandedAccountId) groups[key].debit += convertedAmount;
      if (tx.creditAccountId === expandedAccountId) groups[key].credit += convertedAmount;
    });

    return Object.values(groups).sort((a, b) => b.debit + b.credit - (a.debit + a.credit));
  }, [expandedAccountId, analyticalDimension, transactions, accounts, bookings, clients, services, vouchers, startDate, endDate]);

  // Income Statement Calculation
  const incomeStatementData = useMemo(() => {
    let totalRevenue = 0;
    let totalExpense = 0;

    const revenues = trialBalanceData.balances.filter(a => a.type === 'revenue' && (Math.abs(a.movementDebit) > 0.005 || Math.abs(a.movementCredit) > 0.005));
    const expenses = trialBalanceData.balances.filter(a => a.type === 'expense' && (Math.abs(a.movementDebit) > 0.005 || Math.abs(a.movementCredit) > 0.005));

    revenues.forEach(r => totalRevenue += r.movementCredit - r.movementDebit);
    expenses.forEach(e => totalExpense += e.movementDebit - e.movementCredit);

    const netIncome = totalRevenue - totalExpense;

    return { revenues, expenses, totalRevenue, totalExpense, netIncome };
  }, [trialBalanceData]);

  // Balance Sheet Calculation
  const balanceSheetData = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    const assets = trialBalanceData.balances.filter(a => a.type === 'asset' && Math.abs(a.endBalance) > 0.005);
    const liabilities = trialBalanceData.balances.filter(a => a.type === 'liability' && Math.abs(a.endBalance) > 0.005);
    const equity = trialBalanceData.balances.filter(a => a.type === 'equity' && Math.abs(a.endBalance) > 0.005);

    assets.forEach(a => totalAssets += a.debit - a.credit);
    liabilities.forEach(l => totalLiabilities += l.credit - l.debit);
    equity.forEach(e => totalEquity += e.credit - e.debit);

    const finalEquity = totalEquity + incomeStatementData.netIncome;
    const totalLiabilitiesAndEquity = totalLiabilities + finalEquity;

    return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, finalEquity, totalLiabilitiesAndEquity };
  }, [trialBalanceData, incomeStatementData]);

  // Cash Flow Statement Calculation (Simplified Indirect Method)
  const cashFlowData = useMemo(() => {
    // Identify cash and bank accounts
    const cashBankAccounts = accounts.filter(a => a.name.includes('صندوق') || a.name.includes('بنك') || a.type === 'asset');
    const cashBankAccountIds = new Set(cashBankAccounts.map(a => a.id));

    let cashInflow = 0;
    let cashOutflow = 0;
    const breakdown: Record<string, { label: string, amount: number, type: 'in' | 'out' }> = {};

    const filteredTransactions = (transactions || []).filter(t => {
      const d = (t.date || '').split(/[\sT]/)[0];
      return d >= startDate && d <= endDate;
    });

    filteredTransactions.forEach(tx => {
      const amount = getTxAmountInGlobal(tx);
      const isDebitCash = cashBankAccountIds.has(tx.debitAccountId);
      const isCreditCash = cashBankAccountIds.has(tx.creditAccountId);

      // Skip internal transfers between cash/bank accounts for inflow/outflow totals, 
      // but they could be shown as internal transfers if desired.
      if (isDebitCash && !isCreditCash) {
        // Cash received: Cash inflow
        cashInflow += amount;
        const otherAccount = accounts.find(a => a.id === tx.creditAccountId);
        const key = otherAccount?.id || 'unknown';
        if (!breakdown[key]) breakdown[key] = { label: otherAccount?.name || 'حساب غير محدد', amount: 0, type: 'in' };
        breakdown[key].amount += amount;
      } else if (!isDebitCash && isCreditCash) {
        // Cash paid: Cash outflow
        cashOutflow += amount;
        const otherAccount = accounts.find(a => a.id === tx.debitAccountId);
        const key = otherAccount?.id || 'unknown';
        if (!breakdown[key]) breakdown[key] = { label: otherAccount?.name || 'حساب غير محدد', amount: 0, type: 'out' };
        breakdown[key].amount += amount;
      }
    });

    return {
      cashInflow,
      cashOutflow,
      netCashFlow: cashInflow - cashOutflow,
      breakdown: Object.values(breakdown).sort((a, b) => b.amount - a.amount)
    };
  }, [transactions, accounts, startDate, endDate, globalCurrencyCode, currencies]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Automatically suggest landscape for movement-based trial balance
  useEffect(() => {
    if (activeTab === 'trial_balance' && reportMode === 'movement') {
      setPrintOrientation('landscape');
    } else {
      setPrintOrientation('portrait');
    }
  }, [activeTab, reportMode]);

  // Handle Printing Official Report
  const handlePrintOfficialReport = () => {
    document.body.classList.add('print-only-financial-report');
    const portal = document.getElementById('financial-reports-print-portal');
    if (portal) portal.classList.add('is-printing');
    
    const cleanup = () => {
      document.body.classList.remove('print-only-financial-report');
      if (portal) portal.classList.remove('is-printing');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 2500);
    }, 150);
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('printable-financial-report');
    if (!el) return;
    try {
      setIsDownloadingPdf(true);
      toast.info('جاري تجهيز وتحميل ملف الـ PDF عالي الدقة...');
      
      const isLandscape = printOrientation === 'landscape';

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // 1. Sanitize any style tags that contain oklch to prevent html2canvas parsing errors
          clonedDoc.querySelectorAll('style').forEach(s => {
            if (s.textContent && s.textContent.includes('oklch')) {
              s.textContent = s.textContent.replace(/oklch\([^)]+\)/g, '#334155');
            }
          });
          // 2. Ensure target element background & text colors are explicit hex
          const target = clonedDoc.getElementById('printable-financial-report');
          if (target) {
            target.style.backgroundColor = '#ffffff';
            target.style.color = '#0f172a';
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const margin = 8;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      
      let heightLeft = contentHeight;
      let position = margin;
      
      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight);
      heightLeft -= (pageHeight - margin * 2);
      
      while (heightLeft > 0) {
        position = heightLeft - contentHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight);
        heightLeft -= (pageHeight - margin * 2);
      }
      
      const fileName = `${getActiveReportTitle()}_${startDate}_${endDate}.pdf`;
      pdf.save(fileName);
      toast.success('تم تحميل التقرير بصيغة PDF بنجاح!');
    } catch (e: any) {
      console.error('PDF generation error:', e);
      toast.error('حدث خطأ أثناء إعداد PDF، يرجى المحاولة أو استخدام خيار الطباعة المباشرة');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getActiveReportTitle = () => {
    switch (activeTab) {
      case 'trial_balance':
        return 'ميزان المراجعة بالأرصدة والحركة';
      case 'income_statement':
        return 'قائمة الدخل (حساب الأرباح والخسائر)';
      case 'balance_sheet':
        return 'الميزانية العمومية (قائمة المركز المالي)';
      case 'cash_flow':
        return 'قائمة التدفقات النقدية';
      case 'journal_entries':
        return 'دفتر قيود اليومية المحاسبية';
      default:
        return 'التقرير المالي الرسمي';
    }
  };

  return (
    <div className="space-y-6 text-right animate-fade-in relative pb-10">
      {/* Account Statement Modal */}
      {selectedAccountForStatement && (
        <AccountStatementModal
          accounts={accounts}
          transactions={transactions}
          currencies={currencies}
          vouchers={vouchers}
          globalCurrencyCode={globalCurrencyCode}
          companySettings={companySettings || null}
          setPrintData={setPrintData || (() => {})}
          clients={clients}
          bookings={bookings}
          initialAccountId={selectedAccountForStatement.id}
          fromDate={startDate}
          toDate={endDate}
          onClose={() => setSelectedAccountForStatement(null)}
        />
      )}

      {/* Official Print Preview Modal - Rendered via Portal directly to body */}
      {showPrintPreviewModal && createPortal(
        <div id="financial-reports-print-portal" className="fixed inset-0 z-[500] bg-slate-900/70 backdrop-blur-md flex justify-center items-start overflow-y-auto p-2 sm:p-6 print:p-0 print:bg-white print:static print:overflow-visible print:inset-auto" dir="rtl">
          <div id="financial-reports-print-card" className="bg-white text-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 my-2 sm:my-4 flex flex-col print:border-none print:shadow-none print:my-0 print:rounded-none">
            {/* Modal Header Controls */}
            <div className="p-3 sm:p-4 bg-slate-900 text-white flex flex-wrap gap-2.5 justify-between items-center print:hidden border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
                    <span>معاينة وطباعة التقرير المالي</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      {printDensity === 'ultra' ? '⚡️ مضغوط لورقة واحدة' : printDensity === 'compact' ? 'متوازن' : 'عادي'}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">تحكم كامل بحجم الخطوط وكثافة الصفوف لتناسب صفحة واحدة A4</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Balance Sheet Layout Switcher (when activeTab === 'balance_sheet') */}
                {activeTab === 'balance_sheet' && (
                  <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700 text-xs shadow-inner">
                    <button
                      type="button"
                      onClick={() => setBalanceSheetView('side_by_side')}
                      className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${balanceSheetView === 'side_by_side' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                      title="عرض الأصول والخصوم جنباً إلى جنب في عمودين متقابلين لتوفير نصف ارتفاع الصفحة وضمان ورقة واحدة"
                    >
                      <span>⚖️ متقابلين (ورقة واحدة)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBalanceSheetView('stacked')}
                      className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${balanceSheetView === 'stacked' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                      title="عرض الأصول أولاً ثم الخصوم تحتها"
                    >
                      <span>📑 عمودي</span>
                    </button>
                  </div>
                )}

                {/* Density / Page Fit Selector */}
                <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700 text-xs shadow-inner">
                  <span className="text-[10px] text-slate-400 ml-1.5 font-bold hidden md:inline">ضغط الصفحة:</span>
                  <button
                    type="button"
                    onClick={() => setPrintDensity('ultra')}
                    className={`px-2 py-1 rounded-lg font-black transition flex items-center gap-1 cursor-pointer ${printDensity === 'ultra' ? 'bg-emerald-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                    title="ضغط المسافات والخطوط والصفوف لأقصى درجة ليناسب ورقة واحدة"
                  >
                    <span>📄 ورقة واحدة (مضغوط)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintDensity('compact')}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${printDensity === 'compact' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                  >
                    <span>متوازن</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintDensity('normal')}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${printDensity === 'normal' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                  >
                    <span>عادي</span>
                  </button>
                </div>

                {/* Scale Selector */}
                <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700 text-xs">
                  <span className="text-[10px] text-slate-400 ml-1 font-bold hidden sm:inline">الحجم:</span>
                  {[100, 92, 85].map(scale => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setPrintScale(scale)}
                      className={`px-1.5 py-0.5 rounded font-mono font-bold transition cursor-pointer ${printScale === scale ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      title={`مقياس الطباعة ${scale}%`}
                    >
                      {scale}%
                    </button>
                  ))}
                </div>

                {/* Orientation Selector */}
                <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('portrait')}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${printOrientation === 'portrait' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    عمودي
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('landscape')}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${printOrientation === 'landscape' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    أفقي
                  </button>
                </div>

                {/* Signatures Toggle */}
                <button
                  type="button"
                  onClick={() => setIncludeSignatures(!includeSignatures)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${includeSignatures ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-amber-950/40 border-amber-800 text-amber-300'}`}
                  title="إخفاء خانات التوقيع يتيح مساحة أكبر للصفوف في صفحة واحدة"
                >
                  <span>{includeSignatures ? '✍️ التواقيع: ظاهرة' : '✍️ التواقيع: مخفية'}</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                  title="تحميل التقرير كملف PDF عالي الدقة"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>PDF مباشر</span>
                </button>

                <button
                  onClick={handlePrintOfficialReport}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/30"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الآن</span>
                </button>

                <button
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                  title="إغلاق المعاينة"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile Print Guidance Alert */}
            <div className="p-2 bg-amber-500/10 border-b border-amber-500/20 px-4 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2 print:hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm">📱 تنبيه للجوال:</span>
                <span>لتظهر الألوان والخلفيات بدقة، فعّل خيار <strong>(طباعة الرسومات الخلفية / Background Graphics)</strong> من خيارات الطباعة بالمتصفح.</span>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'balance_sheet' && (
                  <span className="font-bold text-[10px] bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                    نمط الميزانية: {balanceSheetView === 'side_by_side' ? '⚖️ جانبين متقابلين (ورقة واحدة)' : 'عمودي متتالي'}
                  </span>
                )}
                <span className="font-mono text-[10px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                  وضع الضغط: {printDensity === 'ultra' ? 'ورقة واحدة A4' : printDensity === 'compact' ? 'متوازن' : 'عادي'} ({printScale}%)
                </span>
              </div>
            </div>

            {/* Printable Document Body */}
            <div
              className={`p-2.5 sm:p-5 ${printDensity === 'ultra' ? 'space-y-1.5 print:space-y-0.5' : 'space-y-2.5 print:space-y-1'} bg-white text-slate-950 print-area print-area-wrapper`}
              id="printable-financial-report"
              style={{
                transform: printScale !== 100 ? `scale(${printScale / 100})` : undefined,
                transformOrigin: 'top center'
              }}
            >
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  @page {
                    size: A4 ${printOrientation};
                    margin: ${printDensity === 'ultra' ? '2.5mm 3.5mm' : printDensity === 'compact' ? '4mm 5mm' : '6mm 8mm'};
                  }
                  *, *:before, *:after {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                  }
                  html, body {
                    background: #ffffff !important;
                    color: #0f172a !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    height: auto !important;
                    overflow: visible !important;
                    font-size: ${printDensity === 'ultra' ? '7.5px' : printDensity === 'compact' ? '8.5px' : '9.5px'} !important;
                    line-height: ${printDensity === 'ultra' ? '1.05' : '1.15'} !important;
                  }
                  body > *:not(#financial-reports-print-portal) {
                    display: none !important;
                  }
                  #financial-reports-print-portal {
                    display: block !important;
                    position: static !important;
                    width: 100% !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    overflow: visible !important;
                  }
                  #financial-reports-print-card {
                    display: block !important;
                    position: static !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                    border-radius: 0 !important;
                    background: #ffffff !important;
                  }
                  #printable-financial-report {
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                  }
                  #printable-financial-report * {
                    visibility: visible !important;
                  }
                  table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    font-size: ${printDensity === 'ultra' ? '7.2px' : printDensity === 'compact' ? '8.2px' : '9px'} !important;
                  }
                  th, td {
                    padding: ${printDensity === 'ultra' ? '1px 2px' : printDensity === 'compact' ? '1.5px 3px' : '2.5px 4.5px'} !important;
                    line-height: ${printDensity === 'ultra' ? '1.05' : '1.15'} !important;
                    height: auto !important;
                  }
                  tr {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                  }
                  thead {
                    display: table-header-group !important;
                  }
                  tfoot {
                    display: table-footer-group !important;
                  }
                  .print-signatures-block {
                    page-break-before: avoid !important;
                    break-before: avoid !important;
                    break-inside: avoid !important;
                  }
                }
              ` }} />

              {/* Official Cliché / Header */}
              <div className={`border-b-2 border-indigo-950 ${printDensity === 'ultra' ? 'pb-1 print:pb-0.5' : 'pb-2.5 print:pb-1'} flex justify-between items-center gap-2`}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h1 className={`${printDensity === 'ultra' ? 'text-sm sm:text-base print:text-[11px]' : 'text-base sm:text-lg print:text-sm'} font-black text-slate-900 leading-tight`}>
                      {companySettings?.name || "شركة المحاسب بلس لتنظيم الفعاليات والقاعات"}
                    </h1>
                    <span className="text-[9px] print:text-[7px] font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                      {(companySettings as any)?.subtitle || "النظام المحاسبي والمالي الموحد"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[9px] print:text-[7.5px] font-bold text-slate-600 leading-tight">
                    {companySettings?.taxNumber && (
                      <span className="font-mono">الرقم الضريبي: {companySettings.taxNumber}</span>
                    )}
                    {companySettings?.taxNumber && companySettings?.phone && <span>•</span>}
                    {companySettings?.phone && (
                      <span className="font-mono">هاتف: {companySettings.phone}</span>
                    )}
                    {companySettings?.address && <span>• {companySettings.address}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-left text-[9px] print:text-[7px] font-bold text-slate-500 hidden sm:block">
                    <span>تاريخ الطباعة:</span><br/>
                    <span className="font-mono font-black text-slate-800">{new Date().toLocaleDateString('ar-SA')}</span>
                  </div>
                  {companySettings?.logo ? (
                    <img
                      src={companySettings.logo}
                      alt="Logo"
                      className={`${printDensity === 'ultra' ? 'h-7 print:h-6' : 'h-10 print:h-8'} object-contain rounded border border-slate-200 p-0.5`}
                    />
                  ) : (
                    <div className={`${printDensity === 'ultra' ? 'w-8 h-8 print:w-6 print:h-6 text-[8px]' : 'w-10 h-10 print:w-8 print:h-8 text-[9px]'} bg-slate-100 rounded flex items-center justify-center font-black text-slate-500 border border-slate-300`}>
                      شعار
                    </div>
                  )}
                </div>
              </div>

              {/* Report Sub-Header Title & Period Info */}
              <div className={`bg-gradient-to-r from-slate-50 via-indigo-50/50 to-slate-50 ${printDensity === 'ultra' ? 'py-0.5 px-2 print:py-0.5' : 'p-1.5 print:p-1'} rounded border border-indigo-200 flex flex-wrap justify-between items-center gap-1`}>
                <h2 className={`${printDensity === 'ultra' ? 'text-xs print:text-[9.5px]' : 'text-sm print:text-xs'} font-black text-slate-900 tracking-wide uppercase`}>
                  {getActiveReportTitle()}
                </h2>
                <div className="flex items-center gap-2 text-[9px] print:text-[7.5px] font-bold text-slate-700">
                  <span>الفترة: من <strong className="font-mono text-indigo-950 font-black">{startDate}</strong> إلى <strong className="font-mono text-indigo-950 font-black">{endDate}</strong></span>
                  <span>•</span>
                  <span>العملة: <strong className="font-mono text-indigo-950 font-black">{globalCurrencyCode}</strong></span>
                  <span className="sm:hidden">• {new Date().toLocaleDateString('ar-SA')}</span>
                </div>
              </div>

              {/* Printable Table Content according to active tab */}
              {activeTab === 'trial_balance' && (
                <div className="overflow-x-auto border-2 border-slate-900 rounded-sm">
                  <table className="w-full text-right border-collapse">
                    <thead className="text-slate-950 font-black">
                      {reportMode === 'movement' ? (
                        <>
                          <tr className="border-b border-slate-400">
                            <th colSpan={3} className="py-0.5 px-1 bg-slate-900 text-white text-center font-black border-l border-slate-800 text-[8.5px] print:text-[7.5px]">
                              بيانات وتصنيف الحساب
                            </th>
                            <th colSpan={2} className="py-0.5 px-1 bg-blue-900 text-blue-50 text-center font-black border-l border-blue-950 text-[8.5px] print:text-[7.5px]">
                              الأرصدة الافتتاحية
                            </th>
                            <th colSpan={2} className="py-0.5 px-1 bg-indigo-900 text-indigo-50 text-center font-black border-l border-indigo-950 text-[8.5px] print:text-[7.5px]">
                              حركات الفترة المالية
                            </th>
                            <th colSpan={2} className="py-0.5 px-1 bg-teal-900 text-teal-50 text-center font-black text-[8.5px] print:text-[7.5px]">
                              الأرصدة الختامية
                            </th>
                          </tr>
                          <tr className="border-b-2 border-slate-900 text-[8px] print:text-[7px]">
                            <th className="py-0.5 px-1 bg-slate-800 text-white text-center border-l border-slate-700 w-7">#</th>
                            <th className="py-0.5 px-1 bg-slate-800 text-white text-center border-l border-slate-700 w-16">رقم الحساب</th>
                            <th className="py-0.5 px-1.5 bg-slate-800 text-white text-right border-l border-slate-700">اسم بند الحساب</th>
                            
                            <th className="py-0.5 px-1 bg-blue-100 text-blue-950 text-center border-l border-blue-200">مدين (+)</th>
                            <th className="py-0.5 px-1 bg-blue-100 text-blue-950 text-center border-l border-blue-200">دائن (-)</th>
                            
                            <th className="py-0.5 px-1 bg-indigo-100 text-indigo-950 text-center border-l border-indigo-200">مدين (+)</th>
                            <th className="py-0.5 px-1 bg-indigo-100 text-indigo-950 text-center border-l border-indigo-200">دائن (-)</th>
                            
                            <th className="py-0.5 px-1 bg-teal-100 text-teal-950 text-center border-l border-teal-200">مدين (+)</th>
                            <th className="py-0.5 px-1 bg-teal-100 text-teal-950 text-center">دائن (-)</th>
                          </tr>
                        </>
                      ) : (
                        <tr className="border-b-2 border-slate-900 text-[8px] print:text-[7.5px]">
                          <th className="py-1 px-1 bg-slate-900 text-white text-center border-l border-slate-800 w-8">#</th>
                          <th className="py-1 px-1 bg-slate-900 text-white text-center border-l border-slate-800 w-20">رقم الحساب</th>
                          <th className="py-1 px-1.5 bg-slate-900 text-white text-right border-l border-slate-800">اسم بند الحساب</th>
                          <th className="py-1 px-1 bg-emerald-900 text-white text-center border-l border-emerald-950 w-28">الرصيد النهائي (مدين)</th>
                          <th className="py-1 px-1 bg-rose-900 text-white text-center w-28">الرصيد النهائي (دائن)</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {trialBalanceData?.hierarchicalBalances?.map((node, index) => renderTreeRow(node, 0, index))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-900 font-black">
                      <tr className="bg-slate-900 text-white text-[8px] print:text-[7.5px]">
                        <td colSpan={3} className="py-0.5 px-1.5 border-l border-slate-800 text-right font-black">
                          الإجمالي الكلي العام:
                        </td>
                        {reportMode === 'movement' && (
                          <>
                            <td className="py-0.5 px-1 border-l border-slate-800 font-mono text-center text-blue-200">
                              {trialBalanceData?.totalBeginDebit > 0 ? trialBalanceData.totalBeginDebit.toLocaleString() : '-'}
                            </td>
                            <td className="py-0.5 px-1 border-l border-slate-800 font-mono text-center text-blue-200">
                              {trialBalanceData?.totalBeginCredit > 0 ? trialBalanceData.totalBeginCredit.toLocaleString() : '-'}
                            </td>
                            <td className="py-0.5 px-1 border-l border-slate-800 font-mono text-center text-indigo-200">
                              {trialBalanceData?.totalMoveDebit > 0 ? trialBalanceData.totalMoveDebit.toLocaleString() : '-'}
                            </td>
                            <td className="py-0.5 px-1 border-l border-slate-800 font-mono text-center text-indigo-200">
                              {trialBalanceData?.totalMoveCredit > 0 ? trialBalanceData.totalMoveCredit.toLocaleString() : '-'}
                            </td>
                          </>
                        )}
                        <td className="py-0.5 px-1 border-l border-slate-800 font-mono text-center text-emerald-300">
                          {trialBalanceData?.totalEndDebit > 0 ? trialBalanceData.totalEndDebit.toLocaleString() : '-'}
                        </td>
                        <td className="py-0.5 px-1 font-mono text-center text-emerald-300">
                          {trialBalanceData?.totalEndCredit > 0 ? trialBalanceData.totalEndCredit.toLocaleString() : '-'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {activeTab === 'income_statement' && (
                <div className={`${printDensity === 'ultra' ? 'space-y-1.5 print:space-y-0.5' : 'space-y-2.5 print:space-y-1'}`}>
                  {/* Revenues Table */}
                  <div className="border-2 border-emerald-900 rounded-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white py-0.5 px-2 font-black text-[9px] print:text-[8px] flex justify-between items-center">
                      <span>أولاً: الإيرادات (Revenues)</span>
                      <span className="text-[7.5px] text-emerald-200 font-mono">العملة: {globalCurrencyCode}</span>
                    </div>
                    <table className="w-full text-right border-collapse">
                      <thead className="bg-emerald-100 text-emerald-950 font-black border-b border-emerald-300">
                        <tr className={printDensity === 'ultra' ? 'text-[8px] print:text-[7.5px]' : 'text-[9px] print:text-[8.5px]'}>
                          <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1 print:py-[1px] print:px-[1.5px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-emerald-300 text-center w-16`}>رقم الحساب</th>
                          <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-emerald-300 text-right`}>اسم بند الإيراد</th>
                          <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} text-left w-28`}>المبلغ ({globalCurrencyCode})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalanceData.hierarchicalBalances
                          .filter(acc => acc.type === 'revenue')
                          .flatMap((node) => {
                            const renderRevenueRow = (node: any, depth: number = 0): any[] => {
                              const amount = (node.endCreditAgg || 0) - (node.endDebitAgg || 0);
                              const hasChildrenWithAmount = node.children && node.children.some((c: any) => Math.abs((c.endCreditAgg || 0) - (c.endDebitAgg || 0)) > 0.005);
                              const isParent = node.children && node.children.length > 0;
                              
                              if (Math.abs(amount) <= 0.005 && !hasChildrenWithAmount) return [];

                              const rowClass = isParent 
                                ? 'bg-emerald-50/70 font-black text-emerald-950 border-r-4 border-r-emerald-600 border-t border-emerald-200' 
                                : 'border-b border-slate-100 hover:bg-slate-50';

                              const cellPad = printDensity === 'ultra'
                                ? 'py-[1px] px-1 print:py-[0.5px] print:px-[1px] leading-tight'
                                : printDensity === 'compact'
                                ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px] leading-tight'
                                : 'py-1.5 px-2 print:py-1 print:px-1.5';

                              const cellFnt = printDensity === 'ultra'
                                ? 'text-[8px] print:text-[7px]'
                                : printDensity === 'compact'
                                ? 'text-[9px] print:text-[8px]'
                                : 'text-xs print:text-[9.5px]';

                              const depthPad = printDensity === 'ultra' ? depth * 6 + 3 : depth * 10 + 5;

                              const rows = [
                                <tr key={node.id} className={`${rowClass} ${cellFnt}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                  <td className={`${cellPad} text-center font-mono border-l border-slate-200 font-bold w-16`}>{node.code}</td>
                                  <td className={`${cellPad} text-right border-l border-slate-200`} style={{ paddingRight: `${depthPad}px` }}>
                                    {depth > 0 && <span className="text-slate-400 ml-0.5 text-[7px]">↳</span>}
                                    {isParent ? <span className="font-black text-emerald-950">{node.name}</span> : node.name}
                                  </td>
                                  <td className={`${cellPad} font-mono text-left font-bold w-28 text-emerald-900`}>{formatReportAmount(amount)}</td>
                                </tr>
                              ];
                              if (node.children) {
                                node.children.forEach((child: any) => {
                                  rows.push(...renderRevenueRow(child, depth + 1));
                                });
                              }
                              return rows;
                            };
                            return renderRevenueRow(node, 0);
                          })}
                        {incomeStatementData.totalRevenue === 0 && (
                          <tr>
                            <td colSpan={3} className="p-1.5 text-center text-slate-400 font-bold text-[8px]">لا توجد حركات إيرادات مسجلة خلال الفترة</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-emerald-100 font-black border-t-2 border-emerald-700 text-emerald-950">
                        <tr className={printDensity === 'ultra' ? 'text-[8px] print:text-[7.5px]' : 'text-[9px] print:text-[8.5px]'}>
                          <td colSpan={2} className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px]' : 'py-1 px-1.5'} border-l border-emerald-300 text-right`}>إجمالي الإيرادات للفترة:</td>
                          <td className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px]' : 'py-1 px-1.5'} font-mono text-left text-emerald-950`}>{formatReportAmount(incomeStatementData.totalRevenue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Expenses Table */}
                  <div className="border-2 border-rose-900 rounded-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-rose-900 to-slate-900 text-white py-0.5 px-2 font-black text-[9px] print:text-[8px] flex justify-between items-center">
                      <span>ثانياً: المصروفات (Expenses)</span>
                      <span className="text-[7.5px] text-rose-200 font-mono">العملة: {globalCurrencyCode}</span>
                    </div>
                    <table className="w-full text-right border-collapse">
                      <thead className="bg-rose-100 text-rose-950 font-black border-b border-rose-300">
                        <tr className={printDensity === 'ultra' ? 'text-[8px] print:text-[7.5px]' : 'text-[9px] print:text-[8.5px]'}>
                          <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1 print:py-[1px] print:px-[1.5px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-rose-300 text-center w-16`}>رقم الحساب</th>
                          <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-rose-300 text-right`}>اسم بند المصروف</th>
                          <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} text-left w-28`}>المبلغ ({globalCurrencyCode})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalanceData.hierarchicalBalances
                          .filter(acc => acc.type === 'expense')
                          .flatMap((node) => {
                            const renderExpenseRow = (node: any, depth: number = 0): any[] => {
                              const amount = (node.endDebitAgg || 0) - (node.endCreditAgg || 0);
                              const hasChildrenWithAmount = node.children && node.children.some((c: any) => Math.abs((c.endDebitAgg || 0) - (c.endCreditAgg || 0)) > 0.005);
                              const isParent = node.children && node.children.length > 0;
                              
                              if (Math.abs(amount) <= 0.005 && !hasChildrenWithAmount) return [];

                              const rowClass = isParent 
                                ? 'bg-rose-50/70 font-black text-rose-950 border-r-4 border-r-rose-600 border-t border-rose-200' 
                                : 'border-b border-slate-100 hover:bg-slate-50';

                              const cellPad = printDensity === 'ultra'
                                ? 'py-[1px] px-1 print:py-[0.5px] print:px-[1px] leading-tight'
                                : printDensity === 'compact'
                                ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px] leading-tight'
                                : 'py-1.5 px-2 print:py-1 print:px-1.5';

                              const cellFnt = printDensity === 'ultra'
                                ? 'text-[8px] print:text-[7px]'
                                : printDensity === 'compact'
                                ? 'text-[9px] print:text-[8px]'
                                : 'text-xs print:text-[9.5px]';

                              const depthPad = printDensity === 'ultra' ? depth * 6 + 3 : depth * 10 + 5;

                              const rows = [
                                <tr key={node.id} className={`${rowClass} ${cellFnt}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                  <td className={`${cellPad} text-center font-mono border-l border-slate-200 font-bold w-16`}>{node.code}</td>
                                  <td className={`${cellPad} text-right border-l border-slate-200`} style={{ paddingRight: `${depthPad}px` }}>
                                    {depth > 0 && <span className="text-slate-400 ml-0.5 text-[7px]">↳</span>}
                                    {isParent ? <span className="font-black text-rose-950">{node.name}</span> : node.name}
                                  </td>
                                  <td className={`${cellPad} font-mono text-left font-bold w-28 text-rose-900`}>{formatReportAmount(amount)}</td>
                                </tr>
                              ];
                              if (node.children) {
                                node.children.forEach((child: any) => {
                                  rows.push(...renderExpenseRow(child, depth + 1));
                                });
                              }
                              return rows;
                            };
                            return renderExpenseRow(node, 0);
                          })}
                        {incomeStatementData.totalExpense === 0 && (
                          <tr>
                            <td colSpan={3} className="p-1.5 text-center text-slate-400 font-bold text-[8px]">لا توجد حركات مصروفات مسجلة خلال الفترة</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-rose-100 font-black border-t-2 border-rose-700 text-rose-950">
                        <tr className={printDensity === 'ultra' ? 'text-[8px] print:text-[7.5px]' : 'text-[9px] print:text-[8.5px]'}>
                          <td colSpan={2} className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px]' : 'py-1 px-1.5'} border-l border-rose-300 text-right`}>إجمالي المصروفات للفترة:</td>
                          <td className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px]' : 'py-1 px-1.5'} font-mono text-left text-rose-950`}>({formatReportAmount(incomeStatementData.totalExpense)})</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Net Profit / Loss Banner */}
                  <div className={`${printDensity === 'ultra' ? 'py-0.5 px-2 print:py-0.5' : 'p-1.5 print:py-1'} border-2 rounded ${printDensity === 'ultra' ? 'text-[8.5px] print:text-[7.5px]' : 'text-xs print:text-[9.5px]'} flex justify-between items-center font-black ${incomeStatementData.netIncome >= 0 ? 'bg-emerald-50 border-emerald-600 text-emerald-950' : 'bg-rose-50 border-rose-600 text-rose-950'}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <div className="flex items-center gap-1">
                      <span>{incomeStatementData.netIncome >= 0 ? '✅' : '⚠️'}</span>
                      <span>{incomeStatementData.netIncome >= 0 ? 'صافي أرباح الفترة (Net Profit):' : 'صافي خسائر الفترة (Net Loss):'}</span>
                    </div>
                    <span className="font-mono font-black dir-ltr">
                      {formatReportAmount(incomeStatementData.netIncome)} {selectedGlobalCurrencyObj.symbol}
                    </span>
                  </div>
                </div>
              )}

              {/* Balance Sheet (قائمة المركز المالي) with Side-by-Side or Stacked layout */}
              {activeTab === 'balance_sheet' && (
                <div className={`${balanceSheetView === 'side_by_side' ? 'grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-2 space-y-0' : 'space-y-1.5'}`}>
                  {/* Assets Table (الجانب الأيمن) */}
                  <div className="border-2 border-emerald-900 rounded-sm overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white py-0.5 px-2 font-black text-[9px] print:text-[8px] flex justify-between items-center">
                        <span>الجانب الأيمن: الأصول (Assets)</span>
                        <span className="text-[7.5px] text-emerald-200 font-mono">العملة: {globalCurrencyCode}</span>
                      </div>
                      <table className="w-full text-right border-collapse">
                        <thead className="bg-emerald-100 text-emerald-950 font-black border-b border-emerald-300">
                          <tr className={printDensity === 'ultra' ? 'text-[8px] print:text-[7.5px]' : 'text-[9px] print:text-[8.5px]'}>
                            <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1 print:py-[1px] print:px-[1.5px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-emerald-300 text-center w-7`}>#</th>
                            <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1 print:py-[1px] print:px-[1.5px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-emerald-300 text-center w-16`}>رقم الحساب</th>
                            <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-emerald-300 text-right`}>بيان الأصول</th>
                            <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} text-left w-24`}>الرصيد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trialBalanceData.hierarchicalBalances
                            .filter(acc => acc.type === 'asset')
                            .map((node, index) => renderTreeRow(node, 0, index, 'balance_sheet'))}
                        </tbody>
                      </table>
                    </div>
                    <table className="w-full text-right border-collapse">
                      <tfoot className="bg-emerald-100 font-black border-t-2 border-emerald-700 text-emerald-950">
                        <tr className={printDensity === 'ultra' ? 'text-[8px] print:text-[7.5px]' : 'text-[9px] print:text-[8.5px]'}>
                          <td colSpan={3} className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px]' : 'py-1 px-1.5'} border-l border-emerald-300 text-right font-black`}>إجمالي الأصول (Total Assets):</td>
                          <td className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px]' : 'py-1 px-1.5'} font-mono text-left font-black w-24 text-emerald-950`}>{formatReportAmount(balanceSheetData.totalAssets)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Liabilities & Equity Table (الجانب الأيسر) */}
                  <div className="border-2 border-indigo-900 rounded-sm overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white py-0.5 px-2 font-black text-[9px] print:text-[8px] flex justify-between items-center">
                        <span>الجانب الأيسر: الخصوم وحقوق الملكية (Liabilities & Equity)</span>
                        <span className="text-[7.5px] text-indigo-200 font-mono">العملة: {globalCurrencyCode}</span>
                      </div>
                      <table className="w-full text-right border-collapse">
                        <thead className="bg-indigo-100 text-indigo-950 font-black border-b border-indigo-300">
                          <tr className={printDensity === 'ultra' ? 'text-[8px] print:text-[7.5px]' : 'text-[9px] print:text-[8.5px]'}>
                            <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1 print:py-[1px] print:px-[1.5px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-indigo-300 text-center w-7`}>#</th>
                            <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1 print:py-[1px] print:px-[1.5px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-indigo-300 text-center w-16`}>رقم الحساب</th>
                            <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} border-l border-indigo-300 text-right`}>بيان الخصوم وحقوق الملكية</th>
                            <th className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px] print:px-[2px]' : 'py-1 px-1.5 print:py-0.5 print:px-1'} text-left w-24`}>الرصيد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trialBalanceData.hierarchicalBalances
                            .filter(acc => acc.type === 'liability' || acc.type === 'equity')
                            .map((node, index) => renderTreeRow(node, 0, index, 'balance_sheet'))}
                          <tr className={`border-t border-b border-amber-300 font-black bg-amber-50/80 ${printDensity === 'ultra' ? 'text-[8px] print:text-[7px]' : 'text-[9px] print:text-[8px]'}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                            <td className={`${printDensity === 'ultra' ? 'py-[1px] px-1 print:py-[0.5px] print:px-[1px]' : 'py-1 px-1.5'} text-center border-l border-amber-200 font-mono text-[7px]`}>★</td>
                            <td className={`${printDensity === 'ultra' ? 'py-[1px] px-1 print:py-[0.5px] print:px-[1px]' : 'py-1 px-1.5'} font-mono text-center border-l border-amber-200`}>-</td>
                            <td className={`${printDensity === 'ultra' ? 'py-[1px] px-1.5 print:py-[0.5px] print:px-[1px]' : 'py-1 px-1.5'} border-l border-amber-200 font-black text-amber-950`}>
                              صافي أرباح / خسائر الفترة (قائمة الدخل)
                            </td>
                            <td className={`${printDensity === 'ultra' ? 'py-[1px] px-1.5 print:py-[0.5px] print:px-[1px]' : 'py-1 px-1.5'} font-mono text-left font-black text-amber-950`}>
                              {formatReportAmount(incomeStatementData.netIncome)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <table className="w-full text-right border-collapse">
                      <tfoot className="bg-indigo-100 font-black border-t-2 border-indigo-700 text-indigo-950">
                        <tr className={printDensity === 'ultra' ? 'text-[8px] print:text-[7.5px]' : 'text-[9px] print:text-[8.5px]'}>
                          <td colSpan={3} className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px]' : 'py-1 px-1.5'} border-l border-indigo-300 text-right font-black`}>إجمالي الخصوم وحقوق الملكية:</td>
                          <td className={`${printDensity === 'ultra' ? 'py-0.5 px-1.5 print:py-[1px]' : 'py-1 px-1.5'} font-mono text-left font-black w-24 text-indigo-950`}>{formatReportAmount(balanceSheetData.totalLiabilitiesAndEquity)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Balance Check Banner (Spans 2 cols if side-by-side) */}
                  <div className={`${balanceSheetView === 'side_by_side' ? 'col-span-1 md:col-span-2 print:col-span-2 mt-1' : ''} ${printDensity === 'ultra' ? 'py-0.5 px-2 print:py-0.5' : 'p-1.5 print:py-1'} border-2 rounded flex justify-between items-center font-bold ${printDensity === 'ultra' ? 'text-[8px] print:text-[7px]' : 'text-[10px] print:text-[9px]'} ${Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity) < 1 ? 'bg-emerald-50 border-emerald-400 text-emerald-950' : 'bg-amber-50 border-amber-400 text-amber-950'}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity) < 1 ? '⚖️' : '⚠️'}</span>
                      <span>
                        {Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity) < 1
                          ? 'الميزانية متزنة تماماً: إجمالي الأصول مطابق لإجمالي الخصوم وحقوق الملكية'
                          : 'تنبيه تدقيق: يوجد فارق محاسبي بين الأصول والخصوم'}
                      </span>
                    </div>
                    <span className="font-mono font-black">
                      الفارق: {formatReportAmount(Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity))} {selectedGlobalCurrencyObj.symbol}
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'cash_flow' && (
                <div className={`p-2 bg-white border-2 border-slate-900 rounded text-right ${printDensity === 'ultra' ? 'space-y-1 print:space-y-0.5 text-[8px] print:text-[7.5px]' : 'space-y-2 print:space-y-1 text-xs print:text-[9px]'}`}>
                  <h3 className="font-black text-slate-950 border-b border-slate-900 pb-0.5">قائمة التدفقات النقدية (تحليل الحركة)</h3>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between py-0.5 px-1.5 border-b border-slate-900 bg-slate-100 font-bold">
                      <span className="font-black text-slate-800">إجمالي النقد الداخل</span>
                      <span className="font-mono font-black text-emerald-700">{formatReportAmount(cashFlowData.cashInflow)}</span>
                    </div>
                    
                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500 font-bold">
                          <tr>
                            <th className="py-0.5 px-1 border-l border-slate-200 text-right">الحساب المقابل</th>
                            <th className="py-0.5 px-1 text-left">التأثير على النقد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cashFlowData.breakdown.filter(b => b.type === 'in').map((b, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="py-0.5 px-1 border-l border-slate-200">{b.label}</td>
                              <td className="py-0.5 px-1 font-mono text-emerald-600 text-left">+{formatReportAmount(b.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between py-0.5 px-1.5 border-b border-slate-900 bg-slate-100 font-bold">
                      <span className="font-black text-slate-800">إجمالي النقد الخارج</span>
                      <span className="font-mono font-black text-rose-700">({formatReportAmount(cashFlowData.cashOutflow)})</span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500 font-bold">
                          <tr>
                            <th className="py-0.5 px-1 border-l border-slate-200 text-right">الحساب المقابل</th>
                            <th className="py-0.5 px-1 text-left">التأثير على النقد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cashFlowData.breakdown.filter(b => b.type === 'out').map((b, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="py-0.5 px-1 border-l border-slate-200">{b.label}</td>
                              <td className="py-0.5 px-1 font-mono text-rose-600 text-left">-{formatReportAmount(b.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="pt-1 border-t border-slate-900 flex justify-between items-center font-black bg-slate-900 text-white p-1 rounded">
                      <span>صافي التدفق النقدي</span>
                      <span className="font-mono">{formatReportAmount(cashFlowData.netCashFlow)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Official Signatures Block - Anti Page Break & Compact */}
              {includeSignatures && (
                <div className={`print-signatures-block ${printDensity === 'ultra' ? 'pt-1 print:pt-0.5' : 'pt-2 print:pt-1'} border-t-2 border-indigo-950 grid grid-cols-3 gap-2 print:gap-1 text-center font-bold text-slate-800`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <div className={`bg-slate-50 ${printDensity === 'ultra' ? 'p-1 print:py-0.5 print:px-1 space-y-0.5' : 'p-1.5 print:py-0.5 print:px-1 space-y-1'} rounded border border-slate-200`}>
                    <p className={`font-black text-slate-900 ${printDensity === 'ultra' ? 'text-[8px] print:text-[7px]' : 'text-xs print:text-[8px]'}`}>إعداد المحاسب المسؤول</p>
                    <p className="text-slate-400 font-mono tracking-widest text-[7px] print:text-[5.5px] leading-none">.................................</p>
                    <p className="text-[7.5px] print:text-[6.5px] text-slate-500">التوقيع والختم</p>
                  </div>
                  <div className={`bg-slate-50 ${printDensity === 'ultra' ? 'p-1 print:py-0.5 print:px-1 space-y-0.5' : 'p-1.5 print:py-0.5 print:px-1 space-y-1'} rounded border border-slate-200`}>
                    <p className={`font-black text-slate-900 ${printDensity === 'ultra' ? 'text-[8px] print:text-[7px]' : 'text-xs print:text-[8px]'}`}>المراجعة والتدقيق الداخلي</p>
                    <p className="text-slate-400 font-mono tracking-widest text-[7px] print:text-[5.5px] leading-none">.................................</p>
                    <p className="text-[7.5px] print:text-[6.5px] text-slate-500">التوقيع والختم</p>
                  </div>
                  <div className={`bg-slate-50 ${printDensity === 'ultra' ? 'p-1 print:py-0.5 print:px-1 space-y-0.5' : 'p-1.5 print:py-0.5 print:px-1 space-y-1'} rounded border border-slate-200`}>
                    <p className={`font-black text-slate-900 ${printDensity === 'ultra' ? 'text-[8px] print:text-[7px]' : 'text-xs print:text-[8px]'}`}>اعتماد المدير العام / الإدارة المالية</p>
                    <p className="text-slate-400 font-mono tracking-widest text-[7px] print:text-[5.5px] leading-none">.................................</p>
                    <p className="text-[7.5px] print:text-[6.5px] text-slate-500">التوقيع والختم</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Main Page Top Title & Header Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <PieChart className="h-7 w-7 text-indigo-600 dark:text-indigo-500" />
            التقارير المالية والحسابات الختامية
          </h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            استعراض ميزان المراجعة، الأرباح والخسائر، والميزانية العمومية للشركة بشكل لحظي.
            يتم التقييم بناءً على العملة الاساسية الحالية: <strong className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-1 font-mono">{globalCurrencyCode}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowPrintPreviewModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20 text-sm cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            معاينة وطباعة رسمية بشعار الشركة 🖨️
          </button>
        </div>
      </div>

      {/* TOP GLOBAL PERIOD DATE FILTER BAR */}
      <div className="bg-indigo-900 text-white p-4 rounded-2xl shadow-md border border-indigo-800 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-indigo-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-300" />
            <span className="font-black text-sm">تحديد تاريخ الفترة المالية (شامل لميزان المراجعة والميزانية وقائمة الدخل):</span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSetPresetDate('today')}
              className="px-2.5 py-1 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 text-[11px] font-bold rounded-lg transition"
            >
              اليوم
            </button>
            <button
              onClick={() => handleSetPresetDate('this_month')}
              className="px-2.5 py-1 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 text-[11px] font-bold rounded-lg transition"
            >
              هذا الشهر
            </button>
            <button
              onClick={() => handleSetPresetDate('this_year')}
              className="px-2.5 py-1 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 text-[11px] font-bold rounded-lg transition"
            >
              هذه السنة
            </button>
            <button
              onClick={() => handleSetPresetDate('all')}
              className="px-2.5 py-1 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 text-[11px] font-bold rounded-lg transition"
            >
              الكل حتى تاريخه
            </button>
          </div>
        </div>

        {/* Date Input Pickers */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
          <div className="flex items-center gap-2 bg-indigo-950/60 p-2 rounded-xl border border-indigo-700">
            <span className="text-indigo-300">من تاريخ:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-indigo-900 border border-indigo-600 rounded-lg p-1.5 text-white font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-2 bg-indigo-950/60 p-2 rounded-xl border border-indigo-700">
            <span className="text-indigo-300">إلى تاريخ:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-indigo-900 border border-indigo-600 rounded-lg p-1.5 text-white font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="mr-auto text-[11px] bg-indigo-950/80 px-3 py-1.5 rounded-xl border border-indigo-800 text-indigo-200 font-mono">
            الفترة المختارة: {startDate} ⬅️ {endDate}
          </div>
        </div>
      </div>

      {/* Report View Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('trial_balance')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${
            activeTab === 'trial_balance'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          ميزان المراجعة
        </button>
        <button
          onClick={() => setActiveTab('income_statement')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${
            activeTab === 'income_statement'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          قائمة الدخل (الأرباح والخسائر)
        </button>
        <button
          onClick={() => setActiveTab('balance_sheet')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${
            activeTab === 'balance_sheet'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          الميزانية العمومية
        </button>
        <button
          onClick={() => setActiveTab('cash_flow')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${
            activeTab === 'cash_flow'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
          التدفقات النقدية
        </button>
        <button
          onClick={() => setActiveTab('journal_entries')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${
            activeTab === 'journal_entries'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          قيود اليومية
        </button>
      </div>

      {/* Trial Balance Tab Content */}
      {activeTab === 'trial_balance' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-slideup">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">ميزان المراجعة بالأرصدة (التحليلي)</h3>
              <p className="text-xs text-slate-500 mt-1">💡 انقر على اسم أي حساب فتح بطاقة كشف الحركة والقيود المؤثرة فوراً.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm max-w-full">
              <button
                onClick={() => setReportMode('balance')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                  reportMode === 'balance'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                الأرصدة
              </button>
              <button
                onClick={() => setReportMode('movement')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                  reportMode === 'movement'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                التحليلي / الحركة
              </button>
              <button
                onClick={() => setHideZero(!hideZero)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${hideZero ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
              >
                {hideZero ? 'ذات حركة فقط (إخفاء الصفرية)' : 'عرض الحسابات الصفرية'}
              </button>
              <select value={accountLevel} onChange={e => setAccountLevel(e.target.value as any)} className="bg-slate-50 border-none rounded p-1 text-[10px]">
                <option value="all">الكل</option>
                <option value="main">رئيسية</option>
                <option value="sub">فرعية</option>
              </select>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
              {[
                { id: 'client', label: 'العميل' },
                { id: 'date', label: 'التاريخ' },
                { id: 'month', label: 'الشهر' },
                { id: 'user', label: 'المستخدم' },
                { id: 'service', label: 'الخدمة' },
                { id: 'event', label: 'الفعالية' }
              ].map(dim => (
                <button
                  key={dim.id}
                  onClick={() => setAnalyticalDimension(dim.id as any)}
                  className={`px-1.5 py-1 rounded text-[9px] font-black transition-all whitespace-nowrap ${
                    analyticalDimension === dim.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {dim.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full text-[7px] sm:text-[9px] md:text-xs overflow-hidden">
            <table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 table-fixed">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[6px] sm:text-[8px] md:text-[9px] text-center">
                <tr>
                  <th className="p-1 md:px-2 md:py-2 w-28 sm:w-36 min-w-[130px] border-l border-slate-200 dark:border-slate-700 leading-tight font-black" rowSpan={2}>رقم الحساب</th>
                  <th className="p-0.5 md:px-2 md:py-2 w-[35%] md:w-auto border-l border-slate-200 dark:border-slate-700 leading-tight" rowSpan={2}>اسم الحساب</th>
                  {reportMode === 'movement' && (
                    <>
                      <th className="p-0.5 md:px-1 md:py-2 border-l border-slate-200 dark:border-slate-700 leading-tight" colSpan={2}>رصيد بداية</th>
                      <th className="p-0.5 md:px-1 md:py-2 border-l border-slate-200 dark:border-slate-700 leading-tight" colSpan={2}>فترة</th>
                    </>
                  )}
                  <th className="p-0.5 md:px-1 md:py-2 leading-tight" colSpan={2}>رصيد نهاية</th>
                </tr>
                <tr>
                  {reportMode === 'movement' && (
                    <>
                      <th className="p-0.5 md:px-1 md:py-1 border-l border-slate-200 dark:border-slate-700 leading-tight">مدين</th>
                      <th className="p-0.5 md:px-1 md:py-1 border-l border-slate-200 dark:border-slate-700 leading-tight">دائن</th>
                      <th className="p-0.5 md:px-1 md:py-1 border-l border-slate-200 dark:border-slate-700 leading-tight">مدين</th>
                      <th className="p-0.5 md:px-1 md:py-1 border-l border-slate-200 dark:border-slate-700 leading-tight">دائن</th>
                    </>
                  )}
                  <th className="p-0.5 md:px-1 md:py-1 border-l border-slate-200 dark:border-slate-700 leading-tight">مدين</th>
                  <th className="p-0.5 md:px-1 md:py-1 leading-tight">دائن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trialBalanceData?.hierarchicalBalances?.map(acc => {
                  const renderRow = (accItem: any, depth: number = 0): any[] => {
                    const hasActivity = Math.abs(accItem.beginDebitAgg || 0) > 0.01 || Math.abs(accItem.beginCreditAgg || 0) > 0.01 || Math.abs(accItem.endDebitAgg || 0) > 0.01 || Math.abs(accItem.endCreditAgg || 0) > 0.01 || Math.abs(accItem.moveDebitAgg || 0) > 0.01 || Math.abs(accItem.moveCreditAgg || 0) > 0.01;
                    if (hideZero && !hasActivity) return [];

                    const fullAccObj = accounts.find(a => a.id === accItem.id || a.code === accItem.code) || accItem;
                    const isMainAcc = !accItem.isTransactional || (accItem.children && accItem.children.length > 0) || depth === 0;

                    const rows = [
                      <tr
                        key={accItem.id}
                        className={`${isMainAcc ? 'bg-indigo-50/80 dark:bg-slate-800/90 font-black border-y border-indigo-100 dark:border-slate-700' : 'bg-white dark:bg-slate-900 hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 font-medium'} transition cursor-pointer group text-[6px] sm:text-[8px] md:text-[10px] text-center`}
                      >
                        <td
                          className="p-1 md:px-2 md:py-2 w-28 sm:w-36 min-w-[130px] font-mono whitespace-nowrap leading-tight border-l border-slate-200 dark:border-slate-800"
                          style={{ paddingRight: `${depth * 12 + 6}px` }}
                          onClick={() => setSelectedAccountForStatement(fullAccObj)}
                          title="انقر لفتح كشف حركة الحساب"
                        >
                          <span className={`px-2 py-0.5 rounded font-mono font-black ${isMainAcc ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                            {accItem.code}
                          </span>
                        </td>
                        <td
                          className="p-0.5 md:px-2 md:py-2 break-words whitespace-normal leading-tight text-right transition"
                          onClick={() => setSelectedAccountForStatement(fullAccObj)}
                          title="انقر لفتح كشف حركة الحساب"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={isMainAcc ? 'font-black text-indigo-950 dark:text-indigo-200 text-xs' : 'font-bold text-slate-800 dark:text-slate-200'}>
                              {accItem.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {isMainAcc ? (
                                <span className="text-[8px] font-black bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-200/60">
                                  رئيسي
                                </span>
                              ) : (
                                <span className="text-[8px] font-bold text-slate-400 opacity-60">
                                  فرعي
                                </span>
                              )}
                              <BookOpen className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          </div>
                        </td>
                        {reportMode === 'movement' && (
                          <>
                            <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-bold text-emerald-700 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-800">{formatMovementAmount(accItem.beginDebitAgg)}</td>
                            <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-bold text-rose-700 dark:text-rose-400 border-l border-slate-200 dark:border-slate-800">{formatMovementAmount(accItem.beginCreditAgg)}</td>
                            <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-bold text-emerald-700 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-800">{formatMovementAmount(accItem.moveDebitAgg)}</td>
                            <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-bold text-rose-700 dark:text-rose-400 border-l border-slate-200 dark:border-slate-800">{formatMovementAmount(accItem.moveCreditAgg)}</td>
                          </>
                        )}
                        <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-bold text-emerald-700 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-800">{formatMovementAmount(accItem.endDebitAgg)}</td>
                        <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-bold text-rose-700 dark:text-rose-400">{formatMovementAmount(accItem.endCreditAgg)}</td>
                      </tr>
                    ];

                    if (expandedAccountId === accItem.id && analyticalData && analyticalData.length > 0) {
                      analyticalData.forEach((item, idx) => {
                        const isDebitNormal = accItem.type === 'asset' || accItem.type === 'expense';
                        const netMove = isDebitNormal ? (item.debit - item.credit) : (item.credit - item.debit);
                        const itemDebitEnd = isDebitNormal ? (netMove > 0.005 ? netMove : 0) : (netMove < -0.005 ? Math.abs(netMove) : 0);
                        const itemCreditEnd = isDebitNormal ? (netMove < -0.005 ? Math.abs(netMove) : 0) : (netMove > 0.005 ? netMove : 0);

                        rows.push(
                          <tr
                            key={`analytic-${accItem.id}-${idx}`}
                            className="bg-amber-50/50 dark:bg-amber-900/10 text-[6px] sm:text-[8px] md:text-[9px] hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition italic"
                          >
                            <td className="p-0.5 md:px-1 md:py-1.5 break-all leading-tight text-slate-400 font-mono text-center border-l border-slate-200 dark:border-slate-800">-</td>
                            <td className="p-0.5 md:px-4 md:py-1.5 text-slate-500 text-right pr-6 border-l border-slate-200 dark:border-slate-800 flex items-center gap-1">
                              <span className="text-amber-500 font-bold">•</span>
                              <span>{item.label}</span>
                            </td>
                            {reportMode === 'movement' && (
                              <>
                                <td className="p-0.5 md:px-1 md:py-1.5 break-all leading-tight text-slate-400 border-l border-slate-200 dark:border-slate-800 text-center">-</td>
                                <td className="p-0.5 md:px-1 md:py-1.5 break-all leading-tight text-slate-400 border-l border-slate-200 dark:border-slate-800 text-center">-</td>
                                <td className="p-0.5 md:px-1 md:py-1.5 break-all leading-tight text-emerald-600 border-l border-slate-200 dark:border-slate-800 font-sans font-medium text-center">{formatMovementAmount(item.debit)}</td>
                                <td className="p-0.5 md:px-1 md:py-1.5 break-all leading-tight text-rose-600 border-l border-slate-200 dark:border-slate-800 font-sans font-medium text-center">{formatMovementAmount(item.credit)}</td>
                              </>
                            )}
                            <td className="p-0.5 md:px-1 md:py-1.5 break-all leading-tight text-emerald-600 border-l border-slate-200 dark:border-slate-800 font-sans font-medium text-center">{itemDebitEnd > 0.005 ? formatDebitBalance(itemDebitEnd) : '-'}</td>
                            <td className="p-0.5 md:px-1 md:py-1.5 break-all leading-tight text-rose-600 font-sans font-medium text-center">{itemCreditEnd > 0.005 ? formatDebitBalance(itemCreditEnd) : '-'}</td>
                          </tr>
                        );
                      });
                    }

                    accItem.children?.forEach((child: any) => {
                      rows.push(...renderRow(child, depth + 1));
                    });
                    return rows;
                  };
                  return renderRow(acc);
                })}
              </tbody>
              <tfoot className="bg-indigo-50 dark:bg-indigo-900/30 font-black border-t border-indigo-100 dark:border-indigo-800 text-[10px]">
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-left text-indigo-800 dark:text-indigo-300 border-l border-indigo-100 dark:border-indigo-800">الإجمالي:</td>
                  {reportMode === 'movement' && (
                    <>
                      <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-semibold text-indigo-700 dark:text-indigo-400 border-l border-indigo-100 dark:border-indigo-800">{trialBalanceData?.totalBeginDebit > 0 ? trialBalanceData.totalBeginDebit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}</td>
                      <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-semibold text-indigo-700 dark:text-indigo-400 border-l border-indigo-100 dark:border-indigo-800">{trialBalanceData?.totalBeginCredit > 0 ? trialBalanceData.totalBeginCredit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}</td>
                      <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-semibold text-indigo-700 dark:text-indigo-400 border-l border-indigo-100 dark:border-indigo-800">{trialBalanceData?.totalMoveDebit > 0 ? trialBalanceData.totalMoveDebit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}</td>
                      <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-semibold text-indigo-700 dark:text-indigo-400 border-l border-indigo-100 dark:border-indigo-800">{trialBalanceData?.totalMoveCredit > 0 ? trialBalanceData.totalMoveCredit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}</td>
                    </>
                  )}
                  <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-semibold text-indigo-700 dark:text-indigo-400 border-l border-indigo-100 dark:border-indigo-800">{trialBalanceData?.totalEndDebit > 0 ? trialBalanceData.totalEndDebit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}</td>
                  <td className="p-0.5 md:px-1 md:py-2 font-sans break-all leading-tight font-semibold text-indigo-700 dark:text-indigo-400">{trialBalanceData?.totalEndCredit > 0 ? trialBalanceData.totalEndCredit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Income Statement Tab Content */}
      {activeTab === 'income_statement' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-slideup p-6 space-y-6">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-xl">قائمة الدخل (الأرباح والخسائر)</h3>
              <p className="text-sm text-slate-500 mt-1">💡 انقر على أي بند/حساب إيراد أو مصروف لعرض تفاصيل حركته المالية الكاملة.</p>
            </div>
            <button
              onClick={() => setShowPrintPreviewModal(true)}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black rounded-xl border border-indigo-200 text-xs flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              معاينة وطباعة رسمية
            </button>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {/* Revenues */}
            <div>
              <h4 className="font-bold text-indigo-700 dark:text-indigo-400 mb-3 text-lg border-b border-indigo-100 dark:border-indigo-900/50 pb-2">الإيرادات (Revenues)</h4>
              <div className="space-y-2">
                {incomeStatementData.revenues.map(acc => {
                  const fullAccObj = accounts.find(a => a.id === acc.id || a.code === acc.code) || acc;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccountForStatement(fullAccObj)}
                      className="flex justify-between items-center text-sm py-2 px-3 rounded-xl hover:bg-indigo-50/60 dark:hover:bg-slate-800 cursor-pointer transition group border border-transparent hover:border-indigo-100 dark:hover:border-slate-700"
                      title="انقر لفتح كشف حركة الحساب"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 group-hover:text-indigo-600 font-bold">{acc.code}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{acc.name}</span>
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="font-sans font-black text-slate-900 dark:text-white">{formatReportAmount(acc.credit - acc.debit)}</span>
                    </div>
                  );
                })}
                {incomeStatementData.revenues.length === 0 && <div className="text-slate-400 text-sm py-2 text-center">لا توجد حركات مؤكدة في هذه الفترة</div>}
                <div className="flex justify-between items-center text-sm font-black pt-3 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-800 dark:text-slate-200">إجمالي الإيرادات</span>
                  <span className="font-sans text-indigo-600 dark:text-indigo-400 font-black text-base">{formatReportAmount(incomeStatementData.totalRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Expenses */}
            <div>
              <h4 className="font-bold text-rose-700 dark:text-rose-400 mb-3 text-lg border-b border-rose-100 dark:border-rose-900/50 pb-2">المصروفات (Expenses)</h4>
              <div className="space-y-2">
                {incomeStatementData.expenses.map(acc => {
                  const fullAccObj = accounts.find(a => a.id === acc.id || a.code === acc.code) || acc;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccountForStatement(fullAccObj)}
                      className="flex justify-between items-center text-sm py-2 px-3 rounded-xl hover:bg-rose-50/60 dark:hover:bg-slate-800 cursor-pointer transition group border border-transparent hover:border-rose-100 dark:hover:border-slate-700"
                      title="انقر لفتح كشف حركة الحساب"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 group-hover:text-rose-600 font-bold">{acc.code}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold group-hover:text-rose-700 dark:group-hover:text-rose-300">{acc.name}</span>
                        <BookOpen className="w-3.5 h-3.5 text-rose-500 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="font-sans font-black text-slate-900 dark:text-white">{formatReportAmount(acc.debit - acc.credit)}</span>
                    </div>
                  );
                })}
                {incomeStatementData.expenses.length === 0 && <div className="text-slate-400 text-sm py-2 text-center">لا توجد حركات مؤكدة في هذه الفترة</div>}
                <div className="flex justify-between items-center text-sm font-black pt-3 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-800 dark:text-slate-200">إجمالي المصروفات</span>
                  <span className="font-sans text-rose-600 dark:text-rose-400 font-black text-base">({formatReportAmount(incomeStatementData.totalExpense)})</span>
                </div>
              </div>
            </div>

            {/* Net Income */}
            <div className={`mt-8 p-5 rounded-2xl border-2 flex justify-between items-center shadow-sm ${incomeStatementData.netIncome >= 0 ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-rose-50 border-rose-300 dark:bg-rose-900/20 dark:border-rose-800'}`}>
              <span className={`text-xl font-black ${incomeStatementData.netIncome >= 0 ? 'text-emerald-900 dark:text-emerald-400' : 'text-rose-900 dark:text-rose-400'}`}>
                {incomeStatementData.netIncome >= 0 ? 'صافي الربح' : 'صافي الخسارة'}
              </span>
              <span className={`text-2xl font-black font-sans ${incomeStatementData.netIncome >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                {formatReportAmount(incomeStatementData.netIncome)} {selectedGlobalCurrencyObj.symbol}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Balance Sheet Tab Content */}
      {activeTab === 'balance_sheet' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-slideup p-6 space-y-6">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-xl">الميزانية العمومية (المركز المالي)</h3>
              <p className="text-sm text-slate-500 mt-1">💡 انقر على أي حساب أصول أو خصوم لمشاهدة تفاصيل حركته المالية للفترة.</p>
            </div>
            <button
              onClick={() => setShowPrintPreviewModal(true)}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black rounded-xl border border-indigo-200 text-xs flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              معاينة وطباعة رسمية
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Assets Side */}
            <div className="space-y-6">
              <h4 className="font-black text-emerald-700 dark:text-emerald-400 mb-4 text-xl border-b-2 border-emerald-500 pb-2">الأصول (Assets)</h4>

              <div className="space-y-2">
                {balanceSheetData.assets.map(acc => {
                  const fullAccObj = accounts.find(a => a.id === acc.id || a.code === acc.code) || acc;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccountForStatement(fullAccObj)}
                      className="flex justify-between items-center text-sm py-2 px-3 rounded-xl hover:bg-emerald-50/60 dark:hover:bg-slate-800 cursor-pointer transition group border border-transparent hover:border-emerald-100 dark:hover:border-slate-700"
                      title="انقر لفتح كشف حركة الحساب"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 group-hover:text-emerald-600 font-bold">{acc.code}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold group-hover:text-emerald-700 dark:group-hover:text-emerald-300">{acc.name}</span>
                        <BookOpen className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="font-sans font-black text-slate-900 dark:text-white">{formatReportAmount(acc.debit - acc.credit)}</span>
                    </div>
                  );
                })}
                {balanceSheetData.assets.length === 0 && <div className="text-slate-400 text-sm py-2 text-center">لا توجد حركات أصول</div>}
              </div>

              <div className="flex justify-between items-center p-4 mt-4 bg-emerald-50/80 dark:bg-slate-800 rounded-2xl font-black text-lg border border-emerald-200 dark:border-emerald-900">
                <span className="text-emerald-950 dark:text-slate-200">إجمالي الأصول</span>
                <span className="font-sans text-emerald-700 dark:text-emerald-400">{formatReportAmount(balanceSheetData.totalAssets)}</span>
              </div>
            </div>

            {/* Liabilities & Equity Side */}
            <div className="space-y-6">
              <h4 className="font-black text-rose-700 dark:text-rose-400 mb-4 text-xl border-b-2 border-rose-500 pb-2">الخصوم (Liabilities)</h4>

              <div className="space-y-2">
                {balanceSheetData.liabilities.map(acc => {
                  const fullAccObj = accounts.find(a => a.id === acc.id || a.code === acc.code) || acc;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccountForStatement(fullAccObj)}
                      className="flex justify-between items-center text-sm py-2 px-3 rounded-xl hover:bg-rose-50/60 dark:hover:bg-slate-800 cursor-pointer transition group border border-transparent hover:border-rose-100 dark:hover:border-slate-700"
                      title="انقر لفتح كشف حركة الحساب"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 group-hover:text-rose-600 font-bold">{acc.code}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold group-hover:text-rose-700 dark:group-hover:text-rose-300">{acc.name}</span>
                        <BookOpen className="w-3.5 h-3.5 text-rose-500 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="font-sans font-black text-slate-900 dark:text-white">{formatReportAmount(acc.credit - acc.debit)}</span>
                    </div>
                  );
                })}
                {balanceSheetData.liabilities.length === 0 && <div className="text-slate-400 text-sm py-2 text-center">لا توجد حركات خصوم</div>}
              </div>

              <div className="flex justify-between items-center p-2 text-sm font-black border-b-2 border-slate-200 dark:border-slate-700 mb-4 pb-3">
                <span className="text-slate-700 dark:text-slate-300">إجمالي الخصوم</span>
                <span className="font-sans text-rose-600 dark:text-rose-400 font-black">{formatReportAmount(balanceSheetData.totalLiabilities)}</span>
              </div>

              <h4 className="font-black text-blue-700 dark:text-blue-400 mt-6 mb-4 text-xl border-b-2 border-blue-500 pb-2">حقوق الملكية (Equity)</h4>
              <div className="space-y-2">
                {balanceSheetData.equity.map(acc => {
                  const fullAccObj = accounts.find(a => a.id === acc.id || a.code === acc.code) || acc;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccountForStatement(fullAccObj)}
                      className="flex justify-between items-center text-sm py-2 px-3 rounded-xl hover:bg-blue-50/60 dark:hover:bg-slate-800 cursor-pointer transition group border border-transparent hover:border-blue-100 dark:hover:border-slate-700"
                      title="انقر لفتح كشف حركة الحساب"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 group-hover:text-blue-600 font-bold">{acc.code}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold group-hover:text-blue-700 dark:group-hover:text-blue-300">{acc.name}</span>
                        <BookOpen className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="font-sans font-black text-slate-900 dark:text-white">{formatReportAmount(acc.credit - acc.debit)}</span>
                    </div>
                  );
                })}

                <div className="flex justify-between items-center text-sm py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-800 dark:text-slate-200 font-bold italic">صافي أرباح (خسائر) الفترة المضافة</span>
                  <span className={`font-sans font-black ${incomeStatementData.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatReportAmount(incomeStatementData.netIncome)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 mt-4 bg-blue-50/80 dark:bg-slate-800 rounded-2xl font-black text-lg text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-900">
                <span>إجمالي الخصوم وحقوق الملكية</span>
                <span className="font-sans font-black">{formatReportAmount(balanceSheetData.totalLiabilitiesAndEquity)}</span>
              </div>
            </div>
          </div>

          {/* Validation Footnote */}
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-center">
            {Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity) < 0.1 ? (
              <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-5 py-2.5 rounded-full text-sm shadow-sm border border-emerald-200">
                <CheckSquare className="h-5 w-5" />
                الميزانية العمومية متوازنة بنجاح (Balanced Assets = Liabilities + Equity)
              </span>
            ) : (
              <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/30 px-5 py-2.5 rounded-full text-sm shadow-sm border border-rose-200">
                <Info className="h-5 w-5" />
                الميزانية غير متوازنة، يجب مراجعة القيود - الفارق: {formatReportAmount(Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Journal Entries Tab Content */}
      {activeTab === 'journal_entries' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-slideup p-6 space-y-4">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-xl">قيود اليومية</h3>
              <p className="text-sm text-slate-500 mt-1">كشف بجميع القيود المحاسبية المسجلة بالفترة المحددة</p>
            </div>
            <button
              onClick={() => setShowPrintPreviewModal(true)}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black rounded-xl border border-indigo-200 text-xs flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              معاينة وطباعة رسمية
            </button>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">البيان والتفاصيل</th>
                  <th className="px-4 py-3">مدين (+)</th>
                  <th className="px-4 py-3">دائن (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(transactions || [])
                  .filter(tx => {
                    const d = (tx.date || '').split(/[\sT]/)[0];
                    return d >= startDate && d <= endDate;
                  })
                  .map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 text-slate-500 font-mono font-bold">{(tx.date || '').split(/[\sT]/)[0]}</td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{tx.description}</td>
                      <td className="px-4 py-3 font-sans font-black text-emerald-600">{formatReportAmount(tx.amount)}</td>
                      <td className="px-4 py-3 font-sans font-black text-rose-600">{formatReportAmount(tx.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(transactions || [])
              .filter(tx => {
                const d = (tx.date || '').split(/[\sT]/)[0];
                return d >= startDate && d <= endDate;
              })
              .map((tx, idx) => (
                <div key={tx.id || idx} className="p-4 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-slate-400 font-bold">{(tx.date || '').split(/[\sT]/)[0]}</span>
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">قيد محاسبي</span>
                  </div>
                  <p className="text-xs font-black text-slate-800 dark:text-white leading-relaxed line-clamp-2">{tx.description}</p>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">مدين (+)</span>
                      <span className="text-xs font-black text-emerald-600 font-sans">{formatReportAmount(tx.amount)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">دائن (-)</span>
                      <span className="text-xs font-black text-rose-600 font-sans">{formatReportAmount(tx.amount)}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
