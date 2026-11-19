// v0 target: decide() gives the same kinds as the regex router (route.mjs jobKinds) on every case in cases.jsonl.
// Regenerate the cases after changing route.mjs: node laya/tests/gen-cases.mjs
use laya::{decide, Request};

#[test]
fn matches_regex_router() {
    let mut misses = vec![];
    let cases = include_str!("cases.jsonl");
    for line in cases.lines().filter(|l| !l.trim().is_empty()) {
        let case: serde_json::Value = serde_json::from_str(line).unwrap();
        let text = case["text"].as_str().unwrap().to_string();
        let want: Vec<String> = serde_json::from_value(case["kinds"].clone()).unwrap();
        let got = decide(&Request { text: text.clone(), ..Default::default() }).kinds;
        if got != want {
            misses.push(format!("  {text:?}: want {want:?}, got {got:?}"));
        }
    }
    let total = cases.lines().filter(|l| !l.trim().is_empty()).count();
    assert!(misses.is_empty(), "{} of {total} cases differ:\n{}", misses.len(), misses.join("\n"));
}
