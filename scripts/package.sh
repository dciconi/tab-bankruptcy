#!/usr/bin/env bash
# Build a Chrome Web Store-ready zip of the extension.
#
# Usage:   bash scripts/package.sh
# Output:  dist/tab-bankruptcy-<version>.zip
#
# Strategy: stage every file the extension needs into dist/staging/, then zip
# the staging dir. Cross-platform — uses `zip` if available (Mac/Linux/Git
# Bash), falls back to PowerShell's Compress-Archive on Windows.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found in PATH" >&2; exit 1
fi

VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json','utf8')).version)")"
[ -n "$VERSION" ] || { echo "error: could not read version from manifest.json" >&2; exit 1; }

OUT_DIR="dist"
STAGE="$OUT_DIR/staging-$VERSION"
OUT_FILE="$OUT_DIR/tab-bankruptcy-$VERSION.zip"

rm -rf "$STAGE" "$OUT_FILE"
mkdir -p "$STAGE/lib/llm/byok" "$STAGE/assets/icons"

# Stage exactly the files Chrome needs at runtime.
cp manifest.json background.js popup.html popup.js popup.css \
   options.html options.js options.css PRIVACY.md "$STAGE/"
cp lib/audio.js lib/puter.js lib/puter.LICENSE lib/puter.VERSION "$STAGE/lib/"
cp lib/llm/package.json lib/llm/index.js lib/llm/errors.js \
   lib/llm/prompt.js lib/llm/parse.js lib/llm/models.js lib/llm/models.json \
   lib/llm/puter-provider.js lib/llm/byok-provider.js "$STAGE/lib/llm/"
cp lib/llm/byok/xai.js lib/llm/byok/openai.js \
   lib/llm/byok/anthropic.js lib/llm/byok/google.js "$STAGE/lib/llm/byok/"
cp assets/icons/icon16.png assets/icons/icon32.png \
   assets/icons/icon48.png assets/icons/icon128.png "$STAGE/assets/icons/"

# Zip the staging directory — prefer `zip`, fall back to PowerShell on Windows.
if command -v zip >/dev/null 2>&1; then
  (cd "$STAGE" && zip -r "../tab-bankruptcy-$VERSION.zip" . > /dev/null)
elif command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command \
    "Compress-Archive -Path '$STAGE/*' -DestinationPath '$OUT_FILE' -Force" \
    > /dev/null
else
  echo "error: neither 'zip' nor 'powershell.exe' available — cannot create zip" >&2
  echo "  install zip via: brew install zip / apt install zip / choco install zip" >&2
  exit 1
fi

rm -rf "$STAGE"

# Verify the zip is well-formed and doesn't contain forbidden files.
if command -v unzip >/dev/null 2>&1; then
  if unzip -l "$OUT_FILE" | grep -E "\.test\.js|\.git|README\.md|CLAUDE\.md|context\.md|/docs/|/scripts/" > /dev/null; then
    echo "error: zip contains forbidden files:" >&2
    unzip -l "$OUT_FILE" | grep -E "\.test\.js|\.git|README\.md|CLAUDE\.md|context\.md|/docs/|/scripts/" >&2
    exit 1
  fi
fi

SIZE_BYTES="$(wc -c < "$OUT_FILE")"
SIZE_KB=$(( SIZE_BYTES / 1024 ))

echo "✓ packaged: $OUT_FILE"
echo "  version:  $VERSION"
echo "  size:     ${SIZE_KB} KB"
echo ""
echo "Next: smoke-test by extracting the zip and loading the unpacked"
echo "directory in chrome://extensions before uploading to the dashboard."
