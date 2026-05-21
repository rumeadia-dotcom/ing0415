/* global React */
// Concept A — "Console": dense operator dashboard.
// Dark slate, mono numerals, tight rows, sharp 3px corners.

const consoleTokens = {
  bg:       'oklch(0.18 0.005 250)',
  surface:  'oklch(0.22 0.005 250)',
  surface2: 'oklch(0.25 0.006 250)',
  border:   'oklch(0.32 0.008 250)',
  borderHi: 'oklch(0.42 0.012 250)',
  text:     'oklch(0.96 0 0)',
  dim:      'oklch(0.68 0.01 250)',
  faint:    'oklch(0.50 0.01 250)',
  ok:       'oklch(0.78 0.16 150)',
  warn:     'oklch(0.82 0.16 80)',
  danger:   'oklch(0.72 0.19 25)',
  info:     'oklch(0.74 0.14 240)',
  accent:   'oklch(0.85 0.16 95)', // amber-yellow primary
  // Marketplaces — abstracted (NOT brand colors)
  m1: 'oklch(0.72 0.17 145)', // 네이버
  m2: 'oklch(0.72 0.19 25)',  // 쿠팡
  m3: 'oklch(0.72 0.14 220)', // G마켓
  m4: 'oklch(0.72 0.16 320)', // 옥션
};

const consoleShell = (children, { title, sub, cta, sidebarActive }) => {
  const t = consoleTokens;
  const wrap = {
    width: '100%', height: '100%', display: 'grid',
    gridTemplateColumns: '212px 1fr',
    background: t.bg, color: t.text,
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    fontSize: 13, lineHeight: 1.4,
    fontFeatureSettings: '"ss01","cv11"',
  };
  const side = {
    background: t.bg, borderRight: `1px solid ${t.border}`,
    padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2,
  };
  const navItems = [
    { id: 'dash', label: '대시보드', kbd: 'D' },
    { id: 'register', label: '상품 등록', kbd: 'N' },
    { id: 'history', label: '등록 이력', kbd: 'H' },
    { id: 'markets', label: '마켓 계정', kbd: 'M' },
    { id: 'orders', label: '주문 현황', kbd: 'O' },
    { id: 'shipping', label: '배송 처리', kbd: 'S' },
    { id: 'templates', label: '템플릿', kbd: 'T' },
    { id: 'settings', label: '설정', kbd: ',' },
  ];
  return (
    <div style={wrap}>
      <aside style={side}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 14px' }}>
          <div style={{ width: 22, height: 22, borderRadius: 3, background: t.accent, display: 'grid', placeItems: 'center', color: '#1a1a1a', fontWeight: 700, fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }}>M</div>
          <div style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>MarketCast</div>
          <div style={{ marginLeft: 'auto', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: t.faint }}>v1.4.2</div>
        </div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.faint, padding: '8px 8px 4px' }}>워크스페이스</div>
        {navItems.map(n => (
          <div key={n.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
            borderRadius: 3, fontSize: 13,
            background: n.id === sidebarActive ? t.surface : 'transparent',
            color: n.id === sidebarActive ? t.text : t.dim,
            borderLeft: `2px solid ${n.id === sidebarActive ? t.accent : 'transparent'}`,
            marginLeft: -2, paddingLeft: 10,
          }}>
            <span style={{ width: 14, height: 14, border: `1px solid ${t.borderHi}`, borderRadius: 2, opacity: 0.7 }} />
            <span style={{ flex: 1 }}>{n.label}</span>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: t.faint, padding: '1px 4px', border: `1px solid ${t.border}`, borderRadius: 2 }}>{n.kbd}</span>
          </div>
        ))}
        <div style={{ marginTop: 'auto', borderTop: `1px solid ${t.border}`, padding: '10px 8px 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 12, background: t.surface2, display: 'grid', placeItems: 'center', fontSize: 11, color: t.dim }}>K</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>konai-seller</div>
            <div style={{ fontSize: 10, color: t.faint, fontFamily: '"IBM Plex Mono", monospace' }}>1인 셀러 · KR</div>
          </div>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: t.ok }} />
        </div>
      </aside>
      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          borderBottom: `1px solid ${t.border}`, padding: '14px 22px',
          display: 'flex', alignItems: 'center', gap: 18,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h1>
              <span style={{ fontSize: 11, color: t.faint, fontFamily: '"IBM Plex Mono", monospace' }}>{sub}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: `1px solid ${t.border}`, borderRadius: 3, fontSize: 12, color: t.dim }}>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11 }}>⌘K</span>
            <span style={{ color: t.faint }}>명령 팔레트</span>
          </div>
          {cta}
        </header>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
      </main>
    </div>
  );
};

