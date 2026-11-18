(() => {
"use strict";
const elements = {
  screen: document.querySelector("#letter-birthday"),
  wrapper: document.querySelector("#letter-birthday .cssletter"),
  envelope: document.querySelector("#letter-birthday .envelope"),
  openButton: document.querySelector("#openEnvelope"),
  title: document.querySelector("#letterTitle"),
  content: document.querySelector("#letterContent"),
  signature: document.querySelector("#letterSignature"),
  continueButton: document.querySelector("#continueLetter"),
};

const endpoint =
  elements.screen?.dataset.letterEndpoint?.trim() ||
  document.body.dataset.letterEndpoint?.trim() ||
  "";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Tốc độ chạy chữ: mỗi lần hiện 1 ký tự sau "speed" ms (chunkSize luôn = 1 nếu maxDuration đủ lớn).
// Thư dài ~1.200 ký tự => nội dung chạy khoảng 55-60 giây, đủ chậm để đọc theo.
const TYPE_SPEED = {
  title: 70,
  content: 45,
  signature: 80,
  pauseBetween: 600,
};
// Trần thời gian để thư rất dài từ máy chủ không chạy quá lâu.
const TYPE_DURATION = { title: 8000, content: 90000, signature: 4000 };

let openBound = false;

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

const updateLetterMemories = (memories) => window.updateLetterMemories(memories);

const readFallbackLetter = () => ({
  title: trimText(elements.title?.textContent),
  content: trimText(elements.content?.textContent),
  signature: trimText(elements.signature?.textContent),
});

// Capture the HTML before clearing it for the typewriter animation.
const fallbackLetter = readFallbackLetter();
const paper = elements.envelope?.querySelector(".reveal-letter");
const status = document.querySelector("#letterStatus");
let followTyping = true;
const stopFollowing = () => { followTyping = false; };
paper?.addEventListener("wheel", stopFollowing, { passive: true });
paper?.addEventListener("touchstart", stopFollowing, { passive: true });
paper?.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
    stopFollowing();
  }
});
const scrollToBottom = () => {
  if (paper && followTyping) paper.scrollTop = paper.scrollHeight;
};

const normalizeText = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(typeof item === "string" ? item : ""))
      .filter(Boolean)
      .join("\n\n");
  }

  return trimText(value).replace(/\r\n?/g, "\n");
};

const normalizeLetterPayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const data = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const source = data.letter && typeof data.letter === "object" ? data.letter : data;
  const content = normalizeText(
    source.content ?? source.body ?? source.message ?? source.text
  );

  if (!content) return null;
  updateLetterMemories(source.memories ?? data.memories);

  return {
    title: normalizeText(source.title ?? source.heading ?? source.subject),
    content,
    signature: normalizeText(
      source.signature ?? source.author ?? source.from ?? source.sender
    ),
  };
};

const clearLetter = () => {
  if (elements.title) {
    elements.title.textContent = "";
    elements.title.hidden = true;
  }
  if (elements.content) {
    elements.content.textContent = "";
  }
  if (elements.signature) {
    elements.signature.textContent = "";
    elements.signature.hidden = true;
  }
  if (elements.continueButton) {
    elements.continueButton.classList.remove("is-visible");
    elements.continueButton.disabled = true;
    elements.continueButton.setAttribute("aria-hidden", "true");
  }
};

const showContinueButton = () => {
  if (!elements.continueButton) return;
  if (window.__FOR_YOU_2011__?.film.enabled === false) {
    elements.continueButton.hidden = true;
    paper?.setAttribute("aria-busy", "false");
    if (status) status.textContent = "Lá thư tri ân đã được gửi trọn vẹn.";
    return;
  }

  elements.continueButton.disabled = false;
  elements.continueButton.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    elements.continueButton.classList.add("is-visible");
    scrollToBottom();
    paper?.setAttribute("aria-busy", "false");
    if (status) status.textContent = "Thư đã hiển thị đầy đủ. Bạn có thể tiếp tục.";
  });
};

const setTypingTarget = (el, isTyping) => {
  if (!el) return;
  el.classList.toggle("is-typing", isTyping);
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const typeText = async (el, text, speed, maxDuration) => {
  if (!el || !text) return;

  el.hidden = false;
  el.textContent = "";
  setTypingTarget(el, true);

  const characters = typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(text), item => item.segment)
    : Array.from(text);
  const chunkSize = Math.max(1, Math.ceil(characters.length * speed / maxDuration));
  const textNode = document.createTextNode("");
  el.append(textNode);
  for (let index = 0; index < characters.length; index += chunkSize) {
    textNode.appendData(characters.slice(index, index + chunkSize).join(""));

    scrollToBottom();

    await wait(speed);
  }

  setTypingTarget(el, false);
};

