// ==========================================================================
// SMART CAMPUS - LANDING PAGE INTERACTION (script.js)
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Smart Campus Platform Landing Page Loaded");

  // Smooth scroll for anchor links
  const links = document.querySelectorAll("a[href^='#']");
  links.forEach((link) => {
    link.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId && targetId !== "#") {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: "smooth",
          });
        }
      }
    });
  });
});
