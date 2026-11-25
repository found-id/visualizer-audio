#![windows_subsystem = "windows"]

use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use eframe::egui::{
    self, Align, Align2, Color32, ColorImage, CursorIcon, FontData, FontDefinitions, FontFamily,
    FontId, Galley, Pos2, Rect, Rounding, Sense, Shape, Stroke, TextureHandle, TextureOptions,
    Vec2,
};

#[cfg(target_os = "windows")]
extern "system" {
    fn GetAsyncKeyState(vKey: i32) -> i16;
}

#[cfg(target_os = "windows")]
fn is_toggle_hotkey_down() -> bool {
    // Ctrl + Shift + L  OR  Alt + O
    unsafe {
        let ctrl = (GetAsyncKeyState(0x11) as u16 & 0x8000) != 0;
        let shift = (GetAsyncKeyState(0x10) as u16 & 0x8000) != 0;
        let key_l = (GetAsyncKeyState(0x4C) as u16 & 0x8000) != 0;
        let alt = (GetAsyncKeyState(0x12) as u16 & 0x8000) != 0;
        let key_o = (GetAsyncKeyState(0x4F) as u16 & 0x8000) != 0;
        (ctrl && shift && key_l) || (alt && key_o)
    }
}

#[cfg(not(target_os = "windows"))]
fn is_toggle_hotkey_down() -> bool {
    false
}

#[derive(Clone, PartialEq)]
struct WordEntry {
    text: String,
    state: u8, // 0 = upcoming, 1 = spoken, 2 = active
}

#[derive(Clone, PartialEq)]
struct OverlayFeed {
    active: bool,
    playing: bool,
    loading: bool,
    title: String,
    artist: String,
    cover_version: u64,
    prev: String,
    curr: String,
    next: String,
    words: Vec<WordEntry>,
    pos: String,
    bar_width: f32,
    scale: f32,
    opacity: f32,
    show_prev_next: bool,
    dof_blur: bool,
    lyrics_style: String,
    click_through: bool,
    show_bg: bool,
    bg_color: [u8; 3],
    bg_opacity: f32,
    show_outline: bool,
    outline_color: [u8; 3],
    text_color: [u8; 3],
    active_color: [u8; 3],
    text_shadow: bool,
    shadow_strength: f32,
    text_glow: bool,
    text_outline: bool,
    show_controls: bool,
    reset_pos_token: u64,
}

impl Default for OverlayFeed {
    fn default() -> Self {
        Self {
            active: false,
            playing: false,
            loading: false,
            title: String::new(),
            artist: String::new(),
            cover_version: 0,
            prev: String::new(),
            curr: "Menunggu musik...".to_string(),
            next: String::new(),
            words: Vec::new(),
            pos: "top".to_string(),
            bar_width: 460.0,
            scale: 1.15,
            opacity: 0.95,
            show_prev_next: true,
            dof_blur: false,
            lyrics_style: "cinema".to_string(),
            click_through: false,
            show_bg: true,
            bg_color: [15, 16, 20],
            bg_opacity: 0.68,
            show_outline: true,
            outline_color: [255, 255, 255],
            text_color: [255, 255, 255],
            active_color: [125, 211, 252],
            text_shadow: true,
            shadow_strength: 0.65,
            text_glow: false,
            text_outline: false,
            show_controls: true,
            reset_pos_token: 0,
        }
    }
}

fn parse_hex_color(s: &str, fallback: [u8; 3]) -> [u8; 3] {
    let hex = s.trim().trim_start_matches('#');
    if hex.len() == 6 {
        if let (Ok(r), Ok(g), Ok(b)) = (
            u8::from_str_radix(&hex[0..2], 16),
            u8::from_str_radix(&hex[2..4], 16),
            u8::from_str_radix(&hex[4..6], 16),
        ) {
            return [r, g, b];
        }
    }
    fallback
}

fn http_get_bytes(path: &str) -> Option<Vec<u8>> {
    let addr: SocketAddr = "127.0.0.1:19847".parse().ok()?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(250)).ok()?;
    let _ = stream.set_read_timeout(Some(Duration::from_millis(450)));
    let req = format!(
        "GET {} HTTP/1.1\r\nHost: 127.0.0.1:19847\r\nConnection: close\r\n\r\n",
        path
    );
    stream.write_all(req.as_bytes()).ok()?;

    let mut raw = Vec::with_capacity(4096);
    let _ = stream.read_to_end(&mut raw);
    let sep = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .map(|i| i + 4)?;
    let header_str = String::from_utf8_lossy(&raw[..sep]);
    let body = &raw[sep..];
    if header_str.to_ascii_lowercase().contains("transfer-encoding: chunked") {
        let mut decoded = Vec::with_capacity(body.len());
        let mut idx = 0usize;
        while idx < body.len() {
            let Some(rel_crlf) = body[idx..].windows(2).position(|w| w == b"\r\n") else {
                break;
            };
            let size_str = String::from_utf8_lossy(&body[idx..idx + rel_crlf]);
            let size_hex = size_str.split(';').next().unwrap_or("").trim();
            let Ok(chunk_len) = usize::from_str_radix(size_hex, 16) else {
                break;
            };
            idx += rel_crlf + 2;
            if chunk_len == 0 || idx + chunk_len > body.len() {
                break;
            }
            decoded.extend_from_slice(&body[idx..idx + chunk_len]);
            idx += chunk_len + 2;
        }
        return Some(decoded);
    }
    Some(body.to_vec())
}

fn send_bridge_get(path: String) {
    thread::spawn(move || {
        let _ = http_get_bytes(&path);
    });
}

fn send_media_cmd(cmd: &'static str) {
    send_bridge_get(format!("/api/control?cmd={}", cmd));
}

