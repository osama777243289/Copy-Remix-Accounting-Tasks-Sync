/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toast } from "sonner";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
  query,
  orderBy,
  runTransaction,
  where,
  disableNetwork,
  enableNetwork,
  getDocFromServer,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  Account,
  Currency,
  Task,
  Transaction,
  Hall,
  Booking,
  AuthorizedDevice,
  Client,
  Employee,
  Service,
  User,
  Role,
  ReceiptPayment,
  CompanySettings,
  Broker,
  Guarantor,
  BookingSettings,
  LinkedAccounts,
  CostItem,
  DepositRefundRequest,
  BookingAmendmentRequest,
  BookingDiscountRequest,
  NotificationSetting,
  ManualNotification,
  AccountNotificationSubscription,
  MasterJournalVoucher,
} from "../types";

// No default mock or seed accounts. The system strictly uses and caches live Cloud Firestore data.
function cleanLegacyDefaultsFromLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    const legacyAccPrefixes = ["acc-1", "acc-2", "acc-3", "acc-4", "acc-5"];
    const storedAccsRaw = localStorage.getItem("accounting_app_accounts_v3");
    if (storedAccsRaw) {
      const parsed = JSON.parse(storedAccsRaw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (a: any) => !legacyAccPrefixes.some((prefix) => a?.id?.startsWith(prefix) || a?.code?.startsWith(prefix))
        );
        if (filtered.length !== parsed.length) {
          localStorage.setItem("accounting_app_accounts_v3", JSON.stringify(filtered));
        }
      }
    }

    const storedUsersRaw = localStorage.getItem("accounting_app_users_v3");
    if (storedUsersRaw) {
      const parsedUsers = JSON.parse(storedUsersRaw);
      if (Array.isArray(parsedUsers)) {
        const filteredUsers = parsedUsers.filter(
          (u: any) => u && u.id && !u.id.startsWith("mock-") && u.id !== "default-admin" && u.email !== "admin@enterprise.com"
        );
        if (filteredUsers.length !== parsedUsers.length) {
          localStorage.setItem("accounting_app_users_v3", JSON.stringify(filteredUsers));
        }
      }
    }

    const storedCostItemsRaw = localStorage.getItem("accounting_app_cost_items_v3");
    if (storedCostItemsRaw) {
      const parsedCosts = JSON.parse(storedCostItemsRaw);
      if (Array.isArray(parsedCosts)) {
        const filteredCosts = parsedCosts.filter((c: any) => c?.accountId !== "acc-5101");
        if (filteredCosts.length !== parsedCosts.length) {
          localStorage.setItem("accounting_app_cost_items_v3", JSON.stringify(filteredCosts));
        }
      }
    }
  } catch (e) {
    console.warn("Clean legacy defaults error:", e);
  }
}

// Run cleanup immediately on load
cleanLegacyDefaultsFromLocalStorage();

// Local Storage Fallback setup
const LOCAL_STORAGE_KEYS = {
  ACCOUNTS: "accounting_app_accounts_v3",
  TRANSACTIONS: "accounting_app_transactions_v3",
  CURRENCIES: "accounting_app_currencies_v3",
  TASKS: "accounting_app_tasks_v3",
  HALLS: "accounting_app_halls_v3",
  BOOKINGS: "accounting_app_bookings_v3",
  DEVICES: "accounting_app_devices_v3",
  CLIENTS: "accounting_app_clients_v3",
  EMPLOYEES: "accounting_app_employees_v3",
  SERVICES: "accounting_app_services_v3",
  USERS: "accounting_app_users_v3",
  ROLES: "accounting_app_roles_v3",
  VOUCHERS: "accounting_app_vouchers_v3",
  COMPANY: "accounting_app_company_v3",
  BROKERS: "accounting_app_brokers_v3",
  GUARANTORS: "accounting_app_guarantors_v3",
  BOOKING_SETTINGS: "accounting_app_booking_settings_v3",
  LINKED_ACCOUNTS: "accounting_app_linked_accounts_v3",
  RECURRING: "accounting_app_recurring_v3",
  PAYROLL: "accounting_app_payroll_v3",
  STANDARD_COSTS: "accounting_app_standard_costs_v3",
  ACTUAL_COSTS: "accounting_app_actual_costs_v3",
  COST_ITEMS: "accounting_app_cost_items_v3",
  DEPOSIT_REFUND_REQUESTS: "accounting_app_deposit_refund_requests_v3",
  BOOKING_AMENDMENT_REQUESTS: "accounting_app_booking_amendment_requests_v3",
  BOOKING_DISCOUNT_REQUESTS: "accounting_app_booking_discount_requests_v3",
  ACCOUNT_SUBSCRIPTIONS: "accounting_app_account_subscriptions_v3",
  COMPANY_SETTINGS: "accounting_app_company_settings_v3",
  LOCKED_DATES: "accounting_app_locked_dates_v3",
  NOTIFICATION_SETTINGS: "accounting_app_notification_settings_v3",
  MANUAL_NOTIFICATIONS: "accounting_app_manual_notifications_v3",
  MASTER_JOURNALS: "accounting_app_master_journals_v1",
};

// On startup, if the browser is online, clear stale local fallback locks so the app connects to Firestore
if (typeof window !== "undefined" && navigator.onLine) {
  try {
    localStorage.removeItem("accounting_app_use_local_fallback");
  } catch (_) {}
}

let useLocalFallback =
  typeof window !== "undefined" &&
  !navigator.onLine &&
  localStorage.getItem("accounting_app_use_local_fallback") === "true";
let consecutiveErrorCount = 0;
const ERROR_THRESHOLD = 15; // Resilience against transient contention

// Background Sync Queue to serialize Firestore writes and avoid contention on account documents
let backgroundSyncQueue = Promise.resolve();

async function enqueueBackgroundSync(task: () => Promise<void>) {
  backgroundSyncQueue = backgroundSyncQueue.then(async () => {
    try {
      await task();
    } catch (err) {
      // Errors are handled inside the task itself
    }
  });
  return backgroundSyncQueue;
}

// Validate Connection to Firestore on startup
async function testConnection() {
  if (typeof window === "undefined" || !navigator.onLine) return;
  try {
    await enableNetwork(db).catch(() => {});
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("✅ Firebase Firestore cloud connection verified successfully.");
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client is offline or network restricted.");
    }
  }
}
if (typeof window !== "undefined") {
  testConnection();
}

// Callbacks container
let accountsCallbacks: ((accounts: Account[]) => void)[] = [];
let currenciesCallbacks: ((currencies: Currency[]) => void)[] = [];
let tasksCallbacks: ((tasks: Task[]) => void)[] = [];
let transactionsCallbacks: ((transactions: Transaction[]) => void)[] = [];
let hallsCallbacks: ((halls: Hall[]) => void)[] = [];
let bookingsCallbacks: ((bookings: Booking[]) => void)[] = [];
let devicesCallbacks: ((devices: AuthorizedDevice[]) => void)[] = [];
let clientsCallbacks: ((clients: Client[]) => void)[] = [];
let employeesCallbacks: ((employees: Employee[]) => void)[] = [];
let servicesCallbacks: ((services: Service[]) => void)[] = [];
let usersCallbacks: ((users: User[]) => void)[] = [];
let rolesCallbacks: ((roles: Role[]) => void)[] = [];
let vouchersCallbacks: ((vouchers: ReceiptPayment[]) => void)[] = [];
let companyCallbacks: ((settings: CompanySettings[]) => void)[] = [];
let brokersCallbacks: ((brokers: Broker[]) => void)[] = [];
let guarantorsCallbacks: ((guarantors: Guarantor[]) => void)[] = [];
let bookingSettingsCallbacks: ((settings: BookingSettings[]) => void)[] = [];
let linkedAccountsCallbacks: ((accounts: LinkedAccounts[]) => void)[] = [];
let recurringCallbacks: ((recurring: any[]) => void)[] = [];
let payrollCallbacks: ((payroll: any[]) => void)[] = [];
let standardCostsCallbacks: ((standardCosts: any[]) => void)[] = [];
let actualCostsCallbacks: ((actualCosts: any[]) => void)[] = [];
let costItemsCallbacks: ((costItems: CostItem[]) => void)[] = [];
let depositRefundRequestsCallbacks: ((
  requests: DepositRefundRequest[],
) => void)[] = [];
let bookingAmendmentRequestsCallbacks: ((
  requests: BookingAmendmentRequest[],
) => void)[] = [];
let bookingDiscountRequestsCallbacks: ((
  requests: BookingDiscountRequest[],
) => void)[] = [];
let lockedDatesCallbacks: ((lockedDates: any[]) => void)[] = [];
let notificationSettingsCallbacks: ((settings: NotificationSetting[]) => void)[] = [];
let manualNotificationsCallbacks: ((notifications: ManualNotification[]) => void)[] = [];
let accountSubscriptionsCallbacks: ((subscriptions: AccountNotificationSubscription[]) => void)[] = [];
let masterJournalsCallbacks: ((vouchers: MasterJournalVoucher[]) => void)[] = [];

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSetting[] = [
  {
    id: "journal",
    title: "القيود المحاسبية وحركات اليومية",
    pwaEnabled: true,
    inAppEnabled: true,
    customTitle: "🧾 حركة مالية جديدة - {type} [{code}]",
    customBody: "المبلغ: {amount} {currency} | البيان: {description} | المستخدم: {user}",
  },
  {
    id: "booking",
    title: "حجوزات القاعات الجديدة",
    pwaEnabled: true,
    inAppEnabled: true,
    customTitle: "📅 حجز جديد [{code}]",
    customBody: "العميل: {customer} | تاريخ الحجز: {date} | الإجمالي: {price} {currency} | المستخدم: {user}",
  },
  {
    id: "amendment",
    title: "طلبات تعديل الحجوزات",
    pwaEnabled: true,
    inAppEnabled: true,
    customTitle: "📝 طلب تعديل حجز [{code}]",
    customBody: "الحجز: {bookingCode} | السبب: {reason} | المستخدم: {user}",
  },
  {
    id: "refund",
    title: "طلبات إلغاء ورد عربون",
    pwaEnabled: true,
    inAppEnabled: true,
    customTitle: "💰 طلب إلغاء ورد عربون [{code}]",
    customBody: "الحجز: {bookingCode} | المبلغ المطلوب رده: {amount} {currency} | المستخدم: {user}",
  },
  {
    id: "voucher",
    title: "سندات القبض والصرف",
    pwaEnabled: true,
    inAppEnabled: true,
    customTitle: "💵 سند مالي جديد - {type} [{code}]",
    customBody: "المبلغ: {amount} {currency} | البيان: {description} | المستخدم: {user}",
  },
  {
    id: "tasks",
    title: "المهام اليومية والنشاطات",
    pwaEnabled: true,
    inAppEnabled: true,
    customTitle: "📋 مهمة جديدة: {title}",
    customBody: "الأولوية: {priority} | الاستحقاق: {dueDate} | التفاصيل: {description}",
  },
  {
    id: "payroll",
    title: "مسيرات الرواتب والأجور",
    pwaEnabled: true,
    inAppEnabled: true,
    customTitle: "💰 اعتماد مسير رواتب جديد",
    customBody: "الشهر/العام: {monthYear} | إجمالي المسير: {totalAmount} {currency}",
  }
];

function getLocalData<T>(key: string, defaultVal: T): T {
  try {
    const val = localStorage.getItem(key);
    if (!val) {
      if (key === LOCAL_STORAGE_KEYS.NOTIFICATION_SETTINGS) {
        return DEFAULT_NOTIFICATION_SETTINGS as any;
      }
      return defaultVal;
    }
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) {
      // Deduplicate by item.id if present
      const unique = parsed.filter((item: any, idx: number, self: any[]) => {
        if (item && typeof item === "object" && "id" in item) {
          return self.findIndex((d: any) => d.id === item.id) === idx;
        }
        return true;
      });
      return unique as unknown as T;
    }
    return parsed;
  } catch {
    return defaultVal;
  }
}

/**
 * Recursively cleans an object for Firestore:
 * - Completely removes any keys with `undefined` values to prevent 'Unsupported field value: undefined' errors
 */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return undefined as unknown as T;
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return (obj as any[])
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  const result: any = {};
  for (const key of Object.keys(obj as any)) {
    const value = (obj as any)[key];
    if (value === undefined) {
      continue; // Skip undefined keys completely
    }
    result[key] = typeof value === "object" ? sanitizeForFirestore(value) : value;
  }
  return result as T;
}

/**
 * Strips large base64 strings (likely images) from an object to reduce its size.
 */
function stripLargeImages(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => stripLargeImages(item));
  }

  const result: any = {};
  for (const key in obj) {
    const value = obj[key];
    if (
      typeof value === "string" &&
      value.length > 50000 &&
      value.startsWith("data:image")
    ) {
      console.warn(
        `Stripping large image field: ${key} (size: ${value.length})`,
      );
      continue;
    }
    result[key] = typeof value === "object" ? stripLargeImages(value) : value;
  }
  return result;
}

function setLocalData<T>(key: string, data: T) {
  try {
    let finalData = data;
    if (Array.isArray(data)) {
      // Deduplicate on write as well
      finalData = data.filter((item: any, idx: number, self: any[]) => {
        if (item && typeof item === "object" && "id" in item) {
          return self.findIndex((d: any) => d.id === item.id) === idx;
        }
        return true;
      }) as unknown as T;
    }

    localStorage.setItem(key, JSON.stringify(finalData));
  } catch (err) {
    console.error("Local storage write error:", err);
    if (
      err instanceof Error &&
      (err.name === "QuotaExceededError" || err.message?.includes("quota"))
    ) {
      try {
        console.warn(
          `Quota exceeded for ${key}. Attempting to save without large images.`,
        );
        const stripped = stripLargeImages(data);
        localStorage.setItem(key, JSON.stringify(stripped));
      } catch (inner) {
        console.error("Critical storage failure:", inner);
      }
    }
  }
}

let activeSubscriptions: (() => void)[] = [];

