import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  ShieldAlert,
  Laptop,
  Smartphone,
  Tablet,
  Key,
  Check,
  X,
  Lock,
  Unlock,
  Settings,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  ShieldCheck,
  MoreVertical,
  Sliders,
  Radio,
  Wifi,
  WifiOff,
  LogOut
} from "lucide-react";
import { AuthorizedDevice } from "../types";
import {
  subscribeDevices,
  addDevice,
  updateDevice,
  deleteDevice,
  isUsingLocalFallback,
  forceCloudConnection,
  subscribeAppUsers,
  fetchAndSaveDeviceCloudLicense,
  authorizeDeviceInCloudAndLocal,
} from "../lib/dbService";

// Generates offscreen rendering text to detect exact GPU and OS rendering characteristics (Canvas Fingerprint)
const generateCanvasFingerprint = (): string => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "CFP-GENERIC";
    ctx.textBaseline = "top";
    ctx.font = "12px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(80, 5, 45, 12);
    ctx.fillStyle = "#069";
    ctx.fillText("SafeCloudFinance,🔒2026!", 2, 8);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("SafeCloudFinance,🔒2026!", 4, 10);
    
    // Simple fast DJB2-like string hashing of dataUrl
    const dataUrl = canvas.toDataURL();
    let hash = 0;
    for (let i = 0; i < dataUrl.length; i++) {
      const char = dataUrl.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return "CFP-" + Math.abs(hash).toString(16).toUpperCase();
  } catch (e) {
    return "CFP-UNSUPPORTED";
  }
};

// Returns a rich set of physical hardware and browser specs
const getDeviceDetails = () => {
  const ua = navigator.userAgent;
  let deviceType = "desktop";
  let deviceName = "حاسوب مكتبي / محمول";

  if (/Mobi|Android|iPhone|iPad|Phone/i.test(ua)) {
    if (/SM-F|Fold|Flip/i.test(ua)) {
      deviceType = "mobile";
      deviceName = "هاتف قابل للطي (Foldable Phone)";
    } else if (/iPad|Tablet/i.test(ua)) {
      deviceType = "tablet";
      deviceName = "جهاز لوحي (Tablet)";
    } else {
      deviceType = "mobile";
      deviceName = "هاتف محمول (Mobile)";
    }
  }

  // Extract browser and OS
  let os = "نظام غير معروف";
  if (ua.indexOf("Win") !== -1) os = "Windows OS";
  if (ua.indexOf("Mac") !== -1) os = "macOS";
  if (ua.indexOf("Linux") !== -1) os = "Linux";
  if (ua.indexOf("Android") !== -1) os = "Android";
  if (ua.indexOf("like Mac") !== -1) os = "iOS";

  let browser = "متصفح ويب";
  if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
  else if (ua.indexOf("Safari") !== -1) browser = "Safari";
  else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
  else if (ua.indexOf("Edge") !== -1) browser = "Edge";

  const width = window.screen?.width || 0;
  const height = window.screen?.height || 0;
  const colorDepth = window.screen?.colorDepth || 0;
  const pixelRatio = window.devicePixelRatio || 1;
  const logicalCores = navigator.hardwareConcurrency || "غير معروف";
  const language = navigator.language || "ar-EG";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const canvasHash = generateCanvasFingerprint();

  return {
    deviceType,
    deviceName: `${deviceName} - ${os} (${browser})`,
    userAgent: ua,
    os,
    browser,
    canvasHash,
    hardwareSpecs: `أنوية المعالج: ${logicalCores} • عمق الألوان: ${colorDepth}-bit • معدل بكسل الشاشة: ${pixelRatio}x • عرض الشاشة: ${width}x${height} • المنطقة الزمنية: ${timezone} • اللغة: ${language}`,
    screenResolution: `${width}X${height}`
  };
};

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage.getItem failed for key:", key, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage.setItem failed for key:", key, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("localStorage.removeItem failed for key:", key, e);
    }
  }
};

