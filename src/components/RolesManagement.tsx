import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, ShieldAlert, Plus, Search, Check, X, ShieldCheck,
  ChevronDown, ChevronUp, LayoutDashboard, FolderTree, Receipt, 
  Coins, Calendar, Sparkles, Users, UserCog, FileText, Settings, 
  HelpCircle, Minimize2, Maximize2, Tag, Printer, Landmark, Activity,
  Lock, CheckCircle2, PieChart, Edit3, Building2, Wallet, BookOpen
} from 'lucide-react';
import { Role } from '../types';

interface RolesManagementProps {
  roles: Role[];
  onSaveRole: (role: Partial<Role>) => void;
  onDeleteRole: (id: string) => void;
  availablePermissions: { id: string; name: string; category: string }[];
}

const INTERFACE_GROUPS = [
  {
    id: "screens",
    name: "١. النوافذ والشاشات الرئيسية (٣٣ شاشة)",
    description: "صلاحيات الدخول لكافة نوافذ وشاشات النظام، القائمة الجانبية، والتقويم ولوحة التحكم",
    icon: LayoutDashboard,
    permissionIds: [
      "view-dashboard", "view-accounts", "view-transactions", "view-daily-movements", "print-cash-movements",
      "view-recurring-entries", "view-financial-audit", "view-standard-costing", "view-reports",
      "view-account-statement", "view-advanced-reports", "view-vouchers", "view-collections",
      "view-discounts", "view-booking-amendments", "view-deposit-refunds", "view-currencies",
      "view-halls", "view-bookings", "audit-booking-transactions", "view-halls-directory",
      "view-services", "view-clients", "view-employees", "view-payroll",
      "manage-users", "manage-roles", "manage-account-permissions", "view-company",
      "view-accounts-linking", "view-booking-settings", "view-tasks", "view-insights"
    ]
  },
  {
    id: "analytics_cards",
    name: "٢. البطاقات الإحصائية والتحليلية العامة",
    description: "التحكم بظهور البطاقات الإحصائية والتحليلية ومؤشرات الأداء KPI في لوحة التحكم والشاشات الرئيسية",
    icon: PieChart,
    permissionIds: [
      "card-dashboard-alerts", "card-dashboard-stats", "card-dashboard-profitability", "card-dashboard-variance",
      "card-booking-stats", "card-occupancy-analytics", "card-vouchers-summary", "card-transactions-summary",
      "card-accounts-stats", "card-discounts-stats", "card-refund-stats", "card-payroll-stats"
    ]
  },
  {
    id: "modal_cards",
    name: "٣. بطاقات النوافذ والمودالات الداخلية",
    description: "التحكم بظهور البطاقات وجداول الحسابات التفصيلية داخل نافذة معاينة الحجز ونافذة كشف حساب المركز المالي",
    icon: Receipt,
    permissionIds: [
      "card-booking-financials", "card-statement-client", "card-statement-mortgage", "card-statement-insurance",
      "table-statement-transactions", "card-booking-preview-details", "card-booking-preview-services",
      "card-booking-preview-payments", "card-booking-preview-policy"
    ]
  },
  {
    id: "buttons_halls_bookings",
    name: "٤. أزرار شاشة القاعات والحجوزات والإدارة",
    description: "أزرار الإجراءات الخاصة بالحجوزات، القاعات، عقود الإيجار، الترحيل، رد التأمينات، والخصومات",
    icon: Building2,
    permissionIds: [
      "btn-create-booking", "btn-edit-booking", "btn-cancel-booking", "btn-delete-booking",
      "btn-confirm-booking", "btn-print-contract", "btn-print-booking", "btn-collect-payment",
      "btn-accrue-revenue", "btn-unpost-booking", "btn-refund-insurance", "btn-refund-deposit",
      "btn-refund-mortgage", "btn-request-amendment", "btn-open-financial-statement", "btn-print-financial-statement",
      "btn-manage-discounts", "btn-request-discount", "btn-approve-discount", "btn-reject-discount",
      "btn-print-discount", "btn-create-hall", "btn-edit-hall", "btn-delete-hall"
    ]
  },
  {
    id: "buttons_vouchers",
    name: "٥. أزرار شاشة السندات المالية (قبض وصرف)",
    description: "أزرار إضافة، تعديل، حذف، وطباعة السندات المالية",
    icon: Wallet,
    permissionIds: [
      "btn-create-voucher", "create-voucher", "btn-edit-voucher", "edit-voucher", "btn-delete-voucher", "delete-voucher", "btn-print-voucher", "print-voucher"
    ]
  },
  {
    id: "buttons_transactions",
    name: "٦. أزرار شاشة قيود اليومية المحاسبية",
    description: "أزرار إنشاء، تعديل، حذف، وطباعة وتدقيق القيود المحاسبية",
    icon: BookOpen,
    permissionIds: [
      "btn-create-transaction", "btn-edit-transaction", "btn-delete-transaction", "btn-print-transaction", "btn-audit-transaction"
    ]
  },
  {
    id: "buttons_accounts",
    name: "٧. أزرار شاشة الدليل المحاسبي (الشجرة)",
    description: "أزرار إضافة، تعديل، وحذف الحسابات المحاسبية",
    icon: FolderTree,
    permissionIds: [
      "btn-create-account", "btn-edit-account", "btn-delete-account"
    ]
  },
  {
    id: "buttons_clients_employees",
    name: "٨. أزرار شاشة العملاء والموظفين والرواتب والخدمات",
    description: "أزرار إدارة العملاء، الموظفين، مسيرات الرواتب، والخدمات الإضافية",
    icon: Users,
    permissionIds: [
      "btn-create-client", "btn-edit-client", "btn-delete-client", "btn-create-employee",
      "btn-edit-employee", "btn-delete-employee", "btn-create-service", "btn-edit-service",
      "btn-delete-service", "btn-create-payroll", "btn-post-payroll", "btn-print-payroll"
    ]
  },
  {
    id: "buttons_system_reports",
    name: "٩. أزرار القيود الدورية وإدارة النظام والتقارير",
    description: "أزرار القيود الدورية، إدارة المستخدمين والأدوار، إعدادات الشركة، وتصدير/طباعة التقارير",
    icon: Settings,
    permissionIds: [
      "btn-create-recurring", "btn-execute-recurring", "btn-create-role", "btn-edit-role",
      "btn-delete-role", "btn-create-user", "btn-edit-user", "btn-delete-user",
      "btn-save-company", "btn-save-linking", "btn-export-reports", "btn-print-reports"
    ]
  },
  {
    id: "sensitive_fields",
    name: "١٠. الحقول الحساسة وإدخال وتعديل البيانات",
    description: "التحكم بصلاحية تعديل وإدخال الحقول المالية الحساسة (الأسعار، الخصومات، التواريخ، العربون، الرهونات، الحسابات)",
    icon: Edit3,
    permissionIds: [
      "field-booking-price", "field-booking-discount", "field-booking-deposit", "field-booking-insurance",
      "field-booking-mortgage", "field-booking-event-date", "field-booking-period", "field-booking-voucher-date",
      "field-booking-manual-number", "field-booking-accounts", "field-voucher-date", "field-voucher-account",
      "field-transaction-date"
    ]
  },
  {
    id: "booking_form_input_interface",
    name: "١١. صلاحيات واجهة وحقول إدخال وإنشاء الحجز",
    description: "صلاحيات عرض وتحرير كافة حقول نموذج إنشاء وتعديل الحجز (التواريخ، الأسعار، الخدمات، العربون، التأمين، الرهونات والنقدي)",
    icon: Edit3,
    permissionIds: [
      "field-booking-event-date", "field-booking-period", "field-booking-price",
      "field-booking-discount", "field-booking-services", "field-booking-total-price-field",
      "field-booking-deposit", "field-booking-insurance", "field-booking-mortgage-cash",
      "field-booking-mortgage-inkind", "field-booking-mortgage-image", "field-booking-voucher-date",
      "field-booking-manual-number", "field-booking-accounts", "field-voucher-date", "field-voucher-account",
      "field-transaction-date"
    ]
  },
  {
    id: "booking_preview_header_buttons",
    name: "١٢. أزرار الشريط العلوي بنافذة معاينة الحجز (الصورة ١)",
    description: "أزرار الطباعة، السندات، الترحيل، رد التأمين والعربون والرهن، تحصيل الدفعات، كشف الحساب والخصومات",
    icon: Building2,
    permissionIds: [
      "btn-preview-digital-contract", "btn-preview-paper-contract", "btn-preview-deposit-voucher",
      "btn-preview-insurance-voucher", "btn-preview-mortgage-voucher", "btn-preview-print",
      "btn-preview-post-revenue", "btn-preview-unpost-revenue", "btn-preview-refund-insurance", "btn-preview-request-amendment",
      "btn-preview-refund-deposit", "btn-preview-refund-mortgage", "btn-preview-collect-payments",
      "btn-preview-account-statement", "btn-preview-manage-discounts", "btn-close-booking-preview"
    ]
  },
  {
    id: "discounts_screen_modal_buttons",
    name: "١٣. أزرار نافذة وشاشة إدارة واعتماد الخصومات (الصور ٣ و ٤)",
    description: "أزرار + طلب خصم جديد، الاعتماد والتطبيق الفوري، إرسال الطلب للاعتماد، الرفض، والطباعة",
    icon: Tag,
    permissionIds: [
      "btn-discounts-screen-new-request", "btn-discounts-screen-approve", "btn-discounts-screen-reject",
      "btn-discounts-screen-print", "btn-discount-modal-instant-approve", "btn-discount-modal-request-approval",
      "btn-discount-modal-print-notice"
    ]
  },
  {
    id: "strict_governance",
    name: "١٤. الضوابط والأمان والرقابة الصارمة",
    description: "صلاحيات القيود والأقفال الصارمة (تجاوز التاريخ المقفل، تعديل المبالغ المقفلة، تعديل تفاصيل الحجز، الخصم المفتوح، الإجماليات الحساسة)",
    icon: Lock,
    permissionIds: [
      "bypass-transaction-lock-date", "bypass-booking-amount-lock", "bypass-booking-details-lock",
      "allow-unlimited-discount", "view-sensitive-financial-totals"
    ]
  }
];

