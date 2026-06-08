// Tauri entry point. The frontend handles all app logic; the Rust side hosts
// the WebView, exposes fs + http plugins, and on macOS manages the menu-bar
// tray + compact popover window for the Pomodoro timer.
use serde::Serialize;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .setup(setup_app)
        .invoke_handler(tauri::generate_handler![
            hide_main_window,
            show_main_window,
            set_popover_appearance,
            set_tray_pill,
            set_tray_visible,
            is_accessibility_trusted,
            open_accessibility_settings,
            request_accessibility_permission,
            accessibility_client_label,
            ensure_quick_add_hotkey,
            set_quick_add_enabled,
            get_quick_add_status,
        ])
        .build(tauri::generate_context!())
        .expect("error while running Silver Brain")
        .run(on_app_event);
}

#[derive(Default)]
struct TrayState {
    visible: std::sync::Mutex<bool>,
    /// Skip the next activation restore (e.g. when opening the tray popover).
    suppress_activation_restore: std::sync::Mutex<bool>,
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(TrayState::default());

    #[cfg(target_os = "macos")]
    {
        register_accessibility_client();
        setup_main_window_close_to_hide(app);
        setup_macos_tray(app)?;
        if let Some(overlay) = app.get_webview_window("quick-add") {
            configure_quick_add_window(&overlay);
        }
        ensure_double_ctrl_hotkey(app.handle().clone());
        schedule_quick_add_hotkey_retries(app.handle().clone());
    }

    Ok(())
}

/// macOS red close button hides the main window instead of destroying it so dock
/// / Cmd+Tab can bring it back.
#[cfg(target_os = "macos")]
fn setup_main_window_close_to_hide(app: &tauri::App) {
    use tauri::WindowEvent;

    let Some(main) = app.get_webview_window("main") else {
        return;
    };
    let main_for_close = main.clone();

    main.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = main_for_close.hide();
        }
    });
}

