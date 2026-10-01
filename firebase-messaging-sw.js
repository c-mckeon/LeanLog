// Import Firebase messaging
import { getMessaging, onBackgroundMessage } from 'https://www.gstatic.com/firebasejs/9.17.1/firebase-messaging-sw.js';

// Firebase configuration (replace with your actual Firebase config)
const firebaseConfig = {
  apiKey: "AIzaSyAvY5Rvn4L0YpYG9YoHJHAQJiuyShB6z48",
  authDomain: "workouts-725cd.firebaseapp.com",
  databaseURL: "https://workouts-725cd-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "workouts-725cd",
  storageBucket: "workouts-725cd.appspot.com",
  messagingSenderId: "827249841873",
  appId: "1:827249841873:web:b9906649f774d1be9257f0"
};

// Initialize Firebase messaging
const messaging = getMessaging();

// Handle background push messages
onBackgroundMessage(messaging, (payload) => {
  console.log('Received background message: ', payload);

  // Show notification
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: payload.notification.icon || '/default-icon.png', // Fallback icon (you can replace with your own)
  });
});
