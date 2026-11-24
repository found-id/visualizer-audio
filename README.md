# 🐍 Cobra Audio — High-End Audio Spectrum Visualizer & Studio

<p align="center">
  <img src="assets/icon.png" alt="Cobra Audio Logo" width="140" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
  <img src="assets/icon.png" alt="Cobra Audio Logo" width="160" style="border-radius: 28px; box-shadow: 0 14px 40px rgba(0,0,0,0.6);" />
</p>

<p align="center">
  <b>Sistem Visualisasi Audio Studio Modern, Sinkronisasi Lirik Real-Time & Audio Bridge Berkecepatan Tinggi</b>
  <b>Sistem Visualisasi Audio Studio Modern, Sinkronisasi Lirik Real-Time & Native High-Performance Loopback Audio Bridge</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active%20Production-00e676?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Platform-Windows%20Desktop%20%7C%20Web-blue?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/Engine-Rust%20%2B%20WebAudio%20%2B%20Node.js-purple?style=for-the-badge" alt="Engine" />
  <img src="https://img.shields.io/badge/UI-Liquid%20Glass%20%2F%20Cinema-orange?style=for-the-badge" alt="UI" />
  <a href="https://github.com/found-id/visualizer-audio"><img src="https://img.shields.io/badge/Status-Active%20Production-00e676?style=for-the-badge&logo=codefactor&logoColor=white" alt="Status" /></a>
  <img src="https://img.shields.io/badge/Platform-Windows%20Desktop%20%7C%20Web-0284c7?style=for-the-badge&logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/Engine-Rust%20%2B%20WebAudio%20%2B%20Node.js-9333ea?style=for-the-badge&logo=rust&logoColor=white" alt="Engine" />
  <img src="https://img.shields.io/badge/UI-Liquid%20Glass%20%2F%20Cinema%20DOF-f59e0b?style=for-the-badge" alt="UI" />
</p>

---

## 📖 Tentang Cobra Audio

**Cobra Audio** adalah platform audio visualizer generasi terbaru yang dirancang untuk kebutuhan audiophile, content creator, live streamer, maupun studio monitoring. Memadukan keindahan visual dengan performa audio sampling berpresisi tinggi, Cobra Audio menghadirkan pengalaman visualisasi spektrum musik dan vokal yang responsif, fluid, dan estetik.
**Cobra Audio** adalah platform audio visualizer dan monitoring studio generasi modern yang dirancang untuk **audiophile, music producer, content creator, streamer, maupun penikmat musik harian**. Menggabungkan presisi komputasi sinyal audio dengan estetika visual tingkat studio, Cobra Audio menghadirkan pengalaman menikmati musik yang responsif, imersif, dan memukau secara visual.

Aplikasi ini hadir dalam arsitektur desktop hybrid berkecepatan tinggi bertenaga **Rust (WASAPI Loopback Capture & FFT)**, terintegrasi mulus dengan antarmuka grafis web modern berfitur **Liquid Glass Refraction**, **Chromatic Aberration**, serta **Sinkronisasi Lirik Otomatis (LRCLIB & SMTC Windows Media)**.
Aplikasi ini dibangun menggunakan arsitektur desktop hybrid berkecepatan tinggi bertenaga **Rust (WASAPI Loopback Capture & FFT)**, terintegrasi secara mulus dengan antarmuka grafis modern berfitur **Liquid Glass Refraction**, **Chromatic Aberration**, serta **Sinkronisasi Lirik Real-Time (LRCLIB & SMTC Windows Media)**.

---

## 🌟 Fitur Unggulan & Benefit
## 🌟 Fitur Unggulan & Benefit Utama

### 1. ⚡ High-Performance Audio Engine (Zero-Latency)
- **Rust WASAPI Loopback Capture**: Menangkap semua audio sistem Windows secara langsung tanpa lag dan tanpa virtual audio cable tambahan.
- **Fast Fourier Transform (FFT) Berpresisi**: Menghasilkan data frekuensi real-time yang akurat untuk bass, mid, dan treble.
- **Node.js + SSE/WebSocket Bridge**: Distribusi streaming stream data audio yang efisien ke UI visualizer.
### 1. ⚡ Zero-Latency Native Audio Engine (Rust + WASAPI)
- **Windows Loopback WASAPI Auto-Capture**: Menangkap output audio sistem Windows secara langsung tanpa lag, tanpa konfigurasi ribet, dan tanpa perlu virtual audio cable (Stereo Mix).
- **Fast Fourier Transform (FFT) Presisi Tinggi**: Melakukan kalkulasi spektrum real-time 0 Hz hingga 24.0 kHz dengan linear/logarithmic grouping yang halus.
- **Ultra-Low Resource Usage**: Didesain efisien untuk CPU/GPU sehingga performa audio & frame rate tetap mulus hingga 120+ FPS.