#[cfg(target_os = "macos")]
fn setup_macos_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
        Manager,
    };

    app.handle().plugin(tauri_plugin_positioner::init())?;
    setup_app_activation_observer(app.handle().clone());

    let open_item = MenuItem::with_id(app, "open", "Open App", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    // Start with a transparent placeholder; the frontend renders a pill PNG each tick.
    let placeholder = tauri::image::Image::new_owned(vec![0, 0, 0, 0], 1, 1);

    let builder = TrayIconBuilder::with_id("main")
        .icon(placeholder)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                let _ = restore_main_window(&app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                toggle_popover(tray.app_handle(), rect);
            }
        });

    let tray = builder.build(app)?;
    let _ = tray.set_visible(false);

    if let Some(popover) = app.get_webview_window("pomodoro-tray") {
        configure_popover_window(&popover);
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn on_app_event(_app: &tauri::AppHandle, _event: tauri::RunEvent) {}

#[cfg(target_os = "macos")]
fn on_app_event(app: &tauri::AppHandle, event: tauri::RunEvent) {
    if let tauri::RunEvent::Reopen { .. } = event {
        let _ = restore_main_window(app);
    }
}

#[cfg(target_os = "macos")]
fn set_suppress_activation_restore(app: &tauri::AppHandle, suppress: bool) {
    if let Some(state) = app.try_state::<TrayState>() {
        if let Ok(mut guard) = state.suppress_activation_restore.lock() {
            *guard = suppress;
        }
    }
}

#[cfg(target_os = "macos")]
fn quick_add_is_visible(app: &tauri::AppHandle) -> bool {
    app.get_webview_window("quick-add")
        .map(|w| w.is_visible().unwrap_or(false))
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn should_restore_on_activation(app: &tauri::AppHandle) -> bool {
    if quick_add_is_visible(app) {
        return false;
    }

    if let Some(state) = app.try_state::<TrayState>() {
        if let Ok(guard) = state.suppress_activation_restore.lock() {
            if *guard {
                return false;
            }
        }
    }

    let Some(main) = app.get_webview_window("main") else {
        return false;
    };

    !main.is_visible().unwrap_or(true)
}

#[cfg(target_os = "macos")]
fn restore_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(main) = app.get_webview_window("main") else {
        return Ok(());
    };

    if !main.is_visible().unwrap_or(false) {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }

    if let Some(popover) = app.get_webview_window("pomodoro-tray") {
        let _ = popover.hide();
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn setup_app_activation_observer(app: tauri::AppHandle) {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2_app_kit::NSApplicationDidBecomeActiveNotification;
    use objc2_foundation::{NSNotificationCenter, NSOperationQueue};

    let block = RcBlock::new(move |_notification| {
        let app = app.clone();
        let app_for_thread = app.clone();
        let _ = app.run_on_main_thread(move || {
            if should_restore_on_activation(&app_for_thread) {
                let _ = restore_main_window(&app_for_thread);
            }
        });
    });

    unsafe {
        let center = NSNotificationCenter::defaultCenter();
        let observer = center.addObserverForName_object_queue_usingBlock(
            Some(NSApplicationDidBecomeActiveNotification),
            None,
            Some(&NSOperationQueue::mainQueue()),
            &block,
        );
        // Keep the observer alive for the lifetime of the app.
        Retained::into_raw(observer);
    }
}

#[cfg(target_os = "macos")]
fn configure_popover_window(popover: &tauri::WebviewWindow) {
    use tauri::window::{Color, Effect, EffectsBuilder};

    let _ = popover.set_shadow(false);
    let _ = popover.set_background_color(Some(Color(0, 0, 0, 0)));

    let effects = EffectsBuilder::new()
        .effects(vec![Effect::WindowBackground])
        .radius(12.0)
        .build();
    let _ = popover.set_effects(Some(effects));
}

#[cfg(target_os = "macos")]
fn position_tray_popover(
    app: &tauri::AppHandle,
    popover: &tauri::WebviewWindow,
    tray_rect: tauri::Rect,
) {
    use tauri::{PhysicalPosition, PhysicalSize};

    const POPOVER_W: f64 = 284.0;
    const POPOVER_H: f64 = 172.0;

    let tray_pos = tray_rect.position.to_physical(1.0);
    let tray_size = tray_rect.size.to_physical::<f64>(1.0);
    let tray_x = tray_pos.x;
    let tray_y = tray_pos.y;
    let tray_width = tray_size.width;

    let monitor = app
        .monitor_from_point(tray_x, tray_y)
        .ok()
        .flatten();
    let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);

    let window_size = popover
        .outer_size()
        .ok()
        .filter(|s| s.width > 0 && s.height > 0)
        .unwrap_or(PhysicalSize::new(
            (POPOVER_W * scale) as u32,
            (POPOVER_H * scale) as u32,
        ));

    let win_w = window_size.width as f64;
    let win_h = window_size.height as f64;

    let mut x = tray_x + tray_width / 2.0 - win_w / 2.0;
    // Anchor below the menu-bar pill (same rules as tauri-plugin-positioner TrayCenter).
    let mut y = tray_y - win_h;
    if y < 0.0 {
        y = tray_y;
    }

    if let Some(monitor) = monitor {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let left = monitor_pos.x as f64;
        let top = monitor_pos.y as f64;
        let right = left + monitor_size.width as f64;
        let bottom = top + monitor_size.height as f64;

        if x < left {
            x = left;
        } else if x + win_w > right {
            x = right - win_w;
        }
        if y < top {
            y = top;
        } else if y + win_h > bottom {
            y = bottom - win_h;
        }
    }

    let _ = popover.set_position(PhysicalPosition::new(x, y));
}

#[cfg(target_os = "macos")]
fn toggle_popover(app: &tauri::AppHandle, tray_rect: tauri::Rect) {
    use tauri::Manager;

    let Some(popover) = app.get_webview_window("pomodoro-tray") else {
        return;
    };

    if popover.is_visible().unwrap_or(false) {
        let _ = popover.hide();
        return;
    }

    set_suppress_activation_restore(app, true);
    let app_for_clear = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(300));
        set_suppress_activation_restore(&app_for_clear, false);
    });

    configure_popover_window(&popover);
    let _ = popover.show();
    // Position after show — macOS ignores set_position on a never-shown window,
    // and the first layout pass may not have a reliable outer_size yet.
    position_tray_popover(app, &popover, tray_rect);
    let _ = popover.set_focus();

    let popover_retry = popover.clone();
    let app_retry = app.clone();
    std::thread::spawn(move || {
        for _ in 0..4 {
            std::thread::sleep(std::time::Duration::from_millis(50));
            let overlay = popover_retry.clone();
            let app = app_retry.clone();
            let rect = tray_rect;
            let _ = popover_retry.run_on_main_thread(move || {
                position_tray_popover(&app, &overlay, rect);
            });
        }
    });
}

