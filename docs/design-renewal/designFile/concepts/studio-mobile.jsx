/* global React */
// Studio — mobile views for s2 (dashboard) and s7 (orders).
// Rendered inside iOS device frames (375px viewport · 812px height).

const __tM = () => window.studioTokens;
const __PillM = (...a) => window.studioPill(...a);
const __IdM = (id, label, size, mode) => window.marketIdentity(id, label, size, mode);

function MobileIcon({ kind, size = 24, color = 'currentColor', filled = false }) {
  const s = size, c = color;
  const sw = filled ? 0 : 1.7;
  const stroke = { stroke: c, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', fill: filled ? c : 'none' };
  // 24x24 viewbox, line-drawn icons.
  switch (kind) {
    case 'menu':
      return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M4 7h16M4 12h16M4 17h10" /></svg>;
    case 'bell':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <path {...stroke} d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
          <path {...stroke} d="M10.5 19a1.5 1.5 0 0 0 3 0" />
        </svg>
      );
    case 'dash':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <path {...stroke} d="M4 13h7V4H4zM13 20h7V4h-7zM4 20h7v-4H4z" />
        </svg>
      );
    case 'orders':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <path {...stroke} d="M4 7l8-4 8 4M4 7v10l8 4 8-4V7M4 7l8 4 8-4M12 11v10" />
        </svg>
      );
    case 'shipping':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <path {...stroke} d="M3 7h11v9H3zM14 11h4l3 3v2h-7" />
          <circle {...stroke} cx="7.5" cy="17.5" r="1.8" />
          <circle {...stroke} cx="17" cy="17.5" r="1.8" />
        </svg>
      );
    case 'more':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <circle {...stroke} cx="5" cy="12" r="1.5" />
          <circle {...stroke} cx="12" cy="12" r="1.5" />
          <circle {...stroke} cx="19" cy="12" r="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