export function forceCloudConnection() {
  localStorage.removeItem("accounting_app_use_local_fallback");
  enableNetwork(db).catch((err) =>
    console.error("Error enabling network:", err),
  );
  useLocalFallback = false;
  consecutiveErrorCount = 0;
  window.location.reload();
}

function switchToLocalFallback(err?: any) {
  if (useLocalFallback) return;

  // Increment error count for background failures
  if (err) {
    consecutiveErrorCount++;
    console.error(`Background error count: ${consecutiveErrorCount}`, err);
  }

  const isCriticalError =
    err &&
    (err.code === "permission-denied" ||
      err.code === "resource-exhausted" ||
      (typeof err.message === "string" &&
        (err.message.toLowerCase().includes("quota") ||
          err.message.toLowerCase().includes("resource-exhausted"))));

  // Only switch if threshold reached or it's a critical error
  if (!isCriticalError && consecutiveErrorCount < ERROR_THRESHOLD) {
    console.warn(
      `Transient sync error detected (${consecutiveErrorCount}/${ERROR_THRESHOLD}). Not switching to local fallback yet.`,
    );
    return;
  }

  let reason = "حدث انقطاع متكرر في الاتصال بالسحابة أو تجاوز الحصة المتاحة.";

  if (err) {
    console.error("Switching to local fallback due to error:", err);
    if (err.code === "permission-denied") {
      reason = "تم رفض الوصول (Permission Denied). يرجى مراجعة إعدادات الأمان.";
    } else if (err.code === "unavailable") {
      reason = "الخدمة السحابية غير متوفرة حالياً (Service Unavailable).";
    } else if (err.code === "resource-exhausted") {
      reason = "تم استهلاك حصة السحابة المتاحة (Quota Exceeded).";
    } else if (err.message) {
      if (err.message.includes("offline") || err.message.includes("network")) {
        reason = "حدث انقطاع في الاتصال بالإنترنت أو السحابة.";
      }
    }
  }

  console.warn("🔒 Fallback to local storage persistence triggered.");
  toast.error(
    `تنبيه: تم تفعيل وضع التخزين المحلي الآمن (Offline Mode). ${reason} بياناتك تُحفظ محلياً وبأمان كامل الآن لضمان استمرارية العمل.`,
    {
      duration: 10000,
      position: "bottom-center",
    },
  );
  useLocalFallback = true;
  try {
    localStorage.setItem("accounting_app_use_local_fallback", "true");
  } catch {}

  try {
    disableNetwork(db).catch((err) =>
      console.error("Error disabling network inside fallback:", err),
    );
  } catch (e) {
    console.error("Failed to disable network:", e);
  }

  // Unsubscribe all active Firestore listeners to prevent further quota/connection errors
  activeSubscriptions.forEach((unsub) => {
    try {
      unsub();
    } catch (e) {
      console.error("Failed to unsub snapshot:", e);
    }
  });
  activeSubscriptions = [];

  triggerAllCallbacks();
}

function resetErrorCount() {
  if (consecutiveErrorCount > 0) {
    console.log("✅ Successful cloud sync. Resetting error count.");
    consecutiveErrorCount = 0;
  }
}

function triggerAllCallbacks() {
  const accountData = getLocalData<Account[]>(LOCAL_STORAGE_KEYS.ACCOUNTS, []);
  accountsCallbacks.forEach((cb) => cb(accountData));

  const currencyData = getLocalData<Currency[]>(
    LOCAL_STORAGE_KEYS.CURRENCIES,
    [],
  );
  currenciesCallbacks.forEach((cb) => cb(currencyData));

  const taskData = getLocalData<Task[]>(LOCAL_STORAGE_KEYS.TASKS, []);
  tasksCallbacks.forEach((cb) => cb(taskData));

  const transactionData = getLocalData<Transaction[]>(
    LOCAL_STORAGE_KEYS.TRANSACTIONS,
    [],
  );
  transactionsCallbacks.forEach((cb) => cb(transactionData));

  const hallData = getLocalData<Hall[]>(LOCAL_STORAGE_KEYS.HALLS, []);
  hallsCallbacks.forEach((cb) => cb(hallData));

  const bookingData = getLocalData<Booking[]>(LOCAL_STORAGE_KEYS.BOOKINGS, []);
  bookingsCallbacks.forEach((cb) => cb(bookingData));

  const deviceData = getLocalData<AuthorizedDevice[]>(
    LOCAL_STORAGE_KEYS.DEVICES,
    [],
  );
  devicesCallbacks.forEach((cb) => cb(deviceData));

  const clientData = getLocalData<Client[]>(LOCAL_STORAGE_KEYS.CLIENTS, []);
  clientsCallbacks.forEach((cb) => cb(clientData));

  const employeeData = getLocalData<Employee[]>(
    LOCAL_STORAGE_KEYS.EMPLOYEES,
    [],
  );
  employeesCallbacks.forEach((cb) => cb(employeeData));

  const serviceData = getLocalData<Service[]>(LOCAL_STORAGE_KEYS.SERVICES, []);
  servicesCallbacks.forEach((cb) => cb(serviceData));

  const userData = getLocalData<User[]>(LOCAL_STORAGE_KEYS.USERS, []);
  usersCallbacks.forEach((cb) => cb(userData));

  const roleData = getLocalData<Role[]>(LOCAL_STORAGE_KEYS.ROLES, []);
  rolesCallbacks.forEach((cb) => cb(roleData));

  const voucherData = getLocalData<ReceiptPayment[]>(
    LOCAL_STORAGE_KEYS.VOUCHERS,
    [],
  );
  vouchersCallbacks.forEach((cb) => cb(voucherData));

  const companyData = getLocalData<CompanySettings[]>(
    LOCAL_STORAGE_KEYS.COMPANY,
    [],
  );
  companyCallbacks.forEach((cb) => cb(companyData));

  const brokerData = getLocalData<Broker[]>(LOCAL_STORAGE_KEYS.BROKERS, []);
  brokersCallbacks.forEach((cb) => cb(brokerData));

  const guarantorData = getLocalData<Guarantor[]>(
    LOCAL_STORAGE_KEYS.GUARANTORS,
    [],
  );
  guarantorsCallbacks.forEach((cb) => cb(guarantorData));

  const bookingSettingsData = getLocalData<BookingSettings[]>(
    LOCAL_STORAGE_KEYS.BOOKING_SETTINGS,
    [],
  );
  bookingSettingsCallbacks.forEach((cb) => cb(bookingSettingsData));

  const linkedAccountsData = getLocalData<LinkedAccounts[]>(
    LOCAL_STORAGE_KEYS.LINKED_ACCOUNTS,
    [],
  );
  linkedAccountsCallbacks.forEach((cb) => cb(linkedAccountsData));

  const recurringData = getLocalData<any[]>(LOCAL_STORAGE_KEYS.RECURRING, []);
  recurringCallbacks.forEach((cb) => cb(recurringData));

  const payrollData = getLocalData<any[]>(LOCAL_STORAGE_KEYS.PAYROLL, []);
  payrollCallbacks.forEach((cb) => cb(payrollData));

  const standardCostsData = getLocalData<any[]>(
    LOCAL_STORAGE_KEYS.STANDARD_COSTS,
    [],
  );
  standardCostsCallbacks.forEach((cb) => cb(standardCostsData));

  const actualCostsData = getLocalData<any[]>(
    LOCAL_STORAGE_KEYS.ACTUAL_COSTS,
    [],
  );
  actualCostsCallbacks.forEach((cb) => cb(actualCostsData));

  const costItemsData = getLocalData<CostItem[]>(
    LOCAL_STORAGE_KEYS.COST_ITEMS,
    [],
  );
  costItemsCallbacks.forEach((cb) => cb(costItemsData));

  const bookingAmendmentRequestsData = getLocalData<BookingAmendmentRequest[]>(
    LOCAL_STORAGE_KEYS.BOOKING_AMENDMENT_REQUESTS,
    [],
  );
  bookingAmendmentRequestsCallbacks.forEach((cb) =>
    cb(bookingAmendmentRequestsData),
  );

  const notificationSettingsData = getLocalData<NotificationSetting[]>(
    LOCAL_STORAGE_KEYS.NOTIFICATION_SETTINGS,
    [],
  );
  notificationSettingsCallbacks.forEach((cb) => cb(notificationSettingsData));

  const manualNotificationsData = getLocalData<ManualNotification[]>(
    LOCAL_STORAGE_KEYS.MANUAL_NOTIFICATIONS,
    [],
  );
  manualNotificationsCallbacks.forEach((cb) => cb(manualNotificationsData));
}

// Subscriptions
function createSubscription<T>(
  collectionName: string,
  callback: (data: T[]) => void,
  callbackArray: ((data: T[]) => void)[],
  localStorageKey: string,
  sortField?: string,
) {
  callbackArray.push(callback);

  // Serve currently cached Cloud data from localStorage immediately so the UI is instantaneous
  const cachedLocal = getLocalData<T[]>(localStorageKey, []);
  if (cachedLocal && cachedLocal.length > 0) {
    try {
      callback(cachedLocal);
    } catch (e) {
      console.warn("Initial local callback error:", e);
    }
  }

  if (useLocalFallback) {
    return () => {
      const idx = callbackArray.indexOf(callback);
      if (idx > -1) callbackArray.splice(idx, 1);
    };
  }

  const q = sortField
    ? query(collection(db, collectionName), orderBy(sortField, "desc"))
    : query(collection(db, collectionName));

  let unsubscribing = false;
  let unsub: () => void;

  try {
    unsub = onSnapshot(
      q,
      (snapshot) => {
        if (useLocalFallback) {
          if (!unsubscribing) {
            unsubscribing = true;
            unsub();
          }
          return;
        }
        const list: T[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as T);
        });
        callback(list);
        setLocalData(localStorageKey, list);
        resetErrorCount();
      },
      (err) => {
        if (!useLocalFallback) {
          console.warn(`Firestore subscription fallback on ${collectionName}:`, err?.message || err);
          switchToLocalFallback(err);
        }
      },
    );
  } catch (err) {
    if (!useLocalFallback) {
      console.warn(`Catch error subscribing to ${collectionName}:`, err);
      switchToLocalFallback(err);
    }
    return () => {
      const idx = callbackArray.indexOf(callback);
      if (idx > -1) callbackArray.splice(idx, 1);
    };
  }

  const wrappedUnsub = () => {
    if (!unsubscribing) {
      unsubscribing = true;
      try {
        unsub();
      } catch {}
    }
    const sIdx = activeSubscriptions.indexOf(wrappedUnsub);
    if (sIdx > -1) activeSubscriptions.splice(sIdx, 1);
  };

  activeSubscriptions.push(wrappedUnsub);

  return () => {
    wrappedUnsub();
    const idx = callbackArray.indexOf(callback);
    if (idx > -1) callbackArray.splice(idx, 1);
  };
}

export const subscribeAccounts = (cb: (data: Account[]) => void) =>
  createSubscription<Account>(
    "accounts",
    cb,
    accountsCallbacks,
    LOCAL_STORAGE_KEYS.ACCOUNTS,
    "code",
  );

export const subscribeCurrencies = (cb: (data: Currency[]) => void) =>
  createSubscription<Currency>(
    "currencies",
    cb,
    currenciesCallbacks,
    LOCAL_STORAGE_KEYS.CURRENCIES,
  );

export const subscribeTasks = (cb: (data: Task[]) => void) =>
  createSubscription<Task>(
    "tasks",
    cb,
    tasksCallbacks,
    LOCAL_STORAGE_KEYS.TASKS,
    "createdAt",
  );

export const subscribeTransactions = (cb: (data: Transaction[]) => void) =>
  createSubscription<Transaction>(
    "transactions",
    cb,
    transactionsCallbacks,
    LOCAL_STORAGE_KEYS.TRANSACTIONS,
    "createdAt",
  );

export const subscribeHalls = (cb: (data: Hall[]) => void) =>
  createSubscription<Hall>(
    "halls",
    cb,
    hallsCallbacks,
    LOCAL_STORAGE_KEYS.HALLS,
  );

export const subscribeBookings = (cb: (data: Booking[]) => void) =>
  createSubscription<Booking>(
    "bookings",
    cb,
    bookingsCallbacks,
    LOCAL_STORAGE_KEYS.BOOKINGS,
    "createdAt",
  );

export const subscribeDevices = (cb: (data: AuthorizedDevice[]) => void) =>
  createSubscription<AuthorizedDevice>(
    "authorized_devices",
    cb,
    devicesCallbacks,
    LOCAL_STORAGE_KEYS.DEVICES,
  );

export const subscribeClients = (cb: (data: Client[]) => void) =>
  createSubscription<Client>(
    "clients",
    cb,
    clientsCallbacks,
    LOCAL_STORAGE_KEYS.CLIENTS,
  );

export const subscribeEmployees = (cb: (data: Employee[]) => void) =>
  createSubscription<Employee>(
    "employees",
    cb,
    employeesCallbacks,
    LOCAL_STORAGE_KEYS.EMPLOYEES,
  );

export const subscribeServices = (cb: (data: Service[]) => void) =>
  createSubscription<Service>(
    "services",
    cb,
    servicesCallbacks,
    LOCAL_STORAGE_KEYS.SERVICES,
  );

export const subscribeAppUsers = (cb: (data: User[]) => void) =>
  createSubscription<User>(
    "app_users",
    cb,
    usersCallbacks,
    LOCAL_STORAGE_KEYS.USERS,
  );

export const subscribeAppRoles = (cb: (data: Role[]) => void) =>
  createSubscription<Role>(
    "app_roles",
    cb,
    rolesCallbacks,
    LOCAL_STORAGE_KEYS.ROLES,
  );

export const subscribeVouchers = (cb: (data: ReceiptPayment[]) => void) =>
  createSubscription<ReceiptPayment>(
    "vouchers",
    cb,
    vouchersCallbacks,
    LOCAL_STORAGE_KEYS.VOUCHERS,
    "createdAt",
  );

export const subscribeCompanySettings = (
  cb: (data: CompanySettings[]) => void,
) =>
  createSubscription<CompanySettings>(
    "company_settings",
    cb,
    companyCallbacks,
    LOCAL_STORAGE_KEYS.COMPANY,
  );

