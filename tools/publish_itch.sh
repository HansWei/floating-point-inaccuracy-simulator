#!/usr/bin/env bash
# Upload the built web versions to itch.io with butler, itch.io's command-line uploader.
#
# One-time setup:
#   1. Install butler: https://itch.io/docs/butler/installing.html
#   2. Run `butler login` (opens the browser to authorise your itch.io account).
#   3. Create the project pages on itch.io first (Kind of project: HTML), see README.md.
#
# Usage, from the repository root:
#   tools/publish_itch.sh <itch-user>/<full-game-slug> [<itch-user>/<demo-slug>]
# Example:
#   tools/publish_itch.sh alice/floating-point-inaccuracy-simulator alice/floating-point-inaccuracy-simulator-demo
#
# The "html" channel name tells itch.io these uploads are playable in the browser.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -lt 1 ]; then
  sed -n '2,14p' "$0"
  exit 2
fi
command -v butler >/dev/null || { echo "butler is not installed; see the comment at the top of this script." >&2; exit 1; }

python3 tools/build.py
version="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M)"

butler push dist/full "$1:html" --userversion "$version"
if [ $# -ge 2 ]; then
  butler push dist/demo "$2:html" --userversion "$version"
fi
