// dashboard/dashboard.js
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Modal elements
  const addNodeBtn = document.getElementById("addNodeFloatingBtn");
  const instructionsModal = document.getElementById("nodeInstructionsModal");
  const closeInstructions = document.getElementById("closeInstructions");
  const createNewBtn = document.getElementById("createNewBtn");
  const copyUIDBtn = document.getElementById("copyUIDBtn");
  const userUIDSpan = document.getElementById("userUID");

  // Open instructions modal when floating button is clicked
  addNodeBtn.addEventListener("click", () => {
    instructionsModal.style.display = "block";
  });

  // Close modal when the close icon is clicked
  closeInstructions.addEventListener("click", () => {
    instructionsModal.style.display = "none";
  });

  // Close modal if clicking outside of the modal content
  window.addEventListener("click", (event) => {
    if (event.target === instructionsModal) {
      instructionsModal.style.display = "none";
    }
  });

  // "Create New Now" button: open the ESP provisioning page
  createNewBtn.addEventListener("click", () => {
    window.open("http://192.168.4.1", "_blank");
  });

  // Display the current user's UID in the instructions modal
  const auth = getAuth();
  if (auth.currentUser) {
    userUIDSpan.textContent = auth.currentUser.uid;
  } else {
    // In case currentUser is not yet available, listen for auth state change
    auth.onAuthStateChanged((user) => {
      if (user) {
        userUIDSpan.textContent = user.uid;
      }
    });
  }

  // Copy UID button functionality
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
        console.error("Failed to copy UID: ", err);
      });
  });

  console.log("Dashboard JS loaded and ready.");
});
