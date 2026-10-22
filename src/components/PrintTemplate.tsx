import React from 'react';
import { CompanySettings } from '../types';
import { Phone, Mail, Globe, MapPin } from 'lucide-react';

interface PrintTemplateProps {
  company: CompanySettings | null;
  title: string;
  children: React.ReactNode;
  documentNumber?: string;
  manualNumber?: string;
  documentLabel?: string;
  bookingNumber?: string;
  date?: string;
  createdBy?: string;
  createdAt?: string;
  isAudited?: boolean;
  auditedBy?: string;
  auditedAt?: string;
}

export default function PrintTemplate({
  company,
  title,
  children,
  documentNumber,
  manualNumber,
  documentLabel = "رقم المستند:",
  bookingNumber,
  date,
  createdBy,
  createdAt,
  isAudited,
  auditedBy,
  auditedAt
}: PrintTemplateProps) {
  // Extract date components safely without timezone shift
  const auditDateParts = (() => {
    const parseString = (str?: string) => {
      if (!str) return null;
      const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) {
        return {
          year: parseInt(m[1], 10),
          month: parseInt(m[2], 10),
          day: parseInt(m[3], 10)
        };
      }
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate()
        };
      }
      return null;
    };

    if (auditedAt) {
      const res = parseString(auditedAt);
      if (res) return res;
    }
    if (isAudited) {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate()
      };
    }
    if (date) {
      const res = parseString(date);
      if (res) return res;
    }
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate()
    };
  })();

  const dayNum = auditDateParts.day;
  // If even day -> tilt right (+11deg), odd day -> tilt left (-11deg)
  const stampRotationDeg = dayNum % 2 === 0 ? 11 : -11;
  const auditDateFormatted = `${String(auditDateParts.year)}-${String(auditDateParts.month).padStart(2, '0')}-${String(auditDateParts.day).padStart(2, '0')}`;

  const [printTimestamp] = React.useState(() => {
    const now = new Date();
    const dateFormatted = now.toISOString().split('T')[0];
    const timeFormatted = now.toLocaleTimeString('ar-YE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return `${dateFormatted} - ${timeFormatted}`;
  });

  return (
    <div className="print-area-wrapper print-area bg-white p-2 sm:p-4 text-slate-900 font-sans relative overflow-hidden" dir="rtl">
      {/* ================= ELEGANT WATERMARK ================= */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        aria-hidden="true"
      >
        {company?.logo ? (
          <img
            src={company.logo}
            alt=""
            className="w-72 h-72 sm:w-80 sm:h-80 object-contain pointer-events-none transform -rotate-12"
            style={{
              filter: 'grayscale(15%)',
              opacity: 0.07,
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          />
        ) : (
          <div 
            className="flex flex-col items-center justify-center pointer-events-none transform -rotate-12"
            style={{ opacity: 0.05, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            <span className="text-3xl sm:text-4xl font-black tracking-widest text-[#d4af37] font-serif uppercase">
              {company?.name || "قاعة الزين الكبرى"}
            </span>
          </div>
        )}
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-2 print:mb-1 border-b border-slate-200 pb-2">
          {/* Right: Company Branding */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight">{company?.name || 'قاعة الزين الكبرى'}</h1>
              <p className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 mt-0.5 tracking-wide">{company?.notes || 'رؤية جديدة في التميز والدقة'}</p>
            </div>
            {company?.logo && (
              <img src={company.logo} alt="Logo" className="h-12 w-12 sm:h-14 sm:w-14 object-contain bg-black p-1 rounded-sm" />
            )}
          </div>

          {/* Left Card: Document Info */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm min-w-[170px]">
            <h2 className="text-base sm:text-lg font-black text-slate-900 mb-0.5">{title}</h2>
            <div className="space-y-0.5">
              {documentNumber && (
                <p className="text-[9px] sm:text-[10px] font-black text-slate-700">
                  {documentLabel} <span className="font-mono text-red-600 font-black ml-1" style={{ color: '#dc2626', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{documentNumber}</span>
                </p>
              )}
              {manualNumber && (
                <p className="text-[9px] sm:text-[10px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                  رقم السند اليدوي: <span className="font-mono text-emerald-800 ml-1 font-bold">{manualNumber}</span>
                </p>
              )}
              {bookingNumber && (
                <p className="text-[9px] sm:text-[10px] font-black text-slate-700">
                  رقم الحجز: <span className="font-mono text-red-600 font-black ml-1" style={{ color: '#dc2626', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{bookingNumber}</span>
                </p>
              )}
              {date && (
                <p className="text-[8.5px] sm:text-[9.5px] font-bold text-slate-500">التاريخ: {(date || '').split(/[\sT]/)[0]}</p>
              )}
              {createdAt && (
                <p className="text-[8.5px] sm:text-[9.5px] font-bold text-slate-500">وقت التسجيل: <span className="font-mono ml-1">{new Date(createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</span></p>
              )}
              {createdBy && (
                <p className="text-[8.5px] sm:text-[9.5px] font-bold text-slate-500">المستخدم: {createdBy}</p>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-2 print:py-1">
          {children}
        </div>

        {/* Footer Area */}
        <div className="mt-3 print:mt-2">
          {/* Contact Info Bar */}
          {(company?.phone || company?.address) && (
            <div className="flex flex-col items-end text-[9px] sm:text-[10px] font-bold text-slate-700 space-y-0.5 mb-2 print:mb-1">
              {company?.phone && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-950" dir="ltr">{company.phone}</span>
                  <Phone className="h-3.5 w-3.5 text-slate-900" />
                </div>
              )}
              {company?.address && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-950">{company.address}</span>
                  <MapPin className="h-3.5 w-3.5 text-slate-900" />
                </div>
              )}
            </div>
          )}

          {/* Official Signatures and Stamp Section */}
          <div className="grid grid-cols-2 pt-3 mt-2 border-t border-slate-300 text-center text-[10.5px] font-black">
            {/* Preparer Signature */}
            <div className="space-y-2">
              <p className="text-slate-700">المحاسب / منظم الحركة</p>
              <div className="h-16 flex items-center justify-center">
                <p className="font-mono text-slate-400">....................................</p>
              </div>
            </div>

            {/* Manager Signature & Official Stamp */}
            <div className="space-y-2 relative">
              <p className="text-slate-700 relative z-10">المدير المسؤول / الختم الرسمي</p>
              <div className="h-16 flex flex-col items-center justify-center relative">
                {/* Stamp placed behind the text and dotted line */}
                {isAudited && company?.stamp && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
                    style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <div
                      className="relative w-24 h-24 sm:w-26 sm:h-26 flex items-center justify-center pointer-events-none select-none"
                      style={{
                        transform: `rotate(${stampRotationDeg}deg)`,
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    >
                      <img
                        src={company.stamp}
                        alt="الختم الرسمي"
                        className="w-full h-full object-contain pointer-events-none mix-blend-multiply opacity-95"
                        style={{
                          mixBlendMode: 'multiply',
                          filter: 'contrast(1.05)',
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                        }}
                      />
                      {/* Red Pure Audit Date inside the stamp's designated bottom rectangle box */}
                      <div 
                        className="absolute bottom-[11.5%] left-1/2 -translate-x-1/2 flex items-center justify-center text-center font-mono font-black"
                        style={{
                          color: '#dc2626',
                          fontSize: '7.5px',
                          lineHeight: '1',
                          letterSpacing: '-0.3px',
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                        }}
                      >
                        {auditDateFormatted}
                      </div>
                    </div>
                  </div>
                )}
                <p className="font-mono text-slate-400 relative z-10">....................................</p>
                {isAudited && (
                  <span 
                    className="text-[8px] font-black text-emerald-800 dark:text-emerald-700 mt-1 tracking-tight relative z-10"
                    style={{ color: '#065f46', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    ✓ تم التدقيق والاعتماد {auditedBy ? `(${auditedBy})` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Footer Bar: User Name & Print Date and Time - In foreground (z-20) above stamp and line */}
          <div 
            className="flex justify-between items-center pt-2 mt-2 border-t border-slate-300 text-[8px] font-bold text-slate-700 print:text-slate-900 relative z-20"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            <div className="flex items-center gap-1">
              <span>طُبع بواسطة:</span>
              <strong className="text-slate-950 font-black">{createdBy || 'المسؤول المالي'}</strong>
            </div>
            <div className="flex items-center gap-1 font-mono" dir="ltr">
              <span>{printTimestamp}</span>
              <span className="font-sans">:تاريخ ووقت الطباعة</span>
            </div>
          </div>

          {/* System Line */}
          <div className="text-center pt-1">
            <p className="text-[7.5px] text-slate-400 font-bold tracking-widest">نظام "إتقان المحاسبي" لإدارة القاعات والفعاليات - تم التصدير إلكترونياً</p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 6mm 10mm; 
          }
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body, #root, main {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body > *:not(#generic-print-portal):not(#official-voucher-print-portal):not(#financial-reports-print-portal):not(#official-discount-print-portal) {
            display: none !important;
          }
          .no-print {
            display: none !important;
          }
          #generic-print-portal {
            display: block !important;
            position: static !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
            z-index: 2147483647 !important;
          }
          #generic-print-portal * {
            visibility: visible !important;
          }
          #generic-print-portal > div {
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          #generic-print-template-container {
            display: block !important;
            position: static !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-area-wrapper {
            position: relative !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            display: block !important;
            visibility: visible !important;
          }
          .print-area-wrapper * {
            visibility: visible !important;
          }
          .print-area {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-area table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
        }
      `}} />
    </div>
  );
}