export default function RolesManagement({ roles, onSaveRole, onDeleteRole, availablePermissions }: RolesManagementProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<Partial<Role>>({
    name: '',
    permissions: []
  });

  const isRedActionPerm = (id: string, name: string) => {
    const lower = id.toLowerCase();
    return lower.includes('delete') || lower.includes('cancel') || lower.includes('edit') || 
           lower.includes('approve') || lower.includes('reject') || lower.includes('unpost') ||
           name.includes('حذف') || name.includes('إلغاء') || name.includes('تعديل') || 
           name.includes('اعتماد') || name.includes('رفض');
  };

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    dashboard: true,
  });
  const [permSearch, setPermSearch] = useState('');

  // Dynamically calculate groups based on current available permissions (including future custom permissions)
  const mappedIds = new Set(INTERFACE_GROUPS.flatMap(g => g.permissionIds));
  const otherPermissions = availablePermissions.filter(p => !mappedIds.has(p.id));

  const allGroups = [
    ...INTERFACE_GROUPS,
    ...(otherPermissions.length > 0 ? [{
      id: "other",
      name: "صلاحيات وتسهيلات أخرى",
      description: "صلاحيات إضافية غير مصنفة تحت واجهة رئيسية معينة",
      icon: HelpCircle,
      permissionIds: otherPermissions.map(p => p.id)
    }] : [])
  ];

  const [viewMode, setViewMode] = useState<'categorized' | 'hierarchical'>('categorized');

  const HIERARCHICAL_GROUPS = [
    {
      id: "screen_booking_preview_buttons",
      name: "١. أزرار الشريط العلوي بنافذة معاينة الحجز (الموضحة بالصورة ١)",
      description: "أزرار عقد الحجز، سندات القبض، ترحيل/إلغاء القيود، رد التأمينات والعربون والرهن، تحصيل الدفعات، وكشف الحساب والخصومات",
      icon: Building2,
      permissionIds: [
        "btn-preview-digital-contract", "btn-preview-paper-contract", "btn-preview-deposit-voucher",
        "btn-preview-insurance-voucher", "btn-preview-mortgage-voucher", "btn-preview-print",
        "btn-preview-post-revenue", "btn-preview-unpost-revenue", "btn-preview-refund-insurance", "btn-preview-request-amendment",
        "btn-preview-refund-deposit", "btn-preview-refund-mortgage", "btn-preview-collect-payments",
        "btn-preview-account-statement", "btn-preview-manage-discounts", "btn-close-booking-preview"
      ]
    },
    {
      id: "screen_discounts_buttons",
      name: "٢. أزرار نافذة وشاشة إدارة الخصومات الرئيسية والفرعية (الموضحة بالصور ٣ و ٤)",
      description: "أزرار + طلب خصم جديد، الاعتماد والتطبيق الفوري، إرسال طلب للاعتماد، الرفض، والطباعة",
      icon: Tag,
      permissionIds: [
        "btn-discounts-screen-new-request", "btn-discounts-screen-approve", "btn-discounts-screen-reject",
        "btn-discounts-screen-print", "btn-discount-modal-instant-approve", "btn-discount-modal-request-approval",
        "btn-discount-modal-print-notice"
      ]
    },
    {
      id: "screen_bookings_halls",
      name: "٣. شاشة الحجوزات والقاعات الرئيسية (البطاقات والحقول الأسبوعية)",
      description: "صلاحيات الدخول، البطاقات، وحقول إدخال ومعاينة الحجوزات والخصومات من شاشة القاعات",
      icon: Building2,
      permissionIds: [
        "view-bookings", "view-halls", "view-halls-directory", "view-services",
        "card-booking-stats", "card-occupancy-analytics", "card-booking-financials",
        "card-booking-preview-details", "card-booking-preview-services", "card-booking-preview-payments",
        "card-booking-preview-policy", "table-booking-periods", "card-booking-lessor", "card-booking-lessee",
        "card-booking-preview-header", "card-booking-total-price", "card-booking-total-discount",
        "card-booking-net-price", "card-booking-deposit-display", "card-booking-future-payments",
        "btn-create-booking", "btn-create-booking-halls", "btn-edit-booking", "btn-edit-booking-halls",
        "btn-cancel-booking", "btn-delete-booking", "btn-create-hall", "btn-edit-hall", "btn-delete-hall",
        "field-booking-event-date", "field-booking-period", "field-booking-price",
        "field-booking-discount", "field-booking-discount-halls", "field-booking-days-discount", "field-booking-customer-id", "field-booking-guarantor", "btn-manage-discounts-halls",
        "field-booking-services", "field-booking-total-price-field",
        "field-booking-deposit", "field-booking-insurance", "field-booking-mortgage-cash",
        "field-booking-mortgage-inkind", "field-booking-mortgage-image",
        "bypass-booking-amount-lock", "bypass-booking-details-lock"
      ]
    },
    {
      id: "screen_calendar",
      name: "٤. شاشة التقويم والمخطط التفاعلي",
      description: "صلاحيات الحجز السريع، معاينة وتعديل الحجوزات وإدارة الخصومات عند الدخول من شاشة التقويم",
      icon: Calendar,
      permissionIds: [
        "btn-create-booking-calendar", "btn-edit-booking-calendar",
        "field-booking-discount-calendar", "btn-manage-discounts-calendar"
      ]
    },
    {
      id: "screen_transactions_ledger",
      name: "٥. شاشة قيود اليومية والحركات اليومية والتدقيق",
      description: "صلاحيات الدخول، السجلات، الحركات المحاسبية، قيود اليومية، والتدقيق المالي",
      icon: BookOpen,
      permissionIds: [
        "view-transactions", "view-daily-movements", "audit-booking-transactions",
        "view-financial-audit", "card-transactions-summary", "card-dashboard-variance",
        "table-statement-transactions", "btn-create-transaction", "btn-edit-transaction",
        "btn-delete-transaction", "btn-print-transaction", "btn-audit-transaction",
        "field-transaction-date", "bypass-transaction-lock-date"
      ]
    },
    {
      id: "screen_accounts_tree",
      name: "٦. شاشة الدليل المحاسبي وشجرة الحسابات",
      description: "صلاحيات إدارة الحسابات، شجرة الدليل، كشوفات الحسابات والربط التلقائي",
      icon: FolderTree,
      permissionIds: [
        "view-accounts", "view-account-statement", "view-accounts-linking",
        "card-accounts-stats", "card-statement-client", "card-statement-mortgage", "card-statement-insurance",
        "btn-create-account", "btn-edit-account", "btn-delete-account", "btn-save-linking"
      ]
    },
    {
      id: "screen_vouchers_collections",
      name: "٧. شاشة السندات المالية والتسويات والخصومات",
      description: "صلاحيات سندات القبض والصرف، تحصيل الدفعات، والخصومات والتسويات من الشاشة المالية",
      icon: Wallet,
      permissionIds: [
        "view-vouchers", "view-collections", "card-vouchers-summary",
        "btn-create-voucher", "btn-edit-voucher", "btn-delete-voucher", "btn-print-voucher",
        "btn-manage-discounts-vouchers",
        "field-voucher-date", "field-voucher-account"
      ]
    },
    {
      id: "screen_employees_payroll",
      name: "٨. شاشة الموظفين ومسيرات الرواتب",
      description: "صلاحيات إدارة شؤون الموظفين، الرواتب والمستحقات والترحيل",
      icon: Users,
      permissionIds: [
        "view-employees", "view-payroll", "card-payroll-stats",
        "btn-create-employee", "btn-edit-employee", "btn-delete-employee",
        "btn-create-payroll", "btn-post-payroll", "btn-print-payroll"
      ]
    },
    {
      id: "screen_reports_system",
      name: "٩. شاشة التقارير المالية، العملاء والخصومات وإدارة النظام والأمان",
      description: "صلاحيات التقارير المالية، ملفات العملاء، الخصومات، القيود الدورية، المستخدمين والأدوار والإعدادات",
      icon: Settings,
      permissionIds: [
        "view-dashboard", "view-recurring-entries", "view-standard-costing",
        "view-reports", "view-advanced-reports", "view-discounts", "view-booking-amendments",
        "view-deposit-refunds", "view-currencies", "view-clients", "view-tasks", "view-insights",
        "manage-users", "manage-roles", "manage-account-permissions", "view-company", "view-booking-settings",
        "card-dashboard-alerts", "card-dashboard-stats", "card-dashboard-profitability",
        "card-discounts-stats", "card-refund-stats",
        "btn-manage-discounts", "field-booking-discount-clients", "btn-request-discount", "btn-approve-discount", "btn-reject-discount",
        "btn-print-discount", "btn-create-recurring", "btn-execute-recurring", "btn-create-role",
        "btn-edit-role", "btn-delete-role", "btn-create-user", "btn-edit-user", "btn-delete-user",
        "btn-save-company", "btn-export-reports", "btn-print-reports",
        "allow-unlimited-discount", "view-sensitive-financial-totals"
      ]
    }
  ];

  const activeGroupsList = viewMode === 'categorized' ? allGroups : HIERARCHICAL_GROUPS;

  const togglePermission = (permId: string) => {
    setFormData(prev => {
      const current = prev.permissions || [];
      if (current.includes(permId)) {
        return { ...prev, permissions: current.filter(id => id !== permId) };
      } else {
        return { ...prev, permissions: [...current, permId] };
      }
    });
  };

  const toggleAllInGroup = (groupId: string, permissionIds: string[]) => {
    const currentSelected = formData.permissions || [];
    const allSelected = permissionIds.every(pid => currentSelected.includes(pid));
    
    setFormData(prev => {
      const current = prev.permissions || [];
      if (allSelected) {
        // Deselect all in this group
        return {
          ...prev,
          permissions: current.filter(pid => !permissionIds.includes(pid))
        };
      } else {
        // Select all in this group (avoid duplicates)
        const newPermissions = Array.from(new Set([...current, ...permissionIds]));
        return {
          ...prev,
          permissions: newPermissions
        };
      }
    });
  };

  const handleExpandAll = () => {
    const updated: Record<string, boolean> = {};
    allGroups.forEach(g => {
      updated[g.id] = true;
    });
    setExpandedGroups(updated);
  };

  const handleCollapseAll = () => {
    setExpandedGroups({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRole(editingRole ? { ...formData, id: editingRole.id } : formData);
    setShowModal(false);
  };

  return (
    <div className="space-y-6 text-right">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-indigo-500" />
            نظام الصلاحيات والأدوار
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium italic">تخصيص مستويات الوصول لكل مجموعة مستخدمين</p>
        </div>
        
        <button 
          id="btn-create-role"
          onClick={() => { 
            setEditingRole(null); 
            setFormData({ name: '', permissions: [] }); 
            setPermSearch('');
            setExpandedGroups({ dashboard: true });
            setShowModal(true); 
          }}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 text-sm cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          إنشاء دور جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <motion.div 
            layout
            key={role.id}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col h-full hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
                <Shield className="h-6 w-6" />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { 
                    setEditingRole(role); 
                    setFormData(role); 
                    setPermSearch('');
                    // Expand groups that have active permissions to show them
                    const activeGroupMap: Record<string, boolean> = {};
                    allGroups.forEach(g => {
                      const hasActive = g.permissionIds.some(pid => (role.permissions || []).includes(pid));
                      if (hasActive) activeGroupMap[g.id] = true;
                    });
                    setExpandedGroups(activeGroupMap);
                    setShowModal(true); 
                  }}
                  className="text-xs font-black text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  تعديل
                </button>
                <button 
                  onClick={() => { if(confirm('هل أنت متأكد من حذف هذا الدور؟')) onDeleteRole(role.id); }}
                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-rose-500 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">{role.name}</h3>
            <p className="text-xs text-slate-400 font-bold mb-4">يحتوي هذا الدور على ({(role.permissions || []).length}) صلاحية مفعلة</p>

            <div className="mt-auto flex flex-wrap gap-1.5">
              {(role.permissions || []).slice(0, 5).map(pid => (
                <span key={pid} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500 rounded-full">
                  {availablePermissions.find(p => p.id === pid)?.name || pid}
                </span>
              ))}
              {(role.permissions || []).length > 5 && (
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-[9px] font-black text-indigo-500 rounded-full">
                  +{(role.permissions || []).length - 5} أخرى
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-[95vw] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col border border-slate-100 dark:border-slate-800"
            >
              <div className="bg-indigo-600 p-6 text-white shrink-0 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black">{editingRole ? 'تعديل الدور والصلاحيات' : 'إنشاء دور جديد'}</h3>
                  <p className="text-white/80 text-xs font-medium italic mt-1">تحديد هرمي منطوي للصلاحيات مصنفة بحسب واجهات النظام</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-indigo-700/50 rounded-xl text-white/90 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Role Name */}
                <div className="bg-slate-50 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                  <label className="text-[10px] font-black text-slate-500 block mb-2 uppercase tracking-widest mr-1">اسم الدور الوظيفي</label>
                  <input 
                    type="text"
                    required
                    placeholder="مثال: مدير المبيعات، محاسب قاعات، أمين صندوق..."
                    value={formData.name}
                    onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 text-right shadow-sm outline-none transition-all"
                  />
                </div>

                {/* View Mode Selector */}
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full sm:w-fit">
                  <button
                    type="button"
                    onClick={() => setViewMode('categorized')}
                    className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      viewMode === 'categorized'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    عرض المجموعات المصنفة (الكلاسيكي)
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('hierarchical')}
                    className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      viewMode === 'hierarchical'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    العرض الهرمي الشجري (التنقل والشاشات والتفاصيل)
                  </button>
                </div>

                {/* Search and Expand/Collapse Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ابحث عن صلاحية محددة..."
                      value={permSearch}
                      onChange={e => setPermSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pr-11 pl-4 py-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-right outline-none transition-all shadow-inner"
                    />
                    {permSearch && (
                      <button 
                        onClick={() => setPermSearch('')}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      id="expand-all-btn"
                      onClick={handleExpandAll}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      توسيع الكل
                    </button>
                    <button
                      type="button"
                      id="collapse-all-btn"
                      onClick={handleCollapseAll}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Minimize2 className="h-3.5 w-3.5" />
                      طيّ الكل
                    </button>
                  </div>
                </div>

                {/* Collapsible Groups Tree */}
                <div className="space-y-4">
                  {activeGroupsList.map(group => {
                    const groupPerms = availablePermissions.filter(p => group.permissionIds.includes(p.id));
                    
                    // Filter group permissions by search string
                    const filteredGroupPerms = groupPerms.filter(p => 
                      p.name.toLowerCase().includes(permSearch.toLowerCase()) || 
                      p.id.toLowerCase().includes(permSearch.toLowerCase())
                    );

                    // Skip displaying group if search text is active and there are no matched permissions inside this group
                    if (permSearch && filteredGroupPerms.length === 0) return null;

                    // Automatically expand groups that have matches if a search query is typed
                    const isExpanded = !!expandedGroups[group.id] || !!permSearch;

                    const selectedInGroup = (formData.permissions || []).filter(pid => group.permissionIds.includes(pid));
                    const isAllSelected = group.permissionIds.every(pid => (formData.permissions || []).includes(pid));
                    const isSomeSelected = selectedInGroup.length > 0 && !isAllSelected;

                    const IconComponent = group.icon || HelpCircle;

                    return (
                      <div 
                        key={group.id} 
                        className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 transition-all shadow-sm hover:border-indigo-100 dark:hover:border-indigo-900/40"
                      >
                        {/* Accordion Trigger */}
                        <div 
                          className={`flex items-center justify-between p-4 cursor-pointer select-none transition-colors ${
                            isExpanded ? 'bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/60' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                          }`}
                          onClick={() => setExpandedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                          id={`group-header-${group.id}`}
                        >
                          <div className="flex items-center gap-3.5 flex-1 pl-4">
                            <div className={`p-2.5 rounded-2xl flex items-center justify-center transition-colors shrink-0 ${
                              selectedInGroup.length > 0 
                                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' 
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="text-right">
                              <h4 className="text-xs font-black text-slate-800 dark:text-white leading-snug">{group.name}</h4>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 leading-relaxed">{group.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 mr-4" onClick={(e) => e.stopPropagation()}>
                            {/* Status indicator */}
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${
                              isAllSelected 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                : isSomeSelected 
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                            }`}>
                              {selectedInGroup.length === 0 
                                ? 'مغلق بالكامل' 
                                : isAllSelected 
                                  ? 'مفعل بالكامل' 
                                  : `مفعل: ${selectedInGroup.length} من ${group.permissionIds.length}`}
                            </span>

                            {/* Check all master box */}
                            <button
                              type="button"
                              id={`group-master-${group.id}`}
                              onClick={() => toggleAllInGroup(group.id, group.permissionIds)}
                              className={`p-1.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                                isAllSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                                  : isSomeSelected
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 hover:border-slate-300'
                              }`}
                              title={isAllSelected ? "إلغاء تحديد الكل" : "تحديد كافة الصلاحيات في هذه الشاشة"}
                            >
                              {isAllSelected ? (
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              ) : isSomeSelected ? (
                                <div className="w-3.5 h-3.5 flex items-center justify-center">
                                  <div className="w-2.5 h-1 bg-indigo-500 rounded-full" />
                                </div>
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-md border-2 border-slate-300 dark:border-slate-600" />
                              )}
                            </button>

                            {/* Chevron fold */}
                            <div className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Accordion Content */}
                        {isExpanded && (
                          <div className="p-4 bg-slate-50/20 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800/50 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                              {filteredGroupPerms.map(perm => {
                                const isSelected = (formData.permissions || []).includes(perm.id);
                                const isRed = isRedActionPerm(perm.id, perm.name);
                                return (
                                  <button
                                    key={perm.id}
                                    id={`permission-btn-${perm.id}`}
                                    type="button"
                                    onClick={() => togglePermission(perm.id)}
                                    className={`flex items-start justify-between p-2.5 rounded-xl border transition-all text-right group ${
                                      isSelected
                                        ? isRed
                                          ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500 shadow-sm'
                                          : 'bg-indigo-50/20 dark:bg-indigo-900/10 border-indigo-500 shadow-sm'
                                        : isRed
                                          ? 'bg-rose-50/10 dark:bg-slate-800 border-rose-200 dark:border-rose-900/50 hover:border-rose-300'
                                          : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-100 dark:hover:border-indigo-900/30'
                                    }`}
                                  >
                                    <div className="flex-1 pl-2">
                                      <span className={`text-[10px] font-black leading-tight block ${
                                        isSelected 
                                          ? isRed ? 'text-rose-700 dark:text-rose-300' : 'text-indigo-700 dark:text-indigo-300' 
                                          : isRed ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                                      }`}>
                                        {perm.name}
                                      </span>
                                      <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 block mt-0.5 uppercase tracking-wider font-mono truncate">
                                        {perm.id}
                                      </span>
                                    </div>
                                    <div className={`w-4 h-4 rounded-md shrink-0 flex items-center justify-center transition-all mt-0.5 ${
                                      isSelected 
                                        ? isRed ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20' : 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/20' 
                                        : isRed ? 'bg-rose-100 text-rose-500 dark:bg-rose-900/40 dark:text-rose-400 group-hover:bg-rose-200' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 group-hover:bg-slate-200'
                                    }`}>
                                      {isSelected ? (
                                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                                      ) : (
                                        <div className={`w-1.5 h-1.5 rounded-full ${isRed ? 'bg-rose-400' : 'bg-slate-300 dark:bg-slate-500'}`} />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 shrink-0 flex gap-3">
                <button 
                  id="btn-save-role-permissions"
                  onClick={handleSubmit}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer text-sm"
                >
                  حفظ وتطبيق الصلاحيات
                </button>
                <button 
                  id="btn-cancel-role-permissions"
                  onClick={() => setShowModal(false)}
                  className="px-8 font-black text-slate-500 hover:bg-white dark:hover:bg-slate-700 rounded-2xl transition-all cursor-pointer text-sm"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