const writeLetter = async (letter) => {
  followTyping = !prefersReducedMotion;
  if (paper) paper.scrollTop = 0;
  if (prefersReducedMotion) {
    if (elements.title) {
      elements.title.textContent = letter.title;
      elements.title.hidden = !letter.title;
    }
    if (elements.content) {
      elements.content.textContent = letter.content;
    }
    if (elements.signature) {
      elements.signature.textContent = letter.signature;
      elements.signature.hidden = !letter.signature;
    }
    showContinueButton();
    return;
  }

  clearLetter();

  if (letter.title) {
    await typeText(elements.title, letter.title, TYPE_SPEED.title, TYPE_DURATION.title);
    await wait(TYPE_SPEED.pauseBetween);
  }

  if (letter.content) {
    await typeText(elements.content, letter.content, TYPE_SPEED.content, TYPE_DURATION.content);
    await wait(TYPE_SPEED.pauseBetween);
  }

  if (letter.signature) {
    await typeText(elements.signature, letter.signature, TYPE_SPEED.signature, TYPE_DURATION.signature);
  }

  await wait(TYPE_SPEED.pauseBetween);
  showContinueButton();
};

const fetchLetterFromServer = async () => {
  if (!endpoint) return fallbackLetter;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const letter = normalizeLetterPayload(payload);
    if (!letter) throw new Error("Letter response must contain non-empty content");
    return letter;
  } catch (error) {
    console.error("Failed to load letter content:", error);
    return fallbackLetter;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const letterPromise = (async () => {
  // The creation page supplies the selected photos and letter through IndexedDB.
  const gift = await window.__forYou2011Ready;
  if (gift) {
    updateLetterMemories(gift.memories);
    return normalizeLetterPayload(gift.letter);
  }
  // A host application that already fetches data can inject it before this script.
  const suppliedLetter = normalizeLetterPayload(window.__LETTER_DATA__);
  if (suppliedLetter) return suppliedLetter;
  let preview = window.__BIRTHDAY_PREVIEW__;
  let previewTimeout;
  try {
    if (window.__birthdayPreviewReady) {
      preview = (await Promise.race([
        window.__birthdayPreviewReady,
        new Promise((_, reject) => {
          previewTimeout = window.setTimeout(() => reject(new Error("Preview timed out")), 8000);
        }),
      ])) || preview;
    }
  } catch (error) {
    console.warn("Không tải được bản xem trước, sử dụng nguồn thư dự phòng.", error);
  } finally {
    window.clearTimeout(previewTimeout);
  }

  updateLetterMemories(preview?.memories ?? preview?.letter?.memories);
  const previewLetter = normalizeLetterPayload(preview?.letter);
  if (previewLetter) return previewLetter;

  return fetchLetterFromServer();
})();

clearLetter();

function bindOpenEnvelope() {
  if (openBound || !elements.wrapper || !elements.envelope || !elements.openButton) {
    return;
  }

  openBound = true;

  elements.openButton.addEventListener(
    "click",
    async () => {
      elements.openButton.disabled = true;
      paper?.setAttribute("aria-busy", "true");
      if (status) status.textContent = "Đang mở thư…";
      const letter = await letterPromise;
      elements.envelope.classList.add("active");

      if (prefersReducedMotion) {
        elements.envelope.classList.add("extracting", "lowered");
        paper?.focus({ preventScroll: true });
        await writeLetter(letter);
        return;
      }

      window.setTimeout(() => {
        elements.envelope.classList.add("extracting");
      }, 720);

      window.setTimeout(() => {
        elements.envelope.classList.add("lowered");
        paper?.focus({ preventScroll: true });
        writeLetter(letter);
      }, 1820);
    },
    { once: true }
  );
}

function showLetterBirthday() {
  if (!elements.screen) {
    return;
  }

  bindOpenEnvelope();
  bindContinueButton();

  elements.screen.classList.add("is-active");
  elements.screen.setAttribute("aria-hidden", "false");
  elements.screen.inert = false;
  if (!elements.openButton.disabled) elements.openButton.focus({ preventScroll: true });
}

function goToImageBirthday() {
  if (elements.continueButton) {
    elements.continueButton.disabled = true;
    elements.continueButton.style.pointerEvents = "none";
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Hiện gallery trước rồi mới ẩn letter → tránh lộ màn phía dưới
  if (typeof window.showImageBirthday === "function") {
    window.showImageBirthday();
  }

  if (elements.screen) elements.screen.inert = true;

  const hideLetterScreen = () => {
    if (elements.screen) {
      elements.screen.classList.remove("is-active");
      elements.screen.setAttribute("aria-hidden", "true");
    }
  };

  if (reduceMotion) {
    hideLetterScreen();
    return;
  }

  window.setTimeout(hideLetterScreen, 650);
}

let continueBound = false;

function bindContinueButton() {
  if (continueBound || !elements.continueButton) return;

  continueBound = true;
  elements.continueButton.addEventListener("click", goToImageBirthday);
}

window.showLetterBirthday = showLetterBirthday;

if (elements.screen?.classList.contains("is-active") || !elements.screen) {
  bindOpenEnvelope();
  bindContinueButton();
}

})();
