/* global React */
// Studio — supplementary detail screens:
//   s5 OAuth callback (success)
//   s9 Logen credentials form
//   s5 Market connect — provider auth form (4-way: OAuth / HMAC / ESM JWT / API key)

const __t2 = () => window.studioTokens;
const __Shell2 = (...a) => window.studioShell(...a);
const __Pill2 = (...a) => window.studioPill(...a);
const __Id2 = (id, label, size, mode) => window.marketIdentity(id, label, size, mode);

// ========== s5 · OAuth callback ==========
function StudioOAuthCallback() {
  const t = __t2();
  return (
    <div style={{
      width: '100%', height: '100%', background: t.bg, color: t.text,
      fontFamily: '"Manrope", "Pretendard", ui-sans-serif, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{ padding: '22px 30px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: t.ink, color: t.accent, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>M</div>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.015em', color: t.ink }}>MarketCast</div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: t.faint }}>마켓 계정 연결 · OAuth 콜백</span>
      </header>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '20px 30px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
            padding: 36, textAlign: 'center',
            boxShadow: '0 12px 32px -16px rgba(0,0,0,0.18)',
          }}>
            <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 22px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 48, background: t.okBg }} />
              <div style={{ position: 'absolute', inset: 14, borderRadius: 34, background: t.ok, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 36, fontWeight: 700 }}>✓</div>
              <div style={{ position: 'absolute', inset: -6, borderRadius: 51, border: `2px solid ${t.ok}`, opacity: 0.3 }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>네이버 스마트스토어 연결 완료</div>
            <div style={{ fontSize: 13.5, color: t.dim, marginTop: 8, lineHeight: 1.55 }}>
              계정 <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.ink, fontWeight: 600 }}>konai-store</span>가 정상 연결됐어요.<br />
              OAuth 토큰은 만료 전에 자동으로 갱신돼요.
            </div>

            <div style={{
              marginTop: 22, padding: 14, background: t.card2, borderRadius: 12,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, textAlign: 'left',
            }}>
              <div>
                <div style={{ fontSize: 10.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>방식</div>
                <div style={{ fontSize: 12.5, color: t.ink, fontWeight: 600 }}>OAuth 2.0</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>만료</div>
                <div style={{ fontSize: 12.5, color: t.ink, fontWeight: 600 }}>92일 후</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>스코프</div>
                <div style={{ fontSize: 12.5, color: t.ink, fontWeight: 600 }}>products, orders</div>
              </div>
            </div>

            <button style={{
              marginTop: 22, width: '100%', padding: '12px 18px', borderRadius: 10,
              background: t.ink, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700,
            }}>마켓 계정 목록으로 →</button>
            <div style={{ fontSize: 11.5, color: t.faint, marginTop: 8 }}>3초 후 자동 이동돼요</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== s5 · Market connect provider form (HMAC example — 쿠팡) ==========
function StudioMarketConnect() {
  const t = __t2();
  return __Shell2(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 12, color: t.faint }}>
        <span>마켓 계정</span><span>›</span>
        <span>신규 연결</span><span>›</span>
        <span style={{ color: t.ink, fontWeight: 600 }}>쿠팡</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
        {/* Form */}
        <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            {__Id2('m2', '쿠팡', 'lg', 'logo')}
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em' }}>쿠팡 계정 연결</div>
              <div style={{ fontSize: 12.5, color: t.faint, marginTop: 2 }}>HMAC 방식 · Wing 셀러 콘솔에서 발급</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: t.accent, fontWeight: 700 }}>발급 가이드 ↗</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>벤더 ID (Vendor ID) <span style={{ color: t.danger }}>*</span></label>
            <input defaultValue="A00123455" style={{
              width: '100%', padding: '11px 13px', borderRadius: 10,
              border: `1px solid ${t.borderHi}`, background: '#fff',
              fontSize: 14, color: t.ink, outline: 'none',
              fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.02em',
            }} />
            <div style={{ fontSize: 11.5, color: t.faint, marginTop: 4 }}>예: A로 시작하는 9자리 코드</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>액세스 키 (Access Key) <span style={{ color: t.danger }}>*</span></label>
            <input defaultValue="2c93808475c0a8e3017··········" style={{
              width: '100%', padding: '11px 13px', borderRadius: 10,
              border: `1px solid ${t.borderHi}`, background: '#fff',
              fontSize: 14, color: t.ink, outline: 'none',
              fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.02em',
            }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>시크릿 키 (Secret Key) <span style={{ color: t.danger }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input type="password" defaultValue="•••••••••••••••••••••••••••" style={{
                width: '100%', padding: '11px 60px 11px 13px', borderRadius: 10,
                border: `1px solid ${t.borderHi}`, background: '#fff',
                fontSize: 14, color: t.ink, outline: 'none',
                fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
              }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: t.faint, fontWeight: 600 }}>표시</span>
            </div>
            <div style={{ fontSize: 11.5, color: t.faint, marginTop: 4 }}>입력값은 pgcrypto로 암호화되어 저장돼요. 화면에 다시 노출되지 않아요.</div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>계정 라벨 (선택)</label>
            <input defaultValue="konai 메인 쿠팡" style={{
              width: '100%', padding: '11px 13px', borderRadius: 10,
              border: `1px solid ${t.borderHi}`, background: '#fff',
              fontSize: 14, color: t.ink, outline: 'none', fontFamily: 'inherit',
            }} />
          </div>

          <div style={{
            padding: '12px 14px', background: t.okBg, borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
          }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: t.ok, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>✓</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: t.ok, fontWeight: 700 }}>키 검증 통과</div>
              <div style={{ fontSize: 11.5, color: t.dim }}>쿠팡 API 1회 호출 성공 · 30초 전</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ padding: '11px 18px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>취소</button>
            <button style={{ padding: '11px 18px', background: t.card2, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>키 검증</button>
            <button style={{ flex: 1, padding: '11px 18px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700 }}>저장 및 연결</button>
          </div>
        </section>

        {/* Right — guide */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginBottom: 12 }}>키 발급 절차</div>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                '쿠팡 Wing 셀러 콘솔에 로그인',
                '관리 › 인증정보 관리 메뉴 진입',
                '액세스/시크릿 키 신규 발급',
                '벤더 ID는 상단 프로필에서 확인',
              ].map((step, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, color: t.text }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 10, background: t.accentBg, color: t.accent,
                    display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flex: '0 0 auto',
                  }}>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div style={{ background: t.warnBg, border: `1px solid color-mix(in oklch, ${t.warn} 22%, transparent)`, borderRadius: 12, padding: 14, fontSize: 12, color: t.text, lineHeight: 1.55 }}>
            <strong style={{ color: t.warn }}>⚠ 보안 주의</strong><br />
            시크릿 키는 절대 외부에 공유하지 마세요. 입력 후 저장된 키는 다시 확인할 수 없으며, 분실 시 Wing에서 재발급해야 해요.
          </div>
        </aside>
      </div>
    </div>,
    {
      title: '마켓 연결 · 쿠팡',
      sub: '인증 정보 입력 → 즉시 검증 → 저장',
      cta: null,
      sidebarActive: 'markets',
    }
  );
}

