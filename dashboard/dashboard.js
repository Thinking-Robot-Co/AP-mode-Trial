// dashboard/dashboard.js
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getDatabase, ref, onValue, get, child, update, remove, push } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

// Helper function to format seconds into "M min S sec"
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + " min " + s + " sec";
}

// Global flag to suspend re-rendering during alarm editing
let globalEditingAlarm = false;

// Render a single alarm entry
function renderAlarmEntry(alarmObj, alarmId, uid, deviceId) {
  const entryDiv = document.createElement("div");
  entryDiv.className = "alarm-entry";
  
  // Build description text from alarm properties
  const desc = document.createElement("span");
  let text = "On: " + (alarmObj.onTime || "N/A") +
             " | Off: " + (alarmObj.offTime || "N/A") +
             " | Repeat: " + (alarmObj.repeat || "none");
  if (alarmObj.repeat === "custom" && alarmObj.days) {
    let daysArr = [];
    for (const day in alarmObj.days) {
      if (alarmObj.days[day]) daysArr.push(day);
    }
    text += " (" + daysArr.join(", ") + ")";
  }
  desc.textContent = text;
  entryDiv.appendChild(desc);
  
  // Delete button for the alarm
  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.onclick = () => {
    remove(ref(getDatabase(), "users/" + uid + "/devices/" + deviceId + "/alarms/" + alarmId))
      .then(() => console.log("Alarm deleted"))
      .catch(err => console.error("Delete error:", err));
  };
  entryDiv.appendChild(delBtn);
  
  return entryDiv;
}

// Show an inline form to add a new alarm; on submit update Firebase
function showAddAlarmForm(alarmsContainer, uid, deviceId) {
  // Set editing flag so that onValue does not re-render
  globalEditingAlarm = true;
  
  // Create a form div
  const formDiv = document.createElement("div");
  formDiv.className = "add-alarm-form";
  
  // On time input
  const onTimeLabel = document.createElement("label");
  onTimeLabel.textContent = "On Time:";
  formDiv.appendChild(onTimeLabel);
  const onTimeInput = document.createElement("input");
  onTimeInput.type = "time";
  onTimeInput.required = true;
  formDiv.appendChild(onTimeInput);
  
  // Off time input
  const offTimeLabel = document.createElement("label");
  offTimeLabel.textContent = " Off Time:";
  formDiv.appendChild(offTimeLabel);
  const offTimeInput = document.createElement("input");
  offTimeInput.type = "time";
  offTimeInput.required = true;
  formDiv.appendChild(offTimeInput);
  
  // Repeat select
  const repeatLabel = document.createElement("label");
  repeatLabel.textContent = " Repeat:";
  formDiv.appendChild(repeatLabel);
  const repeatSelect = document.createElement("select");
  const options = [
    { value: "none", text: "No Repeat" },
    { value: "daily", text: "Every Day" },
    { value: "custom", text: "Custom" }
  ];
  options.forEach(optData => {
    const opt = document.createElement("option");
    opt.value = optData.value;
    opt.textContent = optData.text;
    repeatSelect.appendChild(opt);
  });
  formDiv.appendChild(repeatSelect);
  
  // Div for custom day checkboxes (hidden unless "custom" selected)
  const daysDiv = document.createElement("div");
  daysDiv.className = "alarm-days";
  daysDiv.style.display = "none"; // hidden initially
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  dayNames.forEach(day => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "day_" + day;
    checkbox.value = day;
    const label = document.createElement("label");
    label.setAttribute("for", "day_" + day);
    label.textContent = day;
    daysDiv.appendChild(checkbox);
    daysDiv.appendChild(label);
  });
  formDiv.appendChild(daysDiv);
  
  // Show/hide custom days based on repeat select
  repeatSelect.onchange = () => {
    daysDiv.style.display = (repeatSelect.value === "custom") ? "block" : "none";
  };
  
  // Form buttons: Save and Cancel
  const btnDiv = document.createElement("div");
  btnDiv.className = "alarm-form-buttons";
  const saveBtn = document.createElement("button");
  saveBtn.className = "save-btn";
  saveBtn.textContent = "Save";
  saveBtn.onclick = () => {
    const onTime = onTimeInput.value;
    const offTime = offTimeInput.value;
    const repeat = repeatSelect.value;
    let alarmData = {
      onTime: onTime,
      offTime: offTime,
      repeat: repeat
    };
    if (repeat === "custom") {
      let days = {};
      dayNames.forEach(day => {
        const cb = daysDiv.querySelector('#day_' + day);
        days[day] = cb.checked;
      });
      alarmData.days = days;
    }
    // Use current timestamp as key for new alarm
    const alarmId = Date.now().toString();
    update(ref(getDatabase(), "users/" + uid + "/devices/" + deviceId + "/alarms/" + alarmId), alarmData)
      .then(() => {
        console.log("Alarm saved");
        globalEditingAlarm = false;
        formDiv.remove();
      })
      .catch(err => {
        console.error("Error saving alarm:", err);
      });
  };
  btnDiv.appendChild(saveBtn);
  
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "cancel-btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => {
    globalEditingAlarm = false;
    formDiv.remove();
  };
  btnDiv.appendChild(cancelBtn);
  formDiv.appendChild(btnDiv);
  
  alarmsContainer.appendChild(formDiv);
}