function MobileShell({ children, title, sub, tab, unread = 3 }) {
  const t = __tM();
  const tabs = [
    { id: 'dash', label: '대시' },
    { id: 'orders', label: '주문' },
    { id: 'shipping', label: '배송' },
    { id: 'more', label: '더보기' },
  ];
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: t.bg, color: t.text,
      // iOS status bar reserve (54px) + extra breathing room before the title
      paddingTop: 54,
      fontFamily: '"Manrope", "Pretendard", ui-sans-serif, system-ui, sans-serif',
    }}>
      {/* Custom header — top-aligned actions row, then big title block underneath */}
      <header style={{ background: t.bg, paddingBottom: 14, borderBottom: `1px solid ${t.border}` }}>
        {/* Action row */}
        <div style={{ padding: '14px 16px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{ width: 40, height: 40, padding: 0, background: 'transparent', border: 'none', borderRadius: 10, color: t.ink, display: 'grid', placeItems: 'center' }}>
            <MobileIcon kind="menu" size={24} />
          </button>
          <span style={{ flex: 1 }} />
          <button style={{
            position: 'relative', width: 40, height: 40, padding: 0,
            background: 'transparent', border: 'none', borderRadius: 10,
            color: t.ink, display: 'grid', placeItems: 'center',
          }}>
            <MobileIcon kind="bell" size={22} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
                background: t.danger, color: '#fff',
                fontSize: 10, fontWeight: 700,
                display: 'grid', placeItems: 'center',
                border: `2px solid ${t.bg}`,
              }}>{unread}</span>
            )}
          </button>
        </div>
        {/* Title block — large, generous breathing room */}
        <div style={{ padding: '6px 20px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', lineHeight: 1.25 }}>{title}</div>
          {sub && <div style={{ fontSize: 12.5, color: t.faint, marginTop: 4 }}>{sub}</div>}
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 16 }}>{children}</div>

      {/* Bottom tab bar — bigger touch targets, SVG icons */}
      <nav style={{
        background: t.card, borderTop: `1px solid ${t.border}`,
        paddingBottom: 28, paddingTop: 8,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      }}>
        {tabs.map(n => {
          const active = n.id === tab;
          return (
            <div key={n.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '6px 0', color: active ? t.ink : t.faint,
            }}>
              <MobileIcon kind={n.id} size={26} filled={active} color={active ? t.ink : t.faint} />
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{n.label}</span>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

// ========== Mobile · Dashboard ==========
function StudioDashboardMobile() {
  const t = __tM();
  const stages = [
    { label: '수집', value: 37, color: t.info, bg: t.infoBg },
    { label: '등록', value: 31, color: t.ok, bg: t.okBg },
    { label: '출력', value: 24, color: t.warn, bg: t.warnBg },
    { label: '제출', value: 12, color: t.faint, bg: t.card2 },
  ];
  const orders = [
    { id: 'NS-820194', m: 'm1', name: '오가닉 면 티셔츠', who: '김*수', status: 'collected', time: '14:22' },
    { id: 'CP-118372', m: 'm2', name: '대용량 무선 청소기 V12 PRO', who: '이*영', status: 'logen_registered', time: '14:18' },
    { id: 'AC-552901', m: 'm4', name: '핸드드립 커피 원두 200g', who: '최*진', status: 'logen_failed', time: '14:02' },
  ];
  const statusMap = {
    collected:           { fg: t.info,   bg: t.infoBg,   label: '수집됨' },
    logen_registered:    { fg: t.ok,     bg: t.okBg,     label: '로젠 등록' },
    logen_failed:        { fg: t.danger, bg: t.dangerBg, label: '로젠 실패' },
  };

  return (
    <MobileShell title="안녕하세요, konai 셀러님" sub="신규 37건 · 출력 대기 24건" tab="dash">
      <div style={{ padding: '16px 18px 20px' }}>
        {/* Hero — orders kpi (light card, accent bar + accent numeric) */}
        <div style={{
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
          padding: 16, marginBottom: 14, position: 'relative', overflow: 'hidden',
        }}>
          <span style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: t.accent }} />
          <div style={{ paddingLeft: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: t.dim, fontWeight: 600 }}>신규 주문</span>
              <span style={{ fontSize: 10.5, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', marginLeft: 'auto' }}>14:22 sync</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 700, color: t.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>37</span>
              <span style={{ fontSize: 14, color: t.dim, fontWeight: 600 }}>건</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: t.accentBg, color: t.accent, fontSize: 11, fontWeight: 700 }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: t.accent }} />
                +6 / 1h
              </span>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, padding: '10px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>운송장 출력 24</button>
              <button style={{ padding: '10px 14px', background: t.card2, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>송장 제출</button>
            </div>
          </div>
        </div>

        {/* Stage row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 18 }}>
          {stages.map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: s.color, fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Recent orders */}
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>최근 주문</div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: t.dim, fontWeight: 600 }}>전체 →</span>
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {orders.map((o, i) => (
            <div key={o.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderBottom: i < orders.length - 1 ? `1px solid ${t.border}` : 'none',
            }}>
              {__IdM(o.m, '', 'md', 'bar')}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: t.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                <div style={{ fontSize: 11, color: t.faint, marginTop: 2 }}>{o.id} · {o.who}</div>
              </div>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                {__PillM(statusMap[o.status].label, statusMap[o.status].fg, statusMap[o.status].bg, { dot: true })}
                <span style={{ fontSize: 10.5, color: t.faint }}>{o.time}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Market health */}
        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 18, marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>마켓 연결</div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: t.faint }}>4 / 5 활성</span>
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 14 }}>
          {[
            { id: 'm1', label: '네이버', exp: '92일', s: 'ok' },
            { id: 'm2', label: '쿠팡', exp: '41일', s: 'ok' },
            { id: 'm3', label: 'G마켓', exp: '6일 후 만료', s: 'warn' },
            { id: 'm4', label: '옥션', exp: '88일', s: 'ok' },
          ].map((m, i, arr) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
              borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
            }}>
              {__IdM(m.id, m.label, 'sm', 'logo')}
              <span style={{ fontSize: 13, color: t.ink, fontWeight: 500, flex: 1 }}>{m.label}</span>
              <span style={{ fontSize: 11.5, color: m.s === 'warn' ? t.warn : t.faint, fontWeight: m.s === 'warn' ? 700 : 400 }}>{m.exp}</span>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}

