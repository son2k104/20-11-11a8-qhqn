(() => {
  "use strict";

  const container = document.querySelector(".class-memories");
  const containers = [...document.querySelectorAll("[data-memories]")];
  const template = document.querySelector("#polaroid-template");
  const noteTemplate = document.querySelector("#memory-note-template");
  const positions = ["polaroid--one", "polaroid--two", "polaroid--three"];
  const noteMessages = ["Tri ân", "Nhớ ơn", "20/11"];
  let revision = 0;

  // One photo list and template for both the intro and the letter screen.
  // Replace these demo records with server data through setPhotos(photos).
  // API response for loadPhotos(url): { "photos": [{ "src": "...",
  //   "fullSrc": "...", "alt": "...", "caption": "..." }] }
  // src and caption are required. fullSrc and alt are optional.
  // Array order maps to top left, bottom left, then right (maximum 3 photos).
  // Missing photos become notes in order: Tri ân, Nhớ ơn, 20/11. [] means no photos.
  const demoPhotos = [
    {
      src: "assets/images/intro-1.jpg",
      alt: "Cả lớp chụp ảnh chung trong phòng học",
      caption: "Một khởi đầu mới là khi ...♡"
    },
    {
      src: "assets/images/intro-2.jpg",
      alt: "Các bạn mặc áo dài trắng chụp ảnh chung trước sân khấu",
      caption: "Chúng ta cùng nhau cố gắng, yêu thương và thấu hiểu lẫn nhau ♡"
    },
    {
      src: "assets/images/intro-3.jpg",
      alt: "Cả lớp mặc áo xanh chụp ảnh chung ngoài sân trường",
      caption: "Cùng nhau tạo nên những kỷ niệm tươi đẹp với nhau ♡"
    }
  ];

  function imageUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError("Ảnh cần có URL hợp lệ.");
    }
    const url = new URL(value, document.baseURI);
    // file: is allowed only for local preview without a development server.
    const localPreviewBlob = window.__forYou2011Mode === "preview" &&
      url.protocol === "blob:" && url.origin === location.origin;
    if (!localPreviewBlob && !["http:", "https:"].includes(url.protocol) &&
        !(location.protocol === "file:" && url.protocol === "file:")) {
      throw new TypeError("URL ảnh phải dùng HTTP hoặc HTTPS.");
    }
    return url.href;
  }

  function setPhotos(photos) {
    if (!Array.isArray(photos) || photos.length > positions.length) {
      throw new TypeError("photos phải là một mảng có tối đa 3 ảnh.");
    }
    // Validate the entire response before replacing the current photos.
    const records = photos.map(photo => {
      if (!photo || typeof photo.caption !== "string" ||
          (photo.alt !== undefined && typeof photo.alt !== "string")) {
        throw new TypeError("Mỗi ảnh cần caption dạng chuỗi và alt hợp lệ.");
      }
      return {
        src: imageUrl(photo.src),
        fullSrc: imageUrl(photo.fullSrc ?? photo.src),
        caption: photo.caption,
        alt: photo.alt || photo.caption || "Ảnh kỷ niệm của lớp"
      };
    });

    function createCard(photo, index) {
      const card = template.content.firstElementChild.cloneNode(true);
      const image = card.querySelector("img");
      card.classList.add(positions[index]);
      card.dataset.photo = photo.fullSrc;
      card.setAttribute("aria-label", `Xem lớn: ${photo.alt}`);
      image.alt = photo.alt;
      const updateOrientation = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        const landscape = image.naturalWidth > image.naturalHeight;
        const square = image.naturalWidth === image.naturalHeight;
        card.classList.toggle("polaroid--landscape", landscape);
        card.classList.toggle("polaroid--square", square);
        card.dataset.orientation = landscape ? "landscape" : square ? "square" : "portrait";
        image.width = image.naturalWidth;
        image.height = image.naturalHeight;
      };
      image.addEventListener("load", updateOrientation, { once: true });
      image.addEventListener("error", () => {
        image.alt = "Không tải được ảnh";
        // The full-size image may still be available when the thumbnail fails.
      }, { once: true });
      image.src = photo.src;
      if (image.complete) updateOrientation();
      // Server captions are plain text; never interpret them as HTML.
      card.querySelector(".polaroid__caption").textContent = photo.caption;
      return card;
    }

    function createNote(index) {
      const note = noteTemplate.content.firstElementChild.cloneNode(true);
      note.classList.add(positions[index]);
      note.querySelector(".polaroid__note-text").textContent = noteMessages[index - records.length];
      return note;
    }

    revision++;
    const viewer = document.querySelector(".photo-viewer");
    if (viewer.open) viewer.close();
    containers.forEach(target => {
      target.replaceChildren(...positions.map((_, index) =>
        index < records.length ? createCard(records[index], index) : createNote(index)
      ));
      target.removeAttribute("aria-busy");
    });
  }

  // Older letter payloads update the shared photos instead of a separate gallery.
  function updateLetterMemories(memories) {
    if (!Array.isArray(memories)) return;
    // Keep the supplied count: do not fill an empty selection with demo photos.
    const photos = memories.map(memory => ({
      src: memory?.src ?? memory?.image ?? memory?.imageUrl ?? memory?.url,
      fullSrc: memory?.fullSrc,
      caption: typeof memory?.caption === "string" ? memory.caption : "",
      alt: typeof memory?.alt === "string" ? memory.alt : ""
    }));
    setPhotos(photos);
  }

  async function loadPhotos(url) {
    const requestRevision = ++revision;
    containers.forEach(target => target.setAttribute("aria-busy", "true"));
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Không tải được ảnh (HTTP ${response.status}).`);
      const data = await response.json();
      // Ignore stale responses if a newer request or setPhotos() has run.
      if (requestRevision === revision) setPhotos(data.photos);
    } finally {
      if (requestRevision === revision) {
        containers.forEach(target => target.removeAttribute("aria-busy"));
      }
    }
  }

  window.introMemories = Object.freeze({ setPhotos, loadPhotos });
  window.updateLetterMemories = updateLetterMemories;
  if (Array.isArray(window.__LETTER_MEMORIES__)) {
    updateLetterMemories(window.__LETTER_MEMORIES__);
  } else {
    setPhotos(demoPhotos);
  }
  if (container.dataset.photosUrl.trim()) {
    loadPhotos(container.dataset.photosUrl).catch(error => {
      // Keep the current photos if the API is unavailable or returns bad data.
      console.error("Không thể cập nhật ảnh kỷ niệm:", error);
    });
  }
})();

// Delegate clicks so photos updated from the server also open in the viewer.
(() => {
  const viewer = document.querySelector(".photo-viewer");
  const image = viewer.querySelector(".photo-viewer__image");
  const caption = viewer.querySelector(".photo-viewer__caption");
  const print = viewer.querySelector(".photo-viewer__print");
  let photoRatio = 2 / 3;

  // Fit the complete paper print, including its caption and padding, rather
  // than sizing the image alone. Re-measure wrapped captions at the new width.
  function fitPhoto() {
    if (!viewer.open) return;
    const style = getComputedStyle(viewer);
    const paper = getComputedStyle(print);
    const horizontalPaper = parseFloat(paper.paddingLeft) + parseFloat(paper.paddingRight);
    const verticalPaper = parseFloat(paper.paddingTop) + parseFloat(paper.paddingBottom);
    const availableWidth = viewer.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availableHeight = viewer.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    let width = Math.min(900, availableWidth);
    print.style.width = `${width}px`;
    for (let pass = 0; pass < 5; pass++) {
      const captionHeight = caption.getBoundingClientRect().height;
      width = Math.min(width, Math.max(1, availableHeight - verticalPaper - captionHeight - 2) * photoRatio + horizontalPaper);
      print.style.width = `${Math.floor(width)}px`;
    }
  }

  document.querySelectorAll("[data-memories]").forEach(container => {
    container.addEventListener("click", event => {
      const photo = event.target.closest("button.polaroid[data-photo]");
      if (!photo || photo.disabled) return;
      const thumbnail = photo.querySelector("img");
      photoRatio = (thumbnail.naturalWidth || thumbnail.width) / (thumbnail.naturalHeight || thumbnail.height);
      image.src = photo.dataset.photo;
      image.alt = thumbnail.alt;
      caption.textContent = photo.querySelector(".polaroid__caption").textContent;
      viewer.showModal();
      viewer.scrollTop = 0;
      fitPhoto();
    });
  });
  image.addEventListener("load", () => {
    photoRatio = image.naturalWidth / image.naturalHeight;
    fitPhoto();
  });
  window.addEventListener("resize", fitPhoto);
  window.visualViewport?.addEventListener("resize", fitPhoto);
  new ResizeObserver(fitPhoto).observe(viewer);
  viewer.querySelector(".photo-viewer__close").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", event => { if (event.target === viewer) viewer.close(); });
})();