export const subscribeBrokers = (cb: (data: Broker[]) => void) =>
  createSubscription<Broker>(
    "brokers",
    cb,
    brokersCallbacks,
    LOCAL_STORAGE_KEYS.BROKERS,
    "createdAt",
  );

export const subscribeGuarantors = (cb: (data: Guarantor[]) => void) =>
  createSubscription<Guarantor>(
    "guarantors",
    cb,
    guarantorsCallbacks,
    LOCAL_STORAGE_KEYS.GUARANTORS,
    "createdAt",
  );

export const subscribeBookingSettings = (
  cb: (data: BookingSettings[]) => void,
) =>
  createSubscription<BookingSettings>(
    "booking_settings",
    cb,
    bookingSettingsCallbacks,
    LOCAL_STORAGE_KEYS.BOOKING_SETTINGS,
  );

export const subscribeLinkedAccounts = (
  cb: (data: LinkedAccounts[]) => void,
) =>
  createSubscription<LinkedAccounts>(
    "linked_accounts",
    cb,
    linkedAccountsCallbacks,
    LOCAL_STORAGE_KEYS.LINKED_ACCOUNTS,
  );

export const subscribeRecurringEntries = (cb: (data: any[]) => void) =>
  createSubscription<any>(
    "recurring",
    cb,
    recurringCallbacks,
    LOCAL_STORAGE_KEYS.RECURRING,
    "createdAt",
  );

export const subscribePayrollSheets = (cb: (data: any[]) => void) =>
  createSubscription<any>(
    "payroll",
    cb,
    payrollCallbacks,
    LOCAL_STORAGE_KEYS.PAYROLL,
    "createdAt",
  );

export const subscribeStandardCosts = (cb: (data: any[]) => void) =>
  createSubscription<any>(
    "standard_costs",
    cb,
    standardCostsCallbacks,
    LOCAL_STORAGE_KEYS.STANDARD_COSTS,
    "createdAt",
  );

export const subscribeActualCosts = (cb: (data: any[]) => void) =>
  createSubscription<any>(
    "actual_costs",
    cb,
    actualCostsCallbacks,
    LOCAL_STORAGE_KEYS.ACTUAL_COSTS,
    "createdAt",
  );

/**
 * Explicitly fetches all Cloud Firestore collections and writes them directly into LocalStorage,
 * ensuring the local device holds the exact, 100% current cloud data for uninterrupted offline work.
 */
export async function syncCloudDataToLocalStorage(): Promise<{
  accountsCount: number;
  usersCount: number;
  transactionsCount: number;
  bookingsCount: number;
  vouchersCount: number;
}> {
  cleanLegacyDefaultsFromLocalStorage();

  try {
    const [
      accountsSnap,
      usersSnap,
      rolesSnap,
      currenciesSnap,
      transactionsSnap,
      bookingsSnap,
      vouchersSnap,
      hallsSnap,
      clientsSnap,
      employeesSnap,
      servicesSnap,
      companySnap,
      bookingSettingsSnap,
      linkedAccountsSnap,
      devicesSnap,
    ] = await Promise.all([
      getDocs(collection(db, "accounts")),
      getDocs(collection(db, "app_users")),
      getDocs(collection(db, "app_roles")),
      getDocs(collection(db, "currencies")),
      getDocs(collection(db, "transactions")),
      getDocs(collection(db, "bookings")),
      getDocs(collection(db, "vouchers")),
      getDocs(collection(db, "halls")),
      getDocs(collection(db, "clients")),
      getDocs(collection(db, "employees")),
      getDocs(collection(db, "services")),
      getDocs(collection(db, "company_settings")),
      getDocs(collection(db, "booking_settings")),
      getDocs(collection(db, "linked_accounts")),
      getDocs(collection(db, "authorized_devices")),
    ]);

    const accounts: Account[] = [];
    accountsSnap.forEach((d) => accounts.push({ id: d.id, ...d.data() } as Account));
    setLocalData(LOCAL_STORAGE_KEYS.ACCOUNTS, accounts);
    accountsCallbacks.forEach((cb) => cb(accounts));

    const users: User[] = [];
    usersSnap.forEach((d) => users.push({ id: d.id, ...d.data() } as User));
    setLocalData(LOCAL_STORAGE_KEYS.USERS, users);
    usersCallbacks.forEach((cb) => cb(users));

    const roles: Role[] = [];
    rolesSnap.forEach((d) => roles.push({ id: d.id, ...d.data() } as Role));
    setLocalData(LOCAL_STORAGE_KEYS.ROLES, roles);
    rolesCallbacks.forEach((cb) => cb(roles));

    const currencies: Currency[] = [];
    currenciesSnap.forEach((d) => currencies.push({ id: d.id, ...d.data() } as Currency));
    setLocalData(LOCAL_STORAGE_KEYS.CURRENCIES, currencies);
    currenciesCallbacks.forEach((cb) => cb(currencies));

    const transactions: Transaction[] = [];
    transactionsSnap.forEach((d) => transactions.push({ id: d.id, ...d.data() } as Transaction));
    setLocalData(LOCAL_STORAGE_KEYS.TRANSACTIONS, transactions);
    transactionsCallbacks.forEach((cb) => cb(transactions));

    const bookings: Booking[] = [];
    bookingsSnap.forEach((d) => bookings.push({ id: d.id, ...d.data() } as Booking));
    setLocalData(LOCAL_STORAGE_KEYS.BOOKINGS, bookings);
    bookingsCallbacks.forEach((cb) => cb(bookings));

    const vouchers: ReceiptPayment[] = [];
    vouchersSnap.forEach((d) => vouchers.push({ id: d.id, ...d.data() } as ReceiptPayment));
    setLocalData(LOCAL_STORAGE_KEYS.VOUCHERS, vouchers);
    vouchersCallbacks.forEach((cb) => cb(vouchers));

    const halls: Hall[] = [];
    hallsSnap.forEach((d) => halls.push({ id: d.id, ...d.data() } as Hall));
    setLocalData(LOCAL_STORAGE_KEYS.HALLS, halls);
    hallsCallbacks.forEach((cb) => cb(halls));

    const clients: Client[] = [];
    clientsSnap.forEach((d) => clients.push({ id: d.id, ...d.data() } as Client));
    setLocalData(LOCAL_STORAGE_KEYS.CLIENTS, clients);
    clientsCallbacks.forEach((cb) => cb(clients));

    const employees: Employee[] = [];
    employeesSnap.forEach((d) => employees.push({ id: d.id, ...d.data() } as Employee));
    setLocalData(LOCAL_STORAGE_KEYS.EMPLOYEES, employees);
    employeesCallbacks.forEach((cb) => cb(employees));

    const services: Service[] = [];
    servicesSnap.forEach((d) => services.push({ id: d.id, ...d.data() } as Service));
    setLocalData(LOCAL_STORAGE_KEYS.SERVICES, services);
    servicesCallbacks.forEach((cb) => cb(services));

    const company: CompanySettings[] = [];
    companySnap.forEach((d) => company.push({ id: d.id, ...d.data() } as CompanySettings));
    setLocalData(LOCAL_STORAGE_KEYS.COMPANY, company);
    companyCallbacks.forEach((cb) => cb(company));

    const bookingSettings: BookingSettings[] = [];
    bookingSettingsSnap.forEach((d) => bookingSettings.push({ id: d.id, ...d.data() } as BookingSettings));
    setLocalData(LOCAL_STORAGE_KEYS.BOOKING_SETTINGS, bookingSettings);
    bookingSettingsCallbacks.forEach((cb) => cb(bookingSettings));

    const linkedAccounts: LinkedAccounts[] = [];
    linkedAccountsSnap.forEach((d) => linkedAccounts.push({ id: d.id, ...d.data() } as LinkedAccounts));
    setLocalData(LOCAL_STORAGE_KEYS.LINKED_ACCOUNTS, linkedAccounts);
    linkedAccountsCallbacks.forEach((cb) => cb(linkedAccounts));

    // Save authorized devices and cache the current device's cloud license locally
    const devices: AuthorizedDevice[] = [];
    devicesSnap.forEach((d) => devices.push({ id: d.id, ...d.data() } as AuthorizedDevice));
    setLocalData(LOCAL_STORAGE_KEYS.DEVICES, devices);
    devicesCallbacks.forEach((cb) => cb(devices));

    const currentUuid = typeof localStorage !== "undefined" ? localStorage.getItem("accounting_device_uuid") : null;
    if (currentUuid) {
      const matching = devices.find((d) => d.id === currentUuid);
      if (matching) {
        localStorage.setItem("accounting_cloud_device_license", JSON.stringify(matching));
        localStorage.setItem("accounting_active_device_license", JSON.stringify(matching));
        localStorage.setItem("accounting_cloud_device_synced_at", new Date().toISOString());
        localStorage.setItem("accounting_device_authorized_at_least_once", matching.isAuthorized ? "true" : "false");
        if (matching.allowedUserIds) {
          localStorage.setItem("guard_allowed_user_ids", JSON.stringify(matching.allowedUserIds));
        }
      }
    }

    localStorage.setItem("accounting_app_last_cloud_sync_time", new Date().toISOString());

    return {
      accountsCount: accounts.length,
      usersCount: users.length,
      transactionsCount: transactions.length,
      bookingsCount: bookings.length,
      vouchersCount: vouchers.length,
    };
  } catch (err: any) {
    console.error("Failed to sync cloud data to local storage:", err);
    throw err;
  }
}

// Generic Write Helpers
async function genericAdd<T>(
  collectionName: string,
  item: Omit<T, "id" | "createdAt" | "updatedAt"> | any,
  storageKey: string,
  callbacks: ((data: T[]) => void)[],
) {
  const coreCollections = ["accounts", "app_users", "app_roles", "currencies", "booking_settings", "linked_accounts"];
  if (useLocalFallback && coreCollections.includes(collectionName)) {
    toast.error("عذراً، لا يمكن إضافة أو تعديل الإعدادات الأساسية والحسابات وأدوات النظام في وضع عدم الاتصال (Offline Mode). يرجى الاتصال بالإنترنت.");
    throw new Error("Cannot modify core system tables in offline mode.");
  }
  const now = new Date().toISOString();
  const payload: any = {
    ...item,
    createdAt: now,
    updatedAt: now,
  };
  const customId = item.id;
  if (payload.id) delete payload.id;

  // 1. Load local data
  let list = getLocalData<T[]>(storageKey, []);

  // Calculate baseAmount for transactions if not present
  if (
    collectionName === "transactions" &&
    typeof payload.amount === "number" &&
    typeof payload.rate === "number"
  ) {
    if (payload.baseAmount === undefined) {
      payload.baseAmount = payload.amount * payload.rate;
    }
  }

  // Ensure unique sequence code
  if (
    collectionName === "transactions" ||
    collectionName === "vouchers" ||
    collectionName === "bookings" ||
    collectionName === "deposit_refund_requests"
  ) {
    if (!payload.sequenceCode) {
      let prefix = "";
      const year = new Date().getFullYear();
      if (collectionName === "transactions") {
        if (payload.type === "journal") prefix = "JRN";
        else prefix = "JRN"; // default to journal or maybe empty. Wait, all transactions in ledger are journal entries in a way.
      } else if (collectionName === "vouchers") {
        if (payload.type === "receipt") prefix = "REC";
        else if (payload.type === "payment") prefix = "PAY";
      } else if (collectionName === "bookings") {
        prefix = "BOK";
      } else if (collectionName === "deposit_refund_requests") {
        prefix = "DRR";
      }

      if (prefix) {
        let maxSeq = 0;

        // Get sequence starting numbers from Company Settings
        const companySettings = getLocalData<any>(
          LOCAL_STORAGE_KEYS.COMPANY_SETTINGS,
          {},
        );
        let startSequence = 0;
        if (companySettings && companySettings.sequenceStarts) {
          if (prefix === "BOK")
            startSequence = (companySettings.sequenceStarts.booking || 1) - 1;
          else if (prefix === "REC")
            startSequence = (companySettings.sequenceStarts.receipt || 1) - 1;
          else if (prefix === "PAY")
            startSequence = (companySettings.sequenceStarts.payment || 1) - 1;
          else if (prefix === "JRN")
            startSequence = (companySettings.sequenceStarts.journal || 1) - 1;
        }

        maxSeq = startSequence;

        list.forEach((existingItem: any) => {
          if (
            existingItem.sequenceCode &&
            existingItem.sequenceCode.startsWith(`${prefix}-${year}-`)
          ) {
            const parts = existingItem.sequenceCode.split("-");
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq) && seq > maxSeq) {
              maxSeq = seq;
            }
          }
        });
        const nextSeqStr = String(maxSeq + 1).padStart(4, "0");
        payload.sequenceCode = `${prefix}-${year}-${nextSeqStr}`;
      }
    }
  }

  const generatedId =
    customId ||
    payload.sequenceCode ||
    `doc-${Date.now()}-${Math.round(Math.random() * 1000000)}`;

  const newItem = { ...payload, id: generatedId } as unknown as T;

  list = list.filter((item: any) => item.id !== generatedId);
  list.push(newItem);
  setLocalData(storageKey, list);

  // 2. Instantly notify React states to update the UI
  callbacks.forEach((cb) => cb(list));

  if (useLocalFallback) {
    return generatedId;
  }

  // 3. Sync to Firestore in the background
  enqueueBackgroundSync(async () => {
    try {
      let finalPayload = sanitizeForFirestore({ ...payload });
      // Firestore document limit is 1MB.
      if (JSON.stringify(finalPayload).length > 800000) {
        finalPayload = stripLargeImages(finalPayload);
        console.warn(
          `Payload for ${collectionName} was too large for Firestore. Images were removed to save record.`,
        );
      }
      await setDoc(doc(db, collectionName, generatedId), finalPayload);
      resetErrorCount();
    } catch (err) {
      console.error(`Background Add failed for ${collectionName}:`, err);
      switchToLocalFallback(err);
    }
  });

  return generatedId;
}

