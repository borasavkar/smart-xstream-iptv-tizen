// App configuration. Firebase values are the same project as the Android app
// (smartxtreamlicense). NOTE: the apiKey below is the Android key — if Firestore
// REST calls fail with a 403/restricted error, create a *Web* (or unrestricted)
// API key in the Firebase/Google Cloud console and paste it here. Enable
// Anonymous Auth in Firebase for the trial check to work.
export const CONFIG = {
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
};
