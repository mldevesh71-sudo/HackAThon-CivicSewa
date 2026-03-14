// js/core/fileHandler.js

/**
 * Handles file uploads with size validation and Base64 conversion.
 * @param {HTMLElement} inputElement - The <input type="file"> element
 * @param {Function} callback - Function to run on success: callback({name, type, dataUrl})
 * @param {Function} errorCallback - Function to run on error
 */
export function setupFileUpload(inputElement, callback, errorCallback) {
  inputElement.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Level 280: File Size Validation (Max 5MB to prevent crashing localStorage/Firebase)
    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      if (errorCallback) errorCallback(`File is too large. Maximum size is ${maxSizeMB}MB.`);
      inputElement.value = ""; // Clear the input
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      callback({
        name: file.name,
        type: file.type, // e.g., 'image/jpeg' or 'application/pdf'
        dataUrl: reader.result, // Base64 format for safe storage/display
      });
    };

    reader.onerror = () => {
      if (errorCallback) errorCallback("Failed to read the file.");
    };

    // CRITICAL FIX: Read as DataURL, NOT Text, so images and PDFs work.
    reader.readAsDataURL(file);
  });
}