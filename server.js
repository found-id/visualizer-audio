const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const WORKSPACE_DIR = __dirname;
const WWW_ROOT = path.resolve(WORKSPACE_DIR, '../..');
const AUDIO_BRIDGE_EXE = path.join(
  WORKSPACE_DIR,
  'desktop-rust',
  'target',
  'release',
  'audio-bridge.exe'
);
const OVERLAY_EXE = path.join(
  WORKSPACE_DIR,
  'desktop-rust',
  'target',
  'release',
  'lyrics-overlay.exe'
);
const SMTC_SCRIPT = path.join(WORKSPACE_DIR, 'smtc-worker.ps1');

let latestMedia = {
  active: false,
  title: '',
  artist: '',
  album: '',
  sourceApp: '',
  status: 'Stopped',
  position: 0,
  duration: 0,
  trackKey: '',
  coverVersion: 0,
  cover: '',
  updatedAt: Date.now(),
};

let smtcProc = null;
let audioProc = null;
let overlayProc = null;
let lastStudioHeartbeatAt = Date.now();
let mediaScope = 'music';
let latestSessions = [];
const lyricsCache = new Map();
const inFlightLyrics = new Map();

// Live state for standalone transparent game lyrics overlay
let overlayState = {
  active: false,
  playing: false,
  loading: false,
  trackKey: '',
  title: '',
  artist: '',
  prev: '',
  curr: '♪ Menunggu musik...',
  next: '',
  words: [], // [{ text, state: 0|1|2 }]
  progress: 0,
  updatedAt: 0,
  fromClient: false,
  config: {
    pos: 'top', // 'top' | 'bottom' | 'center'
    barWidth: 460,
    scale: 1.15,
    opacity: 0.95,
    showPrevNext: true,
    dofBlur: true,
    lyricsStyle: 'cinema',
    clickThrough: false,
    showBg: true,
    bgColor: '#0f1014',
    bgOpacity: 0.68,
    showOutline: true,
    outlineColor: '#ffffff',
    textColor: '#ffffff',
    activeColor: '#7dd3fc',
    textShadow: true,
    shadowStrength: 0.65,
    textGlow: false,
    textOutline: false,
    showControls: true,
    resetPosToken: 0,
  },
};

let serverLyricsState = {
  trackKey: '',
  fetching: false,
  lines: [], // [{ time, endTime, text, words?: [{text, start, end}] }]
  offsetSec: 0,
};

function startAudioBridge() {
  if (!fs.existsSync(AUDIO_BRIDGE_EXE)) return;
  audioProc = spawn(AUDIO_BRIDGE_EXE, [], {
    cwd: WORKSPACE_DIR,
    stdio: 'ignore',
    windowsHide: true,
  });
  audioProc.on('exit', () => {
    setTimeout(startAudioBridge, 2500);
  });
}

function startSmtcWorker() {
  smtcProc = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SMTC_SCRIPT],
    {
      cwd: WORKSPACE_DIR,
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
    }
  );

  let buffer = '';
  smtcProc.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line.startsWith('SMTC_JSON:')) {
        try {
          const parsed = JSON.parse(line.slice(10));
          if (Array.isArray(parsed.sessions)) {
            latestSessions = parsed.sessions;
          }
          if (parsed.active) {
            const prevTrackKey = latestMedia.trackKey;
            const cover = parsed.cover || (parsed.trackKey === latestMedia.trackKey ? latestMedia.cover : '');
            latestMedia = {
              ...parsed,
              cover,
              updatedAt: Date.now(),
            };
            if (parsed.trackKey && parsed.trackKey !== prevTrackKey) {
              overlayState.trackKey = parsed.trackKey;
              overlayState.title = parsed.title || '';
              overlayState.artist = parsed.artist || '';
              overlayState.prev = '';
              overlayState.curr = 'Memuat lirik...';
              overlayState.next = '';
              overlayState.words = [];
              overlayState.loading = true;
              overlayState.fromClient = false;
              if (isOverlayRunning()) {
                syncServerOverlayFallback().catch(() => {});
              }
            }
          } else {
            latestMedia.active = false;
          }
        } catch (_) {}
      }
    }
  });

  smtcProc.on('exit', () => {
    setTimeout(startSmtcWorker, 2000);
  });
}

function sendSmtcCommand(cmdStr) {
  if (smtcProc && smtcProc.stdin && !smtcProc.stdin.destroyed) {
    smtcProc.stdin.write(cmdStr + '\n');
    return true;
  }
  return false;
}

function fetchJsonHttps(url, extraHeaders = {}, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'CobraAudio/3.0 (https://github.com/found-id/visualizer-audio)',
          Accept: 'application/json',
          ...extraHeaders,
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchJsonHttps(res.headers.location, extraHeaders, timeoutMs).then(resolve, reject);
          return;
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
    req.on('error', reject);
  });
}