async function genericUpdate<T>(
  collectionName: string,
  id: string,
  updates: Partial<T>,
  storageKey: string,
  callbacks: ((data: T[]) => void)[],
) {
  const coreCollections = ["accounts", "app_users", "app_roles", "currencies", "booking_settings", "linked_accounts"];
  if (useLocalFallback && coreCollections.includes(collectionName)) {
    toast.error("عذراً، لا يمكن تعديل الإعدادات الأساسية والحسابات وأدوات النظام في وضع عدم الاتصال (Offline Mode). يرجى الاتصال بالإنترنت.");
    throw new Error("Cannot modify core system tables in offline mode.");
  }
  const now = new Date().toISOString();
  const finalUpdates = { ...updates, updatedAt: now };

  // 1. Instantly write updates to local storage
  const list = getLocalData<T[]>(storageKey, []);
  let updated: T[];
  if (list.some((item: any) => item.id === id)) {
    updated = list.map((item: any) =>
      item.id === id ? { ...item, ...finalUpdates } : item,
    );
  } else {
    updated = [...list, { id, ...finalUpdates } as any];
  }
  setLocalData(storageKey, updated);

  // 2. Instantly notify React states to update the UI
  callbacks.forEach((cb) => cb(updated));

  if (useLocalFallback) {
    return;
  }

  // 3. Sync to Firestore in the background
  enqueueBackgroundSync(async () => {
    try {
      let dataToUpdate = sanitizeForFirestore({ ...finalUpdates }) as any;
      if (dataToUpdate.id) delete dataToUpdate.id;
      if (dataToUpdate.createdAt) delete dataToUpdate.createdAt;

      // Firestore document limit is 1MB.
      if (JSON.stringify(dataToUpdate).length > 800000) {
        dataToUpdate = stripLargeImages(dataToUpdate);
        console.warn(
          `Update for ${collectionName} was too large for Firestore. Images were removed to save record.`,
        );
      }

      await updateDoc(doc(db, collectionName, id), dataToUpdate as any);
      resetErrorCount();
    } catch (err: any) {
      if (
        err.code === "not-found" ||
        err.message?.includes("No document to update")
      ) {
        try {
          let fallbackData = sanitizeForFirestore({ ...updates }) as any;
          if (JSON.stringify(fallbackData).length > 800000) {
            fallbackData = stripLargeImages(fallbackData);
          }
          await setDoc(doc(db, collectionName, id), fallbackData, {
            merge: true,
          });
          resetErrorCount();
        } catch (innerErr) {
          console.error(
            `Background fallback setDoc failed for ${collectionName}:`,
            innerErr,
          );
          switchToLocalFallback(innerErr);
        }
      } else {
        console.error(`Background Update failed for ${collectionName}:`, err);
        switchToLocalFallback(err);
      }
    }
  });
}

async function genericDelete<T>(
  collectionName: string,
  id: string,
  storageKey: string,
  callbacks: ((data: T[]) => void)[],
) {
  const coreCollections = ["accounts", "app_users", "app_roles", "currencies", "booking_settings", "linked_accounts"];
  if (useLocalFallback && coreCollections.includes(collectionName)) {
    toast.error("عذراً، لا يمكن حذف الحسابات أو الإعدادات الأساسية في وضع عدم الاتصال (Offline Mode). يرجى الاتصال بالإنترنت.");
    throw new Error("Cannot delete core system tables in offline mode.");
  }
  // 1. Instantly write to local storage
  const list = getLocalData<T[]>(storageKey, []);
  const updated = list.filter((item: any) => item.id !== id);
  setLocalData(storageKey, updated);

  // 2. Instantly notify React states to update the UI
  callbacks.forEach((cb) => cb(updated));

  if (useLocalFallback) {
    return;
  }

  // 3. Sync to Firestore in the background
  enqueueBackgroundSync(async () => {
    try {
      await deleteDoc(doc(db, collectionName, id));
      resetErrorCount();
    } catch (err) {
      console.error(`Background Delete failed for ${collectionName}:`, err);
      switchToLocalFallback(err);
    }
  });
}

export function triggerLocalFallback() {
  switchToLocalFallback();
}

export function isUsingLocalFallback() {
  return useLocalFallback;
}

export function disableLocalFallback() {
  useLocalFallback = false;
  try {
    localStorage.removeItem("accounting_app_use_local_fallback");
  } catch {}
  try {
    enableNetwork(db).catch((err) =>
      console.error("Error enabling network:", err),
    );
  } catch (e) {
    console.error("Failed to enable network:", e);
  }
}

// Exports
export const addAccount = (item: any) =>
  genericAdd<Account>(
    "accounts",
    item,
    LOCAL_STORAGE_KEYS.ACCOUNTS,
    accountsCallbacks,
  );
export const updateAccount = (id: string, updates: any) =>
  genericUpdate<Account>(
    "accounts",
    id,
    updates,
    LOCAL_STORAGE_KEYS.ACCOUNTS,
    accountsCallbacks,
  );
export const deleteAccount = (id: string) =>
  genericDelete<Account>(
    "accounts",
    id,
    LOCAL_STORAGE_KEYS.ACCOUNTS,
    accountsCallbacks,
  );

export const addCurrency = (item: any) =>
  genericAdd<Currency>(
    "currencies",
    item,
    LOCAL_STORAGE_KEYS.CURRENCIES,
    currenciesCallbacks,
  );
export const updateCurrency = (id: string, updates: any) =>
  genericUpdate<Currency>(
    "currencies",
    id,
    updates,
    LOCAL_STORAGE_KEYS.CURRENCIES,
    currenciesCallbacks,
  );
export const deleteCurrency = (id: string) =>
  genericDelete<Currency>(
    "currencies",
    id,
    LOCAL_STORAGE_KEYS.CURRENCIES,
    currenciesCallbacks,
  );

export const addTask = (item: any) =>
  genericAdd<Task>("tasks", item, LOCAL_STORAGE_KEYS.TASKS, tasksCallbacks);
export const updateTask = (id: string, updates: any) =>
  genericUpdate<Task>(
    "tasks",
    id,
    updates,
    LOCAL_STORAGE_KEYS.TASKS,
    tasksCallbacks,
  );
export const deleteTask = (id: string) =>
  genericDelete<Task>("tasks", id, LOCAL_STORAGE_KEYS.TASKS, tasksCallbacks);

export const addHall = (item: any) =>
  genericAdd<Hall>("halls", item, LOCAL_STORAGE_KEYS.HALLS, hallsCallbacks);
export const updateHall = (id: string, updates: any) =>
  genericUpdate<Hall>(
    "halls",
    id,
    updates,
    LOCAL_STORAGE_KEYS.HALLS,
    hallsCallbacks,
  );
export const deleteHall = (id: string) =>
  genericDelete<Hall>("halls", id, LOCAL_STORAGE_KEYS.HALLS, hallsCallbacks);

export const addBooking = (item: any) => {
  const dates = item.eventDates || (item.eventDate ? [item.eventDate] : []);
  if (dates.some((d: string) => isDateLocked(d))) {
    throw new Error("عذراً، لا يمكن إضافة حجز في تاريخ مقفل.");
  }
  return genericAdd<Booking>(
    "bookings",
    item,
    LOCAL_STORAGE_KEYS.BOOKINGS,
    bookingsCallbacks,
  );
};
export const updateBooking = (id: string, updates: any) => {
  if (updates.eventDate && isDateLocked(updates.eventDate)) {
    throw new Error("عذراً، لا يمكن نقل الحجز إلى تاريخ مقفل.");
  }
  if (updates.eventDates && updates.eventDates.some((d: string) => isDateLocked(d))) {
    throw new Error("عذراً، لا يمكن تعديل الحجز ليشمل تواريخ مقفلة.");
  }
  return genericUpdate<Booking>(
    "bookings",
    id,
    updates,
    LOCAL_STORAGE_KEYS.BOOKINGS,
    bookingsCallbacks,
  );
};
export const deleteBooking = (id: string) => {
  const current = getLocalData<Booking[]>(LOCAL_STORAGE_KEYS.BOOKINGS, []);
  const booking = current.find(b => b.id === id);
  if (booking) {
    const dates = booking.eventDates || (booking.eventDate ? [booking.eventDate] : []);
    if (dates.some((d: string) => isDateLocked(d))) {
      throw new Error("عذراً، لا يمكن حذف حجز في تاريخ مقفل.");
    }
  }
  return genericDelete<Booking>(
    "bookings",
    id,
    LOCAL_STORAGE_KEYS.BOOKINGS,
    bookingsCallbacks,
  );
};

export const addDevice = (item: any) =>
  genericAdd<AuthorizedDevice>(
    "authorized_devices",
    item,
    LOCAL_STORAGE_KEYS.DEVICES,
    devicesCallbacks,
  );
export const updateDevice = (id: string, updates: any) =>
  genericUpdate<AuthorizedDevice>(
    "authorized_devices",
    id,
    updates,
    LOCAL_STORAGE_KEYS.DEVICES,
    devicesCallbacks,
  );
export const deleteDevice = (id: string) =>
  genericDelete<AuthorizedDevice>(
    "authorized_devices",
    id,
    LOCAL_STORAGE_KEYS.DEVICES,
    devicesCallbacks,
  );

export const addClient = (item: any) =>
  genericAdd<Client>(
    "clients",
    item,
    LOCAL_STORAGE_KEYS.CLIENTS,
    clientsCallbacks,
  );
export const updateClient = (id: string, updates: any) =>
  genericUpdate<Client>(
    "clients",
    id,
    updates,
    LOCAL_STORAGE_KEYS.CLIENTS,
    clientsCallbacks,
  );
export const deleteClient = (id: string) =>
  genericDelete<Client>(
    "clients",
    id,
    LOCAL_STORAGE_KEYS.CLIENTS,
    clientsCallbacks,
  );

export const addEmployee = (item: any) =>
  genericAdd<Employee>(
    "employees",
    item,
    LOCAL_STORAGE_KEYS.EMPLOYEES,
    employeesCallbacks,
  );
export const updateEmployee = (id: string, updates: any) =>
  genericUpdate<Employee>(
    "employees",
    id,
    updates,
    LOCAL_STORAGE_KEYS.EMPLOYEES,
    employeesCallbacks,
  );
export const deleteEmployee = (id: string) =>
  genericDelete<Employee>(
    "employees",
    id,
    LOCAL_STORAGE_KEYS.EMPLOYEES,
    employeesCallbacks,
  );

export const addService = (item: any) =>
  genericAdd<Service>(
    "services",
    item,
    LOCAL_STORAGE_KEYS.SERVICES,
    servicesCallbacks,
  );
export const updateService = (id: string, updates: any) =>
  genericUpdate<Service>(
    "services",
    id,
    updates,
    LOCAL_STORAGE_KEYS.SERVICES,
    servicesCallbacks,
  );
export const deleteService = (id: string) =>
  genericDelete<Service>(
    "services",
    id,
    LOCAL_STORAGE_KEYS.SERVICES,
    servicesCallbacks,
  );

export const addUser = (item: any) =>
  genericAdd<User>("app_users", item, LOCAL_STORAGE_KEYS.USERS, usersCallbacks);
export const updateUser = (id: string, updates: any) =>
  genericUpdate<User>(
    "app_users",
    id,
    updates,
    LOCAL_STORAGE_KEYS.USERS,
    usersCallbacks,
  );
export const deleteUser = (id: string) =>
  genericDelete<User>(
    "app_users",
    id,
    LOCAL_STORAGE_KEYS.USERS,
    usersCallbacks,
  );

export const addRole = (item: any) =>
  genericAdd<Role>("app_roles", item, LOCAL_STORAGE_KEYS.ROLES, rolesCallbacks);
export const updateRole = (id: string, updates: any) =>
  genericUpdate<Role>(
    "app_roles",
    id,
    updates,
    LOCAL_STORAGE_KEYS.ROLES,
    rolesCallbacks,
  );
export const deleteRole = (id: string) =>
  genericDelete<Role>(
    "app_roles",
    id,
    LOCAL_STORAGE_KEYS.ROLES,
    rolesCallbacks,
  );

export const addVoucher = (item: any) => {
  // Convert simple date string (like "2026-07-03") to a full local real-time ISO string
  if (item.date && !item.date.includes("T")) {
    const now = new Date();
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) {
      item.date = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      ).toISOString();
    }
  }
  if (item.voucherDate && !item.voucherDate.includes("T")) {
    const now = new Date();
    const d = new Date(item.voucherDate);
    if (!isNaN(d.getTime())) {
      item.voucherDate = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      ).toISOString();
    }
  }

  if (isDateLocked(item.date)) {
    throw new Error("عذراً، لا يمكن إضافة سند في تاريخ مقفل.");
  }
  return genericAdd<ReceiptPayment>(
    "vouchers",
    item,
    LOCAL_STORAGE_KEYS.VOUCHERS,
    vouchersCallbacks,
  );
};
export const updateVoucher = (id: string, updates: any) => {
  // Convert simple date string (like "2026-07-03") to a full local real-time ISO string
  if (updates.date && !updates.date.includes("T")) {
    const now = new Date();
    const d = new Date(updates.date);
    if (!isNaN(d.getTime())) {
      updates.date = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      ).toISOString();
    }
  }
  if (updates.voucherDate && !updates.voucherDate.includes("T")) {
    const now = new Date();
    const d = new Date(updates.voucherDate);
    if (!isNaN(d.getTime())) {
      updates.voucherDate = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      ).toISOString();
    }
  }

  if (updates.date && isDateLocked(updates.date)) {
    throw new Error("عذراً، لا يمكن تعديل السند إلى تاريخ مقفل.");
  }
  return genericUpdate<ReceiptPayment>(
    "vouchers",
    id,
    updates,
    LOCAL_STORAGE_KEYS.VOUCHERS,
    vouchersCallbacks,
  );
};
export const deleteVoucher = (id: string) =>
  genericDelete<ReceiptPayment>(
    "vouchers",
    id,
    LOCAL_STORAGE_KEYS.VOUCHERS,
    vouchersCallbacks,
  );

