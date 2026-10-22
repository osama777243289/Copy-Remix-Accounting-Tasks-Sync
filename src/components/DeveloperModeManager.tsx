import React, { useState, useEffect } from "react";
import {
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  X,
  Terminal,
  Settings,
  Cloud,
  Link as LinkIcon,
  Bell,
  Smartphone,
  Laptop,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useBackButton } from "../lib/backButtonManager";

export const DEVELOPER_ONLY_VIEW_IDS = [
  "accounts-linking",
  "firebase-config",
  "notification-management",
  "notification-subscriptions",
  "device-guard",
  "android",
  "windows",
] as const;

export type DeveloperOnlyViewId = (typeof DEVELOPER_ONLY_VIEW_IDS)[number];

export function isDeveloperOnlyView(viewId: string): boolean {
  return (DEVELOPER_ONLY_VIEW_IDS as readonly string[]).includes(viewId);
}

const PIN_STORAGE_KEY = "muhasib_dev_pin_code";
const UNLOCKED_SESSION_KEY = "muhasib_dev_unlocked_session";

export function getStoredDeveloperPin(): string {
  try {
    const pin = localStorage.getItem(PIN_STORAGE_KEY);
    return pin && pin.trim().length > 0 ? pin.trim() : "123456789123456789";
  } catch {
    return "123456789123456789";
  }
}

export function setStoredDeveloperPin(newPin: string): void {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, newPin.trim());
  } catch (e) {
    console.error("Failed to store developer pin", e);
  }
}

export function isDeveloperSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCKED_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

export function setDeveloperSessionUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(UNLOCKED_SESSION_KEY, "true");
    } else {
      sessionStorage.removeItem(UNLOCKED_SESSION_KEY);
    }
  } catch (e) {
    console.error("Failed to toggle developer session", e);
  }
}

// Hook for reacting to developer unlock state
export function useDeveloperMode() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => isDeveloperSessionUnlocked());

  const unlock = (enteredPin: string): boolean => {
    const correctPin = getStoredDeveloperPin();
    if (enteredPin.trim() === correctPin) {
      setDeveloperSessionUnlocked(true);
      setIsUnlocked(true);
      toast.success("تم فتح وضع المطور بنجاح ⚡");
      return true;
    }
    toast.error("رمز المطور (PIN) غير صحيح!");
    return false;
  };

  const lock = () => {
    setDeveloperSessionUnlocked(false);
    setIsUnlocked(false);
    toast.info("تم قفل وضع المطور وإخفاء الواجهات 🔒");
  };

  const changePin = (currentPin: string, newPin: string): boolean => {
    const correctPin = getStoredDeveloperPin();
    if (currentPin.trim() !== correctPin) {
      toast.error("الرمز الحالي غير صحيح");
      return false;
    }
    if (newPin.trim().length < 4) {
      toast.error("يجب ألا يقل الرمز الجديد عن 4 أرقام أو حروف");
      return false;
    }
    setStoredDeveloperPin(newPin);
    toast.success("تم تحديث رمز المطور بنجاح");
    return true;
  };

  return {
    isUnlocked,
    unlock,
    lock,
    changePin,
  };
}

