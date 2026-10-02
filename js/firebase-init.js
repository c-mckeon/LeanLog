// Initialize Firebase and expose the Realtime Database globally.
var firebaseConfig = {
  apiKey: "AIzaSyB-o4kEZgS38OMuo73aaZmPCZGjQTa2udU",
  databaseURL: "https://userworkouttracker-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "userworkouttracker",
  storageBucket: "userworkouttracker.firebasestorage.app",
  messagingSenderId: "57653792694",
  appId: "1:57653792694:web:686b3547adf608c801bb17",
  measurementId: "G-QC3YVXCCP4"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();
var rawDatabase = firebase.database();

window.rawDatabase = rawDatabase;
window.publicDatabase = rawDatabase;
window.database = rawDatabase;
window.getUserDatabaseRef = function (path = '') {
  return window.database.ref(path);
};


