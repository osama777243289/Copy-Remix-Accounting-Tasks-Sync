import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Save, Upload, MapPin, Phone, Mail, Globe, Hash, FileText, Smartphone, Image as ImageIcon, Trash2, AlertCircle, Link2, Loader2, Award } from 'lucide-react';
import { toast } from 'sonner';
import { CompanySettings as CompanyType } from '../types';

interface CompanySettingsProps {
  settings: CompanyType | null;
  onSave: (data: Partial<CompanyType>) => void;
}

export default function CompanySettings({ settings, onSave }: CompanySettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const stampFileInputRef = useRef<HTMLInputElement>(null);
  const [stampLoadError, setStampLoadError] = useState(false);
  const [isProcessingStamp, setIsProcessingStamp] = useState(false);
  const [showStampUrlInput, setShowStampUrlInput] = useState(false);

  const [formData, setFormData] = useState<Partial<CompanyType>>(settings || {
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    taxNumber: '',
    crNumber: '',
    notes: '',
    logo: '',
    stamp: '',
    offlineAllowedTasks: []
  });

  useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        ...settings,
      }));
      setLogoLoadError(false);
      setStampLoadError(false);
    }
  }, [settings]);

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح لختم الشركة (PNG, JPG, WEBP, SVG)');
      return;
    }

    setIsProcessingStamp(true);
    setStampLoadError(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawBase64 = event.target?.result as string;
      if (!rawBase64) {
        setIsProcessingStamp(false);
        return;
      }

      const img = new Image();
      img.src = rawBase64;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const isPng = file.type.includes('png');
            const optimizedBase64 = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.85);
            setFormData(p => ({ ...p, stamp: optimizedBase64 }));
            setStampLoadError(false);
            toast.success('تم تحميل صورة ختم الشركة بنجاح! اضغط حفظ البيانات لتخزينه');
          }
        } catch (err) {
          console.error(err);
          if (rawBase64.length < 500000) {
            setFormData(p => ({ ...p, stamp: rawBase64 }));
            setStampLoadError(false);
          } else {
            toast.error('حجم صورة الختم كبير جداً، يرجى اختيار صورة أصغر');
          }
        } finally {
          setIsProcessingStamp(false);
        }
      };
      img.onerror = () => {
        toast.error('تعذر قراءة ملف صورة الختم');
        setIsProcessingStamp(false);
      };
    };
    reader.onerror = () => {
      toast.error('حدث خطأ أثناء قراءة الملف');
      setIsProcessingStamp(false);
    };
    reader.readAsDataURL(file);

    if (stampFileInputRef.current) {
      stampFileInputRef.current.value = '';
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP, SVG)');
      return;
    }

    setIsProcessingLogo(true);
    setLogoLoadError(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawBase64 = event.target?.result as string;
      if (!rawBase64) {
        setIsProcessingLogo(false);
        return;
      }

      const img = new Image();
      img.src = rawBase64;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 450;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const isPng = file.type.includes('png');
            const optimizedBase64 = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.85);
            setFormData(p => ({ ...p, logo: optimizedBase64 }));
            setLogoLoadError(false);
            toast.success('تم تحميل الشعار بنجاح! اضغط حفظ التغييرات لاعتماده');
          }
        } catch (err) {
          console.error(err);
          // Fallback to raw base64 if small enough
          if (rawBase64.length < 500000) {
            setFormData(p => ({ ...p, logo: rawBase64 }));
            setLogoLoadError(false);
          } else {
            toast.error('حجم الصورة كبير جداً، يرجى اختيار صورة أصغر');
          }
        } finally {
          setIsProcessingLogo(false);
        }
      };
      img.onerror = () => {
        toast.error('تعذر قراءة ملف الصورة');
        setIsProcessingLogo(false);
      };
    };
    reader.onerror = () => {
      toast.error('حدث خطأ أثناء قراءة الملف');
      setIsProcessingLogo(false);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const availableTasks = [
    { id: 'BookingCollections', label: 'إدارة الحجوزات' },
    { id: 'ReceiptsPayments', label: 'سندات القبض والصرف' },
    { id: 'ClientsManagement', label: 'إدارة العملاء' },
    { id: 'TasksGrid', label: 'المهام' },
  ];
  
  const toggleTask = (taskId: string) => {
    setFormData(p => {
      const currentTasks = p.offlineAllowedTasks || [];
      const newTasks = currentTasks.includes(taskId)
        ? currentTasks.filter(t => t !== taskId)
        : [...currentTasks, taskId];
      return { ...p, offlineAllowedTasks: newTasks };
    });
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <Building2 className="h-8 w-8 text-indigo-500" />
          بيانات الشركة والملف التعريفي
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">هذه البيانات ستظهر في جميع التقارير وسندات القبض والصرف الرسمية</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Upload className="h-4 w-4 text-indigo-500" />
              شعار الشركة (Logo)
            </h3>
            
            {/* Hidden native file input for picking images directly from phone/PC */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="flex flex-col items-center">
              {/* Logo Preview Frame - click to upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-44 h-44 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-500 flex items-center justify-center overflow-hidden mb-3 group relative cursor-pointer shadow-inner transition-all"
                title="اضغط لاختيار صورة من جهازك"
              >
                {isProcessingLogo ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-indigo-500">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-[10px] font-bold">جاري معالجة الشعار...</span>
                  </div>
                ) : formData.logo && !logoLoadError ? (
                  <img
                    src={formData.logo}
                    alt="Logo"
                    onError={() => setLogoLoadError(true)}
                    className="w-full h-full object-contain p-3 transition-transform group-hover:scale-105"
                  />
                ) : logoLoadError ? (
                  <div className="flex flex-col items-center justify-center p-3 text-center">
                    <AlertCircle className="h-10 w-10 text-amber-500 mb-1" />
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      الرابط غير صالح أو ليس صورة مباشرة
                    </p>
                    <span className="text-[9px] text-slate-400 mt-1">اضغط لاختيار صورة من جهازك</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors">
                    <Building2 className="h-14 w-14 mb-1" />
                    <span className="text-[10px] font-bold text-slate-400">اضغط لاختيار الشعار</span>
                  </div>
                )}

                {/* Hover overlay on desktop */}
                {!isProcessingLogo && (
                  <div className="absolute inset-0 bg-indigo-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-xs text-white">
                    <Upload className="h-6 w-6 mb-1" />
                    <span className="text-[11px] font-black">اختيار صورة من الجهاز</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingLogo}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  <span>اختيار صورة من الجهاز / الجوال</span>
                </button>

                {formData.logo && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(p => ({ ...p, logo: '' }));
                      setLogoLoadError(false);
                      toast.info('تمت إزالة الشعار');
                    }}
                    className="w-full text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>حذف الشعار الحالي</span>
                  </button>
                )}

                {/* Toggle URL input if user still wants it */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="w-full text-[10px] font-bold text-slate-400 hover:text-indigo-500 flex items-center justify-center gap-1 transition-colors"
                  >
                    <Link2 className="h-3 w-3" />
                    <span>{showUrlInput ? 'إخفاء خيار الرابط' : 'أو إدخال رابط خارجي (URL)'}</span>
                  </button>

                  {showUrlInput && (
                    <div className="mt-2 space-y-1">
                      <input
                        type="text"
                        placeholder="https://example.com/logo.png"
                        value={formData.logo || ''}
                        onChange={e => {
                          setFormData(p => ({ ...p, logo: e.target.value }));
                          setLogoLoadError(false);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 text-center font-mono"
                      />
                      <p className="text-[9px] text-slate-400 text-center">يجب أن يكون رابطاً مباشراً لملف صورة (مثل .png أو .jpg)</p>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-3 text-center">
                يفضل استخدام شعار بخلفية شفافة (PNG) بدقة مناسبة
              </p>
            </div>
          </div>

          {/* Stamp Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-500" />
              ختم الشركة الرسمي (Company Stamp)
            </h3>
            
            {/* Hidden native file input for picking stamp image directly from phone/PC */}
            <input
              type="file"
              ref={stampFileInputRef}
              onChange={handleStampUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="flex flex-col items-center">
              {/* Stamp Preview Frame - click to upload */}
              <div
                onClick={() => stampFileInputRef.current?.click()}
                className="w-44 h-44 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-500 flex items-center justify-center overflow-hidden mb-3 group relative cursor-pointer shadow-inner transition-all"
                title="اضغط لاختيار صورة الختم من جهازك"
              >
                {isProcessingStamp ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-emerald-500">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-[10px] font-bold">جاري معالجة الختم...</span>
                  </div>
                ) : formData.stamp && !stampLoadError ? (
                  <img
                    src={formData.stamp}
                    alt="Stamp"
                    onError={() => setStampLoadError(true)}
                    className="w-full h-full object-contain p-3 transition-transform group-hover:scale-105"
                  />
                ) : stampLoadError ? (
                  <div className="flex flex-col items-center justify-center p-3 text-center">
                    <AlertCircle className="h-10 w-10 text-amber-500 mb-1" />
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      الرابط غير صالح أو ليس صورة مباشرة
                    </p>
                    <span className="text-[9px] text-slate-400 mt-1">اضغط لاختيار صورة الختم من جهازك</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors">
                    <Award className="h-14 w-14 mb-1 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-400">اضغط لاختيار صورة الختم</span>
                  </div>
                )}

                {/* Hover overlay on desktop */}
                {!isProcessingStamp && (
                  <div className="absolute inset-0 bg-emerald-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-xs text-white">
                    <Upload className="h-6 w-6 mb-1" />
                    <span className="text-[11px] font-black">اختيار صورة الختم</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={() => stampFileInputRef.current?.click()}
                  disabled={isProcessingStamp}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  <span>اختيار صورة الختم من الجهاز / الجوال</span>
                </button>

                {formData.stamp && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(p => ({ ...p, stamp: '' }));
                      setStampLoadError(false);
                      toast.info('تمت إزالة صورة الختم');
                    }}
                    className="w-full text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>حذف الختم الحالي</span>
                  </button>
                )}

                {/* Toggle URL input for stamp */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowStampUrlInput(!showStampUrlInput)}
                    className="w-full text-[10px] font-bold text-slate-400 hover:text-emerald-600 flex items-center justify-center gap-1 transition-colors"
                  >
                    <Link2 className="h-3 w-3" />
                    <span>{showStampUrlInput ? 'إخفاء خيار الرابط' : 'أو إدخال رابط خارجي للختم'}</span>
                  </button>

                  {showStampUrlInput && (
                    <div className="mt-2 space-y-1">
                      <input
                        type="text"
                        placeholder="https://example.com/stamp.png"
                        value={formData.stamp || ''}
                        onChange={e => {
                          setFormData(p => ({ ...p, stamp: e.target.value }));
                          setStampLoadError(false);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 text-center font-mono"
                      />
                      <p className="text-[9px] text-slate-400 text-center">يفضل صورة دائرية مفرغة بخلفية شفافة (PNG)</p>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-3 text-center">
                يفضل استخدام صورة ختم مفرغة بدون خلفية (PNG)
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 mr-1">اسم المؤسسة / الشركة</label>
                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={formData.name || ""}
                    onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                    placeholder="مثال: شركة النور لتنظيم الفعاليات"
                  />
                  <Building2 className="absolute right-4 top-4 h-5 w-5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2 mr-1">
                  رقم الجوال / الهاتف (المعتمد في السندات والعقود الرسمية)
                </label>
                <div className="relative">
                  <input 
                    type="text"
                    value={formData.phone || ""}
                    onChange={e => setFormData(p => ({...p, phone: e.target.value}))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-indigo-500 text-left font-mono"
                    placeholder="770 000 000"
                  />
                  <Smartphone className="absolute right-4 top-4 h-5 w-5 text-indigo-500" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 mr-1">هذا الرقم سيظهر في ترويسة السندات الرسمية وعقد الحجز عند الطباعة</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 mr-1">البريد الإلكتروني</label>
                <div className="relative">
                  <input 
                    type="email"
                    value={formData.email || ""}
                    onChange={e => setFormData(p => ({...p, email: e.target.value}))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-indigo-500 text-left"
                    placeholder="info@company.com"
                  />
                  <Mail className="absolute right-4 top-4 h-5 w-5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 mr-1">الرقم الضريبي</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={formData.taxNumber || ""}
                    onChange={e => setFormData(p => ({...p, taxNumber: e.target.value}))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                    placeholder="300000000000003"
                  />
                  <Hash className="absolute right-4 top-4 h-5 w-5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 mr-1">رقم السجل التجاري</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={formData.crNumber || ""}
                    onChange={e => setFormData(p => ({...p, crNumber: e.target.value}))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                    placeholder="1010000000"
                  />
                  <FileText className="absolute right-4 top-4 h-5 w-5 text-slate-400" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 mr-1">الموقع الإلكتروني</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={formData.website || ""}
                    onChange={e => setFormData(p => ({...p, website: e.target.value}))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-indigo-500 text-left"
                    placeholder="www.company.com"
                  />
                  <Globe className="absolute right-4 top-4 h-5 w-5 text-slate-400" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 mr-1">العنوان بالتفصيل</label>
                <div className="relative">
                  <textarea 
                    rows={3}
                    value={formData.address || ""}
                    onChange={e => setFormData(p => ({...p, address: e.target.value}))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="الجمهورية اليمنية، صنعاء، حي حدة..."
                  />
                  <MapPin className="absolute right-4 top-4 h-5 w-5 text-slate-400" />
                </div>
              </div>

              <div className="md:col-span-2 mt-4 bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl">
                <label className="text-xs font-black text-slate-800 dark:text-white block mb-4">بداية تسلسل أرقام المستندات:</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-2">عقود الحجوزات (BOK)</label>
                    <input 
                      type="number"
                      min="1"
                      value={formData.sequenceStarts?.booking || 1}
                      onChange={e => setFormData(p => ({
                        ...p, 
                        sequenceStarts: { ...p.sequenceStarts, booking: parseInt(e.target.value) || 1 } as any
                      }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-2">سندات القبض (REC)</label>
                    <input 
                      type="number"
                      min="1"
                      value={formData.sequenceStarts?.receipt || 1}
                      onChange={e => setFormData(p => ({
                        ...p, 
                        sequenceStarts: { ...p.sequenceStarts, receipt: parseInt(e.target.value) || 1 } as any
                      }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-2">سندات الصرف (PAY)</label>
                    <input 
                      type="number"
                      min="1"
                      value={formData.sequenceStarts?.payment || 1}
                      onChange={e => setFormData(p => ({
                        ...p, 
                        sequenceStarts: { ...p.sequenceStarts, payment: parseInt(e.target.value) || 1 } as any
                      }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-2">قيود اليومية (JRN)</label>
                    <input 
                      type="number"
                      min="1"
                      value={formData.sequenceStarts?.journal || 1}
                      onChange={e => setFormData(p => ({
                        ...p, 
                        sequenceStarts: { ...p.sequenceStarts, journal: parseInt(e.target.value) || 1 } as any
                      }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 mt-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 p-6 rounded-2xl">
                <label className="text-xs font-black text-amber-900 dark:text-amber-200 block mb-2">
                  🔒 تاريخ الإقفال المالي الشامل (قفل التواريخ السابقة):
                </label>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 font-medium">
                  أي سند أو حركة أو قيد أو حجز يقع في هذا التاريخ أو قبله سيتم إقفاله وحظره تماماً من الإضافة أو التعديل أو الحذف في كافة الشاشات.
                </p>
                <input 
                  type="date"
                  value={formData.masterLockDate || ""}
                  onChange={e => setFormData(p => ({ ...p, masterLockDate: e.target.value }))}
                  className="w-full md:w-1/2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl p-3 text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 text-center"
                />
              </div>

              <div className="md:col-span-2 mt-4 bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl">
                <label className="text-xs font-black text-slate-800 dark:text-white block mb-4">المهام المسموح بها في الوضع المحلي (Offline):</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {availableTasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className={`p-4 rounded-xl text-xs font-bold transition-all border ${
                        (formData.offlineAllowedTasks || []).includes(task.id)
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {task.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
               <motion.button 
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isSaving}
                className={`flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-10 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ بيانات الشركة'}
                <Save className="h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
