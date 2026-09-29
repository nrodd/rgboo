#!/bin/sh
# Install the rgboo terminal player.
#
#   curl -fsSL https://rgboo.com/install.sh | sh
#
# Env knobs:
#   RGBOO_VERSION      tag to install (default: the latest release)
#   RGBOO_INSTALL_DIR  where the binary goes (default: /usr/local/bin if
#                      writable, otherwise ~/.local/bin)
set -eu

REPO="nrodd/rgboo"
BIN="rgboo"

say() { printf '%s\n' "$*"; }
err() { printf 'install: %s\n' "$*" >&2; exit 1; }

need() {
	command -v "$1" >/dev/null 2>&1 || err "$1 is required but not installed."
}

need curl
need tar

# --- what are we installing for -----------------------------------------------

os=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$os" in
	darwin | linux) ;;
	*) err "unsupported OS '$os'. Build from source: go install github.com/nrodd/rgboo/cmd/rgboo@latest" ;;
esac

arch=$(uname -m)
case "$arch" in
	x86_64 | amd64) arch=amd64 ;;
	arm64 | aarch64) arch=arm64 ;;
	*) err "unsupported architecture '$arch'." ;;
esac

# --- which version ------------------------------------------------------------

version="${RGBOO_VERSION:-}"
if [ -z "$version" ]; then
	# Follow the /releases/latest redirect rather than hitting the API, which
	# rate-limits unauthenticated callers hard.
	version=$(curl -fsSLI -o /dev/null -w '%{url_effective}' \
		"https://github.com/$REPO/releases/latest" | sed 's#.*/tag/##')
	[ -n "$version" ] || err "could not work out the latest version. Set RGBOO_VERSION."
fi
number=${version#v}

archive="${BIN}_${number}_${os}_${arch}.tar.gz"
base="https://github.com/$REPO/releases/download/$version"

# --- where does it go ---------------------------------------------------------

dir="${RGBOO_INSTALL_DIR:-}"
if [ -z "$dir" ]; then
	if [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then
		dir=/usr/local/bin
	else
		dir="$HOME/.local/bin"
	fi
fi
mkdir -p "$dir" || err "cannot create $dir. Set RGBOO_INSTALL_DIR to somewhere writable."
[ -w "$dir" ] || err "$dir is not writable. Set RGBOO_INSTALL_DIR to somewhere writable."

# --- fetch, verify, install ---------------------------------------------------

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM

say "Downloading $BIN $version ($os/$arch)..."
curl -fsSL "$base/$archive" -o "$tmp/$archive" ||
	err "download failed: $base/$archive"

# Checksums ship with every release; a silently truncated download is worse
# than a loud failure.
if curl -fsSL "$base/checksums.txt" -o "$tmp/checksums.txt" 2>/dev/null; then
	want=$(grep " $archive\$" "$tmp/checksums.txt" | awk '{print $1}')
	if [ -n "$want" ]; then
		if command -v sha256sum >/dev/null 2>&1; then
			got=$(sha256sum "$tmp/$archive" | awk '{print $1}')
		elif command -v shasum >/dev/null 2>&1; then
			got=$(shasum -a 256 "$tmp/$archive" | awk '{print $1}')
		else
			got=""
		fi
		[ -z "$got" ] || [ "$got" = "$want" ] ||
			err "checksum mismatch for $archive. Aborting."
	fi
fi

tar -xzf "$tmp/$archive" -C "$tmp" "$BIN" || err "could not unpack $archive."
chmod +x "$tmp/$BIN"
mv "$tmp/$BIN" "$dir/$BIN"

say "Installed $dir/$BIN"

# --- the bits we can't install for you ----------------------------------------

missing=""
command -v mpv >/dev/null 2>&1 || missing="mpv"
command -v yt-dlp >/dev/null 2>&1 || missing="${missing:+$missing }yt-dlp"
if [ -n "$missing" ]; then
	say ""
	say "Still needed: $missing"
	if [ "$os" = "darwin" ]; then
		say "  brew install $missing"
	elif command -v apt >/dev/null 2>&1; then
		say "  sudo apt install $missing"
	elif command -v dnf >/dev/null 2>&1; then
		say "  sudo dnf install $missing"
	elif command -v pacman >/dev/null 2>&1; then
		say "  sudo pacman -S $missing"
	else
		say "  install them with your package manager"
	fi
fi

case ":$PATH:" in
	*":$dir:"*) ;;
	*)
		say ""
		say "$dir is not on your PATH. Add it:"
		say "  export PATH=\"$dir:\$PATH\""
		;;
esac

say ""
say "Run: $BIN"
