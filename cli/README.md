# @lumina/cli

Command-line interface for LUMINA — a terminal client for the same REST API the web app uses. Manage projects and run image/video/3D/audio generations without leaving the terminal.

## Install

From the repo root:

```bash
cd cli
npm install
npm run build
npm link       # makes the `lumina` command available globally on your machine
```

`npm link` symlinks this package so `lumina` resolves system-wide, pointing at your local build. Run `npm run build` again after pulling changes.

By default the CLI talks to `http://localhost:5000`. To point it at a deployed backend:

```bash
lumina config set-api-url https://your-backend.up.railway.app
```

## Usage

```bash
# Auth
lumina login                     # interactive — prompts for email + password
lumina whoami
lumina logout

# Projects
lumina projects list
lumina projects create "My Project" --description "optional"
lumina projects delete <id>

# Generate (all default to watching until done — add --no-watch to just queue and return)
lumina generate image "a red fox in the snow" --project <id>
lumina generate image "a red fox" --project <id> --style photorealistic --aspect-ratio 16:9 --output fox.png

lumina generate video "a mountain timelapse" --project <id> --ratio 1280:720 --duration 5

lumina generate model "a leather messenger bag" --project <id> --topology triangle --pbr

lumina generate audio "Hello, welcome to Lumina." --project <id> --voice-id 21m00Tcm4TlvDq8ikWAM

# Check on past generations
lumina generations list --project <id>
lumina generations status <generationId>
lumina generations watch <generationId>   # poll a generation you queued earlier with --no-watch

# Config
lumina config show
lumina config set-api-url <url>
```

## Scripting / CI

Skip the interactive login by setting environment variables instead — they take precedence over the saved config file:

```bash
LUMINA_API_URL=https://your-backend.up.railway.app \
LUMINA_TOKEN=<a JWT from a prior login> \
lumina generate image "a fox" --project <id> --no-watch
```

## Notes

- Login credentials are stored in `~/.lumina/config.json` (file permissions `0600` — readable only by your user).
- `--output` saves image/audio generations directly (they're returned as embedded base64 data). Video and 3D generations return a hosted URL instead — the CLI prints it rather than downloading, since decoding isn't needed there.
- 3D generation is a two-stage pipeline (preview mesh, then textured refine) and can take several minutes; the default `--no-watch`-off (i.e. watching) behavior has a generous timeout to match.
