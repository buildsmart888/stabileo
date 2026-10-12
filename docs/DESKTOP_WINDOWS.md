# GO Structural Analysis Desktop (Stabileo AGPL-3.0)
This is an open-source prototype, not a certified production structural design package.

## Windows build
Install Node.js 20+, Git, Rust stable, Microsoft C++ Build Tools, WebView2, wasm-pack.

PowerShell:
    rustup toolchain install stable
    rustup target add wasm32-unknown-unknown --toolchain stable
    cargo install wasm-pack --locked
    cd web
    npm install
    npm run wasm
    npm run desktop:smoke
    npm run desktop:build

## Commands and recovery
Open: Ctrl+O, Save: Ctrl+S, Save As: Ctrl+Shift+S; use desktop toolbar.
Original .ded validated loader is used. Saving keeps .ded.bak on overwrites.
Periodic recovery snapshots are in Tauri per-app local data directory.
The user must opt-in to restore a recovery snapshot.

## Validation
Real WASM build is mandatory and no stub is permitted in desktop production.
Rust engine tests, reference fixture checks, and Tauri installer builds are separate gates.
Offline behavior and actual WebView2 calculations still require human Windows acceptance.
AI services that require external providers do not work offline.

## License
The combined desktop prototype remains AGPL-3.0. Retain the root LICENSE,
the desktop NOTICE-AGPL.txt, source availability, and third-party notices.
Do not attach closed-source modules without separate legal review.
