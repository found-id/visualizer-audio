use std::collections::VecDeque;
use std::f32::consts::PI;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::thread;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;
use rustfft::{num_complex::Complex, FftPlanner};

const FFT_SIZE: usize = 8192;
const OUT_FREQ_BINS: usize = 2048;
const OUT_WAVE_BINS: usize = 256;

struct AudioBuffer {
    ring: VecDeque<f32>,
    sample_rate: u32,
    device_name: String,
}

fn main() {
    let shared = Arc::new(Mutex::new(AudioBuffer {
        ring: VecDeque::from(vec![0.0f32; FFT_SIZE]),
        sample_rate: 48000,
        device_name: String::from("System Loopback"),
    }));

    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .expect("No default output device");
    let dev_name = device
        .name()
        .unwrap_or_else(|_| "System Loopback".to_string());
    let supported = device
        .default_output_config()
        .expect("Failed to get output config");

    let sample_rate = supported.sample_rate().0;
    let channels = supported.channels() as usize;
    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();

    {
        let mut guard = shared.lock().unwrap();
        guard.sample_rate = sample_rate;
        guard.device_name = dev_name;
    }

    let err_fn = |err| eprintln!("Stream error: {err}");
    let stream_shared = Arc::clone(&shared);

    let _stream = match sample_format {
        SampleFormat::F32 => {
            let s = stream_shared;
            device
                .build_input_stream(
                    &config,
                    move |data: &[f32], _| {
                        if let Ok(mut g) = s.lock() {
                            for frame in data.chunks(channels.max(1)) {
                                let mono: f32 =
                                    frame.iter().copied().sum::<f32>() / frame.len() as f32;
                                if g.ring.len() >= FFT_SIZE {
                                    g.ring.pop_front();
                                }
                                g.ring.push_back(mono);
                            }
                        }
                    },
                    err_fn,
                    None,
                )
                .unwrap()
        }
        SampleFormat::I16 => {
            let s = stream_shared;
            device
                .build_input_stream(
                    &config,
                    move |data: &[i16], _| {
                        if let Ok(mut g) = s.lock() {
                            for frame in data.chunks(channels.max(1)) {
                                let mono: f32 = frame
                                    .iter()
                                    .map(|&v| v as f32 / i16::MAX as f32)
                                    .sum::<f32>()
                                    / frame.len() as f32;
                                if g.ring.len() >= FFT_SIZE {
                                    g.ring.pop_front();
                                }
                                g.ring.push_back(mono);
                            }
                        }
                    },
                    err_fn,
                    None,
                )
                .unwrap()
        }
        _ => panic!("Unsupported sample format"),
    };
    _stream.play().unwrap();

    // Background DSP worker computing FFT at ~60Hz
    let dsp_shared = Arc::clone(&shared);
    let latest_json = Arc::new(Mutex::new(String::from("{\"active\":true}")));
    let json_writer = Arc::clone(&latest_json);

    thread::spawn(move || {
        let mut planner = FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(FFT_SIZE);
        let hann: Vec<f32> = (0..FFT_SIZE)
            .map(|i| 0.5 * (1.0 - (2.0 * PI * i as f32 / (FFT_SIZE - 1) as f32).cos()))
            .collect();
        let mut samples = vec![0.0f32; FFT_SIZE];
        let mut fft_buf = vec![Complex::new(0.0f32, 0.0f32); FFT_SIZE];
        let mut smoothed_freq = vec![0.0f32; OUT_FREQ_BINS];

        loop {
            let (sr, dev) = {
                let g = dsp_shared.lock().unwrap();
                for (dst, &src) in samples.iter_mut().zip(g.ring.iter()) {
                    *dst = src;
                }
                (g.sample_rate, g.device_name.clone())
            };

            for i in 0..FFT_SIZE {
                fft_buf[i] = Complex::new(samples[i] * hann[i], 0.0);
            }
            fft.process(&mut fft_buf);

            let norm = 2.0 / FFT_SIZE as f32;
            let min_db = -95.0f32;
            let max_db = -16.0f32;
            let db_range = max_db - min_db;

            let mut freq_bytes = Vec::with_capacity(OUT_FREQ_BINS);
            for b in 0..OUT_FREQ_BINS {
                let mag = fft_buf[b].norm() * norm;
                let db = 20.0 * (mag + 1e-7).log10();
                let scaled = ((db - min_db) / db_range).clamp(0.0, 1.0);
                smoothed_freq[b] = smoothed_freq[b] * 0.45 + scaled * 0.55;
                freq_bytes.push((smoothed_freq[b] * 255.0) as u8);
            }

            let step = FFT_SIZE / OUT_WAVE_BINS;
            let mut wave_bytes = Vec::with_capacity(OUT_WAVE_BINS);
            for i in 0..OUT_WAVE_BINS {
                let start = i * step;
                let end = (start + step).min(FFT_SIZE);
                let mut peak = 0.0f32;
                for &s in &samples[start..end] {
                    let a = s.abs();
                    if a > peak {
                        peak = a;
                    }
                }
                wave_bytes.push((peak.clamp(0.0, 1.0) * 255.0) as u8);
            }

            let freq_str: Vec<String> = freq_bytes.iter().map(|v| v.to_string()).collect();
            let wave_str: Vec<String> = wave_bytes.iter().map(|v| v.to_string()).collect();
            let escaped_dev = dev.replace('\\', "\\\\").replace('"', "\\\"");
            let payload = format!(
                "{{\"active\":true,\"sampleRate\":{},\"device\":\"{}\",\"freq\":[{}],\"wave\":[{}]}}",
                sr,
                escaped_dev,
                freq_str.join(","),
                wave_str.join(",")
            );

            if let Ok(mut j) = json_writer.lock() {
                *j = payload;
            }

            thread::sleep(std::time::Duration::from_millis(15));
        }
    });

    let listener = TcpListener::bind("127.0.0.1:19848").expect("Failed to bind 127.0.0.1:19848");
    println!("WASAPI Audio Bridge listening on http://127.0.0.1:19848");

    for stream in listener.incoming().flatten() {
        let json_reader = Arc::clone(&latest_json);
        thread::spawn(move || {
            let mut s = stream;
            let _ = s.set_read_timeout(Some(std::time::Duration::from_millis(200)));
            let mut buf = [0u8; 4096];
            let mut total = 0usize;
            while total < buf.len() {
                match s.read(&mut buf[total..]) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        total += n;
                        if buf[..total].windows(4).any(|w| w == b"\r\n\r\n") {
                            break;
                        }
                    }
                }
            }
            if buf[..total].starts_with(b"OPTIONS ") {
                let resp = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\nConnection: close\r\n\r\n";
                let _ = s.write_all(resp.as_bytes());
                return;
            }
            let body = json_reader.lock().unwrap().clone();
            let resp = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = s.write_all(resp.as_bytes());
            let _ = s.flush();
        });
    }
}
