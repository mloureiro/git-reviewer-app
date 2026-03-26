#!/bin/bash
#
# Installs the git-reviewer CLI command.
#
# This creates a shell wrapper at ~/.local/bin/git-reviewer that launches
# the Git Reviewer desktop app with all passed arguments, enabling usage like:
#
#   git-reviewer --base main --head feature-branch
#
# Usage: ./install-cli.sh

set -euo pipefail

APP_NAME="Git Reviewer"
CLI_NAME="git-reviewer"
BIN_DIR="${HOME}/.local/bin"

# --- Locate the app binary ---

find_binary() {
  # macOS: look for the .app bundle
  if [[ "$(uname)" == "Darwin" ]]; then
    local app_path="/Applications/${APP_NAME}.app/Contents/MacOS/${APP_NAME}"
    if [[ -x "$app_path" ]]; then
      echo "$app_path"
      return
    fi
  fi

  # Linux: check common locations
  for dir in /usr/bin /usr/local/bin /opt; do
    local bin_path="${dir}/${CLI_NAME}"
    if [[ -x "$bin_path" ]]; then
      echo "$bin_path"
      return
    fi
  done

  # Fallback: check if it's already in PATH
  if command -v "$CLI_NAME" &>/dev/null; then
    command -v "$CLI_NAME"
    return
  fi

  return 1
}

BINARY_PATH=$(find_binary) || {
  echo "Error: Could not find the ${APP_NAME} binary." >&2
  echo "Make sure the app is installed (e.g., in /Applications on macOS)." >&2
  exit 1
}

echo "Found binary: ${BINARY_PATH}"

# --- Create wrapper script ---

mkdir -p "$BIN_DIR"

WRAPPER_PATH="${BIN_DIR}/${CLI_NAME}"

cat > "$WRAPPER_PATH" <<WRAPPER
#!/bin/sh
exec "${BINARY_PATH}" "\$@"
WRAPPER

chmod 755 "$WRAPPER_PATH"

echo "Installed CLI at: ${WRAPPER_PATH}"

# --- Check PATH ---

if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
  echo ""
  echo "Warning: ${BIN_DIR} is not in your PATH."
  echo "Add it by appending this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
  echo ""
  echo "  export PATH=\"\${HOME}/.local/bin:\${PATH}\""
  echo ""
fi

echo "Done. You can now run: ${CLI_NAME} --base main --head feature-branch"