// Generates a browser fingerprint uuid embedded with device hardware properties
const getOrCreateDeviceUuid = (): string => {
  let uuid = safeLocalStorage.getItem("accounting_device_uuid");

  const ua = navigator.userAgent;
  let osAbbr = "OTH"; // Other/unknown
  if (ua.indexOf("Win") !== -1) osAbbr = "WIN";
  else if (ua.indexOf("Mac") !== -1) osAbbr = "MAC";
  else if (ua.indexOf("Linux") !== -1) osAbbr = "LIN";
  else if (ua.indexOf("Android") !== -1) osAbbr = "AND";
  else if (ua.indexOf("like Mac") !== -1) osAbbr = "IOS";

  let browserAbbr = "WEB"; // generic browser
  if (ua.indexOf("Chrome") !== -1) browserAbbr = "CHR";
  else if (ua.indexOf("Safari") !== -1) browserAbbr = "SAF";
  else if (ua.indexOf("Firefox") !== -1) browserAbbr = "FOX";
  else if (ua.indexOf("Edge") !== -1) browserAbbr = "EDG";

  // Get screen resolution to make the signature represent hardware characteristics
  const width = window.screen?.width || 0;
  const height = window.screen?.height || 0;
  const resStr = width && height ? `${width}X${height}` : "000";

  // Canvas render fingerprint signature
  const rawCanvas = generateCanvasFingerprint();
  const canvasSuffix = rawCanvas.replace("CFP-", "");

  // Generate a brief random sign-off tag to prevent duplicates for matching models
  const randStr = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const tag = randStr();

  // The code incorporates: DEV-[OS]-[BROWSER]-[WIDTH]X[HEIGHT]-[CANVAS_HASH_SUFFIX]-[TAG]
  // Example result: DEV-WIN-CHR-1920X1080-BC89-F4G2
  const newFormat = `DEV-${osAbbr}-${browserAbbr}-${resStr}-${canvasSuffix}-${tag}`;

  if (!uuid) {
    uuid = newFormat;
    safeLocalStorage.setItem("accounting_device_uuid", uuid);
  } else {
    // If it is an old UUID format (has less than 6 segments), upgrade it so the user's signature reflects hardware details
    const parts = uuid.split("-");
    if (parts.length < 6) {
      uuid = newFormat;
      safeLocalStorage.setItem("accounting_device_uuid", uuid);
    }
  }
  return uuid;
};

// Detects whether the execution environment is an authorized Native App (Windows WebView2 / Android Native Bridge)
const isNativeAppEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;

  const windowAny = window as any;

  // 1. Android Native Bridge (@JavascriptInterface)
  if (windowAny.MuhasibNativeApp || windowAny.AndroidBridge) {
    return true;
  }

  // 2. Windows Native Bridge (WebView2 HostObject / Message Bridge)
  if (windowAny.chrome && windowAny.chrome.webview) {
    if (windowAny.chrome.webview.hostObjects && windowAny.chrome.webview.hostObjects.MuhasibNativeApp) {
      return true;
    }
    return true;
  }

  // 3. Custom User-Agent Signature injected by Native App
  if (navigator.userAgent && (navigator.userAgent.includes("MuhasibSecureApp") || navigator.userAgent.includes("MuhasibNativeApp"))) {
    return true;
  }

  // 4. Development & AI Studio Preview environment exception
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.includes("run.app") || host.includes("aistudio")) {
    return true;
  }

  return false;
};

// MASTER ACCESS PASSCODE FOR INSTANT AUTHORIZATION/RESET
const MASTER_PASSCODE = "secure-2026";

interface DeviceGuardProps {
  children: React.ReactNode;
}

