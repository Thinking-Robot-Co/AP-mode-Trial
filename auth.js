// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  signOut,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

// New Firebase configuration for motor-pump-control project
const firebaseConfig = {
  apiKey: "AIzaSyAz4af9x1vMIL379tvFyrMU_GQXGQpm5Tw",
  authDomain: "motor-pump-control.firebaseapp.com",
  databaseURL: "https://motor-pump-control-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "motor-pump-control",
  storageBucket: "motor-pump-control.firebasestorage.app",
  messagingSenderId: "283332291399",
  appId: "1:283332291399:web:d8c34e9d345b64bb3dba62",
  measurementId: "G-NWF9PDJKB8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Utility: display message in target element
function showMessage(targetId, msg, isError = true) {
  const targetEl = document.getElementById(targetId);
  if (!targetEl) return;
  targetEl.style.color = isError ? "#ff4f4f" : "#4caf50";
  targetEl.textContent = msg;
}

document.addEventListener("DOMContentLoaded", () => {
  
  // Sign Up function
  window.signUp = function () {
    const username = document.getElementById("signupUsername").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const msgElId = "signupMessage";
    
    if (!username) {
      showMessage(msgElId, "Please enter a username.", true);
      return;
    }
    
    createUserWithEmailAndPassword(auth, email, password)
      .then(userCredential => {
        const user = userCredential.user;
        // Save user profile information in the database
        return set(ref(db, "users/" + user.uid + "/profile"), {
          username: username,
          email: email,
          createdAt: Date.now()
        });
      })
      .then(() => {
        showMessage(msgElId, "Account created successfully! Redirecting...", false);
        window.location.href = "dashboard.html";
      })
      .catch(error => {
        showMessage(msgElId, "Signup error: " + error.message, true);
      });
  };

  // Login function
  window.login = function () {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const rememberMe = document.getElementById("rememberMe").checked;
    const msgElId = "loginMessage";
    
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    
    setPersistence(auth, persistence)
      .then(() => signInWithEmailAndPassword(auth, email, password))
      .then(() => {
        showMessage(msgElId, "Login successful! Redirecting...", false);
        window.location.href = "dashboard.html";
      })
      .catch(error => {
        showMessage(msgElId, "Login error: " + error.message, true);
      });
  };

  // Logout function (to be used in dashboard)
  window.logout = function () {
    signOut(auth)
      .then(() => window.location.href = "login.html")
      .catch(error => console.error("Error during logout:", error));
  };
});
