//! The decision itself. Yours to write.
//!
//! Contract:
//! - Return the kinds in `KINDS` order, no duplicates.
//! - Plain chat, chit-chat ("thanks", "ok") and system lines (text starting with `(`) are no kinds.
//! - Stay fast: this runs before every request. Target well under 5 ms.
//! - Set `confidence` honestly. While it is low, the regex router decides, so a guess costs nothing.
//!
//! v0 target: give the same answers as `jobKinds()` in showcase/tauri/sidecar/route.mjs.
//! `cargo test` checks that against tests/cases.jsonl. v1 replaces this with embeddings + kNN over traces.

use crate::{Decision, Request};

pub fn decide(_req: &Request) -> Decision {
    // Stub: "not sure", so the regex router keeps deciding. Replace with your logic.
    Decision { kinds: vec![], confidence: 0.0 }
}
