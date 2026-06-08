// Paywall, ported from SubscriptionActivity. Shown when the trial expires (or
// from settings). Lists the three plans; a purchase grants premium and returns
// home. (Real prices/purchase come from Samsung Checkout once products exist.)
import { el, toast } from '../ui/dom';
import { t } from '../i18n/strings';
import { Billing, type Plan } from '../core/billing';
import { nav } from '../app/nav';
import type { Screen } from '../app/router';

export function subscriptionScreen(): Screen {
  const status = el('div', { class: 'sub-status-msg' });

  async function buy(plan: Plan): Promise<void> {
    status.textContent = t('msg_connecting');
    const ok = await Billing.purchase(plan);
    if (ok) {
      status.textContent = t('msg_premium_active');
      toast(t('msg_purchase_success'));
      setTimeout(() => nav.replace('home'), 1300);
    } else {
      status.textContent = t('msg_connecting_retry');
    }
  }

  const planBtn = (plan: Plan, label: string, badge: string): HTMLElement =>
    el('button', { class: 'plan-btn', focusable: true, onClick: () => void buy(plan) }, [
      el('span', { class: 'plan-label', text: label }),
      el('span', { class: 'plan-badge', text: badge }),
    ]);

  const root = el('div', { class: 'screen subscription' }, [
    el('div', { class: 'sub-card' }, [
      el('div', { class: 'sub-crown', text: '♛' }),
      el('h1', { class: 'sub-title', text: t('open_premium_properties') }),
      el('p', { class: 'sub-desc', text: t('tria_exp_text') }),
      el('div', { class: 'plans' }, [
        planBtn('yearly', t('annual_subscription_with_advantage'), '★'),
        planBtn('monthly', t('monthly_subscription'), ''),
        planBtn('lifetime', t('lifeTime_subscription'), '∞'),
      ]),
      status,
    ]),
  ]);

  return { el: root };
}