function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTrackNoise(str, keepVariants = false) {
  if (!str) return '';
  let s = str
    .replace(/\|\|.*$/g, ' ')
    .replace(/\|.*$/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*(?:official|video|audio|lyrics|lyric|mv|m\/v|hd|4k|visualizer|sub|eng|indo|live|prod\.?)[^\]]*\]/gi, ' ')
    .replace(/\((?:ft\.?|feat\.?|featuring|with|official|music\s*video|video|audio|lyrics|lyric|visualizer|hd|4k|hq|explicit|clean|radio\s*edit)[^)]*\)/gi, ' ')
    .replace(/\b(?:ft\.?|feat\.?|featuring)\s+[^-|()\[\]]+/gi, ' ')
    .replace(/\s*-\s*Topic$/i, '');
  if (!keepVariants) {
    s = s.replace(/\b(?:slowed(?:\s*\+?\s*reverb)?|reverbed|sped\s*up|nightcore|tiktok\s*version|bass\s*boosted|8d\s*audio)\b/gi, ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

function parseTrackMetadata(rawTitle, rawArtist, rawAlbum) {
  let cleanTitle = stripTrackNoise(rawTitle, false);
  let cleanArtist = (rawArtist || '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .trim();

  // Handle "Artist - Song Title" format commonly emitted by YouTube / Browser SMTC
  if (cleanTitle.includes(' - ')) {
    const parts = cleanTitle.split(' - ');
    if (parts.length >= 2) {
      const maybeArtist = parts[0].trim();
      const maybeTitle = parts.slice(1).join(' - ').trim();
      const artistNorm = normalizeText(cleanArtist);
      const maybeArtistNorm = normalizeText(maybeArtist);
      if (
        !artistNorm ||
        artistNorm === 'youtube' ||
        artistNorm === 'youtube music' ||
        artistNorm === 'brave' ||
        artistNorm === 'chrome' ||
        artistNorm.includes(maybeArtistNorm) ||
        maybeArtistNorm.includes(artistNorm)
      ) {
        if (maybeTitle.length >= 2) {
          cleanArtist = maybeArtist;
          cleanTitle = maybeTitle;
        }
      }
    }
  }

  // Strip trailing parentheses if title still has leftover noise
  cleanTitle = cleanTitle.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanTitle) cleanTitle = (rawTitle || '').trim();

  const rawLower = (rawTitle || '').toLowerCase();
  return {
    cleanTitle,
    cleanArtist,
    cleanAlbum: stripTrackNoise(rawAlbum || '', false),
    wantVariants: {
      slowed: /\bslowed\b/.test(rawLower),
      spedUp: /\bsped\s*up\b/.test(rawLower),
      nightcore: /\bnightcore\b/.test(rawLower),
      remix: /\bremix\b/.test(rawLower),
      acoustic: /\bacoustic\b/.test(rawLower),
      live: /\blive\b/.test(rawLower),
      instrumental: /\binstrumental\b/.test(rawLower),
    },
  };
}

function tokenSimilarity(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const ta = new Set(na.split(' ').filter(Boolean));
  const tb = new Set(nb.split(' ').filter(Boolean));
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

function parseTimestampToSec(ts) {
  if (!ts) return 0;
  const parts = String(ts).trim().split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  const s = String(ts).trim();
  if (s.endsWith('ms')) return parseFloat(s) / 1000;
  if (s.endsWith('s')) return parseFloat(s);
  return parseFloat(s) || 0;
}

function decodeXmlEntities(str) {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseTtmlToLines(ttml) {
  const lines = [];
  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRegex.exec(ttml)) !== null) {
    const attrs = pm[1] || '';
    const inner = pm[2] || '';
    const beginM = attrs.match(/\bbegin="([^"]+)"/i);
    if (!beginM) continue;
    const endM = attrs.match(/\bend="([^"]+)"/i);
    const startTime = parseTimestampToSec(beginM[1]);
    const endTime = endM ? parseTimestampToSec(endM[1]) : startTime + 4;

    const words = [];
    const spanRegex = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
    let sm;
    while ((sm = spanRegex.exec(inner)) !== null) {
      const sAttrs = sm[1] || '';
      if (/x-bg|role="x-bg"/i.test(sAttrs)) continue;
      const wBegin = sAttrs.match(/\bbegin="([^"]+)"/i);
      const wEnd = sAttrs.match(/\bend="([^"]+)"/i);
      const rawText = decodeXmlEntities(sm[2].replace(/<[^>]+>/g, '')).trim();
      if (!rawText) continue;
      if (wBegin) {
        const ws = parseTimestampToSec(wBegin[1]);
        const we = wEnd ? parseTimestampToSec(wEnd[1]) : ws + 0.35;
        words.push({ text: rawText, start: ws, end: Math.max(ws + 0.08, we) });
      }
    }

    const plainLine = decodeXmlEntities(inner.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    const text = words.length > 0 ? words.map((w) => w.text).join(' ') : plainLine;
    if (text) {
      lines.push({
        time: startTime,
        endTime: Math.max(startTime + 0.4, endTime),
        text,
        words: words.length > 0 ? words : null,
      });
    }
  }
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

