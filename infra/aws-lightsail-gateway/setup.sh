#!/usr/bin/env bash
# Market Gateway — AWS Lightsail (Ubuntu 22.04 LTS) 초기 셋업 스크립트.
# 설계: docs/architecture/v1/cross-cutting/market-gateway.md §6.2
#
# 사용:
#   1) Lightsail 콘솔에서 Ubuntu 22.04 인스턴스 생성 + Static IP attach
#   2) SSH 접속:  ssh -i ~/.ssh/<key>.pem ubuntu@<static-ip>
#   3) 본 저장소를 인스턴스로 가져온 후 (rsync / scp / git clone) 실행:
#        sudo GATEWAY_DOMAIN=gateway.example.com OPS_EMAIL=ops@example.com bash setup.sh
#   4) /etc/market-gateway/env 의 MARKET_GATEWAY_SECRET 을 직접 채운 뒤
#        sudo systemctl restart market-gateway
#   5) 헬스체크:  curl -i https://${GATEWAY_DOMAIN}/healthz
#
# 본 스크립트는 idempotent — 재실행해도 안전. 다만 systemd unit / Caddyfile 갱신은 service 재시작 유발.

set -euo pipefail

GATEWAY_DOMAIN="${GATEWAY_DOMAIN:?set GATEWAY_DOMAIN=gateway.<domain>}"
OPS_EMAIL="${OPS_EMAIL:?set OPS_EMAIL=ops@<domain>}"
DENO_VERSION="${DENO_VERSION:-v1.46.3}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "must run as root (sudo)" >&2
    exit 1
  fi
}

apt_install() {
  log "apt update + 필수 패키지"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https \
    unzip ufw fail2ban
}

setup_swap() {
  # 512MB RAM nano plan 안정성 보강. 2GB swap 자동 생성.
  # 이미 swap 이 있거나 /swapfile 존재 시 skip (idempotent).
  log "swap 2GB 생성 (idempotent)"
  if [[ -f /swapfile ]]; then
    log "  → /swapfile 이미 존재 — skip"
    return
  fi
  if swapon --show | grep -q .; then
    log "  → swap 이미 활성 — skip"
    return
  fi
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
  chmod 0600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  # swappiness: 디스크 I/O 부담 최소화 (메모리 압박 시에만 swap 사용)
  sysctl -w vm.swappiness=10 >/dev/null
  if ! grep -q '^vm.swappiness' /etc/sysctl.conf; then
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
  fi
}

setup_user() {
  log "marketgw 사용자 생성"
  if ! id -u marketgw >/dev/null 2>&1; then
    useradd --system --home /opt/market-gateway --shell /usr/sbin/nologin marketgw
  fi
}

install_deno() {
  log "Deno ${DENO_VERSION} 설치"
  if [[ -x /usr/local/bin/deno ]] && /usr/local/bin/deno --version | grep -q "${DENO_VERSION#v}"; then
    log "Deno ${DENO_VERSION} 이미 설치됨 — skip"
    return
  fi
  local tmp
  tmp=$(mktemp -d)
  curl -fsSL "https://github.com/denoland/deno/releases/download/${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip" -o "${tmp}/deno.zip"
  unzip -q "${tmp}/deno.zip" -d "${tmp}"
  install -m 0755 "${tmp}/deno" /usr/local/bin/deno
  rm -rf "${tmp}"
}

install_caddy() {
  log "Caddy v2 설치"
  if command -v caddy >/dev/null 2>&1; then
    log "caddy 이미 설치됨 — skip"
    return
  fi
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
}

deploy_gateway() {
  log "/opt/market-gateway 배포"
  install -d -o marketgw -g marketgw -m 0755 /opt/market-gateway
  install -o marketgw -g marketgw -m 0644 "${SCRIPT_DIR}/main.ts" /opt/market-gateway/main.ts
  install -d -o marketgw -g marketgw -m 0755 /var/log/market-gateway
  # 최초 캐시 빌드 (offline 실행 위해 --cached-only 사용 가능하도록)
  sudo -u marketgw HOME=/opt/market-gateway /usr/local/bin/deno cache /opt/market-gateway/main.ts || true
}

deploy_env() {
  log "/etc/market-gateway/env 템플릿"
  install -d -m 0750 -o root -g marketgw /etc/market-gateway
  if [[ ! -f /etc/market-gateway/env ]]; then
    cat > /etc/market-gateway/env <<'EOF'
# Market Gateway 환경변수. 본 파일은 600 권한 + root:marketgw 소유.
# MARKET_GATEWAY_SECRET 은 Edge Function (Supabase) 측과 동일 값.
# 생성:  openssl rand -hex 32
MARKET_GATEWAY_SECRET=<REPLACE_ME_32B_HEX>
MARKET_GATEWAY_PORT=8787
MARKET_GATEWAY_LOG_LEVEL=info
# SENTRY_DSN=
EOF
    chown root:marketgw /etc/market-gateway/env
    chmod 0640 /etc/market-gateway/env
    log "  → /etc/market-gateway/env 생성됨. MARKET_GATEWAY_SECRET 을 채워야 함."
  else
    log "  → /etc/market-gateway/env 이미 존재 — 덮어쓰지 않음."
  fi
}

deploy_systemd() {
  log "systemd unit 배포"
  install -m 0644 "${SCRIPT_DIR}/market-gateway.service" /etc/systemd/system/market-gateway.service
  systemctl daemon-reload
  systemctl enable market-gateway.service
}

deploy_caddy() {
  log "Caddyfile 배포 (도메인 ${GATEWAY_DOMAIN}, ops ${OPS_EMAIL})"
  install -d -m 0755 /etc/caddy
  sed -e "s/gateway.example.com/${GATEWAY_DOMAIN}/g" \
      -e "s/ops@example.com/${OPS_EMAIL}/g" \
      "${SCRIPT_DIR}/Caddyfile" > /etc/caddy/Caddyfile
  systemctl reload caddy || systemctl restart caddy
}

setup_firewall() {
  log "ufw 방화벽 (22 + 443 + 80) 활성화"
  # Lightsail Networking 측에서도 동일 정책 적용 권장.
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true   # Let's Encrypt HTTP-01 챌린지용
  ufw allow 443/tcp || true
  ufw --force enable || true
}

start_service() {
  log "service 기동"
  systemctl restart market-gateway || true
  sleep 2
  systemctl --no-pager status market-gateway || true
  log "헬스체크 (로컬 8787)"
  curl -sf http://127.0.0.1:8787/healthz | head -c 200 || echo
}

main() {
  require_root
  apt_install
  setup_swap
  setup_user
  install_deno
  install_caddy
  deploy_gateway
  deploy_env
  deploy_systemd
  deploy_caddy
  setup_firewall
  start_service

  cat <<EOM

==========================================================================
 Market Gateway 셋업 완료.
 다음 단계:
  1) /etc/market-gateway/env 의 MARKET_GATEWAY_SECRET 을 실제 값으로 교체
       sudo openssl rand -hex 32 > /tmp/sec && sudo \\
         sed -i "s/<REPLACE_ME_32B_HEX>/\$(cat /tmp/sec)/" /etc/market-gateway/env && \\
         shred -u /tmp/sec
     (동일 값을 Supabase Edge Function env MARKET_GATEWAY_SECRET 에도 등록)
  2) sudo systemctl restart market-gateway
  3) 헬스체크: curl -i https://${GATEWAY_DOMAIN}/healthz
  4) 마켓별 화이트리스트 등록 (쿠팡 / 11번가 / G·옥션 ESM+) — Static IP 사용
==========================================================================
EOM
}

main "$@"