fn fetch_overlay_feed() -> Option<OverlayFeed> {
    let bytes = http_get_bytes("/api/overlay-feed")?;
    let body = String::from_utf8_lossy(&bytes);

    let mut feed = OverlayFeed::default();
    for line in body.lines() {
        if let Some((k, v)) = line.split_once('=') {
            match k {
                "active" => feed.active = v == "1",
                "playing" => feed.playing = v == "1",
                "loading" => feed.loading = v == "1",
                "title" => feed.title = v.to_string(),
                "artist" => feed.artist = v.to_string(),
                "cover_version" => feed.cover_version = v.parse::<u64>().unwrap_or(0),
                "prev" => feed.prev = v.to_string(),
                "curr" => feed.curr = v.to_string(),
                "next" => feed.next = v.to_string(),
                "pos" => feed.pos = v.to_string(),
                "bar_w" => feed.bar_width = v.parse::<f32>().unwrap_or(460.0).clamp(320.0, 760.0),
                "scale" => feed.scale = v.parse::<f32>().unwrap_or(1.15).clamp(0.7, 2.2),
                "opacity" => feed.opacity = v.parse::<f32>().unwrap_or(0.95).clamp(0.25, 1.0),
                "show_prev_next" => feed.show_prev_next = v == "1",
                "dof_blur" => feed.dof_blur = v == "1",
                "lyrics_style" => feed.lyrics_style = v.to_string(),
                "click_through" => feed.click_through = v == "1",
                "show_bg" => feed.show_bg = v == "1",
                "bg_color" => feed.bg_color = parse_hex_color(v, [15, 16, 20]),
                "bg_opacity" => feed.bg_opacity = v.parse::<f32>().unwrap_or(0.68).clamp(0.0, 1.0),
                "show_outline" => feed.show_outline = v == "1",
                "outline_color" => feed.outline_color = parse_hex_color(v, [255, 255, 255]),
                "text_color" => feed.text_color = parse_hex_color(v, [255, 255, 255]),
                "active_color" => feed.active_color = parse_hex_color(v, [125, 211, 252]),
                "text_shadow" => feed.text_shadow = v == "1",
                "shadow_strength" => feed.shadow_strength = v.parse::<f32>().unwrap_or(0.65).clamp(0.0, 1.0),
                "text_glow" => feed.text_glow = v == "1",
                "text_outline" => feed.text_outline = v == "1",
                "show_controls" => feed.show_controls = v == "1",
                "reset_pos_token" => feed.reset_pos_token = v.parse::<u64>().unwrap_or(0),
                "words" => {
                    feed.words.clear();
                    if !v.is_empty() {
                        for item in v.split('\t') {
                            if let Some((wt, ws)) = item.split_once('\x1f') {
                                if !wt.is_empty() {
                                    feed.words.push(WordEntry {
                                        text: wt.to_string(),
                                        state: ws.parse::<u8>().unwrap_or(0),
                                    });
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }
    Some(feed)
}

fn install_app_fonts(ctx: &egui::Context) {
    let mut fonts = FontDefinitions::default();
    let regular_candidates = [
        r"C:\Windows\Fonts\SegUIVar.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ];
    let bold_candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\SegUIVar.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
    ];

    for path in regular_candidates {
        if let Ok(bytes) = fs::read(path) {
            fonts
                .font_data
                .insert("app_regular".to_owned(), FontData::from_owned(bytes));
            if let Some(fam) = fonts.families.get_mut(&FontFamily::Proportional) {
                fam.insert(0, "app_regular".to_owned());
            }
            break;
        }
    }

    let mut bold_loaded = false;
    for path in bold_candidates {
        if let Ok(bytes) = fs::read(path) {
            fonts
                .font_data
                .insert("app_bold".to_owned(), FontData::from_owned(bytes));
            fonts
                .families
                .insert(FontFamily::Name("bold".into()), vec!["app_bold".to_owned()]);
            bold_loaded = true;
            break;
        }
    }
    if !bold_loaded {
        fonts.families.insert(
            FontFamily::Name("bold".into()),
            fonts
                .families
                .get(&FontFamily::Proportional)
                .cloned()
                .unwrap_or_default(),
        );
    }

    ctx.set_fonts(fonts);
}

fn bold_font(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name("bold".into()))
}

fn reg_font(size: f32) -> FontId {
    FontId::new(size, FontFamily::Proportional)
}

fn truncate_str(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        s.to_string()
    } else {
        let head: String = s.chars().take(max_chars.saturating_sub(1)).collect();
        format!("{}…", head)
    }
}

/// Smooth cubic-bezier(0.22, 1, 0.36, 1)-like ease-out curve
fn ease_out_expo_like(t: f32) -> f32 {
    let c = t.clamp(0.0, 1.0);
    1.0 - (1.0 - c).powi(3)
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t.clamp(0.0, 1.0)
}

fn lerp_rgb(a: [u8; 3], b: [u8; 3], t: f32, alpha: u8) -> Color32 {
    let t = t.clamp(0.0, 1.0);
    Color32::from_rgba_unmultiplied(
        lerp(a[0] as f32, b[0] as f32, t).round() as u8,
        lerp(a[1] as f32, b[1] as f32, t).round() as u8,
        lerp(a[2] as f32, b[2] as f32, t).round() as u8,
        alpha,
    )
}

fn apply_rounded_mask_96(bytes: &mut [u8], radius: f32) {
    let size = 96.0_f32;
    let r = radius;
    for y in 0..96 {
        for x in 0..96 {
            let px = x as f32 + 0.5;
            let py = y as f32 + 0.5;
            let dx = if px < r {
                r - px
            } else if px > size - r {
                px - (size - r)
            } else {
                0.0
            };
            let dy = if py < r {
                r - py
            } else if py > size - r {
                py - (size - r)
            } else {
                0.0
            };
            if dx > 0.0 && dy > 0.0 {
                let dist = (dx * dx + dy * dy).sqrt();
                if dist > r + 0.75 {
                    bytes[(y * 96 + x) * 4 + 3] = 0;
                } else if dist > r - 0.75 {
                    let cov = ((r + 0.75 - dist) / 1.5).clamp(0.0, 1.0);
                    let idx = (y * 96 + x) * 4 + 3;
                    bytes[idx] = (bytes[idx] as f32 * cov).round() as u8;
                }
            }
        }
    }
}

fn draw_icon_prev(painter: &egui::Painter, c: Pos2, col: Color32) {
    let bar = Rect::from_center_size(Pos2::new(c.x - 4.2, c.y), Vec2::new(1.8, 9.5));
    painter.rect_filled(bar, Rounding::same(0.9), col);
    let tri = vec![
        Pos2::new(c.x - 2.2, c.y),
        Pos2::new(c.x + 4.8, c.y - 4.8),
        Pos2::new(c.x + 4.8, c.y + 4.8),
    ];
    painter.add(Shape::convex_polygon(tri, col, Stroke::NONE));
}

fn draw_icon_next(painter: &egui::Painter, c: Pos2, col: Color32) {
    let tri = vec![
        Pos2::new(c.x + 2.2, c.y),
        Pos2::new(c.x - 4.8, c.y - 4.8),
        Pos2::new(c.x - 4.8, c.y + 4.8),
    ];
    painter.add(Shape::convex_polygon(tri, col, Stroke::NONE));
    let bar = Rect::from_center_size(Pos2::new(c.x + 4.2, c.y), Vec2::new(1.8, 9.5));
    painter.rect_filled(bar, Rounding::same(0.9), col);
}

fn draw_icon_play(painter: &egui::Painter, c: Pos2, col: Color32) {
    let tri = vec![
        Pos2::new(c.x - 3.3, c.y - 5.2),
        Pos2::new(c.x + 5.2, c.y),
        Pos2::new(c.x - 3.3, c.y + 5.2),
    ];
    painter.add(Shape::convex_polygon(tri, col, Stroke::NONE));
}

fn draw_icon_pause(painter: &egui::Painter, c: Pos2, col: Color32) {
    let left = Rect::from_center_size(Pos2::new(c.x - 2.7, c.y), Vec2::new(2.6, 9.6));
    let right = Rect::from_center_size(Pos2::new(c.x + 2.7, c.y), Vec2::new(2.6, 9.6));
    painter.rect_filled(left, Rounding::same(1.0), col);
    painter.rect_filled(right, Rounding::same(1.0), col);
}

fn draw_icon_studio(painter: &egui::Painter, c: Pos2, col: Color32) {
    let frame = Rect::from_center_size(c, Vec2::new(12.0, 10.2));
    painter.rect_stroke(frame, Rounding::same(2.4), Stroke::new(1.4_f32, col));
    painter.line_segment(
        [
            Pos2::new(frame.left() + 0.8, frame.top() + 3.2),
            Pos2::new(frame.right() - 0.8, frame.top() + 3.2),
        ],
        Stroke::new(1.1_f32, col),
    );
    let b1 = Rect::from_min_max(
        Pos2::new(c.x - 3.2, c.y + 0.6),
        Pos2::new(c.x - 1.7, c.y + 3.4),
    );
    let b2 = Rect::from_min_max(
        Pos2::new(c.x - 0.7, c.y - 0.6),
        Pos2::new(c.x + 0.8, c.y + 3.4),
    );
    let b3 = Rect::from_min_max(
        Pos2::new(c.x + 1.8, c.y + 1.2),
        Pos2::new(c.x + 3.3, c.y + 3.4),
    );
    painter.rect_filled(b1, Rounding::same(0.5), col);
    painter.rect_filled(b2, Rounding::same(0.5), col);
    painter.rect_filled(b3, Rounding::same(0.5), col);
}

fn draw_icon_close(painter: &egui::Painter, c: Pos2, col: Color32) {
    let d = 4.2;
    let stroke = Stroke::new(1.65_f32, col);
    painter.line_segment([Pos2::new(c.x - d, c.y - d), Pos2::new(c.x + d, c.y + d)], stroke);
    painter.line_segment([Pos2::new(c.x + d, c.y - d), Pos2::new(c.x - d, c.y + d)], stroke);
}

fn draw_icon_note(painter: &egui::Painter, c: Pos2, col: Color32) {
    painter.circle_filled(Pos2::new(c.x - 3.5, c.y + 4.5), 2.7, col);
    painter.circle_filled(Pos2::new(c.x + 4.2, c.y + 3.2), 2.7, col);
    painter.line_segment(
        [Pos2::new(c.x - 1.3, c.y + 4.5), Pos2::new(c.x - 1.3, c.y - 5.5)],
        Stroke::new(1.8_f32, col),
    );
    painter.line_segment(
        [Pos2::new(c.x + 6.4, c.y + 3.2), Pos2::new(c.x + 6.4, c.y - 6.8)],
        Stroke::new(1.8_f32, col),
    );
    painter.line_segment(
        [Pos2::new(c.x - 1.8, c.y - 5.5), Pos2::new(c.x + 6.9, c.y - 6.8)],
        Stroke::new(2.4_f32, col),
    );
}

fn draw_galley_effects(
    painter: &egui::Painter,
    top_left: Pos2,
    galley: Arc<Galley>,
    main_color: Color32,
    shadow_alpha: u8,
    text_outline: bool,
    outline_alpha: u8,
    glow_col: Option<Color32>,
) {
    if text_outline && outline_alpha > 2 {
        let ol = Color32::from_rgba_unmultiplied(0, 0, 0, outline_alpha);
        for (dx, dy) in [(-1.0_f32, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0)] {
            painter.galley(top_left + Vec2::new(dx, dy), Arc::clone(&galley), ol);
        }
    }
    if shadow_alpha > 2 {
        let sh = Color32::from_rgba_unmultiplied(0, 0, 0, shadow_alpha);
        painter.galley(top_left + Vec2::new(0.0, 1.8), Arc::clone(&galley), sh);
    }
    if let Some(gc) = glow_col {
        for (dx, dy) in [(-0.85_f32, -0.85), (0.85, 0.85)] {
            painter.galley(top_left + Vec2::new(dx, dy), Arc::clone(&galley), gc);
        }
    }
    painter.galley(top_left, galley, main_color);
}

fn layout_wrapped_centered(
    ctx: &egui::Context,
    text: &str,
    font: FontId,
    max_width: f32,
) -> Arc<Galley> {
    let mut job = egui::text::LayoutJob::simple(
        text.to_string(),
        font,
        Color32::PLACEHOLDER,
        max_width.max(120.0),
    );
    job.halign = Align::Center;
    ctx.fonts(|f| f.layout_job(job))
}

fn draw_wrapped_subline(
    ctx: &egui::Context,
    painter: &egui::Painter,
    cx: f32,
    cy: f32,
    max_width: f32,
    text: &str,
    font: FontId,
    rgb: [u8; 3],
    base_alpha: f32,
    shadow_strength: f32,
    text_outline: bool,
    soft_fade: bool,
) -> f32 {
    if text.is_empty() || base_alpha <= 0.01 {
        return 0.0;
    }
    let galley = layout_wrapped_centered(ctx, text, font, max_width);
    let size = galley.size();
    // With Align::Center, galley.rect is already centered around x = 0
    let anchor = Pos2::new(cx, cy - size.y * 0.5);

    let sh_a = (165.0 * shadow_strength * base_alpha).round().clamp(0.0, 255.0) as u8;
    let ol_a = (150.0 * base_alpha).round().clamp(0.0, 255.0) as u8;
    let main_a = if soft_fade {
        (105.0 * base_alpha).round().clamp(0.0, 255.0) as u8
    } else {
        (135.0 * base_alpha).round().clamp(0.0, 255.0) as u8
    };
    let main_col = Color32::from_rgba_unmultiplied(rgb[0], rgb[1], rgb[2], main_a);
    let glow_col = if soft_fade {
        let ga = (28.0 * base_alpha).round().clamp(0.0, 255.0) as u8;
        Some(Color32::from_rgba_unmultiplied(rgb[0], rgb[1], rgb[2], ga))
    } else {
        None
    };

    draw_galley_effects(
        painter,
        anchor,
        galley,
        main_col,
        sh_a,
        text_outline,
        ol_a,
        glow_col,
    );
    size.y
}

#[derive(Clone)]
struct WordAnim {
    state: u8,
    changed_at: Instant,
}

struct LyricsOverlayApp {
    state: Arc<Mutex<OverlayFeed>>,
    cover_rgba: Arc<Mutex<Option<(u64, Vec<u8>)>>>,
    hidden_by_hotkey: Arc<AtomicBool>,
    cover_tex: Option<TextureHandle>,
    loaded_cover_ver: u64,
    last_pos_mode: String,
    last_click_through: bool,
    last_hidden_state: bool,
    last_mon_size: Vec2,
    last_win_size: Vec2,
    last_reset_token: u64,
    user_moved: bool,
    optimistic_playing: Option<(bool, Instant)>,
    // Animation tracking matching app.js + style.css
    last_curr_text: String,
    line_enter_at: Instant,
    word_anims: Vec<WordAnim>,
}

impl LyricsOverlayApp {
    fn new(
        cc: &eframe::CreationContext<'_>,
        state: Arc<Mutex<OverlayFeed>>,
        cover_rgba: Arc<Mutex<Option<(u64, Vec<u8>)>>>,
        hidden_by_hotkey: Arc<AtomicBool>,
    ) -> Self {
        cc.egui_ctx.set_visuals(egui::Visuals::dark());
        install_app_fonts(&cc.egui_ctx);
        Self {
            state,
            cover_rgba,
            hidden_by_hotkey,
            cover_tex: None,
            loaded_cover_ver: 0,
            last_pos_mode: String::new(),
            last_click_through: false,
            last_hidden_state: false,
            last_mon_size: Vec2::ZERO,
            last_win_size: Vec2::ZERO,
            last_reset_token: 0,
            user_moved: false,
            optimistic_playing: None,
            last_curr_text: String::new(),
            line_enter_at: Instant::now() - Duration::from_secs(2),
            word_anims: Vec::new(),
        }
    }
}

impl eframe::App for LyricsOverlayApp {
    fn clear_color(&self, _visuals: &egui::Visuals) -> [f32; 4] {
        [0.0, 0.0, 0.0, 0.0]
    }

    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let is_hidden = self.hidden_by_hotkey.load(Ordering::Relaxed);
        if is_hidden != self.last_hidden_state {
            self.last_hidden_state = is_hidden;
            ctx.send_viewport_cmd(egui::ViewportCommand::Visible(!is_hidden));
            ctx.send_viewport_cmd(egui::ViewportCommand::MousePassthrough(
                is_hidden || self.last_click_through,
            ));
        }
        if is_hidden {
            return;
        }

        let feed = self.state.lock().unwrap().clone();
        let now = Instant::now();

        // Track line enter animation (0.48s lineRiseIn)
        if feed.curr != self.last_curr_text {
            self.last_curr_text = feed.curr.clone();
            self.line_enter_at = now;
            self.word_anims = feed
                .words
                .iter()
                .map(|w| WordAnim {
                    state: w.state,
                    changed_at: now,
                })
                .collect();
        } else if self.word_anims.len() != feed.words.len() {
            self.word_anims = feed
                .words
                .iter()
                .map(|w| WordAnim {
                    state: w.state,
                    changed_at: now,
                })
                .collect();
        } else {
            for (i, w) in feed.words.iter().enumerate() {
                if self.word_anims[i].state != w.state {
                    self.word_anims[i].state = w.state;
                    self.word_anims[i].changed_at = now;
                }
            }
        }

        // Determine if any animation is still running for 60fps vs idle efficiency
        let mut anim_running = now.duration_since(self.line_enter_at).as_secs_f32() < 0.52;
        if !anim_running {
            for wa in &self.word_anims {
                if now.duration_since(wa.changed_at).as_secs_f32() < 0.42 {
                    anim_running = true;
                    break;
                }
            }
        }
        if anim_running || feed.loading {
            ctx.request_repaint_after(Duration::from_millis(16));
        }

        // Update album cover texture if a new 96x96 RGBA thumbnail arrived
        if let Some((ver, mut bytes)) = self.cover_rgba.lock().unwrap().take() {
            if bytes.len() == 96 * 96 * 4 {
                apply_rounded_mask_96(&mut bytes, 18.0);
                let img = ColorImage::from_rgba_unmultiplied([96, 96], &bytes);
                self.cover_tex = Some(ctx.load_texture(
                    "overlay_cover",
                    img,
                    TextureOptions::LINEAR,
                ));
                self.loaded_cover_ver = ver;
            }
        }
        if feed.cover_version == 0 && self.loaded_cover_ver != 0 {
            self.cover_tex = None;
            self.loaded_cover_ver = 0;
        }

        if let Some((opt_val, at)) = self.optimistic_playing {
            if opt_val == feed.playing || at.elapsed() > Duration::from_millis(1200) {
                self.optimistic_playing = None;
            }
        }
        let effective_playing = self
            .optimistic_playing
            .map(|(v, _)| v)
            .unwrap_or(feed.playing);

        if feed.reset_pos_token != self.last_reset_token {
            self.last_reset_token = feed.reset_pos_token;
            self.user_moved = false;
        }

        let mon_size = ctx
            .input(|i| i.viewport().monitor_size)
            .unwrap_or(Vec2::new(1920.0, 1080.0));
        let win_w = (feed.bar_width + 64.0)
            .max(700.0 * feed.scale.clamp(0.9, 1.35))
            .min(mon_size.x - 32.0)
            .max(480.0);
        let est_curr_chars = feed.curr.chars().count() as f32;
        let est_chars_per_line = ((win_w - 40.0) / (11.5 * feed.scale)).max(16.0);
        let est_extra_lines = ((est_curr_chars / est_chars_per_line).ceil() - 1.0).clamp(0.0, 2.0);
        let extra_h = est_extra_lines * (26.0 * feed.scale);
        let win_h = if feed.show_controls {
            (204.0 + 36.0 * feed.scale + extra_h).clamp(204.0, 360.0)
        } else {
            (138.0 + 36.0 * feed.scale + extra_h).clamp(138.0, 290.0)
        };
        let target_win_size = Vec2::new(win_w, win_h);

        if (!self.user_moved && self.last_mon_size != mon_size) || self.last_pos_mode != feed.pos {
            self.last_pos_mode = feed.pos.clone();
            self.last_mon_size = mon_size;
            self.last_win_size = target_win_size;
            let x = (mon_size.x - win_w) * 0.5;
            let y = match feed.pos.as_str() {
                "bottom" => (mon_size.y - win_h - 36.0).max(16.0),
                "center" => (mon_size.y - win_h) * 0.5,
                _ => 18.0,
            };
            ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(target_win_size));
            ctx.send_viewport_cmd(egui::ViewportCommand::OuterPosition(Pos2::new(x, y)));
        } else if (self.last_win_size - target_win_size).length_sq() > 4.0 {
            self.last_win_size = target_win_size;
            ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(target_win_size));
        }

        if self.last_click_through != feed.click_through {
            self.last_click_through = feed.click_through;
            ctx.send_viewport_cmd(egui::ViewportCommand::MousePassthrough(feed.click_through));
        }

        egui::CentralPanel::default()
            .frame(egui::Frame::none().inner_margin(0.0).fill(Color32::TRANSPARENT))
            .show(ctx, |ui| {
                let rect = ui.max_rect();
                let painter = ui.painter();
                let cx = rect.center().x;
                let scale = feed.scale;
                let op = feed.opacity;

                let mut lyr_top_anchor = rect.top() + 18.0;

                // 1. Draggable & Clickable Control Center Pill
                if feed.show_controls {
                    let bar_w = feed.bar_width.clamp(320.0, 760.0).min(rect.width() - 20.0);
                    let bar_h = 54.0_f32;
                    let bar_rect = Rect::from_center_size(
                        Pos2::new(cx, rect.top() + 33.0),
                        Vec2::new(bar_w, bar_h),
                    );
                    lyr_top_anchor = bar_rect.bottom() + 16.0;

                    let bg_fill = if feed.show_bg {
                        let a = (255.0 * feed.bg_opacity * op).round().clamp(0.0, 255.0) as u8;
                        Color32::from_rgba_unmultiplied(
                            feed.bg_color[0],
                            feed.bg_color[1],
                            feed.bg_color[2],
                            a,
                        )
                    } else {
                        Color32::TRANSPARENT
                    };
                    let outline_stroke = if feed.show_outline {
                        let a = (48.0 * op).round().clamp(0.0, 255.0) as u8;
                        Stroke::new(
                            1.0_f32,
                            Color32::from_rgba_unmultiplied(
                                feed.outline_color[0],
                                feed.outline_color[1],
                                feed.outline_color[2],
                                a,
                            ),
                        )
                    } else {
                        Stroke::NONE
                    };

                    painter.rect(bar_rect, Rounding::same(16.0), bg_fill, outline_stroke);

                    // Sleek animated loading bar along bottom edge of control pill during track/lyrics load
                    if feed.loading {
                        let t = ctx.input(|i| i.time) as f32;
                        let prog = (t * 1.45) % 1.0;
                        let track_left = bar_rect.left() + 14.0;
                        let track_right = bar_rect.right() - 14.0;
                        let track_w = (track_right - track_left).max(40.0);
                        let seg_w = (track_w * 0.28).max(36.0);
                        let seg_x = track_left + (track_w - seg_w) * (0.5 - 0.5 * (prog * std::f32::consts::TAU).cos());
                        let load_rect = Rect::from_min_size(
                            Pos2::new(seg_x, bar_rect.bottom() - 2.5),
                            Vec2::new(seg_w, 2.0),
                        );
                        painter.rect_filled(
                            load_rect,
                            Rounding::same(1.0),
                            Color32::from_rgba_unmultiplied(
                                feed.active_color[0],
                                feed.active_color[1],
                                feed.active_color[2],
                                (225.0 * op) as u8,
                            ),
                        );
                    }

                    // Album cover thumbnail
                    let cov_rect = Rect::from_min_size(
                        Pos2::new(bar_rect.left() + 8.0, bar_rect.top() + 7.0),
                        Vec2::splat(40.0),
                    );
                    if let Some(tex) = &self.cover_tex {
                        painter.image(
                            tex.id(),
                            cov_rect,
                            Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)),
                            Color32::from_rgba_unmultiplied(255, 255, 255, (255.0 * op) as u8),
                        );
                        painter.rect_stroke(
                            cov_rect,
                            Rounding::same(8.0),
                            Stroke::new(
                                1.0_f32,
                                Color32::from_rgba_unmultiplied(255, 255, 255, (36.0 * op) as u8),
                            ),
                        );
                    } else {
                        painter.rect_filled(
                            cov_rect,
                            Rounding::same(8.5),
                            Color32::from_rgba_unmultiplied(255, 255, 255, 22),
                        );
                        draw_icon_note(
                            painter,
                            cov_rect.center(),
                            Color32::from_rgba_unmultiplied(255, 255, 255, (185.0 * op) as u8),
                        );
                    }

                    // Track title & artist (dynamically fitted to custom bar_w)
                    let text_left = cov_rect.right() + 10.0;
                    let max_title_chars = ((bar_w - 208.0).max(70.0) / 7.2).round() as usize;
                    let max_artist_chars = ((bar_w - 208.0).max(70.0) / 6.2).round() as usize;
                    let title_str = if feed.active && !feed.title.is_empty() {
                        truncate_str(&feed.title, max_title_chars.clamp(10, 64))
                    } else {
                        "Cobra Audio".to_string()
                    };
                    let artist_str = if feed.active && !feed.artist.is_empty() {
                        truncate_str(&feed.artist, max_artist_chars.clamp(12, 72))
                    } else {
                        "Geser bar untuk pindah • Alt+O".to_string()
                    };

                    painter.text(
                        Pos2::new(text_left, bar_rect.top() + 11.0),
                        Align2::LEFT_TOP,
                        title_str,
                        bold_font(13.0),
                        Color32::from_rgba_unmultiplied(
                            feed.text_color[0],
                            feed.text_color[1],
                            feed.text_color[2],
                            (245.0 * op) as u8,
                        ),
                    );
                    painter.text(
                        Pos2::new(text_left, bar_rect.top() + 29.0),
                        Align2::LEFT_TOP,
                        artist_str,
                        reg_font(11.0),
                        Color32::from_rgba_unmultiplied(
                            feed.text_color[0],
                            feed.text_color[1],
                            feed.text_color[2],
                            (165.0 * op) as u8,
                        ),
                    );

                    // Transport & action buttons on right side (crisp vector icons)
                    let btn_y = bar_rect.center().y;
                    let close_rect = Rect::from_center_size(Pos2::new(bar_rect.right() - 20.0, btn_y), Vec2::splat(24.0));
                    let studio_rect = Rect::from_center_size(Pos2::new(bar_rect.right() - 47.0, btn_y), Vec2::splat(24.0));
                    let next_rect = Rect::from_center_size(Pos2::new(bar_rect.right() - 76.0, btn_y), Vec2::splat(24.0));
                    let play_rect = Rect::from_center_size(Pos2::new(bar_rect.right() - 106.0, btn_y), Vec2::splat(28.0));
                    let prev_rect = Rect::from_center_size(Pos2::new(bar_rect.right() - 136.0, btn_y), Vec2::splat(24.0));

                    let draw_vec_btn = |r: Rect,
                                        filled: bool,
                                        id_str: &str,
                                        hint: &str,
                                        draw_fn: &dyn Fn(&egui::Painter, Pos2, Color32)|
                     -> bool {
                        let resp = ui
                            .interact(r, ui.id().with(id_str), Sense::click())
                            .on_hover_cursor(CursorIcon::PointingHand)
                            .on_hover_text(hint);
                        if filled {
                            let bg = if resp.hovered() {
                                Color32::from_rgba_unmultiplied(255, 255, 255, 255)
                            } else {
                                Color32::from_rgba_unmultiplied(244, 246, 252, (242.0 * op) as u8)
                            };
                            painter.circle_filled(r.center(), 13.5, bg);
                            draw_fn(painter, r.center(), Color32::from_rgb(16, 17, 22));
                        } else {
                            if resp.hovered() {
                                painter.circle_filled(
                                    r.center(),
                                    12.0,
                                    Color32::from_rgba_unmultiplied(255, 255, 255, 34),
                                );
                            }
                            let icon_col = Color32::from_rgba_unmultiplied(
                                feed.text_color[0],
                                feed.text_color[1],
                                feed.text_color[2],
                                if resp.hovered() { 255 } else { (222.0 * op) as u8 },
                            );
                            draw_fn(painter, r.center(), icon_col);
                        }
                        resp.clicked()
                    };

                    if draw_vec_btn(prev_rect, false, "btn_prev", "Sebelumnya", &draw_icon_prev) {
                        send_media_cmd("prev");
                    }
                    let play_icon_fn: &dyn Fn(&egui::Painter, Pos2, Color32) = if effective_playing {
                        &draw_icon_pause
                    } else {
                        &draw_icon_play
                    };
                    if draw_vec_btn(play_rect, true, "btn_play", "Play / Pause", play_icon_fn) {
                        self.optimistic_playing = Some((!effective_playing, now));
                        send_media_cmd("playpause");
                    }
                    if draw_vec_btn(next_rect, false, "btn_next", "Selanjutnya", &draw_icon_next) {
                        send_media_cmd("next");
                    }
                    if draw_vec_btn(studio_rect, false, "btn_studio", "Buka Konsol Cobra", &draw_icon_studio) {
                        send_bridge_get("/api/open-studio".to_string());
                    }
                    if draw_vec_btn(close_rect, false, "btn_close", "Tutup Overlay", &draw_icon_close) {
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }

                    // Drag zone = left/middle of Control Center (starts drag ONCE on drag_started!)
                    let drag_rect = Rect::from_min_max(
                        bar_rect.min,
                        Pos2::new(prev_rect.left() - 6.0, bar_rect.max.y),
                    );
                    let drag_resp = ui
                        .interact(drag_rect, ui.id().with("drag_bar"), Sense::click_and_drag())
                        .on_hover_cursor(CursorIcon::Grab);
                    if drag_resp.drag_started() {
                        self.user_moved = true;
                        ctx.send_viewport_cmd(egui::ViewportCommand::StartDrag);
                    }
                } else {
                    // When control bar is hidden, allow dragging from the lyrics area when not click-through
                    let drag_resp = ui
                        .interact(rect, ui.id().with("drag_lyrics"), Sense::click_and_drag())
                        .on_hover_cursor(CursorIcon::Grab);
                    if drag_resp.drag_started() {
                        self.user_moved = true;
                        ctx.send_viewport_cmd(egui::ViewportCommand::StartDrag);
                    }
                }

                // 2. App-Matched Animated Lyrics (Clean, Galley-cached, Auto-wrapping)
                let line_t = (now.duration_since(self.line_enter_at).as_secs_f32() / 0.45).min(1.0);
                let line_ease = ease_out_expo_like(line_t);
                let line_y_enter = (1.0 - line_ease) * 8.0 * scale;
                let line_scale_enter = lerp(0.97, 1.0, line_ease);
                let line_alpha_enter = line_ease;
                let is_cinema = feed.lyrics_style != "karaoke";
                let active_rgb = if is_cinema {
                    feed.text_color
                } else {
                    feed.active_color
                };
                let eff_shadow = if feed.text_shadow {
                    feed.shadow_strength.clamp(0.0, 1.0)
                } else {
                    0.0
                };
                let max_text_w = (rect.width() - 36.0).max(200.0);

                let sub_size = 13.6 * scale;
                let base_curr_size = 21.5 * scale;
                let curr_size = base_curr_size * line_scale_enter;
                let line_gap = 29.0 * scale;
                let row_gap = 4.0 * scale;
                let base_row_h = base_curr_size * 1.24;
                let sub_font = reg_font(sub_size);
                let curr_font = bold_font(curr_size);

                // Measure & wrap current line using fixed base_row_h so Prev/Next NEVER shift when words scale
                let row_count: usize;
                struct LayoutWord {
                    galley: Arc<Galley>,
                    width: f32,
                    height: f32,
                    y_off: f32,
                    col: Color32,
                    glow_col: Option<Color32>,
                }
                let mut word_rows: Vec<(Vec<LayoutWord>, f32, f32)> = Vec::new();
                let mut plain_curr_galley: Option<(Arc<Galley>, Color32, Option<Color32>)> = None;

                if !feed.words.is_empty() {
                    let space_w = painter
                        .layout_no_wrap(" ".to_string(), curr_font.clone(), Color32::WHITE)
                        .size()
                        .x
                        .max(5.5 * scale);

                    let mut current_row: Vec<LayoutWord> = Vec::new();
                    let mut row_w = 0.0_f32;
                    let mut row_h = 0.0_f32;

                    for (idx, w) in feed.words.iter().enumerate() {
                        let wa_elapsed = self
                            .word_anims
                            .get(idx)
                            .map(|wa| now.duration_since(wa.changed_at).as_secs_f32())
                            .unwrap_or(1.0);

                        let (y_off, w_scale, col, glow_strength) = match w.state {
                            2 => {
                                let p = (wa_elapsed / 0.38).clamp(0.0, 1.0);
                                let (yb, sb) = if p < 0.45 {
                                    let k = ease_out_expo_like(p / 0.45);
                                    (lerp(0.0, -3.0 * scale, k), lerp(1.0, 1.05, k))
                                } else {
                                    let k = ease_out_expo_like((p - 0.45) / 0.55);
                                    (lerp(-3.0 * scale, -0.8 * scale, k), lerp(1.05, 1.018, k))
                                };
                                let color_t = ease_out_expo_like((wa_elapsed / 0.24).clamp(0.0, 1.0));
                                let alpha = (255.0 * op * line_alpha_enter).round().clamp(0.0, 255.0) as u8;
                                let c = lerp_rgb(feed.text_color, active_rgb, color_t, alpha);
                                (yb, sb, c, color_t)
                            }
                            1 => {
                                let k = ease_out_expo_like((wa_elapsed / 0.28).clamp(0.0, 1.0));
                                let yb = lerp(-0.8 * scale, 0.0, k);
                                let sb = lerp(1.018, 1.0, k);
                                let alpha = (255.0 * op * line_alpha_enter).round().clamp(0.0, 255.0) as u8;
                                let c = Color32::from_rgba_unmultiplied(
                                    feed.text_color[0],
                                    feed.text_color[1],
                                    feed.text_color[2],
                                    alpha,
                                );
                                (yb, sb, c, 0.25 * (1.0 - k * 0.5))
                            }
                            _ => {
                                let alpha = (135.0 * op * line_alpha_enter).round().clamp(0.0, 255.0) as u8;
                                let c = Color32::from_rgba_unmultiplied(
                                    feed.text_color[0],
                                    feed.text_color[1],
                                    feed.text_color[2],
                                    alpha,
                                );
                                (0.0, 1.0, c, 0.0)
                            }
                        };

                        let w_font = bold_font(curr_size * w_scale);
                        let galley = painter.layout_no_wrap(w.text.clone(), w_font, Color32::PLACEHOLDER);
                        let gw = galley.size().x;
                        let gh = galley.size().y;

                        let glow_col = if feed.text_glow && glow_strength > 0.04 {
                            let ga = (42.0 * glow_strength * op * line_alpha_enter)
                                .round()
                                .clamp(0.0, 255.0) as u8;
                            Some(Color32::from_rgba_unmultiplied(
                                active_rgb[0],
                                active_rgb[1],
                                active_rgb[2],
                                ga,
                            ))
                        } else {
                            None
                        };

                        let needed_w = if current_row.is_empty() {
                            gw
                        } else {
                            space_w + gw
                        };
                        if !current_row.is_empty() && row_w + needed_w > max_text_w {
                            word_rows.push((current_row, row_w, row_h));
                            current_row = Vec::new();
                            row_w = 0.0;
                            row_h = 0.0;
                        }
                        if !current_row.is_empty() {
                            row_w += space_w;
                        }
                        row_w += gw;
                        row_h = row_h.max(gh);
                        current_row.push(LayoutWord {
                            galley,
                            width: gw,
                            height: gh,
                            y_off,
                            col,
                            glow_col,
                        });
                    }
                    if !current_row.is_empty() {
                        word_rows.push((current_row, row_w, row_h));
                    }
                    row_count = word_rows.len().max(1);
                } else {
                    let display_curr = if feed.loading && (feed.curr.is_empty() || feed.curr.contains("Memuat")) {
                        let t = ctx.input(|i| i.time) as usize;
                        let dots = match (t * 2) % 4 {
                            0 => "",
                            1 => ".",
                            2 => "..",
                            _ => "...",
                        };
                        format!("Memuat lirik{}", dots)
                    } else {
                        feed.curr.clone()
                    };
                    let galley = layout_wrapped_centered(ctx, &display_curr, curr_font, max_text_w);
                    row_count = galley.rows.len().max(1);
                    let alpha = (255.0 * op * line_alpha_enter).round().clamp(0.0, 255.0) as u8;
                    let col = Color32::from_rgba_unmultiplied(
                        feed.text_color[0],
                        feed.text_color[1],
                        feed.text_color[2],
                        alpha,
                    );
                    let glow_col = if feed.text_glow {
                        let ga = (36.0 * op * line_alpha_enter).round().clamp(0.0, 255.0) as u8;
                        Some(Color32::from_rgba_unmultiplied(
                            active_rgb[0],
                            active_rgb[1],
                            active_rgb[2],
                            ga,
                        ))
                    } else {
                        None
                    };
                    plain_curr_galley = Some((galley, col, glow_col));
                }

                let base_curr_h = row_count as f32 * base_row_h
                    + (row_count.saturating_sub(1) as f32) * row_gap;
                let lyr_center_y = lyr_top_anchor
                    + (if feed.show_prev_next {
                        line_gap + base_curr_h * 0.5
                    } else {
                        base_curr_h * 0.5 + 8.0
                    });

                // Prev line (stationary, wrapped, clean)
                if feed.show_prev_next && !feed.prev.is_empty() {
                    let prev_y = lyr_center_y - base_curr_h * 0.5 - line_gap * 0.65;
                    draw_wrapped_subline(
                        ctx,
                        painter,
                        cx,
                        prev_y,
                        max_text_w,
                        &feed.prev,
                        sub_font.clone(),
                        feed.text_color,
                        op * 0.92,
                        eff_shadow,
                        feed.text_outline,
                        feed.dof_blur,
                    );
                }

                // Current line
                let sh_a = (205.0 * eff_shadow * op * line_alpha_enter)
                    .round()
                    .clamp(0.0, 255.0) as u8;
                let ol_a = (195.0 * op * line_alpha_enter).round().clamp(0.0, 255.0) as u8;

                if let Some((galley, col, glow_col)) = plain_curr_galley {
                    let gsize = galley.size();
                    // With Align::Center, galley.rect is already centered around x = 0
                    let anchor = Pos2::new(
                        cx,
                        lyr_center_y - gsize.y * 0.5 + line_y_enter,
                    );
                    draw_galley_effects(
                        painter,
                        anchor,
                        galley,
                        col,
                        sh_a,
                        feed.text_outline,
                        ol_a,
                        glow_col,
                    );
                } else if !word_rows.is_empty() {
                    let space_w = painter
                        .layout_no_wrap(" ".to_string(), bold_font(curr_size), Color32::WHITE)
                        .size()
                        .x
                        .max(5.5 * scale);
                    let mut y_cursor = lyr_center_y - base_curr_h * 0.5 + line_y_enter;

                    for (row, rw, _rh) in word_rows {
                        let mut x_cursor = cx - rw * 0.5;
                        for it in row {
                            let tl = Pos2::new(
                                x_cursor,
                                y_cursor + (base_row_h - it.height) * 0.5 + it.y_off,
                            );
                            draw_galley_effects(
                                painter,
                                tl,
                                it.galley,
                                it.col,
                                sh_a,
                                feed.text_outline,
                                ol_a,
                                it.glow_col,
                            );
                            x_cursor += it.width + space_w;
                        }
                        y_cursor += base_row_h + row_gap;
                    }
                }

                // Next line (stationary, wrapped, clean)
                if feed.show_prev_next && !feed.next.is_empty() {
                    let next_y = lyr_center_y + base_curr_h * 0.5 + line_gap * 0.65;
                    draw_wrapped_subline(
                        ctx,
                        painter,
                        cx,
                        next_y,
                        max_text_w,
                        &feed.next,
                        sub_font,
                        feed.text_color,
                        op * 0.92,
                        eff_shadow,
                        feed.text_outline,
                        feed.dof_blur,
                    );
                }
            });
    }
}

