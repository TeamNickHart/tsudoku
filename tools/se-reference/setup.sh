#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAR_PATH="$SCRIPT_DIR/SudokuExplainer.jar"
JAR_URL="https://github.com/1to9only/SudokuExplainer/releases/download/2022.3.24/SudokuExplainer.jar"

# --- Check Java ---
if ! command -v java &>/dev/null; then
  echo "ERROR: Java is not installed."
  echo ""
  echo "Install OpenJDK 11+ for your platform:"
  echo "  macOS:         brew install openjdk"
  echo "  Debian/Ubuntu: sudo apt-get install openjdk-17-jre-headless"
  echo "  Windows:       winget install Microsoft.OpenJDK.17"
  echo "                 or download from https://adoptium.net"
  echo ""
  echo "macOS note: Homebrew OpenJDK may not be on your PATH. Add this to your shell profile:"
  echo '  export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"'
  exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1)
echo "Found Java: $JAVA_VERSION"

# --- Download JAR ---
if [ -f "$JAR_PATH" ]; then
  echo "SudokuExplainer.jar already exists at $JAR_PATH"
else
  echo "Downloading SudokuExplainer.jar from GitHub releases (2022.3.24)..."

  if command -v curl &>/dev/null; then
    curl -fSL -o "$JAR_PATH" "$JAR_URL"
  elif command -v wget &>/dev/null; then
    wget -O "$JAR_PATH" "$JAR_URL"
  else
    echo "ERROR: Neither curl nor wget found. Please download manually:"
    echo "  $JAR_URL"
    echo "  Place at: $JAR_PATH"
    exit 1
  fi

  echo "Downloaded SudokuExplainer.jar to $JAR_PATH"
fi

# --- Smoke test ---
echo "Running smoke test..."
TEST_PUZZLE="530070000600195000098000060800060003400803001700020006060000280000419005000080079"
TMPFILE=$(mktemp)
echo "$TEST_PUZZLE" > "$TMPFILE"

if java -cp "$JAR_PATH" diuf.sudoku.test.serate --input="$TMPFILE" --output=- --format="%g ED=%r/%p/%d" 2>/dev/null; then
  echo ""
  echo "SE reference setup complete."
else
  echo "WARNING: Smoke test failed. The JAR may be incompatible with your Java version."
  echo "Try OpenJDK 11 or 17."
  echo ""
  echo "macOS users: ensure Homebrew Java is on your PATH:"
  echo '  export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"'
fi

rm -f "$TMPFILE"
