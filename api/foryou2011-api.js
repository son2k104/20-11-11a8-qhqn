/* Contract: docs/FORYOU2011_FE_INTEGRATION.md. Payment status comes from the server. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ForYou2011Api = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  const TYPE = "foryou2011";
  const ORDER_CODE_MIN = 100_000_000_000;
  const ORDER_CODE_RANGE = 900_000_000_000;
  const issuedOrderCodes = new Set();
  function generateOrderCode() {
    let random;
    if (root.crypto?.getRandomValues) {
      const words = root.crypto.getRandomValues(new Uint32Array(2));
      // Use 53 random bits so arithmetic stays within JavaScript's safe integers.
      random = (words[0] & 0x1fffff) * 0x100000000 + words[1];
    } else {
      random = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }
    let code = ORDER_CODE_MIN + (random % ORDER_CODE_RANGE);
    // Keep retries/new checkouts distinct within this page, including at the
    // upper boundary. The backend remains responsible for global uniqueness.
    while (issuedOrderCodes.has(code)) {
      code = ORDER_CODE_MIN + ((code - ORDER_CODE_MIN + 1) % ORDER_CODE_RANGE);
    }
    issuedOrderCodes.add(code);
    return String(code);
  }
  function orderCode(value) {
    const code = String(value || "");
    if (!/^[1-9]\d*$/.test(code) || !Number.isSafeInteger(Number(code)))
      throw new Error("Mã đơn thanh toán không hợp lệ.");
    return code;
  }
  function httpUrl(value, base = root.location?.href) {
    if (!value) throw new Error("Máy chủ chưa trả về đường dẫn.");
    const url = new URL(value, base);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Đường dẫn máy chủ trả về không hợp lệ.");
    return url.href;
  }
  function buildRecordFormData(payload) {
    const custom = payload.music.type === "custom";
    const photos = payload.film.enabled ? payload.film.photos : [];
    const data = {
      schemaVersion: 1,
      productType: TYPE,
      music: custom
        ? { type: "custom", name: payload.music.name }
        : {
            type: "sample",
            name: payload.music.name,
            path: payload.music.path,
          },
      memories: payload.memories.map(({ caption }) => ({
        caption: caption ?? "",
      })),
      letter: payload.letter,
      film: { enabled: payload.film.enabled, photos: photos.map(() => ({})) },
      checkout: {
        paymentMethod: payload.checkout.paymentMethod,
        keepForever: payload.checkout.keepForever,
      },
    };
    const form = new FormData();
    form.append("data", JSON.stringify(data));
    for (const photo of payload.memories)
      form.append("memoryImages", photo.file, photo.file.name);
    for (const photo of photos)
      form.append("filmImages", photo.file, photo.file.name);
    if (custom)
      form.append("musicFile", payload.music.file, payload.music.file.name);
    return form;
  }
  function validatePayment(amount, method) {
    if (!Number.isSafeInteger(amount) || amount < 1000)
      throw new Error("Giá máy chủ trả về không hợp lệ.");
    if (!["bank", "PAYOS"].includes(method))
      throw new Error(
        "Thanh toán quốc tế chưa được hỗ trợ. Vui lòng chọn Ngân hàng & Ví nội địa.",
      );
  }
  function paymentData(json) {
    const data = json?.data?.payment || json?.data || json?.payment || json;
    if (!data || typeof data !== "object" || !data.status)
      throw new Error("Không đọc được trạng thái thanh toán.");
    return data;
  }
  function paymentExpiry(payment) {
    // Payment.expiredAt is Unix seconds; gift.expiresAt is a separate ISO date.
    if (payment?.expiredAt != null) return Number(payment.expiredAt) * 1000;
    return payment?.expiresAt ? Date.parse(payment.expiresAt) : NaN;
  }
  function paymentStatus(payment) {
    const status = String(payment?.status || "UNKNOWN").toUpperCase();
    if (status === "CANCELED") return "CANCELLED";
    if (status === "PENDING" && paymentExpiry(payment) <= Date.now())
      return "EXPIRED";
    return status;
  }
  function closedPaymentError() {
    return Object.assign(
      new Error(
        "Đơn thanh toán đã đóng hoặc hết hạn. Mở lịch sử và chọn Thanh toán lại để tạo giao dịch mới.",
      ),
      { code: "PAYMENT_CLOSED" },
    );
  }

  function createClient({
    getUser,
    getIdToken,
    fetchImpl = root.fetch.bind(root),
    config = root.APP_CONFIG || {},
    onOrderCode = () => {},
  }) {
    const base = String(config.apiBase || "").replace(/\/$/, "");
    const observedStatuses = new Map();
    const statusKey = (uid, code) => `${uid}:${code}`;
    async function request(
      path,
      { method = "GET", body, authenticated = false, signal } = {},
    ) {
      const headers = { Accept: "application/json" };
      const isForm = body instanceof FormData;
      if (body && !isForm) headers["Content-Type"] = "application/json";
      if (authenticated) headers.Authorization = `Bearer ${await getIdToken()}`;
      signal?.throwIfAborted();
      const send = async () => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        const timer = setTimeout(abort, isForm ? 180000 : 30000);
        try {
          const response = await fetchImpl(base + path, {
            method,
            headers,
            body: body && (isForm ? body : JSON.stringify(body)),
            signal: controller.signal,
          });
          const json = await response.json().catch(() => ({}));
          return { response, json };
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
        }
      };
      let { response, json } = await send();
      // Only retry a rejected token, never blindly retry a network POST.
      if (response.status === 401 && authenticated) {
        headers.Authorization = `Bearer ${await getIdToken(true)}`;
        signal?.throwIfAborted();
        ({ response, json } = await send());
      }
      if (!response.ok || json.success === false) {
        const details = Array.isArray(json.details)
          ? json.details
              .map((d) => (typeof d === "string" ? d : d.message || d.msg))
              .filter(Boolean)
              .join("; ")
          : "";
        const error = new Error(
          [
            json.message ||
              json.error ||
              `Yêu cầu thất bại (${response.status}).`,
            details,
          ]
            .filter(Boolean)
            .join(" "),
        );
        error.status = response.status;
        error.code = json.code;
        error.details = json.details;
        throw error;
      }
      return json;
    }
    function identity() {
      const user = getUser();
      if (!user?.uid)
        throw new Error("Vui lòng đăng nhập Google trước khi thanh toán.");
      return user;
    }
    function checkOwner(session) {
      if (identity().uid !== session.uid)
        throw new Error("Phiên đăng nhập đã thay đổi. Hãy mở lại đơn hàng.");
    }
    async function getPayment(code, signal) {
      code = orderCode(code);
      const uid = identity().uid;
      try {
        const payment = paymentData(
          await request(`/api/payments/${encodeURIComponent(code)}`, {
            signal,
          }),
        );
        if (payment.orderCode != null && String(payment.orderCode) !== code)
          throw new Error("Máy chủ trả về trạng thái của mã đơn khác.");
        observedStatuses.set(statusKey(uid, code), paymentStatus(payment));
        return payment;
      } catch (error) {
        if (error.status === 404) {
          observedStatuses.delete(statusKey(uid, code));
          return null;
        }
        throw error;
      }
    }
    async function fetchOrders(signal) {
      const uid = identity().uid;
      const json = await request("/api/foryou2011s/orders/me", {
        authenticated: true,
        signal,
      });
      const update = (orders) =>
        orders.map((order) => {
          if (!order || typeof order !== "object") return order;
          const status = observedStatuses.get(
            statusKey(uid, String(order.orderCode)),
          );
          const remote = String(
            order.statusCode ?? order.status ?? "",
          ).toUpperCase();
          // Product history can lag Payment, especially when expiredAt just elapsed.
          // Update only pending rows so a fresh PAID/refunded server result always wins.
          return ["PENDING", "UNKNOWN", ""].includes(remote) &&
            ["PAID", "CANCELLED", "EXPIRED", "FAILED"].includes(status)
            ? {
                ...order,
                status: status.toLowerCase(),
                statusCode: status.toLowerCase(),
              }
            : order;
        });
      if (Array.isArray(json)) return update(json);
      if (Array.isArray(json.orders)) json.orders = update(json.orders);
      if (Array.isArray(json.data)) json.data = update(json.data);
      else if (Array.isArray(json.data?.orders))
        json.data.orders = update(json.data.orders);
      return json;
    }
    async function fetchGift(id, signal) {
      const json = await request(
        `/api/foryou2011s/gift/${encodeURIComponent(id)}`,
        { signal },
      );
      if (
        !json.success ||
        !json.data?.settings ||
        !["paid", "completed"].includes(String(json.data.status).toLowerCase())
      )
        throw new Error("Món quà chưa sẵn sàng để xem.");
      return json.data;
    }
    async function createProduct(session, signal) {
      checkOwner(session);
      const json = await request("/api/products", {
        method: "POST",
        signal,
        body: {
          name: "ForYou 20/11",
          uid: session.uid,
          orderCode: orderCode(session.orderCode),
          price: session.amount,
          type: TYPE,
          status: "PENDING",
          configId: session.giftId,
          linkproduct: session.shareUrl,
        },
      });
      if (!json.success || !json.data)
        throw new Error("Máy chủ chưa xác nhận tạo đơn hàng.");
      session.productCreated = true;
    }
    async function createPayment(session, signal) {
      checkOwner(session);
      validatePayment(session.amount, session.paymentMethod);
      const user = identity();
      const json = await request("/api/payments/create", {
        method: "POST",
        signal,
        body: {
          orderCode: orderCode(session.orderCode),
          uid: session.uid,
          amount: session.amount,
          description: "ForYou 2011",
          paymentMethod: "PAYOS",
          ...(user.email ? { customerEmail: user.email } : {}),
          galaxyData: {
            type: TYPE,
            forYou2011Id: session.giftId,
            configId: session.giftId,
            description: "ForYou 2011",
          },
        },
      });
      if (json.code !== "00" || !json.data?.checkoutUrl)
        throw new Error(
          json.message || json.desc || "Không nhận được link thanh toán.",
        );
      // Existing means this exact order. Never adopt another Product's order code.
      if (
        (json.data.isExistingOrder && json.data.orderCode == null) ||
        (json.data.orderCode != null &&
          orderCode(json.data.orderCode) !== session.orderCode)
      )
        throw new Error(
          "Mã thanh toán trả về không khớp đơn hàng đang thanh toán.",
        );
      session.checkoutUrl = httpUrl(json.data.checkoutUrl);
      return session;
    }
    async function prepareCheckout(
      payload,
      session,
      { signal, onProgress = () => {}, onSave = () => {} } = {},
    ) {
      const user = identity();
      if (!session) {
        validatePayment(
          payload.checkout.pricing.total,
          payload.checkout.paymentMethod,
        );
        session = {
          uid: user.uid,
          paymentMethod: payload.checkout.paymentMethod,
          orderCode: generateOrderCode(),
        };
        onProgress("Đang tạo món quà…");
        const json = await request("/api/foryou2011s", {
          method: "POST",
          body: buildRecordFormData(payload),
          authenticated: true,
          signal,
        });
        if (!json.success || !json.data?.id)
          throw new Error("Máy chủ chưa xác nhận tạo món quà.");
        // Retain the gift before later validation or commerce requests can fail.
        session.giftId = String(json.data.id);
        session.amount = json.data.checkout?.pricing?.total;
        session.pricing = json.data.checkout?.pricing;
        session.createdAt = json.data.createdAt;
        session.expiresAt = json.data.expiresAt;
        session.shareUrl =
          json.data.shareUrl ||
          new URL(
            `index.html?id=${encodeURIComponent(session.giftId)}`,
            root.location?.href,
          ).href;
        onSave(session);
      }
      checkOwner(session);
      if (session.restored) {
        const json = await request(
          `/api/foryou2011s/${encodeURIComponent(session.giftId)}`,
          { authenticated: true, signal },
        );
        const record = json.data;
        if (!json.success || record?.uid !== session.uid)
          throw new Error("Không xác nhận được quyền sở hữu món quà đã lưu.");
        if (session.productCreated) {
          const result = await request(
            `/api/products/ordercode/${encodeURIComponent(session.orderCode)}`,
            { signal },
          );
          const product = result.data;
          if (
            !result.success ||
            product?.uid !== session.uid ||
            product.type !== TYPE ||
            String(product.configId) !== session.giftId ||
            String(product.orderCode) !== session.orderCode
          )
            throw new Error(
              "Không xác nhận được sản phẩm của đơn hàng đã chọn.",
            );
          session.amount = Number(product.price);
          session.shareUrl =
            product.linkproduct || record.shareUrl || session.shareUrl;
        } else {
          session.amount = record.checkout?.pricing?.total;
          session.shareUrl = record.shareUrl || session.shareUrl;
        }
        session.pricing =
          record.checkout?.pricing?.total === session.amount
            ? record.checkout.pricing
            : undefined;
        session.expiresAt = record.expiresAt;
        session.paymentMethod =
          session.paymentMethod || record.checkout?.paymentMethod;
        session.restored = false;
        onSave(session);
      }
      if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now())
        throw new Error(
          "Món quà đã hết hạn lưu trữ. Vui lòng tạo món quà mới.",
        );
      session.shareUrl = httpUrl(session.shareUrl);
      validatePayment(session.amount, session.paymentMethod);
      if (!session.productCreated) {
        onProgress("Đang tạo đơn hàng…");
        // A previous Product POST can succeed even when its response was lost.
        if (session.productAttempted) {
          try {
            const existing = await request(
              `/api/products/ordercode/${encodeURIComponent(session.orderCode)}`,
              { signal },
            );
            const product = existing.data;
            if (
              !product ||
              String(product.configId) !== session.giftId ||
              product.uid !== session.uid ||
              product.type !== TYPE ||
              Number(product.price) !== session.amount
            )
              throw new Error(
                "Mã đơn đã gắn với sản phẩm khác. Vui lòng kiểm tra lịch sử đơn hàng.",
              );
            session.productCreated = true;
          } catch (error) {
            if (error.status !== 404) throw error;
          }
        }
        if (!session.productCreated) {
          session.productAttempted = true;
          onSave(session);
          await createProduct(session, signal);
        }
        onSave(session);
      }
      checkOwner(session);
      onOrderCode(session.orderCode);
      onProgress("Đang lấy link thanh toán…");
      const existing = await getPayment(session.orderCode, signal);
      if (existing) {
        const status = paymentStatus(existing);
        if (status === "PAID") {
          await fetchGift(session.giftId, signal);
          return { ...session, paid: true };
        }
        if (status !== "PENDING") throw closedPaymentError();
        if (existing.checkoutUrl && paymentExpiry(existing) > Date.now()) {
          session.checkoutUrl = httpUrl(existing.checkoutUrl);
          onSave(session);
          return session;
        }
      }
      try {
        await createPayment(session, signal);
      } catch (error) {
        if (error.status === 409 && error.code === "PAYMENT_CONFLICT") {
          onProgress(error.message, true);
          // Reconcile once using GETs only. A conflict never retries the POST.
          try {
            const latest = await getPayment(session.orderCode, signal);
            checkOwner(session);
            if (paymentStatus(latest) === "PAID") {
              await fetchGift(session.giftId, signal);
              onSave(session);
              return { ...session, paid: true, paymentMessage: error.message };
            }
          } catch (refreshError) {
            signal?.throwIfAborted();
            checkOwner(session);
            error.refreshError = refreshError;
          }
        }
        throw error;
      }
      onSave(session);
      return session;
    }
    async function resumeOrder(order, options = {}) {
      const user = identity();
      const session = {
        uid: user.uid,
        giftId: String(order.giftId || order.configId || ""),
        orderCode: orderCode(order.orderCode),
        amount: order.amount,
        paymentMethod: order.paymentMethod,
        shareUrl: order.giftUrl || order.shareUrl,
        productCreated: true,
        createdAt: order.createdAt,
        restored: true,
      };
      if (!session.giftId) throw new Error("Đơn hàng thiếu ID món quà.");
      const payment = await getPayment(session.orderCode, options.signal);
      const closed = ["CANCELLED", "EXPIRED", "FAILED"].includes(
        paymentStatus(payment),
      );
      if (
        closed ||
        (!payment && ["expired", "cancelled", "failed"].includes(order.status))
      ) {
        if (options.renew !== true) throw closedPaymentError();
        const json = await request(
          `/api/foryou2011s/${encodeURIComponent(session.giftId)}`,
          { authenticated: true, signal: options.signal },
        );
        if (!json.success || json.data?.uid !== user.uid)
          throw new Error("Không xác nhận được chủ sở hữu món quà.");
        if (
          json.data.expiresAt &&
          Date.parse(json.data.expiresAt) <= Date.now()
        )
          throw new Error(
            "Món quà đã hết hạn lưu trữ. Vui lòng tạo món quà mới.",
          );
        session.amount = json.data.checkout?.pricing?.total;
        session.paymentMethod = json.data.checkout?.paymentMethod;
        session.expiresAt = json.data.expiresAt;
        session.restored = false;
        session.orderCode = generateOrderCode();
        session.productCreated = false;
        options.onSave?.(session);
      }
      return prepareCheckout(null, session, options);
    }
    return {
      prepareCheckout,
      resumeOrder,
      getPayment,
      fetchGift,
      fetchOrders,
    };
  }
  return Object.freeze({
    TYPE,
    generateOrderCode,
    orderCode,
    httpUrl,
    buildRecordFormData,
    validatePayment,
    paymentData,
    paymentStatus,
    createClient,
  });
});
