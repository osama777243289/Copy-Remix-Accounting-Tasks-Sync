import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';

interface PermissionContextType {
  currentUser: User | null;
  currentRole: Role | null;
  users: User[];
  roles: Role[];
  setCurrentUser: (user: User | null) => void;
  hasPermission: (permissionId: string, context?: string) => boolean;
  canAccessAccount: (accountId: string) => boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ 
  children: React.ReactNode, 
  users: User[], 
  roles: Role[] 
}> = ({ children, users, roles }) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      // Clear any legacy persistent session to enforce session-only auth
      localStorage.removeItem('current_user_id');
      return sessionStorage.getItem('current_user_id');
    }
    return null;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  useEffect(() => {
    if (currentUserId) {
      const user = users.find(u => u.id === currentUserId);
      if (user) {
        setCurrentUser(user);
        const role = roles.find(r => r.id === user.roleId);
        setCurrentRole(role || null);
        sessionStorage.setItem('current_user_id', currentUserId);
        localStorage.removeItem('current_user_id');
      } else {
        setCurrentUser(null);
        setCurrentRole(null);
      }
    } else {
      setCurrentUser(null);
      setCurrentRole(null);
      sessionStorage.removeItem('current_user_id');
      localStorage.removeItem('current_user_id');
    }
  }, [currentUserId, users, roles]);

  const hasPermission = (permissionId: string, context?: string) => {
    if (!currentRole) return false;
    // Super-admin or system admin has universal access
    if (
      currentRole.name === 'المدير العام' ||
      currentRole.name === 'مدير النظام' ||
      (currentRole as any).id === 'admin'
    ) {
      return true;
    }

    const perms = currentRole.permissions || [];

    // Check direct context-specific permission ID (e.g. 'field-booking-discount-calendar' or 'btn-manage-discounts-halls')
    if (context) {
      const contextPermId = `${permissionId}-${context}`;
      if (perms.includes(contextPermId)) return true;
    }

    if (perms.includes(permissionId)) return true;

    // Granular element & button cross-references
    if (permissionId === 'btn-create-booking' && (perms.includes('create-booking') || (context && perms.includes(`btn-create-booking-${context}`)))) return true;
    if (permissionId === 'create-booking' && (perms.includes('btn-create-booking') || (context && perms.includes(`create-booking-${context}`)))) return true;
    if (permissionId === 'btn-edit-booking' && (perms.includes('edit-booking') || (context && perms.includes(`btn-edit-booking-${context}`)))) return true;
    if (permissionId === 'edit-booking' && (perms.includes('btn-edit-booking') || (context && perms.includes(`edit-booking-${context}`)))) return true;
    if (permissionId === 'btn-cancel-booking' && perms.includes('cancel-booking')) return true;
    if (permissionId === 'cancel-booking' && perms.includes('btn-cancel-booking')) return true;
    if (permissionId === 'btn-delete-booking' && perms.includes('delete-booking')) return true;
    if (permissionId === 'delete-booking' && perms.includes('btn-delete-booking')) return true;
    if (permissionId === 'btn-print-contract' && (perms.includes('print-booking') || perms.includes('btn-preview-paper-contract') || perms.includes('btn-preview-digital-contract'))) return true;
    if (permissionId === 'btn-collect-payment' && (perms.includes('collect-booking-payment') || perms.includes('btn-preview-collect-payments'))) return true;
    if (permissionId === 'collect-booking-payment' && perms.includes('btn-collect-payment')) return true;
    if (permissionId === 'btn-preview-post-revenue' && (perms.includes('btn-preview-post-revenue') || perms.includes('btn-preview-post-unpost-revenue') || perms.includes('accrue-booking') || perms.includes('btn-accrue-revenue'))) return true;
    if (permissionId === 'btn-preview-unpost-revenue' && (perms.includes('btn-preview-unpost-revenue') || perms.includes('btn-preview-post-unpost-revenue') || perms.includes('unpost-booking') || perms.includes('btn-unpost-booking'))) return true;
    if (permissionId === 'btn-accrue-revenue' && (perms.includes('accrue-booking') || perms.includes('btn-preview-post-revenue') || perms.includes('btn-preview-post-unpost-revenue'))) return true;
    if (permissionId === 'accrue-booking' && (perms.includes('btn-accrue-revenue') || perms.includes('btn-preview-post-revenue'))) return true;
    if (permissionId === 'btn-unpost-booking' && (perms.includes('unpost-booking') || perms.includes('btn-preview-unpost-revenue') || perms.includes('btn-preview-post-unpost-revenue'))) return true;
    if (permissionId === 'unpost-booking' && (perms.includes('btn-unpost-booking') || perms.includes('btn-preview-unpost-revenue'))) return true;
    if (permissionId === 'btn-refund-insurance' && (perms.includes('refund-insurance') || perms.includes('btn-preview-refund-insurance'))) return true;
    if (permissionId === 'refund-insurance' && perms.includes('btn-refund-insurance')) return true;
    if (permissionId === 'btn-refund-deposit' && (perms.includes('refund-deposit') || perms.includes('btn-preview-refund-deposit'))) return true;
    if (permissionId === 'refund-deposit' && perms.includes('btn-refund-deposit')) return true;
    if (permissionId === 'btn-refund-mortgage' && (perms.includes('refund-mortgage') || perms.includes('btn-preview-refund-mortgage'))) return true;
    if (permissionId === 'refund-mortgage' && perms.includes('btn-refund-mortgage')) return true;
    if (permissionId === 'override-min-rental-price' && (perms.includes('override-min-price') || perms.includes('manage-halls') || perms.includes('approve-discounts'))) return true;
    if (permissionId === 'override-min-price' && (perms.includes('override-min-rental-price') || perms.includes('manage-halls') || perms.includes('approve-discounts'))) return true;
    if (permissionId === 'btn-manage-discounts' && (perms.includes('manage-discounts') || perms.includes('btn-preview-manage-discounts') || perms.includes('btn-discounts-screen-new-request') || (context && perms.includes(`btn-manage-discounts-${context}`)))) return true;
    if (permissionId === 'field-booking-discount' && (context && perms.includes(`field-booking-discount-${context}`))) return true;
    if (permissionId === 'field-booking-days-discount' && (perms.includes('field-booking-days-discount') || perms.includes('field-booking-discount') || (context && perms.includes(`field-booking-discount-${context}`)))) return true;
    if (permissionId === 'btn-approve-discount' && (perms.includes('approve-discounts') || perms.includes('btn-discount-modal-instant-approve') || perms.includes('btn-discounts-screen-approve'))) return true;
    if (permissionId === 'approve-discounts' && perms.includes('btn-approve-discount')) return true;
    if (permissionId === 'btn-reject-discount' && perms.includes('btn-discounts-screen-reject')) return true;
    if (permissionId === 'btn-request-discount' && (perms.includes('btn-discount-modal-request-approval') || perms.includes('btn-discounts-screen-new-request'))) return true;
    if (permissionId === 'btn-print-discount' && (perms.includes('print-discount') || perms.includes('btn-discount-modal-print-notice') || perms.includes('btn-discounts-screen-print'))) return true;
    if (permissionId === 'print-discount' && perms.includes('btn-print-discount')) return true;
    if (permissionId === 'btn-print-financial-statement' && perms.includes('print-booking-financial-statement')) return true;
    if (permissionId === 'print-booking-financial-statement' && perms.includes('btn-print-financial-statement')) return true;
    if (permissionId === 'btn-open-financial-statement' && (perms.includes('view-booking-financial-statement') || perms.includes('view-accounts') || perms.includes('btn-preview-account-statement'))) return true;
    if (permissionId === 'view-booking-financial-statement' && perms.includes('btn-open-financial-statement')) return true;
    if (permissionId === 'btn-request-amendment' && (perms.includes('view-booking-amendments') || perms.includes('edit-booking') || perms.includes('btn-preview-request-amendment'))) return true;
    if (permissionId === 'view-booking-amendments' && (perms.includes('btn-request-amendment') || perms.includes('view-bookings') || perms.includes('view-halls'))) return true;

    if (permissionId === 'btn-create-voucher' && perms.includes('create-voucher')) return true;
    if (permissionId === 'create-voucher' && perms.includes('btn-create-voucher')) return true;
    if (permissionId === 'btn-edit-voucher' && perms.includes('edit-voucher')) return true;
    if (permissionId === 'edit-voucher' && perms.includes('btn-edit-voucher')) return true;
    if (permissionId === 'btn-delete-voucher' && perms.includes('delete-voucher')) return true;
    if (permissionId === 'delete-voucher' && perms.includes('btn-delete-voucher')) return true;
    if (permissionId === 'btn-print-voucher' && perms.includes('print-voucher')) return true;
    if (permissionId === 'print-voucher' && perms.includes('btn-print-voucher')) return true;

    if (permissionId === 'btn-create-transaction' && perms.includes('create-transaction')) return true;
    if (permissionId === 'create-transaction' && perms.includes('btn-create-transaction')) return true;
    if (permissionId === 'btn-edit-transaction' && perms.includes('edit-transaction')) return true;
    if (permissionId === 'edit-transaction' && perms.includes('btn-edit-transaction')) return true;
    if (permissionId === 'btn-delete-transaction' && perms.includes('delete-transaction')) return true;
    if (permissionId === 'delete-transaction' && perms.includes('btn-delete-transaction')) return true;

    if (permissionId === 'btn-create-account' && perms.includes('create-account')) return true;
    if (permissionId === 'create-account' && perms.includes('btn-create-account')) return true;
    if (permissionId === 'btn-edit-account' && perms.includes('edit-account')) return true;
    if (permissionId === 'edit-account' && perms.includes('btn-edit-account')) return true;
    if (permissionId === 'btn-delete-account' && perms.includes('delete-account')) return true;
    if (permissionId === 'delete-account' && perms.includes('btn-delete-account')) return true;

    if (permissionId === 'btn-create-hall' && perms.includes('create-hall')) return true;
    if (permissionId === 'create-hall' && perms.includes('btn-create-hall')) return true;
    if (permissionId === 'btn-edit-hall' && perms.includes('edit-hall')) return true;
    if (permissionId === 'edit-hall' && perms.includes('btn-edit-hall')) return true;
    if (permissionId === 'btn-delete-hall' && perms.includes('delete-hall')) return true;
    if (permissionId === 'delete-hall' && perms.includes('btn-delete-hall')) return true;

    if (permissionId === 'btn-create-client' && perms.includes('create-client')) return true;
    if (permissionId === 'create-client' && perms.includes('btn-create-client')) return true;
    if (permissionId === 'btn-edit-client' && perms.includes('edit-client')) return true;
    if (permissionId === 'edit-client' && perms.includes('btn-edit-client')) return true;
    if (permissionId === 'btn-delete-client' && perms.includes('delete-client')) return true;
    if (permissionId === 'delete-client' && perms.includes('btn-delete-client')) return true;

    if (permissionId === 'btn-create-employee' && perms.includes('create-employee')) return true;
    if (permissionId === 'create-employee' && perms.includes('btn-create-employee')) return true;
    if (permissionId === 'btn-edit-employee' && perms.includes('edit-employee')) return true;
    if (permissionId === 'edit-employee' && perms.includes('btn-edit-employee')) return true;
    if (permissionId === 'btn-delete-employee' && perms.includes('delete-employee')) return true;
    if (permissionId === 'delete-employee' && perms.includes('btn-delete-employee')) return true;

    if (permissionId === 'btn-create-service' && perms.includes('create-service')) return true;
    if (permissionId === 'create-service' && perms.includes('btn-create-service')) return true;
    if (permissionId === 'btn-edit-service' && perms.includes('edit-service')) return true;
    if (permissionId === 'edit-service' && perms.includes('btn-edit-service')) return true;
    if (permissionId === 'btn-delete-service' && perms.includes('delete-service')) return true;
    if (permissionId === 'delete-service' && perms.includes('btn-delete-service')) return true;

    // Card-level fallbacks
    if (permissionId === 'card-dashboard-alerts' && perms.includes('view-dashboard')) return true;
    if (permissionId === 'card-dashboard-stats' && (perms.includes('card-booking-stats') || perms.includes('view-dashboard'))) return true;
    if (permissionId === 'card-dashboard-profitability' && perms.includes('view-sensitive-financial-totals')) return true;
    if (permissionId === 'card-dashboard-variance' && perms.includes('view-sensitive-financial-totals')) return true;
    if (permissionId === 'card-statement-client' && (perms.includes('view-account-statement') || perms.includes('view-accounts') || perms.includes('view-booking-financial-statement'))) return true;
    if (permissionId === 'card-statement-mortgage' && (perms.includes('refund-mortgage') || perms.includes('view-booking-financial-statement') || perms.includes('view-accounts'))) return true;
    if (permissionId === 'card-statement-insurance' && (perms.includes('refund-insurance') || perms.includes('view-booking-financial-statement') || perms.includes('view-accounts'))) return true;
    if (permissionId === 'table-statement-transactions' && (perms.includes('view-transactions') || perms.includes('view-booking-financial-statement') || perms.includes('view-accounts'))) return true;
    if (permissionId === 'card-vouchers-summary' && perms.includes('view-vouchers')) return true;
    if (permissionId === 'card-transactions-summary' && perms.includes('view-transactions')) return true;
    if (permissionId === 'card-accounts-stats' && perms.includes('view-accounts')) return true;
    if (permissionId === 'card-discounts-stats' && (perms.includes('view-discounts') || perms.includes('manage-discounts'))) return true;
    if (permissionId === 'card-refund-stats' && perms.includes('view-deposit-refunds')) return true;
    if (permissionId === 'card-payroll-stats' && perms.includes('view-payroll')) return true;

    return false;
  };

  const canAccessAccount = (accountId: string) => {
    if (!currentUser) return false;
    // Admins and managers have full access
    if (currentRole?.name === 'المدير العام' || currentRole?.name === 'مدير النظام') {
      return true;
    }
    // If the user has a restricted list of allowed accounts, restrict them
    if (currentUser.allowedAccountIds && currentUser.allowedAccountIds.length > 0) {
      return currentUser.allowedAccountIds.includes(accountId);
    }
    // Default fallback: check if they have general permission
    return hasPermission('view-accounts');
  };

  const setUser = (user: User | null) => {
    setCurrentUserId(user ? user.id : null);
  };

  return (
    <PermissionContext.Provider value={{ 
      currentUser, 
      currentRole, 
      users,
      roles,
      setCurrentUser: setUser, 
      hasPermission,
      canAccessAccount
    }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    const savedUserId = typeof window !== 'undefined' ? sessionStorage.getItem('current_user_id') : null;
    return {
      currentUser: savedUserId ? ({ id: savedUserId } as User) : null,
      currentRole: null,
      users: [] as User[],
      roles: [] as Role[],
      setCurrentUser: () => {},
      hasPermission: () => true,
      canAccessAccount: () => true,
    };
  }
  return context;
};

export const PermissionGuard: React.FC<{ 
  permission?: string;
  elementId?: string;
  context?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ permission, elementId, context, children, fallback = null }) => {
  const { hasPermission } = usePermissions();
  
  const hasPerm = permission ? hasPermission(permission, context) : true;
  const hasElem = elementId ? hasPermission(elementId, context) : true;
  
  if (hasPerm && hasElem) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
};
