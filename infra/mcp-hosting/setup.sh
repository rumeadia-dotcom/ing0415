#!/usr/bin/env bash
# MCP hosting — 기존 gateway Lightsail 인스턴스에 MCP 스택 추가 셋업.
# 설계 ground truth: docs/architecture/v1/cross-cutting/mcp-hosting.md §8 / §9
#
# 절대 제약 (먼저 읽을 것):
#  - gateway(market-gateway.service / /etc/market-gateway / /opt/market-gateway)는 건드리지 않는다.
#    본 스크립트는 그 경로/유닛/시크릿을 일절 수정·참조하지 않는다.
#  - 고정 IP / Lightsail Networking inbound 변경 없음 (443/80/22 기존). 신규 포트 0.
#  - Caddy 는 메인 Caddyfile 에 `import mcp.caddy` 1줄만 멱등 추가. gateway 블록 무수정.
#
# 사용:
#   1) gateway 가 이미 떠 있는 인스턴스에 SSH.
#   2) 본 디렉토리를 인스턴스로 전송:
#        rsync -avz infra/mcp-hosting/ ubuntu@<static-ip>:/tmp/mcp-hosting/
#   3) 실행 (MCP_BASE = gateway 와 동일한 sslip 베이스 도메인. 엔드포인트는 서브도메인으로 노출):
#        sudo MCP_BASE=43-201-83-78.sslip.io bash /tmp/mcp-hosting/setup.sh
#   4) /etc/mcp-hosting/env 의 토큰/DATABASE_URI/SENTRY 채우기 (.env.example 참고).
#   5) sql/ 적용 (운영자 수동, real 1회 + dev 1회 — sql/README.md).
#   6) sudo systemctl start mcp-hosting   (또는 cd /opt/mcp-hosting && sudo -u mcp docker compose up -d)
#   7) 헬스체크: curl -i https://supabase-real.${MCP_BASE}/healthz
#
# idempotent — 재실행 안전. env 파일은 존재 시 덮어쓰지 않음.

set -euo pipefail

MCP_BASE="${MCP_BASE:?set MCP_BASE=<ip-hyphen>.sslip.io  (예: 43-201-83-78.sslip.io)}"
# Caddy 전역 email 은 gateway 의 메인 Caddyfile 에 이미 정의됨 → import 된 mcp vhost 가 공유.
# 따라서 OPS_EMAIL 은 받지 않는다 (gateway 무수정 원칙).
# 엔드포인트는 supabase-dev.${MCP_BASE} / supabase-real.${MCP_BASE} / playwright… / sentry… 서브도메인.

MCP_UID="${MCP_UID:-10001}"
MCP_GID="${MCP_GID:-10001}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CADDYFILE="/etc/caddy/Caddyfile"

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

require_root() {
  if [[ $EUID -ne 0 ]]; then echo "must run as root (sudo)" >&2; exit 1; fi
}

guard_gateway_present() {
  # gateway 가 살아있는지 확인 (본 스크립트는 추가만 한다 — 전제 점검).
  if [[ ! -f "${CADDYFILE}" ]]; then
    echo "FATAL: ${CADDYFILE} 가 없음. gateway(Caddy) 가 먼저 셋업되어야 한다." >&2
    exit 1
  fi
  log "gateway Caddyfile 확인됨 — gateway 블록은 수정하지 않는다."
}