// ========== Mobile · Orders (card list) ==========
function StudioOrdersMobile() {
  const t = __tM();
  const orders = [
    { id: 'NS-820194', m: 'm1', name: '오가닉 면 티셔츠 [블랙/M]', who: '김*수', addr: '서울 강남구', status: 'collected', wb: '—', time: '14:22' },
    { id: 'CP-118372', m: 'm2', name: '대용량 무선 청소기 V12 PRO', who: '이*영', addr: '경기 성남시', status: 'logen_registered', wb: '3812 9920 1183', time: '14:18' },
    { id: 'NS-820188', m: 'm1', name: '캠핑 폴딩 체어 (그레이) × 2', who: '박*철', addr: '인천 연수구', status: 'waybill_printed', wb: '3812 9920 1180', time: '14:11' },
    { id: 'AC-552901', m: 'm4', name: '핸드드립 커피 원두 200g', who: '최*진', addr: '부산 해운대구', status: 'logen_failed', wb: '—', time: '14:02' },
    { id: 'GM-339201', m: 'm3', name: '강아지 자동 급식기 5L', who: '정*아', addr: '대전 서구', status: 'tracking_submitted', wb: '3812 9919 8821', time: '13:54' },
  ];
  const statusMap = {
    collected:           { fg: t.info,   bg: t.infoBg,   label: '수집됨' },
    logen_registered:    { fg: t.ok,     bg: t.okBg,     label: '로젠 등록' },
    waybill_printed:     { fg: t.accent, bg: t.accentBg, label: '출력 완료' },
    tracking_submitted:  { fg: t.faint,  bg: t.card2,    label: '제출 완료' },
    logen_failed:        { fg: t.danger, bg: t.dangerBg, label: '로젠 실패' },
  };

  return (
    <MobileShell title="주문 현황" sub="오늘 37건" tab="orders">
      <div style={{ padding: '14px 18px 20px' }}>
        {/* Search */}
        <input placeholder="주문번호 · 상품명 · 수취인 검색" style={{
          width: '100%', padding: '11px 14px', borderRadius: 11,
          border: `1px solid ${t.border}`, background: t.card,
          fontSize: 13.5, color: t.ink, outline: 'none', fontFamily: 'inherit',
          marginBottom: 12,
        }} />

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 4 }}>
          {[
            { label: '전체', sel: true, n: 37 },
            { label: '수집', sel: false, n: 6 },
            { label: '로젠', sel: false, n: 18 },
            { label: '출력', sel: false, n: 7 },
            { label: '제출', sel: false, n: 5 },
            { label: '실패', sel: false, n: 1, danger: true },
          ].map(c => (
            <button key={c.label} style={{
              flex: '0 0 auto', padding: '6px 12px', borderRadius: 999,
              background: c.sel ? t.ink : 'transparent',
              color: c.sel ? '#fff' : (c.danger ? t.danger : t.dim),
              border: `1px solid ${c.sel ? t.ink : (c.danger ? t.danger : t.border)}`,
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {c.label} {c.n}
            </button>
          ))}
        </div>

        {/* Market filter row */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[
            { id: 'm1', label: '네이버', sel: true },
            { id: 'm2', label: '쿠팡', sel: true },
            { id: 'm3', label: 'G마켓', sel: true },
            { id: 'm4', label: '옥션', sel: true },
          ].map(m => (
            <button key={m.id} style={{
              flex: 1, padding: '7px 4px', borderRadius: 8,
              background: m.sel ? t.card : t.card2,
              border: `1px solid ${m.sel ? t.borderHi : t.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 11.5, color: t.ink, fontWeight: 600,
              opacity: m.sel ? 1 : 0.5,
            }}>
              {__IdM(m.id, m.label, 'sm', 'logo')}
              {m.label}
            </button>
          ))}
        </div>

        {/* Card list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(o => (
            <div key={o.id} style={{
              background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14,
              borderLeft: `3px solid ${statusMap[o.status].fg}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                {__IdM(o.m, '', 'md', 'logo')}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, lineHeight: 1.3 }}>{o.name}</div>
                  <div style={{ fontSize: 11.5, color: t.faint, marginTop: 3, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>{o.id}</div>
                </div>
                {__PillM(statusMap[o.status].label, statusMap[o.status].fg, statusMap[o.status].bg, { dot: true })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: t.dim, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
                <span>{o.who} · {o.addr}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: o.wb === '—' ? t.faint : t.ink, fontWeight: 500 }}>{o.wb}</span>
                <span>{o.time}</span>
              </div>
            </div>
          ))}
        </div>

        <button style={{ width: '100%', marginTop: 14, padding: '11px', background: t.card, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>더 불러오기 (32건 더)</button>
      </div>
    </MobileShell>
  );
}

Object.assign(window, { StudioDashboardMobile, StudioOrdersMobile });
