(() => {
  const BRIDGE_MEDIA_URL = 'http://127.0.0.1:19847';
  const BRIDGE_AUDIO_URL = 'http://127.0.0.1:19848';

  const urlParams = new URLSearchParams(window.location.search);
  const isWebOverlayMode = urlParams.get('overlay') === '1';
  if (isWebOverlayMode) {
    document.documentElement.classList.add('transparent-web-overlay');
  }

  const canvas = document.getElementById('visualizer');
  const ctx = canvas.getContext('2d', { alpha: isWebOverlayMode });

  const emptyState = document.getElementById('empty-state');
  const errorBanner = document.getElementById('error-banner');
  const hud = document.getElementById('hud');
  const studioPanel = document.getElementById('studio-panel');
  const lyricsPanel = document.getElementById('lyrics-panel');
  const lyricsCinema = document.getElementById('lyrics-cinema');

  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const freqReadout = document.getElementById('freq-readout');

  // Player & Lyrics Elements
  const playerCover = document.getElementById('player-cover');
  const playerCoverFallback = document.getElementById('player-cover-fallback');
  const coverThumbWrap = document.getElementById('cover-thumb-wrap');
  const playerTitle = document.getElementById('player-title');
  const playerArtist = document.getElementById('player-artist');
  const btnPrev = document.getElementById('btn-prev');
  const btnPlayPause = document.getElementById('btn-playpause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const btnNext = document.getElementById('btn-next');
  const playerLoadingBar = document.getElementById('player-loading-bar');
  const seekSlider = document.getElementById('seek-slider');
  const timeCurrEl = document.getElementById('time-curr');
  const timeTotalEl = document.getElementById('time-total');

  const lyricPrevEl = document.getElementById('lyric-prev');
  const lyricCurrEl = document.getElementById('lyric-curr');
  const lyricNextEl = document.getElementById('lyric-next');
  const lyricsScrollBody = document.getElementById('lyrics-scroll-body');
  const lyricsStatusBadge = document.getElementById('lyrics-status-badge');
  const lyricsQueryInput = document.getElementById('lyrics-query-input');
  const lyricsCandidateSelect = document.getElementById('lyrics-candidate-select');
  const mediaScopeSelect = document.getElementById('media-scope-select');
  const lyricWordAnimToggle = document.getElementById('lyric-word-anim-toggle');
  const btnLyricsSearch = document.getElementById('btn-lyrics-search');
  const btnLyricsToggle = document.getElementById('btn-lyrics-toggle');
  const btnCloseLyrics = document.getElementById('btn-close-lyrics');
  const btnLyricsRefresh = document.getElementById('btn-lyrics-refresh');
  const btnLyricsSettingsToggle = document.getElementById('btn-lyrics-settings-toggle');
  const lyricsControlsDrawer = document.getElementById('lyrics-controls-drawer');
  const btnLyricOffsetMinus = document.getElementById('btn-lyric-offset-minus');
  const btnLyricOffsetPlus = document.getElementById('btn-lyric-offset-plus');
  const lyricOffsetVal = document.getElementById('lyric-offset-val');
  const btnLyricsCinemaToggle = document.getElementById('btn-lyrics-cinema-toggle');
  const btnGameOverlay = document.getElementById('btn-game-overlay');
  const btnHudOverlay = document.getElementById('btn-hud-overlay');
  const btnVisPower = document.getElementById('btn-vis-power');
  const visEnabledToggle = document.getElementById('vis-enabled-toggle');
  const overlayPosSelect = document.getElementById('overlay-pos-select');
  const overlayStyleSelect = document.getElementById('overlay-style-select');
  const overlayDofToggle = document.getElementById('overlay-dof-toggle');
  const overlayPrevNextToggle = document.getElementById('overlay-prevnext-toggle');
  const overlayClickThroughToggle = document.getElementById('overlay-clickthrough-toggle');
  const overlayBgToggle = document.getElementById('overlay-bg-toggle');
  const overlayOutlineToggle = document.getElementById('overlay-outline-toggle');
  const overlayShadowToggle = document.getElementById('overlay-shadow-toggle');
  const overlayControlsToggle = document.getElementById('overlay-controls-toggle');
  const overlayBgColor = document.getElementById('overlay-bg-color');
  const overlayOutlineColor = document.getElementById('overlay-outline-color');
  const overlayTextColor = document.getElementById('overlay-text-color');
  const overlayActiveColor = document.getElementById('overlay-active-color');
  const btnOverlayResetPos = document.getElementById('btn-overlay-reset-pos');
  const ecoModeToggle = document.getElementById('eco-mode-toggle');

  // Source & Studio Buttons
  const btnStartAuto = document.getElementById('btn-start-auto');
  const btnStartSystem = document.getElementById('btn-start-system');
  const btnStartMic = document.getElementById('btn-start-mic');
  const btnSrcAuto = document.getElementById('btn-src-auto');
  const btnSrcBrowser = document.getElementById('btn-src-browser');
  const btnSrcMic = document.getElementById('btn-src-mic');
  const btnStop = document.getElementById('btn-stop');
  const btnTogglePanel = document.getElementById('btn-toggle-panel');
  const btnClosePanel = document.getElementById('btn-close-panel');
  const btnVisTheme = document.getElementById('btn-vis-theme');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnHideHud = document.getElementById('btn-hide-hud');
  const btnActivateGlass = document.getElementById('btn-activate-glass');

  const uiThemeSelect = document.getElementById('ui-theme-select');
  const deviceSelect = document.getElementById('device-select');
  const modeSelect = document.getElementById('mode-select');
  const colorSelect = document.getElementById('color-select');
  const bgSelect = document.getElementById('bg-select');

  const bgUrlInput = document.getElementById('bg-url-input');
  const bgFileInput = document.getElementById('bg-file-input');
  const btnBgUrl = document.getElementById('btn-bg-url');
  const btnBgClear = document.getElementById('btn-bg-clear');
  const bgTintColor = document.getElementById('bg-tint-color');

  const uiAccentPicker = document.getElementById('ui-accent-picker');
  const swatchGrid = document.getElementById('swatch-grid');
  const customColorToggle = document.getElementById('custom-color-toggle');
  const gradientPreview = document.getElementById('gradient-preview');
  const colorStartInput = document.getElementById('color-start');
  const colorMidInput = document.getElementById('color-mid');
  const colorEndInput = document.getElementById('color-end');
  const colorGlowInput = document.getElementById('color-glow');

  const presetList = document.getElementById('preset-list');
  const presetNameInput = document.getElementById('preset-name-input');
  const presetFeedback = document.getElementById('preset-feedback');
  const btnPresetSave = document.getElementById('btn-preset-save');
  const btnPresetExport = document.getElementById('btn-preset-export');
  const presetImportInput = document.getElementById('preset-import-input');

  const applyVisCheck = document.getElementById('apply-vis-check');
  const applyUiCheck = document.getElementById('apply-ui-check');
  const applyBgCheck = document.getElementById('apply-bg-check');
  const applyColorCheck = document.getElementById('apply-color-check');

  const peakToggle = document.getElementById('peak-toggle');
  const rgbBeatToggle = document.getElementById('rgb-beat-toggle');
  const particlesToggle = document.getElementById('particles-toggle');
  const mirrorToggle = document.getElementById('mirror-toggle');
  const rulerToggle = document.getElementById('ruler-toggle');
  const rulerPosSelect = document.getElementById('ruler-pos-select');
  const wiggleToggle = document.getElementById('wiggle-toggle');
  const beatZoomToggle = document.getElementById('beat-zoom-toggle');
  const canvasTitleToggle = document.getElementById('canvas-title-toggle');
  const cinemaLyricsToggle = document.getElementById('cinema-lyrics-toggle');

  const lgTurbulence = document.getElementById('lg-turbulence');
  const lgDisplace = document.getElementById('lg-displace');
  const lgChromaR = document.getElementById('lg-chroma-r');
  const lgChromaB = document.getElementById('lg-chroma-b');

  const PAIRED_CONTROLS = [
    ['min-freq-slider', 'min-freq-num'],
    ['max-freq-slider', 'max-freq-num'],
    ['gain-slider', 'gain-num'],
    ['tilt-slider', 'tilt-num'],
    ['smooth-slider', 'smooth-num'],
    ['attack-slider', 'attack-num'],
    ['release-slider', 'release-num'],
    ['spatial-slider', 'spatial-num'],
    ['fps-slider', 'fps-num'],
    ['bars-slider', 'bars-num'],
    ['thickness-slider', 'thickness-num'],
    ['height-slider', 'height-num'],
    ['bg-blur-slider', 'bg-blur-num'],
    ['bg-tint-slider', 'bg-tint-num'],
    ['bg-vignette-slider', 'bg-vignette-num'],
    ['pulse-bright-slider', 'pulse-bright-num'],
    ['ruler-y-slider', 'ruler-y-num'],
    ['glow-slider', 'glow-num'],
    ['glow-spread-slider', 'glow-spread-num'],
    ['motion-blur-slider', 'motion-blur-num'],
    ['shake-slider', 'shake-num'],
    ['zoom-amp-slider', 'zoom-amp-num'],
    ['zoom-smooth-slider', 'zoom-smooth-num'],
    ['zoom-thresh-slider', 'zoom-thresh-num'],
    ['wiggle-amp-slider', 'wiggle-amp-num'],
    ['wiggle-speed-slider', 'wiggle-speed-num'],
    ['wiggle-rot-slider', 'wiggle-rot-num'],
    ['lg-blur-slider', 'lg-blur-num'],
    ['lg-refract-slider', 'lg-refract-num'],
    ['lg-chroma-slider', 'lg-chroma-num'],
    ['lg-edge-slider', 'lg-edge-num'],
    ['lg-specular-slider', 'lg-specular-num'],
    ['lg-fresnel-slider', 'lg-fresnel-num'],
    ['lg-distort-slider', 'lg-distort-num'],
    ['lg-radius-slider', 'lg-radius-num'],
    ['lg-zradius-slider', 'lg-zradius-num'],
    ['lg-opacity-slider', 'lg-opacity-num'],
    ['lg-sat-slider', 'lg-sat-num'],
    ['lg-bright-slider', 'lg-bright-num'],
    ['lg-shadow-op-slider', 'lg-shadow-op-num'],
    ['lg-shadow-sp-slider', 'lg-shadow-sp-num'],
    ['lg-bevel-slider', 'lg-bevel-num'],
    ['lyric-scale-slider', 'lyric-scale-num'],
    ['lyric-dof-slider', 'lyric-dof-num'],
    ['overlay-width-slider', 'overlay-width-num'],
    ['overlay-scale-slider', 'overlay-scale-num'],
    ['overlay-opacity-slider', 'overlay-opacity-num'],
    ['overlay-bg-opacity-slider', 'overlay-bg-opacity-num'],
    ['dpr-slider', 'dpr-num'],
  ];

  const getVal = (id) => parseFloat(document.getElementById(id).value) || 0;

  const THEMES = {
    white: { stops: ['#ffffff', '#d4d4d8'], glow: '#ffffff', peak: '#ffffff' },
    aurora: { stops: ['#22d3ee', '#34d399', '#a78bfa'], glow: '#34d399', peak: '#a7f3d0' },
    cyberpunk: { stops: ['#06b6d4', '#ec4899', '#facc15'], glow: '#ec4899', peak: '#fdf08a' },
    rainbow: {
      stops: ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899'],
      glow: '#8b5cf6',
      peak: '#ffffff',
    },
    sunset: { stops: ['#fb7185', '#f472b6', '#fbbf24'], glow: '#fb7185', peak: '#fde68a' },
    ice: { stops: ['#38bdf8', '#7dd3fc', '#e0f2fe'], glow: '#38bdf8', peak: '#bae6fd' },
    violet: { stops: ['#8b5cf6', '#c084fc', '#f472b6'], glow: '#a855f7', peak: '#e9d5ff' },
    amber: { stops: ['#f59e0b', '#fcd34d', '#fef3c7'], glow: '#f59e0b', peak: '#fef08a' },
    emerald: { stops: ['#10b981', '#6ee7b7', '#a7f3d0'], glow: '#10b981', peak: '#d1fae5' },
    crimson: { stops: ['#ef4444', '#fb7185', '#fda4af'], glow: '#ef4444', peak: '#fecdd3' },
    gold: { stops: ['#eab308', '#fde047', '#ffffff'], glow: '#eab308', peak: '#fef9c3' },
    ocean: { stops: ['#1d4ed8', '#06b6d4', '#67e8f9'], glow: '#06b6d4', peak: '#cffafe' },
  };

  const PRESET_STORAGE_KEY = 'audio_spectrum_studio_presets_v2';
  const LAST_SESSION_STATE_KEY = 'cobra_audio_last_active_state_v2';
  const LAST_SESSION_PRESET_KEY = 'cobra_audio_last_active_preset_name';
  const BUILTIN_PRESETS = {
    'Aurora Cover Studio': {
      vis: {
        mode: 'spectrum', minFreq: 0, maxFreq: 20000, gain: 1.9, tilt: 0.6,
        smooth: 0.72, attack: 0.65, release: 0.78, spatial: 1, fps: 0,
        bars: 104, thickness: 0.52, height: 0.38, glow: 28, glowSpread: 1.9,
        motionBlur: 0.22, shake: 1.0, wiggle: false, wiggleAmp: 14, wiggleSpeed: 1.2, wiggleRot: 1.4,
        mirror: true, ruler: true, peaks: true, particles: true, rgbBeat: true, visLight: false,
      },
      ui: { uiTheme: 'dark', accent: '#6366f1' },
      bg: { bg: 'cover', bgBlur: 18, bgTintColor: 'black', bgTint: 0.58, bgVignette: 0.55 },
      color: { theme: 'aurora', customColor: false },
    },
    'Liquid Glass Cover': {
      vis: {
        mode: 'ribbon', minFreq: 0, maxFreq: 18000, gain: 1.8, tilt: 0.5,
        smooth: 0.8, attack: 0.45, release: 0.86, spatial: 2, fps: 0,
        bars: 96, thickness: 0.5, height: 0.36, glow: 34, glowSpread: 2.2,
        motionBlur: 0.32, shake: 0.4, wiggle: true, wiggleAmp: 10, wiggleSpeed: 0.8, wiggleRot: 0.8,
        mirror: true, ruler: true, peaks: false, particles: true, rgbBeat: false, visLight: false,
      },
      ui: {
        uiTheme: 'liquid', accent: '#38bdf8',
        lgBlur: 0.28, lgRefract: 0.75, lgChroma: 0.18, lgEdge: 0.35, lgSpecular: 0.42,
        lgFresnel: 0.85, lgDistort: 0.25, lgRadius: 24, lgZradius: 36, lgOpacity: 0.36,
        lgSat: 1.55, lgBright: 1.12, lgShadowOp: 0.35, lgShadowSp: 28, lgBevel: 0.4,
      },
      bg: { bg: 'cover', bgBlur: 22, bgTintColor: 'black', bgTint: 0.45, bgVignette: 0.5 },
      color: { theme: 'ice', customColor: false },
    },
    'Bass Earthquake': {
      vis: {
        mode: 'reflection', minFreq: -120, maxFreq: 18000, gain: 2.3, tilt: 0.75,
        smooth: 0.64, attack: 0.85, release: 0.7, spatial: 0, fps: 0,
        bars: 88, thickness: 0.6, height: 0.42, glow: 42, glowSpread: 2.5,
        motionBlur: 0.36, shake: 2.2, wiggle: true, wiggleAmp: 18, wiggleSpeed: 1.6, wiggleRot: 2.2,
        mirror: true, ruler: true, peaks: true, particles: true, rgbBeat: true, visLight: false,
      },
      ui: { uiTheme: 'dark', accent: '#ef4444' },
      bg: { bg: 'pulse', bgBlur: 6, bgTintColor: 'black', bgTint: 0.45, bgVignette: 0.6 },
      color: { theme: 'crimson', customColor: false },
    },
    'Minimalist Paper': {
      vis: {
        mode: 'waveform', minFreq: 0, maxFreq: 16000, gain: 1.8, tilt: 0.4,
        smooth: 0.74, attack: 0.6, release: 0.8, spatial: 1, fps: 0,
        bars: 96, thickness: 0.46, height: 0.34, glow: 8, glowSpread: 1.4,
        motionBlur: 0.1, shake: 0, wiggle: false, wiggleAmp: 0, wiggleSpeed: 1, wiggleRot: 0,
        mirror: true, ruler: false, peaks: false, particles: false, rgbBeat: false, visLight: true,
      },
      ui: { uiTheme: 'light', accent: '#1f1e1b' },
      bg: { bg: 'solid', bgBlur: 0, bgTintColor: 'white', bgTint: 0.2, bgVignette: 0.15 },
      color: { theme: 'white', customColor: false },
    },
  };

  // Audio state
  let audioSourceMode = 'none'; // 'bridge' | 'web' | 'none'
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let activeStream = null;
  let animationId = null;
  let bridgeAudioTimer = null;
  let bridgeAudioSampleRate = 48000;
  let bridgeFreqArr = new Array(2048).fill(0);
  let bridgeWaveArr = new Array(256).fill(128);

  let freqData = null;
  let timeData = null;
  let smoothedBars = new Float32Array(104);
  let scratchBars = new Float32Array(104);
  let peakBars = new Float32Array(104);
  let peakVelocity = new Float32Array(104);

  let bassEnergy = 0;
  let bassAvg = 0.05;
  let beatImpulse = 0;
  let beatZoomCurrent = 1.0;
  let rgbFlash = 0;
  let timeSec = 0;
  let lastFrameTime = 0;
  let activeWordIdx = -1;

  let visLightMode = false;
  let hudForceHidden = false;
  let idleTimer = null;

  // Media / Cover / Lyrics state
  let customBgImage = null;
  let customBgImageSrc = '';
  let coverBgImage = null;
  let blurredBgCache = { img: null, blur: -1, canvas: document.createElement('canvas') };
  let currentMedia = {
    active: false,
    title: '',
    artist: '',
    album: '',
    status: 'Stopped',
    position: 0,
    duration: 0,
    trackKey: '',
    updatedAt: Date.now(),
  };
  let mediaAnchorPos = 0;
  let mediaAnchorPerfMs = performance.now();
  let isSeeking = false;
  let parsedLyrics = [];
  let isSyncedLyrics = false;
  let activeLyricIdx = -1;
  let lyricOffsetSec = 0;
  let lastCoverVersion = -1;
  let lyricsReqSeq = 0;
  let isLyricsFetching = false;
  let lyricsCandidates = [];
  let skipLoadingTimer = null;
  let cachedLyricItems = [];
  let cachedCinemaWords = [];
  let cachedPanelWords = [];
  let gameOverlayRunning = false;
  let visualizerEnabled = true;
  let visPausedByOverlay = false;
  let appHibernated = document.hidden;
  let overlayResetPosToken = 0;
  let liteTickerId = null;
  let lastOverlaySig = '';
  let lastOverlayPushMs = 0;

  const stars = Array.from({ length: 110 }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: Math.random(),
    speed: 0.0012 + Math.random() * 0.0025,
    size: 0.8 + Math.random() * 1.8,
  }));

  const particles = Array.from({ length: 48 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.0015,
    vy: -0.001 - Math.random() * 0.0025,
    size: 1.2 + Math.random() * 2.4,
    alpha: 0.2 + Math.random() * 0.6,
  }));

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function formatFreq(hz) {
    const abs = Math.abs(hz);
    const sign = hz < 0 ? '-' : '';
    return abs >= 1000 ? `${sign}${(abs / 1000).toFixed(1)} kHz` : `${hz} Hz`;
  }

  function updateFreqReadout() {
    freqReadout.textContent = `${formatFreq(getVal('min-freq-num'))} – ${formatFreq(getVal('max-freq-num'))}`;
  }

  function applyUiAccent(hex) {
    document.documentElement.style.setProperty('--ui-accent', hex);
    uiAccentPicker.value = hex;
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    document.documentElement.style.setProperty('--ui-accent-text', lum > 0.65 ? '#111111' : '#ffffff');
  }

  function updateLiquidGlassVars() {
    const root = document.documentElement.style;
    const blurAmt = getVal('lg-blur-num');
    const refract = getVal('lg-refract-num');
    const chroma = getVal('lg-chroma-num');
    const distort = getVal('lg-distort-num');

    root.setProperty('--lg-blur', `${(blurAmt * 42).toFixed(1)}px`);
    root.setProperty('--lg-opacity', getVal('lg-opacity-num').toFixed(2));
    root.setProperty('--lg-sat', getVal('lg-sat-num').toFixed(2));
    root.setProperty('--lg-bright', getVal('lg-bright-num').toFixed(2));
    root.setProperty('--lg-radius', `${getVal('lg-radius-num')}px`);
    root.setProperty('--lg-edge', getVal('lg-edge-num').toFixed(2));
    root.setProperty('--lg-specular', getVal('lg-specular-num').toFixed(2));
    root.setProperty('--lg-fresnel', getVal('lg-fresnel-num').toFixed(2));
    root.setProperty('--lg-shadow-op', getVal('lg-shadow-op-num').toFixed(2));
    root.setProperty('--lg-shadow-sp', `${getVal('lg-shadow-sp-num')}px`);
    root.setProperty('--lg-bevel', getVal('lg-bevel-num').toFixed(2));

    const zRadius = getVal('lg-zradius-num');
    const scale = (refract * 28 + distort * 35) * (0.4 + zRadius / 60);
    lgDisplace.setAttribute('scale', scale.toFixed(1));
    lgTurbulence.setAttribute('baseFrequency', (0.006 + distort * 0.025).toFixed(4));

    const chromaShift = (chroma * 6).toFixed(2);
    lgChromaR.setAttribute('dx', chromaShift);
    lgChromaB.setAttribute('dx', (-chromaShift).toString());
  }

  function updateLyricAppearanceVars() {
    const root = document.documentElement.style;
    root.setProperty('--lyric-scale', getVal('lyric-scale-num').toFixed(2));
    root.setProperty('--lyric-dof-blur', getVal('lyric-dof-num').toFixed(2));
  }

  function setupPairedControls() {
    PAIRED_CONTROLS.forEach(([sliderId, numId]) => {
      const slider = document.getElementById(sliderId);
      const num = document.getElementById(numId);

      const onSync = (fromSlider) => {
        if (fromSlider) num.value = slider.value;
        else if (!Number.isNaN(parseFloat(num.value))) slider.value = num.value;

        if (sliderId.includes('freq')) enforceFreqOrder(sliderId.startsWith('min'));
        if (sliderId.startsWith('lg-')) updateLiquidGlassVars();
        if (sliderId.startsWith('lyric-')) updateLyricAppearanceVars();
        if (sliderId.startsWith('overlay-')) pushOverlayState(true);
        if (sliderId === 'dpr-slider') resizeCanvas();
        updateFreqReadout();
        saveLastActiveState();
      };

      slider.addEventListener('input', () => onSync(true));
      num.addEventListener('change', () => onSync(false));
    });
  }

  function enforceFreqOrder(minChanged) {
    const minNum = document.getElementById('min-freq-num');
    const maxNum = document.getElementById('max-freq-num');
    const minSlider = document.getElementById('min-freq-slider');
    const maxSlider = document.getElementById('max-freq-slider');

    let minV = parseFloat(minNum.value) || 0;
    let maxV = parseFloat(maxNum.value) || 20000;
    if (minV >= maxV - 200) {
      if (minChanged) {
        minV = maxV - 200;
        minNum.value = minV;
        minSlider.value = minV;
      } else {
        maxV = minV + 200;
        maxNum.value = maxV;
        maxSlider.value = maxV;
      }
    }
  }

  function buildSwatches() {
    swatchGrid.innerHTML = '';
    Object.entries(THEMES).forEach(([key, theme]) => {
      const btn = document.createElement('button');
      btn.className = 'swatch-btn';
      btn.title = key;
      btn.dataset.theme = key;
      btn.style.background = `linear-gradient(90deg, ${theme.stops.join(', ')})`;
      btn.addEventListener('click', () => {
        colorSelect.value = key;
        customColorToggle.checked = false;
        syncSwatchActive();
      });
      swatchGrid.appendChild(btn);
    });
    syncSwatchActive();
  }

  function syncSwatchActive() {
    const activeKey = colorSelect.value;
    swatchGrid.querySelectorAll('.swatch-btn').forEach((btn) => {
      btn.classList.toggle('active', !customColorToggle.checked && btn.dataset.theme === activeKey);
    });
  }

  function updateGradientPreview() {
    gradientPreview.style.background = `linear-gradient(90deg, ${colorStartInput.value}, ${colorMidInput.value}, ${colorEndInput.value})`;
  }

  function getActiveTheme() {
    if (customColorToggle.checked) {
      return {
        stops: [colorStartInput.value, colorMidInput.value, colorEndInput.value],
        glow: colorGlowInput.value,
        peak: colorEndInput.value,
      };
    }
    const base = THEMES[colorSelect.value] || THEMES.aurora;
    if (visLightMode && colorSelect.value === 'white') {
      return { stops: ['#18181b', '#3f3f46'], glow: '#18181b', peak: '#18181b' };
    }
    return base;
  }

  function loadCustomBgImage(url) {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      customBgImage = img;
      customBgImageSrc = url;
      bgSelect.value = 'image';
    };
    img.onerror = () => showPresetFeedback('Gagal memuat gambar dari URL.');
    img.src = url;
  }

  function resizeCanvas() {
    const requested = ecoModeToggle.checked ? 1.0 : Math.min(2.0, Math.max(0.5, getVal('dpr-num')));
    const dpr = Math.min(window.devicePixelRatio || 1, requested);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setupPanelResizers() {
    // Restore saved panel widths if present
    const savedStudioW = localStorage.getItem('cobra_audio_panel_w_studio');
    const savedLyricsW = localStorage.getItem('cobra_audio_panel_w_lyrics');
    if (savedStudioW && studioPanel) studioPanel.style.width = `${savedStudioW}px`;
    if (savedLyricsW && lyricsPanel) lyricsPanel.style.width = `${savedLyricsW}px`;

    document.querySelectorAll('.resize-handle').forEach((handle) => {
      const target = document.getElementById(handle.dataset.resizeTarget);
      const dir = handle.dataset.resizeDir;
      if (!target) return;

      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handle.classList.add('resizing');
        const startX = e.clientX;
        const startW = target.getBoundingClientRect().width;

        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          const nextW = dir === 'right' ? startW + dx : startW - dx;
          const clamped = Math.max(280, Math.min(window.innerWidth * 0.65, nextW));
          target.style.width = `${clamped}px`;
        };

        const onUp = () => {
          handle.classList.remove('resizing');
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          if (target.id === 'studio-panel') {
            localStorage.setItem('cobra_audio_panel_w_studio', parseInt(target.style.width, 10));
          } else if (target.id === 'lyrics-panel') {
            localStorage.setItem('cobra_audio_panel_w_lyrics', parseInt(target.style.width, 10));
          }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    });
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.remove('hidden');
  }

  function clearError() {
    errorBanner.textContent = '';
    errorBanner.classList.add('hidden');
  }

  function setStatus(active, label) {
    statusDot.classList.toggle('active', active);
    statusText.textContent = label;
    btnStop.classList.toggle('hidden', !active);
    if (active) emptyState.classList.add('hidden');
  }

  function ensureBarArrays(barCount) {
    if (smoothedBars.length !== barCount) {
      smoothedBars = new Float32Array(barCount);
      scratchBars = new Float32Array(barCount);
      peakBars = new Float32Array(barCount);
      peakVelocity = new Float32Array(barCount);
    }
  }

  function stopAudioCapture(showModal = false) {
    audioSourceMode = 'none';
    if (bridgeAudioTimer) {
      clearInterval(bridgeAudioTimer);
      bridgeAudioTimer = null;
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch (_) {}
      sourceNode = null;
    }
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    analyser = null;
    smoothedBars.fill(0);
    peakBars.fill(0);
    peakVelocity.fill(0);
    bassEnergy = 0;
    beatImpulse = 0;
    rgbFlash = 0;
    setStatus(false, 'Idle');
    if (showModal) emptyState.classList.remove('hidden');
  }

  // --- AUTO WASAPI LOOPBACK BRIDGE ---
  async function probeAudioEndpoint() {
    const endpoints = [`${BRIDGE_AUDIO_URL}/audio`, `${BRIDGE_MEDIA_URL}/api/audio`];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.active) return { url, data };
        }
      } catch (_) {}
    }
    return null;
  }

  async function startAutoBridge(silentOnFail = false) {
    clearError();
    try {
      let found = await probeAudioEndpoint();
      if (!found && window.location.port !== '19847') {
        await fetch('media-bridge.php', { cache: 'no-store' }).catch(() => null);
        await new Promise((r) => setTimeout(r, 700));
        found = await probeAudioEndpoint();
      }

      if (!found) {
        if (!silentOnFail) {
          showError('Auto Bridge belum aktif. Jalankan "node server.js" atau gunakan Browser Share Audio.');
          emptyState.classList.remove('hidden');
        }
        return false;
      }

      const { url: audioUrl, data } = found;
      stopAudioCapture(false);
      audioSourceMode = 'bridge';
      bridgeAudioSampleRate = data.sampleRate || 48000;
      if (Array.isArray(data.freq)) bridgeFreqArr = data.freq;
      if (Array.isArray(data.wave)) bridgeWaveArr = data.wave;

      let fetching = false;
      bridgeAudioTimer = setInterval(async () => {
        if (fetching || audioSourceMode !== 'bridge' || !isVisualizerActive()) return;
        fetching = true;
        try {
          const r = await fetch(audioUrl, { cache: 'no-store' });
          if (r.ok) {
            const d = await r.json();
            if (d.sampleRate) bridgeAudioSampleRate = d.sampleRate;
            if (Array.isArray(d.freq)) bridgeFreqArr = d.freq;
            if (Array.isArray(d.wave)) bridgeWaveArr = d.wave;
          }
        } catch (_) {}
        fetching = false;
      }, 16);

      setStatus(true, 'WASAPI Auto');
      lastFrameTime = performance.now();
      animationId = requestAnimationFrame(renderLoop);
      return true;
    } catch (_) {
      if (!silentOnFail) emptyState.classList.remove('hidden');
      return false;
    }
  }

  async function initWebAudioPipeline(stream, label) {
    stopAudioCapture(false);
    clearError();

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.minDecibels = -95;
    analyser.maxDecibels = -16;
    analyser.smoothingTimeConstant = getVal('smooth-num');

    const audioOnlyStream = new MediaStream(stream.getAudioTracks());
    sourceNode = audioCtx.createMediaStreamSource(audioOnlyStream);
    sourceNode.connect(analyser);

    activeStream = stream;
    audioSourceMode = 'web';
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Float32Array(analyser.fftSize);

    stream.getAudioTracks().forEach((track) => {
      track.addEventListener('ended', () => stopAudioCapture(true));
    });

    setStatus(true, label);
    lastFrameTime = performance.now();
    animationId = requestAnimationFrame(renderLoop);
  }

  async function startSystemAudio() {
    clearError();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showError('Browser tidak mendukung getDisplayMedia.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1 }, height: { ideal: 1 }, frameRate: { ideal: 1 } },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          suppressLocalAudioPlayback: false,
        },
      });
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        showError('Audio sistem tidak dicentang. Ulangi dan centang "Also share system audio".');
        return;
      }
      await initWebAudioPipeline(stream, 'Browser Tab');
    } catch (err) {
      showError(err?.name === 'NotAllowedError' ? 'Izin dibatalkan.' : `Error: ${err.message || err}`);
    }
  }

  async function populateInputDevices(selectedId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');
    deviceSelect.innerHTML = '';
    audioInputs.forEach((device, idx) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Input Audio ${idx + 1}`;
      if (selectedId && device.deviceId === selectedId) option.selected = true;
      deviceSelect.appendChild(option);
    });
    deviceSelect.classList.toggle('hidden', audioInputs.length === 0);
  }

  async function startMicOrStereoMix(deviceId = null) {
    clearError();
    try {
      const audioConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
      if (deviceId) audioConstraints.deviceId = { exact: deviceId };
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
      const activeDeviceId = stream.getAudioTracks()[0]?.getSettings()?.deviceId;
      await populateInputDevices(activeDeviceId);
      await initWebAudioPipeline(stream, 'Input');
    } catch (err) {
      showError(`Gagal mengakses input: ${err.message || err}`);
    }
  }

  // --- BETTER LYRICS PARSER, SYNC & GAME OVERLAY ---
  function parseEnhancedLrc(lrcText) {
    const lines = [];
    const lineRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    const wordRegex = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>([^<]*)/g;

    lrcText.split(/\r?\n/).forEach((rawLine) => {
      const matches = [...rawLine.matchAll(lineRegex)];
      if (matches.length === 0) return;
      const rest = rawLine.replace(lineRegex, '').trim();

      const wordMatches = [...rest.matchAll(wordRegex)];
      let words = null;
      let cleanText = rest;

      if (wordMatches.length > 0) {
        words = [];
        for (let i = 0; i < wordMatches.length; i++) {
          const wm = wordMatches[i];
          const ws =
            parseInt(wm[1], 10) * 60 +
            parseInt(wm[2], 10) +
            parseInt((wm[3] || '0').padEnd(3, '0').slice(0, 3), 10) / 1000;
          const wText = wm[4].trim();
          if (!wText) continue;
          const nextWm = wordMatches[i + 1];
          const we = nextWm
            ? parseInt(nextWm[1], 10) * 60 +
              parseInt(nextWm[2], 10) +
              parseInt((nextWm[3] || '0').padEnd(3, '0').slice(0, 3), 10) / 1000
            : ws + Math.max(0.24, wText.length * 0.06);
          words.push({ text: wText, start: ws, end: Math.max(ws + 0.08, we) });
        }
        cleanText = words.map((w) => w.text).join(' ');
      }

      matches.forEach((m) => {
        const min = parseInt(m[1], 10);
        const sec = parseInt(m[2], 10);
        const msStr = (m[3] || '0').padEnd(3, '0').slice(0, 3);
        const time = min * 60 + sec + parseInt(msStr, 10) / 1000;
        lines.push({
          time,
          text: cleanText || '♪',
          words: words && words.length > 0 ? words : null,
        });
      });
    });

    lines.sort((a, b) => a.time - b.time);
    for (let i = 0; i < lines.length; i++) {
      const nextT = i + 1 < lines.length ? lines[i + 1].time : lines[i].time + 4.5;
      lines[i].endTime = Math.max(lines[i].time + 0.4, nextT);
    }
    return lines;
  }

  function buildWordSpans(container, lineObjOrText) {
    container.innerHTML = '';
    const isObj = lineObjOrText && typeof lineObjOrText === 'object';
    const text = isObj ? lineObjOrText.text || '' : String(lineObjOrText || '');
    const explicitWords = isObj && Array.isArray(lineObjOrText.words) ? lineObjOrText.words : null;
    const words = explicitWords ? explicitWords.map((w) => w.text) : text.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      const sp = document.createElement('span');
      sp.className = 'lyric-word';
      sp.textContent = '♪';
      container.appendChild(sp);
      return [sp];
    }

    const spans = [];
    words.forEach((w) => {
      const sp = document.createElement('span');
      sp.className = 'lyric-word';
      sp.textContent = w;
      container.appendChild(sp);
      spans.push(sp);
    });
    return spans;
  }

  function renderLyricsList() {
    lyricsScrollBody.innerHTML = '';
    cachedLyricItems = [];
    cachedActivePanelWords = [];
    activeLyricIdx = -1;
    activeWordIdx = -1;
    if (parsedLyrics.length === 0) {
      lyricsScrollBody.innerHTML = '<div class="lyrics-empty">Lirik tidak ditemukan untuk lagu ini. Coba cari manual di kotak atas.</div>';
      lyricPrevEl.textContent = '';
      cachedCinemaWords = buildWordSpans(lyricCurrEl, currentMedia.title || '♪');
      lyricNextEl.textContent = '';
      return;
    }

    const frag = document.createDocumentFragment();
    parsedLyrics.forEach((line, idx) => {
      const div = document.createElement('div');
      div.className = 'lyric-item dof-far';
      div.dataset.idx = idx;
      buildWordSpans(div, line);
      if (isSyncedLyrics) {
        div.addEventListener('click', () => {
          sendMediaControl('seek', Math.max(0, line.time - lyricOffsetSec));
        });
      }
      frag.appendChild(div);
      cachedLyricItems.push(div);
    });
    lyricsScrollBody.appendChild(frag);
  }

  function scrollActiveLyricIntoCenter(instant = false) {
    if (activeLyricIdx < 0 || lyricsPanel.classList.contains('hidden')) return;
    const activeEl = cachedLyricItems[activeLyricIdx];
    if (!activeEl) return;
    const targetTop =
      activeEl.offsetTop - lyricsScrollBody.clientHeight / 2 + activeEl.clientHeight / 2;
    lyricsScrollBody.scrollTo({
      top: Math.max(0, targetTop),
      behavior: instant ? 'auto' : 'smooth',
    });
  }

  function applyLyricsCandidate(candidate) {
    if (!candidate) return;
    if (candidate.synced && Array.isArray(candidate.parsedLines) && candidate.parsedLines.length > 0) {
      parsedLyrics = candidate.parsedLines;
      isSyncedLyrics = true;
      const fmtTag = candidate.richSync ? 'Word Sync' : 'Sync';
      lyricsStatusBadge.textContent = `${candidate.source || 'Better Lyrics'} • ${fmtTag}`;
    } else if (candidate.synced && candidate.syncedLyrics) {
      parsedLyrics = parseEnhancedLrc(candidate.syncedLyrics);
      isSyncedLyrics = true;
      lyricsStatusBadge.textContent = `${candidate.source || 'LRCLIB'} • Sync`;
    } else {
      parsedLyrics = (candidate.plainLyrics || '')
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .map((text) => ({ time: -1, endTime: -1, text, words: null }));
      isSyncedLyrics = false;
      lyricsStatusBadge.textContent = `${candidate.source || 'Plain'} Lyrics`;
    }
    renderLyricsList();
    updateLiveTimelineAndLyrics();
    scrollActiveLyricIntoCenter(true);
    pushOverlayState(true);
  }

  function populateCandidateSelector(candidates) {
    lyricsCandidates = Array.isArray(candidates) ? candidates : [];
    lyricsCandidateSelect.innerHTML = '';
    if (lyricsCandidates.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Tidak ada alternatif';
      lyricsCandidateSelect.appendChild(opt);
      return;
    }
    lyricsCandidates.forEach((c, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      const dur = c.duration > 0 ? formatTime(c.duration) : '--:--';
      const tag = c.richSync ? 'Word-Sync' : c.synced ? 'Synced' : 'Plain';
      opt.textContent = `${idx + 1}. ${c.trackName} (${dur}) [${c.source} • ${tag}]`;
      lyricsCandidateSelect.appendChild(opt);
    });
  }

  async function fetchLyricsForTrack(title, artist, duration, forceFresh = false, album = '') {
    const reqId = ++lyricsReqSeq;
    isLyricsFetching = true;
    lyricsStatusBadge.textContent = 'Mencari Better Lyrics...';
    lyricsQueryInput.value = title;
    pushOverlayState(true);
    try {
      const freshParam = forceFresh ? '&fresh=1' : '';
      const albumParam = album ? `&album=${encodeURIComponent(album)}` : '';
      const url = `${BRIDGE_MEDIA_URL}/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist || '')}&duration=${duration || 0}${albumParam}${freshParam}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (reqId !== lyricsReqSeq) return;
      isLyricsFetching = false;

      if (!data.found) {
        parsedLyrics = [];
        isSyncedLyrics = false;
        populateCandidateSelector([]);
        lyricsStatusBadge.textContent = 'Tidak ditemukan';
        renderLyricsList();
        pushOverlayState(true);
        return;
      }

      const list = Array.isArray(data.candidates) && data.candidates.length > 0 ? data.candidates : [data];
      populateCandidateSelector(list);
      applyLyricsCandidate(list[0]);
    } catch (_) {
      if (reqId === lyricsReqSeq) {
        isLyricsFetching = false;
        lyricsStatusBadge.textContent = 'Offline';
        pushOverlayState(true);
      }
    }
  }

  async function fetchCoverForTrack(trackKey) {
    try {
      const res = await fetch(`${BRIDGE_MEDIA_URL}/api/cover`, { cache: 'no-store' });
      const data = await res.json();
      if (data.trackKey === trackKey && data.cover) {
        playerCover.src = data.cover;
        playerCover.classList.remove('hidden');
        playerCoverFallback.classList.add('hidden');

        const img = new Image();
        img.onload = () => {
          coverBgImage = img;
        };
        img.src = data.cover;
      } else {
        playerCover.classList.add('hidden');
        playerCoverFallback.classList.remove('hidden');
        coverBgImage = null;
      }
    } catch (_) {}
  }

  function setPlayPauseIcon(isPlaying) {
    iconPlay.classList.toggle('hidden', isPlaying);
    iconPause.classList.toggle('hidden', !isPlaying);
  }

  function setSkipLoading(active) {
    clearTimeout(skipLoadingTimer);
    playerLoadingBar.classList.toggle('hidden', !active);
    if (active) {
      skipLoadingTimer = setTimeout(() => {
        playerLoadingBar.classList.add('hidden');
      }, 3500);
    }
  }

  async function sendMediaControl(cmd, pos = 0) {
    try {
      if (cmd === 'next' || cmd === 'prev') {
        setSkipLoading(true);
      }
      await fetch(`${BRIDGE_MEDIA_URL}/api/control?cmd=${encodeURIComponent(cmd)}&pos=${pos}`);
      setTimeout(pollMediaSession, 90);
      if (cmd === 'next' || cmd === 'prev') {
        setTimeout(pollMediaSession, 350);
        setTimeout(pollMediaSession, 750);
      }
    } catch (_) {}
  }

  function buildOverlayConfigPayload() {
    return {
      pos: overlayPosSelect ? overlayPosSelect.value : 'top',
      barWidth: getVal('overlay-width-num') || 460,
      scale: getVal('overlay-scale-num') || 1.15,
      opacity: getVal('overlay-opacity-num') || 0.95,
      showPrevNext: overlayPrevNextToggle ? overlayPrevNextToggle.checked : true,
      dofBlur: overlayDofToggle ? overlayDofToggle.checked : true,
      lyricsStyle: overlayStyleSelect ? overlayStyleSelect.value : 'cinema',
      clickThrough: overlayClickThroughToggle ? overlayClickThroughToggle.checked : false,
      showBg: overlayBgToggle ? overlayBgToggle.checked : true,
      bgColor: overlayBgColor ? overlayBgColor.value : '#0f1014',
      bgOpacity: overlayBgToggle ? getVal('overlay-bg-opacity-num') : 0.68,
      showOutline: overlayOutlineToggle ? overlayOutlineToggle.checked : true,
      outlineColor: overlayOutlineColor ? overlayOutlineColor.value : '#ffffff',
      textColor: overlayTextColor ? overlayTextColor.value : '#ffffff',
      activeColor: overlayActiveColor ? overlayActiveColor.value : '#7dd3fc',
      textShadow: overlayShadowToggle ? overlayShadowToggle.checked : true,
      showControls: overlayControlsToggle ? overlayControlsToggle.checked : true,
      resetPosToken: overlayResetPosToken,
    };
  }

  function pushOverlayState(force = false) {
    if (!gameOverlayRunning && !force) return;
    const nowMs = performance.now();
    const wordsPayload = [];
    if (activeLyricIdx >= 0 && cachedCinemaWords.length > 0) {
      for (const sp of cachedCinemaWords) {
        const st = sp.classList.contains('word-active') ? 2 : sp.classList.contains('spoken') ? 1 : 0;
        wordsPayload.push({ text: sp.textContent, state: st });
      }
    }
    const prevText = lyricPrevEl.textContent || '';
    const currText = isLyricsFetching
      ? 'Memuat lirik...'
      : activeLyricIdx >= 0 && parsedLyrics[activeLyricIdx]
        ? parsedLyrics[activeLyricIdx].text
        : currentMedia.active
          ? currentMedia.title || '♪ ...'
          : '♪ Menunggu musik...';
    const nextText = isLyricsFetching ? '' : lyricNextEl.textContent || '';
    const cfg = buildOverlayConfigPayload();
    const sig = `${currentMedia.active ? 1 : 0}|${currentMedia.trackKey || ''}|${currentMedia.status}|${isLyricsFetching ? 1 : 0}|${activeLyricIdx}|${activeWordIdx}|${currText}|${JSON.stringify(cfg)}`;
    if (!force && sig === lastOverlaySig && nowMs - lastOverlayPushMs < 1100) return;
    lastOverlaySig = sig;
    lastOverlayPushMs = nowMs;

    fetch(`${BRIDGE_MEDIA_URL}/api/overlay-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active: currentMedia.active,
        playing: currentMedia.status === 'Playing',
        loading: isLyricsFetching,
        trackKey: currentMedia.trackKey || '',
        title: currentMedia.title || '',
        artist: currentMedia.artist || '',
        prev: isLyricsFetching ? '' : prevText,
        curr: currText,
        next: nextText,
        words: isLyricsFetching ? [] : wordsPayload,
        offsetSec: lyricOffsetSec,
        config: cfg,
      }),
    }).catch(() => {});
  }

  function isVisualizerActive() {
    return visualizerEnabled && !visPausedByOverlay && !isWebOverlayMode && !appHibernated;
  }

  function drawLitePlaceholder(reasonText) {
    if (isWebOverlayMode) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.save();
    ctx.fillStyle = visLightMode ? '#f7f6f1' : '#050507';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = visLightMode ? 'rgba(24,24,27,0.5)' : 'rgba(255,255,255,0.42)';
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.fillText(reasonText, width / 2, height / 2);
    ctx.restore();
  }

  function updateVisualizerPowerState() {
    const active = isVisualizerActive();
    if (btnVisPower) {
      btnVisPower.classList.toggle('overlay-active', visualizerEnabled);
      btnVisPower.textContent = visualizerEnabled ? 'Vis' : 'Vis Off';
    }
    if (visEnabledToggle) visEnabledToggle.checked = visualizerEnabled;

    if (!active) {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      drawLitePlaceholder(
        visPausedByOverlay
          ? 'Mode Fokus Game Overlay • Visualizer dijeda agar ringan & bebas lag'
          : 'Visualizer Dimatikan • Mode Hemat CPU & GPU'
      );
      if (!liteTickerId && audioSourceMode !== 'none') {
        liteTickerId = setInterval(() => {
          if (isVisualizerActive()) {
            clearInterval(liteTickerId);
            liteTickerId = null;
            return;
          }
          updateLiveTimelineAndLyrics();
        }, 120);
      }
    } else {
      if (liteTickerId) {
        clearInterval(liteTickerId);
        liteTickerId = null;
      }
      if (audioSourceMode !== 'none' && !animationId) {
        lastFrameTime = performance.now();
        animationId = requestAnimationFrame(renderLoop);
      } else if (audioSourceMode === 'none') {
        drawIdleFrame();
      }
    }
  }

  function syncOverlayButtons(running) {
    gameOverlayRunning = running;
    visPausedByOverlay = running;
    if (btnGameOverlay) btnGameOverlay.classList.toggle('overlay-active', running);
    if (btnHudOverlay) btnHudOverlay.classList.toggle('overlay-active', running);
    updateVisualizerPowerState();
  }

  async function toggleGameOverlay(action = 'toggle') {
    try {
      await pushOverlayState(true);
      const res = await fetch(`${BRIDGE_MEDIA_URL}/api/overlay?action=${encodeURIComponent(action)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      syncOverlayButtons(Boolean(data.running));
      if (!data.available && action !== 'status') {
        showPresetFeedback('Overlay binary sedang disiapkan atau belum tersedia.');
      }
    } catch (_) {}
  }

  function syncMediaScopeOptions(sessions, currentScope) {
    if (!mediaScopeSelect) return;
    const prevVal = currentScope || mediaScopeSelect.value || 'music';
    const sig = `${prevVal}|${(sessions || []).map((s) => `${s.appId}:${s.status}`).join(',')}`;
    if (mediaScopeSelect.dataset.sig === sig) return;
    mediaScopeSelect.dataset.sig = sig;

    const existingCustom = new Set();
    mediaScopeSelect.innerHTML = '';
    const addOpt = (val, label) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      mediaScopeSelect.appendChild(opt);
    };
    addOpt('music', 'Fokus App Musik (Rekomendasi)');
    addOpt('auto', 'Semua App (Auto)');
    (sessions || []).forEach((s) => {
      if (!s || !s.appId || existingCustom.has(s.appId)) return;
      existingCustom.add(s.appId);
      const stTag = s.status === 'Playing' ? '▶' : '⏸';
      const titleHint = s.title ? ` — ${s.title.slice(0, 22)}` : '';
      addOpt(s.appId, `Kunci: ${s.label || s.appId} (${stTag}${titleHint})`);
    });
    if (prevVal && prevVal !== 'music' && prevVal !== 'auto' && !existingCustom.has(prevVal)) {
      addOpt(prevVal, `Kunci: ${prevVal} (Menunggu app...)`);
    }
    mediaScopeSelect.value = prevVal;
  }

  async function pollMediaSession() {
    if (appHibernated) return;
    try {
      const res = await fetch(`${BRIDGE_MEDIA_URL}/api/media`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      syncMediaScopeOptions(data.sessions || [], data.scope);
      if (!data.active) {
        currentMedia.active = false;
        playerTitle.textContent = 'Tidak ada media aktif';
        playerArtist.textContent = 'Putar lagu di Spotify / YouTube / Browser';
        setPlayPauseIcon(false);
        return;
      }

      const trackChanged = data.trackKey !== currentMedia.trackKey;
      const statusChanged = data.status !== currentMedia.status;
      const coverChanged =
        typeof data.coverVersion === 'number' && data.coverVersion !== lastCoverVersion;

      const perfNow = performance.now();
      const predictedPos =
        currentMedia.status === 'Playing'
          ? mediaAnchorPos + (perfNow - mediaAnchorPerfMs) / 1000
          : mediaAnchorPos;
      const drift = Math.abs((data.position || 0) - predictedPos);

      // Re-anchor smoothly only on track/status change, seek, or >280ms drift to prevent 200ms jitter
      if (trackChanged || statusChanged || data.status !== 'Playing' || drift > 0.28 || isSeeking) {
        mediaAnchorPos = data.position || 0;
        mediaAnchorPerfMs = perfNow;
      }

      currentMedia = {
        ...data,
        updatedAt: Date.now(),
      };

      playerTitle.textContent = data.title || 'Unknown Title';
      playerArtist.textContent = data.artist || data.sourceApp || 'Media';
      setPlayPauseIcon(data.status === 'Playing');

      if (!isSeeking && data.duration > 0) {
        seekSlider.max = data.duration;
        seekSlider.value = Math.min(data.duration, data.position);
        timeCurrEl.textContent = formatTime(data.position);
        timeTotalEl.textContent = formatTime(data.duration);
      }

      if (trackChanged && data.title) {
        setSkipLoading(false);
        parsedLyrics = [];
        isSyncedLyrics = false;
        activeLyricIdx = -1;
        activeWordIdx = -1;
        renderLyricsList();
        fetchLyricsForTrack(data.title, data.artist, data.duration, false, data.album);
      }

      if ((trackChanged || coverChanged) && data.title) {
        lastCoverVersion = data.coverVersion || 0;
        if (data.hasCover) {
          fetchCoverForTrack(data.trackKey);
        } else {
          playerCover.classList.add('hidden');
          playerCoverFallback.classList.remove('hidden');
          coverBgImage = null;
        }
      }
    } catch (_) {}
  }

  function updateLiveTimelineAndLyrics() {
    if (!currentMedia.active) return;

    let livePos = mediaAnchorPos;
    if (currentMedia.status === 'Playing') {
      livePos += (performance.now() - mediaAnchorPerfMs) / 1000;
      if (currentMedia.duration > 0) livePos = Math.min(currentMedia.duration, livePos);
    }

    if (!isSeeking && currentMedia.duration > 0) {
      seekSlider.value = livePos;
      timeCurrEl.textContent = formatTime(livePos);
    }

    if (isSyncedLyrics && parsedLyrics.length > 0) {
      const t = livePos + lyricOffsetSec;
      let idx = -1;
      for (let i = 0; i < parsedLyrics.length; i++) {
        if (parsedLyrics[i].time <= t) idx = i;
        else break;
      }

      if (idx !== activeLyricIdx) {
        activeLyricIdx = idx;
        activeWordIdx = -1;
        lyricPrevEl.textContent = idx > 0 ? parsedLyrics[idx - 1].text : '';
        lyricNextEl.textContent = idx + 1 < parsedLyrics.length ? parsedLyrics[idx + 1].text : '';

        lyricCurrEl.classList.remove('line-enter');
        void lyricCurrEl.offsetWidth;
        cachedCinemaWords = buildWordSpans(lyricCurrEl, idx >= 0 ? parsedLyrics[idx] : '♪');
        lyricCurrEl.classList.add('line-enter');

        for (let i = 0; i < cachedLyricItems.length; i++) {
          const el = cachedLyricItems[i];
          el.classList.remove('active', 'dof-1', 'dof-2', 'dof-far');
          const dist = idx < 0 ? 3 : Math.abs(i - idx);
          if (i === idx) el.classList.add('active');
          else if (dist === 1) el.classList.add('dof-1');
          else if (dist === 2) el.classList.add('dof-2');
          else el.classList.add('dof-far');
        }
        cachedActivePanelWords =
          idx >= 0 && cachedLyricItems[idx]
            ? [...cachedLyricItems[idx].querySelectorAll('.lyric-word')]
            : [];
        scrollActiveLyricIntoCenter(false);
      }

      // Word-by-word illumination (Better Lyrics TTML / Enhanced LRC OR char-weighted interpolation)
      if (activeLyricIdx >= 0) {
        const lineObj = parsedLyrics[activeLyricIdx];
        const cinemaWords = cachedCinemaWords;
        const panelWords = cachedActivePanelWords;

        if (!lyricWordAnimToggle.checked) {
          if (activeWordIdx !== -2) {
            activeWordIdx = -2;
            for (const list of [cinemaWords, panelWords]) {
              for (const sp of list) {
                sp.classList.add('spoken');
                sp.classList.remove('word-active');
              }
            }
          }
        } else if (Array.isArray(lineObj.words) && lineObj.words.length > 0) {
          let wordIdx = 0;
          for (let wi = 0; wi < lineObj.words.length; wi++) {
            if (t >= lineObj.words[wi].start) wordIdx = wi;
            else break;
          }
          if (wordIdx !== activeWordIdx) {
            activeWordIdx = wordIdx;
            for (const list of [cinemaWords, panelWords]) {
              for (let wi = 0; wi < list.length; wi++) {
                const sp = list[wi];
                const wMeta = lineObj.words[wi];
                const isDone = wMeta ? t >= wMeta.end : wi < wordIdx;
                sp.classList.toggle('spoken', wi < wordIdx || isDone);
                sp.classList.toggle('word-active', wi === wordIdx && !isDone);
              }
            }
          }
        } else {
          const lineStart = lineObj.time;
          const nextTime =
            activeLyricIdx + 1 < parsedLyrics.length
              ? parsedLyrics[activeLyricIdx + 1].time
              : lineStart + 4.0;
          const totalWords = cinemaWords.length;
          if (totalWords > 0) {
            const totalChars = lineObj.text.length || totalWords * 4;
            // Smart vocal active window so long instrumental breaks don't crawl slowly
            const gap = Math.max(0.8, nextTime - lineStart);
            const estActiveDur = Math.min(gap - 0.08, Math.max(1.0, totalWords * 0.34 + totalChars * 0.032));
            const progress = Math.max(0, Math.min(0.999, (t - lineStart) / Math.max(0.6, estActiveDur)));

            // Weight duration by word length for natural speech cadence
            let totalWeight = 0;
            for (let wi = 0; wi < totalWords; wi++) {
              totalWeight += cinemaWords[wi].textContent.length + 1.5;
            }
            const targetWeight = progress * totalWeight;
            let acc = 0;
            let wordIdx = 0;
            for (let wi = 0; wi < totalWords; wi++) {
              acc += cinemaWords[wi].textContent.length + 1.5;
              if (acc >= targetWeight) {
                wordIdx = wi;
                break;
              }
            }
            if (wordIdx !== activeWordIdx) {
              activeWordIdx = wordIdx;
              for (const list of [cinemaWords, panelWords]) {
                for (let wi = 0; wi < list.length; wi++) {
                  list[wi].classList.toggle('spoken', wi < wordIdx);
                  list[wi].classList.toggle('word-active', wi === wordIdx);
                }
              }
            }
          }
        }
      }
    }

    pushOverlayState(false);

    const showCinema =
      (isWebOverlayMode || cinemaLyricsToggle.checked) &&
      currentMedia.active &&
      (isSyncedLyrics || parsedLyrics.length > 0) &&
      (isWebOverlayMode || lyricsPanel.classList.contains('hidden'));
    lyricsCinema.classList.toggle('hidden', !showCinema);
  }

  // --- DSP & VISUALIZER ---
  function mapExtendedFreq(t, minFreq, maxFreq) {
    const base = 120;
    return minFreq + (maxFreq - minFreq) * ((Math.pow(base, t) - 1) / (base - 1));
  }

  function computeAudioFeatures(barCount, mode, gain) {
    ensureBarArrays(barCount);
    const smoothing = Math.min(0.98, Math.max(0, getVal('smooth-num')));
    const attack = Math.min(1.0, Math.max(0.05, getVal('attack-num')));
    const release = Math.min(0.98, Math.max(0.05, getVal('release-num')));
    const spatialPasses = Math.round(Math.min(5, Math.max(0, getVal('spatial-num'))));
    const tiltAmount = getVal('tilt-num');
    const minFreq = getVal('min-freq-num');
    const maxFreq = getVal('max-freq-num');

    let activeFreqSource = bridgeFreqArr;
    let sampleRate = bridgeAudioSampleRate;
    let fftTotalBins = 4096; // 8192 / 2

    if (audioSourceMode === 'web' && analyser) {
      analyser.smoothingTimeConstant = smoothing;
      analyser.getByteFrequencyData(freqData);
      activeFreqSource = freqData;
      sampleRate = audioCtx.sampleRate || 48000;
      fftTotalBins = freqData.length;
    }

    const nyquist = sampleRate / 2;
    const freqLen = activeFreqSource.length;

    const bassMaxBin = Math.min(freqLen - 1, Math.max(2, Math.ceil((120 / nyquist) * fftTotalBins)));
    let bassSum = 0;
    for (let b = 0; b <= bassMaxBin; b++) bassSum += activeFreqSource[b];
    bassEnergy = bassSum / (bassMaxBin + 1) / 255;
    bassAvg = bassAvg * 0.94 + bassEnergy * 0.06;

    const delta = bassEnergy - bassAvg;
    const zoomThresh = getVal('zoom-thresh-num');
    if (delta > 0.08 && bassEnergy > 0.28) {
      beatImpulse = Math.max(beatImpulse, Math.min(1.5, delta * 4.5));
      if (rgbBeatToggle.checked && delta > 0.11) {
        rgbFlash = Math.max(rgbFlash, Math.min(1.0, delta * 5.0));
      }
    }
    beatImpulse *= 0.84;
    rgbFlash *= 0.82;

    if (beatZoomToggle.checked) {
      const zoomAmp = getVal('zoom-amp-num') / 100;
      const zoomSmooth = Math.min(0.97, Math.max(0.4, getVal('zoom-smooth-num')));
      const punch = delta > zoomThresh ? Math.min(1.3, (delta - zoomThresh) * 5.5) : 0;
      const targetZoom = 1.0 + (bassEnergy * 0.35 + punch * 0.65) * zoomAmp;
      if (targetZoom > beatZoomCurrent) {
        beatZoomCurrent = beatZoomCurrent * 0.35 + targetZoom * 0.65;
      } else {
        beatZoomCurrent = beatZoomCurrent * zoomSmooth + targetZoom * (1 - zoomSmooth);
      }
    } else {
      beatZoomCurrent += (1.0 - beatZoomCurrent) * 0.2;
    }

    if (mode === 'waveform') {
      if (audioSourceMode === 'web' && analyser) {
        analyser.getFloatTimeDomainData(timeData);
        const step = Math.floor(timeData.length / barCount);
        for (let i = 0; i < barCount; i++) {
          let peak = 0;
          const start = i * step;
          const end = Math.min(start + step, timeData.length);
          for (let j = start; j < end; j++) {
            const v = Math.abs(timeData[j]);
            if (v > peak) peak = v;
          }
          const target = Math.min(1, peak * gain * 1.45);
          const coeff = target > smoothedBars[i] ? 1 - attack : release;
          smoothedBars[i] = smoothedBars[i] * coeff + target * (1 - coeff);
        }
      } else {
        const wLen = bridgeWaveArr.length;
        for (let i = 0; i < barCount; i++) {
          const idx = Math.min(wLen - 1, Math.floor((i / barCount) * wLen));
          const target = Math.min(1, (bridgeWaveArr[idx] / 255) * gain * 1.45);
          const coeff = target > smoothedBars[i] ? 1 - attack : release;
          smoothedBars[i] = smoothedBars[i] * coeff + target * (1 - coeff);
        }
      }
    } else {
      const clampedMax = Math.min(Math.max(maxFreq, minFreq + 200), nyquist);
      for (let i = 0; i < barCount; i++) {
        const t0 = i / barCount;
        const t1 = (i + 1) / barCount;
        const f0 = mapExtendedFreq(t0, minFreq, clampedMax);
        const f1 = mapExtendedFreq(t1, minFreq, clampedMax);

        const lowF = Math.min(Math.abs(f0), Math.abs(f1));
        const highF = Math.max(Math.abs(f0), Math.abs(f1));
        const binStart = Math.max(0, Math.min(freqLen - 1, Math.floor((lowF / nyquist) * fftTotalBins)));
        const binEnd = Math.min(freqLen - 1, Math.max(binStart, Math.ceil((highF / nyquist) * fftTotalBins)));

        let peak = 0;
        let sum = 0;
        let count = 0;
        for (let b = binStart; b <= binEnd; b++) {
          const val = activeFreqSource[b];
          if (val > peak) peak = val;
          sum += val;
          count++;
        }

        const avg = count > 0 ? sum / count / 255 : 0;
        const blended = avg * 0.65 + (peak / 255) * 0.35;
        const tilt = 0.85 + t0 * tiltAmount;
        const target = Math.min(1, Math.pow(blended, 1.08) * gain * tilt);
        const coeff = target > smoothedBars[i] ? 1 - attack : release;
        smoothedBars[i] = smoothedBars[i] * coeff + target * (1 - coeff);
      }
    }

    for (let pass = 0; pass < spatialPasses; pass++) {
      for (let i = 0; i < barCount; i++) {
        const prev = smoothedBars[Math.max(0, i - 1)];
        const next = smoothedBars[Math.min(barCount - 1, i + 1)];
        scratchBars[i] = prev * 0.22 + smoothedBars[i] * 0.56 + next * 0.22;
      }
      smoothedBars.set(scratchBars);
    }

    for (let i = 0; i < barCount; i++) {
      if (smoothedBars[i] >= peakBars[i]) {
        peakBars[i] = smoothedBars[i];
        peakVelocity[i] = 0;
      } else {
        peakVelocity[i] += 0.0009;
        peakBars[i] = Math.max(smoothedBars[i], peakBars[i] - peakVelocity[i]);
      }
    }

    return smoothedBars;
  }

  function createThemeGradient(theme, x0, y0, x1, y1, overrideColor = null) {
    if (overrideColor) return overrideColor;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    theme.stops.forEach((color, idx) => {
      grad.addColorStop(idx / Math.max(1, theme.stops.length - 1), color);
    });
    return grad;
  }

  function drawImageCover(img, width, height, clearAlpha) {
    const blurPx = getVal('bg-blur-num');
    let sourceToDraw = img;

    // Offscreen pre-blur cache avoids running expensive full-screen blur every frame
    if (blurPx > 0) {
      if (blurredBgCache.img !== img || Math.abs(blurredBgCache.blur - blurPx) > 0.4) {
        const targetW = 640;
        const targetH = Math.max(180, Math.round((img.height / Math.max(1, img.width)) * targetW));
        const off = blurredBgCache.canvas;
        const scaledBlur = Math.max(1, (blurPx * targetW) / Math.max(640, width));
        const pad = Math.ceil(scaledBlur * 2);
        off.width = targetW + pad * 2;
        off.height = targetH + pad * 2;
        const octx = off.getContext('2d');
        octx.clearRect(0, 0, off.width, off.height);
        octx.filter = `blur(${scaledBlur.toFixed(1)}px)`;
        octx.drawImage(img, pad, pad, targetW, targetH);
        octx.filter = 'none';
        blurredBgCache.img = img;
        blurredBgCache.blur = blurPx;
      }
      sourceToDraw = blurredBgCache.canvas;
    }

    ctx.save();
    ctx.globalAlpha = clearAlpha;
    const srcW = sourceToDraw.width;
    const srcH = sourceToDraw.height;
    const imgRatio = srcW / Math.max(1, srcH);
    const winRatio = width / Math.max(1, height);
    let drawW = width;
    let drawH = height;
    if (winRatio > imgRatio) {
      drawW = width;
      drawH = drawW / imgRatio;
    } else {
      drawH = height;
      drawW = drawH * imgRatio;
    }
    ctx.drawImage(sourceToDraw, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);

    const tintAlpha = getVal('bg-tint-num');
    if (tintAlpha > 0) {
      const tintRgb = bgTintColor.value === 'white' ? '255, 255, 255' : '0, 0, 0';
      ctx.fillStyle = `rgba(${tintRgb}, ${tintAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  function drawBackground(theme, width, height) {
    const motionBlur = Math.min(0.95, Math.max(0, getVal('motion-blur-num')));
    const clearAlpha = 1 - motionBlur;
    const baseRgb = visLightMode ? '247, 246, 241' : '0, 0, 0';
    const bgMode = bgSelect.value;

    if (bgMode === 'image' && customBgImage) {
      drawImageCover(customBgImage, width, height, clearAlpha);
    } else if (bgMode === 'cover' && coverBgImage) {
      drawImageCover(coverBgImage, width, height, clearAlpha);
    } else {
      ctx.fillStyle = `rgba(${baseRgb}, ${clearAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }

    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.hypot(cx, cy);

    if (bgMode === 'pulse' || (bgMode === 'cover' && !coverBgImage)) {
      const pulseBright = getVal('pulse-bright-num');
      const intensity = (0.07 + bassEnergy * 0.25 + beatImpulse * 0.14) * pulseBright;
      if (intensity > 0.005) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.85, intensity) * clearAlpha;
        const g = ctx.createRadialGradient(
          cx,
          cy,
          10,
          cx,
          cy,
          maxR * (0.45 + bassEnergy * 0.35 * Math.min(1.5, pulseBright))
        );
        g.addColorStop(0, theme.glow);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    } else if (bgMode === 'nebula') {
      const c1 = theme.stops[0];
      const c2 = theme.stops[theme.stops.length - 1];
      const x1 = cx + Math.cos(timeSec * 0.35) * width * 0.22;
      const y1 = cy + Math.sin(timeSec * 0.28) * height * 0.18;
      const x2 = cx - Math.cos(timeSec * 0.31) * width * 0.22;
      const y2 = cy - Math.sin(timeSec * 0.24) * height * 0.18;

      ctx.save();
      ctx.globalAlpha = (0.16 + bassEnergy * 0.2) * clearAlpha;
      const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, maxR * 0.55);
      g1.addColorStop(0, c1);
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, maxR * 0.55);
      g2.addColorStop(0, c2);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    } else if (bgMode === 'starfield') {
      ctx.save();
      ctx.fillStyle = visLightMode ? '#27272a' : '#ffffff';
      const boost = 1 + bassEnergy * 6 + beatImpulse * 5;
      for (const s of stars) {
        s.dist += s.speed * boost;
        if (s.dist > 1) {
          s.dist = 0.02;
          s.angle = Math.random() * Math.PI * 2;
        }
        const r = s.dist * maxR;
        const sx = cx + Math.cos(s.angle) * r;
        const sy = cy + Math.sin(s.angle) * r;
        ctx.globalAlpha = Math.min(0.85, s.dist * 0.9);
        ctx.beginPath();
        ctx.arc(sx, sy, s.size * (0.6 + s.dist * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const vigStrength = getVal('bg-vignette-num');
    if (vigStrength > 0) {
      const vig = ctx.createRadialGradient(cx, cy, maxR * 0.28, cx, cy, maxR);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, `rgba(0, 0, 0, ${vigStrength})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawParticles(theme, width, height) {
    if (!particlesToggle.checked || ecoModeToggle.checked) return;
    ctx.save();
    const boost = 1 + bassEnergy * 3.5 + beatImpulse * 3;
    ctx.fillStyle = visLightMode && colorSelect.value === 'white' ? '#27272a' : theme.peak;
    for (const p of particles) {
      p.x += p.vx * boost;
      p.y += p.vy * boost;
      if (p.y < -0.05 || p.x < -0.05 || p.x > 1.05) {
        p.x = Math.random();
        p.y = 1.04;
      }
      ctx.globalAlpha = p.alpha * (0.45 + bassEnergy * 0.55);
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCanvasTrackBanner(width) {
    if (!canvasTitleToggle.checked || !currentMedia.active || !currentMedia.title) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = visLightMode ? 'rgba(24, 24, 27, 0.72)' : 'rgba(255, 255, 255, 0.78)';
    ctx.font = '600 15px Inter, system-ui, sans-serif';
    ctx.fillText(currentMedia.title, width / 2, 34);
    if (currentMedia.artist) {
      ctx.fillStyle = visLightMode ? 'rgba(24, 24, 27, 0.48)' : 'rgba(255, 255, 255, 0.48)';
      ctx.font = '400 12px Inter, system-ui, sans-serif';
      ctx.fillText(currentMedia.artist, width / 2, 54);
    }
    ctx.restore();
  }

  function drawFrequencyRuler(width, height) {
    if (!rulerToggle.checked || modeSelect.value === 'radial') return;

    const minFreq = getVal('min-freq-num');
    const maxFreq = getVal('max-freq-num');
    const horizontalMargin = Math.min(80, width * 0.07);
    const usableWidth = Math.max(120, width - horizontalMargin * 2);

    const posMode = rulerPosSelect.value;
    let rulerY = height * (getVal('ruler-y-num') / 100);
    if (posMode === 'bottom') {
      rulerY = modeSelect.value === 'reflection' ? height * 0.62 + 22 : height - 108;
    } else if (posMode === 'center') {
      rulerY = height * 0.5;
    } else if (posMode === 'top') {
      rulerY = 74;
    }

    const candidates = [
      -500, -400, -300, -200, -100, -50, 0, 20, 40, 60, 100, 200, 400, 800, 1000, 2000, 4000,
      8000, 12000, 16000, 20000, 24000,
    ];
    const base = 120;

    ctx.save();
    ctx.strokeStyle = visLightMode ? 'rgba(24, 24, 27, 0.24)' : 'rgba(255, 255, 255, 0.24)';
    ctx.fillStyle = visLightMode ? 'rgba(24, 24, 27, 0.65)' : 'rgba(255, 255, 255, 0.62)';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(horizontalMargin, rulerY);
    ctx.lineTo(width - horizontalMargin, rulerY);
    ctx.stroke();

    let lastLabelX = -999;
    const minLabelGap = 54;

    for (const f of candidates) {
      if (f < minFreq || f > maxFreq) continue;
      const ratio = (f - minFreq) / Math.max(1, maxFreq - minFreq);
      const t = Math.log(1 + ratio * (base - 1)) / Math.log(base);
      const x = horizontalMargin + t * usableWidth;

      ctx.beginPath();
      ctx.moveTo(x, rulerY - 3);
      ctx.lineTo(x, rulerY + 3);
      ctx.stroke();

      if (x - lastLabelX >= minLabelGap) {
        ctx.beginPath();
        ctx.moveTo(x, rulerY - 5);
        ctx.lineTo(x, rulerY + 5);
        ctx.stroke();
        ctx.fillText(formatFreq(f), x, rulerY + 17);
        lastLabelX = x;
      }
    }
    ctx.restore();
  }

  function applyDeepGlowAndStroke(drawPathFn, theme, strokeStyle, barWidth, isOverride) {
    const glowPx = getVal('glow-num');
    const glowSpread = getVal('glow-spread-num');

    if (!isOverride && glowPx > 0) {
      ctx.save();
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = glowPx * 1.45;
      ctx.strokeStyle = theme.glow;
      ctx.globalAlpha = 0.44;
      ctx.lineWidth = barWidth * glowSpread;
      drawPathFn();
      ctx.restore();

      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = glowPx * 0.7;
    }

    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = barWidth;
    drawPathFn();
  }

  function drawSpectrumOrBars(values, theme, width, height, overrideColor = null) {
    const barCount = values.length;
    const horizontalMargin = Math.min(80, width * 0.07);
    const usableWidth = Math.max(120, width - horizontalMargin * 2);
    const pitch = usableWidth / barCount;
    const barWidth = Math.max(1.8, Math.min(14, pitch * getVal('thickness-num')));
    const maxHeightRatio = getVal('height-num');
    const isMirror = mirrorToggle.checked;
    const isReflection = modeSelect.value === 'reflection';

    const strokeStyle = createThemeGradient(theme, horizontalMargin, 0, width - horizontalMargin, 0, overrideColor);

    ctx.save();
    ctx.lineCap = 'round';

    if (isReflection) {
      const floorY = height * 0.62;
      const maxH = height * maxHeightRatio * 1.15;

      applyDeepGlowAndStroke(
        () => {
          ctx.beginPath();
          for (let i = 0; i < barCount; i++) {
            const x = horizontalMargin + i * pitch + pitch * 0.5;
            const h = Math.max(2, values[i] * maxH);
            ctx.moveTo(x, floorY);
            ctx.lineTo(x, floorY - h);
          }
          ctx.stroke();
        },
        theme,
        strokeStyle,
        barWidth,
        Boolean(overrideColor)
      );

      if (!overrideColor) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = barWidth;
        ctx.beginPath();
        for (let i = 0; i < barCount; i++) {
          const x = horizontalMargin + i * pitch + pitch * 0.5;
          const h = Math.max(1, values[i] * maxH * 0.45);
          ctx.moveTo(x, floorY + 4);
          ctx.lineTo(x, floorY + 4 + h);
        }
        ctx.stroke();
      }
    } else if (isMirror) {
      const centerY = height / 2;
      const maxHalfH = height * maxHeightRatio;

      applyDeepGlowAndStroke(
        () => {
          ctx.beginPath();
          for (let i = 0; i < barCount; i++) {
            const x = horizontalMargin + i * pitch + pitch * 0.5;
            const dy = Math.max(0.5, values[i] * maxHalfH);
            ctx.moveTo(x, centerY - dy);
            ctx.lineTo(x, centerY + dy);
          }
          ctx.stroke();
        },
        theme,
        strokeStyle,
        barWidth,
        Boolean(overrideColor)
      );

      if (!overrideColor && peakToggle.checked) {
        ctx.shadowBlur = getVal('glow-num') * 0.4;
        ctx.fillStyle = theme.peak;
        const dotR = Math.max(1.2, barWidth * 0.42);
        ctx.beginPath();
        for (let i = 0; i < barCount; i++) {
          if (peakBars[i] < 0.03) continue;
          const x = horizontalMargin + i * pitch + pitch * 0.5;
          const py = peakBars[i] * maxHalfH + barWidth * 1.15;
          ctx.moveTo(x + dotR, centerY - py);
          ctx.arc(x, centerY - py, dotR, 0, Math.PI * 2);
          ctx.moveTo(x + dotR, centerY + py);
          ctx.arc(x, centerY + py, dotR, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    } else {
      const baseY = height * 0.84;
      const maxH = height * maxHeightRatio * 1.5;

      applyDeepGlowAndStroke(
        () => {
          ctx.beginPath();
          for (let i = 0; i < barCount; i++) {
            const x = horizontalMargin + i * pitch + pitch * 0.5;
            const h = Math.max(2, values[i] * maxH);
            ctx.moveTo(x, baseY);
            ctx.lineTo(x, baseY - h);
          }
          ctx.stroke();
        },
        theme,
        strokeStyle,
        barWidth,
        Boolean(overrideColor)
      );
    }
    ctx.restore();
  }

  function drawSilkRibbon(values, theme, width, height, overrideColor = null) {
    const barCount = values.length;
    const horizontalMargin = Math.min(80, width * 0.07);
    const usableWidth = Math.max(120, width - horizontalMargin * 2);
    const maxHalfHeight = height * getVal('height-num');
    const centerY = height / 2;

    const strokeStyle = createThemeGradient(theme, horizontalMargin, 0, width - horizontalMargin, 0, overrideColor);

    const buildHalfPath = (sign) => {
      ctx.beginPath();
      for (let i = 0; i < barCount; i++) {
        const x = horizontalMargin + (i / (barCount - 1)) * usableWidth;
        const y = centerY + sign * Math.max(1, values[i] * maxHalfHeight);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = horizontalMargin + ((i - 1) / (barCount - 1)) * usableWidth;
          const prevY = centerY + sign * Math.max(1, values[i - 1] * maxHalfHeight);
          ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2);
        }
      }
      ctx.stroke();
    };

    ctx.save();
    applyDeepGlowAndStroke(
      () => {
        buildHalfPath(-1);
        if (mirrorToggle.checked) buildHalfPath(1);
      },
      theme,
      strokeStyle,
      2.6,
      Boolean(overrideColor)
    );

    if (!overrideColor) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = strokeStyle;
      ctx.beginPath();
      ctx.moveTo(horizontalMargin, centerY);
      for (let i = 0; i < barCount; i++) {
        ctx.lineTo(horizontalMargin + (i / (barCount - 1)) * usableWidth, centerY - Math.max(1, values[i] * maxHalfHeight));
      }
      if (mirrorToggle.checked) {
        for (let i = barCount - 1; i >= 0; i--) {
          ctx.lineTo(horizontalMargin + (i / (barCount - 1)) * usableWidth, centerY + Math.max(1, values[i] * maxHalfHeight));
        }
      } else {
        ctx.lineTo(horizontalMargin + usableWidth, centerY);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRadialRing(values, theme, width, height, overrideColor = null) {
    const barCount = values.length;
    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);
    const baseRadius = minDim * (0.19 + bassEnergy * 0.03);
    const maxSpike = minDim * (getVal('height-num') * 0.65);

    const strokeStyle = createThemeGradient(theme, cx - baseRadius, cy, cx + baseRadius, cy, overrideColor);
    const barWidth = Math.max(1.8, Math.min(7, ((2 * Math.PI * baseRadius) / barCount) * getVal('thickness-num')));

    ctx.save();
    ctx.lineCap = 'round';
    applyDeepGlowAndStroke(
      () => {
        ctx.beginPath();
        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
          const amp = values[i] * maxSpike;
          const rIn = mirrorToggle.checked ? Math.max(10, baseRadius - amp * 0.35) : baseRadius;
          const rOut = baseRadius + Math.max(2, amp);
          ctx.moveTo(cx + Math.cos(angle) * rIn, cy + Math.sin(angle) * rIn);
          ctx.lineTo(cx + Math.cos(angle) * rOut, cy + Math.sin(angle) * rOut);
        }
        ctx.stroke();
      },
      theme,
      strokeStyle,
      barWidth,
      Boolean(overrideColor)
    );

    if (!overrideColor && peakToggle.checked) {
      ctx.fillStyle = theme.peak;
      ctx.beginPath();
      for (let i = 0; i < barCount; i++) {
        if (peakBars[i] < 0.04) continue;
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const rPeak = baseRadius + peakBars[i] * maxSpike + 7;
        const px = cx + Math.cos(angle) * rPeak;
        const py = cy + Math.sin(angle) * rPeak;
        ctx.moveTo(px + 1.8, py);
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  function renderVisualMode(values, theme, width, height, overrideColor = null) {
    const mode = modeSelect.value;
    if (mode === 'ribbon') drawSilkRibbon(values, theme, width, height, overrideColor);
    else if (mode === 'radial') drawRadialRing(values, theme, width, height, overrideColor);
    else drawSpectrumOrBars(values, theme, width, height, overrideColor);
  }

  function getCameraTransform() {
    let tx = 0;
    let ty = 0;
    let rot = 0;

    const shakeMult = getVal('shake-num');
    if (shakeMult > 0 && beatImpulse > 0.02) {
      const mag = beatImpulse * 10 * shakeMult;
      tx += (Math.random() - 0.5) * 2 * mag;
      ty += (Math.random() - 0.5) * 2 * mag;
    }

    if (wiggleToggle.checked) {
      const amp = getVal('wiggle-amp-num');
      const spd = getVal('wiggle-speed-num');
      const rotDeg = getVal('wiggle-rot-num');
      const t = timeSec * spd;
      const boost = 1 + bassEnergy * 0.6;

      tx += (Math.sin(t * 1.1) * 0.6 + Math.sin(t * 2.3 + 1.4) * 0.4) * amp * boost;
      ty += (Math.cos(t * 0.9 + 0.7) * 0.6 + Math.sin(t * 1.9 + 2.1) * 0.4) * amp * boost;
      rot += (Math.sin(t * 0.7 + 0.3) * 0.7 + Math.cos(t * 1.7) * 0.3) * ((rotDeg * Math.PI) / 180);
    }

    return { tx, ty, rot };
  }

  function drawFrame(values) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const theme = getActiveTheme();

    drawBackground(theme, width, height);
    drawParticles(theme, width, height);

    const cam = getCameraTransform();

    ctx.save();
    ctx.translate(width / 2 + cam.tx, height / 2 + cam.ty);
    ctx.scale(beatZoomCurrent, beatZoomCurrent);
    ctx.rotate(cam.rot);
    ctx.translate(-width / 2, -height / 2);

    if (rgbBeatToggle.checked && rgbFlash > 0.04) {
      const shift = rgbFlash * 10;
      ctx.save();
      ctx.globalCompositeOperation = visLightMode ? 'multiply' : 'screen';
      ctx.globalAlpha = Math.min(0.65, rgbFlash * 0.7);

      ctx.save();
      ctx.translate(-shift, 0);
      renderVisualMode(values, theme, width, height, '#ff2a55');
      ctx.restore();

      ctx.save();
      ctx.translate(shift, 0);
      renderVisualMode(values, theme, width, height, '#00f0ff');
      ctx.restore();
      ctx.restore();
    }

    renderVisualMode(values, theme, width, height, null);
    drawFrequencyRuler(width, height);
    ctx.restore();

    drawCanvasTrackBanner(width);
  }

  function drawIdleFrame() {
    const barCount = Math.max(16, Math.round(getVal('bars-num')));
    ensureBarArrays(barCount);
    drawFrame(new Float32Array(barCount));
  }

  function renderLoop(now) {
    if (audioSourceMode === 'none') return;
    if (!isVisualizerActive()) {
      animationId = null;
      return;
    }
    animationId = requestAnimationFrame(renderLoop);

    const fpsLimit = getVal('fps-num');
    if (fpsLimit > 0 && now - lastFrameTime < 1000 / fpsLimit) return;

    const dt = Math.min(0.05, (now - lastFrameTime) / 1000 || 0.016);
    lastFrameTime = now;
    timeSec += dt;

    updateLiveTimelineAndLyrics();

    const barCount = Math.max(16, Math.round(getVal('bars-num')));
    const values = computeAudioFeatures(barCount, modeSelect.value, getVal('gain-num'));
    drawFrame(values);
  }

  // --- SELECTIVE CRUD PRESETS ---
  function getUserPresets() {
    try {
      return JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveUserPresets(obj) {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(obj));
  }

  let autoSaveTimer = null;
  function saveLastActiveState(immediate = false) {
    const doSave = () => {
      try {
        const state = captureCurrentSettings();
        localStorage.setItem(LAST_SESSION_STATE_KEY, JSON.stringify(state));
      } catch (_) {}
    };

    if (immediate) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      doSave();
    } else {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(doSave, 300);
    }
  }

  function loadLastActiveState() {
    try {
      const raw = localStorage.getItem(LAST_SESSION_STATE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function captureCurrentSettings() {
    return {
      vis: {
        mode: modeSelect.value,
        minFreq: getVal('min-freq-num'),
        maxFreq: getVal('max-freq-num'),
        gain: getVal('gain-num'),
        tilt: getVal('tilt-num'),
        smooth: getVal('smooth-num'),
        attack: getVal('attack-num'),
        release: getVal('release-num'),
        spatial: getVal('spatial-num'),
        fps: getVal('fps-num'),
        bars: getVal('bars-num'),
        thickness: getVal('thickness-num'),
        height: getVal('height-num'),
        glow: getVal('glow-num'),
        glowSpread: getVal('glow-spread-num'),
        motionBlur: getVal('motion-blur-num'),
        shake: getVal('shake-num'),
        beatZoom: beatZoomToggle.checked,
        zoomAmp: getVal('zoom-amp-num'),
        zoomSmooth: getVal('zoom-smooth-num'),
        zoomThresh: getVal('zoom-thresh-num'),
        wiggle: wiggleToggle.checked,
        wiggleAmp: getVal('wiggle-amp-num'),
        wiggleSpeed: getVal('wiggle-speed-num'),
        wiggleRot: getVal('wiggle-rot-num'),
        mirror: mirrorToggle.checked,
        ruler: rulerToggle.checked,
        rulerPos: rulerPosSelect.value,
        rulerY: getVal('ruler-y-num'),
        peaks: peakToggle.checked,
        particles: particlesToggle.checked,
        rgbBeat: rgbBeatToggle.checked,
        canvasTitle: canvasTitleToggle.checked,
        cinemaLyrics: cinemaLyricsToggle.checked,
        visLight: visLightMode,
        dpr: getVal('dpr-num'),
        ecoMode: ecoModeToggle.checked,
        visEnabled: visualizerEnabled,
      },
      ui: {
        uiTheme: uiThemeSelect.value,
        accent: uiAccentPicker.value,
        lyricScale: getVal('lyric-scale-num'),
        lyricDof: getVal('lyric-dof-num'),
        lyricWordAnim: lyricWordAnimToggle.checked,
        lyricOffset: lyricOffsetSec,
        mediaScope: mediaScopeSelect ? mediaScopeSelect.value : 'music',
        overlayPos: overlayPosSelect ? overlayPosSelect.value : 'top',
        overlayWidth: getVal('overlay-width-num') || 460,
        overlayScale: getVal('overlay-scale-num') || 1.15,
        overlayOpacity: getVal('overlay-opacity-num') || 0.95,
        overlayBgOpacity: getVal('overlay-bg-opacity-num'),
        overlayBgColor: overlayBgColor ? overlayBgColor.value : '#0f1014',
        overlayOutlineColor: overlayOutlineColor ? overlayOutlineColor.value : '#ffffff',
        overlayTextColor: overlayTextColor ? overlayTextColor.value : '#ffffff',
        overlayActiveColor: overlayActiveColor ? overlayActiveColor.value : '#7dd3fc',
        overlayDofBlur: overlayDofToggle ? overlayDofToggle.checked : true,
        overlayLyricsStyle: overlayStyleSelect ? overlayStyleSelect.value : 'cinema',
        overlayShowBg: overlayBgToggle ? overlayBgToggle.checked : true,
        overlayShowOutline: overlayOutlineToggle ? overlayOutlineToggle.checked : true,
        overlayTextShadow: overlayShadowToggle ? overlayShadowToggle.checked : true,
        overlayShowControls: overlayControlsToggle ? overlayControlsToggle.checked : true,
        overlayPrevNext: overlayPrevNextToggle ? overlayPrevNextToggle.checked : true,
        overlayClickThrough: overlayClickThroughToggle ? overlayClickThroughToggle.checked : false,
        lgBlur: getVal('lg-blur-num'),
        lgRefract: getVal('lg-refract-num'),
        lgChroma: getVal('lg-chroma-num'),
        lgEdge: getVal('lg-edge-num'),
        lgSpecular: getVal('lg-specular-num'),
        lgFresnel: getVal('lg-fresnel-num'),
        lgDistort: getVal('lg-distort-num'),
        lgRadius: getVal('lg-radius-num'),
        lgZradius: getVal('lg-zradius-num'),
        lgOpacity: getVal('lg-opacity-num'),
        lgSat: getVal('lg-sat-num'),
        lgBright: getVal('lg-bright-num'),
        lgShadowOp: getVal('lg-shadow-op-num'),
        lgShadowSp: getVal('lg-shadow-sp-num'),
        lgBevel: getVal('lg-bevel-num'),
      },
      bg: {
        bg: bgSelect.value,
        bgUrl: customBgImageSrc,
        bgBlur: getVal('bg-blur-num'),
        bgTintColor: bgTintColor.value,
        bgTint: getVal('bg-tint-num'),
        bgVignette: getVal('bg-vignette-num'),
        pulseBright: getVal('pulse-bright-num'),
      },
      color: {
        theme: colorSelect.value,
        customColor: customColorToggle.checked,
        cStart: colorStartInput.value,
        cMid: colorMidInput.value,
        cEnd: colorEndInput.value,
        cGlow: colorGlowInput.value,
      },
    };
  }

  function setPair(sliderId, numId, val) {
    if (val === undefined) return;
    document.getElementById(sliderId).value = val;
    document.getElementById(numId).value = val;
  }

  function applySettings(cfg) {
    if (!cfg) return;

    if (applyVisCheck.checked && cfg.vis) {
      const v = cfg.vis;
      if (v.mode) modeSelect.value = v.mode;
      setPair('min-freq-slider', 'min-freq-num', v.minFreq);
      setPair('max-freq-slider', 'max-freq-num', v.maxFreq);
      setPair('gain-slider', 'gain-num', v.gain);
      setPair('tilt-slider', 'tilt-num', v.tilt);
      setPair('smooth-slider', 'smooth-num', v.smooth);
      setPair('attack-slider', 'attack-num', v.attack);
      setPair('release-slider', 'release-num', v.release);
      setPair('spatial-slider', 'spatial-num', v.spatial);
      setPair('fps-slider', 'fps-num', v.fps);
      setPair('bars-slider', 'bars-num', v.bars);
      setPair('thickness-slider', 'thickness-num', v.thickness);
      setPair('height-slider', 'height-num', v.height);
      setPair('glow-slider', 'glow-num', v.glow);
      setPair('glow-spread-slider', 'glow-spread-num', v.glowSpread);
      setPair('motion-blur-slider', 'motion-blur-num', v.motionBlur);
      setPair('shake-slider', 'shake-num', v.shake);
      setPair('zoom-amp-slider', 'zoom-amp-num', v.zoomAmp);
      setPair('zoom-smooth-slider', 'zoom-smooth-num', v.zoomSmooth);
      setPair('zoom-thresh-slider', 'zoom-thresh-num', v.zoomThresh);
      setPair('ruler-y-slider', 'ruler-y-num', v.rulerY);
      setPair('wiggle-amp-slider', 'wiggle-amp-num', v.wiggleAmp);
      setPair('wiggle-speed-slider', 'wiggle-speed-num', v.wiggleSpeed);
      setPair('wiggle-rot-slider', 'wiggle-rot-num', v.wiggleRot);
      if (v.beatZoom !== undefined) beatZoomToggle.checked = v.beatZoom;
      if (v.rulerPos) rulerPosSelect.value = v.rulerPos;
      if (v.wiggle !== undefined) wiggleToggle.checked = v.wiggle;
      if (v.mirror !== undefined) mirrorToggle.checked = v.mirror;
      if (v.ruler !== undefined) rulerToggle.checked = v.ruler;
      if (v.peaks !== undefined) peakToggle.checked = v.peaks;
      if (v.particles !== undefined) particlesToggle.checked = v.particles;
      if (v.rgbBeat !== undefined) rgbBeatToggle.checked = v.rgbBeat;
      if (v.canvasTitle !== undefined) canvasTitleToggle.checked = v.canvasTitle;
      if (v.cinemaLyrics !== undefined) cinemaLyricsToggle.checked = v.cinemaLyrics;
      if (v.visLight !== undefined) visLightMode = v.visLight;
      setPair('dpr-slider', 'dpr-num', v.dpr);
      if (v.ecoMode !== undefined) ecoModeToggle.checked = v.ecoMode;
      if (v.visEnabled !== undefined) {
        visualizerEnabled = v.visEnabled;
        updateVisualizerPowerState();
      }
      resizeCanvas();
    }

    if (applyUiCheck.checked && cfg.ui) {
      const u = cfg.ui;
      if (u.uiTheme) {
        uiThemeSelect.value = u.uiTheme;
        document.documentElement.dataset.uiTheme = u.uiTheme;
      }
      if (u.accent) applyUiAccent(u.accent);
      setPair('lyric-scale-slider', 'lyric-scale-num', u.lyricScale);
      setPair('lyric-dof-slider', 'lyric-dof-num', u.lyricDof);
      if (u.lyricWordAnim !== undefined) lyricWordAnimToggle.checked = u.lyricWordAnim;
      if (u.lyricOffset !== undefined) {
        lyricOffsetSec = u.lyricOffset;
        lyricOffsetVal.textContent = `${lyricOffsetSec >= 0 ? '+' : ''}${lyricOffsetSec.toFixed(1)}s`;
      }
      if (u.mediaScope && mediaScopeSelect) {
        syncMediaScopeOptions([], u.mediaScope);
        mediaScopeSelect.value = u.mediaScope;
        fetch(`${BRIDGE_MEDIA_URL}/api/control?cmd=scope&val=${encodeURIComponent(u.mediaScope)}`).catch(() => {});
      }
      if (u.overlayPos && overlayPosSelect) overlayPosSelect.value = u.overlayPos;
      setPair('overlay-width-slider', 'overlay-width-num', u.overlayWidth);
      setPair('overlay-scale-slider', 'overlay-scale-num', u.overlayScale);
      setPair('overlay-opacity-slider', 'overlay-opacity-num', u.overlayOpacity);
      setPair('overlay-bg-opacity-slider', 'overlay-bg-opacity-num', u.overlayBgOpacity);
      if (u.overlayBgColor && overlayBgColor) overlayBgColor.value = u.overlayBgColor;
      if (u.overlayOutlineColor && overlayOutlineColor) overlayOutlineColor.value = u.overlayOutlineColor;
      if (u.overlayTextColor && overlayTextColor) overlayTextColor.value = u.overlayTextColor;
      if (u.overlayActiveColor && overlayActiveColor) overlayActiveColor.value = u.overlayActiveColor;
      if (u.overlayDofBlur !== undefined && overlayDofToggle) overlayDofToggle.checked = u.overlayDofBlur;
      if (u.overlayLyricsStyle && overlayStyleSelect) overlayStyleSelect.value = u.overlayLyricsStyle;
      if (u.overlayShowBg !== undefined && overlayBgToggle) overlayBgToggle.checked = u.overlayShowBg;
      if (u.overlayShowOutline !== undefined && overlayOutlineToggle) overlayOutlineToggle.checked = u.overlayShowOutline;
      if (u.overlayTextShadow !== undefined && overlayShadowToggle) overlayShadowToggle.checked = u.overlayTextShadow;
      if (u.overlayShowControls !== undefined && overlayControlsToggle) overlayControlsToggle.checked = u.overlayShowControls;
      if (u.overlayPrevNext !== undefined && overlayPrevNextToggle) {
        overlayPrevNextToggle.checked = u.overlayPrevNext;
      }
      if (u.overlayClickThrough !== undefined && overlayClickThroughToggle) {
        overlayClickThroughToggle.checked = u.overlayClickThrough;
      }
      updateLyricAppearanceVars();
      setPair('lg-blur-slider', 'lg-blur-num', u.lgBlur);
      setPair('lg-refract-slider', 'lg-refract-num', u.lgRefract);
      setPair('lg-chroma-slider', 'lg-chroma-num', u.lgChroma);
      setPair('lg-edge-slider', 'lg-edge-num', u.lgEdge);
      setPair('lg-specular-slider', 'lg-specular-num', u.lgSpecular);
      setPair('lg-fresnel-slider', 'lg-fresnel-num', u.lgFresnel);
      setPair('lg-distort-slider', 'lg-distort-num', u.lgDistort);
      setPair('lg-radius-slider', 'lg-radius-num', u.lgRadius);
      setPair('lg-zradius-slider', 'lg-zradius-num', u.lgZradius);
      setPair('lg-opacity-slider', 'lg-opacity-num', u.lgOpacity);
      setPair('lg-sat-slider', 'lg-sat-num', u.lgSat);
      setPair('lg-bright-slider', 'lg-bright-num', u.lgBright);
      setPair('lg-shadow-op-slider', 'lg-shadow-op-num', u.lgShadowOp);
      setPair('lg-shadow-sp-slider', 'lg-shadow-sp-num', u.lgShadowSp);
      setPair('lg-bevel-slider', 'lg-bevel-num', u.lgBevel);
      updateLiquidGlassVars();
    }

    if (applyBgCheck.checked && cfg.bg) {
      const b = cfg.bg;
      if (b.bg) bgSelect.value = b.bg;
      if (b.bgTintColor) bgTintColor.value = b.bgTintColor;
      setPair('bg-blur-slider', 'bg-blur-num', b.bgBlur);
      setPair('bg-tint-slider', 'bg-tint-num', b.bgTint);
      setPair('bg-vignette-slider', 'bg-vignette-num', b.bgVignette);
      setPair('pulse-bright-slider', 'pulse-bright-num', b.pulseBright);
      if (b.bgUrl) loadCustomBgImage(b.bgUrl);
    }

    if (applyColorCheck.checked && cfg.color) {
      const c = cfg.color;
      if (c.theme) colorSelect.value = c.theme;
      if (c.customColor !== undefined) customColorToggle.checked = c.customColor;
      if (c.cStart) colorStartInput.value = c.cStart;
      if (c.cMid) colorMidInput.value = c.cMid;
      if (c.cEnd) colorEndInput.value = c.cEnd;
      if (c.cGlow) colorGlowInput.value = c.cGlow;
      updateGradientPreview();
      syncSwatchActive();
    }

    updateFreqReadout();
    if (audioSourceMode === 'none') drawIdleFrame();
  }

  function showPresetFeedback(msg) {
    presetFeedback.textContent = msg;
    setTimeout(() => {
      if (presetFeedback.textContent === msg) presetFeedback.textContent = '';
    }, 2400);
  }

  function getActivePresetName() {
    return localStorage.getItem(LAST_SESSION_PRESET_KEY) || '';
  }

  function setActivePresetName(name) {
    if (name) {
      localStorage.setItem(LAST_SESSION_PRESET_KEY, name);
    } else {
      localStorage.removeItem(LAST_SESSION_PRESET_KEY);
    }
  }

  function renderPresetList() {
    const userPresets = getUserPresets();
    const activeName = getActivePresetName();
    presetList.innerHTML = '';

    const addItem = (name, cfg, isBuiltin) => {
      const item = document.createElement('div');
      item.className = 'preset-item' + (activeName === name ? ' active-preset' : '');

      const meta = document.createElement('div');
      meta.className = 'preset-meta';
      const title = document.createElement('div');
      title.className = 'preset-name';
      title.textContent = name;
      const tag = document.createElement('div');
      tag.className = 'preset-tag';
      tag.textContent = (isBuiltin ? 'Template Bawaan' : 'Preset Saya') + (activeName === name ? ' • Aktif' : '');
      meta.append(title, tag);

      const actions = document.createElement('div');
      actions.className = 'preset-item-actions';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'btn btn-secondary btn-sm';
      loadBtn.textContent = 'Pakai';
      loadBtn.addEventListener('click', () => {
        applySettings(cfg);
        setActivePresetName(name);
        saveLastActiveState();
        renderPresetList();
        showPresetFeedback(`"${name}" diterapkan.`);
      });
      actions.appendChild(loadBtn);

      if (!isBuiltin) {
        const updBtn = document.createElement('button');
        updBtn.className = 'btn btn-ghost btn-sm';
        updBtn.textContent = 'Update';
        updBtn.addEventListener('click', () => {
          const current = getUserPresets();
          current[name] = captureCurrentSettings();
          saveUserPresets(current);
          setActivePresetName(name);
          saveLastActiveState();
          renderPresetList();
          showPresetFeedback(`"${name}" diperbarui.`);
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-sm';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', () => {
          const current = getUserPresets();
          delete current[name];
          saveUserPresets(current);
          if (getActivePresetName() === name) setActivePresetName('');
          renderPresetList();
          showPresetFeedback(`"${name}" dihapus.`);
        });

        actions.append(updBtn, delBtn);
      }

      item.append(meta, actions);
      presetList.appendChild(item);
    };

    Object.entries(BUILTIN_PRESETS).forEach(([name, cfg]) => addItem(name, cfg, true));
    Object.entries(userPresets).forEach(([name, cfg]) => addItem(name, cfg, false));
  }

  btnPresetSave.addEventListener('click', () => {
    const name = presetNameInput.value.trim();
    if (!name) {
      showPresetFeedback('Masukkan nama preset.');
      return;
    }
    const userPresets = getUserPresets();
    userPresets[name] = captureCurrentSettings();
    saveUserPresets(userPresets);
    setActivePresetName(name);
    saveLastActiveState();
    presetNameInput.value = '';
    renderPresetList();
    showPresetFeedback(`"${name}" disimpan.`);
  });

  if (btnPresetExport) {
    btnPresetExport.addEventListener('click', () => {
      const userPresets = getUserPresets();
      const exportData = {
        app: 'Cobra Audio',
        version: 2,
        exportedAt: new Date().toISOString(),
        currentSettings: captureCurrentSettings(),
        activePreset: getActivePresetName(),
        userPresets,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cobra-audio-presets-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showPresetFeedback('Preset berhasil diekspor.');
    });
  }

  if (presetImportInput) {
    presetImportInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (parsed.userPresets && typeof parsed.userPresets === 'object') {
            const current = getUserPresets();
            Object.assign(current, parsed.userPresets);
            saveUserPresets(current);
          }
          if (parsed.currentSettings) {
            applySettings(parsed.currentSettings);
          }
          if (parsed.activePreset) {
            setActivePresetName(parsed.activePreset);
          }
          saveLastActiveState();
          renderPresetList();
          showPresetFeedback('Preset berhasil dimuat.');
        } catch (err) {
          showPresetFeedback(`File JSON tidak valid: ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  // --- UI EVENTS & SHORTCUTS ---
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === target));
    });
  });

  uiThemeSelect.addEventListener('change', () => {
    document.documentElement.dataset.uiTheme = uiThemeSelect.value;
    if (uiThemeSelect.value === 'liquid') updateLiquidGlassVars();
  });

  btnActivateGlass.addEventListener('click', () => {
    uiThemeSelect.value = 'liquid';
    document.documentElement.dataset.uiTheme = 'liquid';
    updateLiquidGlassVars();
  });

  btnVisTheme.addEventListener('click', () => {
    visLightMode = !visLightMode;
    if (audioSourceMode === 'none') drawIdleFrame();
  });

  uiAccentPicker.addEventListener('input', (e) => applyUiAccent(e.target.value));
  document.querySelectorAll('.mini-swatch').forEach((btn) => {
    btn.addEventListener('click', () => applyUiAccent(btn.dataset.accent));
  });

  btnBgUrl.addEventListener('click', () => loadCustomBgImage(bgUrlInput.value.trim()));
  bgFileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadCustomBgImage(ev.target.result);
    reader.readAsDataURL(file);
  });

  btnBgClear.addEventListener('click', () => {
    customBgImage = null;
    customBgImageSrc = '';
    bgUrlInput.value = '';
    bgSelect.value = 'cover';
    if (audioSourceMode === 'none') drawIdleFrame();
  });

  lyricsCandidateSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    if (!Number.isNaN(idx) && lyricsCandidates[idx]) {
      applyLyricsCandidate(lyricsCandidates[idx]);
    }
  });

  lyricWordAnimToggle.addEventListener('change', () => {
    activeWordIdx = -1;
    updateLiveTimelineAndLyrics();
  });

  ecoModeToggle.addEventListener('change', () => {
    resizeCanvas();
    if (audioSourceMode === 'none') drawIdleFrame();
  });

  coverThumbWrap.addEventListener('click', () => {
    bgSelect.value = 'cover';
  });

  // Transport controls
  btnPlayPause.addEventListener('click', () => sendMediaControl('playpause'));
  btnPrev.addEventListener('click', () => sendMediaControl('prev'));
  btnNext.addEventListener('click', () => sendMediaControl('next'));

  seekSlider.addEventListener('input', () => {
    isSeeking = true;
    timeCurrEl.textContent = formatTime(parseFloat(seekSlider.value));
  });
  seekSlider.addEventListener('change', () => {
    isSeeking = false;
    sendMediaControl('seek', parseFloat(seekSlider.value));
  });

  // Lyrics panel controls
  function toggleLyricsPanel() {
    lyricsPanel.classList.toggle('hidden');
    if (!lyricsPanel.classList.contains('hidden')) {
      requestAnimationFrame(() => scrollActiveLyricIntoCenter(true));
    }
    scheduleHudAutoHide();
  }

  btnLyricsToggle.addEventListener('click', toggleLyricsPanel);
  btnCloseLyrics.addEventListener('click', () => lyricsPanel.classList.add('hidden'));
  if (btnGameOverlay) btnGameOverlay.addEventListener('click', () => toggleGameOverlay('toggle'));
  if (btnHudOverlay) btnHudOverlay.addEventListener('click', () => toggleGameOverlay('toggle'));
  if (btnVisPower) {
    btnVisPower.addEventListener('click', () => {
      visualizerEnabled = !visualizerEnabled;
      updateVisualizerPowerState();
      saveLastActiveState();
    });
  }
  if (visEnabledToggle) {
    visEnabledToggle.addEventListener('change', () => {
      visualizerEnabled = visEnabledToggle.checked;
      updateVisualizerPowerState();
      saveLastActiveState();
    });
  }
  [
    overlayPosSelect,
    overlayStyleSelect,
    overlayDofToggle,
    overlayPrevNextToggle,
    overlayClickThroughToggle,
    overlayBgToggle,
    overlayOutlineToggle,
    overlayShadowToggle,
    overlayControlsToggle,
  ].forEach((el) => {
    if (el) {
      el.addEventListener('change', () => {
        pushOverlayState(true);
        saveLastActiveState();
      });
    }
  });
  [overlayBgColor, overlayOutlineColor, overlayTextColor, overlayActiveColor].forEach((el) => {
    if (el) {
      el.addEventListener('input', () => {
        pushOverlayState(true);
        saveLastActiveState();
      });
    }
  });
  if (btnOverlayResetPos) {
    btnOverlayResetPos.addEventListener('click', () => {
      overlayResetPosToken += 1;
      pushOverlayState(true);
    });
  }
  const OVERLAY_STYLE_PRESETS = {
    cinema: {
      lyricsStyle: 'cinema',
      dofBlur: true,
      showBg: true,
      bgColor: '#0f1014',
      bgOpacity: 0.68,
      showOutline: true,
      outlineColor: '#ffffff',
      textColor: '#ffffff',
      activeColor: '#ffffff',
      textShadow: true,
      showControls: true,
    },
    glass: {
      lyricsStyle: 'karaoke',
      dofBlur: true,
      showBg: true,
      bgColor: '#0f1014',
      bgOpacity: 0.68,
      showOutline: true,
      outlineColor: '#ffffff',
      textColor: '#ffffff',
      activeColor: '#7dd3fc',
      textShadow: true,
      showControls: true,
    },
    clean: {
      lyricsStyle: 'cinema',
      dofBlur: true,
      showBg: false,
      bgColor: '#0f1014',
      bgOpacity: 0.0,
      showOutline: false,
      outlineColor: '#ffffff',
      textColor: '#ffffff',
      activeColor: '#ffffff',
      textShadow: true,
      showControls: true,
    },
    minimal: {
      lyricsStyle: 'cinema',
      dofBlur: true,
      showBg: false,
      bgColor: '#0f1014',
      bgOpacity: 0.0,
      showOutline: false,
      outlineColor: '#ffffff',
      textColor: '#ffffff',
      activeColor: '#ffffff',
      textShadow: true,
      showControls: false,
    },
  };
  document.querySelectorAll('.overlay-style-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = OVERLAY_STYLE_PRESETS[btn.dataset.ovPreset];
      if (!p) return;
      if (overlayStyleSelect && p.lyricsStyle) overlayStyleSelect.value = p.lyricsStyle;
      if (overlayDofToggle && p.dofBlur !== undefined) overlayDofToggle.checked = p.dofBlur;
      if (overlayBgToggle) overlayBgToggle.checked = p.showBg;
      if (overlayBgColor) overlayBgColor.value = p.bgColor;
      setPair('overlay-bg-opacity-slider', 'overlay-bg-opacity-num', p.bgOpacity);
      if (overlayOutlineToggle) overlayOutlineToggle.checked = p.showOutline;
      if (overlayOutlineColor) overlayOutlineColor.value = p.outlineColor;
      if (overlayTextColor) overlayTextColor.value = p.textColor;
      if (overlayActiveColor) overlayActiveColor.value = p.activeColor;
      if (overlayShadowToggle) overlayShadowToggle.checked = p.textShadow;
      if (overlayControlsToggle) overlayControlsToggle.checked = p.showControls;
      pushOverlayState(true);
      saveLastActiveState();
    });
  });

  // Hibernate Cobra Studio when window is minimized/hidden so overlay stays ultra-smooth
  document.addEventListener('visibilitychange', () => {
    appHibernated = document.hidden;
    if (!appHibernated) {
      pollMediaSession();
      toggleGameOverlay('status');
    }
    updateVisualizerPowerState();
  });
  if (mediaScopeSelect) {
    mediaScopeSelect.addEventListener('change', async () => {
      const val = mediaScopeSelect.value || 'music';
      saveLastActiveState();
      await fetch(`${BRIDGE_MEDIA_URL}/api/control?cmd=scope&val=${encodeURIComponent(val)}`).catch(() => {});
      setTimeout(pollMediaSession, 140);
    });
  }
  btnLyricsSettingsToggle.addEventListener('click', () => {
    lyricsControlsDrawer.classList.toggle('hidden');
  });
  document.querySelectorAll('.lyrics-drawer-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const target = tabBtn.dataset.lyricsTab;
      document.querySelectorAll('.lyrics-drawer-tab').forEach((b) => {
        b.classList.toggle('active', b === tabBtn);
      });
      const appPane = document.getElementById('lyrics-tab-app');
      const ovPane = document.getElementById('lyrics-tab-overlay');
      if (appPane) appPane.classList.toggle('hidden', target !== 'app');
      if (ovPane) ovPane.classList.toggle('hidden', target !== 'overlay');
    });
  });
  btnLyricsRefresh.addEventListener('click', async () => {
    lyricsStatusBadge.textContent = 'Refreshing...';
    await sendMediaControl('refresh');
    await pollMediaSession();
    if (currentMedia.title) {
      fetchLyricsForTrack(currentMedia.title, currentMedia.artist, currentMedia.duration, true, currentMedia.album);
    }
  });
  btnLyricsCinemaToggle.addEventListener('click', () => {
    cinemaLyricsToggle.checked = !cinemaLyricsToggle.checked;
  });
  btnLyricOffsetMinus.addEventListener('click', () => {
    lyricOffsetSec = Number((lyricOffsetSec - 0.5).toFixed(1));
    lyricOffsetVal.textContent = `${lyricOffsetSec >= 0 ? '+' : ''}${lyricOffsetSec.toFixed(1)}s`;
  });
  btnLyricOffsetPlus.addEventListener('click', () => {
    lyricOffsetSec = Number((lyricOffsetSec + 0.5).toFixed(1));
    lyricOffsetVal.textContent = `${lyricOffsetSec >= 0 ? '+' : ''}${lyricOffsetSec.toFixed(1)}s`;
  });
  btnLyricsSearch.addEventListener('click', () => {
    const q = lyricsQueryInput.value.trim();
    if (q) fetchLyricsForTrack(q, '', currentMedia.duration, true);
  });
  lyricsQueryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnLyricsSearch.click();
  });

  function scheduleHudAutoHide() {
    clearTimeout(idleTimer);
    if (hudForceHidden) return;
    hud.classList.remove('hud-hidden');

    if (
      audioSourceMode !== 'none' &&
      studioPanel.classList.contains('hidden') &&
      lyricsPanel.classList.contains('hidden')
    ) {
      idleTimer = setTimeout(() => hud.classList.add('hud-hidden'), 4000);
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  function toggleHudVisibility() {
    hudForceHidden = !hudForceHidden;
    if (hudForceHidden) {
      hud.classList.add('hud-hidden');
      studioPanel.classList.add('hidden');
      lyricsPanel.classList.add('hidden');
      clearTimeout(idleTimer);
    } else {
      scheduleHudAutoHide();
    }
  }

  function toggleStudioPanel() {
    studioPanel.classList.toggle('hidden');
    scheduleHudAutoHide();
  }

  btnStartAuto.addEventListener('click', () => startAutoBridge(false));
  btnSrcAuto.addEventListener('click', () => startAutoBridge(false));
  btnStartSystem.addEventListener('click', startSystemAudio);
  btnSrcBrowser.addEventListener('click', startSystemAudio);
  btnStartMic.addEventListener('click', () => startMicOrStereoMix());
  btnSrcMic.addEventListener('click', () => startMicOrStereoMix());
  btnStop.addEventListener('click', () => stopAudioCapture(true));

  btnTogglePanel.addEventListener('click', toggleStudioPanel);
  btnClosePanel.addEventListener('click', () => studioPanel.classList.add('hidden'));
  btnFullscreen.addEventListener('click', toggleFullscreen);
  btnHideHud.addEventListener('click', toggleHudVisibility);

  colorSelect.addEventListener('change', () => {
    customColorToggle.checked = false;
    syncSwatchActive();
  });

  customColorToggle.addEventListener('change', syncSwatchActive);
  [colorStartInput, colorMidInput, colorEndInput].forEach((el) => {
    el.addEventListener('input', () => {
      customColorToggle.checked = true;
      updateGradientPreview();
      syncSwatchActive();
    });
  });

  deviceSelect.addEventListener('change', (e) => {
    if (e.target.value) startMicOrStereoMix(e.target.value);
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (audioSourceMode === 'none') drawIdleFrame();
  });

  window.addEventListener('mousemove', scheduleHudAutoHide);
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    else if (e.key === 'h' || e.key === 'H') toggleHudVisibility();
    else if (e.key === 's' || e.key === 'S') toggleStudioPanel();
    else if (e.key === 'l' || e.key === 'L') toggleLyricsPanel();
    else if (e.key === 'g' || e.key === 'G') toggleGameOverlay('toggle');
    else if (e.key === 'v' || e.key === 'V') {
      visualizerEnabled = !visualizerEnabled;
      updateVisualizerPowerState();
      saveLastActiveState();
    }
    else if (e.code === 'Space') {
      e.preventDefault();
      sendMediaControl('playpause');
    }
  });

  // Auto-save triggers on discrete controls
  [
    modeSelect, colorSelect, bgSelect, bgTintColor, uiThemeSelect, rulerPosSelect,
    peakToggle, rgbBeatToggle, particlesToggle, mirrorToggle, rulerToggle,
    wiggleToggle, beatZoomToggle, canvasTitleToggle, cinemaLyricsToggle,
    customColorToggle, ecoModeToggle, lyricWordAnimToggle,
  ].forEach((ctrl) => {
    if (ctrl) {
      ctrl.addEventListener('change', () => {
        saveLastActiveState();
      });
    }
  });

  // Save state immediately on unload / tab close / app exit
  window.addEventListener('beforeunload', () => {
    saveLastActiveState(true);
  });
  window.addEventListener('pagehide', () => {
    saveLastActiveState(true);
  });

  // Boot
  setupPairedControls();
  setupPanelResizers();

  // Load last active session state or fallback to default preset
  const lastSavedState = loadLastActiveState();
  if (lastSavedState) {
    applySettings(lastSavedState);
  } else {
    applyUiAccent('#6366f1');
    updateLiquidGlassVars();
    updateLyricAppearanceVars();
  }

  buildSwatches();
  updateGradientPreview();
  renderPresetList();
  updateFreqReadout();
  resizeCanvas();
  drawIdleFrame();

  emptyState.addEventListener('click', (e) => {
    if (e.target === emptyState) emptyState.classList.add('hidden');
  });

  // Start Media/Lyrics polling (200ms) + Auto WASAPI Audio Bridge (no blocking popup)
  pollMediaSession();
  setInterval(pollMediaSession, 200);
  toggleGameOverlay('status');

  async function bootAutoAudio() {
    setStatus(false, 'Menghubungkan...');
    const ok = await startAutoBridge(true);
    if (!ok && audioSourceMode === 'none') {
      setTimeout(bootAutoAudio, 600);
    }
  }
  bootAutoAudio();
})();