install_docker() {
  log "Docker Engine + compose plugin 설치 (idempotent)"
  if docker compose version >/dev/null 2>&1; then
    log "  → docker compose 이미 사용 가능 — skip"
    return
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi
  local codename
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

setup_user() {
  log "mcp 시스템 사용자 생성 (uid/gid ${MCP_UID}/${MCP_GID})"
  if ! getent group mcp >/dev/null 2>&1; then
    groupadd --system --gid "${MCP_GID}" mcp || groupadd --system mcp
  fi
  if ! id -u mcp >/dev/null 2>&1; then
    useradd --system --uid "${MCP_UID}" --gid mcp \
      --home /opt/mcp-hosting --shell /usr/sbin/nologin mcp \
      || useradd --system --gid mcp --home /opt/mcp-hosting --shell /usr/sbin/nologin mcp
  fi
  # compose 오케스트레이션을 위해 docker 그룹 소속 (컨테이너는 docker.sock 미마운트).
  usermod -aG docker mcp
}

deploy_stack() {
  log "/opt/mcp-hosting 배포 (compose + auth-proxy)"
  install -d -o mcp -g mcp -m 0750 /opt/mcp-hosting
  install -o mcp -g mcp -m 0644 "${SCRIPT_DIR}/docker-compose.yml" /opt/mcp-hosting/docker-compose.yml
  install -d -o mcp -g mcp -m 0755 /opt/mcp-hosting/auth-proxy
  install -o mcp -g mcp -m 0644 "${SCRIPT_DIR}/auth-proxy/main.ts"    /opt/mcp-hosting/auth-proxy/main.ts
  install -o mcp -g mcp -m 0644 "${SCRIPT_DIR}/auth-proxy/Dockerfile" /opt/mcp-hosting/auth-proxy/Dockerfile
}

deploy_env() {
  log "/etc/mcp-hosting/env 템플릿 (gateway 의 /etc/market-gateway 와 별도)"
  install -d -o mcp -g mcp -m 0750 /etc/mcp-hosting
  if [[ ! -f /etc/mcp-hosting/env ]]; then
    install -o mcp -g mcp -m 0600 "${SCRIPT_DIR}/.env.example" /etc/mcp-hosting/env
    log "  → /etc/mcp-hosting/env 생성됨. 토큰/DATABASE_URI/SENTRY 를 채워야 함 (.env.example 주석 참고)."
  else
    log "  → /etc/mcp-hosting/env 이미 존재 — 덮어쓰지 않음."
  fi
}

deploy_logdir() {
  log "/var/log/mcp-hosting (real audit). 컨테이너 uid ${MCP_UID} 가 쓸 수 있도록 mcp 소유."
  install -d -o mcp -g mcp -m 0750 /var/log/mcp-hosting
  install -m 0644 "${SCRIPT_DIR}/logrotate-mcp-hosting" /etc/logrotate.d/mcp-hosting
}

deploy_caddy() {
  log "Caddy mcp.caddy 배포 + import 1줄 멱등 추가 (gateway 블록 무수정)"
  sed -e "s/MCP_BASE_PLACEHOLDER/${MCP_BASE}/g" \
      "${SCRIPT_DIR}/caddy/mcp.caddy" > /etc/caddy/mcp.caddy
  # 메인 Caddyfile 끝에 top-level import 1줄 (없을 때만).
  if ! grep -q '^import mcp.caddy' "${CADDYFILE}"; then
    printf '\n# MCP hosting (mcp-hosting.md §1.2). gateway 블록과 분리된 vhost.\nimport mcp.caddy\n' >> "${CADDYFILE}"
    log "  → '${CADDYFILE}' 끝에 import mcp.caddy 추가."
  else
    log "  → import mcp.caddy 이미 존재 — skip."
  fi
  # 문법 검증 후 graceful reload (market-gateway.service 영향 없음).
  if caddy validate --config "${CADDYFILE}" --adapter caddyfile; then
    systemctl reload caddy
    log "  → caddy reload 완료 (graceful)."
  else
    echo "WARN: caddy validate 실패. import 라인/도메인 확인 후 수동 reload." >&2
  fi
}

deploy_systemd() {
  log "systemd unit (mcp-hosting.service) 배포 — gateway 유닛과 독립"
  install -m 0644 "${SCRIPT_DIR}/mcp-hosting.service" /etc/systemd/system/mcp-hosting.service
  systemctl daemon-reload
  systemctl enable mcp-hosting.service
}

main() {
  require_root
  guard_gateway_present
  install_docker
  setup_user
  deploy_stack
  deploy_env
  deploy_logdir
  deploy_caddy
  deploy_systemd

  cat <<EOM

==========================================================================
 MCP hosting 셋업 완료 (gateway 무수정).
 남은 단계 (운영자):
  1) /etc/mcp-hosting/env 채우기:
       - MCP_TOKEN_*  (openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
       - DATABASE_URI_DEV / DATABASE_URI_REAL (제한 role + Supavisor 5432)
       - SENTRY_AUTH_TOKEN (read scope)
  2) DB 제한 role/뷰 적용 (수동 1회, sql/README.md):
       - real: sql/real/01_role_and_deny.sql → 02_mcp_ro_views.sql
       - dev : sql/dev/01_role_readonly.sql
  3) 스택 기동:
       sudo systemctl start mcp-hosting
       # 또는: cd /opt/mcp-hosting && sudo -u mcp docker compose up -d
  4) 헬스체크:
       curl -i https://supabase-real.${MCP_BASE}/healthz   # auth-proxy 200 (서브도메인)
       curl -i https://${MCP_BASE}/healthz                 # gateway 무영향 재확인
  5) 디바이스 .mcp.json 배포 (mcp.json.example) + real read-only/PII-redacted 검증.

 ⚠ 인스턴스가 512MB(nano)면 playwright OOM 위험 — §9.2 의 2GB resize 룬북 권고.
==========================================================================
EOM
}

main "$@"
