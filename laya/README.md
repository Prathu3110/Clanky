# Laya

Clanky's gate. It runs before the model on every request and decides what kind of job it is (computer use, code,
background agents, drawing, web research, or plain chat), so the right model answers and later only the tools and
memories that job needs get sent.

## How it runs

`laya` is a small Rust binary. The sidecar (`showcase/tauri/sidecar/laya.mjs`) keeps one running and talks to it over
stdio, one JSON line each way:

```text
→ {"text":"message mum on whatsapp","app":"net.whatsapp.WhatsApp","recent_tools":["read_window"]}
← {"kinds":["computer"],"confidence":0.8}
```

It must answer within 50 ms, or the sidecar ignores it. If it's missing, crashes or answers late, nothing breaks.

## What it decides (now)

The regex router reads one request's words and nothing else, so a follow-up ("do that again", "change it back")
looks like plain chat. Laya gets the previous turn's tools (only if that turn was under 10 minutes ago) and, when the
request is a continuation, carries that job's kinds over at confidence 0.7. The sidecar adds them to the regex
router's kinds: Laya can add a kind, never remove one. `run_command` counts as computer use unless the turn also
wrote a file, since in the trace it was mostly driving the Mac, not coding.

Every request goes to `~/Clanky/Data/laya-trace.jsonl` with `truth`: the kinds of the tools the turn really used.

```sh
node laya/eval.mjs        # accuracy of regex vs regex + Laya on your trace, and Laya's latency
```

## Build and install

```sh
cd laya && cargo build --release
mkdir -p ~/Clanky/bin && ln -sf "$PWD/target/release/laya" ~/Clanky/bin/laya
```

The sidecar looks for `$CLANKY_LAYA_BIN`, then `~/Clanky/bin/laya`.

## Roadmap

1. **v0 (done):** follow-ups carry the last job's kinds (`src/decide.rs`, `cargo test`).
2. **v1:** a small local embedding model plus kNN over the trace: your past requests decide new ones.
3. Tool and memory trimming by kind.
4. **Lighter:** a smaller backbone once the trace shows what accuracy is needed.
