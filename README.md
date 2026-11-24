# 🐍 Cobra Audio — High-End Audio Spectrum Visualizer & Studio

<p align="center">
  <img src="assets/icon.png" alt="Cobra Audio Logo" width="140" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
</p>

<p align="center">
  <b>Sistem Visualisasi Audio Studio Modern, Sinkronisasi Lirik Real-Time & Audio Bridge Berkecepatan Tinggi</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active%20Production-00e676?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Platform-Windows%20Desktop%20%7C%20Web-blue?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/Engine-Rust%20%2B%20WebAudio%20%2B%20Node.js-purple?style=for-the-badge" alt="Engine" />
  <img src="https://img.shields.io/badge/UI-Liquid%20Glass%20%2F%20Cinema-orange?style=for-the-badge" alt="UI" />
</p>

---

## 📖 Tentang Cobra Audio

**Cobra Audio** adalah platform audio visualizer generasi terbaru yang dirancang untuk kebutuhan audiophile, content creator, live streamer, maupun studio monitoring. Memadukan keindahan visual dengan performa audio sampling berpresisi tinggi, Cobra Audio menghadirkan pengalaman visualisasi spektrum musik dan vokal yang responsif, fluid, dan estetik.

Aplikasi ini hadir dalam arsitektur desktop hybrid berkecepatan tinggi bertenaga **Rust (WASAPI Loopback Capture & FFT)**, terintegrasi mulus dengan antarmuka grafis web modern berfitur **Liquid Glass Refraction**, **Chromatic Aberration**, serta **Sinkronisasi Lirik Otomatis (LRCLIB & SMTC Windows Media)**.

---

## 🌟 Fitur Unggulan & Benefit

### 1. ⚡ High-Performance Audio Engine (Zero-Latency)
- **Rust WASAPI Loopback Capture**: Menangkap semua audio sistem Windows secara langsung tanpa lag dan tanpa virtual audio cable tambahan.
- **Fast Fourier Transform (FFT) Berpresisi**: Menghasilkan data frekuensi real-time yang akurat untuk bass, mid, dan treble.
- **Node.js + SSE/WebSocket Bridge**: Distribusi streaming stream data audio yang efisien ke UI visualizer.

### 2. 🎨 Visualizer Spektrum Spektakuler & Dinamis
- **Multi-Preset Visualizer**: Mode Circular Spectrum, Waveform, Bar Analyzer, Pulse Orb, dan Particle Flow.
- **Liquid Glass Shader & Chromatic Aberration**: Efek refraksi kaca cair dinamis berbasis SVG filter dan rendering Canvas yang memanjakan mata.
- **Audio Reactivity Penuh**: Warna, intensitas glow, dan distorsi beradaptasi secara otomatis mengikuti ritme beat drop dan energi lagu.

### 3. 🎙️ Live Synchronized Lyrics (Cinema & Karaoke Subtitle)
- **Auto-Sync LRCLIB**: Otomatis mendeteksi lagu dan mengambil lirik tersinkronisasi per detik/milidetik.
- **Cinema Subtitle Mode**: Tampilan lirik melayang sinematik dengan efek fokus kedalaman (Blur Depth-of-Field).
- **Expanded Panel Mode**: Panel lirik gaya Spotify / Apple Music yang interaktif dan dapat digeser (resizable).

### 4. 🪟 Windows Media Session (SMTC) Integration
- Terintegrasi penuh dengan **System Media Transport Controls (SMTC)** Windows (Spotify, YouTube, browser, media player).
- Otomatis menampilkan judul lagu aktif, artis, album, dan cover art album beresolusi tinggi.

### 5. 🖥️ Penggunaan Fleksibel (Desktop Standalone & Web)
- Dapat dijalankan sebagai aplikasi desktop native ringan melalui launcher executable (`Cobra Audio.exe` / `desktop-rust`).
- Dapat diakses via web browser lokal melalui server Node.js / PHP bridge untuk setup dual-monitor atau OBS Browser Source.

---

## 📂 Struktur Repositori & Isi Proyek

```text
├── assets/                  # Aset grafis, ikon aplikasi (app.ico, icon.png)
├── desktop-rust/            # Backend Native Rust
│   ├── src/
│   │   ├── bin/
│   │   │   ├── audio-bridge.rs      # WASAPI loopback capture & audio stream broadcaster
│   │   │   └── studio-launcher.rs   # Windows WebView2 / browser desktop launcher
│   │   └── main.rs                  # Native standalone audio visualizer GUI
│   ├── Cargo.toml           # Dependensi Rust (cpal, eframe, rustfft, dll)
│   └── build.rs             # Script build resource Windows
├── app.js                   # Logic visualizer, filter audio, Web Audio API & lyrics sync
├── index.html               # UI utama dengan styling Liquid Glass & Canvas Visualizer
├── style.css                # Desain visual, animasi neon glow, dan layout responsif
├── server.js                # Server backend Node.js (Media bridge, SMTC, lyrics proxy)
├── smtc-worker.ps1          # Background worker PowerShell untuk metadata media Windows
├── media-bridge.php         # Alternatif endpoint bridge untuk lingkungan server PHP/Laragon
└── Cobra Audio.exe          # Launcher aplikasi desktop siap pakai
```

---

## 🚀 Panduan Memulai (Quick Start)

### Menjalankan Versi Desktop Langsung:
Cukup jalankan file executable di root folder:
```powershell
.\Cobra Audio.exe
```

### Menjalankan Mode Development / Web Server:
1. Pastikan Anda telah menginstal **Node.js**.
2. Jalankan server lokal:
   ```bash
   node server.js
   ```
3. Buka browser di alamat:
   ```text
   http://localhost:3000
   ```
4. Putar lagu apa saja di komputer Anda (Spotify, YouTube, browser, dll), dan visualizer akan otomatis bergoyang mengikuti alunan musik!

---

## ⌨️ Shortcut Keyboard

| Tombol | Fungsi |
| :--- | :--- |
| `Space` | Pause / Resume Animasi Visualizer |
| `F` | Masuk / Keluar Mode Fullscreen |
| `L` | Buka / Tutup Panel Lirik |
| `C` | Toggle Cinema Subtitle Mode |
| `M` | Mute / Unmute Sumber Audio |

---

<p align="center">
  Made with ❤️ by <b>Found ID</b> & <b>Cobra Audio Team</b>
</p>
