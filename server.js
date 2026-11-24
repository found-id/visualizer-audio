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
const lyricsCache = new Map();

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
          if (parsed.active) {
            const cover = parsed.cover || (parsed.trackKey === latestMedia.trackKey ? latestMedia.cover : '');
            latestMedia = {
              ...parsed,
              cover,
              updatedAt: Date.now(),
            };
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

function fetchJsonHttps(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'AudioSpectrumStudio/2.0 (https://localhost)',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        }
      )
      .on('error', reject);
  });
}

function buildSearchQueries(rawTitle, rawArtist) {
  const queries = [];
  const isSlowed = /slowed/i.test(rawTitle);

  // Clean noise like (Official Video), || ..., [Lyrics], (ft. ...)
  const stripNoise = (str, keepSlowed) => {
    let s = str
      .replace(/\|\|.*$/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\((?:ft\.?|feat\.?|official|video|audio|lyrics|visualizer|hd|4k)[^)]*\)/gi, ' ')
      .replace(/\b(?:ft\.?|feat\.?)\s+[^-|()]+/gi, ' ')
      .replace(/[^\p{L}\p{N}\s'-]/gu, ' ');
    if (!keepSlowed) {
      s = s.replace(/\b(?:slowed|reverb|reverbed|sped\s*up|nightcore|tiktok|version|edit)\b/gi, ' ');
    }
    return s.replace(/\s+/g, ' ').trim();
  };

  if (isSlowed) {
    const qSlowed = `${stripNoise(rawTitle, false)} slowed`;
    if (qSlowed.length > 3) queries.push(qSlowed);
  }

  const baseTitle = stripNoise(rawTitle, false);
  const cleanArtist = (rawArtist || '').replace(/\s*-\s*Topic$/i, '').trim();

  if (baseTitle.length > 1) {
    queries.push(baseTitle);
    if (cleanArtist && !baseTitle.toLowerCase().includes(cleanArtist.toLowerCase())) {
      queries.push(`${cleanArtist} ${baseTitle}`);
    }
  }

  return [...new Set(queries)];
}

async function findBestLyrics(title, artist, duration, forceFresh = false) {
  const cacheKey = `${title}|${artist}`;
  if (!forceFresh && lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey);

  const queries = buildSearchQueries(title, artist);
  let rawResults = [];

  for (const q of queries) {
    try {
      const results = await fetchJsonHttps(
        `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`
      );
      if (Array.isArray(results) && results.length > 0) {
        rawResults.push(...results);
        if (rawResults.filter((c) => c.syncedLyrics).length >= 3) break;
      }
    } catch (_) {}
  }

  const targetDur = parseFloat(duration) || 0;
  const seenIds = new Set();
  const deduped = [];
  for (const item of rawResults) {
    if (!item || (!item.syncedLyrics && !item.plainLyrics)) continue;
    const key = item.id || `${item.trackName}|${item.artistName}|${item.duration}`;
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    deduped.push({
      source: 'LRCLIB',
      trackName: item.trackName || title,
      artistName: item.artistName || artist,
      duration: item.duration || 0,
      synced: Boolean(item.syncedLyrics),
      syncedLyrics: item.syncedLyrics || '',
      plainLyrics: item.plainLyrics || '',
    });
  }

  // Fallback to Lyrics.ovh if LRCLIB has no matches
  if (deduped.length === 0 && artist) {
    try {
      const cleanA = artist.replace(/\s*-\s*Topic$/i, '').trim();
      const ovh = await fetchJsonHttps(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanA)}/${encodeURIComponent(title)}`
      );
      if (ovh && ovh.lyrics) {
        deduped.push({
          source: 'Lyrics.ovh',
          trackName: title,
          artistName: cleanA,
          duration: targetDur,
          synced: false,
          syncedLyrics: '',
          plainLyrics: ovh.lyrics,
        });
      }
    } catch (_) {}
  }

  if (deduped.length === 0) {
    const empty = { found: false, candidates: [] };
    lyricsCache.set(cacheKey, empty);
    return empty;
  }

  deduped.sort((a, b) => {
    if (a.synced !== b.synced) return a.synced ? -1 : 1;
    if (targetDur <= 0) return 0;
    return Math.abs(a.duration - targetDur) - Math.abs(b.duration - targetDur);
  });

  const topCandidates = deduped.slice(0, 8);
  const best = topCandidates[0];
  const output = {
    found: true,
    synced: best.synced,
    trackName: best.trackName,
    artistName: best.artistName,
    duration: best.duration,
    syncedLyrics: best.syncedLyrics,
    plainLyrics: best.plainLyrics,
    candidates: topCandidates,
  };
  lyricsCache.set(cacheKey, output);
  return output;
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
    let ok = false;
    if (['playpause', 'play', 'pause', 'next', 'prev', 'refresh'].includes(cmd)) {
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
    const duration = parsedUrl.searchParams.get('duration') || '0';
    const fresh = parsedUrl.searchParams.get('fresh') === '1';
    if (!title) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ found: false }));
      return;
    }
    const result = await findBestLyrics(title, artist, duration, fresh);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
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
