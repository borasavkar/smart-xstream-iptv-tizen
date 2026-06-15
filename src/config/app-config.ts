// App configuration. Firebase values are the same project as the Android app
// (smartxtreamlicense). NOTE: the apiKey below is the Android key — if Firestore
// REST calls fail with a 403/restricted error, create a *Web* (or unrestricted)
// API key in the Firebase/Google Cloud console and paste it here. Enable
// Anonymous Auth in Firebase for the trial check to work.
export const CONFIG = {
  // Mağaza sürümü (Billing Info: Free): true iken deneme/abonelik kapısı tamamen
  // kapalıdır — herkes tam erişimlidir ve subscription ekranına hiçbir yol gitmez.
  // Samsung Checkout (Partner) entegrasyonu hazır olduğunda false yapıp ürün
  // kimliklerini doldurarak mevcut kullanıcılar dahil herkesi paralı modele
  // geçirebilirsiniz (uygulama kimliği aynı kaldığı sürece güncellemeyle gelir).
  freeRelease: true,

  firebase: {
    projectId: 'smartxtreamlicense',
    apiKey: 'AIzaSyAuIjQ3-RV9P87vkMqk-xhyS8gnGw-5wPI',
  },
  trialDays: 7,

  // Samsung Checkout product IDs — create these in Samsung Seller Office / DPI,
  // then paste their IDs here.
  products: {
    monthly: '',
    yearly: '',
    lifetime: '',
  },
  samsungCheckout: {
    appId: '',                 // Samsung Apps (DPI) app id
    mode: 'DEV' as 'DEV' | 'PRD',
  },

  // OpenSubtitles dış altyazı. apiKey = uygulamanın "consumer" kimliği (geliştirici
  // tarafından bir kez alınır, ücretsiz). Kullanıcılar kendi hesaplarıyla giriş yapar.
  openSubtitles: {
    apiKey: '0ZoUXlm9XbWU18oGOkVLKRz7jeSQFuEk',
    userAgent: 'SmartXtreamAIIPTV v1.0',
  },
};
