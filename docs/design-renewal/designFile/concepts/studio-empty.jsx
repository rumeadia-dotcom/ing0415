/* global React */
// Studio — supplementary screens:
//   s2 empty dashboard (first-run · no jobs yet)
//   s7 empty orders (filter result · no orders today)
//   s6 detail (job result with errors tab)
//   s9 sender info form

const __tX = () => window.studioTokens;
const __ShX = (...a) => window.studioShell(...a);
const __PX = (...a) => window.studioPill(...a);
const __IdX = (id, label, size, mode) => window.marketIdentity(id, label, size, mode);

// ========== s2 · 빈 상태 대시보드 ==========
function StudioDashboardEmpty() {
  const t = __tX();
  return __ShX(
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 30px 30px' }}>
      {/* KPI strip — all zeros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { label: '신규 주문', hint: '아직 마켓 미연결' },
          { label: '출력 대기', hint: '—' },
          { label: '등록 진행', hint: '—' },
          { label: '7일 성공률', hint: '—' },
        ].map(k => (
          <div key={k.label} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: '16px 18px 14px' }}>
            <div style={{ fontSize: 12, color: t.dim, fontWeight: 600, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: t.faint, letterSpacing: '-0.03em', lineHeight: 1 }}>—</div>
            <div style={{ fontSize: 11.5, color: t.faint, marginTop: 8 }}>{k.hint}</div>
          </div>
        ))}
      </div>

      {/* Hero — onboarding */}
      <section style={{
        background: `linear-gradient(140deg, ${t.card}, ${t.accentBg} 80%)`,
        border: `1px solid ${t.borderHi}`, borderRadius: 18,
        padding: '32px 36px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, background: t.accent, opacity: 0.15 }} />
        <div style={{ position: 'absolute', bottom: -30, right: 60, width: 100, height: 100, borderRadius: 50, background: t.ink, opacity: 0.05 }} />

        <div style={{ position: 'relative', maxWidth: 640 }}>
          <div style={{ fontSize: 11.5, color: t.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>처음이시군요</div>
          <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            첫 상품을 등록하면<br />여기에 활동이 보여요
          </h2>
          <div style={{ fontSize: 14, color: t.dim, marginTop: 12, lineHeight: 1.55 }}>
            마켓 4곳에 한 번에 등록하고, 주문이 들어오면 자동으로 배송까지 처리해요. 두 단계만 거치면 시작할 수 있어요.
          </div>

          {/* 2-step checklist */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 22 }}>
            <div style={{ background: t.card, border: `1px solid ${t.borderHi}`, borderRadius: 12, padding: 18, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 12, background: t.ink, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>1</span>
                <span style={{ fontSize: 13.5, color: t.ink, fontWeight: 700 }}>마켓 연결</span>
              </div>
              <div style={{ fontSize: 12, color: t.dim, marginBottom: 12, lineHeight: 1.5 }}>네이버·쿠팡·G마켓·옥션 중 1개 이상의 셀러 계정을 연결하세요</div>
              <button style={{ width: '100%', padding: '9px', background: t.ink, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>마켓 연결하기 →</button>
            </div>
            <div style={{ background: t.card2, border: `1px dashed ${t.borderHi}`, borderRadius: 12, padding: 18, opacity: 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 12, background: t.card, color: t.faint, border: `1.5px dashed ${t.borderHi}`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>2</span>
                <span style={{ fontSize: 13.5, color: t.dim, fontWeight: 700 }}>상품 등록</span>
              </div>
              <div style={{ fontSize: 12, color: t.faint, marginBottom: 12, lineHeight: 1.5 }}>5단계 위저드로 한 상품을 모든 마켓에 동시 등록</div>
              <button disabled style={{ width: '100%', padding: '9px', background: 'transparent', color: t.faint, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'not-allowed' }}>마켓 연결 후 가능</button>
            </div>
          </div>
        </div>

        {/* Mock preview hint */}
        <div style={{
          position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)',
          background: t.card, borderRadius: 12, padding: 14, width: 220,
          boxShadow: '0 8px 24px -10px rgba(0,0,0,0.15)',
          border: `1px solid ${t.border}`, opacity: 0.85,
        }}>
          <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>곧 여기에 표시돼요</div>
          {[1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 4, height: 22, background: t.borderHi, borderRadius: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: t.border, borderRadius: 3, marginBottom: 4, width: '88%' }} />
                <div style={{ height: 6, background: t.card2, borderRadius: 3, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Helpful resources */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 18 }}>
        {[
          { icon: '📖', title: '사용자 매뉴얼', sub: '5단계 등록 흐름 가이드' },
          { icon: '🎯', title: 'v1 지원 마켓', sub: '4종 · 11번가는 v2 예정' },
          { icon: '💬', title: '문의', sub: 'help@marketcast.kr' },
        ].map(c => (
          <div key={c.title} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 13.5, color: t.ink, fontWeight: 700 }}>{c.title}</div>
              <div style={{ fontSize: 11.5, color: t.faint, marginTop: 2 }}>{c.sub}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 14, color: t.faint }}>→</span>
          </div>
        ))}
      </div>
    </div>,
    {
      title: 'MarketCast에 오신 것을 환영해요',
      sub: '첫 마켓을 연결하면 모든 기능이 켜져요',
      cta: null,
      sidebarActive: 'dash',
    }
  );
}

// ========== s7 · 빈 상태 (필터 결과 0건) ==========
function StudioOrdersEmpty() {
  const t = __tX();
  return __ShX(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      {/* Search + filter (same chrome as list) */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <input defaultValue="V12 청소기" style={{
            padding: '11px 14px', borderRadius: 10,
            border: `1px solid ${t.borderHi}`, background: '#fff',
            fontSize: 13.5, color: t.ink, outline: 'none', fontFamily: 'inherit',
          }} />
          <button style={{ padding: '11px 16px', background: t.card2, color: t.ink, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>지난 7일 ▾</button>
          <button style={{ padding: '11px 16px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>초기화</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>마켓</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ id: 'm1', label: '네이버' }, { id: 'm3', label: 'G마켓' }].map(m => (
              <button key={m.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px 5px 9px', borderRadius: 999,
                background: t.ink, color: '#fff', border: `1px solid ${t.ink}`,
                fontSize: 12, fontWeight: 600,
              }}>
                {__IdX(m.id, m.label, 'sm', 'logo')}
                {m.label}
              </button>
            ))}
          </div>
          <span style={{ width: 1, height: 18, background: t.border, margin: '0 6px' }} />
          <span style={{ fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>상태</span>
          <button style={{ padding: '5px 11px', borderRadius: 999, background: t.ink, color: '#fff', border: `1px solid ${t.ink}`, fontSize: 12, fontWeight: 600 }}>실패만</button>
        </div>
      </div>

      {/* Empty state */}
      <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: '60px 30px', textAlign: 'center' }}>
        <div style={{ width: 92, height: 92, borderRadius: 46, background: t.card2, color: t.faint, display: 'grid', placeItems: 'center', margin: '0 auto 18px', fontSize: 38 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em' }}>조건에 맞는 주문이 없어요</div>
        <div style={{ fontSize: 13, color: t.dim, marginTop: 8, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
          "V12 청소기" · 네이버 · G마켓 · 실패 · 지난 7일 조건으로 검색했지만 결과가 없어요. 필터를 넓혀 보세요.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
          <button style={{ padding: '10px 18px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>필터 초기화</button>
          <button style={{ padding: '10px 18px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>최근 30일 보기</button>
        </div>
      </section>

      {/* Suggestions */}
      <div style={{ marginTop: 18, padding: '14px 18px', background: t.card2, borderRadius: 12, fontSize: 12.5, color: t.dim, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span><strong style={{ color: t.ink }}>팁:</strong> 주문 동기화는 10분 주기로 자동 실행돼요. 최근 동기화 시각은 화면 우측 상단에 표시돼요.</span>
      </div>
    </div>,
    {
      title: '주문 목록',
      sub: '필터 결과 0건 · 마지막 동기화 14:22',
      cta: null,
      sidebarActive: 'orders',
    }
  );
}

// ========== s6 · 이력 상세 (에러 탭) ==========
function StudioHistoryDetail() {
  const t = __tX();
  return __ShX(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      {/* Breadcrumb + tab */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 12, color: t.faint }}>
        <span>등록 이력</span><span>›</span>
        <span style={{ color: t.ink, fontWeight: 600, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>#J-2846</span>
      </div>

      {/* Hero */}
      <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div className="mc-img-ph" style={{ width: 72, height: 72, borderRadius: 10, flex: '0 0 auto' }}>PRODUCT</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontWeight: 600 }}>#J-2846</span>
              {__PX('일부 성공', t.warn, t.warnBg, { dot: true })}
              <span style={{ fontSize: 11.5, color: t.faint }}>2026.05.21 14:19 · 02:11 소요 · 재시도 1회</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>대용량 무선 청소기 V12 PRO</div>
            <div style={{ fontSize: 13, color: t.dim, marginTop: 4 }}>3개 마켓 등록 · ₩299,000 · 옵션 3종</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button style={{ padding: '9px 14px', background: t.warn, color: '#fff', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700 }}>마켓 제외 후 재등록</button>
            <button style={{ padding: '9px 14px', background: 'transparent', color: t.warn, border: `1px solid ${t.warn}`, borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}>전체 재시도</button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, padding: 4, background: t.card2, borderRadius: 10, width: 'fit-content' }}>
        <span style={{ padding: '8px 16px', color: t.faint, fontSize: 13, fontWeight: 500 }}>결과 (3)</span>
        <span style={{ padding: '8px 16px', background: t.card, color: t.ink, borderRadius: 7, fontSize: 13, fontWeight: 700, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 6 }}>
          오류 분석
          <span style={{ background: t.danger, color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 999, fontWeight: 700 }}>1</span>
        </span>
        <span style={{ padding: '8px 16px', color: t.faint, fontSize: 13, fontWeight: 500 }}>잡 메타</span>
      </div>

      {/* Error analysis */}
      <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {/* Error card */}
        <div style={{ padding: 22, borderLeft: `4px solid ${t.danger}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
            {__IdX('m3', 'G마켓', 'lg', 'logo')}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>G마켓</div>
              <div style={{ fontSize: 11.5, color: t.faint, marginTop: 2 }}>최종 실패 · 3회 시도 후 종결 · 14:22:33</div>
            </div>
            {__PX('failed_final', t.danger, t.dangerBg, { dot: true })}
          </div>

          {/* Error detail */}
          <div style={{ background: t.dangerBg, borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: t.danger, fontWeight: 700, padding: '2px 7px', background: t.card, borderRadius: 4, border: `1px solid color-mix(in oklch, ${t.danger} 30%, transparent)` }}>category_attribute_missing</span>
              <span style={{ fontSize: 11.5, color: t.faint }}>마켓 측 오류 · 사용자 수정 필요</span>
            </div>
            <div style={{ fontSize: 13.5, color: t.ink, fontWeight: 600, marginBottom: 6 }}>가전 카테고리에 필수 속성 "정격소비전력"이 누락됐어요</div>
            <div style={{ fontSize: 12.5, color: t.dim, lineHeight: 1.55 }}>
              G마켓은 가전 카테고리 등록 시 "정격소비전력 (W)" 속성을 의무화하고 있어요. 1단계 상품 정보에서 옵션을 추가한 뒤 마켓 제외 재등록을 진행해 주세요.
            </div>
          </div>

          {/* Attempt log */}
          <div style={{ background: t.card2, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>재시도 이력 (3회)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: t.dim, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
              {[
                { n: 1, time: '14:19:22', code: '422', msg: 'attribute_missing · power_w' },
                { n: 2, time: '14:20:48', code: '422', msg: 'attribute_missing · power_w (재시도)' },
                { n: 3, time: '14:22:33', code: '422', msg: 'attribute_missing · power_w → failed_final' },
              ].map(a => (
                <div key={a.n} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: t.faint }}>{a.time}</span>
                  <span style={{ color: t.danger, fontWeight: 700 }}>{a.code}</span>
                  <span style={{ flex: 1 }}>{a.msg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested fix */}
          <div style={{ marginTop: 12, padding: '12px 14px', background: t.accentBg, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <div style={{ flex: 1, fontSize: 12.5, color: t.text }}>
              <strong style={{ color: t.accent }}>제안:</strong> 1단계에서 옵션 "정격소비전력: 350W"를 추가한 뒤, G마켓만 재등록하세요.
            </div>
            <button style={{ padding: '7px 12px', background: t.ink, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>1단계로 이동 →</button>
          </div>
        </div>
      </section>

      {/* Success summary */}
      <div style={{ marginTop: 14, padding: '14px 18px', background: t.okBg, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, background: t.ok, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>✓</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>2개 마켓은 정상 등록됐어요</div>
          <div style={{ fontSize: 11.5, color: t.dim, marginTop: 2 }}>네이버 NSP-22847102 · 쿠팡 CPP-VR-2847 · 옥션 ACP-118372X (3개)</div>
        </div>
      </div>
    </div>,
    {
      title: '등록 이력 상세',
      sub: '#J-2846 · 대용량 무선 청소기 V12 PRO · 일부 성공',
      cta: <button style={{ padding: '8px 14px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }}>← 이력 목록</button>,
      sidebarActive: 'history',
    }
  );
}

// ========== s9 · 발송인 정보 폼 ==========
function StudioSenderSetup() {
  const t = __tX();
  return __ShX(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 12, color: t.faint }}>
        <span>설정</span><span>›</span>
        <span>배송 설정</span><span>›</span>
        <span style={{ color: t.ink, fontWeight: 600 }}>발송인 정보</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
        <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: t.accentBg, color: t.accent, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18 }}>📦</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em' }}>발송인 정보</div>
              <div style={{ fontSize: 12.5, color: t.faint, marginTop: 2 }}>로젠에 자동 등록되는 출고지 + 운송장 표시 정보</div>
            </div>
            {__PX('설정 완료', t.ok, t.okBg, { dot: true })}
          </div>

          <div style={{ marginBottom: 8, fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>발송인</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>이름 / 상호 <span style={{ color: t.danger }}>*</span></label>
              <input defaultValue="김konai" style={inputStyle(t)} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>연락처 <span style={{ color: t.danger }}>*</span></label>
              <input defaultValue="010-2847-XXXX" style={inputStyle(t, true)} />
            </div>
          </div>

          <div style={{ marginTop: 18, marginBottom: 8, fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 16, borderTop: `1px solid ${t.border}` }}>출고지 주소</div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>우편번호 <span style={{ color: t.danger }}>*</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input defaultValue="13525" style={{ ...inputStyle(t, true), maxWidth: 140 }} />
              <button style={{ padding: '11px 16px', background: t.card2, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>주소 검색</button>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>기본 주소 <span style={{ color: t.danger }}>*</span></label>
            <input defaultValue="경기 성남시 분당구 판교로 235" style={inputStyle(t)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>상세 주소</label>
            <input defaultValue="H스퀘어 N동 902호" style={inputStyle(t)} />
          </div>

          <div style={{ marginTop: 18, marginBottom: 8, fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 16, borderTop: `1px solid ${t.border}` }}>운송장 옵션</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>운임 부담 <span style={{ color: t.danger }}>*</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ flex: 1, padding: '10px', background: t.ink, color: '#fff', border: `1px solid ${t.ink}`, borderRadius: 9, fontSize: 13, fontWeight: 700 }}>선불</button>
                <button style={{ flex: 1, padding: '10px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600 }}>착불</button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>배송료 (착불 시)</label>
              <input defaultValue="3,000" style={inputStyle(t, true)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 16, borderTop: `1px solid ${t.border}`, marginTop: 18 }}>
            <button style={{ padding: '11px 18px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>취소</button>
            <button style={{ marginLeft: 'auto', padding: '11px 18px', background: t.card2, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>주소 검증</button>
            <button style={{ padding: '11px 22px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700 }}>저장</button>
          </div>
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Waybill preview */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>운송장 미리보기</div>
            <div style={{ background: '#fff', border: `1px dashed ${t.borderHi}`, borderRadius: 8, padding: 14, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, lineHeight: 1.65, color: t.ink }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>3812 9920 1183</div>
              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8, marginBottom: 6 }}>
                <div style={{ color: t.faint, fontSize: 9 }}>FROM</div>
                <div style={{ fontWeight: 600 }}>김konai</div>
                <div>010-2847-XXXX</div>
                <div>경기 성남시 분당구 판교로 235</div>
                <div>H스퀘어 N동 902호 (13525)</div>
              </div>
              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
                <div style={{ color: t.faint, fontSize: 9 }}>TO</div>
                <div style={{ fontWeight: 600 }}>이*영</div>
                <div>경기 성남시 ··· (마스킹)</div>
              </div>
              <div style={{ marginTop: 8, padding: '4px 0', textAlign: 'center', background: t.card2, borderRadius: 4, fontWeight: 700 }}>선불</div>
            </div>
            <div style={{ fontSize: 11, color: t.faint, marginTop: 8, textAlign: 'center' }}>위 정보가 운송장에 표시돼요</div>
          </div>

          <div style={{ background: t.warnBg, border: `1px solid color-mix(in oklch, ${t.warn} 22%, transparent)`, borderRadius: 12, padding: 14, fontSize: 12, color: t.text, lineHeight: 1.55 }}>
            <strong style={{ color: t.warn }}>📞 콜센터 호출 시</strong><br />
            로젠 콜센터가 셀러에게 직접 연락할 수 있도록, 받을 수 있는 번호를 입력해 주세요.
          </div>
        </aside>
      </div>
    </div>,
    {
      title: '발송인 정보',
      sub: '운송장에 표시되고 로젠에 자동 등록되는 출고지 정보',
      cta: null,
      sidebarActive: 'settings',
    }
  );
}

function inputStyle(t, mono) {
  return {
    width: '100%', padding: '11px 13px', borderRadius: 10,
    border: `1px solid ${t.borderHi}`, background: '#fff',
    fontSize: 14, color: t.ink, outline: 'none',
    fontFamily: mono ? 'ui-monospace, "JetBrains Mono", monospace' : 'inherit',
  };
}

Object.assign(window, {
  StudioDashboardEmpty, StudioOrdersEmpty, StudioHistoryDetail, StudioSenderSetup,
});
