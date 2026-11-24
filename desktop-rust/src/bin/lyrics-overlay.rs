#![windows_subsystem = "windows"]

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use eframe::egui::{
    self, Align2, Color32, ColorImage, FontFamily, FontId, Pos2, Rect, Rounding, Sense, Stroke,
    TextureHandle, TextureOptions, Vec2,
};

#[derive(Clone, PartialEq)]
struct WordEntry {
    text: String,
    state: u8, // 0 = upcoming, 1 = spoken, 2 = active
}

#[derive(Clone, PartialEq)]
struct OverlayFeed {
    active: bool,
    playing: bool,
    title: String,
    artist: String,
    cover_version: u64,
    prev: String,
    curr: String,
    next: String,
    words: Vec<WordEntry>,
    pos: String,
    scale: f32,
    opacity: f32,
    show_prev_next: bool,
    click_through: bool,
}

impl Default for OverlayFeed {
    fn default() -> Self {
        Self {
            active: false,
            playing: false,
            title: String::new(),
            artist: String::new(),
            cover_version: 0,
            prev: String::new(),
            curr: "Menunggu musik...".to_string(),
            next: String::new(),
            words: Vec::new(),
            pos: "top".to_string(),
            scale: 1.05,
            opacity: 0.96,
            show_prev_next: true,
            click_through: false,
        }
    }
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
    Some(raw[sep..].to_vec())
}

fn send_media_cmd(cmd: &'static str) {
    thread::spawn(move || {
        let path = format!("/api/control?cmd={}", cmd);
        let _ = http_get_bytes(&path);
    });
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
                "title" => feed.title = v.to_string(),
                "artist" => feed.artist = v.to_string(),
                "cover_version" => feed.cover_version = v.parse::<u64>().unwrap_or(0),
                "prev" => feed.prev = v.to_string(),
                "curr" => feed.curr = v.to_string(),
                "next" => feed.next = v.to_string(),
                "pos" => feed.pos = v.to_string(),
                "scale" => feed.scale = v.parse::<f32>().unwrap_or(1.05).clamp(0.7, 2.2),
                "opacity" => feed.opacity = v.parse::<f32>().unwrap_or(0.96).clamp(0.25, 1.0),
                "show_prev_next" => feed.show_prev_next = v == "1",
                "click_through" => feed.click_through = v == "1",
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

fn truncate_str(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        s.to_string()
    } else {
        let head: String = s.chars().take(max_chars.saturating_sub(1)).collect();
        format!("{}…", head)
    }
}

fn draw_shadowed_text(
    painter: &egui::Painter,
    pos: Pos2,
    align: Align2,
    text: &str,
    font: FontId,
    color: Color32,
    alpha_mult: f32,
) {
    if text.is_empty() {
        return;
    }
    let shadow_alpha = (225.0 * alpha_mult).round().clamp(0.0, 255.0) as u8;
    let shadow = Color32::from_rgba_unmultiplied(0, 0, 0, shadow_alpha);
    for (dx, dy) in [(-1.1, 0.0), (1.1, 0.0), (0.0, -1.1), (0.0, 1.6), (0.0, 2.6)] {
        painter.text(pos + Vec2::new(dx, dy), align, text, font.clone(), shadow);
    }
    painter.text(pos, align, text, font, color);
}

struct LyricsOverlayApp {
    state: Arc<Mutex<OverlayFeed>>,
    cover_rgba: Arc<Mutex<Option<(u64, Vec<u8>)>>>,
    cover_tex: Option<TextureHandle>,
    loaded_cover_ver: u64,
    last_pos_mode: String,
    last_click_through: bool,
    last_mon_size: Vec2,
    user_moved: bool,
}