const consolePrimaryBtn = (label, { ghost } = {}) => {
  const t = consoleTokens;
  return (
    <button style={{
      padding: '6px 14px', borderRadius: 3,
      background: ghost ? 'transparent' : t.accent,
      color: ghost ? t.text : '#1a1a1a',
      border: ghost ? `1px solid ${t.border}` : 'none',
      fontWeight: 600, fontSize: 13,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {!ghost && <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11 }}>+</span>}
      {label}
    </button>
  );
};

const consolePill = (label, color, { dot } = {}) => {
  const t = consoleTokens;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 7px', borderRadius: 2,
      background: `color-mix(in oklch, ${color} 16%, transparent)`,
      color: color,
      fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: 3, background: color }} />}
      {label}
    </span>
  );
};

const consoleMarketChip = (id, label) => {
  const t = consoleTokens;
  const color = { m1: t.m1, m2: t.m2, m3: t.m3, m4: t.m4 }[id];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '1px 6px 1px 5px', borderRadius: 2,
      background: t.surface2, border: `1px solid ${t.border}`,
      fontSize: 11, color: t.text,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 1, background: color }} />
      {label}
    </span>
  );
};

// ========== SCREEN: Dashboard ==========
function ConsoleDashboard() {
  const t = consoleTokens;
  const kpis = [
    { label: '오늘 등록', value: '14', hint: '+3 vs 어제', trend: '+27%', good: true, spark: [3,5,4,7,6,9,11,14] },
    { label: '진행 중', value: '2', hint: '러닝 1 · 리트라이 1', trend: 'LIVE', good: null, spark: [0,1,2,3,2,3,2,2] },
    { label: '7일 성공률', value: '94.3%', hint: '83/88 jobs', trend: '+1.8pp', good: true, spark: [88,90,89,91,92,93,94,94] },
    { label: '평균 소요', value: '2m 17s', hint: '잡당 (7일)', trend: '−12s', good: true, spark: [180,170,165,160,158,150,140,137] },
  ];

  const jobs = [
    { id: '#J-2847', name: '오가닉 면 티셔츠 [블랙/M]', status: 'running', markets: ['m1','m2','m3','m4'], time: '14초 전', dur: '00:00:14' },
    { id: '#J-2846', name: '대용량 무선 청소기 V12 PRO', status: 'partial', markets: ['m1','m2','m4'], time: '3분 전', dur: '02:11' },
    { id: '#J-2845', name: '캠핑 폴딩 체어 (그레이)', status: 'succeeded', markets: ['m1','m2','m3','m4'], time: '8분 전', dur: '01:54' },
    { id: '#J-2844', name: '핸드드립 커피 원두 200g x2', status: 'succeeded', markets: ['m1','m3'], time: '14분 전', dur: '01:32' },
    { id: '#J-2843', name: '강아지 자동 급식기 5L', status: 'failed', markets: ['m2'], time: '21분 전', dur: '00:48' },
    { id: '#J-2842', name: '코튼 라이트 트렌치코트', status: 'succeeded', markets: ['m1','m2','m3','m4'], time: '34분 전', dur: '02:24' },
    { id: '#J-2841', name: '미니 가습기 USB 무드등', status: 'succeeded', markets: ['m1','m2'], time: '52분 전', dur: '01:11' },
  ];

  const statusMap = {
    running:   { color: t.info,   label: 'RUNNING' },
    partial:   { color: t.warn,   label: 'PARTIAL' },
    succeeded: { color: t.ok,     label: 'OK' },
    failed:    { color: t.danger, label: 'FAILED' },
  };

  return consoleShell(
    <div style={{ height: '100%', overflow: 'auto', padding: '18px 22px 22px' }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: `1px solid ${t.border}`, borderRadius: 4, background: t.surface, marginBottom: 16 }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ padding: '14px 16px', borderRight: i < 3 ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.dim }}>{k.label}</span>
              <span style={{
                marginLeft: 'auto',
                fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
                color: k.trend === 'LIVE' ? t.info : (k.good ? t.ok : t.danger),
                padding: '1px 5px', borderRadius: 2,
                background: `color-mix(in oklch, ${k.trend === 'LIVE' ? t.info : (k.good ? t.ok : t.danger)} 14%, transparent)`,
              }}>{k.trend}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 26, fontWeight: 600, fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '-0.02em' }}>{k.value}</div>
            </div>
            <div style={{ fontSize: 11, color: t.faint, marginTop: 4, fontFamily: '"IBM Plex Mono", monospace' }}>{k.hint}</div>
            {/* sparkline */}
            <svg viewBox="0 0 100 24" style={{ width: '100%', height: 24, marginTop: 8, display: 'block' }}>
              <polyline
                fill="none" stroke={k.trend === 'LIVE' ? t.info : (k.good ? t.ok : t.danger)} strokeWidth="1.2"
                points={k.spark.map((v, idx) => {
                  const max = Math.max(...k.spark); const min = Math.min(...k.spark);
                  const x = (idx / (k.spark.length - 1)) * 100;
                  const y = 22 - ((v - min) / (max - min || 1)) * 20;
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          </div>
        ))}
      </div>

      {/* 2/3 + 1/3 split */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        {/* Jobs table */}
        <section style={{ border: `1px solid ${t.border}`, borderRadius: 4, background: t.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>최근 등록</span>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: t.faint }}>last 20 · live</span>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: t.ok, animation: 'none' }} />
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 11, color: t.dim, padding: '2px 6px', border: `1px solid ${t.border}`, borderRadius: 2 }}>ALL</span>
              <span style={{ fontSize: 11, color: t.faint, padding: '2px 6px' }}>FAILED</span>
              <span style={{ fontSize: 11, color: t.faint, padding: '2px 6px' }}>PARTIAL</span>
            </span>
            <span style={{ fontSize: 11, color: t.dim, textDecoration: 'underline', textUnderlineOffset: 3 }}>전체 보기 →</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '78px 1fr 100px 150px 78px 68px', padding: '6px 14px', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: t.faint, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${t.border}` }}>
            <span>ID</span><span>NAME</span><span>STATUS</span><span>MARKETS</span><span>DUR</span><span style={{ textAlign: 'right' }}>WHEN</span>
          </div>
          {jobs.map((j, i) => (
            <div key={j.id} style={{
              display: 'grid', gridTemplateColumns: '78px 1fr 100px 150px 78px 68px',
              padding: '9px 14px', alignItems: 'center', fontSize: 12,
              borderBottom: i < jobs.length - 1 ? `1px solid ${t.border}` : 'none',
              borderLeft: `2px solid ${statusMap[j.status].color}`, marginLeft: -1,
            }}>
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: t.dim }}>{j.id}</span>
              <span style={{ color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{j.name}</span>
              <span>{consolePill(statusMap[j.status].label, statusMap[j.status].color, { dot: true })}</span>
              <span style={{ display: 'flex', gap: 3 }}>
                {['m1','m2','m3','m4'].map(m => (
                  <span key={m} style={{
                    width: 14, height: 14, borderRadius: 2,
                    background: j.markets.includes(m) ? t[m] : 'transparent',
                    border: `1px solid ${j.markets.includes(m) ? t[m] : t.border}`,
                    opacity: j.markets.includes(m) ? 1 : 0.4,
                  }} />
                ))}
              </span>
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: t.dim }}>{j.dur}</span>
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: t.faint, textAlign: 'right' }}>{j.time}</span>
            </div>
          ))}
        </section>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Market health */}
          <section style={{ border: `1px solid ${t.border}`, borderRadius: 4, background: t.surface }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>마켓 연결</span>
              <span style={{ marginLeft: 'auto', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: t.dim }}>4 / 5 ACTIVE</span>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { id: 'm1', label: '네이버 스마트스토어', status: 'ok', exp: '92일' },
                { id: 'm2', label: '쿠팡', status: 'ok', exp: '41일' },
                { id: 'm3', label: 'G마켓', status: 'warn', exp: '6일' },
                { id: 'm4', label: '옥션', status: 'ok', exp: '88일' },
                { id: 'm5', label: '11번가', status: 'off', exp: '미연결' },
              ].map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 1, background: m.id === 'm5' ? t.faint : t[m.id] }} />
                  <span style={{ fontSize: 12, color: m.status === 'off' ? t.faint : t.text }}>{m.label}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: m.status === 'warn' ? t.warn : (m.status === 'off' ? t.faint : t.dim) }}>{m.exp}</span>
                  {m.status === 'warn' && consolePill('만료임박', t.warn)}
                  {m.status === 'off' && consolePill('off', t.faint)}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 14px', borderTop: `1px solid ${t.border}`, background: `color-mix(in oklch, ${t.warn} 8%, transparent)`, fontSize: 11, color: t.warn, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: '"IBM Plex Mono", monospace' }}>!</span>
              G마켓 토큰 6일 후 만료 — 재인증
            </div>
          </section>

          {/* v2 placeholder */}
          <section style={{ border: `1px dashed ${t.border}`, borderRadius: 4, background: 'transparent', padding: 14, minHeight: 130, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: t.dim, fontWeight: 600 }}>마켓별 통계</span>
              {consolePill('v2', t.faint)}
            </div>
            {/* mock bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56, opacity: 0.4 }}>
              {[60, 38, 52, 28].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: [t.m1,t.m2,t.m3,t.m4][i], borderRadius: '2px 2px 0 0' }} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: t.faint, marginTop: 8, fontFamily: '"IBM Plex Mono", monospace' }}>마켓별 성공률 차트 — v2 예정</div>
          </section>
        </div>
      </div>
    </div>,
    {
      title: '대시보드',
      sub: '/dashboard · 등록 현황과 최근 작업',
      cta: consolePrimaryBtn('상품 등록 (N)'),
      sidebarActive: 'dash',
    }
  );
}

// ========== SCREEN: Register (Step 4 — Preview) ==========
function ConsoleRegister() {
  const t = consoleTokens;
  const steps = [
    { n: 1, label: '상품 정보', done: true },
    { n: 2, label: '이미지', done: true },
    { n: 3, label: '마켓 · 카테고리', done: true },
    { n: 4, label: '미리보기', current: true },
    { n: 5, label: '결과', done: false },
  ];

  const markets = [
    {
      id: 'm1', label: '네이버 스마트스토어', cat: '패션의류 > 남성의류 > 티셔츠',
      fee: '14,500원 / 건', priceShown: '29,000원', issues: [], ok: true,
    },
    {
      id: 'm2', label: '쿠팡', cat: '패션의류잡화 > 남성의류 > 반팔티셔츠',
      fee: '16,820원 / 건', priceShown: '29,000원',
      issues: [{ type: 'warn', code: 'image_size_too_small', msg: '이미지 1장이 800×800 미만 (권장 1000×1000)' }], ok: true,
    },
    {
      id: 'm3', label: 'G마켓', cat: '의류 > 남성캐주얼 > 티셔츠',
      fee: '13,920원 / 건', priceShown: '29,000원',
      issues: [{ type: 'error', code: 'brand_required', msg: '의류 카테고리는 브랜드 입력 필수' }], ok: false,
    },
    {
      id: 'm4', label: '옥션', cat: '패션 > 남성의류 > 반팔티',
      fee: '13,920원 / 건', priceShown: '29,000원', issues: [], ok: true,
    },
  ];

  return consoleShell(
    <div style={{ height: '100%', overflow: 'auto', padding: '16px 22px 22px' }}>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 18, padding: 12, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 4 }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: s.current ? 1 : (s.done ? 0.85 : 0.5) }}>
              <span style={{
                width: 22, height: 22, borderRadius: 2,
                background: s.current ? t.accent : (s.done ? `color-mix(in oklch, ${t.ok} 22%, transparent)` : t.surface2),
                color: s.current ? '#1a1a1a' : (s.done ? t.ok : t.dim),
                fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, fontWeight: 600,
                display: 'grid', placeItems: 'center',
                border: s.done && !s.current ? `1px solid ${t.ok}` : `1px solid ${t.border}`,
              }}>{s.done ? '✓' : s.n}</span>
              <span style={{ fontSize: 12, color: s.current ? t.text : t.dim, fontWeight: s.current ? 600 : 400 }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <span style={{ flex: 1, height: 1, background: t.border, margin: '0 12px' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Header row: product summary + blockers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, padding: 14, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 4 }}>
          <div className="mc-img-ph" style={{ width: 72, height: 72, borderRadius: 3 }}>PRODUCT</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: t.faint, fontFamily: '"IBM Plex Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PRODUCT_ID · pd_8a4f</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 3 }}>오가닉 면 티셔츠 [블랙/M]</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: t.dim }}>
              <span><span style={{ color: t.faint }}>가격</span> 29,000</span>
              <span><span style={{ color: t.faint }}>정가</span> 35,000</span>
              <span><span style={{ color: t.faint }}>이미지</span> 5장</span>
              <span><span style={{ color: t.faint }}>배송</span> 기본정책 (3,000)</span>
            </div>
          </div>
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 4, padding: 14 }}>
          <div style={{ fontSize: 10, color: t.faint, fontFamily: '"IBM Plex Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>VALIDATION SUMMARY</div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontFamily: '"IBM Plex Mono", monospace', color: t.ok }}>3</div>
              <div style={{ fontSize: 10, color: t.dim }}>OK</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontFamily: '"IBM Plex Mono", monospace', color: t.warn }}>1</div>
              <div style={{ fontSize: 10, color: t.dim }}>WARN</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontFamily: '"IBM Plex Mono", monospace', color: t.danger }}>1</div>
              <div style={{ fontSize: 10, color: t.dim }}>ERROR</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontFamily: '"IBM Plex Mono", monospace', color: t.text }}>59,160</div>
              <div style={{ fontSize: 10, color: t.dim }}>예상 수수료 ₩</div>
            </div>
          </div>
        </div>
      </div>

      {/* Market preview grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {markets.map(m => {
          const hasError = m.issues.some(i => i.type === 'error');
          return (
            <div key={m.id} style={{
              background: t.surface, border: `1px solid ${hasError ? t.danger : t.border}`, borderRadius: 4,
              padding: 14, position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 18, height: 18, borderRadius: 2, background: t[m.id] }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {hasError
                    ? consolePill('등록 불가', t.danger, { dot: true })
                    : m.issues.length > 0
                      ? consolePill('경고', t.warn, { dot: true })
                      : consolePill('OK', t.ok, { dot: true })}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', rowGap: 6, fontSize: 11, marginBottom: 10 }}>
                <span style={{ color: t.faint, fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, textTransform: 'uppercase' }}>카테고리</span>
                <span style={{ color: t.text, fontSize: 11 }}>{m.cat}</span>
                <span style={{ color: t.faint, fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, textTransform: 'uppercase' }}>표시가격</span>
                <span style={{ color: t.text, fontFamily: '"IBM Plex Mono", monospace' }}>{m.priceShown}</span>
                <span style={{ color: t.faint, fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, textTransform: 'uppercase' }}>수수료</span>
                <span style={{ color: t.text, fontFamily: '"IBM Plex Mono", monospace' }}>{m.fee}</span>
              </div>
              {m.issues.map((iss, idx) => (
                <div key={idx} style={{
                  fontSize: 11, padding: '6px 8px', borderRadius: 2,
                  background: `color-mix(in oklch, ${iss.type === 'error' ? t.danger : t.warn} 12%, transparent)`,
                  color: iss.type === 'error' ? t.danger : t.warn,
                  display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4,
                  borderLeft: `2px solid ${iss.type === 'error' ? t.danger : t.warn}`,
                }}>
                  <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, opacity: 0.8, minWidth: 80 }}>{iss.code}</span>
                  <span style={{ flex: 1, color: t.text, opacity: 0.92, whiteSpace: 'normal' }}>{iss.msg}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Sticky footer */}
      <div style={{
        marginTop: 18, padding: '12px 16px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 4,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button style={{ padding: '6px 12px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 3, fontSize: 13 }}>← 이전 (마켓 선택)</button>
        <div style={{ flex: 1, fontSize: 11, color: t.faint, fontFamily: '"IBM Plex Mono", monospace' }}>
          <span style={{ color: t.danger }}>● 1개 마켓 등록 불가</span> · 이전 단계에서 브랜드를 입력하세요
        </div>
        <button disabled style={{
          padding: '7px 18px', borderRadius: 3,
          background: `color-mix(in oklch, ${t.accent} 30%, transparent)`,
          color: 'rgba(255,255,255,0.5)', border: 'none', fontWeight: 600, fontSize: 13,
          cursor: 'not-allowed',
        }}>
          일괄 등록 실행 (3개 마켓) →
        </button>
      </div>
    </div>,
    {
      title: '상품 등록',
      sub: '/register/preview · 4단계 · 미리보기',
      cta: <span style={{ fontSize: 12, color: t.dim, fontFamily: '"IBM Plex Mono", monospace' }}>Esc 로 나가기</span>,
      sidebarActive: 'register',
    }
  );
}

// ========== SCREEN: Orders ==========
function ConsoleOrders() {
  const t = consoleTokens;
  const summary = [
    { label: '신규 주문', value: '37', delta: '+6 / 1h', color: t.info },
    { label: '로젠 등록', value: '31', delta: '83.7%', color: t.ok },
    { label: '출력 대기', value: '24', delta: '운송장 미출력', color: t.warn },
    { label: '제출 완료', value: '12', delta: '4 마켓 평균', color: t.dim },
  ];
  const markets = [
    { id: 'm1', label: '네이버', n: 14, w: 9, sync: '3분 전' },
    { id: 'm2', label: '쿠팡', n: 12, w: 8, sync: '3분 전' },
    { id: 'm3', label: 'G마켓', n: 7, w: 4, sync: '7분 전' },
    { id: 'm4', label: '옥션', n: 4, w: 3, sync: '3분 전' },
  ];
  const orders = [
    { id: 'NS-820194', m: 'm1', name: '오가닉 면 티셔츠 [블랙/M]', who: '김*수', status: 'collected', time: '14:22' },
    { id: 'CP-118372', m: 'm2', name: '대용량 무선 청소기 V12 PRO', who: '이*영', status: 'logen_registered', time: '14:18', wb: '3812 9920 1183' },
    { id: 'NS-820188', m: 'm1', name: '캠핑 폴딩 체어 (그레이) × 2', who: '박*철', status: 'waybill_printed', time: '14:11', wb: '3812 9920 1180' },
    { id: 'AC-552901', m: 'm4', name: '핸드드립 커피 원두 200g', who: '최*진', status: 'logen_failed', time: '14:02', wb: '—' },
    { id: 'GM-339201', m: 'm3', name: '강아지 자동 급식기 5L', who: '정*아', status: 'tracking_submitted', time: '13:54', wb: '3812 9919 8821' },
    { id: 'CP-118359', m: 'm2', name: '코튼 라이트 트렌치코트', who: '한*민', status: 'logen_registered', time: '13:47', wb: '3812 9920 1175' },
    { id: 'NS-820171', m: 'm1', name: '미니 가습기 USB 무드등 × 3', who: '윤*은', status: 'tracking_submitted', time: '13:31', wb: '3812 9919 8814' },
  ];
  const statusMap = {
    collected:           { color: t.info,   label: '수집됨' },
    logen_registered:    { color: t.ok,     label: '로젠 등록' },
    waybill_printed:     { color: t.accent, label: '출력 완료' },
    tracking_submitted:  { color: t.faint,  label: '제출 완료' },
    logen_failed:        { color: t.danger, label: '로젠 실패' },
  };

  return consoleShell(
    <div style={{ height: '100%', overflow: 'auto', padding: '18px 22px 22px' }}>
      {/* Summary + quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: `1px solid ${t.border}`, borderRadius: 4, background: t.surface }}>
          {summary.map((s, i) => (
            <div key={s.label} style={{ padding: '14px 16px', borderRight: i < 3 ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.dim, marginBottom: 6 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 26, fontWeight: 600, fontFamily: '"IBM Plex Mono", monospace', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: t.faint, fontFamily: '"IBM Plex Mono", monospace' }}>{s.delta}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 4, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10, color: t.faint, fontFamily: '"IBM Plex Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>QUICK ACTIONS · s8</div>
          <button style={{ padding: '8px 12px', background: t.accent, color: '#1a1a1a', border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace' }}>▶</span> 운송장 출력 · 24건 대기
          </button>
          <button style={{ padding: '8px 12px', background: 'transparent', color: t.text, border: `1px solid ${t.border}`, borderRadius: 3, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace' }}>↑</span> 송장 일괄 제출 · 19건 준비
          </button>
        </div>
      </div>

      {/* Market sync row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {markets.map(m => (
          <div key={m.id} style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `3px solid ${t[m.id]}`, borderRadius: 4, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: t.text, fontWeight: 600 }}>{m.label}</span>
              <span style={{ marginLeft: 'auto', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: t.faint }}>sync {m.sync}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontFamily: '"IBM Plex Mono", monospace', color: t.text }}>{m.n}</div>
                <div style={{ fontSize: 10, color: t.dim }}>신규</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontFamily: '"IBM Plex Mono", monospace', color: t.warn }}>{m.w}</div>
                <div style={{ fontSize: 10, color: t.dim }}>대기</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <section style={{ border: `1px solid ${t.border}`, borderRadius: 4, background: t.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>전체 주문</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {['전체 37', '수집 6', '로젠 18', '출력 7', '제출 5', '실패 1'].map((c, i) => (
              <span key={c} style={{
                fontSize: 11, padding: '2px 7px', borderRadius: 2,
                color: i === 0 ? t.text : t.dim,
                background: i === 0 ? t.surface2 : 'transparent',
                border: `1px solid ${i === 0 ? t.borderHi : t.border}`,
              }}>{c}</span>
            ))}
          </div>
          <input placeholder="주문번호 · 상품명 · 수취인 검색…" style={{
            marginLeft: 'auto', background: t.bg, color: t.text,
            border: `1px solid ${t.border}`, borderRadius: 3, padding: '4px 10px',
            fontSize: 12, width: 220, outline: 'none',
          }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 70px 1fr 90px 130px 150px 70px', padding: '6px 14px', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: t.faint, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${t.border}` }}>
          <span>주문ID</span><span>마켓</span><span>상품</span><span>수취인</span><span>상태</span><span>운송장</span><span style={{ textAlign: 'right' }}>시각</span>
        </div>
        {orders.map((o, i) => (
          <div key={o.id} style={{
            display: 'grid', gridTemplateColumns: '90px 70px 1fr 90px 130px 150px 70px',
            padding: '8px 14px', alignItems: 'center', fontSize: 12,
            borderBottom: i < orders.length - 1 ? `1px solid ${t.border}` : 'none',
          }}>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: t.dim }}>{o.id}</span>
            <span>{consoleMarketChip(o.m, { m1: '네이버', m2: '쿠팡', m3: 'G마켓', m4: '옥션' }[o.m])}</span>
            <span style={{ color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{o.name}</span>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: t.dim }}>{o.who}</span>
            <span>{consolePill(statusMap[o.status].label, statusMap[o.status].color, { dot: true })}</span>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: o.wb === '—' ? t.faint : t.dim }}>{o.wb || '—'}</span>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: t.faint, textAlign: 'right' }}>{o.time}</span>
          </div>
        ))}
      </section>
    </div>,
    {
      title: '주문 현황',
      sub: '/orders · 오늘 · 자동 갱신 (10분)',
      cta: <button style={{ padding: '6px 12px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 3, fontSize: 12 }}>새로고침</button>,
      sidebarActive: 'orders',
    }
  );
}

Object.assign(window, { ConsoleDashboard, ConsoleRegister, ConsoleOrders });
