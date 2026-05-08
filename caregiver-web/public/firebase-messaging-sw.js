/**
 * Firebase Messaging Service Worker — handles background push notifications.
 * Registered only when Firebase config is available.
 * On notification click: opens /alerts deep link.
 */

/* eslint-disable no-undef */
/* global importScripts, firebase, self, clients */

importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

/**
 * Firebase config is injected at runtime via query params during SW registration,
 * or falls back to environment defaults. For simplicity, we hardcode a placeholder
 * that must be replaced with actual config in deployment.
 */
firebase.initializeApp({
  apiKey: '__FIREBASE_API_KEY__',
  authDomain: '__FIREBASE_AUTH_DOMAIN__',
  projectId: '__FIREBASE_PROJECT_ID__',
  storageBucket: '__FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__FIREBASE_APP_ID__',
});

const messaging = firebase.messaging();

/**
 * Handle background messages (when app is not in foreground).
 * The notification is shown automatically by FCM if the payload has a `notification` field.
 * This handler is for data-only messages or custom notification display.
 */
messaging.onBackgroundMessage(function (payload) {
  var notificationTitle = 'ElderCare Alert';
  var notificationBody = 'New health alert detected';
  var anomalyId = '';
  var elderId = '';

  if (payload.notification) {
    notificationTitle = payload.notification.title || notificationTitle;
    notificationBody = payload.notification.body || notificationBody;
  }

  if (payload.data) {
    anomalyId = payload.data.anomalyId || '';
    elderId = payload.data.elderId || '';
  }

  var notificationOptions = {
    body: notificationBody,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: anomalyId || 'eldercare-alert',
    data: {
      anomalyId: anomalyId,
      elderId: elderId,
      url: anomalyId ? '/alerts?highlight=' + anomalyId : '/alerts',
    },
    actions: [
      { action: 'view', title: 'View Alert' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Handle notification click — open /alerts deep link.
 */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var targetUrl = '/alerts';
  if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If a window is already open, focus it
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes('/alerts') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(targetUrl);
    })
  );
});
