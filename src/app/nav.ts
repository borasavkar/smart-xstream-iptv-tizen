// Navigation facade — lets screens navigate without a circular import on Router.
import type { Router } from './router';

let router: Router | null = null;

export function setRouter(r: Router): void { router = r; }

export const nav = {
  go(name: string, params?: Record<string, unknown>): void { router?.navigate(name, params); },
  replace(name: string, params?: Record<string, unknown>): void { router?.replace(name, params); },
  back(): void { router?.back(); },
};