function parseEnhancedLrcToLines(lrcText) {
  const lines = [];
  const lineTagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const wordTagRegex = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>([^<]*)/g;

  for (const rawLine of (lrcText || '').split(/\r?\n/)) {
    const matches = [...rawLine.matchAll(lineTagRegex)];
    if (matches.length === 0) continue;
    const rest = rawLine.replace(lineTagRegex, '').trim();

    const wordMatches = [...rest.matchAll(wordTagRegex)];
    let parsedWords = null;
    let cleanText = rest;

    if (wordMatches.length > 0) {
      parsedWords = [];
      for (let i = 0; i < wordMatches.length; i++) {
        const wm = wordMatches[i];
        const ws =
          parseInt(wm[1], 10) * 60 +
          parseInt(wm[2], 10) +
          parseInt((wm[3] || '0').padEnd(3, '0').slice(0, 3), 10) / 1000;
        const wText = wm[4].trim();
        if (!wText) continue;
        const nextMatch = wordMatches[i + 1];
        const nextWs = nextMatch
          ? parseInt(nextMatch[1], 10) * 60 +
            parseInt(nextMatch[2], 10) +
            parseInt((nextMatch[3] || '0').padEnd(3, '0').slice(0, 3), 10) / 1000
          : ws + Math.max(0.25, wText.length * 0.06);
        parsedWords.push({ text: wText, start: ws, end: Math.max(ws + 0.08, nextWs) });
      }
      cleanText = parsedWords.map((w) => w.text).join(' ');
    }

    for (const m of matches) {
      const time =
        parseInt(m[1], 10) * 60 +
        parseInt(m[2], 10) +
        parseInt((m[3] || '0').padEnd(3, '0').slice(0, 3), 10) / 1000;
      lines.push({
        time,
        text: cleanText || '♪',
        words: parsedWords && parsedWords.length > 0 ? parsedWords : null,
      });
    }
  }
  lines.sort((a, b) => a.time - b.time);
  for (let i = 0; i < lines.length; i++) {
    const nextT = i + 1 < lines.length ? lines[i + 1].time : lines[i].time + 5;
    lines[i].endTime = Math.max(lines[i].time + 0.4, nextT);
  }
  return lines;
}

function scoreLyricsCandidate(c, meta, targetDur) {
  let score = 0;
  const titleSim = tokenSimilarity(c.trackName, meta.cleanTitle);
  const artistSim = meta.cleanArtist ? tokenSimilarity(c.artistName, meta.cleanArtist) : 0.5;

  score += titleSim * 55;
  score += artistSim * 35;

  if (c.richSync) score += 32;
  if (c.synced) score += 45;
  if (c.source === 'Unison (Better Lyrics)') score += 18;
  else if (c.source === 'LRCLIB Exact') score += 14;
  else if (c.source === 'KuGou Legato') score += 8;

  if (targetDur > 0 && c.duration > 0) {
    const diff = Math.abs(c.duration - targetDur);
    if (diff <= 1.5) score += 35;
    else if (diff <= 3.5) score += 24;
    else if (diff <= 7.0) score += 10;
    else if (diff <= 15.0) score -= 12;
    else score -= Math.min(75, diff * 1.5);
  }

  // Penalize unwanted remix/karaoke/cover unless requested by active song title
  const candLower = `${c.trackName} ${c.artistName}`.toLowerCase();
  const unwanted = [
    ['karaoke', false],
    ['instrumental', meta.wantVariants.instrumental],
    ['cover', false],
    ['tribute', false],
    ['slowed', meta.wantVariants.slowed],
    ['sped up', meta.wantVariants.spedUp],
    ['nightcore', meta.wantVariants.nightcore],
    ['remix', meta.wantVariants.remix],
    ['acoustic', meta.wantVariants.acoustic],
  ];
  for (const [kw, wanted] of unwanted) {
    if (!wanted && candLower.includes(kw)) score -= 55;
  }

  // Line quality sanity check
  const lineCount = (c.syncedLyrics || c.plainLyrics || '').split(/\r?\n/).filter((l) => l.trim()).length;
  if (lineCount < 4) score -= 40;
  else if (lineCount >= 10) score += 8;

  return score;
}

