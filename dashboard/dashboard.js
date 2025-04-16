// dashboard/dashboard.js
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getDatabase, ref, onValue, get, child, update, set } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const addNodeBtn = document.getElementById("addNodeFloatingBtn");
  const instructionsModal = document.getElementById("nodeInstructionsModal");
  const closeInstructions = document.getElementById("closeInstructions");
  const createNewBtn = document.getElementById("createNewBtn");
  const copyUIDBtn = document.getElementById("copyUIDBtn");
  const userUIDSpan = document.getElementById("userUID");
  const displayNameSpan = document.getElementById("displayName");
  const deviceListDiv = document.getElementById("device-list");
  
  // Device Config modal elements
  const deviceConfigModal = document.getElementById("deviceConfigModal");
  const closeDeviceConfig = document.getElementById("closeDeviceConfig");
  const modeSelect = document.getElementById("modeSelect");
  const timerConfig = document.getElementById("timerConfig");
  const alarmConfig = document.getElementById("alarmConfig");
  const timerDurationSelect = document.getElementById("timerDuration");
  const customTimerDuration = document.getElementById("customTimerDuration");
  const alarmOnTime = document.getElementById("alarmOnTime");
  const alarmOffTime = document.getElementById("alarmOffTime");
  const alarmRepeat = document.getElementById("alarmRepeat");
  const saveConfigBtn = document.getElementById("saveConfigBtn");
  const configDeviceIdInput = document.getElementById("configDeviceId");

  const auth = getAuth();
  const db = getDatabase();
  
  // Listen for auth state changes to update UID, username, and load devices
  auth.onAuthStateChanged(user => {
    if (user) {
      userUIDSpan.textContent = user.uid;
      
      // Retrieve username from user profile
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
          const deviceCard = document.createElement("div");
          deviceCard.className = "device-card";
          deviceCard.id = "device-" + deviceId;
          
          // Status dot
          const statusDot = document.createElement("span");
          statusDot.className = "status-dot online"; // will be updated by heartbeat check
          deviceCard.appendChild(statusDot);
          
          // Device name
          const nameH3 = document.createElement("h3");
          nameH3.textContent = deviceData.name || deviceId;
          deviceCard.appendChild(nameH3);
          
          // Display Mode info
          const modeInfo = document.createElement("p");
          modeInfo.className = "mode-info";
          let modeText = "";
          if(deviceData.mode === 0) {
            modeText = "Basic Switch";
          } else if(deviceData.mode === 1) {
            modeText = "Timer Mode";
          } else if(deviceData.mode === 2) {
            modeText = "Alarm Mode";
          }
          modeInfo.textContent = "Mode: " + modeText;
          deviceCard.appendChild(modeInfo);
          
          // Timer Remaining info (if in Timer mode)
          if(deviceData.mode === 1 && deviceData.hasOwnProperty("timerRemaining")) {
            const timerInfo = document.createElement("p");
            timerInfo.className = "timer-info";
            timerInfo.textContent = "Time remaining: " + deviceData.timerRemaining + "s";
            deviceCard.appendChild(timerInfo);
          }
          
          // Switch button
          const toggleBtn = document.createElement("button");
          toggleBtn.className = "switch-btn";
          toggleBtn.textContent = (deviceData.switch == 1) ? "Turn Off" : "Turn On";
          toggleBtn.onclick = () => {
            const newState = (deviceData.switch == 1) ? 0 : 1;
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { switch: newState });
          };
          deviceCard.appendChild(toggleBtn);
          
          // Reconfigure button (for factory reset)
          const reconfigureBtn = document.createElement("button");
          reconfigureBtn.className = "reconfigure-btn";
          reconfigureBtn.textContent = "Reconfigure";
          reconfigureBtn.onclick = () => {
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { reset: 1 });
            alert("Reset signal sent to device.");
          };
          deviceCard.appendChild(reconfigureBtn);
          
          // Configure button (to set mode/timer/alarm settings)
          const configureBtn = document.createElement("button");
          configureBtn.className = "configure-btn";
          configureBtn.textContent = "Configure";
          configureBtn.onclick = () => {
            openConfigModal(deviceId, deviceData);
          };
          deviceCard.appendChild(configureBtn);
          
          // Optionally display switch feedback and heartbeat value
          const feedbackPara = document.createElement("p");
          feedbackPara.className = "feedback-status";
          feedbackPara.textContent = "Feedback: " + ((deviceData.switchFeedback == 1) ? "ON" : "OFF");
          deviceCard.appendChild(feedbackPara);
          
          // Track last update for heartbeat (using data attributes)
          if(deviceData.hasOwnProperty("alive")){
            if(deviceCard.dataset.aliveValue !== String(deviceData.alive)){
              deviceCard.dataset.lastUpdate = Date.now();
              deviceCard.dataset.aliveValue = deviceData.alive;
            }
          } else {
            if(!deviceCard.dataset.lastUpdate){
              deviceCard.dataset.lastUpdate = "0";
            }
          }
          
          // Optionally display heartbeat value for debugging
          if(deviceData.hasOwnProperty("alive")){
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
  
  // Heartbeat check: every 2 seconds update online/offline status based on last update
  setInterval(() => {
    const deviceCards = document.querySelectorAll(".device-card");
    const now = Date.now();
    deviceCards.forEach(card => {
      const lastUpdate = parseInt(card.dataset.lastUpdate) || 0;
      const statusDot = card.querySelector(".status-dot");
      if(now - lastUpdate > 6000) {
        statusDot.classList.remove("online");
        statusDot.classList.add("offline");
      } else {
        statusDot.classList.remove("offline");
        statusDot.classList.add("online");
      }
    });
  }, 2000);
  
  // Modal: Show Node Instructions modal when floating button is clicked
  addNodeBtn.addEventListener("click", () => {
    instructionsModal.style.display = "block";
  });
  
  // Close Node Instructions modal
  closeInstructions.addEventListener("click", () => {
    instructionsModal.style.display = "none";
  });
  
  window.addEventListener("click", (event) => {
    if (event.target === instructionsModal) {
      instructionsModal.style.display = "none";
    }
    if (event.target === deviceConfigModal) {
      deviceConfigModal.style.display = "none";
    }
  });
  
  // "Create New Now" button opens the ESP provisioning page in a new tab
  createNewBtn.addEventListener("click", () => {
    window.open("http://192.168.4.1", "_blank");
  });
  
  // Copy UID to clipboard
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
  
  // Configuration Modal Logic
  function openConfigModal(deviceId, deviceData) {
    // Pre-fill modal fields with current device data
    configDeviceIdInput.value = deviceId;
    modeSelect.value = deviceData.mode;
    // Show/hide timer and alarm fields based on mode
    if(deviceData.mode == 1) {
      timerConfig.style.display = "block";
      alarmConfig.style.display = "none";
      timerDurationSelect.value = deviceData.timerDuration || "1";
      customTimerDuration.style.display = (timerDurationSelect.value === "custom") ? "block" : "none";
    } else if(deviceData.mode == 2) {
      timerConfig.style.display = "none";
      alarmConfig.style.display = "block";
      // Parse alarmConfig (if exists) to set fields
      if(deviceData.alarmConfig){
        try {
          const config = JSON.parse(deviceData.alarmConfig);
          alarmOnTime.value = config.onTime;
          alarmOffTime.value = config.offTime;
          alarmRepeat.value = config.repeat;
        } catch(e) {
          console.error("Invalid alarmConfig format.", e);
        }
      }
    } else {
      timerConfig.style.display = "none";
      alarmConfig.style.display = "none";
    }
    deviceConfigModal.style.display = "block";
  }
  
  // Handle mode select change to show/hide relevant input fields
  modeSelect.addEventListener("change", () => {
    const val = modeSelect.value;
    if(val == "1") {
      timerConfig.style.display = "block";
      alarmConfig.style.display = "none";
    } else if(val == "2") {
      timerConfig.style.display = "none";
      alarmConfig.style.display = "block";
    } else {
      timerConfig.style.display = "none";
      alarmConfig.style.display = "none";
    }
  });
  
  // Show custom timer input if "custom" is selected
  timerDurationSelect.addEventListener("change", () => {
    if(timerDurationSelect.value === "custom") {
      customTimerDuration.style.display = "block";
    } else {
      customTimerDuration.style.display = "none";
    }
  });
  
  // Save configuration changes
  saveConfigBtn.addEventListener("click", () => {
    const deviceId = configDeviceIdInput.value;
    const selectedMode = parseInt(modeSelect.value);
    let updateData = { mode: selectedMode };
    if(selectedMode === 1) {
      // Timer mode: set timerDuration
      let duration;
      if(timerDurationSelect.value === "custom") {
        duration = parseInt(customTimerDuration.value) || 1;
      } else {
        duration = parseInt(timerDurationSelect.value);
      }
      updateData.timerDuration = duration;
      // Reset timerRemaining when new configuration is saved
      updateData.timerRemaining = 0;
    } else if(selectedMode === 2) {
      // Alarm mode: create alarmConfig JSON string
      let alarmConf = {
        enabled: 1,
        onTime: alarmOnTime.value,
        offTime: alarmOffTime.value,
        repeat: alarmRepeat.value
      };
      updateData.alarmConfig = JSON.stringify(alarmConf);
    }
    // Update Firebase for this device
    update(ref(db, "users/" + userUIDSpan.textContent + "/devices/" + deviceId), updateData)
      .then(() => {
        alert("Configuration updated successfully.");
        deviceConfigModal.style.display = "none";
      })
      .catch(error => {
        alert("Error updating configuration: " + error.message);
      });
  });
  
  // Close the device configuration modal
  closeDeviceConfig.addEventListener("click", () => {
    deviceConfigModal.style.display = "none";
  });
  
  console.log("Dashboard JS loaded and ready.");
});