export const updateCompanySettings = (id: string, updates: any) =>
  genericUpdate<CompanySettings>(
    "company_settings",
    id,
    updates,
    LOCAL_STORAGE_KEYS.COMPANY,
    companyCallbacks,
  );

export const addCompanySettings = (item: any) =>
  genericAdd<CompanySettings>(
    "company_settings",
    item,
    LOCAL_STORAGE_KEYS.COMPANY,
    companyCallbacks,
  );

export const addBroker = (item: any) =>
  genericAdd<Broker>(
    "brokers",
    item,
    LOCAL_STORAGE_KEYS.BROKERS,
    brokersCallbacks,
  );
export const updateBroker = (id: string, updates: any) =>
  genericUpdate<Broker>(
    "brokers",
    id,
    updates,
    LOCAL_STORAGE_KEYS.BROKERS,
    brokersCallbacks,
  );
export const deleteBroker = (id: string) =>
  genericDelete<Broker>(
    "brokers",
    id,
    LOCAL_STORAGE_KEYS.BROKERS,
    brokersCallbacks,
  );

export const addGuarantor = (item: any) =>
  genericAdd<Guarantor>(
    "guarantors",
    item,
    LOCAL_STORAGE_KEYS.GUARANTORS,
    guarantorsCallbacks,
  );
export const updateGuarantor = (id: string, updates: any) =>
  genericUpdate<Guarantor>(
    "guarantors",
    id,
    updates,
    LOCAL_STORAGE_KEYS.GUARANTORS,
    guarantorsCallbacks,
  );
export const deleteGuarantor = (id: string) =>
  genericDelete<Guarantor>(
    "guarantors",
    id,
    LOCAL_STORAGE_KEYS.GUARANTORS,
    guarantorsCallbacks,
  );

export const addBookingSettings = (item: any) =>
  genericAdd<BookingSettings>(
    "booking_settings",
    item,
    LOCAL_STORAGE_KEYS.BOOKING_SETTINGS,
    bookingSettingsCallbacks,
  );
export const updateBookingSettings = (id: string, updates: any) =>
  genericUpdate<BookingSettings>(
    "booking_settings",
    id,
    updates,
    LOCAL_STORAGE_KEYS.BOOKING_SETTINGS,
    bookingSettingsCallbacks,
  );

export const addLinkedAccounts = (item: any) =>
  genericAdd<LinkedAccounts>(
    "linked_accounts",
    item,
    LOCAL_STORAGE_KEYS.LINKED_ACCOUNTS,
    linkedAccountsCallbacks,
  );
export const updateLinkedAccounts = (id: string, updates: any) =>
  genericUpdate<LinkedAccounts>(
    "linked_accounts",
    id,
    updates,
    LOCAL_STORAGE_KEYS.LINKED_ACCOUNTS,
    linkedAccountsCallbacks,
  );

export const addTransaction = (item: any) =>
  genericAdd<Transaction>(
    "transactions",
    item,
    LOCAL_STORAGE_KEYS.TRANSACTIONS,
    transactionsCallbacks,
  );
export const updateTransaction = (id: string, updates: any) => {
  // Convert simple date string (like "2026-07-03") to a full local real-time ISO string
  if (updates.date && !updates.date.includes("T")) {
    const now = new Date();
    const d = new Date(updates.date);
    if (!isNaN(d.getTime())) {
      updates.date = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      ).toISOString();
    }
  }
  if (updates.voucherDate && !updates.voucherDate.includes("T")) {
    const now = new Date();
    const d = new Date(updates.voucherDate);
    if (!isNaN(d.getTime())) {
      updates.voucherDate = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      ).toISOString();
    }
  }

  if (updates.date && isDateLocked(updates.date)) {
    throw new Error("عذراً، لا يمكن تعديل القيد إلى تاريخ مقفل.");
  }
  return genericUpdate<Transaction>(
    "transactions",
    id,
    updates,
    LOCAL_STORAGE_KEYS.TRANSACTIONS,
    transactionsCallbacks,
  );
};
export const deleteTransaction = (id: string) => {
  const current = getLocalData<Transaction[]>(LOCAL_STORAGE_KEYS.TRANSACTIONS, []);
  const transaction = current.find(t => t.id === id);
  if (transaction && isDateLocked(transaction.date)) {
    throw new Error("عذراً، لا يمكن حذف قيد في تاريخ مقفل.");
  }
  return genericDelete<Transaction>(
    "transactions",
    id,
    LOCAL_STORAGE_KEYS.TRANSACTIONS,
    transactionsCallbacks,
  );
};

export const addRecurringEntry = (item: any) =>
  genericAdd<any>(
    "recurring",
    item,
    LOCAL_STORAGE_KEYS.RECURRING,
    recurringCallbacks,
  );
export const updateRecurringEntry = (id: string, updates: any) =>
  genericUpdate<any>(
    "recurring",
    id,
    updates,
    LOCAL_STORAGE_KEYS.RECURRING,
    recurringCallbacks,
  );
export const deleteRecurringEntry = (id: string) =>
  genericDelete<any>(
    "recurring",
    id,
    LOCAL_STORAGE_KEYS.RECURRING,
    recurringCallbacks,
  );

export const addPayrollSheet = (item: any) =>
  genericAdd<any>(
    "payroll",
    item,
    LOCAL_STORAGE_KEYS.PAYROLL,
    payrollCallbacks,
  );
export const updatePayrollSheet = (id: string, updates: any) =>
  genericUpdate<any>(
    "payroll",
    id,
    updates,
    LOCAL_STORAGE_KEYS.PAYROLL,
    payrollCallbacks,
  );
export const deletePayrollSheet = (id: string) =>
  genericDelete<any>(
    "payroll",
    id,
    LOCAL_STORAGE_KEYS.PAYROLL,
    payrollCallbacks,
  );

export const addStandardCost = (item: any) =>
  genericAdd<any>(
    "standard_costs",
    item,
    LOCAL_STORAGE_KEYS.STANDARD_COSTS,
    standardCostsCallbacks,
  );
export const updateStandardCost = (id: string, updates: any) =>
  genericUpdate<any>(
    "standard_costs",
    id,
    updates,
    LOCAL_STORAGE_KEYS.STANDARD_COSTS,
    standardCostsCallbacks,
  );
export const deleteStandardCost = (id: string) =>
  genericDelete<any>(
    "standard_costs",
    id,
    LOCAL_STORAGE_KEYS.STANDARD_COSTS,
    standardCostsCallbacks,
  );

export const addActualCost = (item: any) => {
  if (item.date && isDateLocked(item.date)) {
    throw new Error("عذراً، لا يمكن إضافة تكاليف في تاريخ مقفل.");
  }
  return genericAdd<any>(
    "actual_costs",
    item,
    LOCAL_STORAGE_KEYS.ACTUAL_COSTS,
    actualCostsCallbacks,
  );
};
export const updateActualCost = (id: string, updates: any) => {
  if (updates.date && isDateLocked(updates.date)) {
    throw new Error("عذراً، لا يمكن تعديل تكاليف في تاريخ مقفل.");
  }
  return genericUpdate<any>(
    "actual_costs",
    id,
    updates,
    LOCAL_STORAGE_KEYS.ACTUAL_COSTS,
    actualCostsCallbacks,
  );
};
export const deleteActualCost = (id: string) => {
  const current = getLocalData<any[]>(LOCAL_STORAGE_KEYS.ACTUAL_COSTS, []);
  const item = current.find(x => x.id === id);
  if (item && item.date && isDateLocked(item.date)) {
    throw new Error("عذراً، لا يمكن حذف تكاليف في تاريخ مقفل.");
  }
  return genericDelete<any>(
    "actual_costs",
    id,
    LOCAL_STORAGE_KEYS.ACTUAL_COSTS,
    actualCostsCallbacks,
  );
};

export const subscribeCostItems = (cb: (data: CostItem[]) => void) =>
  createSubscription<CostItem>(
    "cost_items",
    cb,
    costItemsCallbacks,
    LOCAL_STORAGE_KEYS.COST_ITEMS,
    "createdAt",
  );
export const addCostItem = (item: any) =>
  genericAdd<CostItem>(
    "cost_items",
    item,
    LOCAL_STORAGE_KEYS.COST_ITEMS,
    costItemsCallbacks,
  );
export const updateCostItem = (id: string, updates: any) =>
  genericUpdate<CostItem>(
    "cost_items",
    id,
    updates,
    LOCAL_STORAGE_KEYS.COST_ITEMS,
    costItemsCallbacks,
  );
export const deleteCostItem = (id: string) =>
  genericDelete<CostItem>(
    "cost_items",
    id,
    LOCAL_STORAGE_KEYS.COST_ITEMS,
    costItemsCallbacks,
  );

export const subscribeDepositRefundRequests = (
  cb: (data: DepositRefundRequest[]) => void,
) =>
  createSubscription<DepositRefundRequest>(
    "deposit_refund_requests",
    cb,
    depositRefundRequestsCallbacks,
    LOCAL_STORAGE_KEYS.DEPOSIT_REFUND_REQUESTS,
    "createdAt",
  );

// --- Date Locking System ---
let lockedDatesCache: string[] = [];

export const isDateLocked = (dateStr: string) => {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    // We use YYYY-MM-DD for comparison
    const targetDate = d.toISOString().split("T")[0];
    return lockedDatesCache.includes(targetDate);
  } catch (e) {
    return false;
  }
};

export const subscribeLockedDates = (cb: (data: any[]) => void) =>
  createSubscription<any>(
    "locked_dates",
    (data) => {
      lockedDatesCache = data.map((d: any) => d.id);
      cb(data);
    },
    lockedDatesCallbacks,
    LOCAL_STORAGE_KEYS.LOCKED_DATES,
  );

export const lockDay = async (dateId: string, lockedBy: string) => {
  const item = {
    id: dateId,
    isLocked: true,
    lockedAt: new Date().toISOString(),
    lockedBy,
  };
  await setDoc(doc(db, "locked_dates", dateId), item);
  // Trigger local updates
  const current = getLocalData<any[]>(LOCAL_STORAGE_KEYS.LOCKED_DATES, []);
  const updated = [...current.filter((x) => x.id !== dateId), item];
  localStorage.setItem(LOCAL_STORAGE_KEYS.LOCKED_DATES, JSON.stringify(updated));
  lockedDatesCallbacks.forEach((cb) => cb(updated));
};

export const unlockDay = async (dateId: string) => {
  await deleteDoc(doc(db, "locked_dates", dateId));
  // Trigger local updates
  const current = getLocalData<any[]>(LOCAL_STORAGE_KEYS.LOCKED_DATES, []);
  const updated = current.filter((x) => x.id !== dateId);
  localStorage.setItem(LOCAL_STORAGE_KEYS.LOCKED_DATES, JSON.stringify(updated));
  lockedDatesCallbacks.forEach((cb) => cb(updated));
};
export const addDepositRefundRequest = (item: any) =>
  genericAdd<DepositRefundRequest>(
    "deposit_refund_requests",
    item,
    LOCAL_STORAGE_KEYS.DEPOSIT_REFUND_REQUESTS,
    depositRefundRequestsCallbacks,
  );
export const updateDepositRefundRequest = (id: string, updates: any) =>
  genericUpdate<DepositRefundRequest>(
    "deposit_refund_requests",
    id,
    updates,
    LOCAL_STORAGE_KEYS.DEPOSIT_REFUND_REQUESTS,
    depositRefundRequestsCallbacks,
  );
export const deleteDepositRefundRequest = (id: string) =>
  genericDelete<DepositRefundRequest>(
    "deposit_refund_requests",
    id,
    LOCAL_STORAGE_KEYS.DEPOSIT_REFUND_REQUESTS,
    depositRefundRequestsCallbacks,
  );

export const subscribeBookingAmendmentRequests = (
  cb: (data: BookingAmendmentRequest[]) => void,
) =>
  createSubscription<BookingAmendmentRequest>(
    "booking_amendment_requests",
    cb,
    bookingAmendmentRequestsCallbacks,
    LOCAL_STORAGE_KEYS.BOOKING_AMENDMENT_REQUESTS,
    "createdAt",
  );
export const addBookingAmendmentRequest = (item: any) =>
  genericAdd<BookingAmendmentRequest>(
    "booking_amendment_requests",
    item,
    LOCAL_STORAGE_KEYS.BOOKING_AMENDMENT_REQUESTS,
    bookingAmendmentRequestsCallbacks,
  );
export const updateBookingAmendmentRequest = (id: string, updates: any) =>
  genericUpdate<BookingAmendmentRequest>(
    "booking_amendment_requests",
    id,
    updates,
    LOCAL_STORAGE_KEYS.BOOKING_AMENDMENT_REQUESTS,
    bookingAmendmentRequestsCallbacks,
  );
export const deleteBookingAmendmentRequest = (id: string) =>
  genericDelete<BookingAmendmentRequest>(
    "booking_amendment_requests",
    id,
    LOCAL_STORAGE_KEYS.BOOKING_AMENDMENT_REQUESTS,
    bookingAmendmentRequestsCallbacks,
  );

export const subscribeBookingDiscountRequests = (
  cb: (data: BookingDiscountRequest[]) => void,
) =>
  createSubscription<BookingDiscountRequest>(
    "booking_discount_requests",
    cb,
    bookingDiscountRequestsCallbacks,
    LOCAL_STORAGE_KEYS.BOOKING_DISCOUNT_REQUESTS,
    "createdAt",
  );
export const addBookingDiscountRequest = (item: any) =>
  genericAdd<BookingDiscountRequest>(
    "booking_discount_requests",
    item,
    LOCAL_STORAGE_KEYS.BOOKING_DISCOUNT_REQUESTS,
    bookingDiscountRequestsCallbacks,
  );
export const updateBookingDiscountRequest = (id: string, updates: any) =>
  genericUpdate<BookingDiscountRequest>(
    "booking_discount_requests",
    id,
    updates,
    LOCAL_STORAGE_KEYS.BOOKING_DISCOUNT_REQUESTS,
    bookingDiscountRequestsCallbacks,
  );