async function fetchUnisonCandidate(meta, targetDur) {
  try {
    const u = new URL('https://unison.betterlyrics.org/lyrics');
    u.searchParams.set('song', meta.cleanTitle);
    if (meta.cleanArtist) u.searchParams.set('artist', meta.cleanArtist);
    if (targetDur > 0) u.searchParams.set('duration', String(Math.round(targetDur)));
    if (meta.cleanAlbum) u.searchParams.set('album', meta.cleanAlbum);

    const json = await fetchJsonHttps(u.toString(), { 'x-key-id': 'cobra-audio-client' }, 3500);
    const d = json && json.data;
    if (!d || !d.lyrics) return null;

    if (d.format === 'ttml') {
      const lines = parseTtmlToLines(d.lyrics);
      if (lines.length === 0) return null;
      const hasWordSync = lines.some((l) => l.words && l.words.length > 0);
      return {
        source: 'Unison (Better Lyrics)',
        format: 'ttml',
        trackName: meta.cleanTitle,
        artistName: meta.cleanArtist,
        duration: targetDur,
        synced: true,
        richSync: hasWordSync,
        syncedLyrics: '',
        ttmlLyrics: d.lyrics,
        parsedLines: lines,
        plainLyrics: lines.map((l) => l.text).join('\n'),
      };
    }

    if (d.format === 'lrc') {
      const hasRichTags = /<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/.test(d.lyrics);
      const lines = parseEnhancedLrcToLines(d.lyrics);
      return {
        source: 'Unison (Better Lyrics)',
        format: hasRichTags ? 'rich-lrc' : 'lrc',
        trackName: meta.cleanTitle,
        artistName: meta.cleanArtist,
        duration: targetDur,
        synced: lines.length > 0,
        richSync: hasRichTags || d.syncType === 'richsync',
        syncedLyrics: d.lyrics,
        parsedLines: lines,
        plainLyrics: lines.map((l) => l.text).join('\n'),
      };
    }

    return {
      source: 'Unison (Better Lyrics)',
      format: 'plain',
      trackName: meta.cleanTitle,
      artistName: meta.cleanArtist,
      duration: targetDur,
      synced: false,
      richSync: false,
      syncedLyrics: '',
      plainLyrics: d.lyrics,
    };
  } catch (_) {
    return null;
  }
}