#[tauri::command]
fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(main) = app.get_webview_window("main") {
            main.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(main) = app.get_webview_window("main") {
            main.show().map_err(|e| e.to_string())?;
            main.set_focus().map_err(|e| e.to_string())?;
        }
        if let Some(popover) = app.get_webview_window("pomodoro-tray") {
            let _ = popover.hide();
        }
    }
    Ok(())
}

/// Force the popover window's native appearance (light/dark) so its vibrancy
/// backdrop matches the app theme instead of the OS. Window-scoped on purpose:
/// Tauri's `set_theme` sets the app-global `NSApp` appearance, which would also
/// flip the main window's titlebar/traffic-lights. The frontend calls this
/// whenever the effective theme changes.
#[tauri::command]
fn set_popover_appearance(app: tauri::AppHandle, dark: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(popover) = app.get_webview_window("pomodoro-tray") {
            let target = popover.clone();
            popover
                .run_on_main_thread(move || apply_window_appearance(&target, dark))
                .map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (&app, dark);
    }
    Ok(())
}

/// Set an NSWindow's appearance to aqua/darkAqua. Must run on the main thread.
#[cfg(target_os = "macos")]
fn apply_window_appearance(win: &tauri::WebviewWindow, dark: bool) {
    use objc2_app_kit::{
        NSAppearance, NSAppearanceCustomization, NSAppearanceNameAqua, NSAppearanceNameDarkAqua,
        NSWindow,
    };

    let Ok(ptr) = win.ns_window() else {
        return;
    };
    if ptr.is_null() {
        return;
    }

    unsafe {
        let window: &NSWindow = &*(ptr as *const NSWindow);
        let name = if dark {
            NSAppearanceNameDarkAqua
        } else {
            NSAppearanceNameAqua
        };
        let appearance = NSAppearance::appearanceNamed(name);
        window.setAppearance(appearance.as_deref());
    }
}

#[tauri::command]
fn set_tray_pill(app: tauri::AppHandle, png_bytes: Vec<u8>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::image::Image;
        let decoded = image::load_from_memory(&png_bytes).map_err(|e| e.to_string())?;
        let rgba = decoded.to_rgba8();
        let (width, height) = rgba.dimensions();
        let img = Image::new_owned(rgba.into_raw(), width, height);
        if let Some(tray) = app.tray_by_id("main") {
            tray.set_icon(Some(img)).map_err(|e| e.to_string())?;
            let _ = tray.set_icon_as_template(true);
            let _ = tray.set_title(None::<&str>);
        }
    }
    let _ = png_bytes;
    Ok(())
}

#[tauri::command]
fn set_tray_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_visible(visible).map_err(|e| e.to_string())?;
    }

    if let Some(state) = app.try_state::<TrayState>() {
        if let Ok(mut guard) = state.visible.lock() {
            *guard = visible;
        }
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn restore_main_window(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

// ─── Accessibility permission (macOS quick-add) ─────────────────────────────

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> bool;
}

#[cfg(target_os = "macos")]
fn accessibility_options(prompt: bool) -> core_foundation::dictionary::CFDictionary<core_foundation::string::CFString, core_foundation::boolean::CFBoolean> {
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;

    CFDictionary::from_CFType_pairs(&[(
        CFString::from_static_string("AXTrustedCheckOptionPrompt"),
        if prompt {
            CFBoolean::true_value()
        } else {
            CFBoolean::false_value()
        },
    )])
}

/// Registers this process with the Accessibility privacy database (toggle off).
#[cfg(target_os = "macos")]
fn register_accessibility_client() {
    use core_foundation::base::TCFType;

    let options = accessibility_options(false);
    unsafe {
        AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef() as *const std::ffi::c_void);
    }
}

#[cfg(not(target_os = "macos"))]
fn register_accessibility_client() {}

#[cfg(target_os = "macos")]
fn accessibility_is_trusted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

#[cfg(not(target_os = "macos"))]
fn accessibility_is_trusted() -> bool {
    true
}

#[cfg(target_os = "macos")]
fn accessibility_request_permission() -> bool {
    use core_foundation::base::TCFType;

    let options = accessibility_options(true);
    unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef() as *const std::ffi::c_void) }
}

#[cfg(not(target_os = "macos"))]
fn accessibility_request_permission() -> bool {
    true
}

