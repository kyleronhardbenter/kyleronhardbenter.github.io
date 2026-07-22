importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAapba1gadT0M7ZjnEOIcg4Gj2SPE0HoJU",
  authDomain: "chalito-collblanc.firebaseapp.com",
  projectId: "chalito-collblanc",
  storageBucket: "chalito-collblanc.firebasestorage.app",
  messagingSenderId: "654415271839",
  appId: "1:654415271839:web:3bbabebca91415e8d00faa"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    data: payload.data,
    requireInteraction: true
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/dashboard.html')
  );
});