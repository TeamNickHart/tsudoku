#!/usr/bin/env bash
# Shared functions for SE reference scripts.
# Source this file: source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# Map SE difficulty rating to technique name
rating_to_technique() {
  local rating="$1"
  case "$rating" in
    1.0) echo "NakedSingle" ;;
    1.2) echo "HiddenSingle" ;;
    1.5) echo "HiddenSingle" ;;
    1.7) echo "DirectPointing" ;;
    1.9) echo "DirectClaiming" ;;
    2.0) echo "DirectHiddenPair" ;;
    2.3) echo "NakedSingle" ;;
    2.5) echo "DirectHiddenTriplet" ;;
    2.6) echo "Pointing" ;;
    2.8) echo "Claiming" ;;
    3.0) echo "NakedPair" ;;
    3.2) echo "XWing" ;;
    3.4) echo "HiddenPair" ;;
    3.6) echo "NakedTriplet" ;;
    3.8) echo "Swordfish" ;;
    4.0) echo "HiddenTriplet" ;;
    4.2) echo "XYWing" ;;
    4.4) echo "XYZWing" ;;
    *)   echo "Unknown" ;;
  esac
}

# Detect timeout command (macOS needs gtimeout from coreutils)
# Sets TIMEOUT_CMD to the available command, or empty string if none found.
detect_timeout_cmd() {
  TIMEOUT_CMD=""
  if command -v gtimeout &>/dev/null; then
    TIMEOUT_CMD="gtimeout"
  elif command -v timeout &>/dev/null; then
    if timeout --version &>/dev/null 2>&1 || timeout 1 true &>/dev/null 2>&1; then
      TIMEOUT_CMD="timeout"
    fi
  fi

  if [ -z "$TIMEOUT_CMD" ]; then
    echo "WARNING: No timeout command found. Install coreutils for per-puzzle timeouts." >&2
    echo "  brew install coreutils" >&2
  fi
}

# Check that SudokuExplainer.jar and Java are available.
# Exits with error message if not.
check_se_prerequisites() {
  local script_dir="$1"
  local jar_path="$script_dir/SudokuExplainer.jar"

  if ! command -v java &>/dev/null; then
    echo "ERROR: Java is not installed or not on PATH." >&2
    echo "" >&2
    echo "Install OpenJDK 11+ (17 recommended):" >&2
    echo "  macOS:  brew install openjdk" >&2
    echo "  Linux:  sudo apt-get install openjdk-17-jre-headless" >&2
    echo "" >&2
    echo "See: tools/se-reference/README.md" >&2
    exit 1
  fi

  if [ ! -f "$jar_path" ]; then
    echo "ERROR: SudokuExplainer.jar not found at $jar_path" >&2
    echo "" >&2
    echo "Run setup first:" >&2
    echo "  bash tools/se-reference/setup.sh" >&2
    echo "" >&2
    echo "See: tools/se-reference/README.md" >&2
    exit 1
  fi
}