#[cfg(target_os = "macos")]
fn open_accessibility_settings_internal() -> Result<(), String> {
    use std::process::Command;

    const URLS: &[&str] = &[
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility",
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
    ];

    for url in URLS {
        if Command::new("open").arg(url).spawn().is_ok() {
            return Ok(());
        }
    }
    Err("Failed to open Accessibility settings".into())
}

#[tauri::command]
fn is_accessibility_trusted() -> bool {
    accessibility_is_trusted()
}

#[tauri::command]
fn request_accessibility_permission() -> bool {
    let trusted = accessibility_request_permission();
    if !trusted {
        let _ = open_accessibility_settings_internal();
    }
    trusted
}

/// Name macOS shows in Privacy → Accessibility (.app bundle name or dev binary).
#[tauri::command]
fn accessibility_client_label() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(app_name) = exe
                .ancestors()
                .find(|p| p.extension().is_some_and(|ext| ext == "app"))
                .and_then(|p| p.file_stem())
            {
                return app_name.to_string_lossy().into_owned();
            }
            if let Some(stem) = exe.file_stem() {
                return stem.to_string_lossy().into_owned();
            }
        }
        "SilverBrain".into()
    }
    #[cfg(not(target_os = "macos"))]
    {
        "SilverBrain".into()
    }
}

#[tauri::command]
fn open_accessibility_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        register_accessibility_client();
        open_accessibility_settings_internal()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn emit_quick_add_permission_needed(app: &tauri::AppHandle) {
    use tauri::Emitter;
    let _ = app.emit("quick-add:permission-needed", ());
}

// ─── Quick-add overlay (macOS double-Ctrl) ───────────────────────────────────

#[cfg(target_os = "macos")]
fn monitor_at_cursor(app: &tauri::AppHandle) -> Option<tauri::Monitor> {
    let cursor = app.cursor_position().ok()?;
    app.monitor_from_point(cursor.x, cursor.y).ok().flatten()
}

#[cfg(target_os = "macos")]
fn position_quick_add_window(app: &tauri::AppHandle, overlay: &tauri::WebviewWindow) {
    use tauri::{LogicalPosition, LogicalSize};

    const WIN_W: f64 = 688.0;
    const WIN_H: f64 = 300.0;
    /// Middle of the bottom quarter when the screen is split into 4 horizontal bands.
    const Q4_CENTER_Y_FRACTION: f64 = 0.875;
    /// Bar is flex-aligned to the window bottom; this is its vertical center offset
    /// (36px overlay padding + ~half the bar height).
    const BAR_CENTER_ABOVE_WINDOW_BOTTOM: f64 = 64.0;

    let monitor = monitor_at_cursor(app)
        .or_else(|| overlay.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        let _ = overlay.set_size(LogicalSize::new(WIN_W, WIN_H));
        return;
    };

    let scale = monitor.scale_factor();
    let screen_w = monitor.size().width as f64 / scale;
    let screen_h = monitor.size().height as f64 / scale;
    let origin_x = monitor.position().x as f64 / scale;
    let origin_y = monitor.position().y as f64 / scale;

    let x = origin_x + (screen_w - WIN_W) / 2.0;
    let bar_center_y = origin_y + screen_h * Q4_CENTER_Y_FRACTION;
    let y = (bar_center_y - (WIN_H - BAR_CENTER_ABOVE_WINDOW_BOTTOM)).max(origin_y);

    let _ = overlay.set_size(LogicalSize::new(WIN_W, WIN_H));
    let _ = overlay.set_position(LogicalPosition::new(x, y));
}

#[cfg(target_os = "macos")]
fn configure_quick_add_window(overlay: &tauri::WebviewWindow) {
    use tauri::window::Color;

    let _ = overlay.set_shadow(false);
    let _ = overlay.set_background_color(Some(Color(0, 0, 0, 0)));
    // No native window background — frosted glass is rendered in the webview.
    let _ = overlay.set_effects(None);
}