// ========== s9 · Logen credentials setup ==========
function StudioLogenSetup() {
  const t = __t2();
  return __Shell2(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 12, color: t.faint }}>
        <span>설정</span><span>›</span>
        <span>배송 설정</span><span>›</span>
        <span style={{ color: t.ink, fontWeight: 600 }}>로젠 API 연동</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
        <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: t.ink, color: t.accent, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16 }}>L</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em' }}>로젠택배 API 연동</div>
              <div style={{ fontSize: 12.5, color: t.faint, marginTop: 2 }}>거래처 ID + API 키 + 인증서 비밀번호 3종 필요</div>
            </div>
            {__Pill2('연결됨', t.ok, t.okBg, { dot: true })}
          </div>

          <div style={{ background: t.okBg, padding: '12px 14px', borderRadius: 10, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: t.ok, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>✓</span>
            <div style={{ flex: 1, fontSize: 12.5, color: t.ok, fontWeight: 600 }}>마지막 검증 3분 전 · 정상 · 오늘 31건 자동 등록</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>거래처 ID (CUST_ID) <span style={{ color: t.danger }}>*</span></label>
            <input defaultValue="L-2847-KN" style={{
              width: '100%', padding: '11px 13px', borderRadius: 10,
              border: `1px solid ${t.borderHi}`, background: '#fff',
              fontSize: 14, color: t.ink, outline: 'none',
              fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
            }} />
            <div style={{ fontSize: 11.5, color: t.faint, marginTop: 4 }}>로젠 계약 시 발급받은 거래처 코드 (L- 접두)</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>API 키 <span style={{ color: t.danger }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input type="password" defaultValue="•••••••••••••••••" style={{
                  width: '100%', padding: '11px 60px 11px 13px', borderRadius: 10,
                  border: `1px solid ${t.borderHi}`, background: '#fff',
                  fontSize: 14, color: t.ink, outline: 'none',
                  fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
                }} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: t.faint, fontWeight: 600 }}>표시</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>인증서 PW <span style={{ color: t.danger }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input type="password" defaultValue="•••••••••" style={{
                  width: '100%', padding: '11px 60px 11px 13px', borderRadius: 10,
                  border: `1px solid ${t.borderHi}`, background: '#fff',
                  fontSize: 14, color: t.ink, outline: 'none',
                  fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
                }} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: t.faint, fontWeight: 600 }}>표시</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, marginBottom: 20 }}>
            <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>운송장 시작 번호 (선택)</label>
            <input defaultValue="3812 9920 1183" style={{
              width: '100%', padding: '11px 13px', borderRadius: 10,
              border: `1px solid ${t.borderHi}`, background: '#fff',
              fontSize: 14, color: t.ink, outline: 'none',
              fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.04em',
            }} />
            <div style={{ fontSize: 11.5, color: t.faint, marginTop: 4 }}>로젠에서 채번한 마지막 운송장 번호. 채번이 이미 자동이면 비워두세요.</div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
            <button style={{ padding: '11px 18px', background: t.dangerBg, color: t.danger, border: `1px solid color-mix(in oklch, ${t.danger} 30%, transparent)`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>연결 해제</button>
            <button style={{ marginLeft: 'auto', padding: '11px 18px', background: t.card2, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>연결 테스트</button>
            <button style={{ padding: '11px 22px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700 }}>저장</button>
          </div>
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginBottom: 10 }}>오늘 통계</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>31</div>
                <div style={{ fontSize: 11, color: t.faint, marginTop: 2 }}>자동 등록 성공</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.danger, letterSpacing: '-0.02em' }}>1</div>
                <div style={{ fontSize: 11, color: t.faint, marginTop: 2 }}>3회 실패 · 수동 대상</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>24</div>
                <div style={{ fontSize: 11, color: t.faint, marginTop: 2 }}>출력 대기</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>3.2s</div>
                <div style={{ fontSize: 11, color: t.faint, marginTop: 2 }}>평균 응답</div>
              </div>
            </div>
          </div>

          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginBottom: 10 }}>최근 호출</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5, color: t.dim, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ color: t.ok }}>200</span><span>POST /shipment/register</span><span style={{ marginLeft: 'auto', color: t.faint }}>14:22</span></div>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ color: t.ok }}>200</span><span>POST /shipment/slipno</span><span style={{ marginLeft: 'auto', color: t.faint }}>14:18</span></div>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ color: t.danger }}>503</span><span>POST /shipment/register</span><span style={{ marginLeft: 'auto', color: t.faint }}>14:02</span></div>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ color: t.ok }}>200</span><span>POST /shipment/register</span><span style={{ marginLeft: 'auto', color: t.faint }}>13:54</span></div>
            </div>
          </div>
        </aside>
      </div>
    </div>,
    {
      title: '로젠 API 연동',
      sub: '주문 자동 등록 · 운송장 채번 · 인쇄 팝업',
      cta: null,
      sidebarActive: 'settings',
    }
  );
}

Object.assign(window, { StudioOAuthCallback, StudioMarketConnect, StudioLogenSetup });
