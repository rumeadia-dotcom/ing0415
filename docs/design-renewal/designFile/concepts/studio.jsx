/* global React */
// Concept B — "Studio": warm, soft, generous. Off-white + vivid orange accent.
// v1.3 (2026-05-22): accent ochre amber(hue 55) → vivid orange #ff5a1f(hue 35).

const studioTokens = {
  bg:        'oklch(0.975 0.008 75)',     // warm off-white
  card:      '#ffffff',
  card2:     'oklch(0.985 0.006 75)',
  border:    'oklch(0.92 0.008 75)',
  borderHi:  'oklch(0.85 0.01 75)',
  text:      'oklch(0.22 0.015 60)',
  dim:       'oklch(0.48 0.012 60)',
  faint:     'oklch(0.68 0.01 60)',
  ink:       'oklch(0.15 0.015 60)',
  accent:    'oklch(0.665 0.205 35)',       // #ff5a1f · vivid orange (v1.3 키컬러)
  accentBg:  'oklch(0.96 0.05 35)',         // warm peach soft (소프트 배경)
  ok:        'oklch(0.55 0.10 160)',
  okBg:      'oklch(0.95 0.03 160)',
  warn:      'oklch(0.62 0.12 70)',
  warnBg:    'oklch(0.95 0.04 75)',
  danger:    'oklch(0.55 0.16 25)',
  dangerBg:  'oklch(0.95 0.03 25)',
  info:      'oklch(0.55 0.10 235)',
  infoBg:    'oklch(0.95 0.025 235)',
  // Markets — tones nudge toward each marketplace's brand tone without
  // exact recreation. Distinct hues so all 4 read clearly side-by-side.
  m1: 'oklch(0.62 0.16 152)',   // 네이버  · emerald green
  m2: 'oklch(0.60 0.21 22)',    // 쿠팡    · red-pink
  m3: 'oklch(0.58 0.14 175)',   // G마켓   · teal-leaning green (distinct from m1)
  m4: 'oklch(0.62 0.19 38)',    // 옥션    · orange-red (distinct from m2)
  m5: 'oklch(0.60 0.22 0)',     // 11번가  · magenta-red (v2)
};

// Marketplace identity rendering. Three modes:
//   'dot'  · color circle (default fallback)
//   'logo' · square w/ initial — recommended for sidebars + sort/filter rows
//   'bar'  · vertical color bar — recommended for data tables (low color area)
// Resolution priority: explicit mode arg > window.__studioIdentity > 'dot'.
function marketIdentity(id, label, size = 'sm', mode) {
  const t = studioTokens;
  const resolved = mode || (typeof window !== 'undefined' && window.__studioIdentity) || 'dot';
  const initial = ({ m1: 'N', m2: 'C', m3: 'G', m4: 'A', m5: '11' })[id] || '?';
  const color = t[id];
  const px = size === 'lg' ? 14 : size === 'md' ? 12 : 10;
  if (resolved === 'logo') {
    return (
      <span style={{
        width: px + 6, height: px + 6, borderRadius: 5,
        background: color, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: px - 1, fontWeight: 700, flex: '0 0 auto',
      }}>{initial}</span>
    );
  }
  if (resolved === 'bar') {
    return (
      <span style={{
        width: 4, height: px + 6, background: color,
        borderRadius: 2, flex: '0 0 auto',
      }} />
    );
  }
  return (
    <span style={{
      width: px, height: px, borderRadius: px / 2,
      background: color, flex: '0 0 auto',
    }} />
  );
}

