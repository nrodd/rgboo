# rgboo (terminal player)

Streams the [RGBoo live broadcast](https://www.youtube.com/live/KbZBcBE0Nw4) to
your speakers and draws a small animated scene while it plays: a witch flying
her broom under the moon, trees drifting past below. The witch is tinted with
the latest LED color, and the username who requested it plus the current and
previous track sit underneath. It animates in place rather than logging every
change, all fed by the rgboo now-playing stream.

A single Go binary. Playback is [mpv](https://mpv.io), which pulls the stream
through [yt-dlp](https://github.com/yt-dlp/yt-dlp); both are system
dependencies, and Homebrew installs them for you.

## Install

**macOS (Homebrew)** -- brings mpv and yt-dlp with it:

```sh
brew install nrodd/tap/rgboo
```

**macOS or Linux (script)**:

```sh
curl -fsSL https://rgboo.com/install.sh | sh
```

`RGBOO_INSTALL_DIR` picks the install location, `RGBOO_VERSION` pins a tag.
You'll need to install mpv and yt-dlp yourself; the script tells you how.

**From source** (needs Go 1.24+):

```sh
go install github.com/nrodd/rgboo/cmd/rgboo@latest
```

Windows binaries are on the [releases
page](https://github.com/nrodd/rgboo/releases).

## Listen

```sh
rgboo
```

Ctrl-C to stop. The scene runs in the alternate screen buffer, so your terminal
comes back exactly as you left it.

## Staging vs production

Production is the default. To listen to the staging Durable Object
(`https://staging.rgboo.com/api/stream`) instead, pass `--staging`:

```sh
rgboo --staging
```

staging.rgboo.com is behind Cloudflare Access, so that also needs a service
token in `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`. For anything else
(a preview deploy, a local worker), set a full URL in `RGBOO_STREAM_URL`, which
overrides the flag.

The same feed by hand:

```sh
curl -N https://rgboo.com/api/stream
```

## Development

```sh
go run ./cmd/rgboo        # from the repo root
go test ./cmd/...
```

Piping the output somewhere that isn't a terminal drops the animation and
prints one line per track change instead, so `rgboo | tee log` stays readable.

## Releasing

Actions -> **release rgboo** -> **Run workflow**, then type the version
(`v0.1.1`). The tag is created by the workflow, from `main`, which is the whole
point: a local `git tag` can silently land on an unmerged branch, and this
can't. [`.github/workflows/release-rgboo.yaml`](../../.github/workflows/release-rgboo.yaml)
then runs [GoReleaser](https://goreleaser.com) and does the rest.

Pushing a tag by hand still works, and still releases:

```sh
git tag v0.1.1 && git push origin v0.1.1
```

Either way the version must be `vX.Y.Z` (optionally `-rc.1`) and must not
already exist. Versions are never reused.

That builds macOS/Linux/Windows binaries, attaches them to a GitHub release
with checksums, and pushes an updated cask to `nrodd/homebrew-tap`. Dry run the
whole thing locally with:

```sh
goreleaser release --snapshot --clean
```

The tap push needs a `HOMEBREW_TAP_TOKEN` repo secret: a PAT with
`contents:write` on `nrodd/homebrew-tap`. The default `GITHUB_TOKEN` can't
reach another repository.
