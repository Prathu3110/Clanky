//! The decision: what the regex router can't see. jobKinds() (route.mjs) reads the words of one request; it has no
//! idea what came before, so a follow-up ("do that again", "change it back") looks like plain chat. Laya reads the
//! previous turn's tools (`recent_tools`, sent only when that turn was a few minutes ago) and, when the request is a
//! continuation, carries that job's kinds over. The sidecar adds them to the regex router's kinds (laya.mjs
//! pickKinds), so Laya can only add a kind, never take one away.
//!
//! Built from the trace (node laya/eval.mjs): on 125 requests this took exact matches from 69 to 75. In that trace
//! run_command alone was nearly always driving the Mac (close a window, flip a setting), not coding, so it counts as
//! computer use here; code is carried over only when the turn wrote a file.
//!
//! Contract: kinds in `KINDS` order, no duplicates; system lines (text starting with `(`) are no kinds; well under 5 ms.

use crate::{Decision, Request, KINDS};

/// Words that say "the same job as just now". Matched as whole words.
const CONTINUE: &[&str] = &[
    "again", "back", "instead", "redo", "undo", "go ahead", "continue", "keep going", "do it", "try again", "fix it",
    "change it", "close it", "open it", "show it", "show that", "show this", "show me it", "show me that",
    "show me this", "make it",
];

/// How sure Laya is when it carries kinds over (the sidecar acts on 0.6 and up).
const CARRY: f32 = 0.7;

fn kind_of_tool(name: &str, wrote_file: bool) -> Option<&'static str> {
    Some(match name {
        "act_in_app" | "read_window" | "list_windows" | "take_screenshot" => "computer",
        "write_file" => "code",
        "run_command" => if wrote_file { "code" } else { "computer" },
        "send_agent" => "agents",
        "draw" => "draw",
        "web_search" | "web_fetch" => "web",
        _ => return None,
    })
}

/// Lowercase words separated by single spaces, padded with a space at each end, so " phrase " finds whole words.
fn words(text: &str) -> String {
    let mut out = String::from(" ");
    for w in text.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()) {
        out.push_str(&w.to_lowercase());
        out.push(' ');
    }
    out
}

pub fn decide(req: &Request) -> Decision {
    let none = Decision { kinds: vec![], confidence: 0.0 };
    let text = req.text.trim();
    if text.is_empty() || text.starts_with('(') || req.recent_tools.is_empty() {
        return none;
    }
    let w = words(text);
    if !CONTINUE.iter().any(|p| w.contains(&format!(" {p} "))) {
        return none;
    }
    let wrote = req.recent_tools.iter().any(|t| t == "write_file");
    let carried: Vec<&str> = req.recent_tools.iter().filter_map(|t| kind_of_tool(t, wrote)).collect();
    let kinds: Vec<String> = KINDS.iter().filter(|k| carried.contains(k)).map(|k| k.to_string()).collect();
    if kinds.is_empty() {
        return none;
    }
    Decision { kinds, confidence: CARRY }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ask(text: &str, tools: &[&str]) -> Decision {
        decide(&Request { text: text.into(), app: None, recent_tools: tools.iter().map(|s| s.to_string()).collect() })
    }

    #[test]
    fn follow_up_carries_the_last_job() {
        let d = ask("Change it back again.", &["run_command"]);
        assert_eq!(d.kinds, vec!["computer"]);
        assert!(d.confidence >= 0.6);
        assert_eq!(ask("do that again", &["draw"]).kinds, vec!["draw"]);
    }

    #[test]
    fn code_only_when_a_file_was_written() {
        assert_eq!(ask("fix it", &["write_file", "run_command"]).kinds, vec!["code"]);
        assert_eq!(ask("fix it", &["run_command"]).kinds, vec!["computer"]);
    }

    #[test]
    fn kinds_in_router_order_without_duplicates() {
        assert_eq!(ask("try again", &["web_search", "draw", "act_in_app", "draw"]).kinds, vec!["computer", "draw", "web"]);
    }

    #[test]
    fn no_guess_without_a_reason() {
        assert!(ask("what's the weather like", &["draw"]).kinds.is_empty()); // not a continuation
        assert!(ask("do it again", &[]).kinds.is_empty()); // nothing before
        assert!(ask("(Reminder: stretch) again", &["draw"]).kinds.is_empty()); // system line
        assert!(ask("go back", &["open", "read_file"]).kinds.is_empty()); // tools of no kind
        assert!(ask("background music", &["draw"]).kinds.is_empty()); // whole words only
        assert_eq!(ask("go back", &["open"]).confidence, 0.0);
    }
}