### 2. 🎨 Visualizer Spektrum Spektakuler & Dinamis
- **Multi-Preset Visualizer**: Mode Circular Spectrum, Waveform, Bar Analyzer, Pulse Orb, dan Particle Flow.
- **Liquid Glass Shader & Chromatic Aberration**: Efek refraksi kaca cair dinamis berbasis SVG filter dan rendering Canvas yang memanjakan mata.
- **Audio Reactivity Penuh**: Warna, intensitas glow, dan distorsi beradaptasi secara otomatis mengikuti ritme beat drop dan energi lagu.
### 2. 🎨 Studio Visualizer dengan Efek Sinematik
- **Multi-Mode Visualizer**:
  - `Spectrum`: Bar spektrum dengan deep glow, custom corner bevel, dan peak hold dots.
  - `Waveform`: Gelombang frekuensi dinamis yang mengikuti amplitudo lagu.
  - `Ribbon`: Pita sutra audio mengalir dengan interpolasi kurva yang elegan.
  - `Radial`: Lingkaran spektrum 360 derajat yang berdenyut mengikuti dentuman musik.
  - `Reflection`: Spektrum simetris dengan efek pantulan lantai studio.
- **Beat-Reactive FX**:
  - **Beat Shake & Bass Zoom**: Layar berdenyut dan berguncang lembut secara dinamis mengikuti beat bass drop.
  - **Camera Wiggle**: Gerakan dinamis handheld kamera yang alami.
  - **RGB Chromatic Flash**: Kilatan distorsi warna neon saat beat memuncak.
- **Liquid Glass Theme**: Tampilan kaca cair dengan refraksi SVG displacement dinamis, fresnel edge glow, dan blur latar belakang yang transparan.

### 3. 🎙️ Live Synchronized Lyrics (Cinema & Karaoke Subtitle)
- **Auto-Sync LRCLIB**: Otomatis mendeteksi lagu dan mengambil lirik tersinkronisasi per detik/milidetik.
- **Cinema Subtitle Mode**: Tampilan lirik melayang sinematik dengan efek fokus kedalaman (Blur Depth-of-Field).
- **Expanded Panel Mode**: Panel lirik gaya Spotify / Apple Music yang interaktif dan dapat digeser (resizable).
### 3. 🎙️ Live Synchronized Lyrics (DOF Blur & Karaoke Highlight)
- **Auto-Sync Lirik Real-Time**: Terhubung otomatis ke basis data lirik akurat (LRCLIB & multi-source fallback) dengan pencocokan milidetik.
- **Word-by-Word & Line Animation**: Animasi teks yang menyala dan memantul halus per kata saat diucapkan dalam musik.
- **Cinema Mode with Depth-of-Field (DOF)**: Lirik melayang sinematik dengan efek blur kedalaman fokus, di mana kalimat aktif tampil tajam sementara lirik sebelumnya dan sesudahnya memudar lembut.
- **Resizable Lyrics Panel**: Panel lirik interaktif dengan kontrol offset waktu (±0.5s), pencarian manual, dan switch kandidat lirik.

### 4. 🪟 Windows Media Session (SMTC) Integration
- Terintegrasi penuh dengan **System Media Transport Controls (SMTC)** Windows (Spotify, YouTube, browser, media player).
- Otomatis menampilkan judul lagu aktif, artis, album, dan cover art album beresolusi tinggi.
### 4. 🪟 Integrasi Penuh Windows Media (SMTC)
- Terhubung langsung ke **System Media Transport Controls (SMTC)** Windows untuk membaca Spotify, YouTube Music, Apple Music, Tidal, VLC, dan browser secara otomatis.
- Menampilkan judul lagu, artis, durasi, progress bar interaktif, serta **Cover Art Album** beresolusi tinggi langsung di visualizer.
- Kendali pemutar lengkap: Play, Pause, Next, Previous, dan Seek posisi lagu.

### 5. 🖥️ Penggunaan Fleksibel (Desktop Standalone & Web)
- Dapat dijalankan sebagai aplikasi desktop native ringan melalui launcher executable (`Cobra Audio.exe` / `desktop-rust`).
- Dapat diakses via web browser lokal melalui server Node.js / PHP bridge untuk setup dual-monitor atau OBS Browser Source.
### 5. 💾 Sistem Preset Otomatis & Manajemen Sesi
- **Auto-Save & Auto-Restore**: Cobra Audio otomatis menyimpan dan memulihkan preset/konfigurasi terakhir yang Anda gunakan saat aplikasi dibuka kembali.
- **Selective Preset Applicator**: Pilihan menerapkan preset per kategori (Visualizer & FX, UI & Liquid Glass, Background, atau Warna).
- **Export & Import JSON**: Simpan dan bagikan konfigurasi visualizer favorit Anda dalam format file `.json`.

