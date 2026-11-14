
(() => {
  const parseColor = (c) => {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,\\s\\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };

  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  });
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const gradientColor = (image) => {
    if (!image || image === 'none') return null;
    const m = String(image).match(/rgba?\\([^)]+\\)/);
    return m ? parseColor(m[0]) : null;
  };

  // Warna latar yang benar-benar terlihat: susun bertumpuk dari akar ke elemen,
  // memperhitungkan background-color DAN gradien.
  const bgStackOf = (el) => {
    const chain = [];
    let node = el;
    while (node) {
      chain.push(node);
      node = node.parentElement;
    }
    chain.reverse();
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (const node of chain) {
      const s = getComputedStyle(node);
      let c = parseColor(s.backgroundColor);
      if ((!c || c.a === 0) && s.backgroundImage && s.backgroundImage !== 'none') {
        c = gradientColor(s.backgroundImage);
      }
      if (c && c.a > 0) acc = over(c, acc);
    }
    return acc;
  };

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.15) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className.slice(0, 60) : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls.split(/\\s+/).slice(0, 2).join('.') : '');
  };

  const problems = { contrast: [], overlap: [], overflow: [], border: [], faint: [] };

  // ---- 1. Kontras teks ----
  const textEls = [];
  document.querySelectorAll('*').forEach((el) => {
    if (!visible(el)) return;
    const hasOwnText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 1
    );
    if (hasOwnText) textEls.push(el);
  });

  textEls.forEach((el) => {
    const s = getComputedStyle(el);
    const fg = parseColor(s.color);
    if (!fg) return;
    const bg = bgStackOf(el);
    const composed = fg.a < 1 ? over(fg, bg) : fg;
    const r = ratio(composed, bg);
    const size = parseFloat(s.fontSize);
    const weight = parseInt(s.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (r < need) {
      problems.contrast.push({
        el: label(el),
        text: (el.textContent || '').trim().slice(0, 40),
        color: s.color,
        bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')',
        ratio: Math.round(r * 100) / 100,
        need,
        size: Math.round(size)
      });
    }
    if (r < 1.6) {
      problems.faint.push({
        el: label(el),
        text: (el.textContent || '').trim().slice(0, 40),
        color: s.color,
        bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')',
        ratio: Math.round(r * 100) / 100
      });
    }
  });

  // ---- 2. Tumpang tindih elemen interaktif ----
  const clickable = [...document.querySelectorAll('button, a, input, select, [role="button"]')].filter(visible);
  const zOf = (el) => {
    let z = 0, node = el;
    while (node) {
      const s = getComputedStyle(node);
      if (s.position !== 'static' && s.zIndex !== 'auto') z = Math.max(z, parseInt(s.zIndex, 10) || 0);
      node = node.parentElement;
    }
    return z;
  };
  const rects = clickable.map((el) => ({ el, r: el.getBoundingClientRect(), z: zOf(el) }));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox > 3 && oy > 3) {
        problems.overlap.push({
          a: label(a.el), b: label(b.el), za: a.z, zb: b.z,
          area: Math.round(ox * oy),
          aText: (a.el.textContent || a.el.getAttribute('aria-label') || '').trim().slice(0, 22),
          bText: (b.el.textContent || b.el.getAttribute('aria-label') || '').trim().slice(0, 22)
        });
      }
    }
  }

  // ---- 3. Elemen yang keluar viewport ----
  const vw = document.documentElement.clientWidth;
  document.querySelectorAll('*').forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    const scroller = el.closest('.custom-scrollbar, .no-scrollbar, [class*="overflow-x"]');
    if (scroller && scroller !== el) return;
    if (r.right > vw + 2 || r.left < -2) {
      problems.overflow.push({ el: label(el), left: Math.round(r.left), right: Math.round(r.right), vw });
    }
  });

  // ---- 4. Border yang warnanya tidak cocok dengan mode ----
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelectorAll('*').forEach((el) => {
    if (!visible(el)) return;
    const s = getComputedStyle(el);
    const w = parseFloat(s.borderTopWidth);
    if (!w) return;
    const c = parseColor(s.borderTopColor);
    if (!c || c.a < 0.05) return;
    const l = lum(c);
    if (isDark && l > 0.5) {
      problems.border.push({ el: label(el), color: s.borderTopColor, issue: 'border terang di mode gelap' });
    }
    if (!isDark && l < 0.03) {
      problems.border.push({ el: label(el), color: s.borderTopColor, issue: 'border sangat gelap di mode terang' });
    }
  });

  const dedupe = (arr, key) => {
    const seen = new Set();
    return arr.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
  };

  return JSON.stringify({
    mode: document.documentElement.getAttribute('data-theme'),
    width: vw,
    textCount: textEls.length,
    contrastCount: problems.contrast.length,
    contrast: dedupe(problems.contrast, (x) => x.el + x.color).slice(0, 30),
    faint: dedupe(problems.faint, (x) => x.el + x.color).slice(0, 15),
    overlapCount: problems.overlap.length,
    overlap: dedupe(problems.overlap, (x) => x.a + x.b).slice(0, 20),
    overflow: dedupe(problems.overflow, (x) => x.el).slice(0, 15),
    borderCount: problems.border.length,
    border: dedupe(problems.border, (x) => x.el + x.color).slice(0, 20)
  });
})()
