/* global React */
// Concept C — "Grid": editorial bold. Paper + ink + single electric accent.
// Big display numerals, strong rules, asymmetric layouts.

const gridTokens = {
  bg:       'oklch(0.985 0 0)',
  paper:    'oklch(0.97 0 0)',
  ink:      'oklch(0.13 0 0)',
  text:     'oklch(0.13 0 0)',
  dim:      'oklch(0.42 0 0)',
  faint:    'oklch(0.62 0 0)',
  hairline: 'oklch(0.82 0 0)',
  rule:     'oklch(0.13 0 0)',
  accent:   'oklch(0.55 0.22 258)',   // electric cobalt
  accentBg: 'oklch(0.94 0.04 258)',
  ok:       'oklch(0.55 0.13 155)',
  warn:     'oklch(0.55 0.16 75)',
  danger:   'oklch(0.55 0.22 28)',
  // Markets: greyscale chips with a single colored bar so brand identity reads from position, not color
  m1: 'oklch(0.5 0.13 155)',
  m2: 'oklch(0.55 0.19 28)',
  m3: 'oklch(0.5 0.12 218)',
  m4: 'oklch(0.5 0.16 315)',
};

const gridShell = (children, { sectionLabel, title, lede, cta, breadcrumb, slide }) => {
  const t = gridTokens;
  const wrap = {
    width: '100%', height: '100%',
    background: t.bg, color: t.text,
    fontFamily: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    fontSize: 13.5, lineHeight: 1.45,
    display: 'flex', flexDirection: 'column', minWidth: 0,
  };
  return (
    <div style={wrap}>
      {/* Top bar — minimal, no sidebar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 18,
        padding: '14px 32px', borderBottom: `1.5px solid ${t.rule}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, background: t.ink, color: t.bg, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, fontFamily: '"Space Grotesk", sans-serif' }}>M</div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.025em' }}>MarketCast</div>
        </div>
        <div style={{ height: 16, width: 1, background: t.hairline }} />
        <nav style={{ display: 'flex', gap: 22, fontSize: 13, color: t.dim }}>
          {[
            { id: 'dash', label: '대시보드' },
            { id: 'register', label: '등록' },
            { id: 'history', label: '이력' },
            { id: 'markets', label: '마켓' },
            { id: 'orders', label: '주문' },
            { id: 'shipping', label: '배송' },
            { id: 'settings', label: '설정' },
          ].map(n => (
            <span key={n.id} style={{
              color: n.id === slide ? t.ink : t.dim,
              fontWeight: n.id === slide ? 700 : 500,
              borderBottom: n.id === slide ? `2px solid ${t.accent}` : '2px solid transparent',
              paddingBottom: 4, marginBottom: -6,
            }}>{n.label}</span>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: t.faint, letterSpacing: '0.04em' }}>2026.05.21 · 14:22</span>
          {cta}
        </div>
      </div>

      {/* Editorial header */}
      <div style={{ padding: '32px 32px 24px', borderBottom: `1px solid ${t.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
              {sectionLabel}
            </div>
            <h1 style={{
              margin: 0, fontSize: 48, fontWeight: 700,
              letterSpacing: '-0.035em', lineHeight: 0.95, color: t.ink,
            }}>{title}</h1>
          </div>
          {lede && (
            <div style={{ flex: '0 0 320px', fontSize: 14, color: t.dim, lineHeight: 1.5, paddingBottom: 6, borderLeft: `1px solid ${t.hairline}`, paddingLeft: 22 }}>
              {lede}
            </div>
          )}
        </div>
        {breadcrumb && (
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: t.faint, letterSpacing: '0.08em' }}>
            {breadcrumb}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );
};

const gridChip = (label, fg) => {
  const t = gridTokens;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', fontSize: 11, fontWeight: 600,
      border: `1.5px solid ${fg}`, color: fg,
      fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>{label}</span>
  );
};

const gridBtn = (label, { primary, ghost, sm } = {}) => {
  const t = gridTokens;
  return (
    <button style={{
      padding: sm ? '6px 12px' : '11px 20px',
      background: primary ? t.ink : 'transparent',
      color: primary ? t.bg : t.ink,
      border: primary ? 'none' : `1.5px solid ${t.ink}`,
      borderRadius: 0,
      fontWeight: 700, fontSize: sm ? 12 : 13,
      letterSpacing: '-0.005em',
      display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>
      {label}
      <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>→</span>
    </button>
  );
};

// ========== SCREEN: Dashboard ==========
function GridDashboard() {
  const t = gridTokens;
  const kpis = [
    { label: '오늘 등록', value: '14', meta: '+3 vs 어제', accent: true },
    { label: '진행 중', value: '02', meta: '평균 02:17 소요' },
    { label: '7일 성공률', value: '94', unit: '%', meta: '83 / 88 잡' },
    { label: '평균 소요', value: '2:17', meta: '7-day median' },
  ];
  const jobs = [
    { n: '01', name: '오가닉 면 티셔츠 [블랙/M]', status: 'RUNNING', markets: 4, time: '14초 전' },
    { n: '02', name: '대용량 무선 청소기 V12 PRO', status: 'PARTIAL', markets: 3, time: '3분 전' },
    { n: '03', name: '캠핑 폴딩 체어 (그레이)', status: 'OK', markets: 4, time: '8분 전' },
    { n: '04', name: '핸드드립 커피 원두 200g x2', status: 'OK', markets: 2, time: '14분 전' },
    { n: '05', name: '강아지 자동 급식기 5L', status: 'FAILED', markets: 1, time: '21분 전' },
  ];
  const statusColor = { RUNNING: t.accent, PARTIAL: t.warn, OK: t.ok, FAILED: t.danger };

  return gridShell(
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* KPI band — large numerals, divided by hairlines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1.5px solid ${t.rule}` }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{
            padding: '24px 28px 28px',
            borderRight: i < 3 ? `1px solid ${t.hairline}` : 'none',
            background: k.accent ? t.accentBg : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 11, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.dim, letterSpacing: '-0.005em' }}>{k.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 16 }}>
              <span style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 0.9, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>{k.value}</span>
              {k.unit && <span style={{ fontSize: 22, fontWeight: 700, color: t.dim }}>{k.unit}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: t.faint, marginTop: 10, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.02em' }}>
              {k.meta}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', minHeight: 360 }}>
        {/* Jobs list */}
        <section style={{ padding: '24px 0 28px', borderRight: `1px solid ${t.hairline}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '0 32px 14px', borderBottom: `1.5px solid ${t.rule}` }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>최근 등록</h2>
            <span style={{ fontSize: 11, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>last · 20 · live</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: t.accent, fontWeight: 700, letterSpacing: '-0.005em' }}>전체 보기 →</span>
          </div>
          {jobs.map((j, i) => (
            <div key={j.n} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 100px 70px 80px',
              alignItems: 'center', gap: 16,
              padding: '18px 32px',
              borderBottom: i < jobs.length - 1 ? `1px solid ${t.hairline}` : 'none',
            }}>
              <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: t.faint, letterSpacing: '0.04em' }}>{j.n}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: t.ink, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</span>
              <span>{gridChip(j.status, statusColor[j.status])}</span>
              <span style={{ display: 'flex', gap: 2 }}>
                {[0,1,2,3].map(idx => (
                  <span key={idx} style={{ width: 14, height: 4, background: idx < j.markets ? t.ink : t.hairline }} />
                ))}
              </span>
              <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: t.faint, textAlign: 'right' }}>{j.time}</span>
            </div>
          ))}
        </section>

        {/* Right column — Market health stacked */}
        <section style={{ padding: '24px 32px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>마켓 연결</h3>
              <span style={{ fontSize: 11, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, letterSpacing: '0.08em' }}>4 / 5 ACTIVE</span>
            </div>
            {[
              { id: 'm1', label: '네이버 스마트스토어', exp: '92일', ok: true },
              { id: 'm2', label: '쿠팡', exp: '41일', ok: true },
              { id: 'm3', label: 'G마켓', exp: '6일', ok: false },
              { id: 'm4', label: '옥션', exp: '88일', ok: true },
            ].map((m, i, arr) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${t.hairline}` : `1px solid ${t.hairline}`,
              }}>
                <span style={{ width: 4, height: 22, background: t[m.id] }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink, flex: 1 }}>{m.label}</span>
                <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: m.ok ? t.faint : t.danger, fontWeight: m.ok ? 400 : 700 }}>{m.exp}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: '12px 14px', background: t.ink, color: t.bg, fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 6, height: 6, background: t.warn }} />
              <span style={{ flex: 1, fontWeight: 500 }}>G마켓 토큰 6일 후 만료</span>
              <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11 }}>RE-AUTH →</span>
            </div>
          </div>

          {/* v2 placeholder */}
          <div style={{ border: `1.5px dashed ${t.hairline}`, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.dim, letterSpacing: '-0.01em' }}>마켓별 통계</span>
              {gridChip('V2', t.faint)}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64 }}>
              {[80, 60, 70, 40].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: t[`m${i+1}`], opacity: 0.5 }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {['NV','CP','GM','AC'].map(l => (
                <span key={l} style={{ flex: 1, fontSize: 10, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, textAlign: 'center', letterSpacing: '0.05em' }}>{l}</span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>,
    {
      sectionLabel: '01 · DASHBOARD / OVERVIEW',
      title: '오늘\n14건 등록.',
      lede: 'KPI · 최근 잡 · 마켓 연결 상태를 한 화면에서. 실시간으로 자동 갱신됩니다.',
      cta: gridBtn('상품 등록', { primary: true, sm: true }),
      slide: 'dash',
    }
  );
}

// ========== SCREEN: Register (Step 4 — Preview) ==========
function GridRegister() {
  const t = gridTokens;
  const steps = [
    { n: '01', label: '상품 정보', done: true },
    { n: '02', label: '이미지', done: true },
    { n: '03', label: '마켓 · 카테고리', done: true },
    { n: '04', label: '미리보기', current: true },
    { n: '05', label: '결과', done: false },
  ];
  const markets = [
    { id: 'm1', label: '네이버 스마트스토어', cat: '패션의류 / 남성의류 / 티셔츠', fee: 14500, status: 'OK' },
    { id: 'm2', label: '쿠팡', cat: '패션의류잡화 / 남성의류 / 반팔티셔츠', fee: 16820, status: 'WARN', msg: '이미지 1장이 800×800 미만' },
    { id: 'm3', label: 'G마켓', cat: '의류 / 남성캐주얼 / 티셔츠', fee: 13920, status: 'ERROR', msg: '브랜드 입력 필수 — 1단계로 돌아가 입력하세요' },
    { id: 'm4', label: '옥션', cat: '패션 / 남성의류 / 반팔티', fee: 13920, status: 'OK' },
  ];
  const statusColor = { OK: t.ok, WARN: t.warn, ERROR: t.danger };

  return gridShell(
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Step bar — numerical, asymmetric */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: `1.5px solid ${t.rule}` }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{
            padding: '16px 18px',
            borderRight: i < 4 ? `1px solid ${t.hairline}` : 'none',
            background: s.current ? t.ink : 'transparent',
            color: s.current ? t.bg : t.ink,
            position: 'relative',
          }}>
            {s.current && <span style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderTop: `8px solid ${t.accent}`, borderRight: `8px solid transparent` }} />}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 11, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.08em', opacity: 0.6 }}>{s.n}</span>
              {s.done && <span style={{ fontSize: 11, color: t.accent }}>✓</span>}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.015em', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Product summary band */}
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 1fr 280px',
        borderBottom: `1px solid ${t.hairline}`,
      }}>
        <div className="mc-img-ph" style={{ borderRight: `1px solid ${t.hairline}`, minHeight: 120 }}>PRODUCT 1/5</div>
        <div style={{ padding: '20px 28px', borderRight: `1px solid ${t.hairline}` }}>
          <div style={{ fontSize: 11, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>PD_8A4F · DRAFT</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 8 }}>오가닉 면 티셔츠 [블랙/M]</div>
          <div style={{ display: 'flex', gap: 28, marginTop: 14, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 12 }}>
            <div><div style={{ color: t.faint, fontSize: 10, letterSpacing: '0.08em', marginBottom: 2 }}>PRICE</div><div style={{ color: t.ink, fontWeight: 700 }}>₩29,000</div></div>
            <div><div style={{ color: t.faint, fontSize: 10, letterSpacing: '0.08em', marginBottom: 2 }}>LIST</div><div style={{ color: t.ink, fontWeight: 700 }}>₩35,000</div></div>
            <div><div style={{ color: t.faint, fontSize: 10, letterSpacing: '0.08em', marginBottom: 2 }}>IMAGES</div><div style={{ color: t.ink, fontWeight: 700 }}>5</div></div>
            <div><div style={{ color: t.faint, fontSize: 10, letterSpacing: '0.08em', marginBottom: 2 }}>SHIP</div><div style={{ color: t.ink, fontWeight: 700 }}>기본</div></div>
          </div>
        </div>
        <div style={{ padding: '20px 28px' }}>
          <div style={{ fontSize: 11, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>예상 수수료</div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, marginTop: 6 }}>₩59,160</div>
          <div style={{ fontSize: 11.5, color: t.faint, marginTop: 8, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>3 / 4 마켓 · 옥션 제외</div>
        </div>
      </div>

      {/* Market preview cards in 4-up grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {markets.map((m, i) => (
          <div key={m.id} style={{
            padding: '22px 28px',
            borderRight: i % 2 === 0 ? `1px solid ${t.hairline}` : 'none',
            borderBottom: i < 2 ? `1px solid ${t.hairline}` : 'none',
            background: m.status === 'ERROR' ? `color-mix(in oklch, ${t.danger} 5%, transparent)` : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <span style={{ width: 6, height: 36, background: t[m.id] }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{`MARKET 0${i+1}`}</div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em', marginTop: 2 }}>{m.label}</div>
              </div>
              {gridChip(m.status, statusColor[m.status])}
            </div>

            <div style={{ fontSize: 12, color: t.dim, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', marginBottom: 14 }}>{m.cat}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: `1px solid ${t.hairline}` }}>
              <div style={{ padding: '10px 0', borderRight: `1px solid ${t.hairline}` }}>
                <div style={{ fontSize: 10, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>표시가격</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>₩29,000</div>
              </div>
              <div style={{ padding: '10px 0 10px 16px' }}>
                <div style={{ fontSize: 10, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>수수료</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>₩{m.fee.toLocaleString()}</div>
              </div>
            </div>

            {m.msg && (
              <div style={{
                marginTop: 14, padding: '10px 0 0', borderTop: `1.5px solid ${statusColor[m.status]}`,
                fontSize: 12.5, color: t.ink, fontWeight: 500,
              }}>
                <span style={{ color: statusColor[m.status], fontWeight: 700, marginRight: 6 }}>{m.status === 'ERROR' ? '오류' : '경고'} ›</span>
                {m.msg}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action bar — bottom rule heavy */}
      <div style={{
        borderTop: `1.5px solid ${t.rule}`,
        padding: '18px 32px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button style={{ fontSize: 13, fontWeight: 600, background: 'transparent', border: 'none', color: t.dim }}>← 마켓 · 카테고리</button>
        <div style={{ flex: 1, fontSize: 12, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.02em' }}>
          <span style={{ color: t.danger, fontWeight: 700 }}>1 ERROR</span> · 1 WARN · 진행 시 ERROR 마켓은 제외됩니다
        </div>
        {gridBtn('일괄 등록 실행', { primary: true })}
      </div>
    </div>,
    {
      sectionLabel: '02 · REGISTER / STEP 04 OF 05',
      title: '4개 마켓에\n동시 등록.',
      lede: '마켓별 변환 결과를 검토하고 등록을 시작하세요. 한 마켓 실패가 다른 마켓을 차단하지 않습니다.',
      cta: gridBtn('임시저장', { sm: true }),
      slide: 'register',
    }
  );
}

// ========== SCREEN: Orders ==========
function GridOrders() {
  const t = gridTokens;
  const stages = [
    { n: '01', label: '수집', value: 37, accent: true },
    { n: '02', label: '로젠 등록', value: 31 },
    { n: '03', label: '출력 대기', value: 24, warn: true },
    { n: '04', label: '제출 완료', value: 12 },
  ];
  const markets = [
    { id: 'm1', label: '네이버', n: 14, p: 9 },
    { id: 'm2', label: '쿠팡', n: 12, p: 8 },
    { id: 'm3', label: 'G마켓', n: 7, p: 4 },
    { id: 'm4', label: '옥션', n: 4, p: 3 },
  ];
  const orders = [
    { id: 'NS-820194', m: 'm1', name: '오가닉 면 티셔츠 [블랙/M]', who: '김*수', status: 'COLLECTED', wb: '—', time: '14:22' },
    { id: 'CP-118372', m: 'm2', name: '대용량 무선 청소기 V12 PRO', who: '이*영', status: 'REGISTERED', wb: '3812 9920 1183', time: '14:18' },
    { id: 'NS-820188', m: 'm1', name: '캠핑 폴딩 체어 (그레이) ×2', who: '박*철', status: 'PRINTED', wb: '3812 9920 1180', time: '14:11' },
    { id: 'AC-552901', m: 'm4', name: '핸드드립 커피 원두 200g', who: '최*진', status: 'FAILED', wb: '—', time: '14:02' },
    { id: 'GM-339201', m: 'm3', name: '강아지 자동 급식기 5L', who: '정*아', status: 'SUBMITTED', wb: '3812 9919 8821', time: '13:54' },
    { id: 'CP-118359', m: 'm2', name: '코튼 라이트 트렌치코트', who: '한*민', status: 'REGISTERED', wb: '3812 9920 1175', time: '13:47' },
  ];
  const statusColor = {
    COLLECTED: t.accent, REGISTERED: t.ok, PRINTED: t.ink,
    SUBMITTED: t.faint, FAILED: t.danger,
  };

  return gridShell(
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* Stage strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', borderBottom: `1.5px solid ${t.rule}` }}>
        {stages.map((s, i) => (
          <div key={s.n} style={{
            padding: '24px 24px 28px', position: 'relative',
            borderRight: `1px solid ${t.hairline}`,
            background: s.accent ? t.accentBg : (s.warn ? `color-mix(in oklch, ${t.warn} 10%, transparent)` : 'transparent'),
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 11, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, letterSpacing: '0.08em' }}>{s.n}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</span>
              {i < 3 && <span style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint }}>→</span>}
            </div>
            <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 0.9, marginTop: 10, fontVariantNumeric: 'tabular-nums', color: t.ink }}>
              {String(s.value).padStart(2, '0')}
            </div>
            <div style={{ fontSize: 11, color: t.faint, marginTop: 6, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
              {i === 0 ? '오늘 신규 주문' : i === 1 ? '집하 예약 완료' : i === 2 ? '인쇄 대기' : '마켓 제출 완료'}
            </div>
          </div>
        ))}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
          {gridBtn('운송장 출력 24', { primary: true, sm: true })}
          {gridBtn('송장 일괄 제출', { sm: true })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px' }}>
        {/* Orders table */}
        <section style={{ borderRight: `1px solid ${t.hairline}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 32px', borderBottom: `1.5px solid ${t.rule}` }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>주문 목록</h3>
            <span style={{ fontSize: 11, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, letterSpacing: '0.08em' }}>37 ORDERS</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 0, border: `1.5px solid ${t.ink}` }}>
              {['ALL','COLLECTED','REGISTERED','PRINTED','SUBMITTED','FAILED'].map((c, i, arr) => (
                <span key={c} style={{
                  fontSize: 10.5, padding: '4px 10px',
                  background: i === 0 ? t.ink : 'transparent',
                  color: i === 0 ? t.bg : t.ink,
                  fontWeight: 700,
                  fontFamily: 'ui-monospace, "JetBrains Mono", monospace', letterSpacing: '0.04em',
                  borderRight: i < arr.length - 1 ? `1px solid ${t.ink}` : 'none',
                }}>{c}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 100px 130px 60px', padding: '10px 32px', fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 10, color: t.faint, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${t.hairline}` }}>
            <span>ORDER</span><span>PRODUCT</span><span>STATUS</span><span>WAYBILL</span><span style={{ textAlign: 'right' }}>TIME</span>
          </div>
          {orders.map((o, i) => (
            <div key={o.id} style={{
              display: 'grid', gridTemplateColumns: '110px 1fr 100px 130px 60px',
              padding: '14px 32px', alignItems: 'center', gap: 12, fontSize: 13,
              borderBottom: i < orders.length - 1 ? `1px solid ${t.hairline}` : 'none',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 4, height: 14, background: t[o.m] }} />
                <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: t.dim, letterSpacing: '0.02em' }}>{o.id}</span>
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: t.ink, fontWeight: 600, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                <div style={{ fontSize: 11, color: t.faint, marginTop: 2, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>{o.who}</div>
              </div>
              <span>{gridChip(o.status, statusColor[o.status])}</span>
              <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11.5, color: o.wb === '—' ? t.faint : t.ink, letterSpacing: '0.02em' }}>{o.wb}</span>
              <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: t.faint, textAlign: 'right' }}>{o.time}</span>
            </div>
          ))}
        </section>

        {/* Market sidebar */}
        <section style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>마켓별</h3>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: t.faint, letterSpacing: '0.08em' }}>SYNC 14:22</span>
          </div>
          {markets.map((m, i, arr) => (
            <div key={m.id} style={{
              padding: '14px 0',
              borderBottom: `1px solid ${t.hairline}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 4, height: 16, background: t[m.id] }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{m.n}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                <div style={{ flex: 1, height: 3, background: t.hairline }}>
                  <div style={{ width: `${(m.p / m.n) * 100}%`, height: '100%', background: t[m.id] }} />
                </div>
                <span>{m.p} 대기</span>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>,
    {
      sectionLabel: '03 · ORDERS / TODAY',
      title: '오늘 37건\n주문.',
      lede: '4개 마켓에서 자동 수집된 주문을 한 곳에서. 운송장 출력과 송장 제출은 한 번의 클릭으로.',
      cta: gridBtn('새로고침', { sm: true }),
      slide: 'orders',
    }
  );
}

Object.assign(window, { GridDashboard, GridRegister, GridOrders });