// Overlay panel subclass that forces `canBecomeKeyWindow`.
//
// A borderless `NSWindow`/`NSPanel` returns `false` from `canBecomeKeyWindow`
// by default, so it can never take keyboard focus — typing into the overlay
// silently does nothing. Overriding it to `true` lets the non-activating panel
// receive keystrokes.
#[cfg(target_os = "macos")]
objc2::define_class!(
    #[unsafe(super(objc2_app_kit::NSPanel))]
    #[thread_kind = objc2::MainThreadOnly]
    #[name = "SilverBrainQuickAddPanel"]
    struct QuickAddPanel;

    impl QuickAddPanel {
        #[unsafe(method(canBecomeKeyWindow))]
        fn can_become_key_window(&self) -> bool {
            true
        }
    }
);

/// Turn the overlay into a non-activating floating panel.
///
/// A plain `NSWindow` can only become key (and so receive keystrokes) by
/// activating the whole app — which yanks the hidden/background main window in
/// front of whatever the user was using. Re-classing it to [`QuickAddPanel`]
/// (an `NSPanel` subclass) with the `NonactivatingPanel` style lets it take
/// keyboard focus without activating SilverBrain, so the main window stays put.
/// We also float it above other apps' windows and let it ride along onto
/// whatever Space (incl. full-screen) is up front, so it lands on the display
/// the user is actually looking at.
#[cfg(target_os = "macos")]
fn make_overlay_nonactivating_panel(overlay: &tauri::WebviewWindow) {
    use objc2::ffi::object_setClass;
    use objc2::runtime::AnyObject;
    use objc2::ClassType;
    use objc2_app_kit::{
        NSWindow, NSWindowCollectionBehavior, NSWindowStyleMask, NSFloatingWindowLevel,
    };

    let Ok(ptr) = overlay.ns_window() else {
        return;
    };
    if ptr.is_null() {
        return;
    }

    unsafe {
        let window: &NSWindow = &*(ptr as *const NSWindow);

        // Reclass to our panel subclass + set the non-activating style only once.
        if !window
            .styleMask()
            .contains(NSWindowStyleMask::NonactivatingPanel)
        {
            object_setClass(ptr as *mut AnyObject, QuickAddPanel::class() as *const _);
            window.setStyleMask(window.styleMask() | NSWindowStyleMask::NonactivatingPanel);
        }

        window.setLevel(NSFloatingWindowLevel);
        window.setCollectionBehavior(
            NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::FullScreenAuxiliary
                | NSWindowCollectionBehavior::Stationary,
        );
    }
}

/// Make the overlay key + front without activating the app (see
/// [`make_overlay_nonactivating_panel`]). Must run on the main thread.
#[cfg(target_os = "macos")]
fn focus_overlay_without_activation(overlay: &tauri::WebviewWindow) {
    use objc2_app_kit::NSWindow;

    let Ok(ptr) = overlay.ns_window() else {
        return;
    };
    if ptr.is_null() {
        return;
    }

    unsafe {
        let window: &NSWindow = &*(ptr as *const NSWindow);
        window.makeKeyAndOrderFront(None);
    }
}

#[cfg(target_os = "macos")]
fn show_quick_add_overlay(app: &tauri::AppHandle) {
    use tauri::{Emitter, Manager};

    let Some(overlay) = app.get_webview_window("quick-add") else {
        return;
    };

    // Safety net: should the app ever activate while showing the overlay, don't
    // restore the hidden main window. (The non-activating panel below normally
    // keeps the app from activating at all.)
    set_suppress_activation_restore(app, true);

    configure_quick_add_window(&overlay);
    make_overlay_nonactivating_panel(&overlay);

    let _ = overlay.show();
    // Position *after* show — macOS ignores set_position on a never-shown window,
    // which would otherwise leave the first open on the primary display instead of
    // the one under the cursor.
    position_quick_add_window(app, &overlay);
    focus_overlay_without_activation(&overlay);
    let _ = app.emit("quick-add:show", ());

    // Webview may not be ready on the first open — retry focus + show signal briefly.
    let overlay_retry = overlay.clone();
    let app_retry = app.clone();
    std::thread::spawn(move || {
        for _ in 0..4 {
            std::thread::sleep(std::time::Duration::from_millis(60));
            let overlay_focus = overlay_retry.clone();
            let _ = overlay_retry.run_on_main_thread(move || {
                focus_overlay_without_activation(&overlay_focus);
            });
            let _ = app_retry.emit("quick-add:show", ());
        }
    });
}

#[cfg(target_os = "macos")]
fn hide_quick_add_overlay(app: &tauri::AppHandle) {
    use tauri::{Emitter, Manager};

    let Some(overlay) = app.get_webview_window("quick-add") else {
        return;
    };

    let _ = overlay.hide();
    set_suppress_activation_restore(app, false);
    let _ = app.emit("quick-add:hide", ());
}

