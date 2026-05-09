/* ============================================================
   C PIZZA — js/app.js
   Lenis + GSAP ScrollTrigger + Canvas Frame Player
   Maképé Saint Tropez · Douala
   ============================================================ */

// ── CONFIG ──────────────────────────────────────────────────
const FRAME_COUNT       = 121;
const FRAME_EXT         = 'jpg';
const FRAME_DIR         = 'frames/';
const FRAME_SPEED       = 2.0;   // oven open animation done at ~55% scroll
const IMAGE_SCALE       = 0.90;  // slight padding so oven breathes
const BG_DEFAULT        = '#100D08';

// Dark overlay: active during stats section (46–64%)
const OVERLAY_ENTER     = 0.44;
const OVERLAY_LEAVE     = 0.66;

// Fire glow: peaks when oven is fully open (~55% scroll)
const GLOW_START        = 0.35;
const GLOW_PEAK         = 0.55;
const GLOW_END          = 0.70;

// ── STATE ────────────────────────────────────────────────────
const frames = new Array(FRAME_COUNT);
let currentFrame = 0;
let sampledBg    = BG_DEFAULT;
let lenis;

// ── DOM ──────────────────────────────────────────────────────
const canvas      = document.getElementById('canvas');
const ctx         = canvas.getContext('2d');
const canvasWrap  = document.getElementById('canvas-wrap');
const fireGlow    = document.getElementById('fire-glow');
const darkOverlay = document.getElementById('dark-overlay');
const loader      = document.getElementById('loader');
const loaderBar   = document.getElementById('loader-bar');
const loaderPct   = document.getElementById('loader-percent');
const scrollCont  = document.getElementById('scroll-container');
const header      = document.querySelector('.site-header');

// ── DYNAMIC YEAR ─────────────────────────────────────────────
document.querySelectorAll('.year').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// ── CANVAS SETUP ─────────────────────────────────────────────
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const W   = window.innerWidth;
  const H   = window.innerHeight;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  drawFrame(currentFrame);
}

