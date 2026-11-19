use std::io::{self, BufRead, Write};

fn main() {
    let stdin = io::stdin();
    let mut out = io::stdout().lock();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        // Flush per line: the sidecar waits on each answer.
        if writeln!(out, "{}", laya::handle_line(&line)).and_then(|_| out.flush()).is_err() {
            break; // the sidecar went away
        }
    }
}
