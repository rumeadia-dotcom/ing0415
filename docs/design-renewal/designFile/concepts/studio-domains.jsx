/* global React */
// Studio — domain screens for s1, s4, s5, s6, s8, s9.
// Shares studioTokens / studioShell / studioPill / marketIdentity from studio.jsx.

const t_ = () => window.studioTokens;
const Shell = (...args) => window.studioShell(...args);
const Pill = (...args) => window.studioPill(...args);
const Identity = (id, label, size, mode) => window.marketIdentity(id, label, size, mode);

// ========== s1 — Login (centered card, no sidebar) ==========
function StudioLogin() {
  const t = t_();
  const wrap = {
    width: '100%', height: '100%', background: t.bg,
    display: 'flex', flexDirection: 'column',
    fontFamily: '"Manrope", "Pretendard", ui-sans-serif, system-ui, sans-serif',
    color: t.text,
  };
  return (
    <div style={wrap}>
      <header style={{ padding: '22px 30px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: t.ink, color: t.accent, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>M</div>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.015em', color: t.ink }}>MarketCast</div>
      </header>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '20px 30px 30px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>다시 만나서 반가워요</h1>
            <div style={{ fontSize: 14, color: t.dim, marginTop: 6 }}>이메일과 비밀번호로 로그인하세요</div>
          </div>

          <div style={{
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
            padding: 26, boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 12px 32px -16px rgba(0,0,0,0.18)',
          }}>
            {/* Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: t.card2, padding: 4, borderRadius: 10, marginBottom: 18 }}>
              <button style={{ padding: '8px 14px', background: t.card, color: t.ink, borderRadius: 7, border: 'none', fontSize: 13.5, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>이메일 로그인</button>
              <button style={{ padding: '8px 14px', background: 'transparent', color: t.faint, border: 'none', fontSize: 13.5, fontWeight: 500 }}>소셜 로그인</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>이메일</label>
                <input defaultValue="seller@konai.com" style={{
                  width: '100%', padding: '11px 13px', borderRadius: 10,
                  border: `1px solid ${t.borderHi}`, background: '#fff',
                  fontSize: 14, color: t.ink, outline: 'none',
                  fontFamily: 'inherit',
                }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: t.dim, fontWeight: 600 }}>비밀번호</label>
                  <span style={{ fontSize: 11.5, color: t.accent, fontWeight: 600 }}>비밀번호를 잊으셨나요?</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type="password" defaultValue="••••••••••" style={{
                    width: '100%', padding: '11px 44px 11px 13px', borderRadius: 10,
                    border: `1px solid ${t.borderHi}`, background: '#fff',
                    fontSize: 14, color: t.ink, outline: 'none',
                    fontFamily: 'inherit',
                  }} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: t.faint, fontWeight: 600 }}>표시</span>
                </div>
              </div>

              <button style={{
                marginTop: 6, padding: '12px 18px', borderRadius: 10,
                background: t.ink, color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 700,
                boxShadow: '0 1px 0 rgba(0,0,0,0.06), 0 4px 12px -3px rgba(0,0,0,0.2)',
              }}>로그인</button>

              <div style={{ textAlign: 'center', marginTop: 4, fontSize: 13, color: t.faint }}>
                아직 계정이 없으신가요?{' '}
                <span style={{ color: t.ink, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>회원가입</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center', gap: 18, fontSize: 11.5, color: t.faint }}>
            <span>이용약관</span><span>개인정보처리방침</span><span>사용자 매뉴얼</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== s4 — Templates list (v2 preview) ==========
function StudioTemplates() {
  const t = t_();
  const templates = [
    { name: '오가닉 면 티셔츠 시리즈', cat: '의류 · 남성', use: 14, updated: '3일 전', tags: ['반팔','블랙','정사이즈'] },
    { name: '무선 청소기 PRO 라인', cat: '가전 · 청소', use: 23, updated: '1주 전', tags: ['프리미엄','출시예정'] },
    { name: '핸드드립 원두 200g', cat: '식품 · 음료', use: 8, updated: '2주 전', tags: ['단일원두'] },
    { name: '강아지 자동 급식기', cat: '반려동물', use: 4, updated: '1달 전', tags: ['스마트홈'] },
    { name: '캠핑 폴딩 체어', cat: '아웃도어', use: 31, updated: '4시간 전', tags: ['그레이','베스트셀러'] },
    { name: '미니 가습기 USB', cat: '생활 · 잡화', use: 17, updated: '5일 전', tags: ['무드등'] },
  ];

  return Shell(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      {/* v2 banner */}
      <div style={{
        background: `linear-gradient(135deg, ${t.accentBg}, ${t.card})`,
        border: `1px solid ${t.borderHi}`, borderRadius: 14,
        padding: '18px 22px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: t.accent, color: t.ink, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 20 }}>T</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>템플릿은 v2에서 만나요</div>
          <div style={{ fontSize: 12.5, color: t.dim, marginTop: 2 }}>자주 사용하는 상품 정보·이미지·HTML을 저장해 반복 입력을 줄여드릴게요. 아래는 v2 미리보기예요.</div>
        </div>
        {Pill('베타 신청', t.ink, '#fff', { dot: true })}
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
        <input placeholder="템플릿명·태그 검색" style={{
          flex: 1, padding: '10px 14px', borderRadius: 10,
          border: `1px solid ${t.border}`, background: t.card,
          fontSize: 13.5, color: t.ink, outline: 'none', fontFamily: 'inherit',
        }} />
        <button style={{ padding: '10px 14px', background: t.card, color: t.ink, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>카테고리 ▾</button>
        <button style={{ padding: '10px 14px', background: t.card, color: t.ink, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>최근 수정순 ▾</button>
        <div style={{ marginLeft: 'auto' }}>
          <button style={{ padding: '10px 18px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>+ 새 템플릿</button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {templates.map((tpl, i) => (
          <div key={i} style={{
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
            padding: 0, overflow: 'hidden',
          }}>
            <div className="mc-img-ph" style={{ height: 120 }}>TEMPLATE THUMB</div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 11.5, color: t.faint, fontWeight: 600, marginBottom: 4 }}>{tpl.cat}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>{tpl.name}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
                {tpl.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: t.card2, color: t.dim, fontWeight: 500 }}>{tag}</span>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.border}`, fontSize: 11.5, color: t.faint }}>
                <span>{tpl.use}회 사용</span>
                <span>·</span>
                <span>{tpl.updated} 수정</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: t.accent, fontWeight: 700 }}>등록 시작 →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    {
      title: '템플릿',
      sub: 'v2 예정 · 자주 쓰는 상품 정보를 저장해 등록을 더 빠르게',
      cta: window.studioPrimaryBtn('상품 등록'),
      sidebarActive: 'templates',
    }
  );
}

// ========== s5 — Markets list ==========
function StudioMarkets() {
  const t = t_();
  const accounts = [
    { id: 'm1', label: '네이버 스마트스토어', auth: 'OAuth 2.0', acct: 'konai-store', status: 'active', exp: '92일 후 갱신', verified: '2분 전' },
    { id: 'm2', label: '쿠팡', auth: 'HMAC', acct: 'A00123455', status: 'active', exp: '갱신 자동', verified: '7분 전' },
    { id: 'm3', label: 'G마켓', auth: 'ESM JWT', acct: 'konai_master', status: 'expiring', exp: '6일 후 만료', verified: '14분 전' },
    { id: 'm4', label: '옥션', auth: 'ESM JWT', acct: 'konai_master', status: 'active', exp: '88일 후 갱신', verified: '3분 전' },
    { id: 'm5', label: '11번가', auth: 'API Key', acct: '—', status: 'soon', exp: 'v2 예정', verified: '—' },
  ];
  const statusMap = {
    active:    { fg: t.ok,     bg: t.okBg,     label: '연결됨' },
    expiring:  { fg: t.warn,   bg: t.warnBg,   label: '만료 임박' },
    error:     { fg: t.danger, bg: t.dangerBg, label: '오류' },
    revoked:   { fg: t.faint,  bg: t.card2,    label: '해제됨' },
    soon:      { fg: t.faint,  bg: t.card2,    label: '준비 중' },
  };

  return Shell(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      {/* Summary strip */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        padding: '16px 20px', marginBottom: 16,
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 22, alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 12, color: t.dim, fontWeight: 600 }}>연결된 마켓</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>4</span>
            <span style={{ fontSize: 14, color: t.dim, fontWeight: 600 }}>/ 5</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          {accounts.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: a.status === 'soon' ? 0.4 : 1 }}>
              {Identity(a.id, a.label, 'lg', 'logo')}
              <span style={{ fontSize: 12, color: t.ink, fontWeight: 600 }}>{a.label}</span>
            </div>
          ))}
        </div>
        <button style={{ padding: '10px 18px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>+ 신규 연결</button>
      </div>

      {/* Warning banner */}
      <div style={{
        background: t.warnBg, border: `1px solid color-mix(in oklch, ${t.warn} 25%, transparent)`,
        borderRadius: 12, padding: '12px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ width: 22, height: 22, borderRadius: 11, background: t.warn, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>!</span>
        <div style={{ flex: 1, fontSize: 13, color: t.ink, fontWeight: 500 }}>
          <span style={{ fontWeight: 700 }}>G마켓 토큰이 6일 후 만료돼요.</span> 자동 갱신되지 않는 인증 방식이라 재인증이 필요해요.
        </div>
        <button style={{ padding: '7px 14px', background: t.warn, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>지금 재인증</button>
      </div>

      {/* Accounts table */}
      <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>연결된 계정</div>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: t.faint, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: t.ok }} />
            실시간 동기화 켜짐
          </span>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 1.4fr 1fr 1fr 110px 120px',
          padding: '10px 18px', fontSize: 11, color: t.faint, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: `1px solid ${t.border}`,
        }}>
          <span></span><span>마켓 · 인증 방식</span><span>계정</span><span>토큰 만료</span><span>상태</span><span style={{ textAlign: 'right' }}>액션</span>
        </div>
        {accounts.map((a, i) => (
          <div key={a.id} style={{
            display: 'grid', gridTemplateColumns: '40px 1.4fr 1fr 1fr 110px 120px',
            padding: '14px 18px', alignItems: 'center', gap: 10, fontSize: 13,
            borderBottom: i < accounts.length - 1 ? `1px solid ${t.border}` : 'none',
            opacity: a.status === 'soon' ? 0.55 : 1,
          }}>
            {Identity(a.id, a.label, 'lg', 'logo')}
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{a.label}</div>
              <div style={{ fontSize: 11.5, color: t.faint, marginTop: 1 }}>{a.auth} · 마지막 검증 {a.verified}</div>
            </div>
            <span style={{ fontSize: 13, color: t.ink, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>{a.acct}</span>
            <span style={{ fontSize: 12.5, color: a.status === 'expiring' ? t.warn : t.dim, fontWeight: a.status === 'expiring' ? 700 : 500 }}>{a.exp}</span>
            <span>{Pill(statusMap[a.status].label, statusMap[a.status].fg, statusMap[a.status].bg, { dot: true })}</span>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {a.status === 'expiring' && <button style={{ padding: '6px 10px', background: t.warn, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600 }}>재인증</button>}
              {a.status === 'soon'
                ? <span style={{ fontSize: 12, color: t.faint }}>v2</span>
                : <button style={{ padding: '6px 10px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 7, fontSize: 12, fontWeight: 600 }}>관리</button>}
            </div>
          </div>
        ))}
      </section>
    </div>,
    {
      title: '마켓 계정',
      sub: '4개 활성 · 1개 만료 임박 · 동기화 14:22',
      cta: window.studioPrimaryBtn('신규 연결'),
      sidebarActive: 'markets',
    }
  );
}

// ========== s6 — History list ==========
function StudioHistory() {
  const t = t_();
  const jobs = [
    { id: 'J-2847', name: '오가닉 면 티셔츠 [블랙/M]', status: 'running', markets: ['m1','m2','m3','m4'], succ: 0, fail: 0, time: '14:22', dur: '진행 중' },
    { id: 'J-2846', name: '대용량 무선 청소기 V12 PRO', status: 'partial', markets: ['m1','m2','m4'], succ: 2, fail: 1, time: '14:19', dur: '02:11' },
    { id: 'J-2845', name: '캠핑 폴딩 체어 (그레이)', status: 'succeeded', markets: ['m1','m2','m3','m4'], succ: 4, fail: 0, time: '14:14', dur: '01:54' },
    { id: 'J-2844', name: '핸드드립 커피 원두 200g x2', status: 'succeeded', markets: ['m1','m3'], succ: 2, fail: 0, time: '14:08', dur: '01:32' },
    { id: 'J-2843', name: '강아지 자동 급식기 5L', status: 'failed', markets: ['m2'], succ: 0, fail: 1, time: '14:01', retry: '재등록 1건 있음', dur: '00:48' },
    { id: 'J-2842', name: '코튼 라이트 트렌치코트', status: 'succeeded', markets: ['m1','m2','m3','m4'], succ: 4, fail: 0, time: '13:48', dur: '02:24' },
    { id: 'J-2841', name: '미니 가습기 USB 무드등', status: 'succeeded', markets: ['m1','m2'], succ: 2, fail: 0, time: '13:30', dur: '01:11' },
    { id: 'J-2840', name: '캐주얼 데일리 양말 4P', status: 'partial', markets: ['m1','m2','m3','m4'], succ: 3, fail: 1, time: '13:18', dur: '02:02' },
  ];
  const statusMap = {
    running:   { fg: t.info,   bg: t.infoBg,   label: '진행 중' },
    partial:   { fg: t.warn,   bg: t.warnBg,   label: '일부 성공' },
    succeeded: { fg: t.ok,     bg: t.okBg,     label: '완료' },
    failed:    { fg: t.danger, bg: t.dangerBg, label: '실패' },
  };

  return Shell(
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '240px 1fr', gap: 0 }}>
      {/* Filter sidebar */}
      <aside style={{ borderRight: `1px solid ${t.border}`, padding: '20px 22px', overflow: 'auto', background: t.bg }}>
        <div style={{ fontSize: 12, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>기간</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          {[
            { label: '오늘', sel: false },
            { label: '지난 7일', sel: false },
            { label: '지난 30일', sel: true },
            { label: '직접 선택', sel: false },
          ].map(o => (
            <label key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.ink, cursor: 'pointer' }}>
              <span style={{
                width: 16, height: 16, borderRadius: 4,
                border: `1.5px solid ${o.sel ? t.ink : t.borderHi}`,
                background: o.sel ? t.ink : '#fff',
                position: 'relative',
              }}>{o.sel && <span style={{ position: 'absolute', top: 2, left: 4, color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}</span>
              {o.label}
            </label>
          ))}
        </div>

        <div style={{ fontSize: 12, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>마켓</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          {[
            { id: 'm1', label: '네이버', sel: true },
            { id: 'm2', label: '쿠팡', sel: true },
            { id: 'm3', label: 'G마켓', sel: true },
            { id: 'm4', label: '옥션', sel: true },
          ].map(o => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.ink }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${o.sel ? t.ink : t.borderHi}`, background: o.sel ? t.ink : '#fff', position: 'relative' }}>{o.sel && <span style={{ position: 'absolute', top: 2, left: 4, color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}</span>
              {Identity(o.id, o.label, 'sm', 'logo')}
              {o.label}
            </label>
          ))}
        </div>

        <div style={{ fontSize: 12, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>상태</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          {[
            { label: '완료', sel: true },
            { label: '일부 성공', sel: true, hint: '재시도 대상' },
            { label: '실패', sel: false },
            { label: '진행 중', sel: false },
          ].map(o => (
            <label key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.ink }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${o.sel ? t.ink : t.borderHi}`, background: o.sel ? t.ink : '#fff', position: 'relative' }}>{o.sel && <span style={{ position: 'absolute', top: 2, left: 4, color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}</span>
              {o.label}
              {o.hint && <span style={{ fontSize: 10.5, color: t.faint, marginLeft: 'auto' }}>{o.hint}</span>}
            </label>
          ))}
        </div>

        <button style={{ width: '100%', padding: '8px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>필터 초기화</button>
      </aside>

      {/* Main list */}
      <main style={{ overflow: 'auto', padding: '20px 30px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <input placeholder="상품명 · 잡 ID 검색" style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${t.border}`, background: t.card,
            fontSize: 13.5, color: t.ink, outline: 'none', fontFamily: 'inherit',
          }} />
          <span style={{ fontSize: 12, color: t.faint }}>총 88건 · 표시 중 8건</span>
          <button style={{ padding: '8px 14px', background: t.card, color: t.dim, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}>CSV (v2)</button>
        </div>

        <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {jobs.map((j, i) => (
            <div key={j.id} style={{
              display: 'grid', gridTemplateColumns: '52px 88px 1fr 110px 130px 80px 28px',
              padding: '14px 18px', alignItems: 'center', gap: 12, fontSize: 13,
              borderBottom: i < jobs.length - 1 ? `1px solid ${t.border}` : 'none',
              borderLeft: `3px solid ${statusMap[j.status].fg}`,
              marginLeft: -1,
            }}>
              <div className="mc-img-ph" style={{ width: 40, height: 40, borderRadius: 8 }}>P</div>
              <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11.5, color: t.dim }}>{j.id}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: t.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                <div style={{ fontSize: 11.5, color: t.faint, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', gap: 3 }}>{j.markets.map(m => <React.Fragment key={m}>{Identity(m, '', 'sm', 'bar')}</React.Fragment>)}</span>
                  {j.succ > 0 && <><span>·</span><span style={{ color: t.ok, fontWeight: 600 }}>{j.succ}성공</span></>}
                  {j.fail > 0 && <><span>·</span><span style={{ color: t.danger, fontWeight: 600 }}>{j.fail}실패</span></>}
                  {j.retry && <><span>·</span><span style={{ color: t.accent, fontWeight: 600 }}>{j.retry}</span></>}
                </div>
              </div>
              <span>{Pill(statusMap[j.status].label, statusMap[j.status].fg, statusMap[j.status].bg, { dot: true })}</span>
              <span style={{ fontSize: 12, color: t.faint }}>{j.dur} · {j.time}</span>
              <span style={{ fontSize: 11.5, color: t.dim, textAlign: 'right' }}>2026.05.21</span>
              <span style={{ fontSize: 14, color: t.faint }}>›</span>
            </div>
          ))}
        </section>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button style={{ padding: '10px 22px', background: t.card, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>더 불러오기 (80건 더)</button>
        </div>
      </main>
    </div>,
    {
      title: '등록 이력',
      sub: '필터로 좁혀 검색 · 실패 잡은 재시도 / 마켓 제외 후 재등록',
      cta: null,
      sidebarActive: 'history',
    }
  );
}

// ========== s8 — Shipping print ==========
function StudioShipping() {
  const t = t_();
  const orders = [
    { sel: true, id: 'CP-118372', m: 'm2', name: '대용량 무선 청소기 V12 PRO', who: '이*영', wb: '3812 9920 1183' },
    { sel: true, id: 'NS-820188', m: 'm1', name: '캠핑 폴딩 체어 (그레이) × 2', who: '박*철', wb: '3812 9920 1180' },
    { sel: true, id: 'CP-118359', m: 'm2', name: '코튼 라이트 트렌치코트', who: '한*민', wb: '3812 9920 1175' },
    { sel: false, id: 'GM-339180', m: 'm3', name: '오가닉 면 티셔츠 [화이트/L]', who: '신*우', wb: '3812 9920 1168' },
    { sel: false, id: 'NS-820159', m: 'm1', name: '강아지 자동 급식기 5L', who: '오*린', wb: '3812 9920 1162' },
    { sel: false, id: 'AC-552851', m: 'm4', name: '미니 가습기 USB 무드등 × 3', who: '윤*은', wb: '3812 9919 8814' },
  ];

  return Shell(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      {/* Tabs / breadcrumb */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, padding: 4, background: t.card2, borderRadius: 10, width: 'fit-content' }}>
        <span style={{ padding: '8px 14px', background: t.card, color: t.ink, borderRadius: 7, fontSize: 13, fontWeight: 700, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>운송장 출력</span>
        <span style={{ padding: '8px 14px', color: t.faint, fontSize: 13, fontWeight: 500 }}>송장 일괄 제출</span>
        <span style={{ padding: '8px 14px', color: t.faint, fontSize: 13, fontWeight: 500 }}>배송 이력</span>
      </div>

      {/* Action bar */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        padding: '16px 20px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 13, color: t.dim, fontWeight: 600 }}>출력 대상</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>24</span>
            <span style={{ fontSize: 13, color: t.dim }}>건 (3건 선택됨)</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: t.dim, fontWeight: 500 }}>
            <span style={{ position: 'relative', display: 'inline-block', width: 30, height: 18, background: t.accentBg, borderRadius: 9 }}>
              <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: 7, background: t.accent }} />
            </span>
            출력 후 자동 제출
          </label>
          <span style={{ width: 1, height: 22, background: t.border }} />
          <button style={{ padding: '10px 16px', background: t.card, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>출력 완료 처리</button>
          <button style={{ padding: '10px 18px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>출력 팝업 열기 (3)</button>
        </div>
      </div>

      {/* Table */}
      <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '34px 28px 110px 1fr 90px 140px 90px',
          padding: '12px 18px', fontSize: 11, color: t.faint, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: `1px solid ${t.border}`,
          background: t.card2,
        }}>
          <span><span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${t.borderHi}`, display: 'inline-block', background: '#fff' }} /></span>
          <span></span><span>주문번호</span><span>상품 · 구매자</span><span>마켓</span><span>운송장번호</span><span style={{ textAlign: 'right' }}>로젠 등록</span>
        </div>
        {orders.map((o, i) => (
          <div key={o.id} style={{
            display: 'grid', gridTemplateColumns: '34px 28px 110px 1fr 90px 140px 90px',
            padding: '13px 18px', alignItems: 'center', gap: 0, fontSize: 13,
            borderBottom: i < orders.length - 1 ? `1px solid ${t.border}` : 'none',
            background: o.sel ? `color-mix(in oklch, ${t.accent} 5%, transparent)` : 'transparent',
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4,
              border: `1.5px solid ${o.sel ? t.ink : t.borderHi}`,
              background: o.sel ? t.ink : '#fff',
              position: 'relative', display: 'inline-block',
            }}>{o.sel && <span style={{ position: 'absolute', top: 2, left: 4, color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}</span>
            {Identity(o.m, '', 'md', 'bar')}
            <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 12, color: t.dim }}>{o.id}</span>
            <div style={{ minWidth: 0, paddingRight: 12 }}>
              <div style={{ color: t.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
              <div style={{ fontSize: 11.5, color: t.faint, marginTop: 1 }}>{o.who}</div>
            </div>
            <span style={{ fontSize: 12, color: t.dim }}>{{ m1: '네이버', m2: '쿠팡', m3: 'G마켓', m4: '옥션' }[o.m]}</span>
            <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 12.5, color: t.ink, fontWeight: 500 }}>{o.wb}</span>
            <span style={{ fontSize: 11.5, color: t.ok, fontWeight: 600, textAlign: 'right' }}>완료</span>
          </div>
        ))}
      </section>
    </div>,
    {
      title: '배송 처리',
      sub: '로젠 등록 → 운송장 출력 → 송장 제출 · 최대 2 클릭으로 끝',
      cta: <button style={{ padding: '8px 14px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }}>로젠 연동 설정</button>,
      sidebarActive: 'shipping',
    }
  );
}

// ========== s9 — Settings ==========
function StudioSettings() {
  const t = t_();
  return Shell(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
        {/* Inner nav */}
        <aside>
          <div style={{ fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>설정</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { label: '계정', sel: false },
              { label: '배송 설정', sel: true },
              { label: '알림 (v2)', sel: false, soon: true },
              { label: '청구 (v2)', sel: false, soon: true },
            ].map(n => (
              <div key={n.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', borderRadius: 9,
                background: n.sel ? t.accentBg : 'transparent',
                color: n.sel ? t.ink : (n.soon ? t.faint : t.dim),
                fontWeight: n.sel ? 700 : 500, fontSize: 13.5,
              }}>
                {n.label}
                {n.soon && <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px', background: t.card2, color: t.faint, borderRadius: 4, fontWeight: 600 }}>v2</span>}
              </div>
            ))}
          </div>
        </aside>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 로젠 API */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>로젠택배 API 연동</div>
                  {Pill('연결됨', t.ok, t.okBg, { dot: true })}
                </div>
                <div style={{ fontSize: 13, color: t.dim, marginBottom: 14 }}>주문 자동 등록 · 운송장 채번 · 출력 팝업 호출에 사용돼요</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
                  <div><div style={{ fontSize: 11, color: t.faint, fontWeight: 600, marginBottom: 3 }}>거래처 ID</div><div style={{ fontSize: 13, color: t.ink, fontWeight: 600, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>L-2847-KN</div></div>
                  <div><div style={{ fontSize: 11, color: t.faint, fontWeight: 600, marginBottom: 3 }}>마지막 검증</div><div style={{ fontSize: 13, color: t.ink, fontWeight: 600 }}>3분 전 · 정상</div></div>
                  <div><div style={{ fontSize: 11, color: t.faint, fontWeight: 600, marginBottom: 3 }}>오늘 사용량</div><div style={{ fontSize: 13, color: t.ink, fontWeight: 600 }}>31 / 무제한</div></div>
                </div>
              </div>
              <button style={{ padding: '9px 16px', background: 'transparent', color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>관리</button>
            </div>
          </section>

          {/* 발송인 정보 */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>발송인 정보</div>
                  {Pill('설정 완료', t.ok, t.okBg, { dot: true })}
                </div>
                <div style={{ fontSize: 13, color: t.dim, marginBottom: 14 }}>로젠에 자동 등록되는 출고지 정보예요</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div><div style={{ fontSize: 11, color: t.faint, fontWeight: 600, marginBottom: 3 }}>발송인 / 연락처</div><div style={{ fontSize: 13, color: t.ink, fontWeight: 600 }}>김konai · 010-2847-XXXX</div></div>
                  <div><div style={{ fontSize: 11, color: t.faint, fontWeight: 600, marginBottom: 3 }}>출고지</div><div style={{ fontSize: 13, color: t.ink, fontWeight: 600 }}>경기 성남시 분당구 ··· 902호</div></div>
                </div>
              </div>
              <button style={{ padding: '9px 16px', background: 'transparent', color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>편집</button>
            </div>
          </section>

          {/* 자동 제출 토글 */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 2 }}>출력 후 자동 제출</div>
                <div style={{ fontSize: 12.5, color: t.dim }}>운송장 출력이 끝나면 마켓에 송장번호를 자동으로 보내요</div>
              </div>
              <span style={{ position: 'relative', display: 'inline-block', width: 38, height: 22, background: t.ink, borderRadius: 11, cursor: 'pointer' }}>
                <span style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, background: '#fff' }} />
              </span>
            </div>
          </section>

          {/* 기본 택배사 */}
          <section style={{ background: t.card2, border: `1px dashed ${t.borderHi}`, borderRadius: 14, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.dim, marginBottom: 2 }}>기본 택배사</div>
              <div style={{ fontSize: 12.5, color: t.faint }}>v1은 로젠택배 1종 고정 · 다른 택배사는 v2에서 추가돼요</div>
            </div>
            <span style={{ padding: '6px 12px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12.5, color: t.ink, fontWeight: 600 }}>로젠택배</span>
          </section>
        </div>
      </div>
    </div>,
    {
      title: '설정 — 배송',
      sub: '로젠 연동, 발송인, 자동 제출 정책',
      cta: null,
      sidebarActive: 'settings',
    }
  );
}

Object.assign(window, {
  StudioLogin, StudioTemplates, StudioMarkets,
  StudioHistory, StudioShipping, StudioSettings,
});
