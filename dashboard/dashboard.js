// dashboard/dashboard.js

document.addEventListener("DOMContentLoaded", () => {
    // Modal elements
    const addNodeBtn = document.getElementById("addNodeFloatingBtn");
    const instructionsModal = document.getElementById("nodeInstructionsModal");
    const closeInstructions = document.getElementById("closeInstructions");
    const createNewBtn = document.getElementById("createNewBtn");
  
    // Open the instructions modal when the floating button is clicked
    addNodeBtn.addEventListener("click", () => {
      instructionsModal.style.display = "block";
    });
  
    // Close the modal when the close icon is clicked
    closeInstructions.addEventListener("click", () => {
      instructionsModal.style.display = "none";
    });
  
    // Close the modal when clicking outside of the modal content
    window.addEventListener("click", (event) => {
      if (event.target === instructionsModal) {
        instructionsModal.style.display = "none";
      }
    });
  
    // "Create New Now" button: redirect to the ESP provisioning page
    createNewBtn.addEventListener("click", () => {
      window.open("http://192.168.4.1", "_blank");
    });
  
    // Here you can also add additional logic to render device cards dynamically
    // similar to your previous implementation (e.g., with Firebase listeners).
    console.log("Dashboard JS loaded and ready.");
  });
  