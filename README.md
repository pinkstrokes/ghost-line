# GHOST LINE

![GHOST LINE](docs/screens/og.png)

**Play: https://us.pinkstrokes.com**

A two-player voice co-op infiltration game. One player is **GHOST**, sneaking through the abandoned secret facility KESTREL-9 in first person. The other is **LINE**, sitting in a surveillance van (also in first person) with the facility blueprints, tapped CCTV cameras, a terminal patched into the building's control system and a paper cipher wheel.

GHOST can see every detail of the security systems but doesn't know how to beat them. LINE knows how, and can see what GHOST can't (infra-red lasers, light beams, thermal imaging, motion sensors), but can't move. You have to talk your way through every zone.

Design document (Chinese): [docs/DESIGN.md](docs/DESIGN.md)

| | |
|---|---|
| ![Title screen](docs/screens/title.png) | ![LINE's van](docs/screens/line-van.png) |
| ![LINE's IR monitor](docs/screens/line-ir-hall.png) | ![LINE's thermal view](docs/screens/line-thermal-spine.png) |
| ![GHOST reading a bulkhead in the smoke](docs/screens/ghost-smoke.png) | ![Acoustic scope](docs/screens/line-scope.png) |
| ![Patch frame](docs/screens/ghost-patch-frame.png) | ![Blueprint E-1](docs/screens/blueprint-E1.png) |
| ![Vault dial](docs/screens/ghost-vault-dial.png) | ![GHOST at the service door](docs/screens/ghost-gate.png) |

## Play online

https://us.pinkstrokes.com (Hetzner, Caddy reverse proxy plus a self-hosted coturn relay, so in-game voice works across the internet). After changing the code, redeploy with `scripts/deploy.sh`.

## Run it yourself

Requires Node.js 20+.

```bash
npm install
npm start
```

The server prints two addresses:

- This machine: `http://localhost:8080`
- Another computer on your LAN: `https://<your-LAN-IP>:8443` (self-signed certificate: accept the warning once. Browsers only allow the microphone over https.)

Only one computer needs to run the server. The self-signed certificate is generated with the system `openssl`; on Windows without openssl, https is disabled, so in-game voice won't work for the LAN partner. Use Discord instead; the game itself still connects.

One player clicks **HOST OPERATION** and gives the 4-letter operation code to their partner, who types it in and clicks **JOIN**. Pick roles (GHOST / LINE; **SWAP SEATS** switches them), both click **READY**, then **START OPERATION**. Two browser windows on the same computer work too, for testing or to learn both sides.

In-game radio: hold **V** to talk (LINE can also hold Option/Alt, which keeps working while typing in the terminal). **SETTINGS** can switch to an open mic, or turn in-game voice off so you can use Discord or sit in the same room. **RADIO CHECK** in the lobby tests your mic. Voice is WebRTC (the online version has its own TURN relay). Note: with in-game voice, the creature in Z4/Z7 can hear the radio. That's part of the game; on Discord it can't.

Paper blueprints: the lobby has a "print this mission's blueprints" link (`/blueprint.html?seed=…`, also reachable from **PRINT BLUEPRINTS** on the title screen), with an ink-saver option for white paper. Blueprints change with every seed, so an old printout won't match a new mission.

## Controls

**GHOST**: WASD move · mouse look · Shift run (loud) · C crouch (quiet) · Space jump · F torch · E inspect / use (mirrors: E clockwise, Q anticlockwise) · Tab raise your watch · V talk

**LINE**: mouse look · click a station to lean in · right-click / Esc sit back · M monitors · T terminal · Tab blueprints · V talk
- Monitors: 1–0 pick a camera, I infra-red / thermal, arrows or drag to pan and tilt, wheel to zoom, click a side screen to swap it to the main one, P pins the side screens
- Blueprints: drag to pan, wheel to zoom, Shift+drag red pencil, Z undo, X clear this sheet, F fit, 1–7 change sheet (00 cover / A-1 site / A-2 access / E-1 patch frame / M-1 undercroft / O-1 optics / V-1 vault)
- Terminal: just type (HELP lists commands); F1–F6, `[` `]` or click a tab to switch programs
- Cipher wheel: drag or ←/→ to turn the inner disc

## The seven zones

| | GHOST | LINE |
|---|---|---|
| Z1 Gatehouse | Describes the 3 symbols and the lamp colour on the access plate; works out the 4th digit from the SOP sheet in the guard booth | Looks up the first 3 digits in the code table on A-2 (watch out for the void REV A) |
| Z2 Laser Hall | Can't see the lasers; follows directions (lanes A–D, row numbers, crouch, jump) | IR cameras show the beams and their blink / sweep timing |
| Z3 Substation | Reads the frame number, patches three jumper cables | Finds the matching diagram on E-1 and traces it; closes the breaker in the terminal |
| Z4 Undercroft | Pitch-dark maze: reads junction codes, avoids the creature (it hears the radio) | Map M-1, opens/closes dampers in the terminal (max 2 at once), watches the motion sensors |
| Z5 Optics Lab | Reports which two wall ports have a blinking lamp, turns mirrors | Ceiling IR camera shows the beam; light both receivers at once |
| Z6 Vault | Reads the model plate, calls out numbers where the dial drags, presses SET | V-1 gives wheel directions and the true-gate signature; watches the acoustic scope |
| Z7 Escape | Almost blind in the smoke, reads bulkhead symbols, something is following | Thermal cameras guide GHOST and track the creature; the cipher wheel opens each bulkhead; calls the lift |

A mistake raises the alert level (the first wrong gate code is only a warning). Max out the alert level, or run out of time, and the mission fails. Each zone has a par time, shown as ahead/behind on GHOST's watch, LINE's terminal and the end screen. Three difficulties: RECRUIT / OPERATIVE / GHOST. The lobby can also start a single zone for practice.

## About the project

The hardest part was making every puzzle need both players while keeping it solvable, so all seven zones are generated from a seed and a script solves 2,000 seeds to check both sides are required; the laser grid also had to be redesigned because seven gates blurred into one mesh on the camera feed. The most fun came from the creature hearing the radio, which forces LINE to whisper the answers. The main lesson was that automated tests pass while real players still get stuck: the first playtest found a backwards avatar, a broken plug drag and a vault nobody could read. Next is a mode where several LINE + GHOST teams enter the same facility and race for one core, with radios the other teams can listen in on.

## Development

```bash
npm run dev        # Vite (5233) + websocket server (8091)
npm run verify     # seeds: every zone is solvable + a full scripted mission runs through
node scripts/e2e.mjs http://localhost:5233 /tmp/gl-e2e   # two headless browsers play from lobby to extraction (needs npm run dev)
node scripts/sheets.mjs SEED /tmp/sheets                  # export the 7 blueprint sheets as PNGs (BASE=http://localhost:8080 to point elsewhere)
node scripts/qa-new.mjs http://localhost:8080 /tmp/gl-qa  # screenshots of the newer mechanics
```

Layout: `shared/` is pure logic used by both server and browser (mission generation, the room state machine, the optics simulation); `server/` serves static files and the websocket; `src/facility` is the facility and GHOST's view; `src/zones` the seven zones; `src/van` the van, CCTV, terminal and blueprint viewer; `src/blueprint` draws the blueprints. Every model, texture and sound is generated in code: no asset files, no external APIs.