const studioShell = (children, { title, sub, cta, sidebarActive }) => {
  const t = studioTokens;
  const wrap = {
    width: '100%', height: '100%', display: 'grid',
    gridTemplateColumns: '230px 1fr',
    background: t.bg, color: t.text,
    fontFamily: '"Manrope", "Pretendard", ui-sans-serif, system-ui, sans-serif',
    fontSize: 14, lineHeight: 1.5,
  };
  const navGroups = [
    { title: null, items: [
      { id: 'dash', label: '대시보드' },
      { id: 'register', label: '상품 등록' },
      { id: 'history', label: '등록 이력' },
    ] },
    { title: '판매', items: [
      { id: 'markets', label: '마켓 계정', tag: '4' },
      { id: 'orders', label: '주문 현황', tag: '37' },
      { id: 'shipping', label: '배송 처리' },
    ] },
    { title: '환경', items: [
      { id: 'templates', label: '템플릿' },
      { id: 'settings', label: '설정' },
    ] },
  ];
  return (
    <div style={wrap}>
      <aside style={{
        background: t.card, borderRight: `1px solid ${t.border}`,
        padding: '18px 14px', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px 18px' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: t.ink, display: 'grid', placeItems: 'center', color: t.accent, fontWeight: 700, fontSize: 14 }}>M</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.015em', color: t.ink }}>MarketCast</div>
            <div style={{ fontSize: 10.5, color: t.faint, marginTop: -1 }}>한 번의 등록, 모든 마켓</div>
          </div>
        </div>
        {navGroups.map((g, gi) => (
          <div key={gi} style={{ marginTop: gi > 0 ? 14 : 0 }}>
            {g.title && <div style={{ fontSize: 10.5, color: t.faint, padding: '0 8px 6px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{g.title}</div>}
            {g.items.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: n.id === sidebarActive ? t.accentBg : 'transparent',
                color: n.id === sidebarActive ? t.ink : t.dim,
                fontWeight: n.id === sidebarActive ? 600 : 500,
                fontSize: 13.5, marginBottom: 1,
              }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${n.id === sidebarActive ? t.accent : t.borderHi}`, background: n.id === sidebarActive ? t.accent : 'transparent' }} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.tag && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: t.card2, color: t.dim, border: `1px solid ${t.border}` }}>{n.tag}</span>}
              </div>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 'auto', padding: 12, background: t.card2, border: `1px solid ${t.border}`, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: t.accentBg, color: t.accent, display: 'grid', placeItems: 'center', fontWeight: 700 }}>김</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>konai 셀러</div>
              <div style={{ fontSize: 11, color: t.faint }}>seller@konai.com</div>
            </div>
          </div>
        </div>
      </aside>
      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          padding: '22px 30px 18px',
          display: 'flex', alignItems: 'flex-start', gap: 18, borderBottom: `1px solid ${t.border}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink }}>{title}</h1>
            <div style={{ fontSize: 13, color: t.dim, marginTop: 2 }}>{sub}</div>
          </div>
          {cta}
        </header>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
      </main>
    </div>
  );
};

const studioPrimaryBtn = (label) => {
  const t = studioTokens;
  return (
    <button style={{
      padding: '10px 18px', borderRadius: 10,
      background: t.ink, color: '#fff', border: 'none',
      fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 1px 0 rgba(0,0,0,0.06), 0 4px 12px -3px rgba(0,0,0,0.18)',
    }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: t.accent, display: 'grid', placeItems: 'center', fontSize: 11, color: t.ink }}>+</span>
      {label}
    </button>
  );
};

const studioPill = (label, fg, bg, { dot } = {}) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 9px', borderRadius: 999,
    background: bg, color: fg, fontSize: 12, fontWeight: 600,
  }}>
    {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: fg }} />}
    {label}
  </span>
);