#[cfg(target_os = "macos")]
fn toggle_quick_add_overlay(app: &tauri::AppHandle) {
    use tauri::Manager;

    let Some(overlay) = app.get_webview_window("quick-add") else {
        return;
    };

    if overlay.is_visible().unwrap_or(false) {
        hide_quick_add_overlay(app);
    } else {
        show_quick_add_overlay(app);
    }
}

#[cfg(target_os = "macos")]
struct DoubleCtrlState {
    last_press: std::sync::Mutex<Option<std::time::Instant>>,
    control_down: std::sync::Mutex<bool>,
    permission_logged: std::sync::Mutex<bool>,
}

/// ObjC blocks/monitors are touched only on the main thread; this wrapper is Sync.
#[cfg(target_os = "macos")]
struct MainThreadCell<T>(std::sync::Mutex<T>);

#[cfg(target_os = "macos")]
unsafe impl<T> Sync for MainThreadCell<T> {}

#[cfg(target_os = "macos")]
static HOTKEY_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg(target_os = "macos")]
static QUICK_ADD_ENABLED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(true);

#[cfg(target_os = "macos")]
static LOCAL_MONITOR: MainThreadCell<Option<objc2::rc::Retained<objc2::runtime::AnyObject>>> =
    MainThreadCell(std::sync::Mutex::new(None));

#[cfg(target_os = "macos")]
static LOCAL_MONITOR_BLOCK: MainThreadCell<
    Option<block2::RcBlock<dyn Fn(std::ptr::NonNull<objc2_app_kit::NSEvent>) -> *mut objc2_app_kit::NSEvent>>,
> = MainThreadCell(std::sync::Mutex::new(None));

#[cfg(target_os = "macos")]
static GLOBAL_MONITOR: MainThreadCell<Option<objc2::rc::Retained<objc2::runtime::AnyObject>>> =
    MainThreadCell(std::sync::Mutex::new(None));

#[cfg(target_os = "macos")]
static GLOBAL_MONITOR_BLOCK: MainThreadCell<
    Option<block2::RcBlock<dyn Fn(std::ptr::NonNull<objc2_app_kit::NSEvent>)>>,
> = MainThreadCell(std::sync::Mutex::new(None));

#[cfg(target_os = "macos")]
static DOUBLE_CTRL_STATE: std::sync::OnceLock<std::sync::Arc<DoubleCtrlState>> =
    std::sync::OnceLock::new();

#[cfg(target_os = "macos")]
fn is_modifier_keycode(keycode: i64) -> bool {
    matches!(keycode, 55 | 56 | 58 | 59 | 60 | 61 | 62 | 63)
}

#[cfg(target_os = "macos")]
fn handle_control_press(
    app: &tauri::AppHandle,
    state: &DoubleCtrlState,
    now: std::time::Instant,
) {
    if !QUICK_ADD_ENABLED.load(std::sync::atomic::Ordering::Acquire) {
        return;
    }

    let mut trigger = false;
    if let Ok(mut last) = state.last_press.lock() {
        if let Some(prev) = *last {
            if now.duration_since(prev).as_millis() < 500 {
                trigger = true;
                *last = None;
            } else {
                *last = Some(now);
            }
        } else {
            *last = Some(now);
        }
    }

    if trigger {
        toggle_quick_add_overlay(app);
    }
}

#[cfg(target_os = "macos")]
fn double_ctrl_state() -> std::sync::Arc<DoubleCtrlState> {
    DOUBLE_CTRL_STATE
        .get_or_init(|| {
            std::sync::Arc::new(DoubleCtrlState {
                last_press: std::sync::Mutex::new(None),
                control_down: std::sync::Mutex::new(false),
                permission_logged: std::sync::Mutex::new(false),
            })
        })
        .clone()
}

#[cfg(target_os = "macos")]
fn reset_double_ctrl_state(state: &DoubleCtrlState) {
    if let Ok(mut last) = state.last_press.lock() {
        *last = None;
    }
    if let Ok(mut down) = state.control_down.lock() {
        *down = false;
    }
}

