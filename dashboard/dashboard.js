// dashboard/dashboard.js
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  child,
  onValue,
  update
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  // Modal elements
  const addNodeBtn = document.getElementById("addNodeFloatingBtn");
  const instructionsModal = document.getElementById("nodeInstructionsModal");
  const closeInstructions = document.getElementById("closeInstructions");
  const createNewBtn = document.getElementById("createNewBtn");
  const copyUIDBtn = document.getElementById("copyUIDBtn");
  const userUIDSpan = document.getElementById("userUID");
  const displayNameSpan = document.getElementById("displayName");
  const deviceListDiv = document.getElementById("device-list");

  const auth = getAuth();
  const db = getDatabase();

  // Listen for auth state changes
  auth.onAuthStateChanged(user => {
    if (user) {
      // Immediately update UID in the instructions modal
      userUIDSpan.textContent = user.uid;
      
      // Retrieve username from "users/<uid>/profile/username" and update header greeting
      const userProfileRef = ref(db, "users/" + user.uid + "/profile");
      get(child(userProfileRef, "username"))
        .then(snapshot => {
          if (snapshot.exists()) {
            displayNameSpan.textContent = snapshot.val();
          } else {
            displayNameSpan.textContent = "User";
          }
        })
        .catch(error => {
          console.error("Error fetching username:", error);
          displayNameSpan.textContent = "User";
        });
      
      // Retrieve all devices for this user and render them
      const devicesRef = ref(db, "users/" + user.uid + "/devices");
      onValue(devicesRef, snapshot => {
        deviceListDiv.innerHTML = ""; // Clear previous device cards
        if (snapshot.exists()) {
          const devices = snapshot.val();
          Object.entries(devices).forEach(([deviceId, deviceData]) => {
            renderDevice(deviceId, deviceData, user.uid);
          });
        } else {
          deviceListDiv.innerHTML = "<p>No devices found.</p>";
        }
      });
    }
  });

  // Function to render a device card
  function renderDevice(deviceId, data, uid) {
    const deviceCard = document.createElement("div");
    deviceCard.className = "device-card";

    // Device name
    const nameElem = document.createElement("h3");
    nameElem.textContent = data.name || deviceId;

    // Toggle button to change switch state
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "switch-btn";
    toggleBtn.textContent = data.switch ? "Turn Off" : "Turn On";
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newState = !data.switch;
      update(ref(db, "users/" + uid + "/devices/" + deviceId), { switch: newState });
    });

    // Reconfigure button sends a reset signal
    const resetBtn = document.createElement("button");
    resetBtn.className = "reconfigure-btn";
    resetBtn.textContent = "Reconfigure";
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      update(ref(db, "users/" + uid + "/devices/" + deviceId), { reset: true });
      alert("Reset signal sent to device.");
    });

    deviceCard.appendChild(nameElem);
    deviceCard.appendChild(toggleBtn);
    deviceCard.appendChild(resetBtn);

    deviceListDiv.appendChild(deviceCard);
  }

  // Modal functionality
  addNodeBtn.addEventListener("click", () => {
    instructionsModal.style.display = "block";
  });
  closeInstructions.addEventListener("click", () => {
    instructionsModal.style.display = "none";
  });
  window.addEventListener("click", (event) => {
    if (event.target === instructionsModal) {
      instructionsModal.style.display = "none";
    }
  });
  createNewBtn.addEventListener("click", () => {
    window.open("http://192.168.4.1", "_blank");
  });
  copyUIDBtn.addEventListener("click", () => {
    const uidText = userUIDSpan.textContent;
    navigator.clipboard.writeText(uidText)
      .then(() => {
        copyUIDBtn.textContent = "Copied!";
        setTimeout(() => { copyUIDBtn.textContent = "Copy"; }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy UID:", err);
      });
  });

  console.log("Dashboard JS loaded and ready.");
});
