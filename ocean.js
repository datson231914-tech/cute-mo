/* Dựng khung cảnh đại dương động. Ocean.build({ lite: true }) cho điện thoại. */
(function () {
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const waveSVG = (fill) =>
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 60' preserveAspectRatio='none'><path d='M0 30 Q100 0 200 30 T400 30 T600 30 T800 30 V0 H0 Z' fill='${fill}'/></svg>`
    )}")`;

  function fishSVG(color, w) {
    const h = w * 0.55;
    return `<svg width="${w}" height="${h}" viewBox="0 0 100 55">
      <path d="M78 27 L100 8 L96 27 L100 46 Z" fill="${color}" opacity=".85"/>
      <ellipse cx="45" cy="27" rx="38" ry="20" fill="${color}"/>
      <path d="M35 8 Q48 -2 60 9" fill="${color}" opacity=".8"/>
      <path d="M40 30 Q50 40 58 30" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
      <path d="M52 10 Q60 27 52 44" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="3"/>
      <circle cx="20" cy="22" r="5" fill="#fff"/><circle cx="19" cy="22" r="2.6" fill="#0a1f33"/>
    </svg>`;
  }

  function jellySVG(w) {
    const h = w * 1.6;
    let tentacles = "";
    for (let i = 0; i < 5; i++) {
      const x = 22 + i * 14;
      tentacles += `<path d="M${x} 48 q-6 18 0 34 q6 18 0 36" fill="none" stroke="rgba(255,190,240,.55)" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    return `<svg width="${w}" height="${h}" viewBox="0 0 100 160">
      <defs><radialGradient id="jg" cx="50%" cy="35%" r="60%">
        <stop offset="0" stop-color="rgba(255,220,250,.95)"/><stop offset="1" stop-color="rgba(220,120,230,.35)"/>
      </radialGradient></defs>
      ${tentacles}
      <path d="M10 50 Q10 5 50 5 Q90 5 90 50 Q80 44 70 50 Q60 44 50 50 Q40 44 30 50 Q20 44 10 50 Z" fill="url(#jg)"/>
      <ellipse cx="38" cy="22" rx="10" ry="6" fill="rgba(255,255,255,.5)"/>
    </svg>`;
  }

  function weedSVG(h, color) {
    const w = h * 0.25;
    const segs = 6;
    let d = `M${w / 2} ${h}`;
    for (let i = 1; i <= segs; i++) {
      const y = h - (h / segs) * i;
      const x = w / 2 + (i % 2 ? w * 0.35 : -w * 0.35);
      d += ` Q${x} ${y + h / segs / 2} ${w / 2} ${y}`;
    }
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
      <path d="${d}" fill="none" stroke="${color}" stroke-width="${Math.max(6, w * 0.22)}" stroke-linecap="round"/>
    </svg>`;
  }

  function coralSVG(s, color) {
    return `<svg width="${s}" height="${s}" viewBox="0 0 100 100">
      <g fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round">
        <path d="M50 100 V55 M50 70 Q30 60 28 35 M50 62 Q70 55 72 28 M28 45 Q15 40 14 25 M72 40 Q86 36 86 20 M50 55 V22"/>
      </g></svg>`;
  }

  function starSVG(s, color) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 18 : 46;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
    }
    return `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><polygon points="${pts.join(" ")}" fill="${color}" stroke="rgba(0,0,0,.15)" stroke-width="3" stroke-linejoin="round"/></svg>`;
  }

  function build(opts = {}) {
    const lite = !!opts.lite;
    const root = document.createElement("div");
    root.className = "ocean";
    root.setAttribute("aria-hidden", "true");

    // Mặt nước
    const surface = document.createElement("div");
    surface.className = "surface";
    root.appendChild(surface);
    ["w1", "w2"].forEach((c, i) => {
      const w = document.createElement("div");
      w.className = "wave " + c;
      w.style.backgroundImage = waveSVG(i ? "rgba(255,255,255,0.5)" : "rgba(210,248,255,0.7)");
      root.appendChild(w);
    });

    const caustics = document.createElement("div");
    caustics.className = "caustics";
    root.appendChild(caustics);

    // Tia nắng
    const rays = lite ? 3 : 6;
    for (let i = 0; i < rays; i++) {
      const r = document.createElement("div");
      r.className = "ray";
      r.style.left = `${(i + 0.5) * (100 / rays) + rand(-5, 5)}%`;
      r.style.setProperty("--r", `${rand(-18, 8)}deg`);
      r.style.animationDelay = `${-rand(0, 9)}s`;
      root.appendChild(r);
    }

    // Sứa
    if (!lite) {
      [[8, 30, 70], [86, 42, 55], [64, 18, 40]].forEach(([x, y, w], i) => {
        const j = document.createElement("div");
        j.className = "jelly";
        j.style.left = x + "%";
        j.style.top = y + "%";
        j.style.animationDuration = `${rand(6, 9)}s`;
        j.style.animationDelay = `${-i * 2}s`;
        j.innerHTML = jellySVG(w);
        root.appendChild(j);
      });
    }

    // Cá
    const fishColors = ["#ffb347", "#ff7f6e", "#ffd86b", "#7ef0d0", "#9fc6ff", "#f7a8ff"];
    const fishCount = lite ? 3 : 7;
    for (let i = 0; i < fishCount; i++) {
      const f = document.createElement("div");
      f.className = "fish" + (Math.random() < 0.5 ? " rtl" : "");
      f.style.top = `${rand(15, 72)}%`;
      const dur = rand(22, 40);
      f.style.animationDuration = `${dur}s`;
      f.style.animationDelay = `${-rand(0, dur)}s`;
      const w = rand(40, 90);
      f.style.opacity = (0.45 + w / 200).toFixed(2);
      f.innerHTML = fishSVG(pick(fishColors), w);
      root.appendChild(f);
    }

    // Bọt nền
    const miniCount = lite ? 14 : 30;
    for (let i = 0; i < miniCount; i++) {
      const b = document.createElement("div");
      b.className = "mini";
      const s = rand(4, 16);
      b.style.width = b.style.height = s + "px";
      b.style.left = `${rand(0, 100)}%`;
      b.style.setProperty("--sx", `${rand(-40, 40)}px`);
      const dur = rand(9, 20);
      b.style.animationDuration = `${dur}s`;
      b.style.animationDelay = `${-rand(0, dur)}s`;
      root.appendChild(b);
    }

    // Đáy biển
    const bed = document.createElement("div");
    bed.className = "seabed";
    bed.innerHTML = `<svg class="sand" viewBox="0 0 1000 200" preserveAspectRatio="none">
        <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c9a66b"/><stop offset="1" stop-color="#6b5530"/></linearGradient></defs>
        <path d="M0 150 Q150 110 300 140 T600 135 T1000 120 V200 H0 Z" fill="#3d5a6b" opacity=".5"/>
        <path d="M0 170 Q200 140 420 165 T800 155 T1000 160 V200 H0 Z" fill="url(#sg)" opacity=".75"/>
      </svg>`;
    const weedColors = ["#2fbf8f", "#1f9e78", "#4fd1a0", "#2a8f6a"];
    const weeds = lite ? 6 : 14;
    for (let i = 0; i < weeds; i++) {
      const w = document.createElement("div");
      w.className = "weed";
      const h = rand(80, lite ? 160 : 240);
      w.style.left = `${rand(0, 98)}%`;
      w.style.animationDuration = `${rand(3, 6)}s`;
      w.style.animationDelay = `${-rand(0, 5)}s`;
      w.innerHTML = weedSVG(h, pick(weedColors));
      bed.appendChild(w);
    }
    const corals = lite ? [[6, 60], [90, 70]] : [[4, 90], [18, 60], [80, 100], [93, 70], [55, 55]];
    corals.forEach(([x, s]) => {
      const c = document.createElement("div");
      c.style.cssText = `position:absolute;left:${x}%;bottom:2vh;`;
      c.innerHTML = coralSVG(s, pick(["#ff8a7a", "#ff6f91", "#ffa36c"]));
      bed.appendChild(c);
    });
    [[30, 34, -15], [70, 28, 20]].forEach(([x, s, r]) => {
      const st = document.createElement("div");
      st.style.cssText = `position:absolute;left:${x}%;bottom:1.5vh;transform:rotate(${r}deg);`;
      st.innerHTML = starSVG(s, pick(["#ffb347", "#ff7f6e"]));
      bed.appendChild(st);
    });
    root.appendChild(bed);

    const vig = document.createElement("div");
    vig.className = "vignette";
    root.appendChild(vig);

    document.body.prepend(root);
    return root;
  }

  window.Ocean = { build };
})();
