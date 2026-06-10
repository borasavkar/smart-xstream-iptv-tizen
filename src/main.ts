// App entry: register screens and route to intro (first run) or home.
import { Router } from './app/router';
import { setRouter } from './app/nav';
import { registerRemoteKeys } from './input/remote';
import { Settings } from './storage/settings';
import { setLanguage, languages } from './i18n/strings';
import { introScreen } from './screens/intro';
import { profilesScreen } from './screens/profiles';
import { homeScreen } from './screens/home';
import { playerScreen } from './screens/player';
import { liveCategoriesScreen } from './screens/livecategories';
import { channelsScreen } from './screens/channels';
import { filmsScreen } from './screens/films';
import { filmDetailScreen } from './screens/filmdetail';
import { seriesListScreen } from './screens/serieslist';
import { seriesDetailScreen } from './screens/seriesdetail';
import { favoritesScreen } from './screens/favorites';
import { subscriptionScreen } from './screens/subscription';
import { settingsScreen } from './screens/settings';

function boot(): void {
  registerRemoteKeys();

  // Apply UI language (Phase 6). Unknown system languages fall back to English.
  const lang = Settings.uiLang();
  setLanguage(languages.some((l) => l.code === lang) ? lang : 'en');
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Keep the focused element in view (TV remote navigation across rails/lists).
  document.addEventListener('focusin', (e) => {
    (e.target as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  });

  const router = new Router(document.getElementById('root') as HTMLElement);
  setRouter(router);

  router.register('intro', introScreen);
  router.register('profiles', profilesScreen);
  router.register('home', homeScreen);
  router.register('player', playerScreen);
  router.register('livecategories', liveCategoriesScreen);
  router.register('channels', channelsScreen);
  router.register('films', filmsScreen);
  router.register('filmdetail', filmDetailScreen);
  router.register('serieslist', seriesListScreen);
  router.register('seriesdetail', seriesDetailScreen);
  router.register('favorites', favoritesScreen);
  router.register('subscription', subscriptionScreen);
  router.register('settings', settingsScreen);

  // Mirrors IntroActivity: skip intro once seen, otherwise show it first.
  router.navigate(Settings.introSeen() ? 'home' : 'intro');
}

window.addEventListener('load', boot);
