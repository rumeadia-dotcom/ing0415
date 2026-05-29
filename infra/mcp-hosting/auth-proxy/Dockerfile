# MCP auth-proxy — Deno (의존성 0, read_only 컨테이너 호환).
# 설계: docs/architecture/v1/cross-cutting/mcp-hosting.md §8.2
# Deno 버전은 gateway(infra/aws-lightsail-gateway) 와 정합 (1.46.3).
FROM denoland/deno:alpine-1.46.3

WORKDIR /app
COPY main.ts ./main.ts

# main.ts 는 원격 import 0 → 런타임 캐시(DENO_DIR) 쓰기 없음 → read_only rootfs 안전.
# 빌드 타임 타입체크/캐시만 수행 (실패해도 무방하므로 || true).
RUN deno cache main.ts || true

EXPOSE 9000

# 권한 최소화: net + env + audit 경로 read/write 만.
# 컨테이너는 compose 에서 user: "10001:10001" 로 비-root 실행.
CMD ["run", \
     "--allow-net", \
     "--allow-env", \
     "--allow-read=/var/log/mcp-hosting", \
     "--allow-write=/var/log/mcp-hosting", \
     "--no-prompt", \
     "main.ts"]