// ========== SCREEN: Dashboard ==========
// ========== SCREEN: Dashboard (orders-first) ==========
function StudioDashboard() {
  const t = studioTokens;
  const kpis = [
    { label: '신규 주문', value: '37', unit: '건', hint: '최근 동기화 14:22', tone: 'info', strong: true },
    { label: '출력 대기', value: '24', unit: '건', hint: '운송장 인쇄 필요', tone: 'warn' },
    { label: '등록 진행', value: '2', unit: '건', hint: '오늘 14건 완료', tone: 'accent' },
    { label: '7일 성공률', value: '94', unit: '%', hint: '83/88 잡 성공', tone: 'ok' },
  ];
  const stages = [
    { label: '신규 수집', value: 37, color: t.info, bg: t.infoBg },
    { label: '로젠 등록', value: 31, color: t.ok, bg: t.okBg },
    { label: '출력 대기', value: 24, color: t.warn, bg: t.warnBg },
    { label: '제출 완료', value: 12, color: t.faint, bg: t.card2 },
  ];
  const orders = [
    { id: 'NS-820194', m: 'm1', name: '오가닉 면 티셔츠 [블랙/M]', who: '김*수', status: 'collected', time: '14:22' },
    { id: 'CP-118372', m: 'm2', name: '대용량 무선 청소기 V12 PRO', who: '이*영', status: 'logen_registered', time: '14:18' },
    { id: 'NS-820188', m: 'm1', name: '캠핑 폴딩 체어 (그레이) × 2', who: '박*철', status: 'waybill_printed', time: '14:11' },
    { id: 'AC-552901', m: 'm4', name: '핸드드립 커피 원두 200g', who: '최*진', status: 'logen_failed', time: '14:02' },
    { id: 'GM-339201', m: 'm3', name: '강아지 자동 급식기 5L', who: '정*아', status: 'tracking_submitted', time: '13:54' },
  ];
  const orderStatus = {
    collected:           { fg: t.info,   bg: t.infoBg,   label: '수집됨' },
    logen_registered:    { fg: t.ok,     bg: t.okBg,     label: '로젠 등록' },
    waybill_printed:     { fg: t.accent, bg: t.accentBg, label: '출력 완료' },
    tracking_submitted:  { fg: t.faint,  bg: t.card2,    label: '제출 완료' },
    logen_failed:        { fg: t.danger, bg: t.dangerBg, label: '로젠 실패' },
  };
  const jobs = [
    { name: '오가닉 면 티셔츠 [블랙/M]', status: 'running', time: '방금' },
    { name: '대용량 무선 청소기 V12 PRO', status: 'partial', time: '3분', failed: 1 },
    { name: '캠핑 폴딩 체어 (그레이)', status: 'succeeded', time: '8분' },
  ];
  const jobStatus = {
    running:   { fg: t.info,   label: '진행 중' },
    partial:   { fg: t.warn,   label: '일부' },
    succeeded: { fg: t.ok,     label: '완료' },
    failed:    { fg: t.danger, label: '실패' },
  };
  const toneColor = { accent: t.accent, info: t.info, ok: t.ok, warn: t.warn, dim: t.faint };

  return studioShell(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            background: k.strong ? t.ink : t.card,
            border: `1px solid ${k.strong ? t.ink : t.border}`,
            borderRadius: 14, padding: '16px 18px 14px',
          }}>
            <div style={{ fontSize: 12, color: k.strong ? 'rgba(255,255,255,0.7)' : t.dim, fontWeight: 600, marginBottom: 8 }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: k.strong ? '#fff' : t.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 13, color: k.strong ? 'rgba(255,255,255,0.7)' : t.dim, fontWeight: 600 }}>{k.unit}</div>
            </div>
            <div style={{ fontSize: 11.5, color: k.strong ? 'rgba(255,255,255,0.6)' : t.faint, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: k.strong ? t.accent : toneColor[k.tone] }} />
              {k.hint}
            </div>
          </div>
        ))}
      </div>

      {/* Today's order flow — hero */}
      <section style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
        padding: 20, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>오늘의 배송 흐름</div>
            <div style={{ fontSize: 12, color: t.faint, marginTop: 2 }}>수집 → 로젠 등록 → 출력 → 제출 · 단계별 카운트</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={{ padding: '9px 14px', background: t.ink, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600 }}>운송장 출력 24</button>
            <button style={{ padding: '9px 14px', background: t.card, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 9, fontSize: 13, fontWeight: 600 }}>송장 일괄 제출</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, position: 'relative' }}>
          {stages.map((s, i) => (
            <div key={s.label} style={{ position: 'relative' }}>
              <div style={{
                background: s.bg, borderRadius: 11, padding: '12px 14px',
                margin: i === 0 ? '0 6px 0 0' : i === stages.length - 1 ? '0 0 0 6px' : '0 6px',
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: s.color, marginBottom: 4 }}>{s.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: t.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: 12, color: t.dim }}>건</span>
                </div>
              </div>
              {i < stages.length - 1 && (
                <span style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', color: t.faint, fontSize: 14, zIndex: 1 }}>›</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Two-column: Recent orders + (Market health + Recent registrations) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 16 }}>
        {/* Recent orders */}
        <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '15px 18px 11px', display: 'flex', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>최근 주문</div>
              <div style={{ fontSize: 11.5, color: t.faint, marginTop: 2 }}>오늘 들어온 순서</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: t.dim, fontWeight: 600 }}>전체 주문 →</span>
          </div>
          <div style={{ borderTop: `1px solid ${t.border}` }}>
            {orders.map((o, i) => (
              <div key={o.id} style={{
                display: 'grid', gridTemplateColumns: '24px 1fr 100px 50px',
                padding: '12px 18px', alignItems: 'center', gap: 12, fontSize: 13,
                borderBottom: i < orders.length - 1 ? `1px solid ${t.border}` : 'none',
              }}>
                {marketIdentity(o.m, '', 'md', 'bar')}
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: t.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                  <div style={{ fontSize: 11.5, color: t.faint, marginTop: 1 }}>{o.id} · {o.who}</div>
                </div>
                <span>{studioPill(orderStatus[o.status].label, orderStatus[o.status].fg, orderStatus[o.status].bg, { dot: true })}</span>
                <span style={{ fontSize: 11.5, color: t.faint, textAlign: 'right' }}>{o.time}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Market health */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>마켓 연결</div>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: t.faint }}>4 / 5 활성</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                { id: 'm1', label: '네이버 스마트스토어', exp: '92일', s: 'ok' },
                { id: 'm2', label: '쿠팡', exp: '41일', s: 'ok' },
                { id: 'm3', label: 'G마켓', exp: '6일 후 만료', s: 'warn' },
                { id: 'm4', label: '옥션', exp: '88일', s: 'ok' },
              ].map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {marketIdentity(m.id, m.label, 'sm', 'logo')}
                  <span style={{ fontSize: 13, color: t.ink, fontWeight: 500 }}>{m.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: m.s === 'warn' ? t.warn : t.faint, fontWeight: m.s === 'warn' ? 600 : 400 }}>{m.exp}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '8px 11px', background: t.warnBg, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 16, height: 16, borderRadius: 8, background: t.warn, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>!</span>
              <span style={{ flex: 1, fontSize: 11.5, color: t.text, fontWeight: 500 }}>G마켓 토큰이 곧 만료돼요</span>
              <span style={{ fontSize: 11.5, color: t.warn, fontWeight: 700 }}>재인증 →</span>
            </div>
          </section>

          {/* Recent registrations — compact */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>최근 등록</div>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: t.dim, fontWeight: 600 }}>이력 →</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map((j, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 4, height: 16, background: jobStatus[j.status].fg, borderRadius: 2 }} />
                  <span style={{ fontSize: 12.5, color: t.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{j.name}</span>
                  <span style={{ fontSize: 10.5, color: jobStatus[j.status].fg, fontWeight: 700 }}>{jobStatus[j.status].label}</span>
                  <span style={{ fontSize: 11, color: t.faint }}>{j.time}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>,
    {
      title: '안녕하세요, konai 셀러님',
      sub: '신규 주문 37건 · 출력 대기 24건 · 등록 진행 2건',
      cta: studioPrimaryBtn('상품 등록'),
      sidebarActive: 'dash',
    }
  );
}

