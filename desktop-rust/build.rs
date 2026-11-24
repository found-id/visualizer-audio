use std::path::Path;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=app.rc");
    println!("cargo:rerun-if-changed=../assets/app.ico");

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let res_path = format!("{out_dir}/app.res");
    let rc_exe = r"C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\rc.exe";

    if Path::new(rc_exe).exists() && Path::new("../assets/app.ico").exists() {
        let status = Command::new(rc_exe)
            .args(["/nologo", "/fo", &res_path, "app.rc"])
            .status();
        if let Ok(s) = status {
            if s.success() {
                println!("cargo:rustc-link-arg-bin=studio-launcher={res_path}");
            }
        }
    }
}
