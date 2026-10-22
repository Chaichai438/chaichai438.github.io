/* Click Start! page transition, adapted from transition-demo.html. */
(() => {
  'use strict';

  const duration = 1500;
  const coverProgress = .55;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layouts = {
    left: [[78,10,5],[69,15,-11],[65.7,12,-27],[64,14,10],[51,22,-4],
      [40,25,15],[36.7,23,38],[34,28,-12],[20,27,4],[9,43,-1]],
    right: [[74,11,-9],[68,12,7],[61,15,-26],[55,19,-3],[48,18,15],
      [39,24,-13],[33,26,27],[27,32,2],[22,30,-17],[10,42,11]]
  };
  const profiles = [
    { out: [82,1320], phase: .2, warp: .015 },
    { out: [67,1300], phase: 2.1, warp: -.022 },
    { out: [140,1290], phase: 3.7, warp: .02 },
    { out: [64,1310], phase: 4.4, warp: -.018 },
    { out: [62,1310], phase: 1.3, warp: .028 },
    { out: [34,1280], phase: 5.0, warp: -.025 },
    { out: [88,1280], phase: 2.6, warp: -.01 },
    { out: [36,1270], phase: 3.0, warp: -.018 },
    { out: [19,1250], phase: .9, warp: .024 },
    { out: [0,1240], phase: .2, warp: .015 },
    { out: [95,1310], phase: 2.8, warp: -.012 },
    { out: [92,1320], phase: .7, warp: .021 },
    { out: [73,1325], phase: 3.9, warp: .013 },
    { out: [64,1340], phase: 4.7, warp: -.026 },
    { out: [62,1330], phase: 1.6, warp: -.015 },
    { out: [55,1320], phase: 5.7, warp: .027 },
    { out: [54,1320], phase: 4.2, warp: -.02 },
    { out: [53,1320], phase: 3.6, warp: .011 },
    { out: [51,1320], phase: .4, warp: -.017 },
    { out: [18,1320], phase: 2.8, warp: -.012 }
  ];

  const state = {
    phase: 'idle', progress: 0, frame: 0, start: 0, exitStart: 0,
    cycle: 0, pending: null, oldBody: null, newBody: null,
    targetHref: '', watchdog: 0, error: false, swapped: false,
    nextHref: '', nextPending: null, nextError: false
  };
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const smoothstep = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
  const bubbleMarkup = side => layouts[side].map(([base, size, offset]) =>
    `<span class="cc-flow-bubble ${side}" style="--base:${base}%;--size:${size}px;--offset:${offset}px"></span>`
  ).join('');

  const layer = document.createElement('div');
  layer.id = 'cc-page-flow';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <div class="cc-flow-echo"></div>
    <div class="cc-flow-panel">
      <div class="cc-flow-inner">
        <div class="cc-flow-count">01 / 04</div>
        <div class="cc-flow-name">首页</div>
        <div class="cc-flow-sub">CLICK START! &nbsp; / &nbsp; TURN THE PAGE</div>
      </div>
    </div>
    <div class="cc-flow-bubbles">
      <div class="cc-flow-column left">${bubbleMarkup('left')}</div>
      <div class="cc-flow-column right">${bubbleMarkup('right')}</div>
    </div>`;
  document.body.appendChild(layer);

  const panel = layer.querySelector('.cc-flow-panel');
  const echo = layer.querySelector('.cc-flow-echo');
  const inner = layer.querySelector('.cc-flow-inner');
  const count = layer.querySelector('.cc-flow-count');
  const name = layer.querySelector('.cc-flow-name');
  const bubbles = [...layer.querySelectorAll('.cc-flow-bubble')].map((element, index) => ({
    element, row: index % 10, side: index < 10 ? 1 : -1, profile: profiles[index]
  }));

  function destination(href) {
    let path;
    try { path = new URL(href, location.href).pathname; }
    catch (_) { path = location.pathname; }
    if (path === '/') return ['01 / 04', '首页'];
    if (/^\/archives(?:\/|$)/.test(path)) return ['03 / 04', '归档'];
    if (/^\/about(?:\/|$)/.test(path)) return ['04 / 04', '关于'];
    if (/^\/categories(?:\/|$)/.test(path)) return ['INDEX', '分类'];
    if (/^\/tags(?:\/|$)/.test(path)) return ['INDEX', '标签'];
    if (/^\/link(?:\/|$)/.test(path)) return ['INDEX', '友链'];
    return ['02 / 04', '文章'];
  }

  function paintMask(progress) {
    const rise = smoothstep(progress / .35);
    const leave = smoothstep((progress - .55) / .45);
    const maskY = 105 * (1 - rise) - 105 * leave;
    const echoY = maskY + 5 * Math.sin(Math.PI * progress);
    panel.style.transform = `translate3d(0,${maskY.toFixed(3)}vh,0)`;
    echo.style.transform = `translate3d(0,${echoY.toFixed(3)}vh,0)`;
    const top = 45 * (1 - rise), bottom = 45 * leave;
    const topV = 8 * (1 - rise), bottomV = 8 * leave;
    const radius = `${top.toFixed(2)}% ${top.toFixed(2)}% ${bottom.toFixed(2)}% ${bottom.toFixed(2)}% / ${topV.toFixed(2)}% ${topV.toFixed(2)}% ${bottomV.toFixed(2)}% ${bottomV.toFixed(2)}%`;
    panel.style.borderRadius = radius;
    echo.style.borderRadius = radius;
    const labelIn = smoothstep((progress - .19) / .16);
    const labelOut = 1 - smoothstep((progress - .58) / .17);
    inner.style.opacity = (.78 * labelIn * labelOut).toFixed(3);
    inner.style.transform = `translateY(${(22 * (1 - labelIn) - 20 * (1 - labelOut)).toFixed(2)}px)`;
    return maskY;
  }

  function paintBubble(item, progress, maskY) {
    const { element, row, side, profile } = item;
    const [lag, pace] = profile.out;
    const elapsed = progress * duration;
    const t = clamp01((elapsed - lag) / pace);
    const envelope = Math.sin(Math.PI * progress);
    const phase = profile.phase + state.cycle * .47;
    const ripple = (.72 + row % 4 * .15) * envelope * Math.sin(2 * Math.PI * (.63 + row % 3 * .05) * t + phase * .76);
    const spine = side * envelope * (4 - 3 * Math.cos(2 * Math.PI * t + state.cycle * .31));
    const sway = spine + (5.3 + row % 3 * 1.8) * envelope * Math.sin(2 * Math.PI * (.78 + row % 4 * .04) * t + phase);
    const localRise = 7 * (smoothstep(t) - smoothstep(progress)) + profile.warp * 9 * envelope;
    const currentRise = maskY - 15 + 3 * smoothstep(progress / .35) - 2 * smoothstep((progress - .35) / .2);
    const y = currentRise + localRise + ripple;
    const leave = clamp01((progress - .55) / .45);
    const alpha = smoothstep(progress / .18) * (1 - smoothstep((leave - .28) / .54));
    element.style.transform = `translate3d(${sway.toFixed(2)}px,${y.toFixed(3)}vh,0)`;
    element.style.opacity = (.62 * alpha).toFixed(3);
  }

  function paintContent(progress) {
    if (!state.newBody) return;
    const appear = smoothstep((progress - .55) / .30);
    state.newBody.style.setProperty('--cc-flow-content-opacity', appear.toFixed(3));
    state.newBody.style.setProperty('--cc-flow-content-y', `${(22 * (1 - appear)).toFixed(2)}px`);
    state.newBody.style.setProperty('--cc-flow-content-blur', `${(6 * (1 - appear)).toFixed(2)}px`);
  }

  function paint(progress) {
    state.progress = progress;
    const maskY = paintMask(progress);
    bubbles.forEach(item => paintBubble(item, progress, maskY));
    paintContent(progress);
  }

  function clearWatchdog() {
    if (state.watchdog) clearTimeout(state.watchdog);
    state.watchdog = 0;
  }

  function finish() {
    const nextHref = state.nextHref;
    const nextPending = state.nextPending;
    const nextError = state.nextError;
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    clearWatchdog();
    paint(1);
    layer.classList.remove('is-running');
    if (state.oldBody) state.oldBody.classList.remove('cc-flow-outgoing');
    if (state.newBody) {
      state.newBody.classList.remove('cc-flow-entering');
      ['--cc-flow-content-opacity', '--cc-flow-content-y', '--cc-flow-content-blur']
        .forEach(property => state.newBody.style.removeProperty(property));
    }
    bubbles.forEach(({ element }) => {
      element.style.removeProperty('transform');
      element.style.removeProperty('opacity');
    });
    [panel, echo].forEach(element => {
      element.style.removeProperty('transform');
      element.style.removeProperty('border-radius');
    });
    inner.style.removeProperty('transform');
    inner.style.removeProperty('opacity');
    state.phase = 'idle';
    state.pending = null;
    state.oldBody = null;
    state.newBody = null;
    state.error = false;
    state.swapped = false;
    state.nextHref = '';
    state.nextPending = null;
    state.nextError = false;
    if (nextHref) {
      begin(nextHref);
      state.pending = nextPending;
      state.error = nextError;
    }
  }

  function stepExit(now) {
    if (state.phase !== 'exiting') return;
    const progress = coverProgress + (1 - coverProgress) * clamp01((now - state.exitStart) / (duration * (1 - coverProgress)));
    paint(progress);
    if (progress >= 1) finish();
    else state.frame = requestAnimationFrame(stepExit);
  }

  function beginExit() {
    if (state.phase !== 'covered') return;
    clearWatchdog();
    state.phase = 'exiting';
    state.exitStart = performance.now();
    state.frame = requestAnimationFrame(stepExit);
  }

  function releaseResponse() {
    const response = state.pending;
    state.pending = null;
    if (response) response.original.apply(response.context, response.args);
  }

  function stepRise(now) {
    if (state.phase !== 'rising') return;
    const progress = Math.min(coverProgress, Math.max(0, now - state.start) / duration);
    paint(progress);
    if (progress < coverProgress) {
      state.frame = requestAnimationFrame(stepRise);
    } else {
      state.phase = 'covered';
      if (state.pending) releaseResponse();
      else if (state.error || state.swapped) beginExit();
    }
  }

  function begin(href) {
    cancelAnimationFrame(state.frame);
    clearWatchdog();
    state.phase = 'rising';
    state.progress = 0;
    state.pending = null;
    state.error = false;
    state.swapped = false;
    state.nextHref = '';
    state.nextPending = null;
    state.nextError = false;
    state.cycle += 1;
    state.targetHref = href || location.href;
    const [index, title] = destination(state.targetHref);
    count.textContent = index;
    name.textContent = title;
    state.oldBody = document.getElementById('body-wrap');
    state.newBody = null;
    paint(0);
    layer.classList.add('is-running');
    if (state.oldBody) state.oldBody.classList.add('cc-flow-outgoing');
    state.start = performance.now();
    state.frame = requestAnimationFrame(stepRise);
    state.watchdog = setTimeout(() => {
      if (state.phase === 'rising' || state.phase === 'covered') {
        window.location.assign(state.targetHref);
      }
    }, 15000);
  }

  let installed = false;
  function installPjax() {
    if (installed) return true;
    const pjax = window.pjax;
    if (!pjax || typeof pjax.handleResponse !== 'function') return false;
    installed = true;
    const originalRequest = pjax.doRequest;
    if (typeof originalRequest === 'function') {
      pjax.doRequest = function (href, ...args) {
        if (!reducedMotion.matches && state.phase !== 'idle') {
          if (state.phase === 'exiting' && state.nextHref) state.nextHref = href;
          else state.targetHref = href;
          const [index, title] = destination(href);
          count.textContent = index;
          name.textContent = title;
        }
        return originalRequest.call(this, href, ...args);
      };
    }
    const original = pjax.handleResponse;
    pjax.handleResponse = function (...args) {
      if (state.phase === 'idle' || args[0] === null) {
        return original.apply(this, args);
      }
      if (reducedMotion.matches && state.phase === 'rising') {
        cancelAnimationFrame(state.frame);
        state.frame = 0;
        paint(coverProgress);
        state.phase = 'covered';
      }
      if (reducedMotion.matches) return original.apply(this, args);
      if (state.phase === 'exiting' && state.nextHref) {
        state.nextPending = { original, context: this, args };
        return;
      }
      if (state.phase === 'rising') {
        state.pending = { original, context: this, args };
        return;
      }
      return original.apply(this, args);
    };

    document.addEventListener('pjax:send', event => {
      if (reducedMotion.matches) return;
      const href = event.options?.url || document.activeElement?.href || location.href;
      if (state.phase === 'idle') begin(href);
      else if (state.phase === 'exiting') {
        state.nextHref = href;
        state.nextPending = null;
        state.nextError = false;
      }
      else {
        state.pending = null;
        state.error = false;
        state.swapped = false;
        state.targetHref = href;
        const [index, title] = destination(href);
        count.textContent = index;
        name.textContent = title;
      }
    });
    document.addEventListener('pjax:success', () => {
      if (state.phase === 'idle') return;
      state.swapped = true;
      state.newBody = document.getElementById('body-wrap');
      if (state.newBody) state.newBody.classList.add('cc-flow-entering');
      paintContent(coverProgress);
      if (reducedMotion.matches) finish();
      else beginExit();
    });
    document.addEventListener('pjax:error', () => {
      if (state.phase === 'idle') return;
      if (state.phase === 'exiting' && state.nextHref) {
        state.nextError = true;
        return;
      }
      state.pending = null;
      state.error = true;
      if (reducedMotion.matches) { finish(); return; }
      if (state.phase === 'covered') {
        // Butterfly may start its /404/ request in a later listener for this event.
        setTimeout(() => { if (state.phase === 'covered' && state.error) beginExit(); }, 0);
      }
    });
    if (typeof reducedMotion.addEventListener === 'function') {
      reducedMotion.addEventListener('change', () => {
        if (!reducedMotion.matches) return;
        if (state.phase === 'rising') {
          cancelAnimationFrame(state.frame);
          state.frame = 0;
          paint(coverProgress);
          state.phase = 'covered';
          if (state.pending) releaseResponse();
        } else if (state.phase === 'exiting') finish();
      });
    }
    return true;
  }

  function waitForPjax(attempts = 120) {
    if (installPjax() || attempts <= 0) return;
    setTimeout(() => waitForPjax(attempts - 1), 16);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForPjax(), { once: true });
  } else waitForPjax();
})();
