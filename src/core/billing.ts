// Premium / subscriptions. SCAFFOLD for Samsung Checkout (Tizen TV in-app
// purchase). Real purchases require products defined in Samsung Seller Office /
// DPI and the on-device webapis.billing API. Until those exist, purchase() grants
// premium locally so the upgrade flow is fully testable.
import { Settings } from '../storage/settings';
import { CONFIG } from '../config/app-config';

export type Plan = 'monthly' | 'yearly' | 'lifetime';

// Minimal shape of the Tizen Samsung Checkout billing API (guarded at runtime).
interface TizenBilling {
  buyItem(appId: string, serverType: string, payDetails: string, onSuccess: (data: unknown) => void, onError: (e: unknown) => void): void;
  getUserPurchaseList?(appId: string, serverType: string, onSuccess: (data: unknown) => void, onError: (e: unknown) => void): void;
}
function billingApi(): TizenBilling | null {
  const w = window as unknown as { webapis?: { billing?: TizenBilling } };
  return w.webapis?.billing ?? null;
}

export const Billing = {
  isPremium(): boolean { return Settings.premium(); },

  async purchase(plan: Plan): Promise<boolean> {
    const productId = CONFIG.products[plan];
    const api = billingApi();

    if (api && productId && CONFIG.samsungCheckout.appId) {
      // TODO: production Samsung Checkout flow.
      // api.buyItem(CONFIG.samsungCheckout.appId, CONFIG.samsungCheckout.mode,
      //   JSON.stringify({ OrderItemID: productId, ... }), onSuccess, onError);
      return await new Promise<boolean>((resolve) => {
        api.buyItem(
          CONFIG.samsungCheckout.appId, CONFIG.samsungCheckout.mode, JSON.stringify({ OrderItemID: productId }),
          () => { Settings.setPremium(true); resolve(true); },
          () => resolve(false),
        );
      });
    }

    // No Seller products yet (or browser): grant locally so the flow is testable.
    Settings.setPremium(true);
    return true;
  },

  /** Re-check existing purchases (call on startup once Checkout is wired). */
  async restore(): Promise<boolean> {
    // TODO: api.getUserPurchaseList(...) → if an active sub/lifetime exists → setPremium(true)
    return Settings.premium();
  },
};
