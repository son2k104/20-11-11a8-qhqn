(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const isPreview = params.get("preview") === "1";
  // Không có máy chủ (apiBase rỗng) thì bỏ qua ?id= và chạy bằng dữ liệu mặc định cục bộ.
  const hasBackend = Boolean(window.APP_CONFIG?.apiBase);
  const giftId = hasBackend ? params.get("id") : null;
  if (params.get("id") && !hasBackend)
    console.info("Chưa cấu hình apiBase: dùng dữ liệu mặc định, bỏ qua ?id=.");
  window.__forYou2011Mode = isPreview ? "preview" : giftId ? "gift" : "demo";
  if (!isPreview && !giftId) {
    window.__forYou2011Ready = Promise.resolve(null);
    return;
  }

  const start = document.getElementById("start-button");
  const label = document.getElementById("start-label");
  const originalLabel = label.textContent;
  start.disabled = true;
  label.textContent = "Đang chuẩn bị món quà…";
  if (isPreview) document.documentElement.classList.add("is-gift-preview");
  const urls = [];

  function returnToForm() {
    try {
      if (
        window.opener &&
        !window.opener.closed &&
        window.opener.location.origin === location.origin
      ) {
        window.opener.focus();
        window.close();
        return;
      }
    } catch {
      /* The creator may have navigated elsewhere. */
    }
    location.href = "create.html";
  }

  function source(photo) {
    if (!(photo?.file instanceof Blob))
      throw new Error("Bản xem trước bị thiếu tệp ảnh hoặc nhạc.");
    const url = URL.createObjectURL(photo.file);
    urls.push(url);
    return url;
  }

  window.__forYou2011Ready = (async () => {
    if (!isPreview) {
      const api = window.ForYou2011Api.createClient({
        getUser: () => null,
        getIdToken: async () => null,
      });
      let record;
      try {
        record = await api.fetchGift(giftId);
      } catch (error) {
        if (error.status === 403)
          throw new Error(
            "Món quà chưa được thanh toán. Người tạo cần hoàn tất thanh toán để mở quà.",
          );
        if (error.status === 410)
          throw new Error("Món quà đã hết thời hạn lưu trữ.");
        if (error.status === 404)
          throw new Error(
            "Không tìm thấy món quà này. Hãy kiểm tra lại đường dẫn.",
          );
        throw error;
      }
      const settings = record.settings;
      if (
        !settings.letter?.content?.trim() ||
        !Array.isArray(settings.memories) ||
        settings.memories.length > 3 ||
        typeof settings.film?.enabled !== "boolean" ||
        !Array.isArray(settings.film.photos) ||
        (settings.film.enabled &&
          (!settings.film.photos.length || settings.film.photos.length > 20))
      )
        throw new Error(
          "Nội dung món quà chưa đầy đủ. Vui lòng liên hệ người tạo.",
        );
      const gift = {
        music: window.ForYou2011Api.httpUrl(settings.music),
        letter: {
          title: settings.letter.title || "",
          content: settings.letter.content,
          signature: settings.letter.signature || "",
        },
        memories: settings.memories.map((photo) => ({
          src: window.ForYou2011Api.httpUrl(photo.src),
          caption: String(photo.caption || ""),
          alt: "Ảnh kỷ niệm",
        })),
        film: {
          enabled: settings.film.enabled,
          photos: settings.film.enabled
            ? settings.film.photos.map((src) =>
                window.ForYou2011Api.httpUrl(src),
              )
            : [],
        },
      };
      return applyGift(gift);
    }
    const id = params.get("draft");
    if (!id)
      throw new Error(
        "Bản xem trước chưa có dữ liệu. Hãy mở lại từ trang tạo quà.",
      );
    const payload = await window.ForYou2011PreviewStore.load(id);
    if (
      !payload?.letter?.content?.trim() ||
      !Array.isArray(payload.memories) ||
      payload.memories.length > 3
    ) {
      throw new Error(
        "Bản xem trước không còn dữ liệu. Hãy quay lại trang tạo để xem trước lần nữa.",
      );
    }
    const filmEnabled = payload.film?.enabled === true;
    if (
      filmEnabled &&
      (!Array.isArray(payload.film.photos) ||
        !payload.film.photos.length ||
        payload.film.photos.length > 20)
    ) {
      throw new Error(
        "Bản xem trước bị thiếu ảnh thước phim. Hãy quay lại trang tạo để chọn ảnh.",
      );
    }
    const gift = {
      music:
        payload.music?.type === "custom"
          ? source(payload.music)
          : payload.music?.path || "",
      letter: {
        title: payload.letter.title || "",
        content: payload.letter.content,
        signature: payload.letter.signature || "",
      },
      memories: payload.memories.map((photo) => ({
        src: source(photo),
        caption: String(photo.caption || ""),
        alt: "Ảnh kỷ niệm",
      })),
      film: {
        enabled: filmEnabled,
        photos: filmEnabled ? payload.film.photos.map(source) : [],
      },
    };
    return applyGift(gift);
  })().catch((error) => {
    console.error("Không tải được món quà:", error);
    label.textContent = isPreview
      ? "Bản xem trước chưa sẵn sàng"
      : "Chưa thể mở món quà";
    const message = document.createElement("div");
    message.className = "gift-preview-error";
    message.setAttribute("role", "alert");
    const text = document.createElement("p");
    text.textContent =
      error.message || "Không tải được món quà. Vui lòng thử lại.";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Quay lại trang tạo";
    back.addEventListener("click", returnToForm);
    message.append(text, back);
    document.body.append(message);
    return null;
  });

  function applyGift(gift) {
    window.__FOR_YOU_2011__ = gift;
    window.__LETTER_DATA__ = gift.letter;
    window.__LETTER_MEMORIES__ = gift.memories;
    window.introMemories?.setPhotos(gift.memories);
    document.documentElement.classList.toggle("is-no-film", !gift.film.enabled);
    label.textContent = originalLabel;
    start.disabled = false;
    return gift;
  }
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) urls.forEach((url) => URL.revokeObjectURL(url));
  });
})();
