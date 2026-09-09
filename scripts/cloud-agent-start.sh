#!/usr/bin/env bash
# Cloud Agent start: dockerd does not survive a snapshot boot. Start Docker,
# boot local Supabase, copy JWT keys from `supabase status`, then attach Next.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

set_kv() {
  local file="$1" key="$2" val="$3"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    printf '%s=%s\n' "$key" "$val" >>"$file"
  fi
}

ensure_dockerd() {
  if docker info >/dev/null 2>&1; then
    as_root chmod 666 /var/run/docker.sock || true
    return 0
  fi

  as_root mkdir -p /etc/docker
  as_root tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "storage-driver": "fuse-overlayfs",
  "iptables": true,
  "ip6tables": false,
  "features": {
    "containerd-snapshotter": false
  }
}
EOF

  # Unix socket only. Docker 29 needs the containerd snapshotter off for fuse-overlayfs.
  as_root dockerd --host=unix:///var/run/docker.sock >/tmp/dockerd.log 2>&1 &

  local i
  for i in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then
      as_root chmod 666 /var/run/docker.sock
      return 0
    fi
    sleep 1
  done

  echo "cloud-agent-start: dockerd failed to start" >&2
  tail -50 /tmp/dockerd.log || true
  exit 1
}

echo "cloud-agent-start: docker"
ensure_dockerd

echo "cloud-agent-start: supabase start"
supabase start

if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

STATUS_JSON="$(supabase status -o json)"
{
  read -r API_URL
  read -r ANON_KEY
  read -r SERVICE_ROLE_KEY
} < <(printf '%s' "$STATUS_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["API_URL"]); print(d["ANON_KEY"]); print(d["SERVICE_ROLE_KEY"])')

if [ -z "${API_URL:-}" ] || [ -z "${ANON_KEY:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "cloud-agent-start: supabase status missing API_URL/ANON_KEY/SERVICE_ROLE_KEY" >&2
  exit 1
fi

# Use | as the sed delimiter — JWTs contain /. Prefer the JWT ANON_KEY, not sb_publishable_*.
set_kv .env.local "NEXT_PUBLIC_SUPABASE_URL" "$API_URL"
set_kv .env.local "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY" "$ANON_KEY"
set_kv .env.local "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY"
set_kv .env.local "NEXT_PUBLIC_PLATFORM_DOMAIN" "lvh.me"
set_kv .env.local "NEXT_PUBLIC_APP_URL" "http://lvh.me:3000"
set_kv .env.local "CRON_SECRET" "local-dev-secret"

echo "cloud-agent-start: next dev on 0.0.0.0:3000 (use http://lvh.me:3000)"
exec npm run dev -- --hostname 0.0.0.0 -p 3000
