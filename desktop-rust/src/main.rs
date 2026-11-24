#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::VecDeque;
use std::f32::consts::PI;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream};
use eframe::egui::{self, Color32, Pos2, Rect, Stroke, Vec2};
use rustfft::{num_complex::Complex, Fft, FftPlanner};

const FFT_SIZE: usize = 8192;

#[derive(Clone, Copy, PartialEq, Eq)]
enum VisualMode {
    Spectrum,
    Waveform,
    Ribbon,
    Radial,
    Reflection,
}

impl VisualMode {
    const ALL: [Self; 5] = [
        Self::Spectrum,
        Self::Waveform,
        Self::Ribbon,
        Self::Radial,
        Self::Reflection,
    ];

    fn label(self) -> &'static str {
        match self {
            Self::Spectrum => "Spectrum Bars",
            Self::Waveform => "Waveform",
            Self::Ribbon => "Silk Ribbon",
            Self::Radial => "Radial Ring",
            Self::Reflection => "Floor Reflection",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum BackgroundStyle {
    PureBlack,
    BassPulse,
    AuroraNebula,
    Starfield,
    Vignette,
}

impl BackgroundStyle {
    const ALL: [Self; 5] = [
        Self::PureBlack,
        Self::BassPulse,
        Self::AuroraNebula,
        Self::Starfield,
        Self::Vignette,
    ];

    fn label(self) -> &'static str {
        match self {
            Self::PureBlack => "Pure Black (#000)",
            Self::BassPulse => "Dynamic Bass Pulse",
            Self::AuroraNebula => "Aurora Nebula",
            Self::Starfield => "Reactive Starfield",
            Self::Vignette => "Deep Obsidian",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum ColorTheme {
    PureWhite,
    Aurora,
    Cyberpunk,
    Rainbow,
    Sunset,
    IceCyan,
    NeonViolet,
    WarmAmber,
    Emerald,
    Crimson,
    CyberGold,
    OceanDeep,
}

impl ColorTheme {
    const ALL: [Self; 12] = [
        Self::PureWhite,
        Self::Aurora,
        Self::Cyberpunk,
        Self::Rainbow,
        Self::Sunset,
        Self::IceCyan,
        Self::NeonViolet,
        Self::WarmAmber,
        Self::Emerald,
        Self::Crimson,
        Self::CyberGold,
        Self::OceanDeep,
    ];

    fn label(self) -> &'static str {
        match self {
            Self::PureWhite => "Pure White",
            Self::Aurora => "Aurora",
            Self::Cyberpunk => "Cyberpunk",
            Self::Rainbow => "Rainbow",
            Self::Sunset => "Sunset Rose",
            Self::IceCyan => "Ice Cyan",
            Self::NeonViolet => "Neon Violet",
            Self::WarmAmber => "Warm Amber",
            Self::Emerald => "Emerald",
            Self::Crimson => "Crimson Pulse",
            Self::CyberGold => "Cyber Gold",
            Self::OceanDeep => "Ocean Deep",
        }
    }

    fn stops(self) -> &'static [(u8, u8, u8)] {
        match self {
            Self::PureWhite => &[(255, 255, 255), (228, 228, 231)],
            Self::Aurora => &[(34, 211, 238), (52, 211, 153), (167, 139, 250)],
            Self::Cyberpunk => &[(6, 182, 212), (236, 72, 153), (250, 204, 21)],
            Self::Rainbow => &[
                (239, 68, 68),
                (245, 158, 11),
                (16, 185, 129),
                (6, 182, 212),
                (139, 92, 246),
                (236, 72, 153),
            ],
            Self::Sunset => &[(251, 113, 133), (244, 114, 182), (251, 191, 36)],
            Self::IceCyan => &[(56, 189, 248), (125, 211, 252), (224, 242, 254)],
            Self::NeonViolet => &[(139, 92, 246), (192, 132, 252), (244, 114, 182)],
            Self::WarmAmber => &[(245, 158, 11), (252, 211, 77), (254, 243, 199)],
            Self::Emerald => &[(16, 185, 129), (110, 231, 183), (167, 243, 208)],
            Self::Crimson => &[(239, 68, 68), (251, 113, 133), (253, 164, 175)],
            Self::CyberGold => &[(234, 179, 8), (253, 224, 71), (255, 255, 255)],
            Self::OceanDeep => &[(29, 78, 216), (6, 182, 212), (103, 232, 249)],
        }
    }

    fn color_at(self, t: f32, alpha: u8) -> Color32 {
        let stops = self.stops();
        if stops.len() == 1 {
            let (r, g, b) = stops[0];
            return Color32::from_rgba_unmultiplied(r, g, b, alpha);
        }
        let clamped = t.clamp(0.0, 1.0);
        let scaled = clamped * (stops.len() - 1) as f32;
        let idx = (scaled.floor() as usize).min(stops.len() - 2);
        let frac = scaled - idx as f32;
        let (r0, g0, b0) = stops[idx];
        let (r1, g1, b1) = stops[idx + 1];
        let r = (r0 as f32 + (r1 as f32 - r0 as f32) * frac) as u8;
        let g = (g0 as f32 + (g1 as f32 - g0 as f32) * frac) as u8;
        let b = (b0 as f32 + (b1 as f32 - b0 as f32) * frac) as u8;
        Color32::from_rgba_unmultiplied(r, g, b, alpha)
    }
}

struct Star {
    angle: f32,
    dist: f32,
    speed: f32,
    size: f32,
}

struct Particle {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    size: f32,
    alpha: f32,
}

struct FastRng(u32);
impl FastRng {
    fn next_f32(&mut self) -> f32 {
        self.0 = self.0.wrapping_mul(1664525).wrapping_add(1013904223);
        ((self.0 >> 8) as f32) / ((1u32 << 24) as f32)
    }
}

struct AudioShared {
    ring: VecDeque<f32>,
    sample_rate: f32,
    device_name: String,
    error: Option<String>,
}

impl AudioShared {
    fn new() -> Self {
        Self {
            ring: VecDeque::from(vec![0.0; FFT_SIZE]),
            sample_rate: 48000.0,
            device_name: String::from("Default Output"),
            error: None,
        }
    }

    fn push_mono(&mut self, sample: f32) {
        if self.ring.len() >= FFT_SIZE {
            self.ring.pop_front();
        }
        self.ring.push_back(sample);
    }
}

fn start_wasapi_loopback(shared: Arc<Mutex<AudioShared>>) -> Option<Stream> {
    let host = cpal::default_host();
    let device = match host.default_output_device() {
        Some(d) => d,
        None => {
            if let Ok(mut state) = shared.lock() {
                state.error = Some("Tidak ada perangkat output audio ditemukan.".to_string());
            }
            return None;
        }
    };

    let dev_name = device
        .name()
        .unwrap_or_else(|_| "System Loopback".to_string());

    let supported = match device.default_output_config() {
        Ok(cfg) => cfg,
        Err(err) => {
            if let Ok(mut state) = shared.lock() {
                state.error = Some(format!("Gagal membaca konfigurasi audio: {err}"));
            }
            return None;
        }
    };

    let sample_rate = supported.sample_rate().0 as f32;
    let channels = supported.channels() as usize;
    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();

    if let Ok(mut state) = shared.lock() {
        state.sample_rate = sample_rate;
        state.device_name = dev_name;
        state.error = None;
    }

    let err_shared = Arc::clone(&shared);
    let err_fn = move |err: cpal::StreamError| {
        if let Ok(mut state) = err_shared.lock() {
            state.error = Some(format!("Audio stream error: {err}"));
        }
    };

    let stream_res = match sample_format {
        SampleFormat::F32 => {
            let s = Arc::clone(&shared);
            device.build_input_stream(
                &config,
                move |data: &[f32], _| {
                    if let Ok(mut state) = s.lock() {
                        for frame in data.chunks(channels.max(1)) {
                            let mono: f32 = frame.iter().copied().sum::<f32>() / frame.len() as f32;
                            state.push_mono(mono);
                        }
                    }
                },
                err_fn,
                None,
            )
        }
        SampleFormat::I16 => {
            let s = Arc::clone(&shared);
            device.build_input_stream(
                &config,
                move |data: &[i16], _| {
                    if let Ok(mut state) = s.lock() {
                        for frame in data.chunks(channels.max(1)) {
                            let mono: f32 = frame
                                .iter()
                                .map(|&v| v as f32 / i16::MAX as f32)
                                .sum::<f32>()
                                / frame.len() as f32;
                            state.push_mono(mono);
                        }
                    }
                },
                err_fn,
                None,
            )
        }
        SampleFormat::U16 => {
            let s = Arc::clone(&shared);
            device.build_input_stream(
                &config,
                move |data: &[u16], _| {
                    if let Ok(mut state) = s.lock() {
                        for frame in data.chunks(channels.max(1)) {
                            let mono: f32 = frame
                                .iter()
                                .map(|&v| (v as f32 / u16::MAX as f32) * 2.0 - 1.0)
                                .sum::<f32>()
                                / frame.len() as f32;
                            state.push_mono(mono);
                        }
                    }
                },
                err_fn,
                None,
            )
        }
        other => {
            if let Ok(mut state) = shared.lock() {
                state.error = Some(format!("Format sampel tidak didukung: {other:?}"));
            }
            return None;
        }
    };

    match stream_res {
        Ok(stream) => {
            if let Err(err) = stream.play() {
                if let Ok(mut state) = shared.lock() {
                    state.error = Some(format!("Gagal memulai stream audio: {err}"));
                }
                return None;
            }
            Some(stream)
        }
        Err(err) => {
            if let Ok(mut state) = shared.lock() {
                state.error = Some(format!("Gagal membuka WASAPI loopback: {err}"));
            }
            None
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum RulerPos {
    Bottom,
    Center,
    Top,
    Custom,
}

impl RulerPos {
    const ALL: [Self; 4] = [Self::Bottom, Self::Center, Self::Top, Self::Custom];
    fn label(self) -> &'static str {
        match self {
            Self::Bottom => "Bawah",
            Self::Center => "Tengah",
            Self::Top => "Atas",
            Self::Custom => "Custom Y%",
        }
    }
}

fn format_freq_label(hz: f32) -> String {
    let abs = hz.abs();
    let sign = if hz < 0.0 { "-" } else { "" };
    if abs >= 1000.0 {
        format!("{sign}{:.1} kHz", abs / 1000.0)
    } else {
        format!("{:.0} Hz", hz)
    }
}

fn map_log_freq(t: f32, min_freq: f32, max_freq: f32) -> f32 {
    let base = 120.0_f32;
    min_freq + (max_freq - min_freq) * ((base.powf(t) - 1.0) / (base - 1.0))
}

struct VisualizerApp {
    shared: Arc<Mutex<AudioShared>>,
    _stream: Option<Stream>,
    fft: Arc<dyn Fft<f32>>,
    hann_window: Vec<f32>,
    fft_buffer: Vec<Complex<f32>>,
    samples_scratch: Vec<f32>,

    mode: VisualMode,
    theme: ColorTheme,
    bg_style: BackgroundStyle,
    ruler_pos: RulerPos,
    ruler_y_pct: f32,
    show_ruler: bool,
    min_freq: f32,
    max_freq: f32,
    gain: f32,
    bar_count: usize,
    bar_thickness: f32,
    max_height_ratio: f32,
    attack_speed: f32,
    release_smooth: f32,
    spatial_smooth: usize,
    treble_tilt: f32,
    glow_intensity: f32,
    pulse_brightness: f32,
    bass_shake: f32,
    beat_zoom: bool,
    zoom_amp: f32,
    zoom_smooth: f32,
    zoom_thresh: f32,
    wiggle: bool,
    wiggle_amp: f32,
    wiggle_speed: f32,
    peaks: bool,
    rgb_beat_flash: bool,
    show_particles: bool,
    mirror: bool,
    vis_light_mode: bool,

    is_fullscreen: bool,
    studio_open: bool,
    hud_force_hidden: bool,
    last_mouse_move: Instant,
    last_mouse_pos: Option<Pos2>,
    start_time: Instant,

    bass_energy: f32,
    bass_avg: f32,
    beat_impulse: f32,
    beat_zoom_current: f32,
    rgb_flash: f32,

    smoothed_bars: Vec<f32>,
    scratch_bars: Vec<f32>,
    peak_bars: Vec<f32>,
    peak_velocity: Vec<f32>,

    rng: FastRng,
    stars: Vec<Star>,
    particles: Vec<Particle>,
}

impl VisualizerApp {
    fn new() -> Self {
        let shared = Arc::new(Mutex::new(AudioShared::new()));
        let stream = start_wasapi_loopback(Arc::clone(&shared));

        let mut planner = FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(FFT_SIZE);

        let hann_window: Vec<f32> = (0..FFT_SIZE)
            .map(|i| 0.5 * (1.0 - (2.0 * PI * i as f32 / (FFT_SIZE - 1) as f32).cos()))
            .collect();

        let mut rng = FastRng(0x1234_5678);
        let stars = (0..110)
            .map(|_| Star {
                angle: rng.next_f32() * PI * 2.0,
                dist: rng.next_f32(),
                speed: 0.0012 + rng.next_f32() * 0.0025,
                size: 0.8 + rng.next_f32() * 1.8,
            })
            .collect();

        let particles = (0..48)
            .map(|_| Particle {
                x: rng.next_f32(),
                y: rng.next_f32(),
                vx: (rng.next_f32() - 0.5) * 0.0015,
                vy: -0.001 - rng.next_f32() * 0.0025,
                size: 1.2 + rng.next_f32() * 2.4,
                alpha: 0.2 + rng.next_f32() * 0.6,
            })
            .collect();

        let initial_bars = 104;
        Self {
            shared,
            _stream: stream,
            fft,
            hann_window,
            fft_buffer: vec![Complex::new(0.0, 0.0); FFT_SIZE],
            samples_scratch: vec![0.0; FFT_SIZE],
            mode: VisualMode::Spectrum,
            theme: ColorTheme::Aurora,
            bg_style: BackgroundStyle::BassPulse,
            ruler_pos: RulerPos::Bottom,
            ruler_y_pct: 84.0,
            show_ruler: true,
            min_freq: 0.0,
            max_freq: 20000.0,
            gain: 1.9,
            bar_count: initial_bars,
            bar_thickness: 0.52,
            max_height_ratio: 0.38,
            attack_speed: 0.65,
            release_smooth: 0.78,
            spatial_smooth: 1,
            treble_tilt: 0.60,
            glow_intensity: 28.0,
            pulse_brightness: 1.0,
            bass_shake: 1.0,
            beat_zoom: true,
            zoom_amp: 6.5,
            zoom_smooth: 0.82,
            zoom_thresh: 0.06,
            wiggle: false,
            wiggle_amp: 14.0,
            wiggle_speed: 1.2,
            peaks: true,
            rgb_beat_flash: true,
            show_particles: true,
            mirror: true,
            vis_light_mode: false,
            is_fullscreen: false,
            studio_open: false,
            hud_force_hidden: false,
            last_mouse_move: Instant::now(),
            last_mouse_pos: None,
            start_time: Instant::now(),
            bass_energy: 0.0,
            bass_avg: 0.05,
            beat_impulse: 0.0,
            beat_zoom_current: 1.0,
            rgb_flash: 0.0,
            smoothed_bars: vec![0.0; initial_bars],
            scratch_bars: vec![0.0; initial_bars],
            peak_bars: vec![0.0; initial_bars],
            peak_velocity: vec![0.0; initial_bars],
            rng,
            stars,
            particles,
        }
    }

    fn ensure_bar_len(&mut self) {
        if self.smoothed_bars.len() != self.bar_count {
            self.smoothed_bars.resize(self.bar_count, 0.0);
            self.scratch_bars.resize(self.bar_count, 0.0);
            self.peak_bars.resize(self.bar_count, 0.0);
            self.peak_velocity.resize(self.bar_count, 0.0);
        }
    }

    fn update_dsp(&mut self) {
        self.ensure_bar_len();

        let sample_rate = {
            let guard = self.shared.lock().unwrap();
            for (dst, &src) in self.samples_scratch.iter_mut().zip(guard.ring.iter()) {
                *dst = src;
            }
            guard.sample_rate
        };

        for i in 0..FFT_SIZE {
            self.fft_buffer[i] =
                Complex::new(self.samples_scratch[i] * self.hann_window[i], 0.0);
        }
        self.fft.process(&mut self.fft_buffer);

        let nyquist = sample_rate * 0.5;
        let half_bins = FFT_SIZE / 2;
        let norm = 2.0 / FFT_SIZE as f32;

        // Sub-bass energy (0 - 120 Hz) for beat detection, shake & RGB flash
        let bass_max_bin = ((120.0 / nyquist) * half_bins as f32)
            .ceil()
            .max(2.0) as usize;
        let mut bass_sum = 0.0_f32;
        for b in 0..=bass_max_bin.min(half_bins - 1) {
            let mag = self.fft_buffer[b].norm() * norm;
            let db = 20.0 * (mag + 1e-7).log10();
            bass_sum += ((db + 84.0) / 66.0).clamp(0.0, 1.0);
        }
        self.bass_energy = bass_sum / (bass_max_bin + 1) as f32;
        self.bass_avg = self.bass_avg * 0.94 + self.bass_energy * 0.06;

        let delta = self.bass_energy - self.bass_avg;
        if delta > 0.075 && self.bass_energy > 0.25 {
            self.beat_impulse = self.beat_impulse.max((delta * 4.5).min(1.5));
            if self.rgb_beat_flash && delta > 0.10 {
                self.rgb_flash = self.rgb_flash.max((delta * 5.0).min(1.0));
            }
        }
        self.beat_impulse *= 0.84;
        self.rgb_flash *= 0.82;

        if self.beat_zoom {
            let zoom_amp = self.zoom_amp / 100.0;
            let punch = if delta > self.zoom_thresh {
                ((delta - self.zoom_thresh) * 5.5).min(1.3)
            } else {
                0.0
            };
            let target_zoom = 1.0 + (self.bass_energy * 0.35 + punch * 0.65) * zoom_amp;
            if target_zoom > self.beat_zoom_current {
                self.beat_zoom_current = self.beat_zoom_current * 0.35 + target_zoom * 0.65;
            } else {
                self.beat_zoom_current =
                    self.beat_zoom_current * self.zoom_smooth + target_zoom * (1.0 - self.zoom_smooth);
            }
        } else {
            self.beat_zoom_current += (1.0 - self.beat_zoom_current) * 0.2;
        }

        if self.mode == VisualMode::Waveform {
            let step = (FFT_SIZE / self.bar_count).max(1);
            for i in 0..self.bar_count {
                let start = i * step;
                let end = (start + step).min(FFT_SIZE);
                let mut peak = 0.0_f32;
                for &s in &self.samples_scratch[start..end] {
                    let a = s.abs();
                    if a > peak {
                        peak = a;
                    }
                }
                let target = (peak * self.gain * 1.5).min(1.0);
                let coeff = if target > self.smoothed_bars[i] {
                    1.0 - self.attack_speed
                } else {
                    self.release_smooth
                };
                self.smoothed_bars[i] =
                    self.smoothed_bars[i] * coeff + target * (1.0 - coeff);
            }
        } else {
            let clamped_max = self.max_freq.min(nyquist).max(self.min_freq + 200.0);

            for i in 0..self.bar_count {
                let t0 = i as f32 / self.bar_count as f32;
                let t1 = (i + 1) as f32 / self.bar_count as f32;
                let f0 = map_log_freq(t0, self.min_freq, clamped_max);
                let f1 = map_log_freq(t1, self.min_freq, clamped_max);

                let low_f = f0.abs().min(f1.abs());
                let high_f = f0.abs().max(f1.abs());
                let bin_start = ((low_f / nyquist) * half_bins as f32).floor().max(0.0) as usize;
                let bin_end = (((high_f / nyquist) * half_bins as f32).ceil() as usize)
                    .max(bin_start)
                    .min(half_bins - 1);

                let mut peak = 0.0_f32;
                let mut sum = 0.0_f32;
                let mut count = 0usize;
                for b in bin_start..=bin_end {
                    let mag = self.fft_buffer[b].norm() * norm;
                    if mag > peak {
                        peak = mag;
                    }
                    sum += mag;
                    count += 1;
                }

                let avg = if count > 0 { sum / count as f32 } else { 0.0 };
                let blended = avg * 0.65 + peak * 0.35;
                let db = 20.0 * (blended + 1e-7).log10();
                let normalized = ((db + 86.0) / 68.0).clamp(0.0, 1.0);
                let tilt = 0.85 + t0 * self.treble_tilt;
                let target = (normalized.powf(1.2) * self.gain * tilt).min(1.0);
                let coeff = if target > self.smoothed_bars[i] {
                    1.0 - self.attack_speed
                } else {
                    self.release_smooth
                };
                self.smoothed_bars[i] =
                    self.smoothed_bars[i] * coeff + target * (1.0 - coeff);
            }
        }

        for _ in 0..self.spatial_smooth {
            for i in 0..self.bar_count {
                let prev = self.smoothed_bars[i.saturating_sub(1)];
                let next = self.smoothed_bars[(i + 1).min(self.bar_count - 1)];
                self.scratch_bars[i] =
                    prev * 0.22 + self.smoothed_bars[i] * 0.56 + next * 0.22;
            }
            self.smoothed_bars.copy_from_slice(&self.scratch_bars);
        }

        for i in 0..self.bar_count {
            if self.smoothed_bars[i] >= self.peak_bars[i] {
                self.peak_bars[i] = self.smoothed_bars[i];
                self.peak_velocity[i] = 0.0;
            } else {
                self.peak_velocity[i] += 0.0008;
                self.peak_bars[i] =
                    (self.peak_bars[i] - self.peak_velocity[i]).max(self.smoothed_bars[i]);
            }
        }
    }

    fn draw_background(&mut self, painter: &egui::Painter, rect: Rect) {
        let bg_color = if self.vis_light_mode {
            Color32::from_rgb(247, 246, 241)
        } else {
            Color32::BLACK
        };
        painter.rect_filled(rect, 0.0, bg_color);
        let center = rect.center();
        let max_r = rect.width().hypot(rect.height()) * 0.5;
        let t_sec = self.start_time.elapsed().as_secs_f32();

        match self.bg_style {
            BackgroundStyle::PureBlack => {}
            BackgroundStyle::Vignette => {
                painter.circle_filled(
                    center,
                    max_r * 0.6,
                    Color32::from_rgba_unmultiplied(38, 38, 46, 36),
                );
            }
            BackgroundStyle::BassPulse => {
                let r = max_r
                    * (0.25 + self.bass_energy * 0.35 * self.pulse_brightness.min(1.5)
                        + self.beat_impulse * 0.15);
                let alpha = (((0.06 + self.bass_energy * 0.20 + self.beat_impulse * 0.12)
                    * self.pulse_brightness)
                    * 255.0)
                    .clamp(0.0, 210.0) as u8;
                painter.circle_filled(center, r, self.theme.color_at(0.5, alpha));
            }
            BackgroundStyle::AuroraNebula => {
                let x1 = center.x + (t_sec * 0.35).cos() * rect.width() * 0.22;
                let y1 = center.y + (t_sec * 0.28).sin() * rect.height() * 0.18;
                let x2 = center.x - (t_sec * 0.31).cos() * rect.width() * 0.22;
                let y2 = center.y - (t_sec * 0.24).sin() * rect.height() * 0.18;
                let alpha = ((0.10 + self.bass_energy * 0.18) * 255.0).clamp(12.0, 75.0) as u8;
                painter.circle_filled(Pos2::new(x1, y1), max_r * 0.42, self.theme.color_at(0.15, alpha));
                painter.circle_filled(Pos2::new(x2, y2), max_r * 0.42, self.theme.color_at(0.85, alpha));
            }
            BackgroundStyle::Starfield => {
                let boost = 1.0 + self.bass_energy * 6.0 + self.beat_impulse * 5.0;
                for s in &mut self.stars {
                    s.dist += s.speed * boost;
                    if s.dist > 1.0 {
                        s.dist = 0.02;
                        s.angle = self.rng.next_f32() * PI * 2.0;
                    }
                    let r = s.dist * max_r;
                    let sx = center.x + s.angle.cos() * r;
                    let sy = center.y + s.angle.sin() * r;
                    let alpha = (s.dist * 210.0).clamp(15.0, 220.0) as u8;
                    let star_col = if self.vis_light_mode {
                        Color32::from_rgba_unmultiplied(30, 30, 36, alpha)
                    } else {
                        Color32::from_rgba_unmultiplied(255, 255, 255, alpha)
                    };
                    painter.circle_filled(
                        Pos2::new(sx, sy),
                        s.size * (0.6 + s.dist * 0.7),
                        star_col,
                    );
                }
            }
        }

        if self.show_particles {
            let boost = 1.0 + self.bass_energy * 3.5 + self.beat_impulse * 3.0;
            for p in &mut self.particles {
                p.x += p.vx * boost;
                p.y += p.vy * boost;
                if p.y < -0.05 || p.x < -0.05 || p.x > 1.05 {
                    p.x = self.rng.next_f32();
                    p.y = 1.04;
                }
                let alpha = (p.alpha * (0.45 + self.bass_energy * 0.55) * 255.0) as u8;
                painter.circle_filled(
                    Pos2::new(rect.left() + p.x * rect.width(), rect.top() + p.y * rect.height()),
                    p.size,
                    self.theme.color_at(0.5, alpha),
                );
            }
        }
    }

    fn draw_ruler(&self, painter: &egui::Painter, rect: Rect) {
        if !self.show_ruler || self.mode == VisualMode::Radial {
            return;
        }
        let margin = (rect.width() * 0.07).min(80.0);
        let usable_w = (rect.width() - margin * 2.0).max(120.0);
        let ruler_y = match self.ruler_pos {
            RulerPos::Bottom => {
                if self.mode == VisualMode::Reflection {
                    rect.top() + rect.height() * 0.62 + 22.0
                } else {
                    rect.bottom() - 96.0
                }
            }
            RulerPos::Center => rect.center().y,
            RulerPos::Top => rect.top() + 56.0,
            RulerPos::Custom => rect.top() + rect.height() * (self.ruler_y_pct / 100.0),
        };

        let line_col = if self.vis_light_mode {
            Color32::from_rgba_unmultiplied(24, 24, 27, 65)
        } else {
            Color32::from_rgba_unmultiplied(255, 255, 255, 65)
        };
        let text_col = if self.vis_light_mode {
            Color32::from_rgba_unmultiplied(24, 24, 27, 165)
        } else {
            Color32::from_rgba_unmultiplied(255, 255, 255, 160)
        };

        painter.line_segment(
            [Pos2::new(rect.left() + margin, ruler_y), Pos2::new(rect.right() - margin, ruler_y)],
            Stroke::new(1.0_f32, line_col),
        );

        let candidates = [
            -500.0, -400.0, -300.0, -200.0, -100.0, -50.0, 0.0, 20.0, 40.0, 60.0, 100.0, 200.0,
            400.0, 800.0, 1000.0, 2000.0, 4000.0, 8000.0, 12000.0, 16000.0, 20000.0, 24000.0,
        ];
        let base = 120.0_f32;
        let mut last_label_x = -999.0_f32;

        for f in candidates {
            if f < self.min_freq || f > self.max_freq {
                continue;
            }
            let ratio = (f - self.min_freq) / (self.max_freq - self.min_freq).max(1.0);
            let t = (1.0 + ratio * (base - 1.0)).ln() / base.ln();
            let x = rect.left() + margin + t * usable_w;

            painter.line_segment(
                [Pos2::new(x, ruler_y - 3.0), Pos2::new(x, ruler_y + 3.0)],
                Stroke::new(1.0_f32, line_col),
            );

            if x - last_label_x >= 54.0 {
                painter.line_segment(
                    [Pos2::new(x, ruler_y - 5.0), Pos2::new(x, ruler_y + 5.0)],
                    Stroke::new(1.0_f32, line_col),
                );
                painter.text(
                    Pos2::new(x, ruler_y + 14.0),
                    egui::Align2::CENTER_CENTER,
                    format_freq_label(f),
                    egui::FontId::proportional(10.0),
                    text_col,
                );
                last_label_x = x;
            }
        }
    }

    fn draw_visuals(&mut self, painter: &egui::Painter, rect: Rect) {
        self.draw_background(painter, rect);

        let t_sec = self.start_time.elapsed().as_secs_f32();
        let mut cam_offset = Vec2::ZERO;
        if self.bass_shake > 0.0 && self.beat_impulse > 0.02 {
            let mag = self.beat_impulse * 10.0 * self.bass_shake;
            cam_offset += Vec2::new(
                (self.rng.next_f32() - 0.5) * 2.0 * mag,
                (self.rng.next_f32() - 0.5) * 2.0 * mag,
            );
        }
        if self.wiggle {
            let t = t_sec * self.wiggle_speed;
            let boost = 1.0 + self.bass_energy * 0.6;
            cam_offset += Vec2::new(
                ((t * 1.1).sin() * 0.6 + (t * 2.3 + 1.4).sin() * 0.4) * self.wiggle_amp * boost,
                ((t * 0.9 + 0.7).cos() * 0.6 + (t * 1.9 + 2.1).sin() * 0.4) * self.wiggle_amp * boost,
            );
        }

        let zoomed_rect = Rect::from_center_size(
            rect.center(),
            rect.size() * self.beat_zoom_current,
        );

        if self.rgb_beat_flash && self.rgb_flash > 0.04 {
            let shift = self.rgb_flash * 9.0;
            let alpha = (self.rgb_flash * 165.0).clamp(0.0, 170.0) as u8;
            self.render_mode(
                painter,
                zoomed_rect,
                cam_offset + Vec2::new(-shift, 0.0),
                Some(Color32::from_rgba_unmultiplied(255, 42, 85, alpha)),
            );
            self.render_mode(
                painter,
                zoomed_rect,
                cam_offset + Vec2::new(shift, 0.0),
                Some(Color32::from_rgba_unmultiplied(0, 240, 255, alpha)),
            );
        }

        self.render_mode(painter, zoomed_rect, cam_offset, None);
        self.draw_ruler(painter, zoomed_rect);
    }

    fn render_mode(
        &self,
        painter: &egui::Painter,
        rect: Rect,
        offset: Vec2,
        override_color: Option<Color32>,
    ) {
        match self.mode {
            VisualMode::Spectrum | VisualMode::Waveform | VisualMode::Reflection => {
                self.draw_bars(painter, rect, offset, override_color);
            }
            VisualMode::Ribbon => self.draw_silk_ribbon(painter, rect, offset, override_color),
            VisualMode::Radial => self.draw_radial_ring(painter, rect, offset, override_color),
        }
    }

    fn draw_bars(
        &self,
        painter: &egui::Painter,
        rect: Rect,
        offset: Vec2,
        override_color: Option<Color32>,
    ) {
        let width = rect.width();
        let height = rect.height();
        let margin = (width * 0.07).min(80.0);
        let usable_w = (width - margin * 2.0).max(120.0);
        let pitch = usable_w / self.bar_count as f32;
        let bar_w = (pitch * self.bar_thickness).clamp(1.8, 12.0);
        let is_reflection = self.mode == VisualMode::Reflection;
        let glow_alpha = ((self.glow_intensity / 42.0) * 65.0).clamp(0.0, 75.0) as u8;

        for i in 0..self.bar_count {
            let t = i as f32 / (self.bar_count.saturating_sub(1)).max(1) as f32;
            let x = rect.left() + margin + i as f32 * pitch + pitch * 0.5 + offset.x;
            let core_color = override_color.unwrap_or_else(|| self.theme.color_at(t, 255));

            if is_reflection {
                let floor_y = rect.top() + height * 0.62 + offset.y;
                let max_h = height * self.max_height_ratio * 1.15;
                let h = (self.smoothed_bars[i] * max_h).max(2.0);
                let p_base = Pos2::new(x, floor_y);
                let p_top = Pos2::new(x, floor_y - h);

                if override_color.is_none() && self.glow_intensity > 0.5 {
                    painter.line_segment(
                        [p_base, p_top],
                        Stroke::new(bar_w * 2.3, self.theme.color_at(t, glow_alpha)),
                    );
                }
                painter.line_segment([p_base, p_top], Stroke::new(bar_w, core_color));
                painter.circle_filled(p_top, bar_w * 0.5, core_color);

                if override_color.is_none() {
                    let refl_col = self.theme.color_at(t, 45);
                    painter.line_segment(
                        [
                            Pos2::new(x, floor_y + 4.0),
                            Pos2::new(x, floor_y + 4.0 + h * 0.45),
                        ],
                        Stroke::new(bar_w, refl_col),
                    );
                }
            } else if self.mirror {
                let cy = rect.center().y + offset.y;
                let max_half_h = height * self.max_height_ratio;
                let dy = (self.smoothed_bars[i] * max_half_h).max(1.0);
                let p_top = Pos2::new(x, cy - dy);
                let p_bot = Pos2::new(x, cy + dy);

                if override_color.is_none() && self.glow_intensity > 0.5 {
                    painter.line_segment(
                        [p_top, p_bot],
                        Stroke::new(bar_w * 2.4, self.theme.color_at(t, glow_alpha)),
                    );
                }

                painter.line_segment([p_top, p_bot], Stroke::new(bar_w, core_color));
                painter.circle_filled(p_top, bar_w * 0.5, core_color);
                painter.circle_filled(p_bot, bar_w * 0.5, core_color);

                if override_color.is_none() && self.peaks && self.peak_bars[i] > 0.03 {
                    let py = self.peak_bars[i] * max_half_h + bar_w * 1.25;
                    let dot_r = (bar_w * 0.42).max(1.4);
                    let peak_color = self.theme.color_at(t, 230);
                    painter.circle_filled(Pos2::new(x, cy - py), dot_r, peak_color);
                    painter.circle_filled(Pos2::new(x, cy + py), dot_r, peak_color);
                }
            } else {
                let base_y = rect.top() + height * 0.84 + offset.y;
                let max_h = height * self.max_height_ratio * 1.5;
                let h = (self.smoothed_bars[i] * max_h).max(2.0);
                let p_base = Pos2::new(x, base_y);
                let p_top = Pos2::new(x, base_y - h);
                if override_color.is_none() && self.glow_intensity > 0.5 {
                    painter.line_segment(
                        [p_base, p_top],
                        Stroke::new(bar_w * 2.3, self.theme.color_at(t, glow_alpha)),
                    );
                }
                painter.line_segment([p_base, p_top], Stroke::new(bar_w, core_color));
                painter.circle_filled(p_top, bar_w * 0.5, core_color);
            }
        }
    }

    fn draw_silk_ribbon(
        &self,
        painter: &egui::Painter,
        rect: Rect,
        offset: Vec2,
        override_color: Option<Color32>,
    ) {
        let width = rect.width();
        let height = rect.height();
        let margin = (width * 0.07).min(80.0);
        let usable_w = (width - margin * 2.0).max(120.0);
        let max_half_h = height * self.max_height_ratio;
        let cy = rect.center().y + offset.y;
        let glow_alpha = ((self.glow_intensity / 42.0) * 65.0).clamp(0.0, 75.0) as u8;

        for i in 0..self.bar_count.saturating_sub(1) {
            let t0 = i as f32 / (self.bar_count - 1) as f32;
            let t1 = (i + 1) as f32 / (self.bar_count - 1) as f32;
            let x0 = rect.left() + margin + t0 * usable_w + offset.x;
            let x1 = rect.left() + margin + t1 * usable_w + offset.x;
            let dy0 = (self.smoothed_bars[i] * max_half_h).max(1.0);
            let dy1 = (self.smoothed_bars[i + 1] * max_half_h).max(1.0);

            if override_color.is_none() && self.glow_intensity > 0.5 {
                let gcol = self.theme.color_at(t0, glow_alpha);
                painter.line_segment(
                    [Pos2::new(x0, cy - dy0), Pos2::new(x1, cy - dy1)],
                    Stroke::new(6.0_f32, gcol),
                );
                if self.mirror {
                    painter.line_segment(
                        [Pos2::new(x0, cy + dy0), Pos2::new(x1, cy + dy1)],
                        Stroke::new(6.0_f32, gcol),
                    );
                }
            }

            let col = override_color.unwrap_or_else(|| self.theme.color_at(t0, 255));
            painter.line_segment(
                [Pos2::new(x0, cy - dy0), Pos2::new(x1, cy - dy1)],
                Stroke::new(2.4_f32, col),
            );
            if self.mirror {
                painter.line_segment(
                    [Pos2::new(x0, cy + dy0), Pos2::new(x1, cy + dy1)],
                    Stroke::new(2.4_f32, col),
                );
            }

            if override_color.is_none() {
                let fill_col = self.theme.color_at(t0, 32);
                let bottom_y = if self.mirror { cy + dy0 } else { cy };
                painter.line_segment(
                    [Pos2::new(x0, cy - dy0), Pos2::new(x0, bottom_y)],
                    Stroke::new((usable_w / self.bar_count as f32).max(1.5), fill_col),
                );
            }
        }
    }

    fn draw_radial_ring(
        &self,
        painter: &egui::Painter,
        rect: Rect,
        offset: Vec2,
        override_color: Option<Color32>,
    ) {
        let center = rect.center() + offset;
        let min_dim = rect.width().min(rect.height());
        let base_r = min_dim * (0.19 + self.bass_energy * 0.03);
        let max_spike = min_dim * (self.max_height_ratio * 0.65);
        let bar_w =
            ((2.0 * PI * base_r) / self.bar_count as f32 * self.bar_thickness).clamp(1.8, 6.0);
        let glow_alpha = ((self.glow_intensity / 42.0) * 65.0).clamp(0.0, 75.0) as u8;

        for i in 0..self.bar_count {
            let t = i as f32 / self.bar_count as f32;
            let angle = t * PI * 2.0 - PI * 0.5;
            let (sin_a, cos_a) = angle.sin_cos();

            let amp = self.smoothed_bars[i] * max_spike;
            let r_in = if self.mirror {
                (base_r - amp * 0.35).max(10.0)
            } else {
                base_r
            };
            let r_out = base_r + amp.max(2.0);

            let p_in = Pos2::new(center.x + cos_a * r_in, center.y + sin_a * r_in);
            let p_out = Pos2::new(center.x + cos_a * r_out, center.y + sin_a * r_out);

            if override_color.is_none() && self.glow_intensity > 0.5 {
                let gcol = self.theme.color_at(t, glow_alpha);
                painter.line_segment([p_in, p_out], Stroke::new(bar_w * 2.2, gcol));
            }

            let col = override_color.unwrap_or_else(|| self.theme.color_at(t, 255));
            painter.line_segment([p_in, p_out], Stroke::new(bar_w, col));
            painter.circle_filled(p_out, bar_w * 0.5, col);

            if override_color.is_none() && self.peaks && self.peak_bars[i] > 0.04 {
                let r_peak = base_r + self.peak_bars[i] * max_spike + 6.0;
                let p_peak = Pos2::new(center.x + cos_a * r_peak, center.y + sin_a * r_peak);
                painter.circle_filled(p_peak, 1.8, self.theme.color_at(t, 230));
            }
        }
    }
}

impl eframe::App for VisualizerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        ctx.request_repaint();

        ctx.input(|i| {
            if let Some(pos) = i.pointer.hover_pos() {
                if self.last_mouse_pos != Some(pos) {
                    self.last_mouse_pos = Some(pos);
                    self.last_mouse_move = Instant::now();
                }
            }
            if i.key_pressed(egui::Key::F) {
                self.is_fullscreen = !self.is_fullscreen;
                ctx.send_viewport_cmd(egui::ViewportCommand::Fullscreen(self.is_fullscreen));
            }
            if i.key_pressed(egui::Key::H) {
                self.hud_force_hidden = !self.hud_force_hidden;
                if self.hud_force_hidden {
                    self.studio_open = false;
                }
            }
            if i.key_pressed(egui::Key::S) {
                self.studio_open = !self.studio_open;
            }
        });

        self.update_dsp();

        let screen_rect = ctx.screen_rect();
        egui::CentralPanel::default()
            .frame(egui::Frame::none().fill(Color32::BLACK))
            .show(ctx, |ui| {
                let painter = ui.painter();
                self.draw_visuals(painter, screen_rect);
            });

        let (dev_name, err_msg) = {
            let guard = self.shared.lock().unwrap();
            (guard.device_name.clone(), guard.error.clone())
        };

        if self.studio_open && !self.hud_force_hidden {
            egui::Window::new("Studio Controls")
                .anchor(egui::Align2::RIGHT_TOP, Vec2::new(-16.0, 16.0))
                .resizable(false)
                .collapsible(false)
                .default_width(320.0)
                .max_height((screen_rect.height() - 100.0).max(260.0))
                .frame(
                    egui::Frame::none()
                        .fill(Color32::from_rgba_unmultiplied(14, 14, 18, 234))
                        .stroke(Stroke::new(
                            1.0_f32,
                            Color32::from_rgba_unmultiplied(255, 255, 255, 36),
                        ))
                        .rounding(14.0)
                        .inner_margin(egui::Margin::same(14.0)),
                )
                .show(ctx, |ui| {
                    egui::ScrollArea::vertical().show(ui, |ui| {
                        ui.label("Frekuensi & Audio");
                        ui.add(
                            egui::Slider::new(&mut self.min_freq, -500.0..=500.0)
                                .step_by(5.0)
                                .suffix(" Hz")
                                .text("Min Freq"),
                        );
                        ui.add(
                            egui::Slider::new(&mut self.max_freq, 1000.0..=24000.0)
                                .step_by(250.0)
                                .suffix(" Hz")
                                .text("Max Freq"),
                        );
                        if self.min_freq >= self.max_freq - 200.0 {
                            self.min_freq = (self.max_freq - 200.0).max(-500.0);
                        }
                        ui.add(egui::Slider::new(&mut self.gain, 0.4..=6.0).text("Gain"));
                        ui.add(egui::Slider::new(&mut self.treble_tilt, 0.0..=2.0).text("Treble Tilt"));
                        ui.add(egui::Slider::new(&mut self.attack_speed, 0.05..=1.0).text("Attack"));
                        ui.add(egui::Slider::new(&mut self.release_smooth, 0.05..=0.96).text("Release"));
                        ui.add(egui::Slider::new(&mut self.spatial_smooth, 0..=5).text("Spatial"));

                        ui.separator();
                        ui.label("Geometri & Ruler");
                        ui.add(egui::Slider::new(&mut self.bar_count, 24..=220).text("Bars"));
                        ui.add(egui::Slider::new(&mut self.bar_thickness, 0.15..=0.95).text("Thickness"));
                        ui.add(egui::Slider::new(&mut self.max_height_ratio, 0.15..=0.48).text("Height"));
                        ui.horizontal(|ui| {
                            ui.checkbox(&mut self.show_ruler, "Ruler (Hz)");
                            egui::ComboBox::from_id_salt("ruler_pos_combo")
                                .selected_text(self.ruler_pos.label())
                                .show_ui(ui, |ui| {
                                    for r in RulerPos::ALL {
                                        ui.selectable_value(&mut self.ruler_pos, r, r.label());
                                    }
                                });
                        });
                        if self.ruler_pos == RulerPos::Custom {
                            ui.add(
                                egui::Slider::new(&mut self.ruler_y_pct, 8.0..=92.0)
                                    .suffix("%")
                                    .text("Ruler Y"),
                            );
                        }

                        ui.separator();
                        ui.label("Efek, Beat Zoom & Camera");
                        ui.add(egui::Slider::new(&mut self.glow_intensity, 0.0..=64.0).text("Deep Glow"));
                        ui.add(egui::Slider::new(&mut self.pulse_brightness, 0.0..=2.5).text("Pulse Bright"));
                        ui.add(egui::Slider::new(&mut self.bass_shake, 0.0..=3.5).text("Bass Shake"));
                        ui.checkbox(&mut self.beat_zoom, "Beat Zoom / Scale");
                        if self.beat_zoom {
                            ui.add(
                                egui::Slider::new(&mut self.zoom_amp, 0.0..=25.0)
                                    .suffix("%")
                                    .text("Zoom Amp"),
                            );
                            ui.add(egui::Slider::new(&mut self.zoom_smooth, 0.5..=0.96).text("Zoom Smooth"));
                            ui.add(egui::Slider::new(&mut self.zoom_thresh, 0.02..=0.3).text("Zoom Sens"));
                        }
                        ui.checkbox(&mut self.wiggle, "Camera Wiggle");
                        if self.wiggle {
                            ui.add(egui::Slider::new(&mut self.wiggle_amp, 0.0..=50.0).text("Wiggle px"));
                            ui.add(egui::Slider::new(&mut self.wiggle_speed, 0.2..=5.0).text("Wiggle Spd"));
                        }

                        ui.horizontal_wrapped(|ui| {
                            ui.checkbox(&mut self.peaks, "Peak Dots");
                            ui.checkbox(&mut self.rgb_beat_flash, "RGB Beat");
                            ui.checkbox(&mut self.show_particles, "Particles");
                            ui.checkbox(&mut self.mirror, "Mirror");
                            ui.checkbox(&mut self.vis_light_mode, "Light Canvas");
                        });

                        ui.separator();
                        ui.label("Background Dinamis");
                        egui::ComboBox::from_id_salt("bg_combo")
                            .selected_text(self.bg_style.label())
                            .show_ui(ui, |ui| {
                                for b in BackgroundStyle::ALL {
                                    ui.selectable_value(&mut self.bg_style, b, b.label());
                                }
                            });
                    });
                });
        }

        let show_hud = !self.hud_force_hidden
            && (self.studio_open
                || self.last_mouse_move.elapsed().as_secs_f32() < 3.5
                || err_msg.is_some());

        if show_hud {
            egui::Area::new(egui::Id::new("hud_bar"))
                .anchor(egui::Align2::CENTER_BOTTOM, Vec2::new(0.0, -16.0))
                .show(ctx, |ui| {
                    egui::Frame::none()
                        .fill(Color32::from_rgba_unmultiplied(14, 14, 18, 224))
                        .stroke(Stroke::new(
                            1.0_f32,
                            Color32::from_rgba_unmultiplied(255, 255, 255, 36),
                        ))
                        .rounding(14.0)
                        .inner_margin(egui::Margin::symmetric(14.0, 9.0))
                        .show(ui, |ui| {
                            ui.horizontal_wrapped(|ui| {
                                ui.colored_label(Color32::from_rgb(34, 197, 94), "●");
                                ui.label(dev_name);

                                ui.separator();
                                egui::ComboBox::from_id_salt("mode_combo")
                                    .selected_text(self.mode.label())
                                    .show_ui(ui, |ui| {
                                        for m in VisualMode::ALL {
                                            ui.selectable_value(&mut self.mode, m, m.label());
                                        }
                                    });

                                egui::ComboBox::from_id_salt("theme_combo")
                                    .selected_text(self.theme.label())
                                    .show_ui(ui, |ui| {
                                        for t in ColorTheme::ALL {
                                            ui.selectable_value(&mut self.theme, t, t.label());
                                        }
                                    });

                                ui.separator();
                                if ui.button("Studio (S)").clicked() {
                                    self.studio_open = !self.studio_open;
                                }
                                if ui
                                    .button(if self.is_fullscreen {
                                        "Windowed (F)"
                                    } else {
                                        "Fullscreen (F)"
                                    })
                                    .clicked()
                                {
                                    self.is_fullscreen = !self.is_fullscreen;
                                    ctx.send_viewport_cmd(egui::ViewportCommand::Fullscreen(
                                        self.is_fullscreen,
                                    ));
                                }
                                if ui.button("Hide (H)").clicked() {
                                    self.hud_force_hidden = true;
                                    self.studio_open = false;
                                }
                            });

                            if let Some(err) = err_msg {
                                ui.colored_label(Color32::from_rgb(252, 165, 165), err);
                            }
                        });
                });
        }
    }
}

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1200.0, 660.0])
            .with_title("Audio Spectrum Studio (WASAPI Loopback 0Hz-22kHz)"),
        ..Default::default()
    };

    eframe::run_native(
        "Audio Spectrum Studio",
        options,
        Box::new(|_cc| Ok(Box::new(VisualizerApp::new()))),
    )
}
