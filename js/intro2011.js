/* The original lettering is revealed through animated SVG chalk strokes.
   Coordinates use the reference image's 1546 × 1017 viewBox. No fonts/CDN needed. */
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const intro = document.querySelector(".intro");
  const scene = document.querySelector("#scene");
  const svg = document.querySelector("#chalkboard");
  const writing = document.querySelector("#writing");
  const tip = document.querySelector("#chalk-tip");
  const status = document.querySelector("#status");
  const nextButton = document.querySelector("#intro-next");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const portraitDevice = matchMedia("(orientation: portrait) and (max-width: 1100px) and (any-pointer: coarse)");
  let frame = 0;
  let started = 0;
  let active = false;
  const strokes = [];
  const sweeps = [];

  // Broad masks follow the pen movements; the image retains the fine edges.
  const lines = [
    { ink: "pink", width: 38, paths: [
      "M342 358C268 321 367 259 493 282C591 304 633 180 574 197C504 202 426 351 486 378C534 401 588 316 610 286",
      "M580 340C628 240 652 166 697 151C757 135 703 220 641 243L608 325C634 281 671 261 652 298Q633 338 678 299",
      "M683 270Q649 332 686 314L717 266Q680 330 729 301M699 245L715 233",
      "M762 264C737 224 701 316 749 307L778 277",
      "M797 286L827 247Q844 225 829 278Q862 220 877 240L857 277Q896 219 905 239L886 273Q882 293 918 259",
      "M925 239Q902 290 937 275L964 230Q938 285 980 260M920 219Q907 215 908 207M947 222Q952 217 948 218",
      "M978 266L1007 223Q1032 207 1014 255Q1057 196 1064 223L1044 271",
      "M1067 221C1021 190 1007 284 1044 266L1070 219L1039 299Q1005 365 993 324Q1005 288 1100 321C1227 379 1278 342 1306 308",
      "M1048 292C1140 275 1243 219 1254 290"
    ] },
    // Trace each serif letter separately. Local clips stop the chalk tip from
    // revealing a neighbour; each small finishing pass includes its serifs.
    { ink: "ivory", width: 12, speed: 1.7, glyphs: [
      { bounds: [614, 342, 41, 44], paths: [
        "M623 349L623 380", "M624 355C632 341 646 345 646 356L646 380",
        "M617 382L630 382", "M640 382L653 382"
      ] },
      { bounds: [655, 342, 40, 59], paths: [
        "M677 348C657 340 653 369 674 369C693 369 694 345 677 348",
        "M665 367C652 380 672 379 682 381C705 387 682 404 664 396C654 391 661 382 671 381",
        "M684 350Q692 341 695 347"
      ] },
      { bounds: [693, 326, 37, 60], paths: [
        "M700 354C695 342 718 342 718 355L718 380",
        "M717 361C685 362 693 388 710 380L718 374",
        "M716 380Q723 385 728 379", "M703 332L711 339"
      ] },
      { bounds: [730, 342, 39, 59], paths: [
        "M735 349L748 378", "M759 349L744 387Q736 402 730 394",
        "M730 348L742 348", "M753 348L765 348"
      ], pause: 110 },
      { bounds: [779, 341, 46, 45], paths: [
        "M788 348L788 380", "M789 354C801 339 816 344 816 355L816 380",
        "M782 382L796 382", "M810 382L823 382"
      ] },
      { bounds: [825, 322, 39, 64], paths: [
        "M836 331L836 380", "M837 356C849 340 858 346 858 358L858 380",
        "M829 331L838 329", "M829 382L843 382", "M852 382L864 382"
      ] },
      { bounds: [864, 325, 39, 61], paths: [
        "M871 354C866 342 889 341 889 355L889 380",
        "M888 361C856 362 865 388 881 380L889 374",
        "M889 380Q896 385 901 379", "M877 331L884 339"
      ], pause: 110 },
      { bounds: [916, 341, 39, 60], paths: [
        "M938 348C918 340 913 369 935 369C954 369 955 345 938 348",
        "M926 367C913 380 933 379 943 381C966 387 943 404 925 396C915 391 922 382 932 381",
        "M945 350Q953 341 956 347"
      ] },
      { bounds: [955, 330, 20, 56], paths: [
        "M965 349L965 380", "M958 382L973 382", "M958 348L966 348",
        "M965 336L966 336"
      ] },
      { bounds: [975, 326, 37, 60], paths: [
        "M982 354C977 342 1000 342 1000 355L1000 380",
        "M999 361C967 362 976 388 992 380L1000 374",
        "M999 380Q1006 385 1011 379", "M985 339L993 331"
      ] },
      { bounds: [1012, 342, 37, 44], paths: [
        "M1031 347C1008 343 1007 382 1030 382C1052 382 1051 347 1031 347"
      ] }
    ] },
    { ink: "pink", width: 37, paths: [
      "M470 508C422 486 496 401 561 415C665 437 578 527 554 574C530 625 617 520 654 465Q679 417 710 423",
      "M663 479L632 531Q617 559 661 534M681 466L691 457",
      "M681 517Q732 483 715 476C682 463 656 556 707 532L737 500M702 465L718 450L730 461M683 560L683 567",
      "M772 438L731 524Q722 560 773 531M747 456Q805 464 837 445",
      "M808 540C767 586 867 568 882 448L892 421L910 541L981 423Q1017 390 1005 431",
      "M988 485C955 458 928 551 960 538L999 483L976 535Q977 550 1016 520",
      "M1011 529L1036 483Q1061 470 1034 531Q1077 469 1081 494L1056 535Q1096 476 1105 493C1105 513 1050 556 1123 562Q1186 565 1175 505L1158 498"
    ] },
    { ink: "ivory", width: 29, paths: [
      "M682 603C680 566 735 577 710 617L677 656L716 657",
      "M765 583C735 581 712 665 746 656C771 653 794 574 765 583",
      "M827 579L794 668",
      "M831 597L860 580L835 653M817 658L854 658",
      "M886 599L914 581L891 655M873 659L909 659",
      "M549 648L638 648M945 651L1035 651"
    ] }
  ];

  function element(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  let cursor = 850;
  lines.forEach((line, index) => {
    const mask = element("mask", { id: `write-${index}`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 1546, height: 1017 });
    svg.querySelector("defs").append(mask);
    const lineStart = cursor;
    const glyphs = line.glyphs || [{ paths: line.paths }];
    glyphs.forEach((glyph, glyphIndex) => {
      let target = mask;
      if (glyph.bounds) {
        const [x, y, width, height] = glyph.bounds;
        const clipId = `glyph-${index}-${glyphIndex}`;
        const glyphClip = element("clipPath", { id: clipId });
        glyphClip.append(element("rect", { x, y, width, height }));
        svg.querySelector("defs").append(glyphClip);
        target = element("g", { "clip-path": `url(#${clipId})` });
        mask.append(target);
      }
      glyph.paths.forEach(d => {
        const path = element("path", { d, fill: "none", stroke: "white", "stroke-width": line.width, "stroke-linecap": "round", "stroke-linejoin": "round", filter: "url(#soft-tip)" });
        target.append(path);
        const length = path.getTotalLength();
        const duration = Math.max(line.glyphs ? 55 : 140, length * (line.speed || 2.65));
        path.style.strokeDasharray = `${length} ${length}`;
        path.style.strokeDashoffset = length;
        strokes.push({ path, length, start: cursor, duration });
        cursor += duration + (line.glyphs ? 18 : 35);
      });
      if (glyph.bounds) {
        const [x, y, width, height] = glyph.bounds;
        const finish = element("rect", { x, y, width, height, fill: "white", opacity: 0 });
        target.append(finish);
        sweeps.push({ node: finish, start: cursor - 40, duration: 140 });
        cursor += 115 + (glyph.pause || 0);
      }
    });
    if (!line.glyphs) {
      // A final soft pass catches accents and thin flourishes between pen strokes.
      const cleanup = element("rect", { x: 300, y: 130, width: 1040, height: 550, fill: "white", opacity: 0 });
      mask.append(cleanup);
      sweeps.push({ node: cleanup, start: cursor - 100, duration: 420 });
    }
    const clip = element("g", { "clip-path": `url(#line-${index})` });
    const ink = element("g", { mask: `url(#${line.ink}-ink)` });
    const image = element("use", { href: "#reference", mask: `url(#write-${index})` });
    ink.append(image);
    clip.append(ink);
    writing.append(clip);
    cursor = Math.max(cursor + 350, lineStart + 600);
  });
  const totalDuration = cursor + 450;

  function complete() {
    cancelAnimationFrame(frame);
    active = false;
    // Keep the new background; finish only the lettering, including when
    // reduced motion skips the animation. Never restore the old scene.
    strokes.forEach(stroke => { stroke.path.style.strokeDashoffset = 0; });
    sweeps.forEach(sweep => sweep.node.setAttribute("opacity", 1));
    tip.setAttribute("opacity", 0);
    scene.classList.add("is-complete");
    nextButton.hidden = false;
    status.textContent = "Chúc mừng ngày Nhà giáo Việt Nam 20/11. Gửi thầy cô, với tất cả lòng biết ơn.";
  }

  function draw(now) {
    if (!active) return;
    const elapsed = now - started;
    let current;
    for (const stroke of strokes) {
      const progress = Math.min(1, Math.max(0, (elapsed - stroke.start) / stroke.duration));
      stroke.path.style.strokeDashoffset = stroke.length * (1 - progress);
      if (progress > 0 && progress < 1) current = { ...stroke, progress };
    }
    for (const sweep of sweeps) sweep.node.setAttribute("opacity", Math.min(1, Math.max(0, (elapsed - sweep.start) / sweep.duration)));
    tip.setAttribute("opacity", current ? .8 : 0);
    if (current) {
      const point = current.path.getPointAtLength(current.length * current.progress);
      tip.setAttribute("transform", `translate(${point.x} ${point.y})`);
    }
    if (elapsed >= totalDuration) complete();
    else frame = requestAnimationFrame(draw);
  }

  function play() {
    cancelAnimationFrame(frame);
    scene.classList.remove("is-complete");
    nextButton.hidden = true;
    strokes.forEach(stroke => { stroke.path.style.strokeDashoffset = stroke.length; });
    sweeps.forEach(sweep => sweep.node.setAttribute("opacity", 0));
    status.textContent = "Đang viết lời chúc gửi thầy cô…";
    if (motion.matches) return complete();
    active = true;
    started = performance.now();
    pausedAt = null;
    syncPlayback();
  }

  // Keep the writing at its current position while the rotation notice is shown
  // or the tab is hidden, so the user sees the intro after turning the device.
  let pausedAt = null;
  function syncPlayback() {
    if (intro.getAttribute("aria-hidden") === "true") return;
    if (!active) return;
    cancelAnimationFrame(frame);
    if (document.hidden || portraitDevice.matches) {
      if (pausedAt === null) pausedAt = performance.now();
    } else {
      if (pausedAt !== null) started += performance.now() - pausedAt;
      pausedAt = null;
      frame = requestAnimationFrame(draw);
    }
  }
  document.addEventListener("visibilitychange", syncPlayback);
  portraitDevice.addEventListener("change", syncPlayback);
  syncPlayback();
  motion.addEventListener("change", () => { if (motion.matches && active) complete(); });

  const dust = document.querySelector("#dust");
  for (let i = 0; i < 18; i++) {
    const mote = document.createElement("i");
    mote.style.cssText = `left:${8 + Math.random() * 84}%;top:${12 + Math.random() * 80}%;--size:${1 + Math.random() * 2}px;--duration:${8 + Math.random() * 9}s;--delay:${-Math.random() * 18}s`;
    dust.append(mote);
  }

  // Prepare the board while the logo is visible; writing waits for the click.
  const referenceImage = new Image();
  referenceImage.src = document.querySelector("#reference").getAttribute("href");
  const images = [document.querySelector(".scene__background"), referenceImage];
  const imagesReady = Promise.all(images.map(img => img.decode().catch(() => {})));
  let requested = false;
  window.startIntro2011 = () => {
    if (requested) return;
    requested = true;
    imagesReady.then(play);
  };
})();
