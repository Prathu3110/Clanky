//! Laya: runs before the model on every request and decides what kind of job it is.
//! The sidecar (showcase/tauri/sidecar/laya.mjs) sends one JSON `Request` per line on stdin
//! and reads one JSON `Decision` per line on stdout.

use serde::{Deserialize, Serialize};

mod decide;
pub use decide::decide;

/// The job kinds, in the order the regex router checks them (route.mjs JOB_KINDS).
pub const KINDS: [&str; 5] = ["computer", "code", "agents", "draw", "web"];

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct Request {
    /// What the user said or typed, as the sidecar received it.
    pub text: String,
    /// Bundle id of the app in front, e.g. `net.whatsapp.WhatsApp`. None when unknown.
    pub app: Option<String>,
    /// Tools used in the last few turns, newest last (`act_in_app`, `run_command`, …).
    pub recent_tools: Vec<String>,
}

#[derive(Debug, Default, PartialEq, Serialize)]
pub struct Decision {
    /// Kinds this request looks like, in `KINDS` order. Empty: plain chat, the default model answers.
    pub kinds: Vec<String>,
    /// 0.0 to 1.0. Below the sidecar's threshold, Laya's answer is ignored and the regex router decides.
    pub confidence: f32,
}

/// One protocol line in, one out. A malformed line gets an `error` object instead of a decision,
/// so one bad request never kills the process.
pub fn handle_line(line: &str) -> String {
    match serde_json::from_str::<Request>(line) {
        Ok(req) => serde_json::to_string(&decide(&req)).expect("Decision always serializes"),
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}