// Function to show the reset confirmation modal for factory reset
function showResetModal(uid, deviceId) {
  const resetModal = document.getElementById("resetModal");
  resetModal.style.display = "block";
  
  // When the user clicks "Yes, Reset"
  document.getElementById("confirmResetBtn").onclick = () => {
    update(ref(getDatabase(), "users/" + uid + "/devices/" + deviceId), { reset: 1 })
      .then(() => {
        alert("Reset signal sent to device.");
        resetModal.style.display = "none";
      })
      .catch(err => {
        console.error("Error sending reset:", err);
        resetModal.style.display = "none";
      });
  };
  
  // When the user cancels
  document.getElementById("cancelResetBtn").onclick = () => {
    resetModal.style.display = "none";
  };
  
  // Also allow closing via the close icon
  document.getElementById("closeResetModal").onclick = () => {
    resetModal.style.display = "none";
  };
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

  const auth = getAuth();
  const db = getDatabase();

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
  
  function loadDeviceList(uid) {
    if (globalEditingAlarm) return;
    
    const devicesRef = ref(db, "users/" + uid + "/devices");
    onValue(devicesRef, snapshot => {
      if (globalEditingAlarm) return;
      deviceListDiv.innerHTML = "";
      if (snapshot.exists()) {
        const devices = snapshot.val();
        Object.entries(devices).forEach(([deviceId, deviceData]) => {
          const deviceCard = document.createElement("div");
          deviceCard.className = "device-card";
          deviceCard.id = "device-" + deviceId;
  
          const statusDot = document.createElement("span");
          statusDot.className = "status-dot online";
          deviceCard.appendChild(statusDot);
  
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
  
          // Alarms container and Add Alarm button
          const alarmsContainer = document.createElement("div");
          alarmsContainer.className = "alarms-container";
          if (deviceData.alarms) {
            for (const key in deviceData.alarms) {
              const alarmEntry = renderAlarmEntry(deviceData.alarms[key], key, uid, deviceId);
              alarmsContainer.appendChild(alarmEntry);
            }
          }
          clockContainer.appendChild(alarmsContainer);
          const addAlarmBtn = document.createElement("button");
          addAlarmBtn.className = "add-alarm-btn";
          addAlarmBtn.textContent = "Add Auto On Clock";
          addAlarmBtn.onclick = () => {
            showAddAlarmForm(alarmsContainer, uid, deviceId);
          };
          clockContainer.appendChild(addAlarmBtn);
          deviceCard.appendChild(clockContainer);
  
          // ----- Reconfigure Button (Factory Reset) -----
          const reconfigureBtn = document.createElement("button");
          reconfigureBtn.className = "reconfigure-btn";
          reconfigureBtn.textContent = "Reconfigure";
          reconfigureBtn.onclick = () => {
            // Instead of directly calling update, show the reset confirmation modal.
            showResetModal(uid, deviceId);
          };
          deviceCard.appendChild(reconfigureBtn);
  
          // ----- Feedback: Switch feedback display -----
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
