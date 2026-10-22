import { useEffect, useRef } from "react";
import { toast } from "sonner";

export interface BackHandler {
  id: string;
  name?: string;
  onBack: () => boolean | void;
  priority?: number;
  pushedHistory?: boolean;
}

class BackButtonManager {
  private stack: BackHandler[] = [];
  private ignorePopstateCount = 0;
  private lastRootPressTime = 0;
  private isInitialized = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.init();
    }
  }

  public init() {
    if (this.isInitialized || typeof window === "undefined") return;
    this.isInitialized = true;

    // Ensure there is a root state so back button produces a popstate event
    try {
      if (!window.history.state || !window.history.state.__appRoot) {
        window.history.replaceState({ __appRoot: true, timestamp: Date.now() }, "");
        window.history.pushState({ __appRoot: false, __depth: 1 }, "");
      }
    } catch (e) {
      console.warn("Back button history init error:", e);
    }

    window.addEventListener("popstate", this.handlePopState);
  }

  private handlePopState = () => {
    // If popstate was triggered by our own programmatic history.back(), skip handling
    if (this.ignorePopstateCount > 0) {
      this.ignorePopstateCount--;
      return;
    }

    // 1. If there is an active registered handler in the stack (modals, previews, sub-views):
    if (this.stack.length > 0) {
      const handler = this.stack.pop();
      if (handler) {
        handler.pushedHistory = false; // already popped by the browser popstate
        try {
          const result = handler.onBack();
          // If the handler returned false, cancel back action and restore
          if (result === false) {
            window.history.pushState({ __handlerId: handler.id }, "");
            handler.pushedHistory = true;
            this.stack.push(handler);
          }
        } catch (e) {
          console.error("Error executing back button handler:", e);
        }
      }
      return;
    }

    // 2. Fallback: Check if there is an un-hooked visible DOM modal overlay currently on screen
    try {
      const overlays = Array.from(document.querySelectorAll<HTMLElement>('.fixed.inset-0, [role="dialog"]'));
      const visibleModal = overlays.reverse().find(el => {
        // Exclude sidebar overlay if hidden
        if (el.classList.contains('pointer-events-none')) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.clientHeight > 50;
      });

      if (visibleModal) {
        // Look for close button inside this modal
        let closeBtn = visibleModal.querySelector<HTMLElement>(
          'button[aria-label*="close" i], button[aria-label*="إغلاق" i], button:has(svg.lucide-x), button:has(svg.lucide-arrow-right), button[data-modal-close]'
        );

        if (!closeBtn) {
          const buttons = Array.from(visibleModal.querySelectorAll<HTMLButtonElement>('button'));
          closeBtn = buttons.find(b => {
            const text = (b.textContent || '').trim();
            return text === 'إغلاق' || text === 'إلغاء' || text === 'رجوع' || text === 'عودة' || !!b.querySelector('svg.lucide-x');
          }) || null;
        }

        if (closeBtn) {
          closeBtn.click();
          // Push state back so user stays in the app
          window.history.pushState({ __appRoot: false, __depth: 1 }, "");
          return;
        }
      }
    } catch (e) {
      console.warn("Fallback DOM modal search error:", e);
    }

    // 3. User is at the root view:
    const now = Date.now();
    if (now - this.lastRootPressTime < 2000) {
      // Double tap back within 2 seconds: Allow natural exit
      this.lastRootPressTime = 0;
    } else {
      // First tap at root: Show toast notification and keep root state
      this.lastRootPressTime = now;
      try {
        toast.info("اضغط رجوع مرة أخرى للخروج من التطبيق", {
          duration: 2000,
          position: "bottom-center",
        });
        window.history.pushState({ __appRoot: false, __depth: 1 }, "");
      } catch (e) {
        console.warn("Error showing double back toast:", e);
      }
    }
  };

  /**
   * Register a back handler. When active is true, pushes a state to browser history.
   */
  public register(handler: BackHandler) {
    if (typeof window === "undefined") return () => {};

    this.init();

    // Remove existing if duplicate id
    this.unregister(handler.id, false);

    // Push history entry for this handler
    try {
      window.history.pushState({ __handlerId: handler.id, name: handler.name }, "");
      handler.pushedHistory = true;
    } catch (e) {
      console.warn("Error pushing history state:", e);
    }

    this.stack.push(handler);
    // Sort by priority (higher priority runs first)
    this.stack.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return () => this.unregister(handler.id, true);
  }

  /**
   * Unregister a back handler. If closed via UI (popHistory = true), pops the history entry.
   */
  public unregister(id: string, popHistory = true) {
    const index = this.stack.findIndex((item) => item.id === id);
    if (index !== -1) {
      const [handler] = this.stack.splice(index, 1);
      if (popHistory && handler?.pushedHistory && typeof window !== "undefined") {
        try {
          this.ignorePopstateCount++;
          window.history.back();
        } catch (e) {
          if (this.ignorePopstateCount > 0) this.ignorePopstateCount--;
          console.warn("Error popping browser history:", e);
        }
      }
    }
  }

  /**
   * Dismiss all handlers matching a given name without popping history.
   * Useful when closing a drawer/sidebar upon navigating forward to a new view.
   */
  public dismissByName(name: string, popHistory = false) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].name === name) {
        const [handler] = this.stack.splice(i, 1);
        if (popHistory && handler?.pushedHistory && typeof window !== "undefined") {
          try {
            this.ignorePopstateCount++;
            window.history.back();
          } catch (e) {
            if (this.ignorePopstateCount > 0) this.ignorePopstateCount--;
            console.warn("Error popping browser history:", e);
          }
        }
      }
    }
  }

  public getStackLength() {
    return this.stack.length;
  }
}

export const backManager = new BackButtonManager();

/**
 * Custom React Hook to connect any modal, drawer, preview, or sub-view to the phone's back button.
 *
 * @param active - Whether the modal or sub-view is currently open/active
 * @param onBack - Function to execute when user presses phone back button (e.g. () => setOpen(false))
 * @param name - Optional label for debugging/identification
 * @param priority - Priority level (higher numbers are closed first, default 0)
 */
export function useBackButton(
  active: boolean,
  onBack: () => boolean | void,
  name?: string,
  priority = 0
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;

    const id = `${name || "modal"}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const unregister = backManager.register({
      id,
      name,
      priority,
      onBack: () => onBackRef.current(),
    });

    return () => {
      unregister();
    };
  }, [active, name, priority]);
}
