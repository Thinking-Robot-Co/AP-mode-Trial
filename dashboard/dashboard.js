// dashboard/dashboard.js
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getDatabase, ref, onValue, get, child, update, push, remove } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

// Helper function to format seconds into "M min S sec"
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + " min " + s + " sec";
}

document.addEventListener("DOMContentLoaded", () => {
  const addNodeBtn = document.getElementById("addNodeFloatingBtn");
  const instructionsModal = document.getElementById("nodeInstructionsModal");
  const closeInstructions = document.getElementById("closeInstructions");
  const createNewBtn = document.getElementById("createNewBtn");
  const copyUIDBtn = document.getElementById("copyUIDBtn");
  const userUIDSpan = document.getElementById("userUID");
  const displayNameSpan = document.getElementById("displayName");
  const deviceListDiv = document.getElementById("device-list");
  
  // Alarm Modal Elements
  const alarmModal = document.getElementById("alarmModal");
  const closeAlarmModal = document.getElementById("closeAlarmModal");
  const alarmForm = document.getElementById("alarmForm");
  let currentDeviceIdForAlarm = null; // To remember which device card triggered alarm addition

  const auth = getAuth();
  const db = getDatabase();

  // Listen for auth state changes to update UID, username, and load devices
  auth.onAuthStateChanged(user => {
    if (user) {
      userUIDSpan.textContent = user.uid;
      const userProfileRef = ref(db, "users/" + user.uid + "/profile");
      get(child(userProfileRef, "username"))
        .then(snapshot => {
          displayNameSpan.textContent = snapshot.exists() ? snapshot.val() : "User";
        })
        .catch(error => {
          console.error("Error fetching username:", error);
          displayNameSpan.textContent = "User";
        });
      loadDeviceList(user.uid);
    }
  });
  
  // Function to load device list and build device cards
  function loadDeviceList(uid) {
    const devicesRef = ref(db, "users/" + uid + "/devices");
    onValue(devicesRef, snapshot => {
      deviceListDiv.innerHTML = "";
      if (snapshot.exists()) {
        const devices = snapshot.val();
        Object.entries(devices).forEach(([deviceId, deviceData]) => {
          // Create device card container
          const deviceCard = document.createElement("div");
          deviceCard.className = "device-card";
          deviceCard.id = "device-" + deviceId;
  
          // Status dot
          const statusDot = document.createElement("span");
          statusDot.className = "status-dot online";
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
          switchBtn.classList.add("switch-btn");
          if (deviceData.switch) {
            switchBtn.textContent = "Turn Off";
            switchBtn.classList.add("on");
          } else {
            switchBtn.textContent = "Turn On";
            switchBtn.classList.add("off");
          }
          switchBtn.onclick = () => {
            const newState = !deviceData.switch;
            update(ref(db, "users/" + uid + "/devices/" + deviceId), { switch: newState });
          };
          switchContainer.appendChild(switchBtn);
          deviceCard.appendChild(switchContainer);
  
          // ----- Timer Mode Section -----
          const timerContainer = document.createElement("div");
          timerContainer.className = "mode-section";
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
          timerSelect.value = deviceData.timerDuration ? deviceData.timerDuration : 1;
          timerSelect.onchange = () => {
            if (timerSelect.value === "other") {
              const customTime = prompt("Enter custom timer duration in minutes:");
              if (customTime) {
                const customMinutes = parseInt(customTime);
                if (!isNaN(customMinutes) && customMinutes > 0) {
                  update(ref(db, "users/" + uid + "/devices/" + deviceId), { timerDuration: customMinutes });
                } else {
                  alert("Please enter a valid positive number for minutes.");
                }
              }
            } else {
              update(ref(db, "users/" + uid + "/devices/" + deviceId), { timerDuration: parseInt(timerSelect.value) });
            }
          };
          timerContainer.appendChild(timerSelect);
  
          const timerFeedbackPara = document.createElement("p");
          timerFeedbackPara.className = "feedback-timer";
          if (deviceData.timerFeedback) {
            const seconds = parseInt(deviceData.timerFeedback);
            timerFeedbackPara.textContent = "Time remaining: " + formatTime(seconds);
          } else {
            timerFeedbackPara.textContent = "Time remaining: N/A";
          }
          timerContainer.appendChild(timerFeedbackPara);
          deviceCard.appendChild(timerContainer);
  
          // ----- Clock/Alarm Mode Section -----
          const clockContainer = document.createElement("div");
          clockContainer.className = "mode-section";
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
  
          // Container for listing alarms
          const alarmsListDiv = document.createElement("div");
          alarmsListDiv.id = "alarmsList-" + deviceId;
          alarmsListDiv.style.marginTop = "5px";
          // Fetch and display alarms for this device
          const alarmsRef = ref(db, "users/" + uid + "/devices/" + deviceId + "/alarms");
          onValue(alarmsRef, snapshot => {
            alarmsListDiv.innerHTML = "";
            if (snapshot.exists()) {
              const alarms = snapshot.val();
              Object.entries(alarms).forEach(([alarmId, alarmData]) => {
                const alarmDiv = document.createElement("div");
                alarmDiv.style.borderTop = "1px dashed #ccc";
                alarmDiv.style.marginTop = "5px";
                alarmDiv.style.paddingTop = "3px";
                alarmDiv.textContent = "On: " + (alarmData.onTime || "") + " | Off: " + (alarmData.offTime || "") + " | Repeat: " + (alarmData.repeat || "None");
                // Delete button
                const delBtn = document.createElement("button");
                delBtn.textContent = "Delete";
                delBtn.style.fontSize = "0.8em";
                delBtn.style.marginLeft = "5px";
                delBtn.onclick = () => {
                  if (confirm("Delete this alarm?")) {
                    remove(ref(db, "users/" + uid + "/devices/" + deviceId + "/alarms/" + alarmId));
                  }
                };
                alarmDiv.appendChild(delBtn);
                alarmsListDiv.appendChild(alarmDiv);
              });
            } else {
              alarmsListDiv.innerHTML = "<em>No alarms scheduled.</em>";
            }
          });
          clockContainer.appendChild(alarmsListDiv);
  
          // "Add Auto On Clock" button
          const addAlarmBtn = document.createElement("button");
          addAlarmBtn.textContent = "Add Auto On Clock";
          addAlarmBtn.style.marginTop = "5px";
          addAlarmBtn.onclick = () => {
            currentDeviceIdForAlarm = deviceId;
            alarmModal.style.display = "block";
          };
          clockContainer.appendChild(addAlarmBtn);
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
  
          // ----- Feedback: Switch feedback -----
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
      if (now - lastUpdate > 6000) {
        statusDot.classList.remove("online");
        statusDot.classList.add("offline");
      } else {
        statusDot.classList.remove("offline");
        statusDot.classList.add("online");
      }
    });
  }, 2000);
  
  // Modal events for node instructions
  addNodeBtn.addEventListener("click", () => {
    instructionsModal.style.display = "block";
  });
  closeInstructions.addEventListener("click", () => {
    instructionsModal.style.display = "none";
  });
  window.addEventListener("click", event => {
    if (event.target === instructionsModal) {
      instructionsModal.style.display = "none";
    }
    if (event.target === alarmModal) {
      alarmModal.style.display = "none";
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
      .catch(err => {
        console.error("Failed to copy UID:", err);
      });
  
    console.log("Dashboard JS loaded and ready.");
  });
  
  // Handle Alarm Modal close
  closeAlarmModal.addEventListener("click", () => {
    alarmModal.style.display = "none";
  });
  
  // Handle Alarm Form submission
  alarmForm.addEventListener("submit", event => {
    event.preventDefault();
    const onTime = document.getElementById("alarmOnTime").value;
    const offTime = document.getElementById("alarmOffTime").value;
    const repeatVal = document.getElementById("alarmRepeat").value;
    let repeatStr = repeatVal;
    if (repeatVal === "Custom") {
      // Collect checked days
      const days = [];
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
        if (document.getElementById("day" + day).checked) {
          days.push(day);
        }
      });
      repeatStr = days.join(",");
      if (repeatStr === "") {
        alert("Please select at least one day for custom repeat.");
        return;
      }
    }
    // Build alarm object
    const alarmData = {
      onTime: onTime,
      offTime: offTime,
      repeat: repeatStr
    };
    // Push alarm to Firebase under the device's alarms node
    const alarmsRef = ref(db, "users/" + userUIDSpan.textContent + "/devices/" + currentDeviceIdForAlarm + "/alarms");
    push(alarmsRef, alarmData)
      .then(() => {
        alert("Alarm added successfully.");
        alarmModal.style.display = "none";
      })
      .catch(error => {
        alert("Error adding alarm: " + error.message);
      });
  });
  
  // Show/hide custom days based on repeat selection
  document.getElementById("alarmRepeat").addEventListener("change", function() {
    if (this.value === "Custom") {
      document.getElementById("customDays").style.display = "block";
    } else {
      document.getElementById("customDays").style.display = "none";
    }
  });
});
