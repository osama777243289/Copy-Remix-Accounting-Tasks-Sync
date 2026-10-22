import React, { useState } from 'react';
import { X, Tag, Calculator, Check, AlertCircle, Printer, CheckCircle, Clock, XCircle, AlertTriangle, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Booking, Account, Currency, CompanySettings } from '../types';
import { toast } from 'sonner';
import OfficialDiscountPrintModal from './OfficialDiscountPrintModal';
import { addBookingDiscountRequest } from '../lib/dbService';
import { usePermissions } from '../lib/permissions';
import { useBackButton } from '../lib/backButtonManager';

interface BookingDiscountModalProps {
  booking: Booking;
  discountRequests?: any[];
  accounts: Account[];
  currencies: Currency[];
  company?: CompanySettings | null;
  currentUser?: any;
  isOpen: boolean;
  onClose: () => void;
  onSaveDiscount: (bookingId: string, totalDiscount: number, daysDiscounts: { date: string; discount: number }[], discountReason: string) => Promise<void>;
}

export default function BookingDiscountModal({
  booking,
  discountRequests = [],
  accounts = [],
  currencies = [],
  company,
  currentUser,
  isOpen,
  onClose,
  onSaveDiscount
}: BookingDiscountModalProps) {
  // Phone Back Button support
  useBackButton(isOpen, onClose, "BookingDiscountModal", 40);

  if (!isOpen) return null;

  const { hasPermission, currentRole } = usePermissions();
  const isManager = Boolean(
    hasPermission('approve-discounts') ||
    hasPermission('btn-approve-discount') ||
    hasPermission('manage-users') || 
    hasPermission('view-company') || 
    hasPermission('allow-unlimited-discount') || 
    currentRole?.name?.toLowerCase().includes('admin') ||
    currentRole?.name?.toLowerCase().includes('مدير') ||
    (currentUser as any)?.role === 'admin' || 
    (currentUser as any)?.role === 'manager'
  );

  const bookingDays: any[] = booking.days && booking.days.length > 0 
    ? booking.days 
    : [{ date: (booking as any).eventDate || new Date().toISOString().split('T')[0], price: booking.totalPrice || 0, discount: 0 }];

  const [daysDiscounts, setDaysDiscounts] = useState<{ date: string; discount: number }[]>(
    bookingDays.map(d => ({ date: d.date, discount: Number(d.discount || 0) }))
  );
  const [discountReason, setDiscountReason] = useState(
    ((booking as any).discountReason || 'خصم خاص على الحجز').replace(/إداري\s*/g, '').trim()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false); // Collapsed by default
  const [selectedPrintRequest, setSelectedPrintRequest] = useState<any>(null);

  const totalDiscount = daysDiscounts.reduce((sum, d) => sum + Number(d.discount || 0), 0);
  const baseTotal = bookingDays.reduce((sum: number, d: any) => sum + Number(d.price || 0), 0);

  const existingRequests = (discountRequests || [])
    .filter(
      (r: any) =>
        r.bookingId === booking.id ||
        r.bookingCode === booking.sequenceCode ||
        (booking.sequenceCode && r.bookingId === booking.sequenceCode) ||
        (r.bookingCode && r.bookingCode === booking.id)
    )
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const pendingRequests = existingRequests.filter((r: any) => r.status === 'pending');
  const approvedRequests = existingRequests.filter((r: any) => r.status === 'approved');
  const approvedRequestsTotal = approvedRequests.reduce((sum: number, r: any) => sum + Number(r.totalDiscount || 0), 0);

  // Total approved discount granted to display (or current active discount if no prior approved request)
  const displayApprovedDiscount = approvedRequests.length > 0 ? approvedRequestsTotal : (booking.totalDiscount || 0);
  const netTotal = Math.max(0, baseTotal - displayApprovedDiscount);

  const handleUniformDiscount = (amount: number) => {
    const perDay = bookingDays.length > 0 ? Math.round(amount / bookingDays.length) : 0;
    setDaysDiscounts(bookingDays.map(d => ({ date: d.date, discount: perDay })));
  };

  // Stage 1: Submit Request (For Review and Approval in Discounts Management View)
  const handleSubmitRequest = async () => {
    try {
      setIsSubmitting(true);
      const reqId = `BDR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await addBookingDiscountRequest({
        id: reqId,
        sequenceCode: reqId,
        bookingId: booking.id,
        bookingCode: booking.sequenceCode || booking.id.slice(-6).toUpperCase(),
        customerName: booking.customerName || 'عميل',
        totalDiscount,
        daysDiscounts,
        discountReason,
        status: 'pending',
        requestedBy: currentUser?.name || currentUser?.username || 'الموظف',
        createdAt: new Date().toISOString()
      });
      toast.success('تم إرسال طلب الخصم بنجاح إلى شاشة إدارة الخصومات بانتظار الاعتماد');
      onClose();
    } catch (err: any) {
      toast.error(`حدث خطأ أثناء إرسال طلب الخصم: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Approval (For Managers / Admins)
  const handleDirectApprove = async () => {
    try {
      setIsSubmitting(true);
      // 1. Update Booking and ledger
      await onSaveDiscount(booking.id, totalDiscount, daysDiscounts, discountReason);
      
      // 2. Also record in requests as approved for audit
      const reqId = `BDR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await addBookingDiscountRequest({
        id: reqId,
        sequenceCode: reqId,
        bookingId: booking.id,
        bookingCode: booking.sequenceCode || booking.id.slice(-6).toUpperCase(),
        customerName: booking.customerName || 'عميل',
        totalDiscount,
        daysDiscounts,
        discountReason,
        status: 'approved',
        requestedBy: currentUser?.name || currentUser?.username || 'الإدارة',
        approvedBy: currentUser?.name || currentUser?.username || 'الإدارة العامة',
        approvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      toast.success('تم اعتماد وتطبيق الخصم بنجاح وتحديث الحسابات');
      setIsPrintModalOpen(true);
    } catch (err: any) {
      toast.error(`خطأ أثناء اعتماد الخصم: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">
                  إدارة وتوزيع الخصومات للحجز - العميل: {booking.customerName}
                </h3>
                <p className="text-xs text-slate-500 font-bold">
                  رقم الحجز: <span className="font-mono text-red-600 font-black">{booking.sequenceCode || booking.id.slice(-6)}</span> | عدد أيام الحجز: {bookingDays.length} أيام
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-900 dark:text-slate-100">

            {/* Status Alert Banners */}
            {pendingRequests.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between font-black text-amber-900 dark:text-amber-200 mb-1">
                    <span>تنبيه: يوجد طلب خصم سابق قيد الانتظار لم يتم اعتماده بعد ⏳</span>
                    <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-2 py-0.5 rounded-full text-[10px] font-mono font-black" style={{ color: '#dc2626' }}>
                      {pendingRequests[0].sequenceCode || pendingRequests[0].id}
                    </span>
                  </div>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed font-bold">
                    بقيمـــة: <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-sm ml-1">{Number(pendingRequests[0].totalDiscount || 0).toLocaleString()} {booking.currency}</span> |
                    بواسطة: {pendingRequests[0].requestedBy || 'الموظف'} |
                    السبب: {pendingRequests[0].discountReason || 'بدون بيان'}
                  </p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                    يمكنك إرسال طلب خصم إضافي آخر بأسفل النافذة عند الحاجة.
                  </p>
                </div>
              </div>
            )}

            {pendingRequests.length === 0 && approvedRequests.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between font-black text-emerald-900 dark:text-emerald-200 mb-1">
                    <span>حالة الخصم: تم اعتماد الخصم رسمياً وتطبيقه على العقد ✅</span>
                    <span className="bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-mono font-black" style={{ color: '#dc2626' }}>
                      {approvedRequests[0].sequenceCode || approvedRequests[0].id}
                    </span>
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed font-bold">
                    مبلغ الخصم المعمد: <span className="font-black text-emerald-700 dark:text-emerald-300 font-mono text-sm ml-1">{Number(approvedRequests[0].totalDiscount || 0).toLocaleString()} {booking.currency}</span> |
                    بواسطة: {approvedRequests[0].approvedBy || 'الإدارة العامة'}
                  </p>
                </div>
              </div>
            )}

            {/* Existing Requests History Section (Collapsible & Default Collapsed) */}
            {existingRequests.length > 0 && (
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-600" />
                    <span>سجل طلبات الخصم السابقة لهذا الحجز ({existingRequests.length}):</span>
                    {approvedRequestsTotal > 0 && (
                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-mono font-black border border-emerald-300 dark:border-emerald-800">
                        إجمالي المعتمد: {approvedRequestsTotal.toLocaleString()} {booking.currency}
                      </span>
                    )}
                  </h4>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                  >
                    <span>{isHistoryExpanded ? 'طَيّ التفاصيل' : 'عرض التفاصيل'}</span>
                    {isHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Collapsible Details */}
                {isHistoryExpanded && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                    {existingRequests.map((req: any, idx: number) => {
                      const isReqPending = req.status === 'pending';
                      const isReqApproved = req.status === 'approved';
                      const isReqRejected = req.status === 'rejected';

                      return (
                        <div key={idx} className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-red-600 text-[11px]" style={{ color: '#dc2626' }}>
                                {req.sequenceCode || req.id}
                              </span>
                              <span className="text-[10px] text-slate-500 font-bold">
                                ({new Date(req.createdAt).toLocaleDateString('ar-EG')} - {new Date(req.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                              المبلغ: <span className="font-black font-mono text-indigo-600">{Number(req.totalDiscount || 0).toLocaleString()} {booking.currency}</span> |
                              بواسطة: {req.requestedBy || 'الموظف'} | البيان: {req.discountReason || 'بدون'}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isReqPending && (
                              <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg text-[10px] font-black border border-amber-300 dark:border-amber-800">
                                <Clock className="w-3 h-3" />
                                قيد الانتظار
                              </span>
                            )}
                            {isReqApproved && (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-lg text-[10px] font-black border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle className="w-3 h-3" />
                                معتمد
                              </span>
                            )}
                            {isReqRejected && (
                              <span className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-2.5 py-1 rounded-lg text-[10px] font-black border border-rose-300 dark:border-rose-800">
                                <XCircle className="w-3 h-3" />
                                مرفوض
                              </span>
                            )}

                            {/* Button to Preview & Print THIS specific discount request */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPrintRequest(req);
                                setIsPrintModalOpen(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10.5px] font-bold border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                              title="معاينة وطباعة هذا الخصم المحدد"
                            >
                              <Eye className="w-3 h-3" />
                              <Printer className="w-3 h-3" />
                              <span>طباعة</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <p className="text-[10px] text-slate-500 font-bold mb-1">إجمالي العقد الأساسي</p>
                <p className="text-sm sm:text-base font-black font-mono text-slate-800 dark:text-white">{baseTotal.toLocaleString()} {booking.currency}</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-center">
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mb-1">إجمالي الخصم المعتمد الممنوح</p>
                <p className="text-sm sm:text-base font-black font-mono text-indigo-700 dark:text-indigo-300">{displayApprovedDiscount.toLocaleString()} {booking.currency}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-1">صافي قيمة العقد النهائية</p>
                <p className="text-sm sm:text-base font-black font-mono text-emerald-700 dark:text-emerald-300">{netTotal.toLocaleString()} {booking.currency}</p>
              </div>
            </div>

            {/* Quick Uniform Discount Input */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-600" />
                <span>توزيع إجمالي خصم موحد على أيام الحجز تلقائياً:</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="أدخل إجمالي مبلغ الخصم المراد توزيعه..."
                  onChange={(e) => handleUniformDiscount(Number(e.target.value) || 0)}
                  className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold font-mono focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Detailed Days Discount Table */}
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                تخصيص الخصم يدوياً لكل يوم من أيام الحجز:
              </p>
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black">
                    <tr>
                      <th className="p-3">تاريخ اليوم</th>
                      <th className="p-3">سعر اليوم الأساسي</th>
                      <th className="p-3">مبلغ الخصم (يدوي)</th>
                      <th className="p-3">الصافي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    {bookingDays.map((d: any, idx: number) => {
                      const dayPrice = Number(d.price || 0);
                      const dayDisc = Number(daysDiscounts[idx]?.discount || 0);
                      const dayNet = Math.max(0, dayPrice - dayDisc);
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-mono">{d.date}</td>
                          <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{dayPrice.toLocaleString()} {booking.currency}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={dayDisc}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const updated = [...daysDiscounts];
                                updated[idx] = { date: d.date, discount: val };
                                setDaysDiscounts(updated);
                              }}
                              className="w-28 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-mono text-xs font-black focus:outline-none focus:border-indigo-600 text-indigo-600"
                            />
                          </td>
                          <td className="p-3 font-mono font-black text-emerald-600">{dayNet.toLocaleString()} {booking.currency}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reason / Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">سبب أو بيان الخصم:</label>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="مثال: خصم خاص على الحجز / مراعاة للعميل..."
                className="w-full bg-slate-50 dark:bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3 rounded-2xl flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                عند حفظ الخصم، سيقوم النظام تلقائياً بتحديث إجمالي العقد، وتوليد القيود المحاسبية اللازمة في الحسابات (حـ/ الخصومات المسموح بها وحـ/ العميل).
              </p>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
            {(hasPermission('btn-discount-modal-print-notice') || hasPermission('btn-print-discount') || hasPermission('print-discount')) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPrintRequest(null);
                  setIsPrintModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-black text-xs rounded-xl transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>معاينة وطباعة إشعار الخصم</span>
              </button>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>

              {(hasPermission('btn-discount-modal-request-approval') || hasPermission('btn-request-discount')) && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitRequest}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                  title="إرسال طلب الخصم إلى شاشة إدارة الخصومات بانتظار الاعتماد"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>إرسال طلب للاعتماد</span>
                </button>
              )}

              {(hasPermission('btn-discount-modal-instant-approve') || hasPermission('btn-approve-discount') || isManager) && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDirectApprove}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                  title="اعتماد مباشر وتطبيق الخصم فورياً وتحديث العقد والحسابات"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>اعتماد وتطبيق فوري</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Official Discount Print Modal (A5 Portrait) */}
      <OfficialDiscountPrintModal
        isOpen={isPrintModalOpen}
        booking={booking}
        totalDiscount={totalDiscount}
        daysDiscounts={daysDiscounts}
        discountReason={discountReason}
        discountRequest={selectedPrintRequest}
        company={company}
        accounts={accounts}
        currencies={currencies}
        currentUser={currentUser}
        onClose={() => {
          setIsPrintModalOpen(false);
          setSelectedPrintRequest(null);
        }}
      />
    </>
  );
}
