// The stdio protocol: one JSON line in, one out, and a bad line never kills the process.
use laya::handle_line;

#[test]
fn answers_a_request_with_a_decision() {
    let out: serde_json::Value = serde_json::from_str(&handle_line(r#"{"text":"hi","app":null,"recent_tools":[]}"#)).unwrap();
    assert!(out["kinds"].is_array());
    assert!(out["confidence"].is_number());
}

#[test]
fn missing_fields_default() {
    let out: serde_json::Value = serde_json::from_str(&handle_line(r#"{"text":"hi"}"#)).unwrap();
    assert!(out.get("error").is_none());
}

#[test]
fn bad_json_is_an_error_line_not_a_crash() {
    let out: serde_json::Value = serde_json::from_str(&handle_line("not json")).unwrap();
    assert!(out["error"].is_string());
}
