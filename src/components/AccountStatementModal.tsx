import React, { useMemo } from "react";
import { motion } from "motion/react";
import { X, BookOpen, Printer, Sparkles, Building, Hash, Calendar, Layers } from "lucide-react";
import AccountStatementQuickView from "./AccountStatementQuickView";
import { Account, Currency, Transaction, CompanySettings, Client, Booking, ReceiptPayment } from "../types";
import { useBackButton } from "../lib/backButtonManager";

interface AccountStatementModalProps {
  accounts: Account[];
  transactions: Transaction[];
  currencies: Currency[];
  vouchers?: ReceiptPayment[];
  globalCurrencyCode: string;
  companySettings: CompanySettings | null;
  setPrintData: (data: any) => void;
  clients?: Client[];
  bookings?: Booking[];
  initialAccountId?: string | null;
  fromDate: string;
  toDate: string;
  onClose: () => void;
}

export default function AccountStatementModal(props: AccountStatementModalProps) {
  // Phone Back Button support
  useBackButton(true, props.onClose, "AccountStatementModal", 40);

  const currentAcc = props.accounts.find(
    a => String(a.id) === String(props.initialAccountId) || String(a.code) === String(props.initialAccountId)
  );

  const ledgerData = useMemo(() => {
    if (!currentAcc) return { movements: [], openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0 };

    const filteredTransactions = props.transactions.filter(t => {
      const d = (t.date || '').split(/[\sT]/)[0];
      return d >= props.fromDate && d <= props.toDate;
    });
    
    // Calculate opening balance (simplified)
    const openingTx = props.transactions.filter(t => {
      const d = (t.date || '').split(/[\sT]/)[0];
      return d < props.fromDate && (t.debitAccountId === currentAcc.id || t.creditAccountId === currentAcc.id);
    });
    let openDebit = 0;
    let openCredit = 0;
    openingTx.forEach(tx => {
      const amount = tx.amount * (tx.rate || 1);
      if (tx.debitAccountId === currentAcc.id) openDebit += amount;
      if (tx.creditAccountId === currentAcc.id) openCredit += amount;
    });
    
    const isDebitNormal = currentAcc.type === 'asset' || currentAcc.type === 'expense';
    const openingBalance = isDebitNormal ? (openDebit - openCredit) : (openCredit - openDebit);

    let runningBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    const movements = filteredTransactions.filter(t => t.debitAccountId === currentAcc.id || t.creditAccountId === currentAcc.id).map(tx => {
        const amount = tx.amount * (tx.rate || 1);
        const isDebit = tx.debitAccountId === currentAcc.id;
        if(isDebit) totalDebit += amount;
        else totalCredit += amount;
        
        const movementNet = isDebitNormal ? (isDebit ? amount : -amount) : (isDebit ? -amount : amount);
        runningBalance += movementNet;
        
        return {
            id: tx.id,
            date: (tx.date || '').split(/[\sT]/)[0],
            description: tx.description,
            debitAmount: isDebit ? amount : 0,
            creditAmount: isDebit ? 0 : amount,
            runningBalance: runningBalance,
            sourceType: tx.sourceType
        }
    });

    return { movements, openingBalance, totalDebit, totalCredit, closingBalance: runningBalance };
  }, [currentAcc, props.transactions, props.fromDate, props.toDate]);

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-7xl shadow-2xl shadow-indigo-950/30 max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/80 dark:border-slate-800"
      >
        {/* Sleek Gradient Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap justify-between items-center bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white gap-3 shadow-md relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3.5 z-10">
            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white border border-indigo-400/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  بطاقة كشف الحركة والقيود المالية
                </h3>
                {currentAcc?.code && (
                  <span className="bg-indigo-500/30 text-indigo-200 font-mono text-xs px-2.5 py-0.5 rounded-lg border border-indigo-400/30 font-extrabold flex items-center gap-1">
                    <Hash className="w-3 h-3 text-indigo-300" />
                    {currentAcc.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200/90 font-bold mt-0.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                {currentAcc?.name ? `الحساب المالي: ${currentAcc.name}` : "تفاصيل الحركات القيود المالية والسندات للفترة"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-auto sm:mr-0 z-10">
            <button
              onClick={props.onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="إغلاق النافذة"
            >
              <X className="w-6 h-6" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-slate-50/60 dark:bg-slate-950/60">
          <AccountStatementQuickView 
            selectedAccount={currentAcc || null}
            ledgerData={ledgerData}
            fromDate={props.fromDate}
            toDate={props.toDate}
            displayCurrency={props.globalCurrencyCode}
          />
        </div>
      </motion.div>
    </div>
  );
}
