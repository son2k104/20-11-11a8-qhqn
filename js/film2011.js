(() => {
  "use strict";
  const WIDTH = 2143,
    HEIGHT = 734;
  const HOLD_AFTER_ASSEMBLY = 3000;
  const RESUME_AFTER_INTERACTION = 2000;
  const FILM_SPEED = 38;
  const FILM_STRETCH = 1.18;
  const DECORATION_SOURCE = "assets/images/khung-phim-trong-suot.png";
  const BACKGROUND_SOURCE = "assets/images/nen-lien-mach.png";
  let customPhotos = false;
  // 27 ảnh kỷ niệm thật (assets/images/film/kyniem-01..27.jpg), không trùng 3 ảnh ở màn hình đầu.
  let PHOTO_SOURCES = Array.from(
    { length: 27 },
    (_, index) =>
      `assets/images/film/kyniem-${String(index + 1).padStart(2, "0")}.jpg`,
  );
  const experience = document.getElementById("experience");
  const $ = (id) => experience.querySelector(`#${id}`);
  const svgNS = "http://www.w3.org/2000/svg";
  const intro = $("intro"),
    film = $("film"),
    stage = $("stage");
  const viewport = $("film-viewport"),
    canvas = $("film-canvas");
  stage.style.setProperty("--film-stretch", FILM_STRETCH);
  const context = canvas.getContext("2d", { alpha: true });
  const filmTexture = document.createElement("canvas");
  const textureContext = filmTexture.getContext("2d", { alpha: false });
  const reflection = document.createElement("canvas");
  const reflectionContext = reflection.getContext("2d");
  let textureScale = 0,
    filmUnitsPerPixel = 1;
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  const cacheCollage = matchMedia("(any-pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  let collageCache = null;
  const tiles = [];
  const insertTiles = [];
  let animations = [],
    runId = 0,
    scene = "intro",
    photoImages = [],
    backgroundImage;
  let filmOffset = 0,
    lastInteraction = -Infinity,
    lastTime = 0;
  let paused = false,
    pointerId = null,
    lastX = 0,
    needsPaint = true;

  // Four corners traced from the reference; the whole outline shapes each digit.
  const photoOutlines = [
    [
      [471, 112],
      [599, 83],
      [615, 213],
      [467, 244],
    ],
    [
      [612, 82],
      [765, 124],
      [729, 242],
      [586, 203],
    ],
    [
      [430, 190],
      [563, 197],
      [555, 306],
      [419, 300],
    ],
    [
      [648, 208],
      [783, 247],
      [745, 356],
      [612, 318],
    ],
    [
      [630, 300],
      [745, 348],
      [635, 454],
      [446, 454],
    ],
    [
      [414, 446],
      [647, 450],
      [641, 585],
      [405, 586],
    ],
    [
      [651, 454],
      [780, 472],
      [763, 593],
      [640, 578],
    ],
    [
      [870, 141],
      [967, 112],
      [1011, 226],
      [848, 250],
    ],
    [
      [927, 112],
      [1030, 94],
      [1057, 216],
      [944, 242],
    ],
    [
      [1020, 94],
      [1167, 148],
      [1125, 238],
      [1007, 199],
    ],
    [
      [840, 222],
      [975, 260],
      [926, 377],
      [811, 333],
    ],
    [
      [1074, 224],
      [1193, 193],
      [1224, 329],
      [1092, 358],
    ],
    [
      [811, 355],
      [942, 343],
      [964, 479],
      [845, 530],
    ],
    [
      [1074, 328],
      [1227, 342],
      [1207, 453],
      [1058, 431],
    ],
    [
      [1067, 428],
      [1208, 455],
      [1169, 557],
      [1075, 596],
    ],
    [
      [902, 451],
      [1082, 484],
      [1069, 607],
      [879, 567],
    ],
    [
      [1240, 340],
      [1405, 343],
      [1403, 431],
      [1239, 426],
    ],
    [
      [1388, 182],
      [1516, 153],
      [1534, 267],
      [1408, 295],
    ],
    [
      [1505, 119],
      [1626, 120],
      [1630, 249],
      [1507, 269],
    ],
    [
      [1493, 270],
      [1616, 244],
      [1644, 412],
      [1506, 438],
    ],
    [
      [1483, 426],
      [1639, 404],
      [1653, 494],
      [1495, 516],
    ],
    [
      [1486, 477],
      [1665, 465],
      [1674, 589],
      [1495, 602],
    ],
    [
      [1706, 190],
      [1844, 151],
      [1858, 275],
      [1717, 309],
    ],
    [
      [1837, 116],
      [1967, 122],
      [1964, 274],
      [1832, 274],
    ],
    [
      [1826, 275],
      [1967, 269],
      [1969, 481],
      [1822, 464],
    ],
    [
      [1806, 463],
      [2001, 477],
      [1992, 605],
      [1797, 591],
    ],
  ];
  // Center the full date by its outer photo edges, preserving every card's layout.
  const photoXs = photoOutlines.flat().map(([x]) => x);
  const collageCenter = (Math.min(...photoXs) + Math.max(...photoXs)) / 2;
  stage.style.setProperty(
    "--collage-shift",
    `${((WIDTH / 2 - collageCenter) / WIDTH) * 100}%`,
  );
  // Mỗi ô chữ "20-11" dùng một ảnh riêng (chỉ số trong PHOTO_SOURCES), chọn theo tỉ lệ khung
  // để ít bị cắt nhất. 26 ô dùng 26 ảnh khác nhau; ảnh còn lại chỉ xuất hiện ở thước phim.
  const collagePhotos = [
    [0],
    [1],
    [3],
    [5],
    [7],
    [4],
    [8],
    [9],
    [25],
    [2],
    [13],
    [15],
    [11],
    [16],
    [20],
    [21],
    [17],
    [22],
    [23],
    [14],
    [12],
    [10],
    [18],
    [26],
    [19],
    [6],
  ];
  // Small curved photo slips sit UNDER the approved paper frames, filling only
  // the notches around the strokes. The counters of the 2 and 0 stay open.
  const collageInserts = [
    {
      photo: 2,
      box: [420, 105, 105, 145],
      path: "M427 205Q433 147 477 111L493 165L469 224Z",
    },
    {
      photo: 0,
      box: [560, 75, 105, 105],
      path: "M575 100Q603 74 638 97L633 142L576 147Z",
    },
    {
      photo: 3,
      box: [705, 155, 90, 135],
      path: "M738 163Q786 204 779 266L723 255L709 202Z",
    },
    {
      photo: 4,
      box: [595, 200, 115, 165],
      path: "M644 207C654 246 634 286 606 323L627 350L688 285L696 219Z",
    },
    {
      photo: 7,
      box: [830, 115, 130, 150],
      path: "M839 238Q844 162 917 121L949 157L901 243Z",
    },
    {
      photo: 8,
      box: [930, 175, 175, 120],
      path: "M938 206Q1003 180 1089 215L1099 257Q1045 209 1003 234L968 279Z",
    },
    {
      photo: 9,
      box: [1100, 150, 125, 130],
      path: "M1139 161Q1205 183 1211 253L1150 270L1105 207Z",
    },
    {
      photo: 12,
      box: [800, 305, 100, 110],
      path: "M824 315Q803 344 815 380L865 390L868 332Z",
    },
    {
      photo: 13,
      box: [1155, 300, 85, 95],
      path: "M1164 312Q1237 314 1221 368L1168 373Z",
    },
    {
      photo: 12,
      box: [830, 475, 165, 140],
      path: "M838 483C851 545 904 583 963 594L982 558L914 496Z",
    },
    {
      photo: 14,
      box: [1010, 515, 170, 105],
      path: "M1023 555L1168 526C1154 574 1112 601 1061 608Z",
    },
    {
      photo: 18,
      box: [1440, 115, 100, 110],
      path: "M1450 179L1513 125L1530 202Z",
    },
    {
      photo: 23,
      box: [1760, 115, 110, 110],
      path: "M1770 187L1844 122L1854 207Z",
    },
  ];
  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
    return element;
  }
  function triangleMatrix(source, target) {
    const [p, q, r] = source;
    const determinant =
      (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
    const coefficients = (axis) => {
      const first = target[1][axis] - target[0][axis];
      const second = target[2][axis] - target[0][axis];
      const a = (first * (r[1] - p[1]) - second * (q[1] - p[1])) / determinant;
      const b = (second * (q[0] - p[0]) - first * (r[0] - p[0])) / determinant;
      return [a, b, target[0][axis] - a * p[0] - b * p[1]];
    };
    const [a, c, e] = coefficients(0);
    const [b, d, f] = coefficients(1);
    return [a, b, c, d, e, f];
  }
  function triangleTransform(source, target) {
    return `matrix(${triangleMatrix(source, target).join(" ")})`;
  }
  function buildCollageInserts(layer) {
    const inserts = svgElement("g", {
      class: "collage-inserts",
      "aria-hidden": "true",
    });
    collageInserts.forEach(
      ({ photo, box: [x, y, width, height], path }, index) => {
        const id = `collage-insert-${index}`;
        const definitions = svgElement("defs");
        const clip = svgElement("clipPath", { id });
        clip.append(svgElement("path", { d: path }));
        definitions.append(clip);
        const slip = svgElement("g", { filter: "url(#photo-glow)" });
        const surface = svgElement("g", {
          class: "photo-surface",
          "clip-path": `url(#${id})`,
        });
        surface.append(
          svgElement("use", {
            href: `#collage-photo-${photo}`,
            x,
            y,
            width,
            height,
          }),
        );
        slip.append(
          definitions,
          surface,
          svgElement("path", {
            d: path,
            fill: "none",
            stroke: "#fff5df",
            "stroke-width": 2,
            "stroke-linejoin": "round",
          }),
        );
        const movingSlip = svgElement("g", { class: "collage-insert" });
        movingSlip.style.transformOrigin = tiles[photo].style.transformOrigin;
        movingSlip.append(slip);
        inserts.append(movingSlip);
        insertTiles.push({ element: movingSlip, photo });
      },
    );
    layer.prepend(inserts);
  }
  function buildCollage() {
    const layer = $("collage-tiles");
    photoOutlines.forEach((points, index) => {
      const tile = document.createElementNS(svgNS, "g");
      tile.classList.add("photo-tile");
      tile.dataset.digit =
        index < 7
          ? "2"
          : index < 16
            ? "0"
            : index === 16
              ? "dash"
              : index < 22
                ? "first-1"
                : "second-1";
      const center = points.reduce(
        (sum, point) => [
          sum[0] + point[0] / points.length,
          sum[1] + point[1] / points.length,
        ],
        [0, 0],
      );
      const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const width =
        (distance(points[0], points[1]) + distance(points[3], points[2])) / 2;
      const height =
        (distance(points[0], points[3]) + distance(points[1], points[2])) / 2;
      const corners = [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ];
      const outline = points.map((point) => point.join(",")).join(" ");
      const frame = svgElement("g", { filter: "url(#photo-glow)" });
      const definitions = svgElement("defs");
      const sourceId = `collage-photo-${index}`;
      const clipId = `collage-outline-${index}`;
      const clip = svgElement("clipPath", { id: clipId });
      clip.append(svgElement("polygon", { points: outline }));
      const [defaultIndex, defaultCrop = [0, 0, 1, 1]] = collagePhotos[index];
      const photoIndex = customPhotos ? index % photoImages.length : defaultIndex;
      const crop = customPhotos ? [0, 0, 1, 1] : defaultCrop;
      const photo = photoImages[photoIndex];
      const source = svgElement("svg", {
        id: sourceId,
        width,
        height,
        viewBox: `${crop[0] * photo.naturalWidth} ${crop[1] * photo.naturalHeight} ${crop[2] * photo.naturalWidth} ${crop[3] * photo.naturalHeight}`,
        preserveAspectRatio: "xMidYMid slice",
        overflow: "hidden",
      });
      source.append(
        svgElement("image", {
          href: PHOTO_SOURCES[photoIndex],
          width: photo.naturalWidth,
          height: photo.naturalHeight,
        }),
      );
      definitions.append(source, clip);
      const surface = svgElement("g", {
        class: "photo-surface",
        "clip-path": `url(#${clipId})`,
      });
      // Four small affine patches honor every corner, including tapered frames.
      // Native SVG keeps the original photos sharp without rasterizing the collage.
      points.forEach((point, corner) => {
        const next = (corner + 1) % 4;
        const target = [point, points[next], center];
        const source = [
          corners[corner],
          corners[next],
          [width / 2, height / 2],
        ];
        const triangleId = `collage-patch-${index}-${corner}`;
        const midpoint = [0, 1].map((axis) =>
          target.reduce((sum, p) => sum + p[axis] / 3, 0),
        );
        // A subpixel overlap prevents hairline cracks between adjacent patches.
        const expanded = target.map((p) =>
          p.map(
            (value, axis) => midpoint[axis] + (value - midpoint[axis]) * 1.008,
          ),
        );
        const triangleClip = svgElement("clipPath", { id: triangleId });
        triangleClip.append(
          svgElement("polygon", {
            points: expanded.map((p) => p.join(",")).join(" "),
          }),
        );
        definitions.append(triangleClip);
        const patch = svgElement("g", { "clip-path": `url(#${triangleId})` });
        patch.append(
          svgElement("use", {
            href: `#${sourceId}`,
            transform: triangleTransform(source, target),
          }),
        );
        surface.append(patch);
      });
      const border = svgElement("polygon", {
        class: "photo-border",
        points: outline,
        fill: "none",
        stroke: "#fffdf4",
        "stroke-width": 5,
        "stroke-linejoin": "round",
      });
      frame.append(definitions, surface, border);
      tile.append(frame);
      tile.style.transformOrigin = `${center[0]}px ${center[1]}px`;
      // Tuck the diagonal of the 2 underneath the upper turn, like the reference.
      if (index === 4) layer.insertBefore(tile, tiles[3]);
      else layer.append(tile);
      tiles.push(tile);
    });
    buildCollageInserts(layer);
  }

  function polygonPath(points) {
    const path = new Path2D();
    points.forEach(([x, y], index) => {
      if (index) path.lineTo(x, y);
      else path.moveTo(x, y);
    });
    path.closePath();
    return path;
  }

  function drawCollagePhoto(context, image, crop, x, y, width, height) {
    const [left, top, cropWidth, cropHeight] = crop;
    const sourceWidth = image.width * cropWidth;
    const sourceHeight = image.height * cropHeight;
    const cover = Math.max(width / sourceWidth, height / sourceHeight);
    const visibleWidth = width / cover, visibleHeight = height / cover;
    context.drawImage(image,
      image.width * left + (sourceWidth - visibleWidth) / 2,
      image.height * top + (sourceHeight - visibleHeight) / 2,
      visibleWidth, visibleHeight, x, y, width, height);
  }

  function warmCollageSource(context, photo, warmth) {
    const { width, height } = context.canvas;
    try {
      const pixels = context.getImageData(0, 0, width, height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        for (let channel = 0; channel < 3; channel++) {
          pixels.data[index + channel] = warmth[channel][pixels.data[index + channel]];
        }
      }
      context.putImageData(pixels, 0, 0);
    } catch (error) {
      if (error.name !== "SecurityError") throw error;
      // R2/CDN images without CORS can still be drawn and composited. Only
      // pixel readback is forbidden: do not discard the entire mobile cache.
      // This soft-light approximation follows photo-warmth's gamma curves
      // within a few RGB levels, without Canvas filters (unsupported on older
      // iOS). Bake it once per source, never on the moving tiles.
      context.save();
      context.globalCompositeOperation = "soft-light";
      context.fillStyle = "#b9ae9e";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "multiply";
      context.fillStyle = "rgb(100%, 100%, 99.5%)";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "screen";
      context.fillStyle = "rgb(1%, 0.3%, 0%)";
      context.fillRect(0, 0, width, height);
      // The opaque grading fills must not make transparent PNGs opaque.
      context.globalCompositeOperation = "destination-in";
      context.drawImage(photo, 0, 0, width, height);
      context.restore();
    }
  }

  async function prepareCollageCache() {
    // Animate small HTML canvases on touch devices. Moving the SVG meshes would
    // repaint their clipping, colour filters, shadows and mirrored copies.
    const layer = $("collage-tiles");
    const scale = Math.min(1.5, stage.clientWidth / WIDTH * Math.min(devicePixelRatio || 1, 2));
    const cachedLayer = document.createElement("div");
    cachedLayer.className = "collage-cache";
    cachedLayer.setAttribute("aria-hidden", "true");
    const replacements = new Map();
    const records = [];
    const sources = [];
    const surface = document.createElement("canvas");
    try {
      // Use decoded JPGs directly: iOS can omit embedded photos when an SVG
      // snapshot is drawn to canvas even though the SVG's borders still render.
      // Match photo-warmth once per source, without relying on Canvas filters.
      const warmth = [[.99, .74, .01], [.997, .78, .003], [.995, .85, 0]]
        .map(([amplitude, exponent, offset]) => Uint8ClampedArray.from(
          { length: 256 }, (_, value) => 255 * (amplitude * (value / 255) ** exponent + offset),
        ));
      for (const photo of photoImages) {
        const source = document.createElement("canvas");
        sources.push(source);
        const ratio = Math.min(1, 768 / Math.max(photo.naturalWidth, photo.naturalHeight));
        source.width = Math.max(1, Math.round(photo.naturalWidth * ratio));
        source.height = Math.max(1, Math.round(photo.naturalHeight * ratio));
        const sourceContext = source.getContext("2d");
        sourceContext.imageSmoothingQuality = "high";
        sourceContext.drawImage(photo, 0, 0, source.width, source.height);
        warmCollageSource(sourceContext, photo, warmth);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Preserve the SVG's stacking order, including the slips below every photo.
      const pieces = [...insertTiles.map(({ element }) => element),
        ...Array.from(layer.children).filter(element => element.classList.contains("photo-tile"))];
      for (const piece of pieces) {
        const bounds = piece.getBBox();
        const x = bounds.x - 36, y = bounds.y - 36;
        const width = bounds.width + 72, height = bounds.height + 72;
        const bitmap = document.createElement("canvas");
        bitmap.width = Math.max(1, Math.ceil(width * scale));
        bitmap.height = Math.max(1, Math.ceil(height * scale));
        bitmap.className = "collage-cache__tile";
        if (piece.dataset.digit) bitmap.dataset.digit = piece.dataset.digit;
        const [originX, originY] = piece.style.transformOrigin.split(" ").map(parseFloat);
        Object.assign(bitmap.style, {
          left: `${x / WIDTH * 100}%`, top: `${y / HEIGHT * 100}%`,
          width: `${width / WIDTH * 100}%`, height: `${height / HEIGHT * 100}%`,
          transformOrigin: `${(originX - x) / width * 100}% ${(originY - y) / height * 100}%`,
        });
        surface.width = bitmap.width;
        surface.height = bitmap.height;
        const drawing = surface.getContext("2d");
        drawing.setTransform(bitmap.width / width, 0, 0, bitmap.height / height,
          -x * bitmap.width / width, -y * bitmap.height / height);
        drawing.imageSmoothingQuality = "high";
        const insertIndex = insertTiles.findIndex(({ element }) => element === piece);
        const photoIndex = insertIndex >= 0 ? collageInserts[insertIndex].photo : tiles.indexOf(piece);
        const [defaultIndex, defaultCrop = [0, 0, 1, 1]] = collagePhotos[photoIndex];
        const sourceIndex = customPhotos ? photoIndex % photoImages.length : defaultIndex;
        const crop = customPhotos ? [0, 0, 1, 1] : defaultCrop;
        let outline;
        drawing.save();
        if (insertIndex >= 0) {
          const insert = collageInserts[insertIndex];
          outline = new Path2D(insert.path);
          drawing.clip(outline);
          drawCollagePhoto(drawing, sources[sourceIndex], crop, ...insert.box);
        } else {
          const points = photoOutlines[photoIndex];
          outline = polygonPath(points);
          drawing.clip(outline);
          const source = $(`collage-photo-${photoIndex}`);
          const frameWidth = Number(source.getAttribute("width"));
          const frameHeight = Number(source.getAttribute("height"));
          const corners = [[0, 0], [frameWidth, 0], [frameWidth, frameHeight], [0, frameHeight]];
          points.forEach((point, corner) => {
            const next = (corner + 1) % 4;
            const target = [point, points[next], [originX, originY]];
            const midpoint = [0, 1].map(axis => target.reduce((sum, p) => sum + p[axis] / 3, 0));
            const expanded = target.map(p => p.map((value, axis) => midpoint[axis] + (value - midpoint[axis]) * 1.008));
            drawing.save();
            drawing.clip(polygonPath(expanded));
            drawing.transform(...triangleMatrix(
              [corners[corner], corners[next], [frameWidth / 2, frameHeight / 2]], target,
            ));
            drawCollagePhoto(drawing, sources[sourceIndex], crop, 0, 0, frameWidth, frameHeight);
            drawing.restore();
          });
        }
        drawing.restore();
        drawing.lineWidth = insertIndex >= 0 ? 2 : 5;
        drawing.lineJoin = "round";
        drawing.strokeStyle = insertIndex >= 0 ? "#fff5df" : "#fffdf4";
        drawing.stroke(outline);

        // Bake the glow into the same small bitmap; flights only animate it.
        const bitmapContext = bitmap.getContext("2d");
        bitmapContext.shadowColor = "rgba(255,220,160,.78)";
        bitmapContext.shadowBlur = 20 * scale;
        bitmapContext.shadowOffsetY = 2 * scale;
        bitmapContext.drawImage(surface, 0, 0);
        bitmapContext.shadowColor = "rgba(255,246,216,.95)";
        bitmapContext.shadowBlur = 6.4 * scale;
        bitmapContext.shadowOffsetY = 0;
        bitmapContext.drawImage(surface, 0, 0);
        replacements.set(piece, bitmap);
        records.push({ bitmap, x, y, width, height });
        cachedLayer.append(bitmap);
        if (records.length % 6 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }

      // The reflection appears after assembly; it never duplicates moving meshes.
      const mirror = document.createElement("canvas");
      mirror.className = "collage-cache__reflection";
      mirror.width = Math.ceil(WIDTH * scale);
      mirror.height = Math.ceil(129 * scale);
      const mirrorContext = mirror.getContext("2d");
      mirrorContext.setTransform(scale, 0, 0, -scale, 0, 615 * scale);
      for (const { bitmap, x, y, width, height } of records) {
        mirrorContext.drawImage(bitmap, x, y, width, height);
      }
      mirrorContext.setTransform(scale, 0, 0, scale, 0, 0);
      mirrorContext.globalCompositeOperation = "destination-in";
      const fade = mirrorContext.createLinearGradient(0, 0, 0, 129);
      fade.addColorStop(0, "rgba(255,255,255,.19)");
      fade.addColorStop(1, "rgba(255,255,255,0)");
      mirrorContext.fillStyle = fade;
      mirrorContext.fillRect(400, 0, 1650, 129);
      cachedLayer.prepend(mirror);
      tiles.forEach((tile, index) => { tiles[index] = replacements.get(tile); });
      insertTiles.forEach(insert => { insert.element = replacements.get(insert.element); });
      layer.replaceChildren();
      $("collage").after(cachedLayer);
      collageCache = cachedLayer;
    } catch (error) {
      // Preserve the original photos if canvas preparation is unavailable.
      cachedLayer.querySelectorAll("canvas").forEach(bitmap => { bitmap.width = bitmap.height = 1; });
      console.warn("Could not cache collage; using SVG photos.", error);
    } finally {
      sources.forEach(source => { source.width = source.height = 1; });
      surface.width = surface.height = 1;
    }
  }

  function releaseCollageCache() {
    if (!collageCache) return;
    animations = animations.filter(animation => {
      if (!collageCache.contains(animation.effect?.target)) return true;
      animation.cancel();
      return false;
    });
    collageCache.querySelectorAll("canvas").forEach(bitmap => { bitmap.width = bitmap.height = 1; });
    collageCache.remove();
    collageCache = null;
    tiles.length = 0;
    insertTiles.length = 0;
  }

  // The reference supplies only decoration; textures use the remaining class photos.
  const filmPhotos = PHOTO_SOURCES.map((src) => ({ src, filmWidth: 600 }));
  let loopWidth = 0;
  const FILM_LEFT = 310,
    FILM_RIGHT = 1856;
  // Reveal the moving photos through the broad side returns of the PNG.
  // Taper the openings at the corners, leaving a fine pink outer rim.
  const frameOutline = $("film-frame-outline");
  frameOutline.setAttribute("transform", `scale(${1 / WIDTH} ${1 / HEIGHT})`);
  frameOutline.setAttribute(
    "d",
    "M295 0H1875V734H295Z " +
      "M310 158Q314 134 345 125L345 522H326C317 522 310 515 310 506Z " +
      "M1810 152Q1847 159 1854 188L1856 504C1856 516 1846 520 1837 522C1828 524 1819 526 1810 527Z",
  );
  const filmWindow = new Path2D(
    "M310 158Q310 134 345 119C380 108 440 108 510 120C800 162 1010 181 1218 182C1420 184 1608 143 1729 138C1785 137 1847 144 1854 178L1856 518Q1853 535 1810 535C1650 560 1440 575 1220 575C900 574 570 561 345 536C329 532 310 526 310 506Z",
  );
  const topProfile = [
    [310, 145],
    [317, 143],
    [345, 129],
    [420, 120],
    [510, 125],
    [650, 146],
    [900, 171],
    [1200, 186],
    [1400, 181],
    [1600, 157],
    [1730, 142],
    [1790, 145],
    [1820, 151],
    [1841, 162],
    [1856, 178],
  ];
  const bottomProfile = [
    [310, 531],
    [317, 529],
    [420, 540],
    [650, 557],
    [900, 568],
    [1200, 571],
    [1400, 566],
    [1600, 551],
    [1730, 540],
    [1790, 533],
    [1820, 535],
    [1841, 529],
    [1856, 522],
  ];
  function profileAt(points, x) {
    for (let i = 1; i < points.length; i++) {
      if (x <= points[i][0]) {
        const a = points[i - 1],
          b = points[i];
        return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
      }
    }
    return points.at(-1)[1];
  }
  const strips = [];
  function prepareFilmTexture(ratio) {
    if (!photoImages.length || !loopWidth) return;
    const height = Math.max(160, Math.round(400 * ratio * 1.25));
    if (textureScale === height / 400) return;
    textureScale = height / 400;
    filmTexture.width = Math.ceil(loopWidth * textureScale);
    filmTexture.height = height;
    textureContext.fillStyle = "#fff7df";
    textureContext.fillRect(0, 0, filmTexture.width, height);
    textureContext.setTransform(textureScale, 0, 0, textureScale, 0, 0);
    textureContext.imageSmoothingQuality = "high";
    let x = 0;
    // Crop and resize the photos once, rather than on every touch event.
    for (const photo of filmPhotos) {
      textureContext.drawImage(
        photo.image,
        photo.x,
        photo.y,
        photo.width,
        photo.height,
        x,
        0,
        photo.filmWidth,
        400,
      );
      x += photo.filmWidth;
    }
  }
  function paintFilm() {
    if (!photoImages.length || film.hidden) return;
    const ratio = canvas.width / WIDTH;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.save();
    context.clip(filmWindow);
    for (const strip of strips) {
      const position =
        ((((strip.x - 330) * FILM_STRETCH + filmOffset) % loopWidth) +
          loopWidth) %
        loopWidth;
      // Show more of the film instead of stretching faces with the wider rails.
      const sourceWidth = strip.width * FILM_STRETCH;
      const width = Math.min(sourceWidth, loopWidth - position);
      context.drawImage(
        filmTexture,
        position * textureScale,
        0,
        width * textureScale,
        filmTexture.height,
        strip.x,
        strip.top,
        width / FILM_STRETCH,
        strip.height,
      );
      if (width < sourceWidth) {
        // Continue across the loop seam without stretching the last pixels.
        context.drawImage(
          filmTexture,
          0,
          0,
          (sourceWidth - width) * textureScale,
          filmTexture.height,
          strip.x + width / FILM_STRETCH,
          strip.top,
          (sourceWidth - width) / FILM_STRETCH,
          strip.height,
        );
      }
    }
    // Move dividers continuously, independently of the curved photo slices.
    // Clipping follows the curved rails while fractional x positions stay smooth.
    for (
      let loopStart = 330 - (filmOffset + loopWidth) / FILM_STRETCH;
      loopStart < FILM_RIGHT;
      loopStart += loopWidth / FILM_STRETCH
    ) {
      let boundary = loopStart;
      for (const photo of filmPhotos) {
        if (boundary > FILM_LEFT - 5 && boundary < FILM_RIGHT + 5) {
          context.fillStyle = "#f4b6ac";
          context.fillRect(boundary - 3, 0, 8, HEIGHT);
          context.fillStyle = "#fff7df";
          context.fillRect(boundary, 0, 2, HEIGHT);
        }
        boundary += photo.filmWidth / FILM_STRETCH;
      }
    }
    context.restore();
    // Blur only a small buffer of the reflected band, not the full-size canvas.
    reflectionContext.clearRect(0, 0, reflection.width, reflection.height);
    reflectionContext.save();
    reflectionContext.filter = `blur(${ratio}px)`;
    reflectionContext.translate(0, reflection.height);
    reflectionContext.scale(1, -1);
    reflectionContext.drawImage(
      canvas,
      295 * ratio,
      451 * ratio,
      1580 * ratio,
      134 * ratio,
      0,
      0,
      reflection.width,
      reflection.height,
    );
    reflectionContext.restore();
    context.save();
    context.globalAlpha = 0.12;
    context.drawImage(reflection, 295, 600, 1580, 134);
    context.restore();
    needsPaint = false;
    canvas.dataset.offset = filmOffset.toFixed(3);
  }
  function resizeCanvas() {
    if (backgroundImage) {
      // Align the transparent foreground with the horizon in the ONE cover image.
      // This changes the foreground placement; the background is never tiled or mirrored.
      const bounds = experience.getBoundingClientRect();
      const scale = Math.max(
        bounds.width / backgroundImage.naturalWidth,
        bounds.height / backgroundImage.naturalHeight,
      );
      const backgroundHeight = backgroundImage.naturalHeight * scale;
      const ground =
        (bounds.height - backgroundHeight) / 2 + backgroundHeight * 0.724;
      const foregroundGround =
        (bounds.height - stage.clientHeight) / 2 +
        (stage.clientHeight * 600) / HEIGHT;
      stage.style.setProperty(
        "--ground-offset",
        `${ground - foregroundGround}px`,
      );
    }
    const stageBounds = stage.getBoundingClientRect();
    const introTitleBottom = (stageBounds.height * 65) / HEIGHT;
    const introTitleWidth = Math.min(
      stage.clientWidth * 0.78,
      980,
      (Math.max(1, stageBounds.top + introTitleBottom - 12) * 1000) / 155,
    );
    stage.style.setProperty("--intro-title-width", `${introTitleWidth}px`);
    stage.style.setProperty(
      "--intro-title-top",
      `${Math.max(12 - stageBounds.top, introTitleBottom - introTitleWidth * 0.155)}px`,
    );
    const titleBottom =
      stageBounds.height * (stage.clientWidth < 600 ? 0.06 : 0.17);
    const titleWidth = Math.min(
      stage.clientWidth * 0.78,
      980,
      (Math.max(1, stageBounds.top + titleBottom - 12) * 1000) / 260,
    );
    stage.style.setProperty("--film-title-width", `${titleWidth}px`);
    stage.style.setProperty(
      "--film-title-top",
      `${Math.max(12 - stageBounds.top, titleBottom - titleWidth * 0.26)}px`,
    );
    // Do not allocate the film textures while the photo intro is playing.
    if (scene !== "film") return;
    const size = Math.min(
      WIDTH,
      Math.round(stage.clientWidth * Math.min(devicePixelRatio || 1, 2)),
    );
    const height = Math.round((size * HEIGHT) / WIDTH);
    if (canvas.width !== size || canvas.height !== height) {
      canvas.width = size;
      canvas.height = height;
    }
    const ratio = size / WIDTH;
    filmUnitsPerPixel = WIDTH / stageBounds.width;
    const slicePixels = matchMedia("(any-pointer: coarse)").matches ? 3 : 2;
    const step = Math.max(2, slicePixels / ratio);
    strips.length = 0;
    for (let x = FILM_LEFT; x < FILM_RIGHT; x += step) {
      const top = profileAt(topProfile, x);
      strips.push({
        x,
        top: top - 10,
        height: profileAt(bottomProfile, x) - top + 20,
        width: step + 0.5 / ratio,
      });
    }
    prepareFilmTexture(ratio);
    const reflectionWidth = Math.max(1, Math.ceil((1580 * ratio) / 3));
    const reflectionHeight = Math.max(1, Math.ceil((134 * ratio) / 3));
    if (
      reflection.width !== reflectionWidth ||
      reflection.height !== reflectionHeight
    ) {
      reflection.width = reflectionWidth;
      reflection.height = reflectionHeight;
    }
    needsPaint = true;
    paintFilm();
  }
  function tick(time) {
    const elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    if (scene === "film" && !document.hidden) {
      if (
        pointerId === null &&
        !paused &&
        time - lastInteraction >= RESUME_AFTER_INTERACTION
      ) {
        filmOffset = (filmOffset + FILM_SPEED * elapsed) % loopWidth;
        needsPaint = true;
      }
      if (needsPaint) paintFilm();
    }
    requestAnimationFrame(tick);
  }
  function setPaused(value) {
    paused = value;
  }
  function moveFilm(delta) {
    filmOffset = (((filmOffset + delta) % loopWidth) + loopWidth) % loopWidth;
    lastInteraction = performance.now();
    needsPaint = true;
  }
  function finishDrag() {
    if (pointerId === null) return;
    const captured = pointerId;
    pointerId = null;
    viewport.classList.remove("is-dragging");
    lastInteraction = performance.now();
    if (viewport.hasPointerCapture(captured))
      viewport.releasePointerCapture(captured);
  }
  viewport.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || scene !== "film") return;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastInteraction = performance.now();
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    moveFilm((lastX - event.clientX) * filmUnitsPerPixel);
    lastX = event.clientX;
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) =>
    viewport.addEventListener(type, (event) => {
      if (event.pointerId === pointerId) finishDrag();
    }),
  );
  window.addEventListener("blur", finishDrag);
  viewport.addEventListener("dragstart", (event) => event.preventDefault());
  viewport.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) return;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? viewport.clientWidth
            : 1;
      moveFilm(delta * unit * filmUnitsPerPixel);
    },
    { passive: false },
  );
  viewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      moveFilm(event.key === "ArrowRight" ? 160 : -160);
    } else if (event.code === "Space") {
      event.preventDefault();
      lastInteraction = -Infinity;
      setPaused(!paused);
    }
  });
  function animate(element, keyframes, options) {
    const animation = element.animate(keyframes, options);
    animations.push(animation);
    if (document.hidden) {
      animation.pause();
      animation.wasVisibilityPaused = true;
    }
    return animation.finished;
  }
  async function playIntro() {
    const currentRun = ++runId;
    finishDrag();
    animations.forEach((animation) => animation.cancel());
    animations = [];
    scene = "intro";
    experience.dataset.scene = "intro";
    film.hidden = true;
    film.inert = true;
    intro.hidden = false;
    intro.inert = false;
    intro.classList.remove("is-assembled");
    $("collage").setAttribute(
      "aria-label",
      "Những bức ảnh đang bay vào xếp thành ngày 20 - 11",
    );
    $("announcer").textContent = "Đang xếp ảnh thành ngày 20 tháng 11.";
    const reduced = motionPreference.matches;
    const flightScale = collageCache ? stage.clientWidth / WIDTH : 1;
    const translate = (x, y) => collageCache
      ? `translate3d(${x}px, ${y}px, 0)`
      : `translate(${x}px, ${y}px)`;
    try {
      const flights = tiles.map((tile, index) => {
        // Each small backing piece travels with its neighboring photograph.
        const participants = [
          tile,
          ...insertTiles
            .filter(({ photo }) => photo === index)
            .map(({ element }) => element),
        ];
        participants.forEach((element) =>
          element.classList.remove("is-settled"),
        );
        const theta = index * 2.39996;
        const x = Math.cos(theta) * (900 + index * 18) * flightScale,
          y = Math.sin(theta) * 650 * flightScale;
        const keyframes = [
          {
            opacity: 0,
            transform: `${translate(x, y)} rotate(${index % 2 ? 38 : -38}deg) scale(.55)`,
            ...(!cacheCollage && { filter: "blur(4px)" }),
          },
          { opacity: 1, offset: 0.32 },
          {
            opacity: 1,
            transform: `${translate(0, 0)} rotate(0deg) scale(1)`,
            ...(!cacheCollage && { filter: "blur(0px)" }),
          },
        ];
        const options = {
          duration: reduced ? 1 : 1350,
          delay: reduced ? 0 : 250 + index * 85,
          fill: "both",
          easing: "cubic-bezier(.16,1,.3,1)",
        };
        return Promise.all(
          participants.map((element) => animate(element, keyframes, options)),
        );
      });
      await Promise.all(flights);
      if (currentRun !== runId) return;
      tiles.forEach((tile) => tile.classList.add("is-settled"));
      insertTiles.forEach(({ element }) => element.classList.add("is-settled"));
      await animate($("intro-complete"), [{ opacity: 0 }, { opacity: 1 }], {
        duration: reduced ? 1 : 380,
        fill: "forwards",
      });
      intro.classList.add("is-assembled");
      $("collage").setAttribute(
        "aria-label",
        "Ảnh đã xếp hoàn thành ngày 20 - 11",
      );
      await animate(intro, [{ opacity: 1 }, { opacity: 1 }], {
        duration: HOLD_AFTER_ASSEMBLY,
      });
      if (currentRun !== runId) return;
      scene = "transition";
      // Fade foregrounds only; the shared background remains unchanged.
      await Promise.all([
        animate(intro, [{ opacity: 1 }, { opacity: 0 }], {
          duration: reduced ? 1 : 600,
          fill: "forwards",
          easing: "ease-in-out",
        }),
        animate($("transition-glow"), [{ opacity: 0 }, { opacity: 0.7 }], {
          duration: reduced ? 1 : 600,
          fill: "forwards",
          easing: "ease-in-out",
        }),
      ]);
      if (currentRun !== runId) return;
      intro.hidden = true;
      intro.inert = true;
      releaseCollageCache();
      film.hidden = false;
      film.inert = false;
      filmOffset = 0;
      lastInteraction = -Infinity;
      setPaused(reduced);
      scene = "film";
      experience.dataset.scene = "film";
      resizeCanvas();
      requestAnimationFrame(tick);
      await Promise.all([
        animate(film, [{ opacity: 0 }, { opacity: 1 }], {
          duration: reduced ? 1 : 1000,
          fill: "forwards",
          easing: "cubic-bezier(.22,1,.36,1)",
        }),
        animate($("transition-glow"), [{ opacity: 0.7 }, { opacity: 0 }], {
          duration: reduced ? 1 : 1000,
          fill: "forwards",
          easing: "ease-out",
        }),
      ]);
      $("announcer").textContent =
        "Thước phim kỷ niệm. Kéo hoặc vuốt để xem ảnh; phim sẽ tiếp tục sau 2 giây không tương tác.";
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(error);
        $("load-error").hidden = false;
      }
    }
  }
  document.addEventListener("visibilitychange", () => {
    lastTime = 0;
    if (document.hidden) finishDrag();
    animations.forEach((animation) => {
      if (document.hidden && animation.playState === "running") {
        animation.pause();
        animation.wasVisibilityPaused = true;
      } else if (!document.hidden && animation.wasVisibilityPaused) {
        animation.play();
        animation.wasVisibilityPaused = false;
      }
    });
  });
  motionPreference.addEventListener("change", () => {
    if (scene === "film" && motionPreference.matches) setPaused(true);
  });
  async function loadImage(src) {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
  }
  let started = false;
  window.startFilm2011 = async () => {
    if (started) return;
    started = true;
    const gift = await window.__forYou2011Ready;
    if (gift?.film.enabled === false) return;
    if (gift?.film.photos.length) {
      customPhotos = true;
      PHOTO_SOURCES = gift.film.photos.slice();
      filmPhotos.splice(0, filmPhotos.length, ...PHOTO_SOURCES.map(src => ({ src, filmWidth: 600 })));
    }
    $("announcer").textContent = "Đang tải ảnh kỷ niệm…";
    Promise.all([
      loadImage(DECORATION_SOURCE),
      loadImage(BACKGROUND_SOURCE),
      ...PHOTO_SOURCES.map(loadImage),
    ])
      .then(async (images) => {
        // Load the local calligraphy before revealing either SVG inscription.
        await document.fonts.load(
          '93px "Great Vibes"',
          "Ngày nhà giáo Việt Nam 20/11",
        );
        backgroundImage = images[1];
        photoImages = images.slice(2);
        // Reveal the title only after its font, ground offset and size are ready.
        // Cache preparation may yield for several frames on touch devices.
        resizeCanvas();
        new ResizeObserver(resizeCanvas).observe(experience);
        stage.classList.add("is-ready");
        if (cacheCollage) intro.classList.add("is-preparing");
        buildCollage();
        if (cacheCollage) await prepareCollageCache();
        intro.classList.remove("is-preparing");
        filmPhotos.forEach((photo, index) => {
          photo.image = photoImages[index];
          const image = photo.image;
          // Hiện đầy đủ toàn bộ ảnh: khung rộng theo đúng tỉ lệ ảnh gốc (cao cố định 400),
          // không cắt mép dù ảnh ngang, dọc hay vuông.
          photo.filmWidth = (400 * image.naturalWidth) / image.naturalHeight;
          photo.x = 0;
          photo.y = 0;
          photo.width = image.naturalWidth;
          photo.height = image.naturalHeight;
        });
        loopWidth = filmPhotos.reduce((sum, photo) => sum + photo.filmWidth, 0);
        canvas.dataset.sources = PHOTO_SOURCES.join(",");
        resizeCanvas();
        playIntro();
      })
      .catch(() => {
        intro.classList.add("is-assembled");
        $("announcer").textContent = "";
        $("load-error").hidden = false;
      });
  };
})();
