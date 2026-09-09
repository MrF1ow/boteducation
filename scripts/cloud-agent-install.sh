#!/usr/bin/env bash
# Cloud Agent install: durable packages, lockfile install, Playwright browser,
# and a secret-free .env.local scaffold. JWT keys are filled by start after
# `supabase start` — do not hardcode them here.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export DEBIAN_FRONTEND=noninteractive
export UCF_FORCE_CONFOLD=1

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

echo "cloud-agent-install: system packages"

if [ ! -f /etc/fuse.conf ]; then
  as_root tee /etc/fuse.conf >/dev/null <<'EOF'
# /etc/fuse.conf - Configuration file for Filesystem in Userspace (FUSE)
# user_allow_other
EOF
fi

as_root apt-get update
printf 'N\n' | as_root apt-get install -y \
  -o Dpkg::Options::="--force-confold" \
  -o Dpkg::Options::="--force-confdef" \
  --no-install-recommends \
  docker.io fuse-overlayfs iptables fuse3 ca-certificates curl

if command -v iptables-legacy >/dev/null 2>&1; then
  as_root update-alternatives --set iptables /usr/sbin/iptables-legacy || true
  if command -v ip6tables-legacy >/dev/null 2>&1; then
    as_root update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy || true
  fi
fi

as_root usermod -aG docker "$(id -un)" || true

SUPABASE_VERSION="2.117.0"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) SUPABASE_ARCH="amd64" ;;
  aarch64|arm64) SUPABASE_ARCH="arm64" ;;
  *)
    echo "cloud-agent-install: unsupported arch: $ARCH" >&2
    exit 1
    ;;
esac

NEED_SUPABASE=1
if command -v supabase >/dev/null 2>&1; then
  if supabase --version 2>/dev/null | grep -q "$SUPABASE_VERSION"; then
    NEED_SUPABASE=0
  fi
fi

if [ "$NEED_SUPABASE" -eq 1 ]; then
  echo "cloud-agent-install: supabase CLI ${SUPABASE_VERSION}"
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_linux_${SUPABASE_ARCH}.tar.gz" \
    -o /tmp/supabase.tar.gz
  tar -xzf /tmp/supabase.tar.gz -C /tmp
  as_root install -m 0755 /tmp/supabase /usr/local/bin/supabase
  rm -f /tmp/supabase.tar.gz /tmp/supabase
fi

set_kv() {
  local file="$1" key="$2" val="$3"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    printf '%s=%s\n' "$key" "$val" >>"$file"
  fi
}

echo "cloud-agent-install: npm ci"
npm ci --include=optional --legacy-peer-deps
npm ci --prefix mcp-server

echo "cloud-agent-install: playwright chromium"
npx playwright install chromium

echo "cloud-agent-install: scaffold .env.local"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi
set_kv .env.local "NEXT_PUBLIC_SUPABASE_URL" "http://127.0.0.1:54321"
set_kv .env.local "NEXT_PUBLIC_PLATFORM_DOMAIN" "lvh.me"
set_kv .env.local "NEXT_PUBLIC_APP_URL" "http://lvh.me:3000"
set_kv .env.local "CRON_SECRET" "local-dev-secret"

echo "cloud-agent-install: done"
node -v
docker --version
supabase --version
