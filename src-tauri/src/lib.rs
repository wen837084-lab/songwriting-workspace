#[cfg(desktop)]
use tauri::{plugin::TauriPlugin, webview::PageLoadEvent, Manager, Runtime, Url};

#[cfg(desktop)]
#[derive(Debug, PartialEq, Eq)]
enum NavigationDecision {
    AllowInternal,
    OpenExternal,
    Block,
}

#[cfg(desktop)]
fn navigation_decision(url: &Url) -> NavigationDecision {
    let is_packaged_app = (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (matches!(url.scheme(), "http" | "https") && url.host_str() == Some("tauri.localhost"));
    let is_development_app = cfg!(debug_assertions)
        && url.scheme() == "http"
        && url.host_str() == Some("localhost")
        && url.port() == Some(3000);

    if is_packaged_app || is_development_app {
        NavigationDecision::AllowInternal
    } else if matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
        NavigationDecision::OpenExternal
    } else {
        NavigationDecision::Block
    }
}

#[cfg(desktop)]
fn navigation_policy<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-policy")
        .on_navigation(|_webview, url| match navigation_decision(url) {
            NavigationDecision::AllowInternal => true,
            NavigationDecision::OpenExternal => {
                let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                false
            }
            NavigationDecision::Block => false,
        })
        .build()
}

#[cfg(desktop)]
fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // Register this first so a second launch cannot initialize another app instance.
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app);
        }));

        // Restore geometry before the first paint, but never restore hidden/decorless state.
        // Visibility is controlled by the finished page-load hook to avoid startup flash.
        let window_state_flags = tauri_plugin_window_state::StateFlags::SIZE
            | tauri_plugin_window_state::StateFlags::POSITION
            | tauri_plugin_window_state::StateFlags::MAXIMIZED
            | tauri_plugin_window_state::StateFlags::FULLSCREEN;
        builder = builder
            .plugin(
                tauri_plugin_window_state::Builder::default()
                    .with_state_flags(window_state_flags)
                    .build(),
            )
            .plugin(navigation_policy());
    }

    builder
        .on_page_load(|webview, payload| {
            #[cfg(desktop)]
            if webview.label() == "main" && payload.event() == PageLoadEvent::Finished {
                let window = webview.window();
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build Songwriting Workspace")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                focus_main_window(app);
            }

            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}

#[cfg(all(test, desktop))]
mod tests {
    use super::{navigation_decision, NavigationDecision};

    #[test]
    fn packaged_and_development_urls_stay_in_the_main_webview() {
        let packaged = "http://tauri.localhost/projects/example"
            .parse()
            .expect("valid packaged URL");
        let custom_protocol = "tauri://localhost/settings"
            .parse()
            .expect("valid custom protocol URL");

        assert_eq!(
            navigation_decision(&packaged),
            NavigationDecision::AllowInternal
        );
        assert_eq!(
            navigation_decision(&custom_protocol),
            NavigationDecision::AllowInternal
        );

        if cfg!(debug_assertions) {
            let development = "http://localhost:3000/learning"
                .parse()
                .expect("valid development URL");
            assert_eq!(
                navigation_decision(&development),
                NavigationDecision::AllowInternal
            );
        }
    }

    #[test]
    fn external_web_and_contact_urls_leave_the_privileged_webview() {
        for url in [
            "https://example.com/guide",
            "http://example.com/guide",
            "mailto:hello@example.com",
            "tel:+12025550123",
        ] {
            let url = url.parse().expect("valid external URL");
            assert_eq!(navigation_decision(&url), NavigationDecision::OpenExternal);
        }
    }

    #[test]
    fn unsafe_or_unhandled_schemes_are_blocked() {
        for url in [
            "file:///tmp/song.txt",
            "javascript:alert(1)",
            "data:text/plain,hello",
        ] {
            let url = url.parse().expect("valid blocked URL");
            assert_eq!(navigation_decision(&url), NavigationDecision::Block);
        }
    }
}
