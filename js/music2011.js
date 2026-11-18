(() => {
  "use strict";

  // This element lives outside the screens so transitions never restart music.
  const audio = document.querySelector("#background-music");
  const fallbackSource = audio.src;
  let started = false;
  let nearTrackEnd = false;
  audio.loop = true;
  audio.volume = 0.5;

  function removeRetry() {
    document.removeEventListener("pointerup", retryPlayback, true);
    document.removeEventListener("keydown", retryPlayback, true);
  }

  function retryPlayback() {
    removeRetry();
    if (started && audio.paused) play();
  }

  function useFallback(error) {
    if (audio.src !== fallbackSource) {
      console.warn("Không tải được nhạc từ server, dùng bài hát mặc định.", error);
      setSource(fallbackSource);
    } else {
      console.warn("Chưa phát được nhạc nền.", error);
    }
  }

  function play() {
    const source = audio.src;
    const playback = audio.play();
    playback?.catch(error => {
      // Replacing a source can abort its previous play request.
      if (audio.src !== source || error.name === "AbortError") return;
      if (error.name === "NotAllowedError") {
        // Retry on the next gesture if a browser requires another interaction.
        removeRetry();
        document.addEventListener("pointerup", retryPlayback, { capture: true });
        document.addEventListener("keydown", retryPlayback, { capture: true });
      } else {
        useFallback(error);
      }
    });
  }

  function setSource(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError("Nhạc nền cần có URL hợp lệ.");
    }
    const url = new URL(value.trim(), document.baseURI);
    const localPreviewAudio = window.__forYou2011Mode === "preview" &&
      url.protocol === "blob:" && url.origin === location.origin;
    if (!["https:", "http:"].includes(url.protocol) &&
        !localPreviewAudio &&
        !(location.protocol === "file:" && url.protocol === "file:")) {
      throw new TypeError("URL nhạc phải dùng HTTP hoặc HTTPS.");
    }
    if (audio.src === url.href) return;
    nearTrackEnd = false;
    audio.src = url.href;
    if (started) play();
  }

  function start() {
    started = true;
    if (audio.paused) play();
  }

  function musicUrl(payload) {
    return (payload?.data ?? payload)?.musicUrl;
  }

  async function loadSourceFromServer() {
    const endpoint = audio.dataset.musicEndpoint.trim();
    if (!endpoint) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Music request failed: ${response.status}`);
      setSource(musicUrl(await response.json()));
    } catch (error) {
      console.warn("Không tải được cấu hình nhạc, giữ bài hát hiện tại.", error);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  audio.addEventListener("playing", removeRetry);
  audio.addEventListener("timeupdate", () => {
    // Preserve this flag while a loop is rewinding to the beginning.
    if (audio.currentTime > 1 && Number.isFinite(audio.duration)) {
      nearTrackEnd = audio.duration - audio.currentTime < 1;
    }
  });
  audio.addEventListener("pause", () => {
    // Some WebKit versions pause after a native loop has rewound to zero.
    if (started && audio.loop && nearTrackEnd && audio.currentTime < 0.5) {
      nearTrackEnd = false;
      play();
    }
  });
  audio.addEventListener("ended", () => {
    if (!started || !audio.loop) return;
    nearTrackEnd = false;
    audio.currentTime = 0;
    play();
  });
  audio.addEventListener("error", () => useFallback(audio.error));
  window.backgroundMusic2011 = Object.freeze({ start, setSource });

  const suppliedUrl = musicUrl(window.__MUSIC_DATA__);
  if (suppliedUrl) {
    try { setSource(suppliedUrl); }
    catch (error) { console.warn("URL nhạc không hợp lệ, dùng bài hát mặc định.", error); }
  }
  // Preview files are reconstructed in this tab, independent of the creator's URLs.
  Promise.resolve(window.__forYou2011Ready).then((gift) => {
    if (!gift?.music) return;
    try { setSource(gift.music); }
    catch (error) { console.warn("Không nạp được nhạc xem trước.", error); }
  });
  // Start fetching before the logo click; playback itself still waits for it.
  if (window.__forYou2011Mode !== "preview") loadSourceFromServer();
})();
