// js/core/streaming.js

/**
 * HTML-Aware Streaming Typewriter
 * Streams text character by character, but injects HTML tags instantly so styling doesn't break.
 */
export function streamText(htmlString, element, speed = 15) {
  return new Promise((resolve) => {
    element.innerHTML = ""; // Clear element
    
    // Split the string into an array of HTML tags and raw text
    // e.g. "Hi <b>bro</b>" -> ["Hi ", "<b>", "bro", "</b>"]
    const parts = htmlString.split(/(<[^>]*>)/g).filter(part => part.length > 0);
    
    let partIndex = 0;
    let charIndex = 0;

    function type() {
      if (partIndex >= parts.length) {
        resolve();
        return;
      }

      const currentPart = parts[partIndex];

      // If it's an HTML tag, inject it instantly and move to the next part
      if (currentPart.startsWith("<") && currentPart.endsWith(">")) {
        element.innerHTML += currentPart;
        partIndex++;
        type(); // Call immediately
      } else {
        // If it's regular text, stream it character by character
        if (charIndex < currentPart.length) {
          element.innerHTML += currentPart[charIndex];
          charIndex++;
          setTimeout(type, speed);
        } else {
          // Finished this text block, move to next part
          partIndex++;
          charIndex = 0;
          type();
        }
      }
    }

    type(); // Start the engine
  });
}