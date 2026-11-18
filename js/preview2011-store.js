(function () {
  "use strict";
  const DB_NAME = "forYou2011";
  const STORE = "previews";
  const DAY = 24 * 60 * 60 * 1000;

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB)
        return reject(new Error("Trình duyệt chưa hỗ trợ lưu bản xem trước."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Hãy đóng bản xem trước cũ rồi thử lại."));
    });
  }

  async function save(payload) {
    // Store bytes rather than File objects: WebKit can reject File/Blob values
    // in IndexedDB. Create fresh object URLs only in the receiving tab.
    const packPhoto = async (photo) => ({
      bytes: await photo.file.arrayBuffer(),
      type: photo.file.type,
      caption: photo.caption || "",
    });
    const packed = {
      ...payload,
      music:
        payload.music?.type === "custom"
          ? {
              type: "custom",
              name: payload.music.name,
              bytes: await payload.music.file.arrayBuffer(),
              mime: payload.music.file.type || "audio/mpeg",
            }
          : payload.music || null,
      memories: await Promise.all(payload.memories.map(packPhoto)),
      film: {
        ...payload.film,
        photos: await Promise.all(payload.film.photos.map(packPhoto)),
      },
    };
    const db = await openDb();
    const id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const put = store.put({
          id,
          createdAt: Date.now(),
          version: 1,
          payload: packed,
        });
        put.onerror = () =>
          reject(put.error || new Error("Không lưu được ảnh xem trước."));
        // Separate keys keep already-open previews independent of later edits.
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (!item) return;
          if (item.value.createdAt < Date.now() - DAY) item.delete();
          item.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () =>
          reject(tx.error || new Error("Không lưu được bản xem trước."));
        tx.onabort = () =>
          reject(tx.error || new Error("Không lưu được bản xem trước."));
      });
      return id;
    } finally {
      db.close();
    }
  }

  async function load(id) {
    const db = await openDb();
    try {
      const payload = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const request = tx.objectStore(STORE).get(id);
        request.onsuccess = () =>
          resolve(
            request.result?.version === 1 ? request.result.payload : null,
          );
        request.onerror = () => reject(request.error);
      });
      if (!payload) return null;
      const unpackPhoto = (photo) => ({
        file:
          photo.file instanceof Blob
            ? photo.file
            : new Blob([photo.bytes], { type: photo.type }),
        caption: photo.caption || "",
      });
      return {
        ...payload,
        music:
          payload.music?.type === "custom"
            ? {
                type: "custom",
                name: payload.music.name,
                file: new Blob([payload.music.bytes], {
                  type: payload.music.mime || "audio/mpeg",
                }),
              }
            : payload.music || null,
        memories: payload.memories.map(unpackPhoto),
        film: { ...payload.film, photos: payload.film.photos.map(unpackPhoto) },
      };
    } finally {
      db.close();
    }
  }
  window.ForYou2011PreviewStore = Object.freeze({ save, load });
})();