export const deleteBookingDiscountRequest = (id: string) =>
  genericDelete<BookingDiscountRequest>(
    "booking_discount_requests",
    id,
    LOCAL_STORAGE_KEYS.BOOKING_DISCOUNT_REQUESTS,
    bookingDiscountRequestsCallbacks,
  );

export const subscribeNotificationSettings = (
  cb: (data: NotificationSetting[]) => void,
) =>
  createSubscription<NotificationSetting>(
    "notification_settings",
    cb,
    notificationSettingsCallbacks,
    LOCAL_STORAGE_KEYS.NOTIFICATION_SETTINGS,
  );

export const updateNotificationSetting = (id: string, updates: any) =>
  genericUpdate<NotificationSetting>(
    "notification_settings",
    id,
    updates,
    LOCAL_STORAGE_KEYS.NOTIFICATION_SETTINGS,
    notificationSettingsCallbacks,
  );

export const subscribeManualNotifications = (
  cb: (data: ManualNotification[]) => void,
) =>
  createSubscription<ManualNotification>(
    "manual_notifications",
    cb,
    manualNotificationsCallbacks,
    LOCAL_STORAGE_KEYS.MANUAL_NOTIFICATIONS,
    "createdAt",
  );

export const subscribeAccountSubscriptions = (
  cb: (data: AccountNotificationSubscription[]) => void,
) =>
  createSubscription<AccountNotificationSubscription>(
    "account_notification_subscriptions",
    cb,
    accountSubscriptionsCallbacks,
    LOCAL_STORAGE_KEYS.ACCOUNT_SUBSCRIPTIONS,
    "id",
  );

export const addManualNotification = (item: Omit<ManualNotification, "id">) =>
  genericAdd<ManualNotification>(
    "manual_notifications",
    item,
    LOCAL_STORAGE_KEYS.MANUAL_NOTIFICATIONS,
    manualNotificationsCallbacks,
  );

export const updateManualNotification = (id: string, updates: Partial<ManualNotification>) =>
  genericUpdate<ManualNotification>(
    "manual_notifications",
    id,
    updates,
    LOCAL_STORAGE_KEYS.MANUAL_NOTIFICATIONS,
    manualNotificationsCallbacks,
  );

export const deleteManualNotification = (id: string) =>
  genericDelete<ManualNotification>(
    "manual_notifications",
    id,
    LOCAL_STORAGE_KEYS.MANUAL_NOTIFICATIONS,
    manualNotificationsCallbacks,
  );

