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
      // Fetch username
      const userProfileRef = ref(db, "users/" + user.uid + "/profile");
      get(child(userProfileRef, "username"))
        .then(snapshot => {
          displayNameSpan.textContent = snapshot.exists() ? snapshot.val() : "User";
        })
        .catch(error => {
          console.error("Error fetching username:", error);
          displayNameSpan.textContent = "User";
        });
      // Load device list for the user
      loadDeviceList(user.uid);
    }
  });
  
  // Function to load device list and build device cards
  function loadDeviceList(uid) {
    const devicesRef = ref(db, "users/" + uid + "/devices");
    onValue(devicesRef, snapshot => {
      deviceListDiv.innerHTML = ""; // Clear current content
      if (snapshot.exists()) {
        const devices = snapshot.val();
        Object.entries(devices).forEach(([deviceId, deviceData]) => {
          // Create device card container
          const deviceCard = document.createElement("div");
          deviceCard.className = "device-card";
          deviceCard.id = "device-" + deviceId;
  
          // Status dot
          const statusDot = document.createElement("span");
          statusDot.className = "status-dot online"; // defaults to online
          deviceCard.appendChild(statusDot);
  
          // Device name
          const nameH3 = document.createElement("h3");
          nameH3.textContent = deviceData.name || deviceId;
          deviceCard.appendChild(nameH3);
  
          // ----- Switch Mode Section -----
          const switchContainer = document.createElement("div");
          switchContainer.className = "mode-section";
  
          const switchLabel = document.createElement("label");
          switchLabel.textContent = "Switch Mode:";
          switchContainer.appendChild(switchLabel);
  
          const switchBtn = document.createElement("button");
          switchBtn.className = "switch-btn";
          // Button text based on current state
          switchBtn.textContent = deviceData.switch ? "Turn Off" : "Turn On";
          switchBtn.onclick = () => {
            // Toggle switch state
            const newState = !deviceData.switch;
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { switch: newState });
          };
          switchContainer.appendChild(switchBtn);
          deviceCard.appendChild(switchContainer);
  
          // ----- Timer Mode Section -----
          const timerContainer = document.createElement("div");
          timerContainer.className = "mode-section";
  
          // Timer mode checkbox
          const timerCheckbox = document.createElement("input");
          timerCheckbox.type = "checkbox";
          timerCheckbox.id = "timer-" + deviceId;
          timerCheckbox.checked = deviceData.timer == 1;
          timerCheckbox.onchange = () => {
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { timer: timerCheckbox.checked ? 1 : 0 });
          };
          timerContainer.appendChild(timerCheckbox);
  
          const timerLabel = document.createElement("label");
          timerLabel.setAttribute("for", "timer-" + deviceId);
          timerLabel.textContent = " Timer Mode";
          timerContainer.appendChild(timerLabel);
  
          // Timer duration dropdown
          const timerSelect = document.createElement("select");
          timerSelect.id = "timerDuration-" + deviceId;
          const timerOptions = [1, 2, 5, 10, 15, 30];
          timerOptions.forEach(val => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = val + " min";
            timerSelect.appendChild(opt);
          });
          const optOther = document.createElement("option");
          optOther.value = "other";
          optOther.textContent = "Other";
          timerSelect.appendChild(optOther);
          // Set default duration (if available; otherwise default to 1 minute)
          timerSelect.value = deviceData.timerDuration ? deviceData.timerDuration : 1;
          timerSelect.onchange = () => {
            if (timerSelect.value === "other") {
              const customTime = prompt("Enter custom timer duration in minutes:");
              if (customTime) {
                update(ref(db, "users/" + uid + "/devices/" + deviceId), { timerDuration: customTime });
              }
            } else {
              update(ref(db, "users/" + uid + "/devices/" + deviceId), { timerDuration: parseInt(timerSelect.value) });
            }
          };
          timerContainer.appendChild(timerSelect);
          deviceCard.appendChild(timerContainer);
  
          // ----- Clock/Alarm Mode Section -----
          const clockContainer = document.createElement("div");
          clockContainer.className = "mode-section";
  
          // Clock mode checkbox
          const clockCheckbox = document.createElement("input");
          clockCheckbox.type = "checkbox";
          clockCheckbox.id = "clock-" + deviceId;
          clockCheckbox.checked = deviceData.clock == 1;
          clockCheckbox.onchange = () => {
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { clock: clockCheckbox.checked ? 1 : 0 });
          };
          clockContainer.appendChild(clockCheckbox);
  
          const clockLabel = document.createElement("label");
          clockLabel.setAttribute("for", "clock-" + deviceId);
          clockLabel.textContent = " Clock/Alarm Mode";
          clockContainer.appendChild(clockLabel);
  
          // Clock parameters: Start time, End time, Frequency
          const clockParamsDiv = document.createElement("div");
          clockParamsDiv.className = "clock-params";
  
          const startLabel = document.createElement("label");
          startLabel.textContent = "Start:";
          clockParamsDiv.appendChild(startLabel);
          const startTimeInput = document.createElement("input");
          startTimeInput.type = "time";
          startTimeInput.id = "startTime-" + deviceId;
          startTimeInput.value = deviceData.alarmStart || "19:00";
          startTimeInput.onchange = () => {
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { alarmStart: startTimeInput.value });
          };
          clockParamsDiv.appendChild(startTimeInput);
  
          const endLabel = document.createElement("label");
          endLabel.textContent = " End:";
          clockParamsDiv.appendChild(endLabel);
          const endTimeInput = document.createElement("input");
          endTimeInput.type = "time";
          endTimeInput.id = "endTime-" + deviceId;
          endTimeInput.value = deviceData.alarmEnd || "19:10";
          endTimeInput.onchange = () => {
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { alarmEnd: endTimeInput.value });
          };
          clockParamsDiv.appendChild(endTimeInput);
  
          const freqLabel = document.createElement("label");
          freqLabel.textContent = " Frequency:";
          clockParamsDiv.appendChild(freqLabel);
          const frequencySelect = document.createElement("select");
          frequencySelect.id = "frequency-" + deviceId;
          const frequencies = ["Daily", "Weekly", "Monthly", "Custom"];
          frequencies.forEach(freq => {
            const opt = document.createElement("option");
            opt.value = freq;
            opt.textContent = freq;
            frequencySelect.appendChild(opt);
          });
          frequencySelect.value = deviceData.alarmFrequency || "Daily";
          frequencySelect.onchange = () => {
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { alarmFrequency: frequencySelect.value });
          };
          clockParamsDiv.appendChild(frequencySelect);
  
          clockContainer.appendChild(clockParamsDiv);
          deviceCard.appendChild(clockContainer);
  
          // ----- Reconfigure Button -----
          const reconfigureBtn = document.createElement("button");
          reconfigureBtn.className = "reconfigure-btn";
          reconfigureBtn.textContent = "Reconfigure";
          reconfigureBtn.onclick = () => {
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { reset: 1 });
            alert("Reset signal sent to device.");
          };
          deviceCard.appendChild(reconfigureBtn);
  
          // ----- Feedback (existing switch feedback) -----
          const feedbackPara = document.createElement("p");
          feedbackPara.className = "feedback-status";
          feedbackPara.textContent = "Feedback: " + ((deviceData.switchFeedback == 1) ? "ON" : "OFF");
          deviceCard.appendChild(feedbackPara);
  
          // ----- Heartbeat Handling -----
          if (deviceData.hasOwnProperty("alive")) {
            if (deviceCard.dataset.aliveValue !== String(deviceData.alive)) {
              deviceCard.dataset.lastUpdate = Date.now();
              deviceCard.dataset.aliveValue = deviceData.alive;
            }
          } else {
            if (!deviceCard.dataset.lastUpdate) {
              deviceCard.dataset.lastUpdate = "0";
            }
          }
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
  
  // Interval to check heartbeat status every 2 seconds
  setInterval(() => {
    const deviceCards = document.querySelectorAll(".device-card");
    const now = Date.now();
    deviceCards.forEach(card => {
      const lastUpdate = parseInt(card.dataset.lastUpdate) || 0;
      const statusDot = card.querySelector(".status-dot");
      // Mark as offline if more than 6000ms have passed
      if (now - lastUpdate > 6000) {
        statusDot.classList.remove("online");
        statusDot.classList.add("offline");
      } else {
        statusDot.classList.remove("offline");
        statusDot.classList.add("online");
      }
    });
  }, 2000);
  
  // Modal events for node addition instructions
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
