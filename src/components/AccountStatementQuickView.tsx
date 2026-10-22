import React from "react";
import { Account, Transaction } from "../types";

interface AccountStatementQuickViewProps {
  selectedAccount: Account | null;
  ledgerData: {
    movements: any[];
    openingBalance: number;
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
  };
  fromDate: string;
  toDate: string;
  displayCurrency: string;
}

export default function AccountStatementQuickView({
  selectedAccount,
  ledgerData,
  fromDate,
  toDate,
  displayCurrency
}: AccountStatementQuickViewProps) {
  if (!selectedAccount) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden text-[11px]">
      {/* Compact Header */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          سجل القيود وحركات الحساب التفصيلية
        </h3>
        <span className="text-[10px] text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
          إجمالي العمليات: {ledgerData.movements.length} حركة
        </span>
      </div>

      {/* Dense Table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse text-right">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
            <tr>
              <th className="px-2 py-1 text-center">م</th>
              <th className="px-2 py-1">التاريخ</th>
              <th className="px-2 py-1">نوع السند والعميل</th>
              <th className="px-2 py-1">البيان (الشرح)</th>
              <th className="px-2 py-1 text-emerald-600">مدين (+)</th>
              <th className="px-2 py-1 text-rose-600">دائن (-)</th>
              <th className="px-2 py-1 text-slate-800 dark:text-slate-200">الرصيد</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {/* Opening Balance Row */}
            <tr className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-500 italic">
              <td className="px-2 py-1 text-center">-</td>
              <td className="px-2 py-1 font-mono">{fromDate ? fromDate.split(/[\sT]/)[0] : '-'}</td>
              <td className="px-2 py-1">رصيد افتتاحي</td>
              <td className="px-2 py-1">الرصيد السابق قبل تاريخ التصفية</td>
              <td className="px-2 py-1 text-center">-</td>
              <td className="px-2 py-1 text-center">-</td>
              <td className="px-2 py-1 font-mono text-slate-800 dark:text-slate-200">
                {ledgerData.openingBalance.toLocaleString()}
              </td>
            </tr>
            {/* Movements */}
            {ledgerData.movements.map((move, index) => (
              <tr key={move.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                <td className="px-2 py-1 text-center font-mono">{index + 1}</td>
                <td className="px-2 py-1 font-mono text-[10px] whitespace-nowrap">
                  {(move.date || '').split(/[\sT]/)[0]}
                </td>
                <td className="px-2 py-1 font-bold text-indigo-600">
                   {move.sourceType === 'booking' ? 'حجز' : 'سند'}
                </td>
                <td className="px-2 py-1 truncate max-w-[150px]">{move.description}</td>
                <td className="px-2 py-1 font-mono text-center text-emerald-600">{move.debitAmount > 0 ? move.debitAmount.toLocaleString() : '-'}</td>
                <td className="px-2 py-1 font-mono text-center text-rose-600">{move.creditAmount > 0 ? move.creditAmount.toLocaleString() : '-'}</td>
                <td className="px-2 py-1 font-mono font-bold text-slate-900 dark:text-slate-100">{move.runningBalance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
