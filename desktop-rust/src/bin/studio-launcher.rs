#![windows_subsystem = "windows"]

use std::fs;
use std::net::{SocketAddr, TcpStream};
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::thread;
use std::time::{Duration, Instant};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(target_os = "windows")]
mod win_focus {
    type Hwnd = isize;
    type Bool = i32;

    #[link(name = "user32")]
    extern "system" {
        fn EnumWindows(cb: extern "system" fn(Hwnd, isize) -> Bool, lparam: isize) -> Bool;
        fn IsWindowVisible(hwnd: Hwnd) -> Bool;
        fn IsIconic(hwnd: Hwnd) -> Bool;
        fn GetWindowTextW(hwnd: Hwnd, buf: *mut u16, max_count: i32) -> i32;
        fn ShowWindow(hwnd: Hwnd, cmd: i32) -> Bool;
        fn SetForegroundWindow(hwnd: Hwnd) -> Bool;
        fn keybd_event(vk: u8, scan: u8, flags: u32, extra: usize);
    }

    extern "system" fn enum_cb(hwnd: Hwnd, lparam: isize) -> Bool {
        unsafe {
            if IsWindowVisible(hwnd) == 0 {
                return 1;
            }
            let mut buf = [0u16; 256];
            let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            if len > 0 {
                let title = String::from_utf16_lossy(&buf[..len as usize]);
                if title == "Cobra Audio" || title.starts_with("Cobra Audio -") {
                    let out_ptr = lparam as *mut Hwnd;
                    *out_ptr = hwnd;
                    return 0;
                }
            }
            1
        }
    }

    pub fn focus_existing_studio() -> bool {
        let mut found: Hwnd = 0;
        unsafe {
            EnumWindows(enum_cb, (&mut found as *mut Hwnd) as isize);
            if found != 0 {
                let cmd = if IsIconic(found) != 0 { 9 } else { 5 };
                ShowWindow(found, cmd);
                keybd_event(0x12, 0, 0, 0);
                SetForegroundWindow(found);
                keybd_event(0x12, 0, 2, 0);
                return true;
            }
        }
        false
    }
}

#[cfg(not(target_os = "windows"))]
mod win_focus {
    pub fn focus_existing_studio() -> bool {
        false
    }
}

fn is_port_ready(port: u16) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();
    TcpStream::connect_timeout(&addr, Duration::from_millis(160)).is_ok()
}

fn is_overlay_active() -> bool {
    use std::io::{Read, Write};
    let Ok(addr) = "127.0.0.1:19847".parse::<SocketAddr>() else {
        return false;
    };
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(250)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(350)));
    let req = b"GET /api/overlay?action=status HTTP/1.1\r\nHost: 127.0.0.1:19847\r\nConnection: close\r\n\r\n";
    if stream.write_all(req).is_err() {
        return false;
    }
    let mut buf = String::new();
    let _ = stream.read_to_string(&mut buf);
    buf.contains("\"running\":true")
}

fn find_project_root() -> Option<PathBuf> {
    if let Ok(exe) = std::env::current_exe() {
        let mut cur = exe.parent();
        for _ in 0..5 {
            if let Some(dir) = cur {
                if dir.join("server.js").exists() && dir.join("index.html").exists() {
                    return Some(dir.to_path_buf());
                }
                cur = dir.parent();
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("server.js").exists() && cwd.join("index.html").exists() {
            return Some(cwd);
        }
    }
    None
}

fn find_node_exe() -> String {
    let candidates = [
        r"D:\Device\Apps_mini\node.js\node.exe",
        r"C:\Program Files\nodejs\node.exe",
    ];
    for c in candidates {
        if Path::new(c).exists() {
            return c.to_string();
        }
    }
    "node".to_string()
}

fn find_webview_browser() -> Option<&'static str> {
    let candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ];
    for c in candidates {
        if Path::new(c).exists() {
            return Some(c);
        }
    }
    None
}

fn ensure_translate_disabled(profile_dir: &Path) {
    let default_dir = profile_dir.join("Default");
    let _ = fs::create_dir_all(&default_dir);
    let prefs_path = default_dir.join("Preferences");
    if !prefs_path.exists() {
        let prefs = r#"{"translate":{"enabled":false},"browser":{"check_default_browser":false}}"#;
        let _ = fs::write(prefs_path, prefs);
    }
}

fn spawn_bridge(root: &Path) -> Option<Child> {
    if is_port_ready(19847) && is_port_ready(19848) {
        return None;
    }
    let child = if !is_port_ready(19847) {
        let node = find_node_exe();
        Command::new(node)
            .arg(root.join("server.js"))
            .current_dir(root)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .ok()
    } else {
        None
    };

    let deadline = Instant::now() + Duration::from_secs(6);
    while Instant::now() < deadline {
        if is_port_ready(19847) && is_port_ready(19848) {
            break;
        }
        thread::sleep(Duration::from_millis(120));
    }
    child
}

fn main() {
    if win_focus::focus_existing_studio() {
        return;
    }

    let Some(root) = find_project_root() else {
        return;
    };

    let spawned_bridge = spawn_bridge(&root);
    let Some(browser) = find_webview_browser() else {
        return;
    };

    let profile_dir = root.join(".desktop-profile");
    ensure_translate_disabled(&profile_dir);

    let app_arg = "--app=http://127.0.0.1:19847/index.html";
    let profile_arg = format!("--user-data-dir={}", profile_dir.display());

    if let Ok(mut child) = Command::new(browser)
        .arg(app_arg)
        .arg(profile_arg)
        .arg("--window-size=1280,740")
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--disable-translate")
        .arg("--disable-infobars")
        .arg("--disable-features=Translate,TranslateUI,msEdgeTranslate,msEdgeSidebarV2")
        .spawn()
    {
        let _ = child.wait();
    }

    // Keep bridge & overlay running smoothly if user closed Cobra Studio while overlay is active
    if let Some(bridge_child) = spawned_bridge {
        if !is_overlay_active() {
            let pid = bridge_child.id();
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }
    }
}
