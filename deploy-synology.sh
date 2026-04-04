#!/usr/bin/env bash
# deploy.sh — rsync dashboard to Synology NAS Web Station
# Usage:
#   ./deploy.sh          — deploy
#   ./deploy.sh --setup  — one-time SSH key + PAM setup (requires NAS admin)
# Or wire to git hook — see .git/hooks/post-commit

set -euo pipefail

# Load local deploy config if present
if [[ -f "$(dirname "$0")/.env" ]]; then
  # shellcheck source=.env
  source "$(dirname "$0")/.env"
fi

NAS_HOST="${NAS_HOST:-nas}"           # hostname or IP of your NAS
NAS_USER="${NAS_USER:-$(whoami)}"     # SSH user on the NAS
NAS_PATH="${NAS_PATH:-/volume1/web/tiller_finance_dash}"  # Web Station path

# ── one-time setup ────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--setup" ]]; then
  KEY="$HOME/.ssh/id_ed25519"

  # Generate key if it doesn't exist
  if [[ ! -f "$KEY" ]]; then
    echo "→ generating SSH key at $KEY"
    ssh-keygen -t ed25519 -f "$KEY" -N "" -C "${USER}@$(hostname)-deploy"
  else
    echo "→ using existing SSH key: $KEY"
  fi

  # Install public key on NAS (will prompt for password once)
  echo "→ copying public key to ${NAS_USER}@${NAS_HOST} (enter your NAS password when prompted)"
  ssh-copy-id -i "${KEY}.pub" "${NAS_USER}@${NAS_HOST}"

  # Fix Synology's rsync PAM config so rsync doesn't re-prompt for password
  # even after SSH key auth succeeds. Requires admin/sudo on the NAS.
  echo "→ patching /etc/pam.d/rsync on NAS (may prompt for sudo password)"
  ssh -t "${NAS_USER}@${NAS_HOST}" \
    'if grep -q pam_permit /etc/pam.d/rsync; then echo "PAM already patched"; else sudo sed -i "1s/^/auth sufficient pam_permit.so\n/" /etc/pam.d/rsync && echo "PAM patched"; fi'

  echo "✓ setup complete — run ./deploy.sh to deploy"
  exit 0
fi

# ── deploy ────────────────────────────────────────────────────────────────────
SRC="dashboard/"
CONFIG="config.js"

EXTRA_FILES=()
if [[ -f "$CONFIG" ]]; then
  EXTRA_FILES+=("$CONFIG")
fi

echo "→ deploying to ${NAS_USER}@${NAS_HOST}:${NAS_PATH}"

SSH_OPTS="-O -i $HOME/.ssh/id_ed25519 -o StrictHostKeyChecking=no"

# Synology's rsync enforces daemon auth even over SSH; SFTP subsystem is also disabled.
# -O forces legacy SCP protocol which works without SFTP subsystem.
scp -r $SSH_OPTS "${SRC}"* "${NAS_USER}@${NAS_HOST}:${NAS_PATH}/"

if [[ ${#EXTRA_FILES[@]} -gt 0 ]]; then
  scp $SSH_OPTS "${EXTRA_FILES[@]}" "${NAS_USER}@${NAS_HOST}:${NAS_PATH}/"
fi

echo "✓ deployed"