### 6. 🖥️ Standalone Desktop App (Bebas Web Server / Laragon)
- Dilengkapi launcher native `Cobra Audio.exe` yang langsung membuka aplikasi dalam jendela desktop yang bersih (tanpa tab browser, address bar, atau popup mengganggu).
- Berjalan mandiri tanpa perlu menyalakan Apache, MySQL, atau web server eksternal.

---

## 📂 Struktur Repositori & Isi Proyek

```text
├── assets/                  # Aset grafis, ikon aplikasi (app.ico, icon.png)
├── desktop-rust/            # Backend Native Rust
├── assets/                  # Ikon aplikasi beresolusi tinggi (app.ico, icon.png)
├── desktop-rust/            # Backend Native Rust Engine
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
│   │   │   ├── audio-bridge.rs      # Audio bridge WASAPI loopback capture & broadcaster
│   │   │   └── studio-launcher.rs   # Desktop launcher standalone untuk Windows
│   │   └── main.rs                  # Native standalone GUI visualizer
│   ├── Cargo.toml           # Dependensi Rust (cpal, eframe, rustfft, serde, dll)
│   └── build.rs             # Script kompilasi resource & icon Windows
├── app.js                   # Visualizer logic, DSP processing, Web Audio API & lyrics engine
├── index.html               # Antarmuka utama dengan styling Liquid Glass & Canvas Visualizer
├── style.css                # Style sheet UI, animasi glassmorphism, slider kustom & neon glow
├── server.js                # Core bridge server (SMTC Windows, lyrics API & media stream)
├── smtc-worker.ps1          # Background worker PowerShell untuk integrasi media session Windows
├── media-bridge.php         # Endpoint alternatif kompatibilitas server PHP (opsional)
├── Cobra Audio.exe          # Launcher aplikasi desktop mandiri siap pakai
└── README.md                # Dokumentasi lengkap sistem Cobra Audio
```

---

## 🚀 Panduan Memulai (Quick Start)

### Menjalankan Versi Desktop Langsung:
Cukup jalankan file executable di root folder:
### Cara 1: Menggunakan Aplikasi Desktop (Rekomendasi)
Cukup jalankan file executable utama di root repositori:
```powershell
.\Cobra Audio.exe
```
*Aplikasi akan langsung membuka jendela mandiri, mendeteksi lagu yang sedang diputar di Windows, dan menangkap audio secara otomatis.*

### Menjalankan Mode Development / Web Server:
1. Pastikan Anda telah menginstal **Node.js**.
2. Jalankan server lokal:
---

### Cara 2: Menjalankan via Node.js
Jika ingin menjalankan dalam mode development atau via browser:

1. **Jalankan Server Bridge**:
   ```bash
   node server.js
   ```
3. Buka browser di alamat:
2. **Buka di Browser**:
   Kunjungi alamat:
   ```text
   http://localhost:3000
   http://127.0.0.1:19847/index.html
   ```
4. Putar lagu apa saja di komputer Anda (Spotify, YouTube, browser, dll), dan visualizer akan otomatis bergoyang mengikuti alunan musik!
3. Putar musik di Spotify, YouTube, atau pemutar musik apa pun di Windows, dan visualizer akan langsung menyala sinkron!

---

## ⌨️ Shortcut Keyboard

| Tombol | Fungsi |
| :--- | :--- |
| `Space` | Pause / Resume Animasi Visualizer |
| `F` | Masuk / Keluar Mode Fullscreen |
| `L` | Buka / Tutup Panel Lirik |
| `C` | Toggle Cinema Subtitle Mode |
| `M` | Mute / Unmute Sumber Audio |
| :---: | :--- |
| `Space` | Play / Pause Musik (kontrol langsung ke SMTC Windows) |
| `F` | Masuk / Keluar Mode Layar Penuh (Fullscreen) |
| `H` | Sembunyikan / Tampilkan HUD kontrol visualizer |
| `S` | Buka / Tutup Panel Studio Pengaturan |
| `L` | Buka / Tutup Panel Lirik Interaktif |

---

## 🛠️ Persyaratan Sistem (System Requirements)
- **Sistem Operasi**: Windows 10 / Windows 11 (64-bit)
- **Node.js**: v16+ (untuk menjalankan server bridge atau development)
- **Rust Toolchain**: Rust 1.70+ (hanya jika ingin mengompilasi ulang binary di `desktop-rust`)
- **Browser Runtime**: Microsoft Edge WebView2 / Chrome / Chromium-based browser

---

<p align="center">
  Made with ❤️ by <b>Found ID</b> & <b>Cobra Audio Team</b>
  Dibuat dengan dedikasi oleh <b><a href="https://github.com/found-id">Found ID</a></b> & Tim <b>Cobra Audio</b>
</p>