#[cfg(target_os = "macos")]
fn handle_nsevent(
    event: &objc2_app_kit::NSEvent,
    app: &tauri::AppHandle,
    state: &DoubleCtrlState,
) {
    use objc2_app_kit::{NSEventModifierFlags, NSEventType};

    match event.r#type() {
        NSEventType::KeyDown => {
            if !is_modifier_keycode(event.keyCode() as i64) {
                if let Ok(mut last) = state.last_press.lock() {
                    *last = None;
                }
            }
        }
        NSEventType::FlagsChanged => {
            let ctrl_down = event
                .modifierFlags()
                .contains(NSEventModifierFlags::Control);
            let was = state
                .control_down
                .lock()
                .map(|g| *g)
                .unwrap_or(false);

            if ctrl_down && !was {
                handle_control_press(app, state, std::time::Instant::now());
            }

            if let Ok(mut guard) = state.control_down.lock() {
                *guard = ctrl_down;
            }
        }
        _ => {}
    }
}

#[cfg(target_os = "macos")]
fn sync_hotkey_active_flag() {
    let local = LOCAL_MONITOR
        .0
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|_| ()))
        .is_some();
    let global = GLOBAL_MONITOR
        .0
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|_| ()))
        .is_some();
    HOTKEY_ACTIVE.store(
        local || global,
        std::sync::atomic::Ordering::Release,
    );
}

#[cfg(target_os = "macos")]
fn remove_monitor(
    monitor_cell: &MainThreadCell<Option<objc2::rc::Retained<objc2::runtime::AnyObject>>>,
) {
    use objc2_app_kit::NSEvent;

    if let Ok(mut guard) = monitor_cell.0.lock() {
        if let Some(monitor) = guard.take() {
            unsafe {
                NSEvent::removeMonitor(&monitor);
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn remove_hotkey_monitors() {
    remove_monitor(&LOCAL_MONITOR);
    remove_monitor(&GLOBAL_MONITOR);
    if let Ok(mut block) = LOCAL_MONITOR_BLOCK.0.lock() {
        *block = None;
    }
    if let Ok(mut block) = GLOBAL_MONITOR_BLOCK.0.lock() {
        *block = None;
    }
    HOTKEY_ACTIVE.store(false, std::sync::atomic::Ordering::Release);
}

#[cfg(target_os = "macos")]
fn install_local_hotkey_monitor(app: &tauri::AppHandle) -> bool {
    use block2::RcBlock;
    use objc2_app_kit::{NSEvent, NSEventMask};

    if LOCAL_MONITOR
        .0
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|_| ()))
        .is_some()
    {
        return true;
    }

    if !QUICK_ADD_ENABLED.load(std::sync::atomic::Ordering::Acquire) {
        return false;
    }

    let state = double_ctrl_state();
    reset_double_ctrl_state(&state);

    let app_cb = app.clone();
    let state_cb = state.clone();
    let block = RcBlock::new(
        move |event_ptr: std::ptr::NonNull<NSEvent>| -> *mut NSEvent {
            let event = unsafe { event_ptr.as_ref() };
            handle_nsevent(event, &app_cb, &state_cb);
            event_ptr.as_ptr()
        },
    );

    let mask = NSEventMask::FlagsChanged | NSEventMask::KeyDown;
    let monitor = unsafe { NSEvent::addLocalMonitorForEventsMatchingMask_handler(mask, &block) };
    match monitor {
        Some(monitor) => {
            if let Ok(mut stored_block) = LOCAL_MONITOR_BLOCK.0.lock() {
                *stored_block = Some(block);
            }
            if let Ok(mut stored_monitor) = LOCAL_MONITOR.0.lock() {
                *stored_monitor = Some(monitor);
            }
            sync_hotkey_active_flag();
            true
        }
        None => false,
    }
}

#[cfg(target_os = "macos")]
fn install_global_hotkey_monitor(app: &tauri::AppHandle) -> bool {
    use block2::RcBlock;
    use objc2_app_kit::{NSEvent, NSEventMask};

    if GLOBAL_MONITOR
        .0
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|_| ()))
        .is_some()
    {
        return true;
    }

    if !QUICK_ADD_ENABLED.load(std::sync::atomic::Ordering::Acquire) {
        return false;
    }

    register_accessibility_client();

    let state = double_ctrl_state();
    let app_cb = app.clone();
    let state_cb = state.clone();
    let block = RcBlock::new(move |event_ptr: std::ptr::NonNull<NSEvent>| {
        let event = unsafe { event_ptr.as_ref() };
        handle_nsevent(event, &app_cb, &state_cb);
    });

    let mask = NSEventMask::FlagsChanged | NSEventMask::KeyDown;
    match NSEvent::addGlobalMonitorForEventsMatchingMask_handler(mask, &block) {
        Some(monitor) => {
            if let Ok(mut stored_block) = GLOBAL_MONITOR_BLOCK.0.lock() {
                *stored_block = Some(block);
            }
            if let Ok(mut stored_monitor) = GLOBAL_MONITOR.0.lock() {
                *stored_monitor = Some(monitor);
            }
            sync_hotkey_active_flag();
            true
        }
        None => {
            if let Ok(mut logged) = state.permission_logged.lock() {
                if !*logged {
                    *logged = true;
                    emit_quick_add_permission_needed(app);
                }
            }
            false
        }
    }
}