// ========== SCREEN: Register (Step 4 — Preview) ==========
function StudioRegister() {
  const t = studioTokens;
  const steps = [
    { n: 1, label: '상품 정보', done: true },
    { n: 2, label: '이미지', done: true },
    { n: 3, label: '마켓 · 카테고리', done: true },
    { n: 4, label: '미리보기', current: true },
    { n: 5, label: '결과', done: false },
  ];
  const markets = [
    { id: 'm1', label: '네이버 스마트스토어', cat: '패션의류 › 남성의류 › 티셔츠', fee: '14,500', issues: [] },
    { id: 'm2', label: '쿠팡', cat: '패션의류잡화 › 남성의류 › 반팔티', fee: '16,820',
      issues: [{ type: 'warn', msg: '이미지 1장이 800×800 미만이에요 (1000×1000 권장)' }] },
    { id: 'm3', label: 'G마켓', cat: '의류 › 남성캐주얼 › 티셔츠', fee: '13,920',
      issues: [{ type: 'error', msg: '의류 카테고리는 브랜드 입력이 필수예요. 1단계로 돌아가 입력해 주세요' }] },
    { id: 'm4', label: '옥션', cat: '패션 › 남성의류 › 반팔티', fee: '13,920', issues: [] },
  ];

  return studioShell(
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 30px 30px' }}>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 14,
                background: s.current ? t.ink : (s.done ? t.accentBg : t.card),
                color: s.current ? t.accent : (s.done ? t.accent : t.faint),
                border: `1.5px solid ${s.current ? t.ink : (s.done ? t.accent : t.border)}`,
                fontSize: 13, fontWeight: 700,
                display: 'grid', placeItems: 'center',
              }}>{s.done ? '✓' : s.n}</span>
              <span style={{ fontSize: 13.5, color: s.current ? t.ink : (s.done ? t.ink : t.faint), fontWeight: s.current ? 700 : 500 }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <span style={{ flex: 1, height: 1.5, background: s.done ? t.accent : t.border, margin: '0 14px', opacity: s.done ? 0.5 : 1 }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Hero summary */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22,
        marginBottom: 18, display: 'flex', alignItems: 'center', gap: 22,
      }}>
        <div className="mc-img-ph" style={{ width: 88, height: 88, borderRadius: 12, flex: '0 0 auto' }}>PRODUCT</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: t.faint, fontWeight: 600, marginBottom: 4 }}>등록 요약</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>오가닉 면 티셔츠 [블랙/M]</div>
          <div style={{ display: 'flex', gap: 22, marginTop: 10 }}>
            <div><div style={{ fontSize: 11.5, color: t.faint, fontWeight: 600 }}>판매가</div><div style={{ fontSize: 15, color: t.ink, fontWeight: 600 }}>₩29,000</div></div>
            <div><div style={{ fontSize: 11.5, color: t.faint, fontWeight: 600 }}>정가</div><div style={{ fontSize: 15, color: t.ink, fontWeight: 600 }}>₩35,000</div></div>
            <div><div style={{ fontSize: 11.5, color: t.faint, fontWeight: 600 }}>이미지</div><div style={{ fontSize: 15, color: t.ink, fontWeight: 600 }}>5장</div></div>
            <div><div style={{ fontSize: 11.5, color: t.faint, fontWeight: 600 }}>배송</div><div style={{ fontSize: 15, color: t.ink, fontWeight: 600 }}>기본정책</div></div>
          </div>
        </div>
        <div style={{ borderLeft: `1px solid ${t.border}`, paddingLeft: 22, textAlign: 'right' }}>
          <div style={{ fontSize: 11.5, color: t.faint, fontWeight: 600 }}>예상 수수료 합계</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', marginTop: 2 }}>₩59,160</div>
          <div style={{ fontSize: 11.5, color: t.faint, marginTop: 2 }}>3개 마켓 · 옥션 제외</div>
        </div>
      </div>

      {/* Validation banner */}
      <div style={{
        background: t.dangerBg, border: `1px solid color-mix(in oklch, ${t.danger} 25%, transparent)`,
        borderRadius: 12, padding: '14px 18px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ width: 30, height: 30, borderRadius: 15, background: t.danger, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16 }}>!</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>1개 마켓에 등록할 수 없는 항목이 있어요</div>
          <div style={{ fontSize: 12.5, color: t.dim, marginTop: 2 }}>G마켓에 브랜드 정보가 필요해요. 1단계로 돌아가 입력해 주세요</div>
        </div>
        <button style={{ padding: '8px 14px', background: t.danger, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>1단계로</button>
      </div>

      {/* Market preview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {markets.map(m => {
          const hasError = m.issues.some(i => i.type === 'error');
          const hasWarn = m.issues.some(i => i.type === 'warn');
          return (
            <div key={m.id} style={{
              background: t.card,
              border: `1px solid ${hasError ? `color-mix(in oklch, ${t.danger} 35%, transparent)` : t.border}`,
              borderRadius: 14, padding: 18, position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ width: 36, height: 36, borderRadius: 18, background: `color-mix(in oklch, ${t[m.id]} 14%, transparent)`, color: t[m.id], display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>
                  {m.label.slice(0, 1)}
                </span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: t.faint, marginTop: 1 }}>{m.cat}</div>
                </div>
                <span style={{ marginLeft: 'auto' }}>
                  {hasError
                    ? studioPill('등록 불가', t.danger, t.dangerBg, { dot: true })
                    : hasWarn
                      ? studioPill('확인 필요', t.warn, t.warnBg, { dot: true })
                      : studioPill('준비됨', t.ok, t.okBg, { dot: true })}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 24, padding: '10px 0', borderTop: `1px solid ${t.border}`, borderBottom: m.issues.length > 0 ? `1px solid ${t.border}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 11, color: t.faint, fontWeight: 600 }}>표시가격</div>
                  <div style={{ fontSize: 14, color: t.ink, fontWeight: 600, marginTop: 1 }}>₩29,000</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: t.faint, fontWeight: 600 }}>예상 수수료</div>
                  <div style={{ fontSize: 14, color: t.ink, fontWeight: 600, marginTop: 1 }}>₩{m.fee}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: t.faint, fontWeight: 600 }}>예상 정산</div>
                  <div style={{ fontSize: 14, color: t.ok, fontWeight: 700, marginTop: 1 }}>₩{(29000 - parseInt(m.fee.replace(',',''))).toLocaleString()}</div>
                </div>
              </div>
              {m.issues.map((iss, idx) => (
                <div key={idx} style={{
                  marginTop: 10, padding: '10px 12px',
                  background: iss.type === 'error' ? t.dangerBg : t.warnBg,
                  borderRadius: 10, fontSize: 12.5,
                  color: iss.type === 'error' ? t.danger : t.warn,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <span style={{ fontWeight: 700, flex: '0 0 auto' }}>{iss.type === 'error' ? '오류' : '안내'}</span>
                  <span style={{ flex: 1, color: t.text, whiteSpace: 'normal' }}>{iss.msg}</span>
                </div>
              ))}
              {m.issues.length === 0 && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: t.okBg, borderRadius: 10, fontSize: 12.5, color: t.ok, fontWeight: 600 }}>
                  ✓ 검증 통과 · 등록 준비 완료
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action bar */}
      <div style={{
        marginTop: 22, padding: '16px 22px', background: t.card,
        border: `1px solid ${t.border}`, borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 6px 18px -8px rgba(0,0,0,0.12)',
      }}>
        <button style={{ padding: '10px 16px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>← 이전 단계</button>
        <div style={{ flex: 1, fontSize: 12.5, color: t.faint }}>
          오류를 해결하면 4개 마켓에 동시 등록할 수 있어요. 지금은 3개 마켓만 진행 가능합니다.
        </div>
        <button style={{ padding: '10px 22px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700 }}>
          3개 마켓에 등록 →
        </button>
      </div>
    </div>,
    {
      title: '미리보기',
      sub: '단계 4 / 5 · 마켓별 변환 결과를 확인하세요',
      cta: <button style={{ padding: '8px 14px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }}>임시저장 후 나가기</button>,
      sidebarActive: 'register',
    }
  );
}

// ========== SCREEN: Orders ==========
function StudioOrders() {
  const t = studioTokens;
  const stages = [
    { label: '신규 수집', value: 37, color: t.info, bg: t.infoBg, hint: '오늘 들어온 주문', icon: '📥' },
    { label: '로젠 등록', value: 31, color: t.ok, bg: t.okBg, hint: '집하 예약 완료', icon: '🚚' },
    { label: '출력 대기', value: 24, color: t.warn, bg: t.warnBg, hint: '운송장 인쇄 필요', icon: '🖨️' },
    { label: '제출 완료', value: 12, color: t.faint, bg: t.card2, hint: '마켓 송장 제출', icon: '✓' },
  ];
  const markets = [
    { id: 'm1', label: '네이버 스마트스토어', n: 14, pend: 9 },
    { id: 'm2', label: '쿠팡', n: 12, pend: 8 },
    { id: 'm3', label: 'G마켓', n: 7, pend: 4 },
    { id: 'm4', label: '옥션', n: 4, pend: 3 },
  ];
  const orders = [
    { id: 'NS-820194', m: 'm1', name: '오가닉 면 티셔츠 [블랙/M]', who: '김*수', status: 'collected', time: '14:22' },
    { id: 'CP-118372', m: 'm2', name: '대용량 무선 청소기 V12 PRO', who: '이*영', status: 'logen_registered', time: '14:18' },
    { id: 'NS-820188', m: 'm1', name: '캠핑 폴딩 체어 (그레이) × 2', who: '박*철', status: 'waybill_printed', time: '14:11' },
    { id: 'AC-552901', m: 'm4', name: '핸드드립 커피 원두 200g', who: '최*진', status: 'logen_failed', time: '14:02' },
    { id: 'GM-339201', m: 'm3', name: '강아지 자동 급식기 5L', who: '정*아', status: 'tracking_submitted', time: '13:54' },
    { id: 'CP-118359', m: 'm2', name: '코튼 라이트 트렌치코트', who: '한*민', status: 'logen_registered', time: '13:47' },
  ];
  const statusMap = {
    collected:           { fg: t.info,   bg: t.infoBg,   label: '수집됨' },
    logen_registered:    { fg: t.ok,     bg: t.okBg,     label: '로젠 등록' },
    waybill_printed:     { fg: t.accent, bg: t.accentBg, label: '출력 완료' },
    tracking_submitted:  { fg: t.faint,  bg: t.card2,    label: '제출 완료' },
    logen_failed:        { fg: t.danger, bg: t.dangerBg, label: '로젠 실패' },
  };

  return studioShell(
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 30px 30px' }}>
      {/* Stage flow */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
        padding: 22, marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>오늘의 배송 흐름</div>
            <div style={{ fontSize: 12.5, color: t.faint, marginTop: 2 }}>4단계로 한눈에 확인하세요</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button style={{ padding: '10px 16px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>운송장 출력 (24)</button>
            <button style={{ padding: '10px 16px', background: t.card, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>송장 일괄 제출</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, alignItems: 'stretch', position: 'relative' }}>
          {stages.map((s, i) => (
            <div key={s.label} style={{ position: 'relative' }}>
              <div style={{
                background: s.bg, borderRadius: 12, padding: '14px 16px',
                margin: i === 0 ? '0 8px 0 0' : i === stages.length - 1 ? '0 0 0 8px' : '0 8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: t.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11.5, color: t.dim, marginTop: 6 }}>{s.hint}</div>
              </div>
              {i < stages.length - 1 && (
                <span style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', color: t.faint, fontSize: 14, zIndex: 1 }}>›</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Orders list */}
        <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>주문 목록</div>
            <span style={{ fontSize: 12, color: t.faint }}>37건</span>
            <div style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'center' }}>
              {['전체','수집','로젠','출력','제출','실패'].map((c, i) => (
                <span key={c} style={{
                  fontSize: 12, padding: '5px 11px', borderRadius: 999,
                  background: i === 0 ? t.ink : 'transparent',
                  color: i === 0 ? '#fff' : t.dim,
                  fontWeight: 600,
                }}>{c}</span>
              ))}
            </div>
            <input placeholder="검색…" style={{
              background: t.card2, color: t.text, border: `1px solid ${t.border}`,
              borderRadius: 8, padding: '6px 12px', fontSize: 12.5, width: 160, outline: 'none',
            }} />
          </div>
          <div style={{ borderTop: `1px solid ${t.border}` }}>
            {orders.map((o, i) => (
              <div key={o.id} style={{
                display: 'grid', gridTemplateColumns: '90px 1fr 100px 110px 60px',
                padding: '13px 18px', alignItems: 'center', gap: 12, fontSize: 13,
                borderBottom: i < orders.length - 1 ? `1px solid ${t.border}` : 'none',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {marketIdentity(o.m, '', 'sm', 'bar')}
                  <span style={{ fontSize: 12, color: t.dim, fontWeight: 600 }}>{o.id.split('-')[0]}</span>
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: t.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                  <div style={{ fontSize: 11.5, color: t.faint, marginTop: 1 }}>{o.id} · {o.who}</div>
                </div>
                <span>{studioPill(statusMap[o.status].label, statusMap[o.status].fg, statusMap[o.status].bg, { dot: true })}</span>
                <span style={{ fontSize: 12, color: t.faint }}>{o.time}</span>
                <span style={{ fontSize: 12, color: t.dim, textAlign: 'right' }}>›</span>
              </div>
            ))}
          </div>
        </section>

        {/* Market sync sidebar */}
        <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 18, height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>마켓별 신규</div>
              <div style={{ fontSize: 11.5, color: t.faint, marginTop: 2 }}>최근 동기화 14:22</div>
            </div>
            <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 4, background: t.ok }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {markets.map(m => (
              <div key={m.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {marketIdentity(m.id, m.label, 'sm', 'logo')}
                  <span style={{ fontSize: 12.5, color: t.ink, fontWeight: 500, flex: 1 }}>{m.label}</span>
                  <span style={{ fontSize: 14, color: t.ink, fontWeight: 700 }}>{m.n}</span>
                </div>
                <div style={{ height: 4, background: t.card2, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(m.pend / m.n) * 100}%`, height: '100%', background: t[m.id] }} />
                </div>
                <div style={{ fontSize: 11, color: t.faint, marginTop: 4 }}>대기 {m.pend} / 등록 {m.n - m.pend}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>,
    {
      title: '주문 현황',
      sub: '오늘 들어온 주문 37건 · 자동 동기화 매 10분',
      cta: studioPrimaryBtn('주문 전체 목록'),
      sidebarActive: 'orders',
    }
  );
}

Object.assign(window, {
  StudioDashboard, StudioRegister, StudioOrders,
  studioTokens, studioShell, studioPrimaryBtn, studioPill, marketIdentity,
});