async function fetchLrclibCandidates(meta, targetDur) {
  const out = [];
  const tasks = [];

  if (meta.cleanTitle && meta.cleanArtist && targetDur > 0) {
    const getUrl = new URL('https://lrclib.net/api/get');
    getUrl.searchParams.set('track_name', meta.cleanTitle);
    getUrl.searchParams.set('artist_name', meta.cleanArtist);
    getUrl.searchParams.set('duration', String(Math.round(targetDur)));
    if (meta.cleanAlbum) getUrl.searchParams.set('album_name', meta.cleanAlbum);
    tasks.push(
      fetchJsonHttps(getUrl.toString(), {}, 3500)
        .then((item) => {
          if (item && (item.syncedLyrics || item.plainLyrics)) {
            out.push({ ...item, _isExact: true });
          }
        })
        .catch(() => {})
    );
  }

  if (meta.cleanTitle && meta.cleanArtist) {
    const sUrl = new URL('https://lrclib.net/api/search');
    sUrl.searchParams.set('track_name', meta.cleanTitle);
    sUrl.searchParams.set('artist_name', meta.cleanArtist);
    tasks.push(
      fetchJsonHttps(sUrl.toString(), {}, 3800)
        .then((arr) => {
          if (Array.isArray(arr)) out.push(...arr);
        })
        .catch(() => {})
    );
  }

  const qStr = meta.cleanArtist ? `${meta.cleanArtist} ${meta.cleanTitle}` : meta.cleanTitle;
  if (qStr) {
    tasks.push(
      fetchJsonHttps(`https://lrclib.net/api/search?q=${encodeURIComponent(qStr)}`, {}, 3800)
        .then((arr) => {
          if (Array.isArray(arr)) out.push(...arr);
        })
        .catch(() => {})
    );
  }

  await Promise.all(tasks);

  const seen = new Set();
  const mapped = [];
  for (const item of out) {
    if (!item || (!item.syncedLyrics && !item.plainLyrics)) continue;
    const key = item.id || `${item.trackName}|${item.artistName}|${item.duration}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const syncedStr = item.syncedLyrics || '';
    const hasRichTags = /<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/.test(syncedStr);
    const parsedLines = syncedStr ? parseEnhancedLrcToLines(syncedStr) : null;

    mapped.push({
      source: item._isExact ? 'LRCLIB Exact' : 'LRCLIB',
      format: hasRichTags ? 'rich-lrc' : syncedStr ? 'lrc' : 'plain',
      trackName: item.trackName || meta.cleanTitle,
      artistName: item.artistName || meta.cleanArtist,
      duration: item.duration || 0,
      synced: Boolean(syncedStr),
      richSync: hasRichTags,
      syncedLyrics: syncedStr,
      parsedLines,
      plainLyrics: item.plainLyrics || '',
    });
  }
  return mapped;
}

async function fetchKugouLegatoCandidates(meta, targetDur) {
  try {
    const kw = meta.cleanArtist ? `${meta.cleanArtist} - ${meta.cleanTitle}` : meta.cleanTitle;
    const durMs = targetDur > 0 ? Math.round(targetDur * 1000) : 0;
    const searchUrl = `https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(kw)}${durMs > 0 ? `&duration=${durMs}` : ''}`;
    const res = await fetchJsonHttps(searchUrl, {}, 3500);
    const cands = Array.isArray(res && res.candidates) ? res.candidates.slice(0, 2) : [];
    const results = await Promise.all(
      cands.map(async (c) => {
        try {
          const dlUrl = `https://lyrics.kugou.com/download?ver=1&client=pc&id=${c.id}&accesskey=${c.accesskey}&fmt=lrc&charset=utf8`;
          const dl = await fetchJsonHttps(dlUrl, {}, 3500);
          if (!dl || !dl.content) return null;
          const lrcText = Buffer.from(dl.content, 'base64').toString('utf8');
          const lines = parseEnhancedLrcToLines(lrcText);
          if (lines.length < 3) return null;
          return {
            source: 'KuGou Legato',
            format: 'lrc',
            trackName: c.song || meta.cleanTitle,
            artistName: c.singer || meta.cleanArtist,
            duration: c.duration ? c.duration / 1000 : targetDur,
            synced: true,
            richSync: false,
            syncedLyrics: lrcText,
            parsedLines: lines,
            plainLyrics: lines.map((l) => l.text).join('\n'),
          };
        } catch (_) {
          return null;
        }
      })
    );
    return results.filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function findBestLyrics(title, artist, duration, forceFresh = false, album = '') {
  const targetDur = parseFloat(duration) || 0;
  const meta = parseTrackMetadata(title, artist, album);
  const cacheKey = `${meta.cleanTitle}|${meta.cleanArtist}|${Math.round(targetDur / 5)}`;
  if (!forceFresh && lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey);
  if (!forceFresh && inFlightLyrics.has(cacheKey)) return inFlightLyrics.get(cacheKey);

  const workPromise = (async () => {
    let unisonCand = null;
    let lrclibList = [];
    let kugouList = [];

    const unisonP = fetchUnisonCandidate(meta, targetDur).then((v) => (unisonCand = v)).catch(() => null);
    const lrclibP = fetchLrclibCandidates(meta, targetDur).then((v) => (lrclibList = v || [])).catch(() => []);
    const kugouP = fetchKugouLegatoCandidates(meta, targetDur).then((v) => (kugouList = v || [])).catch(() => []);

    const fastSynced = Promise.race([
      lrclibP.then((arr) => (arr.some((x) => x.synced) ? 'lrclib' : null)),
      unisonP.then((c) => (c && c.synced ? 'unison' : null)),
    ]);

    await Promise.race([
      Promise.all([unisonP, lrclibP, kugouP]),
      fastSynced.then((hit) => new Promise((r) => setTimeout(r, hit ? 550 : 2200))),
    ]);

    const all = [];
    if (unisonCand) all.push(unisonCand);
    all.push(...lrclibList);
    all.push(...kugouList);

    if (all.length === 0 && meta.cleanArtist) {
      try {
        const ovh = await fetchJsonHttps(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(meta.cleanArtist)}/${encodeURIComponent(meta.cleanTitle)}`,
          {},
          2000
        );
        if (ovh && ovh.lyrics) {
          all.push({
            source: 'Lyrics.ovh',
            format: 'plain',
            trackName: meta.cleanTitle,
            artistName: meta.cleanArtist,
            duration: targetDur,
            synced: false,
            richSync: false,
            syncedLyrics: '',
            plainLyrics: ovh.lyrics,
          });
        }
      } catch (_) {}
    }

    if (all.length === 0) {
      const empty = { found: false, candidates: [] };
      lyricsCache.set(cacheKey, empty);
      return empty;
    }

    all.forEach((c) => {
      c.score = Math.round(scoreLyricsCandidate(c, meta, targetDur));
    });
    all.sort((a, b) => b.score - a.score);

    const topCandidates = all.slice(0, 10);
    const best = topCandidates[0];
    const output = {
      found: true,
      synced: best.synced,
      richSync: Boolean(best.richSync),
      format: best.format || (best.synced ? 'lrc' : 'plain'),
      source: best.source,
      trackName: best.trackName,
      artistName: best.artistName,
      duration: best.duration,
      syncedLyrics: best.syncedLyrics || '',
      ttmlLyrics: best.ttmlLyrics || '',
      parsedLines: best.parsedLines || null,
      plainLyrics: best.plainLyrics || '',
      candidates: topCandidates,
    };
    lyricsCache.set(cacheKey, output);
    return output;
  })().finally(() => {
    inFlightLyrics.delete(cacheKey);
  });

  inFlightLyrics.set(cacheKey, workPromise);
  return workPromise;
}

function isOverlayRunning() {
  return Boolean(overlayProc && !overlayProc.killed && overlayProc.exitCode === null);
}

function startOverlayProcess() {
  if (isOverlayRunning()) return true;
  if (!fs.existsSync(OVERLAY_EXE)) return false;
  overlayProc = spawn(OVERLAY_EXE, [], {
    cwd: WORKSPACE_DIR,
    stdio: 'ignore',
    windowsHide: false,
  });
  overlayProc.on('exit', () => {
    overlayProc = null;
    // If Cobra Studio is already closed/hibernated and overlay was just closed, shut down bridge cleanly
    if (Date.now() - lastStudioHeartbeatAt > 6000) {
      shutdownAllAndExit();
    }
  });
  return true;
}

function shutdownAllAndExit() {
  try {
    if (audioProc && !audioProc.killed) audioProc.kill();
  } catch (_) {}
  try {
    if (smtcProc && !smtcProc.killed) smtcProc.kill();
  } catch (_) {}
  try {
    if (overlayProc && !overlayProc.killed) overlayProc.kill();
  } catch (_) {}
  setTimeout(() => process.exit(0), 120);
}

function stopOverlayProcess() {
  if (!overlayProc) return false;
  try {
    overlayProc.kill();
  } catch (_) {}
  overlayProc = null;
  return true;
}

// Keep autonomous server lyrics synced when main UI isn't pushing overlay state
async function syncServerOverlayFallback() {
  if (!isOverlayRunning()) return;
  if (!latestMedia.active || !latestMedia.title) return;
  if (overlayState.fromClient && (Date.now() - overlayState.updatedAt < 1800 || Date.now() - lastStudioHeartbeatAt < 3500)) return;

  if (serverLyricsState.trackKey !== latestMedia.trackKey && !serverLyricsState.fetching) {
    serverLyricsState.trackKey = latestMedia.trackKey;
    serverLyricsState.fetching = true;
    serverLyricsState.lines = [];
    overlayState.trackKey = latestMedia.trackKey;
    overlayState.prev = '';
    overlayState.curr = 'Memuat lirik...';
    overlayState.next = '';
    overlayState.words = [];
    overlayState.loading = true;
    findBestLyrics(latestMedia.title, latestMedia.artist, latestMedia.duration, false, latestMedia.album)
      .then((res) => {
        if (serverLyricsState.trackKey !== latestMedia.trackKey) return;
        if (res && res.found && Array.isArray(res.parsedLines)) {
          serverLyricsState.lines = res.parsedLines;
        }
      })
      .finally(() => {
        serverLyricsState.fetching = false;
        overlayState.loading = false;
      });
  }

  let livePos = latestMedia.position;
  if (latestMedia.status === 'Playing') {
    livePos += (Date.now() - latestMedia.updatedAt) / 1000;
  }
  const t = livePos + (serverLyricsState.offsetSec || 0);
  const lines = serverLyricsState.lines;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) idx = i;
    else break;
  }

  overlayState.active = true;
  overlayState.playing = latestMedia.status === 'Playing';
  overlayState.trackKey = latestMedia.trackKey;
  overlayState.title = latestMedia.title;
  overlayState.artist = latestMedia.artist;
  overlayState.prev = idx > 0 ? lines[idx - 1].text : '';
  overlayState.curr = idx >= 0 ? lines[idx].text : lines.length > 0 ? '♪ ...' : `${latestMedia.title}`;
  overlayState.next = idx + 1 < lines.length ? lines[idx + 1].text : '';

  if (idx >= 0) {
    const line = lines[idx];
    if (Array.isArray(line.words) && line.words.length > 0) {
      overlayState.words = line.words.map((w) => ({
        text: w.text,
        state: t >= w.end ? 1 : t >= w.start ? 2 : 0,
      }));
    } else {
      const splitWords = line.text.split(/\s+/).filter(Boolean);
      const nextT = line.endTime || line.time + 3.5;
      const activeDur = Math.max(0.9, Math.min(nextT - line.time, splitWords.length * 0.42 + 0.6));
      const prog = Math.max(0, Math.min(0.999, (t - line.time) / activeDur));
      const wIdx = Math.floor(prog * splitWords.length);
      overlayState.words = splitWords.map((w, wi) => ({
        text: w,
        state: wi < wIdx ? 1 : wi === wIdx ? 2 : 0,
      }));
    }
  } else {
    overlayState.words = [];
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname.endsWith('/api/audio')) {
    lastStudioHeartbeatAt = Date.now();
    const proxyReq = http.get('http://127.0.0.1:19848/audio', { timeout: 600 }, (pRes) => {
      let body = '';
      pRes.on('data', (c) => (body += c));
      pRes.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(body);
      });
    });
    proxyReq.on('error', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"active":false}');
    });
    return;
  }

  if (pathname.endsWith('/api/media')) {
    lastStudioHeartbeatAt = Date.now();
    let pos = latestMedia.position;
    if (latestMedia.active && latestMedia.status === 'Playing') {
      const elapsed = (Date.now() - latestMedia.updatedAt) / 1000;
      pos = Math.min(latestMedia.duration || pos + elapsed, pos + elapsed);
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(
      JSON.stringify({
        active: latestMedia.active,
        title: latestMedia.title,
        artist: latestMedia.artist,
        album: latestMedia.album,
        sourceApp: latestMedia.sourceApp,
        status: latestMedia.status,
        position: Number(pos.toFixed(2)),
        duration: latestMedia.duration,
        trackKey: latestMedia.trackKey,
        coverVersion: latestMedia.coverVersion || 0,
        hasCover: Boolean(latestMedia.cover),
        scope: mediaScope,
        sessions: latestSessions,
      })
    );
    return;
  }

  if (pathname.endsWith('/api/cover')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(
      JSON.stringify({
        trackKey: latestMedia.trackKey,
        coverVersion: latestMedia.coverVersion || 0,
        cover: latestMedia.cover || '',
      })
    );
    return;
  }

  if (pathname.endsWith('/api/control')) {
    const cmd = parsedUrl.searchParams.get('cmd') || '';
    const pos = parsedUrl.searchParams.get('pos') || '0';
    const val = parsedUrl.searchParams.get('val') || '';
    let ok = false;
    if (cmd === 'scope' && val) {
      mediaScope = val;
      overlayState.prev = '';
      overlayState.curr = 'Memuat lirik...';
      overlayState.next = '';
      overlayState.words = [];
      overlayState.loading = true;
      ok = sendSmtcCommand(`scope:${val}`);
    } else if (['playpause', 'play', 'pause', 'next', 'prev', 'refresh'].includes(cmd)) {
      if (cmd === 'next' || cmd === 'prev') {
        overlayState.prev = '';
        overlayState.curr = 'Memuat lirik...';
        overlayState.next = '';
        overlayState.words = [];
        overlayState.loading = true;
      }
      ok = sendSmtcCommand(cmd);
    } else if (cmd === 'seek') {
      const sec = parseFloat(pos);
      if (!Number.isNaN(sec) && sec >= 0) {
        latestMedia.position = sec;
        latestMedia.updatedAt = Date.now();
        ok = sendSmtcCommand(`seek:${sec}`);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok }));
    return;
  }

  if (pathname.endsWith('/api/lyrics')) {
    const title = parsedUrl.searchParams.get('title') || '';
    const artist = parsedUrl.searchParams.get('artist') || '';
    const album = parsedUrl.searchParams.get('album') || '';
    const duration = parsedUrl.searchParams.get('duration') || '0';
    const fresh = parsedUrl.searchParams.get('fresh') === '1';
    if (!title) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ found: false }));
      return;
    }
    const result = await findBestLyrics(title, artist, duration, fresh, album);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname.endsWith('/api/overlay')) {
    const action = parsedUrl.searchParams.get('action') || 'status';
    let running = isOverlayRunning();
    if (action === 'on' || (action === 'toggle' && !running)) {
      running = startOverlayProcess();
    } else if (action === 'off' || (action === 'toggle' && running)) {
      stopOverlayProcess();
      running = false;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(
      JSON.stringify({
        running,
        available: fs.existsSync(OVERLAY_EXE),
        config: overlayState.config,
      })
    );
    return;
  }

  if (pathname.endsWith('/api/overlay-state')) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const p = JSON.parse(body || '{}');
          if (p.config && typeof p.config === 'object') {
            overlayState.config = { ...overlayState.config, ...p.config };
          }
          if (typeof p.offsetSec === 'number') {
            serverLyricsState.offsetSec = p.offsetSec;
          }
          if (p.curr !== undefined) {
            const staleTrack =
              Boolean(p.trackKey) &&
              Boolean(latestMedia.trackKey) &&
              p.trackKey !== latestMedia.trackKey;
            if (!staleTrack) {
              overlayState.active = Boolean(p.active);
              overlayState.playing = Boolean(p.playing);
              overlayState.loading = Boolean(p.loading);
              overlayState.trackKey = p.trackKey || latestMedia.trackKey || '';
              overlayState.title = p.title || '';
              overlayState.artist = p.artist || '';
              overlayState.prev = p.prev || '';
              overlayState.curr = p.curr || '';
              overlayState.next = p.next || '';
              overlayState.words = Array.isArray(p.words) ? p.words : [];
              overlayState.fromClient = true;
              overlayState.updatedAt = Date.now();
            }
          }
        } catch (_) {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, running: isOverlayRunning() }));
      });
      return;
    }
    await syncServerOverlayFallback();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ...overlayState, running: isOverlayRunning() }));
    return;
  }

  if (pathname.endsWith('/api/overlay-cover')) {
    const rgbaPath = path.join(WORKSPACE_DIR, '.overlay-cover.rgba');
    if (latestMedia.cover && fs.existsSync(rgbaPath)) {
      try {
        const buf = fs.readFileSync(rgbaPath);
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': buf.length,
          'Cache-Control': 'no-store',
        });
        res.end(buf);
        return;
      } catch (_) {}
    }
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname.endsWith('/api/open-studio')) {
    const focusScript = `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      using System.Text;
      public class CobraFocus {
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
        public static bool FocusCobra() {
          IntPtr found = IntPtr.Zero;
          EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            var sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title == "Cobra Audio" || title.StartsWith("Cobra Audio -")) {
              found = hWnd;
              return false;
            }
            return true;
          }, IntPtr.Zero);
          if (found != IntPtr.Zero) {
            if (IsIconic(found)) ShowWindow(found, 9);
            else ShowWindow(found, 5);
            keybd_event(0x12, 0, 0, UIntPtr.Zero);
            SetForegroundWindow(found);
            keybd_event(0x12, 0, 2, UIntPtr.Zero);
            return true;
          }
          return false;
        }
      }
"@
      if ([CobraFocus]::FocusCobra()) { Write-Output "FOCUSED" } else { Write-Output "NOT_FOUND" }
    `;
    const ps = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', focusScript],
      { windowsHide: true }
    );
    let out = '';
    ps.stdout.on('data', (d) => (out += d.toString()));
    ps.on('close', () => {
      let ok = out.includes('FOCUSED');
      if (!ok) {
        const exeCandidates = ['Cobra Audio.exe', 'Audio Spectrum Studio.exe']
          .map((n) => path.join(WORKSPACE_DIR, n))
          .find((p) => fs.existsSync(p));
        if (exeCandidates) {
          try {
            const child = spawn(exeCandidates, [], {
              cwd: WORKSPACE_DIR,
              detached: true,
              stdio: 'ignore',
            });
            child.unref();
            ok = true;
          } catch (_) {}
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok }));
    });
    return;
  }

  if (pathname.endsWith('/api/overlay-feed')) {
    await syncServerOverlayFallback();
    const cleanLine = (s) => String(s || '').replace(/[\r\n\t]+/g, ' ').trim();
    const wordsEncoded = (overlayState.words || [])
      .map((w) => `${cleanLine(w.text).replace(/\x1f/g, '')}\x1f${w.state || 0}`)
      .join('\t');
    const cfg = overlayState.config;
    // Always use latestMedia (SMTC) as authoritative source for title/artist/playing to prevent track flicker
    const authActive = latestMedia.active || overlayState.active;
    const authPlaying = latestMedia.active ? latestMedia.status === 'Playing' : overlayState.playing;
    const authTitle = latestMedia.active && latestMedia.title ? latestMedia.title : overlayState.title;
    const authArtist = latestMedia.active && latestMedia.artist ? latestMedia.artist : overlayState.artist;
    const isLoading = Boolean(overlayState.loading || serverLyricsState.fetching);
    const payload = [
      `active=${authActive ? 1 : 0}`,
      `playing=${authPlaying ? 1 : 0}`,
      `loading=${isLoading ? 1 : 0}`,
      `title=${cleanLine(authTitle)}`,
      `artist=${cleanLine(authArtist)}`,
      `cover_version=${latestMedia.cover && latestMedia.coverVersion ? latestMedia.coverVersion : 0}`,
      `prev=${cleanLine(overlayState.prev)}`,
      `curr=${cleanLine(overlayState.curr)}`,
      `next=${cleanLine(overlayState.next)}`,
      `words=${wordsEncoded}`,
      `pos=${cleanLine(cfg.pos || 'top')}`,
      `bar_w=${Math.round(Number(cfg.barWidth || 460))}`,
      `scale=${Number(cfg.scale || 1.15).toFixed(2)}`,
      `opacity=${Number(cfg.opacity ?? 0.95).toFixed(2)}`,
      `show_prev_next=${cfg.showPrevNext !== false ? 1 : 0}`,
      `dof_blur=${cfg.dofBlur !== false ? 1 : 0}`,
      `lyrics_style=${cleanLine(cfg.lyricsStyle || 'cinema')}`,
      `click_through=${cfg.clickThrough === true ? 1 : 0}`,
      `show_bg=${cfg.showBg !== false ? 1 : 0}`,
      `bg_color=${cleanLine(cfg.bgColor || '#0f1014')}`,
      `bg_opacity=${Number(cfg.bgOpacity ?? 0.68).toFixed(2)}`,
      `show_outline=${cfg.showOutline !== false ? 1 : 0}`,
      `outline_color=${cleanLine(cfg.outlineColor || '#ffffff')}`,
      `text_color=${cleanLine(cfg.textColor || '#ffffff')}`,
      `active_color=${cleanLine(cfg.activeColor || '#7dd3fc')}`,
      `text_shadow=${cfg.textShadow !== false ? 1 : 0}`,
      `shadow_strength=${Number(cfg.shadowStrength ?? 0.65).toFixed(2)}`,
      `text_glow=${cfg.textGlow === true ? 1 : 0}`,
      `text_outline=${cfg.textOutline === true ? 1 : 0}`,
      `show_controls=${cfg.showControls !== false ? 1 : 0}`,
      `reset_pos_token=${Number(cfg.resetPosToken || 0)}`,
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(payload);
    return;
  }

  // On port 19847 (desktop/app mode), resolve relative to WORKSPACE_DIR first; on port 80, WWW_ROOT first.
  const isPort80 = (req.headers.host || '').endsWith(':80') || !(req.headers.host || '').includes(':19847');
  const firstRoot = isPort80 ? WWW_ROOT : WORKSPACE_DIR;
  const secondRoot = isPort80 ? WORKSPACE_DIR : WWW_ROOT;

  let filePath = path.join(firstRoot, pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(secondRoot, pathname);
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const candidate = path.join(filePath, 'index.html');
    if (fs.existsSync(candidate)) filePath = candidate;
    else filePath = path.join(WORKSPACE_DIR, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

startAudioBridge();
startSmtcWorker();

const bridgeServer = http.createServer(handleRequest);
bridgeServer.listen(19847, '127.0.0.1', () => {
  console.log('Media & Lyrics Bridge active on http://127.0.0.1:19847');
});

const webServer = http.createServer(handleRequest);
webServer.on('error', () => {});
webServer.listen(80, '0.0.0.0', () => {
  console.log('Web Server active on http://localhost/App%20Pribadi/audio%20spectrum%20visualizer/');
});
