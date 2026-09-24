// The Go module covers the terminal player in cmd/rgboo/. It lives at the
// repo root so plain `vX.Y.Z` tags are enough for
// `go install github.com/nrodd/rgboo/cmd/rgboo@latest`; a nested module would
// need `cmd/rgboo/vX.Y.Z` tags and a GoReleaser Pro monorepo config.
module github.com/nrodd/rgboo

go 1.24