// Complex Transaction Handling remains specific
export async function addTransactionWithDoubleEntry(
  txData: Omit<Transaction, "id" | "createdAt">,
  currencies: Currency[],
  accounts: Account[],
) {
  // Convert simple date string (like "2026-07-03") to a full local real-time ISO string
  if (txData.date && !txData.date.includes("T")) {
    const now = new Date();
    const d = new Date(txData.date);
    if (!isNaN(d.getTime())) {
      txData.date = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      ).toISOString();
    }
  }
  
  if (txData.voucherDate && !txData.voucherDate.includes("T")) {
    const now = new Date();
    const d = new Date(txData.voucherDate);
    if (!isNaN(d.getTime())) {
      txData.voucherDate = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      ).toISOString();
    }
  }

  if (isDateLocked(txData.date)) {
    const todayStr = new Date().toISOString().split("T")[0];
    if (!isDateLocked(todayStr)) {
      txData.date = todayStr;
      if (txData.voucherDate) txData.voucherDate = new Date().toISOString().split("T")[0];
    } else {
      throw new Error("عذراً، لا يمكن إضافة قيد في تاريخ مقفل.");
    }
  }
  // Check for duplicate entry based on sourceId if present (check locally first)
  if (txData.sourceId && txData.sourceType) {
    const localTxs = getLocalData<Transaction[]>(
      LOCAL_STORAGE_KEYS.TRANSACTIONS,
      [],
    );
    const duplicate = localTxs.find(
      (t) =>
        t.sourceId === txData.sourceId &&
        t.sourceType === txData.sourceType &&
        t.debitAccountId === txData.debitAccountId &&
        t.creditAccountId === txData.creditAccountId,
    );
    if (duplicate) {
      console.log(
        "Duplicate transaction detected for source:",
        txData.sourceId,
        "Returning existing ID.",
      );
      return duplicate.id;
    }
  }

  // Auto-calculate baseAmount
  if (txData.baseAmount === undefined) {
    txData.baseAmount = txData.amount * (txData.rate || 1);
  }

  const localTxs = getLocalData<Transaction[]>(
    LOCAL_STORAGE_KEYS.TRANSACTIONS,
    [],
  );

  // Generate sequence code
  if (!txData.sequenceCode) {
    let prefix = txData.sourceType === "booking" ? "BOK" : "JRN";
    const year = new Date().getFullYear();
    let maxSeq = 0;

    // Get sequence starting numbers from Company Settings
    const companySettings = getLocalData<any>(
      LOCAL_STORAGE_KEYS.COMPANY_SETTINGS,
      {},
    );
    let startSequence = 0;
    if (companySettings && companySettings.sequenceStarts) {
      if (prefix === "JRN")
        startSequence = (companySettings.sequenceStarts.journal || 1) - 1;
    }
    maxSeq = startSequence;

    localTxs.forEach((t) => {
      if (t.sequenceCode && t.sequenceCode.startsWith(`${prefix}-${year}-`)) {
        const parts = t.sequenceCode.split("-");
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    const nextSeqStr = String(maxSeq + 1).padStart(4, "0");
    txData.sequenceCode = `${prefix}-${year}-${nextSeqStr}`;
  }

  // Generate a custom ID for the transaction using sequenceCode
  const generatedTxId =
    txData.sequenceCode ||
    `tx-${Date.now()}-${Math.round(Math.random() * 1000000)}`;

  // 1. Calculate local impact on accounts and update local state instantly
  const localAccounts = getLocalData<Account[]>(
    LOCAL_STORAGE_KEYS.ACCOUNTS,
    [],
  );
  // Find accounts by ID or by Code
  let debitAcc = localAccounts.find(
    (a) => a.id === txData.debitAccountId || a.code === txData.debitAccountId,
  );
  let creditAcc = localAccounts.find(
    (a) => a.id === txData.creditAccountId || a.code === txData.creditAccountId,
  );

  let localUpdated = false;

  if (!debitAcc) {
    debitAcc =
      localAccounts.find(
        (a) => a.id === txData.debitAccountId || a.code === txData.debitAccountId,
      ) ||
      localAccounts.find(
        (a) => a.isTransactional && (a.type === "asset" || a.name?.includes("صندوق")),
      ) ||
      localAccounts.find((a) => a.isTransactional) ||
      localAccounts[0] ||
      null;
  }

  if (!creditAcc) {
    creditAcc =
      localAccounts.find(
        (a) => a.id === txData.creditAccountId || a.code === txData.creditAccountId,
      ) ||
      localAccounts.find(
        (a) =>
          a.isTransactional &&
          (a.type === "liability" ||
            a.type === "revenue" ||
            a.name?.includes("عملاء") ||
            a.name?.includes("زبائن")),
      ) ||
      localAccounts.find((a) => a.isTransactional) ||
      localAccounts[1] ||
      null;
  }

  if (debitAcc) txData.debitAccountId = debitAcc.id;
  if (creditAcc) txData.creditAccountId = creditAcc.id;

  const amountInBase = txData.amount * txData.rate;
  const debitCurr = currencies.find((c) => c.code === debitAcc?.currency) || {
    rateToBase: 1,
  };
  const creditCurr = currencies.find((c) => c.code === creditAcc?.currency) || {
    rateToBase: 1,
  };

  if (debitAcc) {
    const debitImpact = amountInBase * debitCurr.rateToBase;
    if (debitAcc.type === "asset" || debitAcc.type === "expense")
      debitAcc.balance += debitImpact;
    else debitAcc.balance -= debitImpact;
    debitAcc.balance = Number(debitAcc.balance.toFixed(4));
  }

  if (creditAcc) {
    const creditImpact = amountInBase * creditCurr.rateToBase;
    if (
      creditAcc.type === "liability" ||
      creditAcc.type === "equity" ||
      creditAcc.type === "revenue"
    )
      creditAcc.balance += creditImpact;
    else creditAcc.balance -= creditImpact;
    creditAcc.balance = Number(creditAcc.balance.toFixed(4));
  }

  setLocalData(LOCAL_STORAGE_KEYS.ACCOUNTS, localAccounts);

  // 2. Unshift new transaction to local storage
  const newTx = {
    ...txData,
    id: generatedTxId,
    createdAt: new Date().toISOString(),
  };
  localTxs.unshift(newTx as any);
  setLocalData(LOCAL_STORAGE_KEYS.TRANSACTIONS, localTxs);

  // 3. Trigger all React callbacks to instantly render updated state in the frontend
  triggerAllCallbacks();

  if (useLocalFallback) {
    return generatedTxId;
  }

  // 4. Run Firestore transaction in background using serialized queue
  enqueueBackgroundSync(async () => {
    try {
      const txRef = doc(db, "transactions", generatedTxId);
      const debitAccRef = doc(db, "accounts", txData.debitAccountId);
      const creditAccRef = doc(db, "accounts", txData.creditAccountId);

      await runTransaction(db, async (t) => {
        const debitDoc = await t.get(debitAccRef);
        const creditDoc = await t.get(creditAccRef);

        let activeDebit: Account | null = debitDoc.exists()
          ? (debitDoc.data() as Account)
          : null;
        let activeCredit: Account | null = creditDoc.exists()
          ? (creditDoc.data() as Account)
          : null;

        if (debitDoc.exists()) {
          activeDebit = debitDoc.data() as Account;
        }
        if (creditDoc.exists()) {
          activeCredit = creditDoc.data() as Account;
        }

        const cleanTx = sanitizeForFirestore({
          ...txData,
          createdAt: new Date().toISOString(),
        });
        t.set(txRef, cleanTx);

        if (activeDebit) {
          const dCurr = currencies.find(
            (c) => c.code === activeDebit!.currency,
          ) || { rateToBase: 1 };
          const dImpact = amountInBase * dCurr.rateToBase;
          let nDebitBal = activeDebit.balance;
          if (activeDebit.type === "asset" || activeDebit.type === "expense")
            nDebitBal += dImpact;
          else nDebitBal -= dImpact;
          t.update(debitAccRef, { balance: Number(nDebitBal.toFixed(4)) });
        }

        if (activeCredit) {
          const cCurr = currencies.find(
            (c) => c.code === activeCredit!.currency,
          ) || { rateToBase: 1 };
          const cImpact = amountInBase * cCurr.rateToBase;
          let nCreditBal = activeCredit.balance;
          if (
            activeCredit.type === "liability" ||
            activeCredit.type === "equity" ||
            activeCredit.type === "revenue"
          )
            nCreditBal += cImpact;
          else nCreditBal -= cImpact;
          t.update(creditAccRef, { balance: Number(nCreditBal.toFixed(4)) });
        }
      });
      resetErrorCount();
    } catch (err) {
      console.error("Background double-entry transaction sync failed:", err);
      // Retry logic for contention can be added here if needed, but the queue should handle it
      switchToLocalFallback(err);
    }
  });

  return generatedTxId;
}

// Booking Accounting Workflow
export async function processBookingAction(
  action: "SAVE_BOOKING" | "ACCRUE" | "EXECUTE" | "LIQUIDATE",
  booking: Booking,
  currencies: Currency[],
  accounts: Account[],
  settings: any,
  createdBy: string = "System",
) {
  const dates = booking.eventDates || (booking.eventDate ? [booking.eventDate] : []);
  if (dates.some((d: string) => isDateLocked(d))) {
    throw new Error("عذراً، لا يمكن معالجة حجز في تاريخ مقفل.");
  }

  const transactionPromises: Promise<string>[] = [];

  const localTxsList = getLocalData<Transaction[]>(
    LOCAL_STORAGE_KEYS.TRANSACTIONS,
    [],
  );
  const isBookingAlreadyAudited = localTxsList.some((t) => {
    const sId = t.sourceId || "";
    const bId = booking.id;
    const bSeq = booking.sequenceCode;
    return (
      (sId === bId ||
        (bSeq && sId === bSeq) ||
        sId.startsWith(`${bId}-`) ||
        (bSeq && sId.startsWith(`${bSeq}-`))) &&
      t.status === "audited"
    );
  });
  const autoAuditProps: any = isBookingAlreadyAudited
    ? {
        status: "audited",
        auditedBy: createdBy,
        auditedAt: new Date().toISOString(),
        auditNotes: "اعتماد تلقائي تبعاً لاعتماد الحجز",
      }
    : {};

  const storedLinked = getLocalData<any>(LOCAL_STORAGE_KEYS.LINKED_ACCOUNTS, [])?.[0] || {};
  const activeSettings = {
    ...storedLinked,
    ...(settings || {})
  };

  const resolveClientAccountId = (settingAccId?: string): string => {
    if (settingAccId) {
      const match = accounts.find(
        (a) => a.id === settingAccId || a.code === settingAccId,
      );
      if (
        match &&
        match.code !== "40103" &&
        match.code !== "2010202" &&
        match.code !== "2010203" &&
        !match.name?.includes("خصم") &&
        !match.name?.includes("خصومات")
      ) {
        return match.id;
      }
    }

    const exactClientAcc = accounts.find(
      (a) =>
        a.code === "1010301" ||
        a.name === "الزبائن والحجوزات" ||
        a.classification === "client" ||
        a.category === "client" ||
        (a.name?.includes("زبائن") &&
          !a.name?.includes("خصم") &&
          !a.name?.includes("خصومات")) ||
        (a.name?.includes("عملاء") &&
          !a.name?.includes("خصم") &&
          !a.name?.includes("خصومات")) ||
        a.name?.includes("المدينون"),
    );

    return exactClientAcc ? exactClientAcc.id : (accounts.find(a => a.code === "1010301")?.id || "1010301");
  };

  switch (action) {
    case "SAVE_BOOKING":
      // 1. Deposit
      if (booking.paidAmount > 0) {
        const depositCreditAccount = resolveClientAccountId(
          activeSettings.accountsReceivableId || activeSettings.depositCreditAccountId
        );

        transactionPromises.push(
          addTransactionWithDoubleEntry(
            {
              date: (booking.voucherDate || new Date().toISOString()).split("T")[0],
              description: `عربون حجز: ${booking.customerName} - ${booking.id}`,
              debitAccountId: activeSettings.cashBankAccountId || "1010101",
              creditAccountId: depositCreditAccount,
              amount: Number(booking.paidAmount) || 0,
              currency: booking.currency,
              rate: 1,
              sourceId: `${booking.id}-deposit`,
              sourceType: "booking",
              createdBy,
              ...autoAuditProps,
              concernedParty: { name: booking.customerName, type: 'client' },
            },
            currencies,
            accounts,
          ),
        );
      }
      // 2. Security/Insurance
      if (booking.insuranceAmount && booking.insuranceAmount > 0) {
        transactionPromises.push(
          addTransactionWithDoubleEntry(
            {
              date: (booking.voucherDate || new Date().toISOString()).split("T")[0],
              description: `تأمين حجز: ${booking.customerName} - ${booking.id}`,
              debitAccountId: activeSettings.cashBankAccountId || "1010101",
              creditAccountId:
                activeSettings.insuranceCreditAccountId ||
                activeSettings.guaranteeAccountId ||
                "2010202",
              amount: Number(booking.insuranceAmount) || 0,
              currency: booking.currency,
              rate: 1,
              sourceId: `${booking.id}-insurance`,
              sourceType: "booking",
              createdBy,
              ...autoAuditProps,
              concernedParty: { name: booking.customerName, type: 'client' },
            },
            currencies,
            accounts,
          ),
        );
      }
      break;

    case "ACCRUE":
      const currentRate =
        currencies.find((c) => c.code === booking.currency)?.rateToBase || 1;

      const clientAccountId = resolveClientAccountId(
        activeSettings.accountsReceivableId
      );

      const preEventAccId =
        activeSettings.preEventRevenueAccountId ||
        activeSettings.hallRevenueAccountId ||
        accounts.find((a) => a.code === "40101" || a.name?.includes("إيجار"))?.id ||
        "40101";
      const postEventAccId =
        activeSettings.postEventRevenueAccountId ||
        activeSettings.hallRevenueAccountId ||
        accounts.find((a) => a.code === "40101" || a.name?.includes("إيجار"))?.id ||
        "40101";
      const discountDebitAccId =
        (activeSettings.discountAccountId && accounts.find(a => a.id === activeSettings.discountAccountId || a.code === activeSettings.discountAccountId)?.id) ||
        accounts.find(
          (a) =>
            a.code === "40103" ||
            a.name?.includes("خصم") ||
            a.name?.includes("الخصومات"),
        )?.id ||
        "40103";

      const validDays = (booking.days || []).filter(
        (d) => d.status !== "cancelled",
      );

      const servicesRevenueAmount = (booking.additionalServices || []).reduce(
        (sum, s) => {
          const daysCount = s.appliedDates && s.appliedDates.length > 0
            ? s.appliedDates.length
            : validDays.length || 1;
          return sum + (s.cost * daysCount);
        },
        0,
      );


      validDays.forEach((day, index) => {
        const dayDate =
          day.date ||
          booking.voucherDate ||
          new Date().toISOString().split("T")[0];

        let dayTotalContract = Number(day.price || 0);
        let contractDesc = `قيد إثبات إيجار صالة - العميل: ${booking.customerName} - ليوم ${dayDate}`;

        if (index === 0 && servicesRevenueAmount > 0) {
          dayTotalContract += servicesRevenueAmount;
          contractDesc = `قيد إثبات إيجار صالة وخدمات إضافية - العميل: ${booking.customerName} - ليوم ${dayDate}`;
        }

        // A. Generate Discount Transaction per day
        if (Number(day.discount || 0) > 0 && booking.isDiscountApproved) {
          transactionPromises.push(
            addTransactionWithDoubleEntry(
              {
                date: dayDate,
                voucherDate: dayDate,
                description: `قيد خصم حجز صالة - العميل: ${booking.customerName} - ليوم ${dayDate}`,
                amount: Number(day.discount || 0),
                currency: booking.currency,
                rate: currentRate,
                sourceType: "booking",
                sourceId: `${booking.id}-discount-day-${index}`,
                debitAccountId: discountDebitAccId,
                creditAccountId: clientAccountId,
                createdBy,
                ...autoAuditProps,
                concernedParty: { name: booking.customerName, type: 'client' },
              },
              currencies,
              accounts,
            ),
          );
        }

        // C. Revenue Realization (Accrual) per day
        if (Number(day.price || 0) > 0) {
          transactionPromises.push(
            addTransactionWithDoubleEntry(
              {
                date: dayDate,
                voucherDate: dayDate,
                description: `استحقاق إيجار قاعة: ${booking.customerName} - ليوم ${dayDate}`,
                debitAccountId: clientAccountId,
                creditAccountId:
                  settings.hallRevenueAccountId || preEventAccId,
                amount: Number(day.price || 0),
                currency: booking.currency,
                rate: currentRate,
                sourceId: `${booking.id}-accrue-hall-day-${index}`,
                sourceType: "booking",
                createdBy,
                ...autoAuditProps,
                concernedParty: { name: booking.customerName, type: 'client' },
              },
              currencies,
              accounts,
            ),
          );
        }
      });

      // D. Generate Services Transaction (distribute by appliedDates or first valid day)
      if (servicesRevenueAmount > 0) {
        const serviceTotal = (booking.additionalServices || []).reduce(
          (sum, s) => {
            const daysCount = s.appliedDates && s.appliedDates.length > 0
              ? s.appliedDates.length
              : validDays.length || 1;
            return sum + (s.cost * daysCount);
          },
          0,
        );

        // Group services by date
        const servicesByDate: { [date: string]: number } = {};
        (booking.additionalServices || []).forEach((s) => {
          const dates = s.appliedDates && s.appliedDates.length > 0 ? s.appliedDates : validDays.map(d => d.date);
          dates.forEach(d => {
            if (!servicesByDate[d]) servicesByDate[d] = 0;
            // s.cost is daily, so we just add it to each date it applies to
            servicesByDate[d] += s.cost;
          });
        });

        Object.entries(servicesByDate).forEach(([date, amount]) => {
          if (amount <= 0) return;
          transactionPromises.push(
            addTransactionWithDoubleEntry(
              {
                date: date,
                voucherDate: date,
                description: `استحقاق خدمات إضافية: ${booking.customerName} - ليوم ${date}`,
                debitAccountId: clientAccountId,
                creditAccountId:
                  settings.servicesRevenueAccountId || preEventAccId,
                amount: Number(amount),
                currency: booking.currency,
                rate: currentRate,
                sourceId: `${booking.id}-accrue-services-${date}`,
                sourceType: "booking",
                createdBy,
                ...autoAuditProps,
                concernedParty: { name: booking.customerName, type: 'client' },
              },
              currencies,
              accounts,
            ),
          );
        });
      }
      break;

    case "EXECUTE":
      // From Deferred Revenue to Revenue
      // We should transfer the GROSS amount (what was credited to Pre-Event)
      // which is sum(day.price) + sum(service.cost * days)
      const validDaysEx = (booking.days || []).filter(d => d.status !== 'cancelled');
      const sumDaysPrice = validDaysEx.reduce((sum, d) => sum + (Number(d.price) || 0), 0);
      const sumServicesPrice = (booking.additionalServices || []).filter(s => s.status !== 'cancelled').reduce(
        (sum, s) => {
          const daysCount = s.appliedDates && s.appliedDates.length > 0
            ? s.appliedDates.length
            : validDaysEx.length || 1;
          return sum + (s.cost * daysCount);
        },
        0,
      );
      const grossAmount = sumDaysPrice + sumServicesPrice;

      const bookingEventDateRawEx =
        booking.eventDates?.[0] ||
        booking.eventDate ||
        (booking.days && booking.days[0]?.date) ||
        booking.voucherDate ||
        new Date().toISOString().split("T")[0];
      const bookingEventDateEx = bookingEventDateRawEx.split("T")[0];

      transactionPromises.push(
        addTransactionWithDoubleEntry(
          {
            date: bookingEventDateEx,
            description: `تحويل إيراد فعالية مكتملة (إقفال إيراد مؤجل): ${booking.customerName} - ${booking.id}`,
            debitAccountId: settings.preEventRevenueAccountId,
            creditAccountId: settings.postEventRevenueAccountId,
            amount: grossAmount > 0 ? grossAmount : (Number(booking.totalPrice) || 0),
            currency: booking.currency,
            rate: 1,
            sourceId: `${booking.id}-execute`,
            sourceType: "booking",
            createdBy,
            ...autoAuditProps,
            concernedParty: { name: booking.customerName, type: 'client' },
          },
          currencies,
          accounts,
        ),
      );
      break;

    case "LIQUIDATE":
      // Handle remaining payments and refund insurance
      // 1. Return Security/Insurance
      if (booking.insuranceAmount && booking.insuranceAmount > 0) {
        transactionPromises.push(
          addTransactionWithDoubleEntry(
            {
              date: (booking.voucherDate || new Date().toISOString()).split("T")[0],
              description: `رد تأمين حجز: ${booking.customerName} - ${booking.id}`,
              debitAccountId:
                settings.insuranceDebitAccountId || settings.guaranteeAccountId,
              creditAccountId:
                settings.cashBankAccountId ||
                (accounts.find((a: any) => a.isTransactional && (a.code === "1010101" || a.name?.includes("صندوق") || a.type === "asset"))?.id || ""),
              amount: Number(booking.insuranceAmount) || 0,
              currency: booking.currency,
              rate: 1,
              sourceId: `${booking.id}-liquidate`,
              sourceType: "booking",
              createdBy,
              concernedParty: { name: booking.customerName, type: 'client' },
            },
            currencies,
            accounts,
          ),
        );
      }
      break;
  }

  return Promise.all(transactionPromises);
}

export async function seedInitialDatabaseIfEmpty() {
  // Auto-seeding completely disabled per user explicit request.
  // System strictly uses live Cloud Firestore data and manual user entries.
  return;
}

export const updateAccountSubscription = (id: string, updates: Partial<AccountNotificationSubscription>) =>
  genericUpdate<AccountNotificationSubscription>(
    "account_notification_subscriptions",
    id,
    updates,
    LOCAL_STORAGE_KEYS.ACCOUNT_SUBSCRIPTIONS,
    accountSubscriptionsCallbacks,
  );

export const addAccountSubscription = (item: Omit<AccountNotificationSubscription, "id">) =>
  genericAdd<AccountNotificationSubscription>(
    "account_notification_subscriptions",
    item,
    LOCAL_STORAGE_KEYS.ACCOUNT_SUBSCRIPTIONS,
    accountSubscriptionsCallbacks,
  );

export const subscribeMasterJournals = (cb: (data: MasterJournalVoucher[]) => void) =>
  createSubscription<MasterJournalVoucher>(
    "master_journals",
    cb,
    masterJournalsCallbacks,
    LOCAL_STORAGE_KEYS.MASTER_JOURNALS,
    "createdAt",
  );

export const addMasterJournalVoucher = async (item: Omit<MasterJournalVoucher, "id" | "createdAt" | "sequenceCode" | "totalDebit" | "totalCredit">) => {
  const totalDebit = item.lines.filter(l => l.type === 'debit').reduce((sum, l) => sum + Number(l.amount), 0);
  const totalCredit = item.lines.filter(l => l.type === 'credit').reduce((sum, l) => sum + Number(l.amount), 0);

  const currentList = getLocalData<MasterJournalVoucher[]>(LOCAL_STORAGE_KEYS.MASTER_JOURNALS, []);
  const year = new Date().getFullYear();
  const nextNum = currentList.length + 1;
  const sequenceCode = `JV-${year}-${String(nextNum).padStart(4, '0')}`;

  const voucherData = {
    ...item,
    sequenceCode,
    totalDebit,
    totalCredit,
  };

  const newId = await genericAdd<MasterJournalVoucher>(
    "master_journals",
    voucherData,
    LOCAL_STORAGE_KEYS.MASTER_JOURNALS,
    masterJournalsCallbacks,
  );

  // Post lines to transactions
  const debitLines = item.lines.filter(l => l.type === 'debit');
  const creditLines = item.lines.filter(l => l.type === 'credit');

  for (const dLine of debitLines) {
    for (const cLine of creditLines) {
      const txPayload = {
        sequenceCode: `${sequenceCode}-${dLine.id.slice(-3)}`,
        manualNumber: item.manualNumber,
        date: item.date,
        description: `${item.description} (${dLine.description || ''})`,
        debitAccountId: dLine.accountId,
        creditAccountId: cLine.accountId,
        amount: Math.min(Number(dLine.amount), Number(cLine.amount)),
        currency: item.currency,
        rate: item.rate,
        sourceType: 'journal',
        sourceId: newId,
        status: 'pending_audit',
      };
      await addTransaction(txPayload);
    }
  }

  return newId;
};

export const updateMasterJournalVoucher = async (id: string, updates: Partial<MasterJournalVoucher>) => {
  return genericUpdate<MasterJournalVoucher>(
    "master_journals",
    id,
    updates,
    LOCAL_STORAGE_KEYS.MASTER_JOURNALS,
    masterJournalsCallbacks,
  );
};

export const deleteMasterJournalVoucher = async (id: string) => {
  const txs = getLocalData<Transaction[]>(LOCAL_STORAGE_KEYS.TRANSACTIONS, []);
  const linkedTxs = txs.filter(t => t.sourceId === id && t.sourceType === 'journal');
  for (const tx of linkedTxs) {
    try {
      await deleteTransaction(tx.id);
    } catch(e) {}
  }

  return genericDelete<MasterJournalVoucher>(
    "master_journals",
    id,
    LOCAL_STORAGE_KEYS.MASTER_JOURNALS,
    masterJournalsCallbacks,
  );
};

/**
 * جلب الترخيص السحابي للجهاز وتخزينه محلياً فوراً
 * يتم استرجاع نفس وثيقة الترخيص السحابية وحفظها في التخزين المحلي
 */
export const fetchAndSaveDeviceCloudLicense = async (
  targetDeviceId?: string
): Promise<{ success: boolean; device: AuthorizedDevice | null; message: string }> => {
  const deviceId =
    targetDeviceId ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("accounting_device_uuid")
      : null);

  if (!deviceId) {
    return {
      success: false,
      device: null,
      message: "لم يتم العثور على معرّف الجهاز (Device UUID)",
    };
  }

  try {
    const devDocRef = doc(db, "authorized_devices", deviceId);
    const snap = await getDoc(devDocRef);

    if (snap.exists()) {
      const cloudDevice = { id: snap.id, ...snap.data() } as AuthorizedDevice;

      // تخزين نفس الترخيص السحابي محلياً
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("accounting_cloud_device_license", JSON.stringify(cloudDevice));
        localStorage.setItem("accounting_active_device_license", JSON.stringify(cloudDevice));
        localStorage.setItem("accounting_cloud_device_synced_at", new Date().toISOString());
        localStorage.setItem(
          "accounting_device_authorized_at_least_once",
          cloudDevice.isAuthorized ? "true" : "false"
        );
        if (cloudDevice.allowedUserIds) {
          localStorage.setItem("guard_allowed_user_ids", JSON.stringify(cloudDevice.allowedUserIds));
        }

        // تحديث قائمة الأجهزة في التخزين المحلي أيضاً
        const currentList = getLocalData<AuthorizedDevice[]>(LOCAL_STORAGE_KEYS.DEVICES, []);
        const idx = currentList.findIndex((d) => d.id === cloudDevice.id);
        let updatedList: AuthorizedDevice[];
        if (idx >= 0) {
          updatedList = [...currentList];
          updatedList[idx] = cloudDevice;
        } else {
          updatedList = [cloudDevice, ...currentList];
        }
        setLocalData(LOCAL_STORAGE_KEYS.DEVICES, updatedList);
        devicesCallbacks.forEach((cb) => cb(updatedList));
      }

      return {
        success: true,
        device: cloudDevice,
        message: cloudDevice.isAuthorized
          ? "تم بنجاح جلب الترخيص السحابي للجهاز وتخزينه محلياً (الجهاز مرخص ومفعل سحابياً ومحلياً)"
          : "تم جلب الترخيص السحابي وتخزينه محلياً (حالة الترخيص: قيد المراجعة في السحابة)",
      };
    } else {
      return {
        success: false,
        device: null,
        message: "هذا الجهاز غير مسجل بعد في قاعدة البيانات السحابية",
      };
    }
  } catch (err: any) {
    console.error("Error fetching device cloud license:", err);
    // محاولة القراءة من التخزين المحلي كـ fallback
    const cached = typeof localStorage !== "undefined" ? localStorage.getItem("accounting_cloud_device_license") : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return {
          success: true,
          device: parsed,
          message: "تم استرجاع الترخيص السحابي المحفوظ محلياً (وضع عدم الاتصال)",
        };
      } catch (_) {}
    }
    return {
      success: false,
      device: null,
      message: `فشل جلب الترخيص السحابي: ${err?.message || err}`,
    };
  }
};