// Full-screen inline guard when trying to access a protected developer view while locked
export const DeveloperGuardView: React.FC<{
  onUnlocked: () => void;
  onCancel: () => void;
  targetViewTitle?: string;
}> = ({ onUnlocked, onCancel, targetViewTitle }) => {
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showPin, setShowPin] = useState(false);
  const { unlock } = useDeveloperMode();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) {
      setErrorMsg("يرجى إدخال رمز المطور (PIN)");
      return;
    }
    const success = unlock(pinInput);
    if (success) {
      setErrorMsg("");
      onUnlocked();
    } else {
      setErrorMsg("رمز الحماية غير صحيح. حاول مرة أخرى.");
      setPinInput("");
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 rtl font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-right">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />

        <div className="flex items-center justify-center w-14 h-14 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl mx-auto mb-4 border border-amber-500/20">
          <KeyRound className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-black text-slate-900 dark:text-white text-center">
          بوابة المطور المحمية
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1 mb-6">
          {targetViewTitle ? (
            <>
              شاشة <span className="font-bold text-slate-800 dark:text-slate-200">"{targetViewTitle}"</span> مخصصة للمطور فقط. يرجى إدخال رمز الحماية (PIN) للمتابعة.
            </>
          ) : (
            "هذه الشاشة مخصصة لمطور النظام فقط وتتطلب صلاحية وصول خاصة."
          )}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              رمز المطور (PIN):
            </label>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setErrorMsg("");
                }}
                placeholder="أدخل الرمز السري..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-center text-lg tracking-widest font-mono font-black focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                {showPin ? "إخفاء" : "إظهار"}
              </button>
            </div>
            {errorMsg && (
              <p className="text-xs text-rose-500 font-bold mt-1.5 text-center">
                {errorMsg}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>إلغاء القفل والدخول</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition cursor-pointer"
            >
              العودة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal for managing Developer Mode (Unlock / Lock / Change PIN)
export const DeveloperModeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  isUnlocked: boolean;
  onUnlock: (pin: string) => boolean;
  onLock: () => void;
  onChangePin: (oldPin: string, newPin: string) => boolean;
  onNavigateToView?: (viewId: string) => void;
}> = ({
  isOpen,
  onClose,
  isUnlocked,
  onUnlock,
  onLock,
  onChangePin,
  onNavigateToView,
}) => {
  // Phone Back Button support
  useBackButton(isOpen, onClose, "DeveloperModeModal", 40);

  const [pinInput, setPinInput] = useState("");
  const [showChangePinSection, setShowChangePinSection] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPinInput("");
      setErrorMsg("");
      setShowChangePinSection(false);
      setCurrentPinInput("");
      setNewPinInput("");
      setConfirmPinInput("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) {
      setErrorMsg("يرجى إدخال رمز المطور");
      return;
    }
    const ok = onUnlock(pinInput);
    if (ok) {
      setPinInput("");
      setErrorMsg("");
    } else {
      setErrorMsg("الرمز غير صحيح");
    }
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPinInput || !newPinInput) {
      setErrorMsg("يرجى ملء جميع حقول الرمز");
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setErrorMsg("الرمز الجديد وتأكيده غير متطابقين");
      return;
    }
    const ok = onChangePin(currentPinInput, newPinInput);
    if (ok) {
      setShowChangePinSection(false);
      setCurrentPinInput("");
      setNewPinInput("");
      setConfirmPinInput("");
      setErrorMsg("");
    }
  };

  const devShortcuts = [
    { id: "accounts-linking", label: "ربط الحسابات", icon: LinkIcon, desc: "توجيه القيود التلقائية للحسابات" },
    { id: "firebase-config", label: "إعدادات السحابة", icon: Cloud, desc: "إعدادات قاعدة بيانات Firebase" },
    { id: "notification-management", label: "إدارة الإشعارات", icon: Bell, desc: "قوالب وإعدادات تنبيهات النظام" },
    { id: "notification-subscriptions", label: "اشتراكات الإشعارات", icon: Bell, desc: "تخصيص استلام تنبيهات الحسابات" },
    { id: "device-guard", label: "أمان الأجهزة", icon: ShieldCheck, desc: "التحكم بالأجهزة المصرح لها بالدخول" },
    { id: "android", label: "محاكي أندرويد", icon: Smartphone, desc: "معاينة واجهة الموبايل المحاسبية" },
    { id: "windows", label: "محاكي ويندوز", icon: Laptop, desc: "معاينة واجهة سطح المكتب" },
  ];

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 rtl font-sans">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${isUnlocked ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-slate-700'}`}>
              {isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>بوابة مطور النظام (Developer Access)</span>
                {isUnlocked && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    نشط ومفتوح
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                إدارة الواجهات الحساسة والإعدادات الهندسية والمحاكيات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {!isUnlocked ? (
            /* Locked State - Prompt for PIN */
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  هذه الشاشات محمية وخاصة بالمطور فقط (ربط الحسابات، السحابة، الإشعارات، أمان الأجهزة، والمحاكيات).
                  أدخل رمز المطور للمتابعة.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  أدخل رمز المطور (PIN):
                </label>
                <input
                  type="password"
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="رمز PIN..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-center text-lg tracking-widest font-mono font-black focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {errorMsg && (
                  <p className="text-xs text-rose-500 font-bold mt-1 text-center">
                    {errorMsg}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>فتح وضع المطور</span>
              </button>
            </form>
          ) : (
            /* Unlocked State - Options and Shortcuts */
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    وضع المطور مفتوح الآن، الواجهات ظاهرة بالقائمة
                  </span>
                </div>
                <button
                  onClick={() => {
                    onLock();
                    onClose();
                  }}
                  className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
                >
                  <Lock className="w-3 h-3" />
                  <span>قفل الآن</span>
                </button>
              </div>

              {/* Developer Views Shortcuts */}
              <div>
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                  الشاشات المخصصة للمطور (7 واجهات):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {devShortcuts.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (onNavigateToView) {
                          onNavigateToView(item.id);
                          onClose();
                        }
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 hover:bg-amber-50/40 dark:hover:bg-slate-800 transition text-right flex items-center gap-2.5 group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                          {item.label}
                        </p>
                        <p className="text-[9px] text-slate-400 truncate">
                          {item.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Change PIN toggle */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                {!showChangePinSection ? (
                  <button
                    onClick={() => setShowChangePinSection(true)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>تغيير رمز المطور (PIN)</span>
                  </button>
                ) : (
                  <form onSubmit={handleChangePinSubmit} className="space-y-3 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        تعديل رمز المطور
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowChangePinSection(false)}
                        className="text-[10px] text-slate-400 hover:text-slate-600"
                      >
                        إلغاء
                      </button>
                    </div>

                    <div>
                      <input
                        type="password"
                        placeholder="الرمز الحالي"
                        value={currentPinInput}
                        onChange={(e) => setCurrentPinInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="password"
                        placeholder="الرمز الجديد"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="تأكيد الرمز الجديد"
                        value={confirmPinInput}
                        onChange={(e) => setConfirmPinInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                      />
                    </div>

                    {errorMsg && (
                      <p className="text-xs text-rose-500 font-bold">{errorMsg}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      حفظ الرمز الجديد
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50/80 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-5">
          <span>حماية متعددة المستويات</span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
