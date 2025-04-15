// dashboard/dashboard.js
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  // Modal elements
  const addNodeBtn = document.getElementById("addNodeFloatingBtn");
  const instructionsModal = document.getElementById("nodeInstructionsModal");
  const closeInstructions = document.getElementById("closeInstructions");
  const createNewBtn = document.getElementById("createNewBtn");
  const copyUIDBtn = document.getElementById("copyUIDBtn");
  const userUIDSpan = document.getElementById("userUID");
  const displayNameSpan = document.getElementById("displayName");

  const auth = getAuth();
  const db = getDatabase();
  
  // Listen for auth state changes to update UID and username
  auth.onAuthStateChanged(user => {
    if (user) {
      // Update UID display immediately
      userUIDSpan.textContent = user.uid;
      
      // Retrieve username from "users/<uid>/profile/username"
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
    }
  });
  
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
  
  // "Create New Now" button: Open provisioning page in a new tab
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