impl LyricsOverlayApp {
    fn new(
        cc: &eframe::CreationContext<'_>,
        state: Arc<Mutex<OverlayFeed>>,
        cover_rgba: Arc<Mutex<Option<(u64, Vec<u8>)>>>,
    ) -> Self {
        cc.egui_ctx.set_visuals(egui::Visuals::dark());
        Self {
            state,
            cover_rgba,
            cover_tex: None,
            loaded_cover_ver: 0,
            last_pos_mode: String::new(),
            last_click_through: false,
            last_mon_size: Vec2::ZERO,
            user_moved: false,
        }
    }
}

impl eframe::App for LyricsOverlayApp {
    fn clear_color(&self, _visuals: &egui::Visuals) -> [f32; 4] {
        [0.0, 0.0, 0.0, 0.0]
    }

    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let feed = self.state.lock().unwrap().clone();

        // Update album cover texture if a new 96x96 RGBA thumbnail arrived
        if let Some((ver, bytes)) = self.cover_rgba.lock().unwrap().take() {
            if bytes.len() == 96 * 96 * 4 {
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

        let mon_size = ctx
            .input(|i| i.viewport().monitor_size)
            .unwrap_or(Vec2::new(1920.0, 1080.0));
        let win_w = 680.0_f32.min(mon_size.x - 32.0).max(460.0);
        let win_h = 196.0_f32;

        if (!self.user_moved && self.last_mon_size != mon_size) || self.last_pos_mode != feed.pos {
            self.last_pos_mode = feed.pos.clone();
            self.last_mon_size = mon_size;
            let x = (mon_size.x - win_w) * 0.5;
            let y = match feed.pos.as_str() {
                "bottom" => (mon_size.y - win_h - 36.0).max(16.0),
                "center" => (mon_size.y - win_h) * 0.5,
                _ => 18.0,
            };
            ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(Vec2::new(win_w, win_h)));
            ctx.send_viewport_cmd(egui::ViewportCommand::OuterPosition(Pos2::new(x, y)));
        }

        if self.last_click_through != feed.click_through {
            self.last_click_through = feed.click_through;
            ctx.send_viewport_cmd(egui::ViewportCommand::MousePassthrough(feed.click_through));
        }

        egui::CentralPanel::default()
            .frame(egui::Frame::none().fill(Color32::TRANSPARENT))
            .show(ctx, |ui| {
                let rect = ui.max_rect();
                let painter = ui.painter();
                let cx = rect.center().x;
                let scale = feed.scale;
                let op = feed.opacity;

                // 1. Minimalist Draggable Control Center Pill (Album + Track + Controls)
                let bar_w = 430.0_f32.min(rect.width() - 20.0);
                let bar_h = 54.0_f32;
                let bar_rect = Rect::from_center_size(
                    Pos2::new(cx, rect.top() + 34.0),
                    Vec2::new(bar_w, bar_h),
                );

                // Subtle translucent dark pill only for the compact media control center
                painter.rect(
                    bar_rect,
                    Rounding::same(14.0),
                    Color32::from_rgba_unmultiplied(15, 16, 20, (175.0 * op) as u8),
                    Stroke::new(1.0, Color32::from_rgba_unmultiplied(255, 255, 255, (32.0 * op) as u8)),
                );

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
                } else {
                    painter.rect_filled(
                        cov_rect,
                        Rounding::same(8.0),
                        Color32::from_rgba_unmultiplied(255, 255, 255, 22),
                    );
                    painter.text(
                        cov_rect.center(),
                        Align2::CENTER_CENTER,
                        "♪",
                        FontId::new(18.0, FontFamily::Proportional),
                        Color32::from_rgba_unmultiplied(255, 255, 255, 180),
                    );
                }

                // Track title & artist
                let text_left = cov_rect.right() + 10.0;
                let title_str = if feed.active && !feed.title.is_empty() {
                    truncate_str(&feed.title, 26)
                } else {
                    "Cobra Audio".to_string()
                };
                let artist_str = if feed.active && !feed.artist.is_empty() {
                    truncate_str(&feed.artist, 28)
                } else {
                    "Geser untuk pindah posisi".to_string()
                };

                painter.text(
                    Pos2::new(text_left, bar_rect.top() + 12.0),
                    Align2::LEFT_TOP,
                    title_str,
                    FontId::new(13.0, FontFamily::Proportional),
                    Color32::from_rgba_unmultiplied(255, 255, 255, (245.0 * op) as u8),
                );
                painter.text(
                    Pos2::new(text_left, bar_rect.top() + 29.0),
                    Align2::LEFT_TOP,
                    artist_str,
                    FontId::new(11.0, FontFamily::Proportional),
                    Color32::from_rgba_unmultiplied(185, 192, 205, (205.0 * op) as u8),
                );

                // Transport buttons on right side of Control Center
                let btn_y = bar_rect.center().y;
                let close_rect = Rect::from_center_size(Pos2::new(bar_rect.right() - 20.0, btn_y), Vec2::splat(24.0));
                let next_rect = Rect::from_center_size(Pos2::new(bar_rect.right() - 48.0, btn_y), Vec2::splat(24.0));
                let play_rect = Rect::from_center_size(Pos2::new(bar_rect.right() - 78.0, btn_y), Vec2::splat(28.0));
                let prev_rect = Rect::from_center_size(Pos2::new(bar_rect.right() - 108.0, btn_y), Vec2::splat(24.0));

                // Drag zone = left/middle of Control Center (before buttons)
                let drag_rect = Rect::from_min_max(
                    bar_rect.min,
                    Pos2::new(prev_rect.left() - 6.0, bar_rect.max.y),
                );
                let drag_resp = ui.interact(drag_rect, ui.id().with("drag_bar"), Sense::click_and_drag());
                if drag_resp.drag_started() || drag_resp.dragged() {
                    self.user_moved = true;
                    ctx.send_viewport_cmd(egui::ViewportCommand::StartDrag);
                }

                // Draw & handle buttons cleanly
                let draw_btn = |r: Rect, label: &str, filled: bool, id_str: &str| -> bool {
                    let resp = ui.interact(r, ui.id().with(id_str), Sense::click());
                    if filled {
                        let bg = if resp.hovered() {
                            Color32::from_rgba_unmultiplied(255, 255, 255, 255)
                        } else {
                            Color32::from_rgba_unmultiplied(240, 242, 248, (235.0 * op) as u8)
                        };
                        painter.circle_filled(r.center(), 13.0, bg);
                        painter.text(
                            r.center(),
                            Align2::CENTER_CENTER,
                            label,
                            FontId::new(12.0, FontFamily::Proportional),
                            Color32::from_rgb(16, 17, 22),
                        );
                    } else {
                        if resp.hovered() {
                            painter.circle_filled(r.center(), 12.0, Color32::from_rgba_unmultiplied(255, 255, 255, 28));
                        }
                        painter.text(
                            r.center(),
                            Align2::CENTER_CENTER,
                            label,
                            FontId::new(12.5, FontFamily::Proportional),
                            Color32::from_rgba_unmultiplied(240, 244, 250, (220.0 * op) as u8),
                        );
                    }
                    resp.clicked()
                };

                if draw_btn(prev_rect, "⏮", false, "btn_prev") {
                    send_media_cmd("prev");
                }
                if draw_btn(play_rect, if feed.playing { "⏸" } else { "▶" }, true, "btn_play") {
                    send_media_cmd("playpause");
                }
                if draw_btn(next_rect, "⏭", false, "btn_next") {
                    send_media_cmd("next");
                }
                if draw_btn(close_rect, "✕", false, "btn_close") {
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }

                // 2. Pure Transparent Floating Lyrics (NO background box!)
                let lyr_center_y = bar_rect.bottom() + 68.0;
                let sub_font = FontId::new(13.5 * scale, FontFamily::Proportional);
                let curr_font = FontId::new(22.0 * scale, FontFamily::Proportional);
                let line_gap = 29.0 * scale;

                if feed.show_prev_next && !feed.prev.is_empty() {
                    let prev_col = Color32::from_rgba_unmultiplied(220, 226, 238, (145.0 * op) as u8);
                    draw_shadowed_text(
                        painter,
                        Pos2::new(cx, lyr_center_y - line_gap),
                        Align2::CENTER_CENTER,
                        &feed.prev,
                        sub_font.clone(),
                        prev_col,
                        op * 0.72,
                    );
                }

                if !feed.words.is_empty() {
                    let space_galley = painter.layout_no_wrap(" ".to_string(), curr_font.clone(), Color32::WHITE);
                    let space_w = space_galley.size().x.max(5.5 * scale);
                    let mut galleys = Vec::with_capacity(feed.words.len());
                    let mut total_w = 0.0_f32;

                    for (idx, w) in feed.words.iter().enumerate() {
                        let col = match w.state {
                            2 => Color32::from_rgba_unmultiplied(125, 211, 252, (255.0 * op) as u8),
                            1 => Color32::from_rgba_unmultiplied(255, 255, 255, (255.0 * op) as u8),
                            _ => Color32::from_rgba_unmultiplied(255, 255, 255, (148.0 * op) as u8),
                        };
                        let g = painter.layout_no_wrap(w.text.clone(), curr_font.clone(), col);
                        total_w += g.size().x;
                        if idx + 1 < feed.words.len() {
                            total_w += space_w;
                        }
                        galleys.push((g, col, w.state));
                    }

                    if total_w > rect.width() - 24.0 {
                        let col = Color32::from_rgba_unmultiplied(255, 255, 255, (255.0 * op) as u8);
                        draw_shadowed_text(
                            painter,
                            Pos2::new(cx, lyr_center_y),
                            Align2::CENTER_CENTER,
                            &feed.curr,
                            curr_font.clone(),
                            col,
                            op,
                        );
                    } else {
                        let mut x_cursor = cx - total_w * 0.5;
                        for (g, col, st) in galleys {
                            let gw = g.size().x;
                            let gh = g.size().y;
                            let y_offset = if st == 2 { -2.0 * scale } else { 0.0 };
                            let w_pos = Pos2::new(x_cursor, lyr_center_y - gh * 0.5 + y_offset);
                            let word_txt = g.job.text.clone();
                            draw_shadowed_text(
                                painter,
                                w_pos,
                                Align2::LEFT_TOP,
                                &word_txt,
                                curr_font.clone(),
                                col,
                                op,
                            );
                            x_cursor += gw + space_w;
                        }
                    }
                } else {
                    let col = Color32::from_rgba_unmultiplied(255, 255, 255, (255.0 * op) as u8);
                    draw_shadowed_text(
                        painter,
                        Pos2::new(cx, lyr_center_y),
                        Align2::CENTER_CENTER,
                        &feed.curr,
                        curr_font,
                        col,
                        op,
                    );
                }

                if feed.show_prev_next && !feed.next.is_empty() {
                    let next_col = Color32::from_rgba_unmultiplied(220, 226, 238, (145.0 * op) as u8);
                    draw_shadowed_text(
                        painter,
                        Pos2::new(cx, lyr_center_y + line_gap),
                        Align2::CENTER_CENTER,
                        &feed.next,
                        sub_font,
                        next_col,
                        op * 0.72,
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

    let native_options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("Cobra Audio Overlay")
            .with_transparent(true)
            .with_decorations(false)
            .with_always_on_top()
            .with_taskbar(false)
            .with_mouse_passthrough(false)
            .with_inner_size([680.0, 196.0])
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
                loop {
                    if let Some(new_feed) = fetch_overlay_feed() {
                        fail_streak = 0;
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
                    thread::sleep(Duration::from_millis(55));
                }
            });
            Ok(Box::new(LyricsOverlayApp::new(cc, state, cover_rgba)))
        }),
    );
}