#[cfg(target_os = "macos")]
fn install_hotkey_monitors(app: &tauri::AppHandle) -> bool {
    let local = install_local_hotkey_monitor(app);
    let global = install_global_hotkey_monitor(app);
    local || global
}

#[cfg(target_os = "macos")]
fn ensure_double_ctrl_hotkey(app: tauri::AppHandle) {
    if !QUICK_ADD_ENABLED.load(std::sync::atomic::Ordering::Acquire) {
        remove_hotkey_monitors();
        return;
    }

    let app_install = app.clone();
    let _ = app.run_on_main_thread(move || {
        let _ = install_hotkey_monitors(&app_install);
    });
}

#[cfg(target_os = "macos")]
fn schedule_quick_add_hotkey_retries(app: tauri::AppHandle) {
    for delay_ms in [300_u64, 1_500, 5_000] {
        let app_retry = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
            let app_main = app_retry.clone();
            let app_install = app_main.clone();
            let _ = app_main.run_on_main_thread(move || {
                let _ = install_hotkey_monitors(&app_install);
            });
        });
    }
}

#[cfg(not(target_os = "macos"))]
fn ensure_double_ctrl_hotkey(_app: tauri::AppHandle) {}

#[cfg(not(target_os = "macos"))]
fn schedule_quick_add_hotkey_retries(_app: tauri::AppHandle) {}

#[cfg(not(target_os = "macos"))]
fn remove_hotkey_monitors() {}

#[derive(Serialize)]
struct QuickAddStatus {
    trusted: bool,
    hotkey_active: bool,
    enabled: bool,
}

#[tauri::command]
fn get_quick_add_status() -> QuickAddStatus {
    #[cfg(target_os = "macos")]
    {
        QuickAddStatus {
            trusted: accessibility_is_trusted(),
            hotkey_active: HOTKEY_ACTIVE.load(std::sync::atomic::Ordering::Acquire),
            enabled: QUICK_ADD_ENABLED.load(std::sync::atomic::Ordering::Acquire),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        QuickAddStatus {
            trusted: true,
            hotkey_active: false,
            enabled: false,
        }
    }
}

/// User preference from Settings → Permissions toggle.
#[tauri::command]
fn set_quick_add_enabled(app: tauri::AppHandle, enabled: bool) {
    #[cfg(target_os = "macos")]
    {
        QUICK_ADD_ENABLED.store(enabled, std::sync::atomic::Ordering::Release);
        let app_main = app.clone();
        let _ = app.run_on_main_thread(move || {
            if enabled {
                let _ = install_hotkey_monitors(&app_main);
            } else {
                remove_hotkey_monitors();
                hide_quick_add_overlay(&app_main);
            }
        });
    }
    let _ = (app, enabled);
}

/// Start the global double-Ctrl listener after Accessibility is granted (idempotent).
#[tauri::command]
fn ensure_quick_add_hotkey(app: tauri::AppHandle) -> bool {
    #[cfg(target_os = "macos")]
    {
        if !QUICK_ADD_ENABLED.load(std::sync::atomic::Ordering::Acquire) {
            remove_hotkey_monitors();
            return false;
        }

        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        let app_main = app.clone();
        let _ = app.run_on_main_thread(move || {
            let ok = install_hotkey_monitors(&app_main);
            let _ = tx.send(ok);
        });

        rx.recv_timeout(std::time::Duration::from_millis(500))
            .unwrap_or(false)
            || HOTKEY_ACTIVE.load(std::sync::atomic::Ordering::Acquire)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        false
    }
}