/**
 * ترخيص الجهاز سحابياً ومحلياً في آن واحد
 */
export const authorizeDeviceInCloudAndLocal = async (
  deviceId: string,
  adminNotes?: string,
  allowedUserIds?: string[]
): Promise<AuthorizedDevice> => {
  const updates: any = {
    isAuthorized: true,
    lastActive: new Date().toISOString(),
    adminNotes: adminNotes || "تم الترخيص والمطابقة السحابية وحفظ الترخيص محلياً بنجاح",
  };
  if (allowedUserIds) {
    updates.allowedUserIds = allowedUserIds;
  }

  await updateDevice(deviceId, updates);

  // تحديث الترخيص المخزن محلياً فوراً
  let updatedDevice: AuthorizedDevice | null = null;
  if (typeof localStorage !== "undefined") {
    const cached = localStorage.getItem("accounting_cloud_device_license");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.id === deviceId) {
          updatedDevice = { ...parsed, ...updates };
          localStorage.setItem("accounting_cloud_device_license", JSON.stringify(updatedDevice));
          localStorage.setItem("accounting_active_device_license", JSON.stringify(updatedDevice));
        }
      } catch (_) {}
    }
    localStorage.setItem("accounting_device_authorized_at_least_once", "true");
    if (allowedUserIds) {
      localStorage.setItem("guard_allowed_user_ids", JSON.stringify(allowedUserIds));
    }
  }

  return (
    updatedDevice ||
    ({
      id: deviceId,
      ...updates,
    } as AuthorizedDevice)
  );
};

/**
 * إلغاء ترخيص جهاز سحابياً ومحلياً
 */
export const revokeDeviceInCloudAndLocal = async (deviceId: string, reason?: string) => {
  const updates = {
    isAuthorized: false,
    adminNotes: reason || "تم إيقاف الترخيص من قبل المسؤول المالي",
  };
  await updateDevice(deviceId, updates);

  if (typeof localStorage !== "undefined") {
    const cached = localStorage.getItem("accounting_cloud_device_license");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.id === deviceId) {
          const merged = { ...parsed, ...updates };
          localStorage.setItem("accounting_cloud_device_license", JSON.stringify(merged));
          localStorage.setItem("accounting_active_device_license", JSON.stringify(merged));
          localStorage.setItem("accounting_device_authorized_at_least_once", "false");
        }
      } catch (_) {}
    }
  }
};

/**
 * مزامنة كامل البيانات السحابية وحفظها محلياً للعمل بدون إنترنت
 * تشمل: الحسابات، المستخدمين، التراخيص، الصلاحيات، القيود، الحجوزات، والصناديق
 */
export const syncAllCloudDataToLocal = async (): Promise<{
  success: boolean;
  message: string;
  stats: {
    accountsCount: number;
    usersCount: number;
    rolesCount: number;
    devicesCount: number;
    transactionsCount: number;
    hallsCount: number;
    bookingsCount: number;
    clientsCount: number;
    currenciesCount: number;
    syncedAt: string;
  };
}> => {
  try {
    // 1. استرجاع الحسابات
    const accSnap = await getDocs(collection(db, "accounts"));
    const accounts: Account[] = [];
    accSnap.forEach((d) => accounts.push({ id: d.id, ...d.data() } as Account));
    setLocalData(LOCAL_STORAGE_KEYS.ACCOUNTS, accounts);
    accountsCallbacks.forEach((cb) => cb(accounts));

    // 2. استرجاع المستخدمين
    const userSnap = await getDocs(collection(db, "app_users"));
    const users: User[] = [];
    userSnap.forEach((d) => users.push({ id: d.id, ...d.data() } as User));
    setLocalData(LOCAL_STORAGE_KEYS.USERS, users);
    usersCallbacks.forEach((cb) => cb(users));

    // 3. استرجاع الأدوار والصلاحيات
    const rolesSnap = await getDocs(collection(db, "app_roles"));
    const roles: Role[] = [];
    rolesSnap.forEach((d) => roles.push({ id: d.id, ...d.data() } as Role));
    setLocalData(LOCAL_STORAGE_KEYS.ROLES, roles);
    rolesCallbacks.forEach((cb) => cb(roles));

    // 4. استرجاع تراخيص الأجهزة وترخيص هذا الجهاز
    const devSnap = await getDocs(collection(db, "authorized_devices"));
    const devices: AuthorizedDevice[] = [];
    devSnap.forEach((d) => devices.push({ id: d.id, ...d.data() } as AuthorizedDevice));
    setLocalData(LOCAL_STORAGE_KEYS.DEVICES, devices);
    devicesCallbacks.forEach((cb) => cb(devices));

    // استخراج ترخيص هذا الجهاز الحالي وتخزينه محلياً
    const currentUuid = typeof localStorage !== "undefined" ? localStorage.getItem("accounting_device_uuid") : null;
    if (currentUuid) {
      const matching = devices.find((d) => d.id === currentUuid);
      if (matching) {
        localStorage.setItem("accounting_cloud_device_license", JSON.stringify(matching));
        localStorage.setItem("accounting_active_device_license", JSON.stringify(matching));
        localStorage.setItem("accounting_cloud_device_synced_at", new Date().toISOString());
        localStorage.setItem("accounting_device_authorized_at_least_once", matching.isAuthorized ? "true" : "false");
      }
    }

    // 5. استرجاع العملات
    const curSnap = await getDocs(collection(db, "currencies"));
    const currencies: Currency[] = [];
    curSnap.forEach((d) => currencies.push({ id: d.id, ...d.data() } as Currency));
    setLocalData(LOCAL_STORAGE_KEYS.CURRENCIES, currencies);
    currenciesCallbacks.forEach((cb) => cb(currencies));

    // 6. استرجاع المعاملات / القيود
    const txSnap = await getDocs(collection(db, "transactions"));
    const txs: Transaction[] = [];
    txSnap.forEach((d) => txs.push({ id: d.id, ...d.data() } as Transaction));
    setLocalData(LOCAL_STORAGE_KEYS.TRANSACTIONS, txs);
    transactionsCallbacks.forEach((cb) => cb(txs));

    // 7. استرجاع الصالات
    const hallsSnap = await getDocs(collection(db, "halls"));
    const halls: Hall[] = [];
    hallsSnap.forEach((d) => halls.push({ id: d.id, ...d.data() } as Hall));
    setLocalData(LOCAL_STORAGE_KEYS.HALLS, halls);
    hallsCallbacks.forEach((cb) => cb(halls));

    // 8. استرجاع الحجوزات
    const bookSnap = await getDocs(collection(db, "bookings"));
    const bookings: Booking[] = [];
    bookSnap.forEach((d) => bookings.push({ id: d.id, ...d.data() } as Booking));
    setLocalData(LOCAL_STORAGE_KEYS.BOOKINGS, bookings);
    bookingsCallbacks.forEach((cb) => cb(bookings));

    // 9. استرجاع العملاء
    const clientSnap = await getDocs(collection(db, "clients"));
    const clients: Client[] = [];
    clientSnap.forEach((d) => clients.push({ id: d.id, ...d.data() } as Client));
    setLocalData(LOCAL_STORAGE_KEYS.CLIENTS, clients);
    clientsCallbacks.forEach((cb) => cb(clients));

    // 10. استرجاع الموظفين
    const empSnap = await getDocs(collection(db, "employees"));
    const emps: Employee[] = [];
    empSnap.forEach((d) => emps.push({ id: d.id, ...d.data() } as Employee));
    setLocalData(LOCAL_STORAGE_KEYS.EMPLOYEES, emps);
    employeesCallbacks.forEach((cb) => cb(emps));

    // 11. استرجاع الخدمات
    const srvSnap = await getDocs(collection(db, "services"));
    const srvs: Service[] = [];
    srvSnap.forEach((d) => srvs.push({ id: d.id, ...d.data() } as Service));
    setLocalData(LOCAL_STORAGE_KEYS.SERVICES, srvs);
    servicesCallbacks.forEach((cb) => cb(srvs));

    // 12. استرجاع سندات القبض والصرف
    const rpSnap = await getDocs(collection(db, "receipts_payments"));
    const rps: ReceiptPayment[] = [];
    rpSnap.forEach((d) => rps.push({ id: d.id, ...d.data() } as ReceiptPayment));
    setLocalData(LOCAL_STORAGE_KEYS.VOUCHERS, rps);
    vouchersCallbacks.forEach((cb) => cb(rps));

    // 13. استرجاع القيود الافتتاحية والمركزية
    const mjSnap = await getDocs(collection(db, "master_journals"));
    const mjs: MasterJournalVoucher[] = [];
    mjSnap.forEach((d) => mjs.push({ id: d.id, ...d.data() } as MasterJournalVoucher));
    setLocalData(LOCAL_STORAGE_KEYS.MASTER_JOURNALS, mjs);
    masterJournalsCallbacks.forEach((cb) => cb(mjs));

    // 14. إعدادات الشركة والحجوزات
    const compSnap = await getDocs(collection(db, "company_settings"));
    const comps: CompanySettings[] = [];
    compSnap.forEach((d) => comps.push({ id: d.id, ...d.data() } as CompanySettings));
    if (comps.length > 0) {
      setLocalData(LOCAL_STORAGE_KEYS.COMPANY, comps);
      companyCallbacks.forEach((cb) => cb(comps));
    }

    const bSetSnap = await getDocs(collection(db, "booking_settings"));
    const bSets: BookingSettings[] = [];
    bSetSnap.forEach((d) => bSets.push({ id: d.id, ...d.data() } as BookingSettings));
    if (bSets.length > 0) {
      setLocalData(LOCAL_STORAGE_KEYS.BOOKING_SETTINGS, bSets);
      bookingSettingsCallbacks.forEach((cb) => cb(bSets));
    }

    const nowIso = new Date().toISOString();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("accounting_last_full_cloud_sync", nowIso);
    }

    return {
      success: true,
      message: `تم بنجاح جلب ${accounts.length} حساباً و ${users.length} مستخدماً و ${devices.length} ترخيص جهاز وتخزينها محلياً 100% للعمل دون اتصال.`,
      stats: {
        accountsCount: accounts.length,
        usersCount: users.length,
        rolesCount: roles.length,
        devicesCount: devices.length,
        transactionsCount: txs.length,
        hallsCount: halls.length,
        bookingsCount: bookings.length,
        clientsCount: clients.length,
        currenciesCount: currencies.length,
        syncedAt: nowIso,
      },
    };
  } catch (err: any) {
    console.error("Full cloud sync error:", err);
    return {
      success: false,
      message: `تعذر إتمام المزامنة السحابية: ${err?.message || err}`,
      stats: {
        accountsCount: 0,
        usersCount: 0,
        rolesCount: 0,
        devicesCount: 0,
        transactionsCount: 0,
        hallsCount: 0,
        bookingsCount: 0,
        clientsCount: 0,
        currenciesCount: 0,
        syncedAt: new Date().toISOString(),
      },
    };
  }
};