export default function DeviceGuard({ children }: DeviceGuardProps) {
  const [isNativeApp] = useState(() => isNativeAppEnvironment());
  const [devices, setDevices] = useState<AuthorizedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDevice, setCurrentDevice] = useState<AuthorizedDevice | null>(() => {
    try {
      const cached = safeLocalStorage.getItem("accounting_cloud_device_license");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) return parsed;
      }
    } catch (e) {
      console.warn("Failed reading cached cloud device license:", e);
    }
    return null;
  });

  const [isSyncingLicense, setIsSyncingLicense] = useState(false);
  const [syncLicenseMessage, setSyncLicenseMessage] = useState("");
  
  // Security checks feedback simulation
  const [securityStage, setSecurityStage] = useState("بدء تشغيل النواة الأمنية...");
  const [securityProgress, setSecurityProgress] = useState(15);
  
  // Spoofing / Tampering detection state
  const [isTampered, setIsTampered] = useState(false);
  const [tamperDetails, setTamperDetails] = useState("");
  
  // Lock Screen States
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [showOwnerPasscodeBox, setShowOwnerPasscodeBox] = useState(false);
  const [_shieldClicks, setShieldClicks] = useState(0);
  const shieldClickTimeoutRef = useRef<any>(null);

  const handleShieldClick = () => {
    if (shieldClickTimeoutRef.current) {
      clearTimeout(shieldClickTimeoutRef.current);
    }
    shieldClickTimeoutRef.current = setTimeout(() => {
      setShieldClicks(0);
    }, 2500);

    setShieldClicks((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        setShowOwnerPasscodeBox((show) => !show);
        return 0;
      }
      return next;
    });
  };

  const [customDeviceName, setCustomDeviceName] = useState("");
  const [licenseRequestSent, setLicenseRequestSent] = useState(false);
  const [securityPolicy, setSecurityPolicy] = useState("extreme"); // standard, high, extreme
  const [copied, setCopied] = useState(false);
  
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isPreviouslyAuthorized, setIsPreviouslyAuthorized] = useState(() => {
    try {
      return localStorage.getItem("accounting_device_authorized_at_least_once") === "true";
    } catch {
      return false;
    }
  });

  const [currentUserId, setCurrentUserId] = useState(() => typeof window !== 'undefined' ? (sessionStorage.getItem("current_user_id") || null) : null);

  useEffect(() => {
    const checkUser = setInterval(() => {
      const stored = typeof window !== 'undefined' ? (sessionStorage.getItem("current_user_id") || null) : null;
      if (stored !== currentUserId) {
        setCurrentUserId(stored);
      }
    }, 1000);
    return () => clearInterval(checkUser);
  }, [currentUserId]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);
  
  // Sizing and flexible typography customization states
  const [cardDensity, setCardDensity] = useState<'compact' | 'standard' | 'spacious'>(() => {
    try {
      return (localStorage.getItem("guard_density") as 'compact' | 'standard' | 'spacious') || 'standard';
    } catch (_) {
      return 'standard';
    }
  });
  
  const [fontSizeScale, setFontSizeScale] = useState<'small' | 'medium' | 'large'>(() => {
    try {
      return (localStorage.getItem("guard_font_scale") as 'small' | 'medium' | 'large') || 'medium';
    } catch (_) {
      return 'medium';
    }
  });

  const [isAutoResponsive, setIsAutoResponsive] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem("guard_auto_responsive");
      return val === null ? true : val === 'true';
    } catch (_) {
      return true;
    }
  });

  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1000);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const changeCardDensity = (density: 'compact' | 'standard' | 'spacious') => {
    setCardDensity(density);
    try {
      localStorage.setItem("guard_density", density);
    } catch (_) {}
  };

  const changeFontSizeScale = (scale: 'small' | 'medium' | 'large') => {
    setFontSizeScale(scale);
    try {
      localStorage.setItem("guard_font_scale", scale);
    } catch (_) {}
  };

  const toggleAutoResponsive = () => {
    const nextVal = !isAutoResponsive;
    setIsAutoResponsive(nextVal);
    try {
      localStorage.setItem("guard_auto_responsive", String(nextVal));
    } catch (_) {}
  };

  // Determine active density and font classes considering viewport (Adapts to mobile vs desktop)
  const isMobileSize = windowWidth < 768;
  const activeDensity = isMobileSize && isAutoResponsive ? 'compact' : cardDensity;
  const activeFontScale = isMobileSize && isAutoResponsive ? 'small' : fontSizeScale;

  // Outer container size classes
  const containerSizeClass = 
    activeDensity === 'compact' ? "w-full max-w-md p-4 space-y-4 rounded-2xl" :
    activeDensity === 'spacious' ? "w-full max-w-4xl p-8 lg:p-10 space-y-8 rounded-[2rem]" :
    "w-full max-w-2xl p-6 lg:p-8 space-y-6 rounded-3xl";

  // Dynamic typography scale configuration
  const typography = {
    title: activeFontScale === 'small' ? "text-sm md:text-base font-extrabold" : activeFontScale === 'large' ? "text-xl md:text-2xl font-black" : "text-lg md:text-xl font-black",
    body: activeFontScale === 'small' ? "text-[10px] leading-relaxed text-slate-400" : activeFontScale === 'large' ? "text-xs md:text-sm leading-relaxed text-slate-300" : "text-[11px] md:text-xs leading-relaxed text-slate-400",
    sub: activeFontScale === 'small' ? "text-[8.5px] font-mono" : activeFontScale === 'large' ? "text-xs font-mono" : "text-[10px] font-mono",
    heading: activeFontScale === 'small' ? "text-[10px] font-bold" : activeFontScale === 'large' ? "text-sm md:text-base font-extrabold" : "text-xs md:text-sm font-black",
    input: activeFontScale === 'small' ? "py-2 px-3 text-[11px]" : activeFontScale === 'large' ? "py-3 px-4 text-sm" : "py-2.5 px-3.5 text-xs"
  };

  const [deviceId] = useState(() => getOrCreateDeviceUuid());

  const handleCopyDeviceId = () => {
    try {
      navigator.clipboard.writeText(deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert(`معرف الجهاز الطالب هو:\n${deviceId}`);
    }
  };

  useEffect(() => {
    // Beautiful simulation of security tests before unlocking
    const timers = [
      setTimeout(() => { setSecurityStage("أخذ لقطة فنية لطبقة الـ Canvas ومعالجة الخطوط الرقمية..."); setSecurityProgress(35); }, 400),
      setTimeout(() => { setSecurityStage("استخلاص مواصفات معالج الجرافيكس وعدد الأنوية للعتاد الصلب..."); setSecurityProgress(60); }, 800),
      setTimeout(() => { setSecurityStage("التحقق من مرساة الذاكرة المحمية ومطابقتها ببيانات Firestore السحابية..."); setSecurityProgress(85); }, 1200),
      setTimeout(() => { setSecurityStage("إمضاء بروتوكول المصادقة وتوثيق سلامة البيانات الفورية..."); setSecurityProgress(100); }, 1600)
    ];

    return () => timers.forEach(clearTimeout);
  }, [loading]);

  useEffect(() => {
      // Subscribe to all registered devices
      const unsub = subscribeDevices(async (data) => {
        setDevices(data);
        
        const found = data.find(d => d.id === deviceId);
        const details = getDeviceDetails();
  
        if (found) {
          // Device is registered in the cloud database. Let's do anti-tamper hardware checks!
          // If we have canvas render characteristics or screen size on record, match them.
          let deviceSpoofed = false;
          let mismatchLog = "";
  
          if (found.canvasHash && found.canvasHash !== details.canvasHash) {
            deviceSpoofed = true;
            mismatchLog += `بصمة الـ Canvas غير متطابقة! (المسجل سحابياً: ${found.canvasHash} • الحالي للهيكل المادي: ${details.canvasHash})\n`;
          }
          
          // Match resolution if stored (with intelligence for foldable devices and screen rotation)
          const resParts = found.id.split("-");
          const storedRes = resParts[3]; // segmented format
          const isMobileOrTablet = 
            details.deviceType === "mobile" || 
            details.deviceType === "tablet" || 
            /Android|iPhone|iPad|Mobile|Tablet|SM-F|Fold|Flip/i.test(navigator.userAgent);

          if (storedRes && storedRes !== "000" && details.screenResolution !== storedRes) {
            // Check if it's a screen orientation change (Portrait <-> Landscape)
            const [storedW, storedH] = storedRes.split("X").map(Number);
            const [currW, currH] = details.screenResolution.split("X").map(Number);
            const isOrientationSwap = 
              Boolean(storedW && storedH && currW && currH) && 
              ((storedW === currH && storedH === currW) || 
               (Math.min(storedW, storedH) === Math.min(currW, currH) && Math.max(storedW, storedH) === Math.max(currW, currH)));

            // Mobile and foldable devices (e.g. Galaxy Z Fold) dynamically change resolution when folding/unfolding.
            // Screen rotation or folding on mobile/tablet is legitimate physical behavior and NOT spoofing.
            if (!isMobileOrTablet && !isOrientationSwap) {
              deviceSpoofed = true;
              mismatchLog += `معدل دقة الشاشة المادية تم العبث به! (المقيد: ${storedRes} • المتصل حالياً: ${details.screenResolution})\n`;
            }
          }

          if (deviceSpoofed) {
            setIsTampered(true);
            setTamperDetails(mismatchLog);
          } else {
            setIsTampered(false);
            setTamperDetails("");
          }

          // Store exact cloud device license locally
          safeLocalStorage.setItem("accounting_cloud_device_license", JSON.stringify(found));
          safeLocalStorage.setItem("accounting_active_device_license", JSON.stringify(found));
          safeLocalStorage.setItem("accounting_cloud_device_synced_at", new Date().toISOString());

          if (found.isAuthorized && !deviceSpoofed) {
            safeLocalStorage.setItem("accounting_device_authorized_at_least_once", "true");
            setIsPreviouslyAuthorized(true);
            safeLocalStorage.setItem("guard_allowed_user_ids", JSON.stringify(found.allowedUserIds || []));
          } else {
            safeLocalStorage.setItem("accounting_device_authorized_at_least_once", "false");
            setIsPreviouslyAuthorized(false);
            safeLocalStorage.setItem("guard_allowed_user_ids", "[]");
          }

          setCurrentDevice(found);
          
          // Update its last active time silently
          const timeDiff = Date.now() - new Date(found.lastActive).getTime();
          if (!deviceSpoofed) {
            const shouldUpdateResolution = isMobileOrTablet && found.screenResolution !== details.screenResolution;
            if (timeDiff > 60000 || shouldUpdateResolution) { // update periodically or when folding/unfolding
              await updateDevice(deviceId, {
                lastActive: new Date().toISOString(),
                hardwareSpecs: details.hardwareSpecs, // refresh spec
                canvasHash: details.canvasHash,
                browser: details.browser,
                os: details.os,
                screenResolution: details.screenResolution
              });
            }
          }
        } else {
          // Device not found in cloud snapshot; check if we have a valid locally saved cloud license
          const cachedLicenseRaw = safeLocalStorage.getItem("accounting_cloud_device_license");
          let restored = false;
          if (cachedLicenseRaw) {
            try {
              const cached = JSON.parse(cachedLicenseRaw);
              if (cached && cached.id === deviceId && cached.isAuthorized) {
                setCurrentDevice(cached);
                setIsPreviouslyAuthorized(true);
                restored = true;
              }
            } catch (_) {}
          }
          if (!restored) {
            setCurrentDevice(null);
            safeLocalStorage.setItem("accounting_device_authorized_at_least_once", "false");
            setIsPreviouslyAuthorized(false);
            safeLocalStorage.setItem("guard_allowed_user_ids", "[]");
          }
        }
        
        // Remove the 1800ms loading delay for faster access if already approved
        setLoading(false);
      });
  
      return () => unsub();
  }, [deviceId]);

  // Handle manual registry request
  const handleRequestLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUsingLocalFallback()) {
      alert("⚠️ خطأ في الاتصال: لا يمكن تقديم طلب ترخيص وأنت في وضع عدم الاتصال (الوضع المحلي). يرجى التأكد من استقرار اتصالك السحابي!");
      return;
    }
    if (!isOnline && !isPreviouslyAuthorized) {
      alert("⚠️ خطأ في الاتصال: يجب أن تكون متصلاً بالإنترنت لرفع طلب الترخيص لأول مرة إلى السحابة!");
      return;
    }
    const details = getDeviceDetails();
    const finalName = customDeviceName.trim() || details.deviceName;

    const newRequest: AuthorizedDevice = {
      id: deviceId,
      deviceName: finalName,
      deviceType: details.deviceType,
      userAgent: details.userAgent,
      isAuthorized: false, // requires admin review or master code
      registeredAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      hardwareSpecs: details.hardwareSpecs,
      canvasHash: details.canvasHash,
      os: details.os,
      browser: details.browser,
      tamperCount: 0,
      adminNotes: "طلب ترخيص معلق في انتظار موافقة معقدة من مالك الحسابات"
    };

    await addDevice(newRequest);
    setLicenseRequestSent(true);
  };

  // Handle instant bypass using master security key
  const handleBypassWithPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // We allow bypass even if offline, as long as the passcode is correct.
    if (passcode === MASTER_PASSCODE) {
      const details = getDeviceDetails();
      const finalName = customDeviceName.trim() || `${details.deviceName} (مرخص بـ رمز)`;

      const newAuthDevice: AuthorizedDevice = {
        id: deviceId,
        deviceName: finalName,
        deviceType: details.deviceType,
        userAgent: details.userAgent,
        isAuthorized: true,
        registeredAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        hardwareSpecs: details.hardwareSpecs,
        canvasHash: details.canvasHash,
        os: details.os,
        browser: details.browser,
        tamperCount: 0,
        adminNotes: "تم الترخيص الفوري المشفر وبناء البصمة الصارمة باستخدام مفتاح المالك المباشر"
      };

      await addDevice(newAuthDevice);
      safeLocalStorage.setItem("accounting_cloud_device_license", JSON.stringify(newAuthDevice));
      safeLocalStorage.setItem("accounting_active_device_license", JSON.stringify(newAuthDevice));
      safeLocalStorage.setItem("accounting_cloud_device_synced_at", new Date().toISOString());
      safeLocalStorage.setItem("accounting_device_authorized_at_least_once", "true");
      setIsPreviouslyAuthorized(true);
      setCurrentDevice(newAuthDevice);
      setPasscode("");
      setPasscodeError("");
      setIsTampered(false);
      alert("🔓 مبارك! تم صياغة بصمتك الحيوية واعتماد هذا الجهاز سحابياً وتخزين الترخيص محلياً بنجاح!");
    } else {
      setPasscodeError("تم رفض المفتاح! الرقم السري المدخل غير صحيح أو انتهت صلاحية الجلسة الموحدة.");
    }
  };

  // Fetch cloud device license and store it locally
  const handleFetchCloudLicenseNow = async () => {
    setIsSyncingLicense(true);
    setSyncLicenseMessage("");
    try {
      const res = await fetchAndSaveDeviceCloudLicense(deviceId);
      if (res.success && res.device) {
        setCurrentDevice(res.device);
        if (res.device.isAuthorized) {
          setIsPreviouslyAuthorized(true);
          safeLocalStorage.setItem("accounting_device_authorized_at_least_once", "true");
          setSyncLicenseMessage("✅ تم بنجاح جلب الترخيص السحابي للجهاز وتخزينه محلياً (الجهاز مرخص ومفعل)");
        } else {
          setSyncLicenseMessage("⏳ تم جلب الترخيص السحابي وتخزينه محلياً بنجاح (حالة الترخيص: قيد المراجعة في السحابة)");
        }
      } else {
        setSyncLicenseMessage(res.message);
      }
    } catch (err: any) {
      setSyncLicenseMessage(`خطأ في جلب الترخيص السحابي: ${err?.message || err}`);
    } finally {
      setIsSyncingLicense(false);
    }
  };

  // One-click instant owner authorization & local storage (triggers passcode validation)
  const handleQuickAuthorizeCurrentDevice = async () => {
    setShowOwnerPasscodeBox(true);
    setSyncLicenseMessage("🔑 يرجى إدخال رمز ترخيص المسؤول السري للترخيص المباشر وتثبيته سحابياً ومحلياً.");
  };

  // Block access completely for standard non-native external browsers
  if (!isNativeApp) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans text-right select-none" dir="rtl">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 shadow-2xl p-8 rounded-3xl space-y-6 relative overflow-hidden">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
            <ShieldAlert className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-base md:text-lg font-black text-white">
              ⛔ الوصول محظور: المتصفحات الخارجية غير مصرح بها!
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              عذراً، هذا النظام المالي المتقدم مخصص للعمل حصرياً عبر تطبيق الويندوز وتطبيق الأندرويد المعتمدين للمنشأة.
              تم حظر فتح الصفحة من المتصفحات العادية لحماية الحسابات والبيانات المالية.
            </p>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-[11px] text-slate-400 space-y-2 text-right">
            <div className="font-bold text-slate-300">🛡️ حالة الأمان والمصادقة:</div>
            <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-xl">
              <span>بيئة التشغيل:</span>
              <span className="text-rose-400 font-bold">متصفح عام (Standard Web Browser)</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-xl">
              <span>الجسر الأصلي (Native Bridge):</span>
              <span className="text-rose-400 font-bold">غير متصل (Disconnected)</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-xl">
              <span>الاتصال بالسحابة:</span>
              <span className="text-amber-400 font-bold">معطل لحماية الحسابات</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-500">
            يرجى تشغيل النظام من خلال التطبيق المعتمد على جهاز الكمبيوتر أو الهاتف الخاص بك.
          </p>
        </div>
      </div>
    );
  }

  // Waiting screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans text-right p-6" dir="rtl">
        <div className="text-center space-y-6 max-w-lg">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-8 w-8 text-indigo-500 animate-pulse" />
            </div>
            <div className="absolute -inset-1 rounded-3xl border border-indigo-500/30 animate-ping -z-10" style={{ animationDuration: '3s' }} />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-sm font-black text-white">درع الحماية المحاسبي الشامل (Zero-Trust Shield)</h2>
            <p className="text-[11px] text-slate-400 select-none">جاري الاستعلام عن البصمة الفيزيائية الفرعية ومطابقة عتاد الجهاز سحابياً...</p>
          </div>

          {/* Graphical Progress bar */}
          <div className="w-full bg-slate-900 border border-slate-800 h-2 px-0.5 rounded-full overflow-hidden flex items-center">
            <div 
              className="bg-indigo-500 h-1 rounded-full transition-all duration-500" 
              style={{ width: `${securityProgress}%` }}
            />
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="truncate">{securityStage}</span>
            <span className="font-bold text-indigo-400">{securityProgress}%</span>
          </div>
        </div>
      </div>
    );
  }

  // Block screen if current device is NOT found or NOT authorized, OR if tampering is detected!
  const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1') ||
    safeLocalStorage.getItem("accounting_app_use_local_fallback") === "true"
  );

  // If the device has never been authorized before (first-time boot), local bypass is STRICTLY DISABLED.
  // This enforces internet availability and uploads device authorization request to the cloud (Firestore).
  // If we have an active device record and it is revoked or tampered, we block it immediately.
  const isAuthorized = currentDevice 
    ? (currentDevice.isAuthorized && !isTampered) 
    : (isPreviouslyAuthorized && (!isOnline || isLocal));

  if (!isAuthorized) {
    const details = getDeviceDetails();
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-right select-none" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-lg bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden transition-all duration-300 rounded-3xl p-6 space-y-6"
        >

          {/* Subtle warning backdrop glow */}
          <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl -z-10 ${isTampered ? 'bg-rose-600/15 animate-pulse' : 'bg-rose-500/10'}`} />
          
          <div className="text-center space-y-3">
            <div 
              onClick={handleShieldClick}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2 cursor-pointer select-none transition-transform active:scale-95 ${isTampered ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-rose-500/10 text-rose-500'}`}
              title="انقر 3 مرات هنا إذا كنت المالك لفتح الترخيص المباشر"
            >
              <ShieldAlert className={`h-9 w-9 ${isTampered ? 'animate-bounce' : ''}`} />
            </div>
            
            {isTampered ? (
              <div className="space-y-2">
                <span className="bg-rose-500 text-white text-[9px] px-3 py-1 rounded-full font-extrabold uppercase tracking-wider animate-pulse">
                  تم رصد محاولة اختراق (Fingerprint Spoof Blocked)
                </span>
                <h1 className={`font-black text-rose-500 ${typography.title}`}>
                  كشف انتحال البصمة الفنية المادية للجهاز!
                </h1>
                <p className={`${typography.body} text-slate-300 max-w-lg mx-auto`}>
                  حظر فوري: تم رفض الترخيص السحابي لحماية البيانات وسجلات المحاسبة التابعة لك! تم الكشف عن عدم تطابق مواصفات العتاد الصلبة للمتصفح الحالي، مما يمنع استنساخ المتصفحات أو نقل ملفات الارتباط وجلسات التوظيف.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <h1 className={`font-black text-white flex items-center justify-center gap-2 ${typography.title}`}>
                  <span>جرس الأمان السحابي: جهاز مجهول الهوية</span>
                  <span className="bg-amber-500/10 text-amber-500 text-[9px] px-2 py-0.5 rounded-full font-black">مقيد</span>
                </h1>
                <p className={`${typography.body} text-slate-400 max-w-lg mx-auto`}>
                  هذا التطبيق مجهز بجدران حماية نشطة ومحمي سحابياً ضد التسريبات. لا يملك متصفحك ترخيص وصول بعد ولا يمكن تصفح الصناديق والقيود، حرصاً على سرية الحسابات والوثائق.
                </p>
              </div>
            )}
          </div>

          {/* Offline Alert Box if first time & offline */}
          {!isPreviouslyAuthorized && !isOnline && (
            <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl space-y-2 text-right">
              <div className="flex items-center gap-2 text-rose-500">
                <WifiOff className="h-5 w-5 shrink-0 animate-pulse" />
                <span className="text-xs font-black">قيد التشغيل لأول مرة: الاتصال بالإنترنت إلزامي!</span>
              </div>
              <p className={`${typography.body} text-slate-350 leading-relaxed`}>
                يمنع منعاً باتاً تشغيل النظام لأول مرة بالوضع المحلي دون وجود اتصال إنترنت فعال وتنشيط سحابي لجهازك. رفع طلب ترخيص جهازك وتأكيد هويته سحابياً خطوتان إلزاميتان لبناء توقيعك المحمي في قاعدة البيانات السحابية (Firestore). يرجى الاتصال بالشبكة للمتابعة.
              </p>
            </div>
          )}

          {/* Current Device Info */}
          <div className={`p-4 rounded-2xl border space-y-3 ${isTampered ? 'bg-rose-950/20 border-rose-900/30' : 'bg-slate-950/60 border-slate-800'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`font-bold block text-slate-400 ${typography.heading}`}>بيانات الجهاز الحالي:</span>
            </div>
            
            <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-900 space-y-1 text-right">
              <div className="flex items-center gap-2">
                <Laptop className="h-4 w-4 text-indigo-400 shrink-0" />
                <span className="text-xs font-bold text-white">{details.deviceName}</span>
              </div>
            </div>

            {isTampered && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-1">
                <div className="text-xs font-black text-rose-500 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>تفاصيل كسر الأمان التلقائي:</span>
                </div>
                <pre className="text-[9px] text-rose-400 font-mono leading-relaxed whitespace-pre-wrap select-all bg-rose-950/40 p-2 rounded-lg">
                  {tamperDetails}
                  تنبيه: تم إغلاق مسار الجلسة المحاسبية حالياً للاشتباه بنقل الكوكيز أو العبث بالعتاد الصلب.
                </pre>
              </div>
            )}
          </div>

          {/* Authorization Methods */}
          <div className="space-y-4">
            
            {/* Method A: Direct Code Entry (Secret for Owner Only - Unlocked by clicking shield 3 times) */}
            {showOwnerPasscodeBox && (
              <form onSubmit={handleBypassWithPasscode} className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-500/40 space-y-3 animate-slideup shadow-lg shadow-indigo-950/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-indigo-400 flex items-center gap-1">
                    <Key className="h-3.5 w-3.5 text-indigo-400" />
                    ترخيص ذاتي مباشر (خاص بمالك النظام)
                  </label>
                  <span className="text-[9px] text-slate-400 font-medium">أدخل رمز ترخيص المسؤول السري</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="أدخل رمز ترخيص المسؤول السري..."
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      setPasscodeError("");
                    }}
                    autoFocus
                    className="flex-1 bg-slate-950 border border-slate-750 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-center font-mono placeholder:text-slate-600 tracking-widest"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition shrink-0 cursor-pointer"
                  >
                    تأكيد الترخيص والمطابقة
                  </button>
                </div>
                {passcodeError && (
                  <div className="text-[10px] text-rose-500 font-bold flex items-center gap-1 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{passcodeError}</span>
                  </div>
                )}
              </form>
            )}

            {/* Method B: License Request (Send to database) */}
            {!currentDevice && !licenseRequestSent && !isTampered && (
              <form onSubmit={handleRequestLicense} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-300 block">طلب ترخيص جديد من مالك الحسابات:</label>
                  <p className="text-[10px] text-slate-500">سيظهر طلبك في لوحة السيطرة الرئيسية الخاصة بالمسؤول مباشرة.</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="سمِّ هذا الجهاز ليسهل التعرف عليه (مثال: جوال أسامة المكتبي)"
                    value={customDeviceName}
                    onChange={(e) => setCustomDeviceName(e.target.value)}
                    required
                    className="flex-1 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                  />
                  <button
                    type="submit"
                    className="bg-slate-800 hover:bg-slate-750 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition shrink-0 cursor-pointer"
                  >
                    تقديم طلب ترخيص 📥
                  </button>
                </div>
              </form>
            )}

            {/* Cloud Device License Local Status & Actions Card */}
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-3 text-right">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  بيانات الترخيص السحابي للجهاز (المخزن محلياً)
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${currentDevice?.isAuthorized ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                  {currentDevice?.isAuthorized ? 'مرخص سحابياً ومحلياً' : currentDevice ? 'معلق في السحابة ومحفوظ محلياً' : 'غير مسجل بعد'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-[11px] font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-850 text-slate-350">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans text-[10px]">معرف الجهاز:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-indigo-300 font-bold select-all truncate max-w-[200px]">{deviceId}</span>
                    <button
                      type="button"
                      onClick={handleCopyDeviceId}
                      className="text-[9px] text-slate-400 hover:text-white bg-slate-800 px-1.5 py-0.5 rounded transition"
                      title="نسخ معرف الجهاز"
                    >
                      {copied ? 'تم النسخ!' : 'نسخ'}
                    </button>
                  </div>
                </div>
                {currentDevice && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400 font-sans text-[10px]">الاسم السحابي:</span>
                    <span className="text-white font-sans font-bold">{currentDevice.deviceName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400 font-sans text-[10px]">التخزين المحلي:</span>
                  <span className="text-emerald-400 font-sans text-[10px] font-bold">يتم جلب الترخيص السحابي وتخزينه محلياً فورياً</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleFetchCloudLicenseNow}
                  disabled={isSyncingLicense}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${isSyncingLicense ? 'animate-spin' : ''}`} />
                  <span>{isSyncingLicense ? 'جاري المزامنة...' : 'مزامنة وجلب الترخيص السحابي الآن'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickAuthorizeCurrentDevice}
                  disabled={isSyncingLicense}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold py-2 px-3.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-950/40"
                  title="ترخيص الجهاز سحابياً ومحلياً بنقرة واحدة لمالك النظام"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>ترخيص سحابي ومحلي فوري</span>
                </button>
              </div>

              {syncLicenseMessage && (
                <div className="text-[10px] font-sans font-bold p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-900/40 text-indigo-200">
                  {syncLicenseMessage}
                </div>
              )}
            </div>

            {(licenseRequestSent || (currentDevice && !currentDevice.isAuthorized && !isTampered)) && (
              <div className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-2xl flex items-start gap-3">
                <Clock className="h-5 w-5 text-indigo-400 animate-pulse mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1 text-right">
                  <h4 className="text-xs font-black text-white">تم قيد وحفظ الترخيص السحابي محلياً!</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    جهازك مسجل في السحابة ومحفوظ محلياً. اضغط على "ترخيص سحابي ومحلي فوري" أعلاه أو "مزامنة وجلب الترخيص" لتحديث حالته فوراً.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Footer branding details */}
          <div className="border-t border-slate-800/60 pt-4 text-center">
            <span className="text-[10px] text-slate-500 font-medium">سجل الأمان المالي السحابي يحفظ سلامتكم • {new Date().toLocaleTimeString("ar-EG")}</span>
          </div>

        </motion.div>
      </div>
    );
  }

  // Authorized! Provide normal access
  const hasUserRestriction = currentDevice?.allowedUserIds && currentDevice.allowedUserIds.length > 0;
  const isUserAllowed = !currentUserId || !hasUserRestriction || currentDevice.allowedUserIds.includes(currentUserId);

  if (!isUserAllowed) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-right select-none" dir="rtl">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden p-6 lg:p-8 space-y-6 rounded-3xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-2 border border-rose-500/20">
            <Lock className="h-9 w-9" />
          </div>

          <div className="space-y-1">
            <h1 className="font-black text-white text-sm md:text-base">
              حسابك غير مصرح له بالدخول من هذا الجهاز!
            </h1>
            <p className="text-[10px] leading-relaxed text-slate-400 max-w-sm mx-auto">
              عذراً، قام مسؤول النظام بتقييد هذا الجهاز (المتصفح) ليعمل فقط مع حسابات معينة من الموظفين لحماية سرية القيود والبيانات. حسابك الحالي لا يملك صلاحية استخدام هذا الترخيص.
            </p>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2 text-right text-xs">
            <div className="text-[10px] text-slate-500 font-bold">👤 تفاصيل الحساب الحالي والترخيص:</div>
            <div className="flex justify-between items-center bg-slate-900 p-2 rounded-xl">
              <span className="text-slate-400 font-bold">معرف الموظف المتصل:</span>
              <span className="font-mono text-indigo-400 font-bold select-all bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{currentUserId}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900 p-2 rounded-xl">
              <span className="text-slate-400 font-bold">الجهاز المستخدم:</span>
              <span className="text-white font-bold">{currentDevice?.deviceName}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => {
                sessionStorage.removeItem("current_user_id");
                localStorage.removeItem("current_user_id");
                window.location.reload();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <LogOut className="h-4 w-4" />
              <span>تبديل الحساب / تسجيل الخروج</span>
            </button>
            <div className="text-[10px] text-slate-500 font-medium">
              يرجى الاتصال بالمدير أو المسؤول المالي لإضافة حسابك لقائمة الأجهزة المرخصة.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}



