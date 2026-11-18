/**
 * Cấu hình app (public).
 * Chế độ cục bộ: apiBase rỗng => không gọi máy chủ nào, trang dùng dữ liệu mặc định
 * (lời chúc trong index.html, nhạc assets/musics/cotuyetvoinhat.mp3, ảnh mẫu trong assets/images/).
 * Muốn nối lại backend thì điền apiBase, ví dụ "https://ten-may-chu.example.com".
 */
(function () {
  window.APP_CONFIG = {
    apiBase: "",
  };

  /** Cho phép override trước khi load script (test/staging). */
  if (window.__APP_CONFIG__ && typeof window.__APP_CONFIG__ === "object") {
    window.APP_CONFIG = { ...window.APP_CONFIG, ...window.__APP_CONFIG__ };
  }
})();
