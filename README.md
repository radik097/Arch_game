# Arch Trainer MVP

Arch Trainer is a safe environment to learn the logic of a real Arch Linux installation before trying it on real hardware or a virtual machine. This MVP focuses on a single realistic UEFI installation path, terminal-first interaction, and a simulation core that validates commands against system state instead of accepting them as static puzzles.

The client is intentionally forkable, mirrorable, and runnable anywhere. Official leaderboard influence is restricted to server-issued sessions that pass fork verification, build proof validation, hash-chained replay checks, and deterministic server-side re-simulation.

## MVP scope

- Guided UEFI install path from live ISO to reboot
- Difficulty modes: beginner, experienced, expert, god
- Stateful validation for partitioning, formatting, mounting, pacstrap, chroot, configuration, bootloader, and reboot
- Beginner teaching notes in Russian and English
- Expert and god mode network recovery event via `iwctl`

## Commands

```bash
npm install
npm run dev
npm run test
npm run build
```

## Architecture

- `src/features/simulator`: parser-adjacent command execution, state transitions, and objective derivation
- `src/features/terminal`: terminal viewport and input loop
- `src/features/session`: official session client, build identity loader, replay submission logic
- `src/features/layout`: objective and status panels
- `src/shared/replay.ts`: replay/session contracts shared by browser and validation server
- `server/replayValidator.ts`: deterministic anti-cheat replay validation
- `server/verification.ts`: GitHub fork verification, player registration, build proof checks
- `server/index.ts`: replay API for session start, replay submission, and leaderboard reads
- `server/storage/fileStore.ts`: file-backed persistence for sessions, replays, and leaderboard entries
- `scripts/generate-build-proof.mjs`: computes `build_hash`, updates `archtrainer.config.json`, and writes `build_proof.json`

## Validation pipeline

```text
Forked client anywhere
	-> loads archtrainer.config.json + build_proof.json
	-> POST /api/start-session
	-> receives session_id, session_key, seed, expiry

Browser client
	-> records command hash chain locally
	-> POST /api/submit-replay
	-> sends replay log only

Validation server
	-> verifies GitHub fork + repo config + signed build proof
	-> verifies session TTL and one-shot token use
	-> verifies replay hash chain and timing sanity
	-> replays commands against deterministic simulator
	-> persists replay JSON
	-> stores verified leaderboard entry
```

## Official fork workflow

1. Fork the repo on GitHub.
2. Register the fork with the official server:

```bash
curl -X POST http://localhost:8787/api/register-player \
  -H 'Content-Type: application/json' \
  -d '{"githubRepo":"https://github.com/your-user/archtrainer-fork"}'
```

3. Fill `archtrainer.config.json` with the returned `player_id`, your fork repo URL, and a fork name.
4. Export the returned player secret before building:

```bash
export ARCH_TRAINER_PLAYER_SECRET="returned-secret"
```

5. Build the client. The build step automatically generates `build_proof.json` and refreshes `build_hash` in `archtrainer.config.json`:

```bash
npm run build
```

6. Start a run from the terminal UI. If the fork config and build proof pass server verification, the run is official. Otherwise the client falls back to local sandbox mode and cannot affect the leaderboard.

## Replay API

`POST /api/register-player`

```json
{
  "githubRepo": "https://github.com/user/archtrainer-fork"
}
```

`POST /api/start-session`

```json
{
	"difficulty": "expert",
	"version": "0.1.0",
	"verification": {
		"playerId": "player-id",
		"githubRepo": "user/archtrainer-fork",
		"forkName": "rod_archfork",
		"config": {},
		"buildProof": {}
	}
}
```

`POST /api/submit-replay`

```json
{
	"version": "1.0",
	"difficulty": "expert",
	"sessionId": "session-id",
	"seed": "session-seed",
	"playerId": "player-id",
	"githubRepo": "user/archtrainer-fork",
	"buildHash": "sha256-build-hash",
	"buildId": "build-id",
	"commands": [
		{ "cmd": "lsblk", "tGameMs": 1200, "tUnixMs": 1200, "hash": "sha256-chain-hash" }
	]
}
```

`GET /api/leaderboard?difficulty=expert`

## Local vs official mode

- Local mode: any fork, mirror, static host, or offline browser run. The client stays fully usable, but no leaderboard write is possible.
- Official mode: requires registered GitHub fork, populated `archtrainer.config.json`, signed `build_proof.json`, valid server session, and an accepted replay.
- Server authority: the browser never sends a trusted score. The server recomputes outcome, official time, install hash, and leaderboard admission.

## Intentional abstractions

- `fdisk /dev/nvme0n1` is modeled as a guided action in this MVP rather than a full interactive partition editor.
- Locale configuration is compressed into `locale-gen` for MVP speed; a fuller simulator should model editing `locale.gen` and `locale.conf`.
- The current production target is a single browser client with the simulation core isolated from the UI for later expansion.

## Commands

```bash
npm install
npm run dev
npm run start:server
npm run dev:server
npm run test
npm run build
```