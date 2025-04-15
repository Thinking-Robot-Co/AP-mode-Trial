// dashboard/dashboard.js
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getDatabase, ref, onValue, get, child, update } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
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

  // Listen for auth state changes to update UID, username, and load devices
  auth.onAuthStateChanged(user => {
    if (user) {
      // Update UID display
      userUIDSpan.textContent = user.uid;
      
      // Retrieve and update username
      const userProfileRef = ref(db, "users/" + user.uid + "/profile");
      get(child(userProfileRef, "username"))
        .then(snapshot => {
          displayNameSpan.textContent = snapshot.exists() ? snapshot.val() : "User";
        })
        .catch(error => {
          console.error("Error fetching username:", error);
          displayNameSpan.textContent = "User";
        });
      
      // Load device list for the current user
      loadDeviceList(user.uid);
    }
  });
  
  // Function to load device list
  function loadDeviceList(uid) {
    const devicesRef = ref(db, "users/" + uid + "/devices");
    onValue(devicesRef, snapshot => {
      deviceListDiv.innerHTML = ""; // Clear existing devices
      if (snapshot.exists()) {
        const devices = snapshot.val();
        Object.entries(devices).forEach(([deviceId, deviceData]) => {
          // Create device card
          const deviceCard = document.createElement("div");
          deviceCard.className = "device-card";
          deviceCard.id = "device-" + deviceId;
  
          // Create and insert status dot at top-left
          const statusDot = document.createElement("span");
          statusDot.className = "status-dot online"; // assume online initially
          deviceCard.appendChild(statusDot);
  
          // Device name element
          const nameH3 = document.createElement("h3");
          nameH3.textContent = deviceData.name || deviceId;
          deviceCard.appendChild(nameH3);
  
          // Switch button
          const toggleBtn = document.createElement("button");
          toggleBtn.className = "switch-btn";
          toggleBtn.textContent = deviceData.switch ? "Turn Off" : "Turn On";
          toggleBtn.onclick = () => {
            const newState = !deviceData.switch;
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { switch: newState });
          };
          deviceCard.appendChild(toggleBtn);
  
          // Reconfigure button
          const reconfigureBtn = document.createElement("button");
          reconfigureBtn.className = "reconfigure-btn";
          reconfigureBtn.textContent = "Reconfigure";
          reconfigureBtn.onclick = () => {
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { reset: 1 });
            alert("Reset signal sent to device.");
          };
          deviceCard.appendChild(reconfigureBtn);
  
          // Display switchFeedback status (Feedback from ESP)
          if (deviceData.hasOwnProperty("switchFeedback")) {
            const feedbackPara = document.createElement("p");
            feedbackPara.className = "feedback-status";
            feedbackPara.textContent = "Feedback: " + (deviceData.switchFeedback ? "ON" : "OFF");
            deviceCard.appendChild(feedbackPara);
          }
  
          // Update last heartbeat update time if "alive" exists
          if (deviceData.hasOwnProperty("alive")) {
            deviceCard.dataset.lastUpdate = Date.now();
          } else {
            deviceCard.dataset.lastUpdate = "0";
          }
  
          // Optionally: display the alive number for debugging
          if (deviceData.hasOwnProperty("alive")) {
            const alivePara = document.createElement("p");
            alivePara.textContent = "Heartbeat: " + deviceData.alive;
            deviceCard.appendChild(alivePara);
          }
  
          deviceListDiv.appendChild(deviceCard);
        });
      } else {
        deviceListDiv.innerHTML = "<p>No devices found.</p>";
      }
    });
  }
  
  // Set an interval to check heartbeat status every 2 seconds (as updated)
  setInterval(() => {
    const deviceCards = document.querySelectorAll(".device-card");
    const now = Date.now();
    deviceCards.forEach(card => {
      const lastUpdate = parseInt(card.dataset.lastUpdate) || 0;
      const statusDot = card.querySelector(".status-dot");
      // If more than 6000ms have passed since last update, mark as offline; otherwise, online.
      if (now - lastUpdate > 6000) {
        statusDot.classList.remove("online");
        statusDot.classList.add("offline");
      } else {
        statusDot.classList.remove("offline");
        statusDot.classList.add("online");
      }
    });
  }, 2000);
  
  // Modal: Show when floating button is clicked
  addNodeBtn.addEventListener("click", () => {
    instructionsModal.style.display = "block";
  });
  
  // Modal: Close when close icon is clicked
  closeInstructions.addEventListener("click", () => {
    instructionsModal.style.display = "none";
  });
  
  // Modal: Close if clicking outside modal content
  window.addEventListener("click", (event) => {
    if (event.target === instructionsModal) {
      instructionsModal.style.display = "none";
    }
  });
  
  // "Create New Now" button: Open the ESP provisioning page in a new tab
  createNewBtn.addEventListener("click", () => {
    window.open("http://192.168.4.1", "_blank");
  });
  
  // Copy UID button: Copy UID text to clipboard
  copyUIDBtn.addEventListener("click", () => {
    const uidText = userUIDSpan.textContent;
    navigator.clipboard.writeText(uidText)
      .then(() => {
        copyUIDBtn.textContent = "Copied!";
        setTimeout(() => {
          copyUIDBtn.textContent = "Copy";
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy UID:", err);
      });
  });
  
  console.log("Dashboard JS loaded and ready.");
});
