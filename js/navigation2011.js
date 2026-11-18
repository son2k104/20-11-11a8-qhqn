(() => {
  "use strict";

  const zoomOptions = { capture: true, passive: false };
  const preventZoom = event => {
    if (event.cancelable) event.preventDefault();
  };

  // Ctrl + wheel and trackpad pinching arrive as wheel events with ctrlKey.
  document.addEventListener("wheel", event => {
    if (event.ctrlKey) preventZoom(event);
  }, zoomOptions);

  // Safari gesture events and multi-touch fallbacks leave single-finger input free.
  for (const type of ["gesturestart", "gesturechange"]) {
    document.addEventListener(type, preventZoom, zoomOptions);
  }
  for (const type of ["touchstart", "touchmove"]) {
    document.addEventListener(type, event => {
      if (event.touches.length > 1) preventZoom(event);
    }, zoomOptions);
  }

  const intro = document.querySelector(".intro");
  const startScreen = document.querySelector("#start-screen");
  const startButton = document.querySelector("#start-button");
  const nextButton = document.querySelector("#intro-next");
  const filmScreen = document.querySelector("#experience");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const rotationNotice = document.querySelector(".rotation-notice");
  const portraitDevice = matchMedia("(orientation: portrait) and (max-width: 1100px) and (any-pointer: coarse)");

  // Show from the start screen onward, above every screen and the photo viewer.
  function syncRotationNotice() {
    if (portraitDevice.matches) {
      if (!rotationNotice.open) rotationNotice.showModal();
    } else if (rotationNotice.open) {
      rotationNotice.close();
    }
  }

  rotationNotice.addEventListener("cancel", event => event.preventDefault());
  portraitDevice.addEventListener("change", syncRotationNotice);
  syncRotationNotice();

  startButton.addEventListener("click", () => {
    // Keep audio.play() inside the user's gesture, before any asynchronous work.
    window.backgroundMusic2011.start();
    startButton.disabled = true;
    intro.removeAttribute("data-intro-pending");
    intro.setAttribute("aria-hidden", "false");
    intro.inert = false;
    intro.focus({ preventScroll: true });
    window.startIntro2011();
    startScreen.inert = true;
    startScreen.setAttribute("aria-hidden", "true");
    startScreen.classList.add("is-leaving");
    if (motion.matches) startScreen.hidden = true;
    else window.setTimeout(() => { startScreen.hidden = true; }, 450);
    syncRotationNotice();
  }, { once: true });

  nextButton.addEventListener("click", () => {
    if (nextButton.disabled) return;

    nextButton.disabled = true;
    document.querySelector(".photo-viewer").close();
    intro.inert = true;
    window.showLetterBirthday();
    intro.setAttribute("aria-hidden", "true");

    // Keep the board behind the letter until its entrance fade finishes.
    if (motion.matches) intro.hidden = true;
    else window.setTimeout(() => { intro.hidden = true; }, 650);
  });

  // Start the photo sequence only after the reader continues from the letter.
  window.showImageBirthday = () => {
    filmScreen.hidden = false;
    filmScreen.inert = false;
    filmScreen.focus({ preventScroll: true });
    window.startFilm2011();
  };
})();
