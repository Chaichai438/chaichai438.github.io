/* Blue ambient background and cursor, adapted from the approved standalone demo. */
(() => {
  'use strict';
  if (document.getElementById('cc-ambient')) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fineQuery = matchMedia('(hover: hover) and (pointer: fine)');
  const ambient = document.createElement('div');
  ambient.id = 'cc-ambient';
  ambient.setAttribute('aria-hidden', 'true');
  ambient.innerHTML = `
    <div class="cc-ambient-wash"><i></i><i></i><i></i></div>
    <div class="cc-ambient-grid"></div>
    <div class="cc-ambient-words"><span>CLICK START</span><span>EXPLORE MORE</span></div>
    <div class="cc-ambient-rings"><i></i><i></i><i></i></div>
    <div class="cc-ambient-geom"><i></i><i></i><i></i><i></i><i></i></div>
    <canvas class="cc-ambient-dots"></canvas>
    <div class="cc-ambient-edge"></div>`;
  document.body.insertBefore(ambient, document.body.firstChild);

  const cursor = document.createElement('div');
  cursor.id = 'cc-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<span class="cc-cursor-ring"></span><span class="cc-cursor-dot"></span><span class="cc-cursor-label"></span>';
  document.body.appendChild(cursor);
  document.body.classList.add('cc-ambient-enabled');

  const grid = ambient.querySelector('.cc-ambient-grid');
  const words = ambient.querySelector('.cc-ambient-words');
  const wash = ambient.querySelector('.cc-ambient-wash');
  const canvas = ambient.querySelector('.cc-ambient-dots');
  const ctx = canvas.getContext('2d');
  const dot = cursor.querySelector('.cc-cursor-dot');
  const ring = cursor.querySelector('.cc-cursor-ring');
  const label = cursor.querySelector('.cc-cursor-label');
  const pointer = { x: -1000, y: -1000 };
  const flowTarget = { x: -1000, y: -1000 };
  const parallax = { scroll: scrollY, targetScroll: scrollY, x: 0, y: 0, targetX: 0, targetY: 0 };
  const nearBins = [[], [], [], []];
  const palettes = {
    light: {
      base: 'rgba(62,119,183,.22)',
      near: ['rgba(42,108,223,.30)', 'rgba(42,108,223,.40)', 'rgba(42,108,223,.53)', 'rgba(42,108,223,.67)']
    },
    dark: {
      base: 'rgba(145,190,242,.25)',
      near: ['rgba(131,192,255,.33)', 'rgba(131,192,255,.45)', 'rgba(131,192,255,.58)', 'rgba(131,192,255,.72)']
    }
  };
  let palette = document.documentElement.dataset.theme === 'dark' ? palettes.dark : palettes.light;
  let width = 0, height = 0, dpr = 1, gap = 36, frameId = 0, lastFrame = 0, resizeTimer = 0;
  let columns = [], rows = [], columnWave = new Float32Array(), rowWave = new Float32Array(), rowSway = new Float32Array();
  let targetX = -100, targetY = -100, dotX = -100, dotY = -100, ringX = -100, ringY = -100;
  let active = false, editing = false;

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    gap = width < 720 ? 40 : 36;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    columns = [];
    rows = [];
    for (let x = gap / 2; x < width + gap; x += gap) columns.push(x);
    for (let y = gap / 2; y < height + gap; y += gap) rows.push(y);
    columnWave = new Float32Array(columns.length);
    rowWave = new Float32Array(rows.length);
    rowSway = new Float32Array(rows.length);
    paintDots(reduced.matches ? 0 : performance.now());
  }

  function paintDots(now) {
    if (document.body.classList.contains('read-mode')) return;
    const time = reduced.matches ? 0 : now * .001;
    const offset = (parallax.scroll * .055) % gap;
    for (let c = 0; c < columns.length; c++) columnWave[c] = Math.sin(columns[c] * .013 + time * .75);
    for (let r = 0; r < rows.length; r++) {
      rowWave[r] = Math.cos((rows[r] - offset) * .01 + time * .45);
      rowSway[r] = Math.sin((rows[r] - offset) * .012 + time * .5) * 2.6;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = palette.base;
    ctx.beginPath();
    for (const bin of nearBins) bin.length = 0;
    const interactive = fineQuery.matches && !reduced.matches && pointer.x > -500;
    for (let r = 0; r < rows.length; r++) {
      const baseY = rows[r] - offset, side = rowSway[r], wave = rowWave[r];
      if (baseY < -gap || baseY > height + gap) continue;
      for (let c = 0; c < columns.length; c++) {
        let x = columns[c] + side, y = baseY + columnWave[c] * wave * 5.6;
        if (interactive) {
          const dx = x - pointer.x, dy = y - pointer.y;
          if (Math.abs(dx) < 155 && Math.abs(dy) < 155) {
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < 24025) {
              const distance = Math.sqrt(distanceSquared) || 1;
              const strength = 1 - distance / 155;
              x += dx / distance * strength * 25;
              y += dy / distance * strength * 25;
              nearBins[Math.min(3, Math.floor(strength * 4))].push(x, y);
              continue;
            }
          }
        }
        ctx.rect(x - .75, y - .75, 1.5, 1.5);
      }
    }
    ctx.fill();
    for (let b = 0; b < nearBins.length; b++) {
      const points = nearBins[b];
      if (!points.length) continue;
      const size = 1.8 + b * .65;
      ctx.fillStyle = palette.near[b];
      ctx.beginPath();
      for (let i = 0; i < points.length; i += 2) {
        ctx.rect(points[i] - size / 2, points[i + 1] - size / 2, size, size);
      }
      ctx.fill();
    }
  }

  function ensureFrame() {
    if (!frameId && !document.hidden && !reduced.matches) frameId = requestAnimationFrame(frame);
  }

  function frame(now) {
    frameId = 0;
    if (document.hidden || reduced.matches) return;
    const dt = Math.min(64, Math.max(1, lastFrame ? now - lastFrame : 16.7));
    lastFrame = now;
    const backgroundOn = !document.body.classList.contains('read-mode');
    const cursorOn = fineQuery.matches && active && !editing && backgroundOn;
    if (backgroundOn) {
      const scrollEase = 1 - Math.exp(-dt / 170);
      const washEase = 1 - Math.exp(-dt / 540);
      parallax.scroll += (parallax.targetScroll - parallax.scroll) * scrollEase;
      parallax.x += (parallax.targetX - parallax.x) * washEase;
      parallax.y += (parallax.targetY - parallax.y) * washEase;
      grid.style.transform = `translate3d(0,${-(parallax.scroll * .08 % 82)}px,0)`;
      words.style.transform = `translate3d(0,${-parallax.scroll * .09}px,0)`;
      wash.style.transform = `translate3d(${parallax.x}px,${parallax.y}px,0)`;
      if (flowTarget.x > -500) {
        const flowEase = 1 - Math.exp(-dt / 85);
        pointer.x += (flowTarget.x - pointer.x) * flowEase;
        pointer.y += (flowTarget.y - pointer.y) * flowEase;
      }
      paintDots(now);
    }
    if (cursorOn) {
      const dotEase = 1 - Math.exp(-dt / 26);
      const ringEase = 1 - Math.exp(-dt / 96);
      dotX += (targetX - dotX) * dotEase;
      dotY += (targetY - dotY) * dotEase;
      ringX += (targetX - ringX) * ringEase;
      ringY += (targetY - ringY) * ringEase;
      dot.style.transform = `translate3d(${dotX}px,${dotY}px,0) translate(-50%,-50%)`;
      ring.style.transform = `translate3d(${ringX}px,${ringY}px,0) translate(-50%,-50%)`;
      label.style.transform = ring.style.transform;
    }
    if (backgroundOn || cursorOn) ensureFrame();
  }

  function updateCursorMode() {
    const on = fineQuery.matches && !reduced.matches;
    document.body.classList.toggle('cc-cursor-enabled', on);
    if (!on) cursor.style.opacity = '0';
    else if (active && !editing && !document.body.classList.contains('read-mode')) cursor.style.opacity = '1';
    ensureFrame();
  }

  resize();
  updateCursorMode();
  ensureFrame();

  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); ensureFrame(); }, 100);
  }, { passive: true });
  addEventListener('scroll', () => {
    parallax.targetScroll = scrollY;
    ensureFrame();
  }, { passive: true });
  addEventListener('pointermove', event => {
    if (!fineQuery.matches || reduced.matches) return;
    targetX = event.clientX;
    targetY = event.clientY;
    flowTarget.x = event.clientX;
    flowTarget.y = event.clientY;
    if (!active) {
      dotX = ringX = pointer.x = event.clientX;
      dotY = ringY = pointer.y = event.clientY;
      cursor.style.opacity = editing || document.body.classList.contains('read-mode') ? '0' : '1';
    }
    active = true;
    parallax.targetX = (event.clientX / innerWidth - .5) * 24;
    parallax.targetY = (event.clientY / innerHeight - .5) * 15;
    ensureFrame();
  }, { passive: true });
  document.addEventListener('pointerover', event => {
    const target = event.target;
    editing = !!target.closest?.('input, textarea, select, [contenteditable], [role="textbox"]');
    const hot = !editing && target.closest?.('a, button, [role="button"]');
    const titled = !editing && target.closest?.('[data-cursor]');
    cursor.classList.toggle('cc-hot', !!hot);
    label.textContent = titled?.dataset.cursor || (hot ? 'OPEN' : '');
    cursor.style.opacity = active && !editing && !reduced.matches && !document.body.classList.contains('read-mode') ? '1' : '0';
    ensureFrame();
  });
  addEventListener('pointerout', event => {
    if (event.relatedTarget) return;
    active = false;
    pointer.x = pointer.y = flowTarget.x = flowTarget.y = -1000;
    cursor.style.opacity = '0';
  });
  addEventListener('blur', () => {
    active = false;
    pointer.x = pointer.y = flowTarget.x = flowTarget.y = -1000;
    cursor.style.opacity = '0';
  });
  addEventListener('pointerdown', event => {
    if (!fineQuery.matches || reduced.matches || editing || document.body.classList.contains('read-mode')) return;
    cursor.classList.add('cc-pressed');
    const ripple = document.createElement('i');
    ripple.className = 'cc-cursor-ripple';
    ripple.style.left = event.clientX + 'px';
    ripple.style.top = event.clientY + 'px';
    ripple.style.transform = 'translate(-50%,-50%)';
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });
  addEventListener('pointerup', () => cursor.classList.remove('cc-pressed'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      lastFrame = 0;
    } else ensureFrame();
  });
  reduced.addEventListener?.('change', () => {
    updateCursorMode();
    if (reduced.matches) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      lastFrame = 0;
      parallax.scroll = parallax.targetScroll = scrollY;
      pointer.x = pointer.y = -1000;
      paintDots(0);
    } else ensureFrame();
  });
  fineQuery.addEventListener?.('change', updateCursorMode);
  new MutationObserver(() => {
    palette = document.documentElement.dataset.theme === 'dark' ? palettes.dark : palettes.light;
    if (reduced.matches) paintDots(0);
    else ensureFrame();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new MutationObserver(() => {
    if (document.body.classList.contains('read-mode')) cursor.style.opacity = '0';
    else {
      if (active && !editing && fineQuery.matches && !reduced.matches) cursor.style.opacity = '1';
      ensureFrame();
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
