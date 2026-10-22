import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Laptop,
  Smartphone,
  Tablet,
  ShieldCheck,
  ShieldAlert,
  Search,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Clock,
  UserCheck,
  Users,
  AlertTriangle,
  Monitor,
  HardDrive,
  Info,
  Radio,
  Lock,
  Unlock,
  Key
} from "lucide-react";
import { AuthorizedDevice, User as UserType } from "../types";
import {
  subscribeDevices,
  addDevice,
  updateDevice,
  deleteDevice,
  authorizeDeviceInCloudAndLocal,
  fetchAndSaveDeviceCloudLicense,
} from "../lib/dbService";
import { toast } from "sonner";

interface DeviceLicensesManagementProps {
  users: UserType[];
}

export default function DeviceLicensesManagement({ users }: DeviceLicensesManagementProps) {
  const [devices, setDevices] = useState<AuthorizedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "authorized" | "pending">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "desktop" | "mobile" | "tablet">("all");
  
  // Modals & Editing
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AuthorizedDevice | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    id: "",
    deviceName: "",
    deviceType: "desktop" as "desktop" | "mobile" | "tablet",
    isAuthorized: true,
    adminNotes: "",
    allowedUserIds: [] as string[],
  });

  // Current Device Info
  const currentDeviceId = typeof window !== "undefined" ? localStorage.getItem("accounting_device_uuid") || "" : "";

  useEffect(() => {
    const unsub = subscribeDevices((data) => {
      setDevices(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("تم نسخ معرّف الجهاز بنجاح");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleAuthorize = async (device: AuthorizedDevice) => {
    try {
      const nextStatus = !device.isAuthorized;
      if (nextStatus && device.id === currentDeviceId) {
        await authorizeDeviceInCloudAndLocal(device.id, device.deviceName);
      } else {
        await updateDevice(device.id, {
          isAuthorized: nextStatus,
          lastActive: new Date().toISOString(),
        });
      }
      toast.success(nextStatus ? `تم ترخيص الجهاز: ${device.deviceName}` : `تم إلغاء ترخيص الجهاز: ${device.deviceName}`);
    } catch (e: any) {
      toast.error("فشل تحديث ترخيص الجهاز: " + (e?.message || "خطأ غير معروف"));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الجهاز "${name}" نهائياً من قائمة التراخيص؟`)) {
      return;
    }
    try {
      await deleteDevice(id);
      toast.success("تم حذف الجهاز بنجاح");
    } catch (e: any) {
      toast.error("فشل حذف الجهاز: " + (e?.message || "خطأ غير معروف"));
    }
  };

  const handleSyncCurrentDevice = async () => {
    setIsSyncing(true);
    try {
      if (!currentDeviceId) {
        toast.error("لم يتم العثور على معرّف الجهاز الحالي");
        return;
      }
      const res = await fetchAndSaveDeviceCloudLicense(currentDeviceId);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.info(res.message);
      }
    } catch (e: any) {
      toast.error("حدث خطأ أثناء المزامنة: " + (e?.message || ""));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAuthorizeCurrentDeviceNow = async () => {
    if (!currentDeviceId) {
      toast.error("لا يمكن تحديد معرف الجهاز الحالي!");
      return;
    }
    try {
      await authorizeDeviceInCloudAndLocal(currentDeviceId, "جهاز الإدارة الحالي");
      toast.success("تم ترخيص هذا الجهاز بنجاح في السحابة والمحلي!");
    } catch (e: any) {
      toast.error("تعذر الترخيص التلقائي: " + (e?.message || ""));
    }
  };

  const openAddModal = () => {
    setFormData({
      id: "",
      deviceName: "",
      deviceType: "desktop",
      isAuthorized: true,
      adminNotes: "",
      allowedUserIds: [],
    });
    setEditingDevice(null);
    setShowAddModal(true);
  };

  const openEditModal = (device: AuthorizedDevice) => {
    setEditingDevice(device);
    setFormData({
      id: device.id,
      deviceName: device.deviceName,
      deviceType: (device.deviceType as any) || "desktop",
      isAuthorized: device.isAuthorized,
      adminNotes: device.adminNotes || "",
      allowedUserIds: device.allowedUserIds || [],
    });
    setShowAddModal(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.deviceName.trim()) {
      toast.error("يرجى إدخال معرّف الجهاز واسم الجهاز");
      return;
    }

    try {
      if (editingDevice) {
        await updateDevice(editingDevice.id, {
          deviceName: formData.deviceName,
          deviceType: formData.deviceType,
          isAuthorized: formData.isAuthorized,
          adminNotes: formData.adminNotes,
          allowedUserIds: formData.allowedUserIds,
        });
        toast.success("تم تحديث بيانات ترخيص الجهاز بنجاح");
      } else {
        const newDevice: AuthorizedDevice = {
          id: formData.id.trim(),
          deviceName: formData.deviceName.trim(),
          deviceType: formData.deviceType,
          isAuthorized: formData.isAuthorized,
          userAgent: navigator.userAgent,
          registeredAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          adminNotes: formData.adminNotes,
          allowedUserIds: formData.allowedUserIds,
          tamperCount: 0,
        };
        await addDevice(newDevice);
        toast.success("تمت إضافة الجهاز الجديد لقائمة التراخيص");
      }
      setShowAddModal(false);
    } catch (e: any) {
      toast.error("فشل حفظ الجهاز: " + (e?.message || ""));
    }
  };

  const toggleUserInAllowed = (userId: string) => {
    setFormData((prev) => {
      const exists = prev.allowedUserIds.includes(userId);
      return {
        ...prev,
        allowedUserIds: exists
          ? prev.allowedUserIds.filter((id) => id !== userId)
          : [...prev.allowedUserIds, userId],
      };
    });
  };

  // Filtered devices
  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      (d.deviceName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.adminNotes || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "authorized" && d.isAuthorized) ||
      (statusFilter === "pending" && !d.isAuthorized);

    const matchesType = typeFilter === "all" || d.deviceType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const authorizedCount = devices.filter((d) => d.isAuthorized).length;
  const pendingCount = devices.filter((d) => !d.isAuthorized).length;
  const isCurrentDeviceRegistered = devices.some((d) => d.id === currentDeviceId);
  const currentDeviceObj = devices.find((d) => d.id === currentDeviceId);

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Top Banner / Current Device Status */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-indigo-900/50 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Laptop className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-white">إدارة وتراخيص الأجهزة السحابية</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  الحماية المتقدمة
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                تحكم كامل في الأجهزة المصرح لها بالاتصال بالنظام المحاسبي، ربط الأجهزة بمستخدمين محددين، ومنع أي دخول عشوائي لحماية القيود المالية الحساسة.
              </p>
            </div>
          </div>

          {/* Current Device Quick Status Card */}
          <div className="w-full lg:w-auto bg-slate-950/70 backdrop-blur border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-bold">حالة هذا الجهاز الحالي:</span>
                {currentDeviceObj?.isAuthorized ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> مرخص بالكامل
                  </span>
                ) : isCurrentDeviceRegistered ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    <Clock className="h-3.5 w-3.5" /> بانتظار الترخيص
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                    <XCircle className="h-3.5 w-3.5" /> غير مسجل
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-slate-400 select-all truncate max-w-xs">
                {currentDeviceId || "جاري الكشف عن الجهاز..."}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {currentDeviceId && (
                <button
                  type="button"
                  onClick={() => handleCopy(currentDeviceId)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="نسخ معرف الجهاز الحالي"
                >
                  {copiedId === currentDeviceId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>نسخ</span>
                </button>
              )}
              {(!currentDeviceObj || !currentDeviceObj.isAuthorized) && (
                <button
                  type="button"
                  onClick={handleAuthorizeCurrentDeviceNow}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-900/30"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>ترخيص هذا الجهاز فوراً</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSyncCurrentDevice}
                disabled={isSyncing}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="مزامنة ترخيص هذا الجهاز مع السحابة"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-indigo-400" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-indigo-900/40">
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-indigo-900/30">
            <div className="text-[11px] text-slate-400 font-bold mb-1">إجمالي الأجهزة المسجلة</div>
            <div className="text-xl font-black text-white">{devices.length}</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-indigo-900/30">
            <div className="text-[11px] text-emerald-400 font-bold mb-1">الأجهزة المرخصة والمفعلة</div>
            <div className="text-xl font-black text-emerald-400">{authorizedCount}</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-indigo-900/30">
            <div className="text-[11px] text-amber-400 font-bold mb-1">الأجهزة المعلقة / قيد الطلب</div>
            <div className="text-xl font-black text-amber-400">{pendingCount}</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-indigo-900/30">
            <div className="text-[11px] text-indigo-400 font-bold mb-1">المستخدمين المربوطين</div>
            <div className="text-xl font-black text-indigo-300">{users.length}</div>
          </div>
        </div>
      </div>

      {/* Control Bar & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم الجهاز، المعرّف، أو الملاحظات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === "all" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              الكل ({devices.length})
            </button>
            <button
              onClick={() => setStatusFilter("authorized")}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === "authorized" ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              مرخص ({authorizedCount})
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === "pending" ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              معلق ({pendingCount})
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">كل الأنواع</option>
            <option value="desktop">أجهزة كمبيوتر</option>
            <option value="mobile">هواتف ذكية</option>
            <option value="tablet">أجهزة لوحية</option>
          </select>

          {/* Add Device Button */}
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 mr-auto md:mr-0"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة جهاز يدوياً</span>
          </button>
        </div>
      </div>

      {/* Devices List / Cards */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-bold">جاري تحميل قائمة الأجهزة المرخصة...</p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-200 dark:border-indigo-900/40">
            <Laptop className="h-8 w-8" />
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-white">لم يتم العثور على أي أجهزة مطابقة</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            يمكنك تسجيل جهاز جديد يدوياً أو تفعيل طلبات الأجهزة الجديدة بمجرد اتصالها بالنظام.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredDevices.map((device) => {
              const isCurrent = device.id === currentDeviceId;
              const hasUserRestrictions = device.allowedUserIds && device.allowedUserIds.length > 0;

              return (
                <motion.div
                  key={device.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all shadow-sm flex flex-col justify-between overflow-hidden relative ${
                    isCurrent
                      ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-indigo-500/10"
                      : device.isAuthorized
                      ? "border-slate-200 dark:border-slate-800"
                      : "border-amber-300 dark:border-amber-900/50 bg-amber-500/5"
                  }`}
                >
                  {/* Top Bar Indicator */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                            device.deviceType === "mobile"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                              : device.deviceType === "tablet"
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                              : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                          }`}
                        >
                          {device.deviceType === "mobile" ? (
                            <Smartphone className="h-5 w-5" />
                          ) : device.deviceType === "tablet" ? (
                            <Tablet className="h-5 w-5" />
                          ) : (
                            <Laptop className="h-5 w-5" />
                          )}
                        </div>

                        <div className="overflow-hidden">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
                              {device.deviceName}
                            </h4>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-indigo-500 text-white shrink-0">
                                هذا الجهاز
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                            {device.os || "نظام التشغيل غير محدد"} • {device.browser || "متصفح الويب"}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
                          device.isAuthorized
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {device.isAuthorized ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> مرخص ومفعل
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" /> معلق / محظور
                          </>
                        )}
                      </span>
                    </div>

                    {/* Device UUID */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-2.5 flex items-center justify-between gap-2 border border-slate-200/80 dark:border-slate-700/60 mb-3">
                      <div className="overflow-hidden">
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">معرف البصمة الرقمية (UUID)</div>
                        <div className="font-mono text-[10px] text-slate-700 dark:text-slate-300 font-semibold truncate select-all">
                          {device.id}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(device.id)}
                        className="p-1.5 rounded-xl bg-white dark:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-600 transition shrink-0 cursor-pointer shadow-xs"
                        title="نسخ المعرف"
                      >
                        {copiedId === device.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {/* Allowed Users Section */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                          <Users className="h-3 w-3" /> المستخدمون المصرح لهم:
                        </span>
                        {hasUserRestrictions ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            {device.allowedUserIds?.length} مستخدمين محددين
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            مفتوح لجميع موظفي النظام
                          </span>
                        )}
                      </div>

                      {hasUserRestrictions && (
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-1">
                          {device.allowedUserIds?.map((uid) => {
                            const u = users.find((user) => user.id === uid);
                            return (
                              <span
                                key={uid}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              >
                                <UserCheck className="h-2.5 w-2.5 text-indigo-500" />
                                {u ? u.name || u.username : uid.substring(0, 8)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Specs & Hardware */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div>
                        <span className="block font-bold text-slate-400 dark:text-slate-500">دقة الشاشة:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {device.screenResolution || "غير محددة"}
                        </span>
                      </div>
                      <div>
                        <span className="block font-bold text-slate-400 dark:text-slate-500">آخر اتصال:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {device.lastActive ? new Date(device.lastActive).toLocaleDateString("ar-EG") : "—"}
                        </span>
                      </div>
                    </div>

                    {device.adminNotes && (
                      <div className="mt-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400">
                        <span className="font-bold text-slate-500 dark:text-slate-400 ml-1">ملاحظة:</span>
                        {device.adminNotes}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAuthorize(device)}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                        device.isAuthorized
                          ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                      }`}
                    >
                      {device.isAuthorized ? (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          <span>إلغاء الترخيص</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="h-3.5 w-3.5" />
                          <span>منح الترخيص الآن</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(device)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      title="تعديل الجهاز والصلاحيات"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(device.id, device.deviceName)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      title="حذف الجهاز"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  {editingDevice ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-black text-sm md:text-base text-slate-900 dark:text-white">
                    {editingDevice ? "تعديل ترخيص الجهاز" : "تسجيل جهاز جديد يدوياً"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    أدخل تفاصيل الجهاز وحدد المستخدمين المسموح لهم بالدخول من خلاله
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-4">
              {/* Device ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  معرّف الجهاز (UUID) <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    readOnly={Boolean(editingDevice)}
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    placeholder="DEV-WIN-CHR-1920X1080-..."
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {!editingDevice && currentDeviceId && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, id: currentDeviceId })}
                      className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold shrink-0 hover:bg-indigo-100 cursor-pointer"
                    >
                      جلب هذا الجهاز
                    </button>
                  )}
                </div>
              </div>

              {/* Device Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الجهاز التوضيحي <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.deviceName}
                  onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                  placeholder="مثال: لابتوب المحاسب الرئيسي، هاتف المدير العام"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Device Type & Authorization Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوع الجهاز
                  </label>
                  <select
                    value={formData.deviceType}
                    onChange={(e) => setFormData({ ...formData, deviceType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="desktop">حاسوب مكتبي / محمول</option>
                    <option value="mobile">هاتف محمول</option>
                    <option value="tablet">جهاز لوحي (تابلت)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حالة الترخيص
                  </label>
                  <select
                    value={formData.isAuthorized ? "true" : "false"}
                    onChange={(e) => setFormData({ ...formData, isAuthorized: e.target.value === "true" })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="true">مرخص ومسموح بالدخول</option>
                    <option value="false">معلق / محظور من الدخول</option>
                  </select>
                </div>
              </div>

              {/* Allowed Users Multi-Select */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    تقييد الدخول لمستخدمين محددين (اختياري)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {formData.allowedUserIds.length === 0 ? "متاح للجميع" : `${formData.allowedUserIds.length} مستخدمين`}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mb-2">
                  إذا تركت القائمة فارغة، يستطيع أي مستخدم يملك حساباً الدخول من هذا الجهاز. إذا اخترت مستخدمين معينين، سيقتصر الدخول عليهم فقط.
                </p>

                <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                  {users.map((u) => {
                    const isChecked = formData.allowedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition ${
                          isChecked
                            ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                            : "hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleUserInAllowed(u.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span className="font-bold">{u.name || u.username}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{u.email}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات إدارية (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={formData.adminNotes}
                  onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
                  placeholder="مثال: جهاز كاشير صالة الأفراح - دوام مسائي فقط..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {editingDevice ? "حفظ التعديلات" : "إضافة وترخيص"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
