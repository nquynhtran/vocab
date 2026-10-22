#!/usr/bin/env bash
# Formats the file Claude just edited, so style never needs a manual pass.
# Never fails the tool call: formatting is a convenience, `npm run check` is the gate.

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts | *.tsx | *.css | *.json | *.html | *.yml) ;;
  *) exit 0 ;;
esac

# Hooks run in a non-interactive shell, so nvm is not on PATH yet.
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

cd "$CLAUDE_PROJECT_DIR" && npx --no-install prettier --write --log-level warn "$file" >&2 || true
exit 0