// Sample a background color from the image edge pixels
function sampleBg(img) {
  try {
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = 4;
    const c = tmp.getContext('2d');
    c.drawImage(img, 0, 0, 4, 4);
    const d = c.getImageData(0, 0, 1, 1).data;
    return `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch (_) {
    return BG_DEFAULT;
  }
}

function drawFrame(index) {
  const img = frames[index];
  if (!img || !img.complete || !img.naturalWidth) return;

  const W  = window.innerWidth;
  const H  = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  // Padded-cover: fills canvas but slightly smaller than pure cover
  const scale = Math.max(W / iw, H / ih) * IMAGE_SCALE;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;

  ctx.fillStyle = sampledBg;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ── FRAME PRELOADER ───────────────────────────────────────────
function preloadFrames() {
  return new Promise((resolve) => {
    let loaded = 0;

    function onLoad(img, i) {
      loaded++;
      // Re-sample background color periodically
      if (i % 15 === 0) sampledBg = sampleBg(img);

      const pct = Math.round((loaded / FRAME_COUNT) * 100);
      loaderBar.style.width = pct + '%';
      loaderPct.textContent = pct + '%';

      // First frame: draw immediately for fast first paint
      if (loaded === 1) drawFrame(0);

      if (loaded === FRAME_COUNT) resolve();
    }

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      const idx = i - 1;
      img.src = FRAME_DIR + 'frame_' + String(i).padStart(4, '0') + '.' + FRAME_EXT;
      img.onload  = () => { frames[idx] = img; onLoad(img, i); };
      img.onerror = () => { frames[idx] = img; onLoad(img, i); };
    }
  });
}

// ── LENIS SMOOTH SCROLL ───────────────────────────────────────
function initLenis() {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ── HERO CIRCLE-WIPE TRANSITION ───────────────────────────────
function initHeroTransition() {
  const hero = document.querySelector('.hero-standalone');
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p = self.progress;
      // Hero fades out quickly as scroll begins
      hero.style.opacity = Math.max(0, 1 - p * 18).toString();
      // Canvas circle-wipe opens
      const wp = Math.min(1, Math.max(0, (p - 0.01) / 0.07));
      canvasWrap.style.clipPath = `circle(${wp * 75}% at 50% 50%)`;
    },
  });
}

// ── FRAME-TO-SCROLL BINDING ───────────────────────────────────
function initFrameScroll() {
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p           = self.progress;
      const accelerated = Math.min(1, p * FRAME_SPEED);
      const idx         = Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT - 1);

      if (idx !== currentFrame) {
        currentFrame = idx;
        requestAnimationFrame(() => drawFrame(currentFrame));
      }

      // Fire glow: rises as oven opens, fades as scroll continues
      let glowOpacity = 0;
      if (p >= GLOW_START && p <= GLOW_PEAK) {
        glowOpacity = (p - GLOW_START) / (GLOW_PEAK - GLOW_START);
      } else if (p > GLOW_PEAK && p <= GLOW_END) {
        glowOpacity = 1 - (p - GLOW_PEAK) / (GLOW_END - GLOW_PEAK);
      }
      fireGlow.style.opacity = (glowOpacity * 0.9).toFixed(3);
    },
  });
}

// ── DARK OVERLAY (stats section) ─────────────────────────────
function initDarkOverlay() {
  const fade = 0.035;
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p = self.progress;
      let opacity = 0;
      if (p >= OVERLAY_ENTER - fade && p < OVERLAY_ENTER) {
        opacity = (p - (OVERLAY_ENTER - fade)) / fade;
      } else if (p >= OVERLAY_ENTER && p <= OVERLAY_LEAVE) {
        opacity = 0.91;
      } else if (p > OVERLAY_LEAVE && p <= OVERLAY_LEAVE + fade) {
        opacity = 0.91 * (1 - (p - OVERLAY_LEAVE) / fade);
      }
      darkOverlay.style.opacity = opacity.toFixed(3);
    },
  });
}

// ── MARQUEES ─────────────────────────────────────────────────
function initMarquees() {
  document.querySelectorAll('.marquee-wrap').forEach((el) => {
    const speed = parseFloat(el.dataset.scrollSpeed) || -22;
    gsap.to(el.querySelector('.marquee-text'), {
      xPercent: speed,
      ease: 'none',
      scrollTrigger: {
        trigger: scrollCont,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
      },
    });
  });
}

// ── HEADER STATE ─────────────────────────────────────────────
function initHeader() {
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      header.classList.toggle('scrolled', self.progress > 0.015);
    },
  });
}

// ── COUNTER ANIMATION ─────────────────────────────────────────
function animateCounter(el) {
  const target   = parseFloat(el.dataset.value);
  const decimals = parseInt(el.dataset.decimals || '0');
  const duration = 2000;
  const start    = performance.now();

  function tick(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = eased * target;
    el.textContent = decimals === 0 ? Math.floor(value) : value.toFixed(decimals);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = decimals === 0 ? target : target.toFixed(decimals);
  }
  requestAnimationFrame(tick);
}

// ── ANIMATION TIMELINE BUILDER ────────────────────────────────
function buildTimeline(children, type) {
  const tl = gsap.timeline({ paused: true });
  switch (type) {
    case 'slide-left':
      tl.from(children, { x: -80, opacity: 0, stagger: 0.13, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-right':
      tl.from(children, { x: 80, opacity: 0, stagger: 0.13, duration: 0.9, ease: 'power3.out' });
      break;
    case 'fade-up':
      tl.from(children, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out' });
      break;
    case 'scale-up':
      tl.from(children, { scale: 0.88, opacity: 0, stagger: 0.12, duration: 1.0, ease: 'power2.out' });
      break;
    case 'stagger-up':
      tl.from(children, { y: 60, opacity: 0, stagger: 0.18, duration: 0.85, ease: 'power3.out' });
      break;
    case 'clip-reveal':
      tl.from(children, {
        clipPath: 'inset(100% 0 0 0)',
        opacity: 0,
        stagger: 0.14,
        duration: 1.2,
        ease: 'power4.inOut',
      });
      break;
    default:
      tl.from(children, { opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power2.out' });
  }
  return tl;
}

// ── SECTION SETUP + UNIFIED SCROLL WATCHER ───────────────────
function setupSections() {
  const containerH = scrollCont.offsetHeight;

  // Collect section metadata and position each one
  const sectionData = [];
  document.querySelectorAll('.scroll-section').forEach((section) => {
    const enterPct = parseFloat(section.dataset.enter);
    const leavePct = parseFloat(section.dataset.leave);
    const animType = section.dataset.animation || 'fade-up';
    const persist  = section.dataset.persist === 'true';
    const isStats  = section.classList.contains('section-stats');

    // Position: midpoint of scroll range, centered vertically
    const midPct = (enterPct + leavePct) / 2 / 100;
    section.style.top       = (midPct * containerH) + 'px';
    section.style.transform = 'translateY(-50%)';

    // Animate the direct children of section-inner (or the stat rows)
    const children = section.querySelectorAll(
      '.section-label, .section-heading, .section-body, .cta-button, ' +
      '.btn-primary, .btn-outline-gold, .pizza-item, .hours-block, .stat, .cta-buttons'
    );
    const tl = buildTimeline(children, animType);

    sectionData.push({
      el: section,
      enter: enterPct / 100,
      leave: leavePct / 100,
      persist,
      isStats,
      tl,
      visible: false,
      countersAnimated: false,
    });
  });

  // Single ScrollTrigger for all sections — avoids redundant instances
  ScrollTrigger.create({
    id: 'sections',
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      const p = self.progress;
      sectionData.forEach((data) => {
        const inRange = p >= data.enter && (data.persist || p <= data.leave);

        if (inRange && !data.visible) {
          data.visible = true;
          data.el.classList.add('visible');
          data.tl.restart();
          // Trigger counters once for stats section
          if (data.isStats && !data.countersAnimated) {
            data.countersAnimated = true;
            data.el.querySelectorAll('.stat-number').forEach(animateCounter);
          }
        } else if (!inRange && !data.persist && data.visible) {
          data.visible = false;
          data.el.classList.remove('visible');
          data.tl.pause(0);
          // Reset counters so they re-animate if scrolled back
          if (data.isStats) data.countersAnimated = false;
        }
      });
    },
  });
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  // Canvas: set size immediately
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Load all frames
  await preloadFrames();

  // Hide loader with fade
  loader.classList.add('hidden');

  // Register GSAP plugin
  gsap.registerPlugin(ScrollTrigger);

  // Boot all systems
  initLenis();
  initHeroTransition();
  initFrameScroll();
  initDarkOverlay();
  initMarquees();
  setupSections();
  initHeader();

  // Ensure ScrollTrigger recalculates after all sections are positioned
  requestAnimationFrame(() => {
    setTimeout(() => ScrollTrigger.refresh(), 150);
  });
}

init();