fn main() {
    let state = Arc::new(Mutex::new(OverlayFeed::default()));
    let state_bg = Arc::clone(&state);
    let cover_rgba = Arc::new(Mutex::new(None));
    let cover_bg = Arc::clone(&cover_rgba);
    let hidden_flag = Arc::new(AtomicBool::new(false));
    let hidden_bg = Arc::clone(&hidden_flag);

    let native_options = eframe::NativeOptions {
        multisampling: 0,
        vsync: true,
        viewport: egui::ViewportBuilder::default()
            .with_title("Cobra Audio Overlay")
            .with_transparent(true)
            .with_decorations(false)
            .with_always_on_top()
            .with_taskbar(false)
            .with_mouse_passthrough(false)
            .with_inner_size([720.0, 232.0])
            .with_position([300.0, 18.0]),
        ..Default::default()
    };

    let _ = eframe::run_native(
        "Cobra Audio Overlay",
        native_options,
        Box::new(move |cc| {
            let egui_ctx = cc.egui_ctx.clone();
            thread::spawn(move || {
                let start_time = Instant::now();
                let mut fail_streak = 0u32;
                let mut last_cov_ver = 0u64;
                let mut was_hotkey_down = false;
                loop {
                    // Global hotkey check (Ctrl+Shift+L or Alt+O)
                    let hk_down = is_toggle_hotkey_down();
                    if hk_down && !was_hotkey_down {
                        let prev = hidden_bg.load(Ordering::Relaxed);
                        hidden_bg.store(!prev, Ordering::Relaxed);
                        egui_ctx.request_repaint();
                    }
                    was_hotkey_down = hk_down;

                    let mut is_playing = false;
                    if let Some(new_feed) = fetch_overlay_feed() {
                        fail_streak = 0;
                        is_playing = new_feed.playing;
                        let cov_ver = new_feed.cover_version;
                        if cov_ver > 0 && cov_ver != last_cov_ver {
                            if let Some(bytes) = http_get_bytes("/api/overlay-cover") {
                                if bytes.len() == 96 * 96 * 4 {
                                    *cover_bg.lock().unwrap() = Some((cov_ver, bytes));
                                    last_cov_ver = cov_ver;
                                }
                            }
                        } else if cov_ver == 0 {
                            last_cov_ver = 0;
                        }

                        let mut guard = state_bg.lock().unwrap();
                        if *guard != new_feed {
                            *guard = new_feed;
                            egui_ctx.request_repaint();
                        }
                    } else {
                        fail_streak += 1;
                        if start_time.elapsed() > Duration::from_secs(4) && fail_streak > 120 {
                            egui_ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                            break;
                        }
                    }

                    // Adaptive polling: responsive 85ms while playing, ultra-light 220ms/300ms when paused/hidden
                    let sleep_ms = if hidden_bg.load(Ordering::Relaxed) {
                        300
                    } else if !is_playing {
                        220
                    } else {
                        85
                    };
                    thread::sleep(Duration::from_millis(sleep_ms));
                }
            });
            Ok(Box::new(LyricsOverlayApp::new(cc, state, cover_rgba, hidden_flag)))
        }),
    );
}
