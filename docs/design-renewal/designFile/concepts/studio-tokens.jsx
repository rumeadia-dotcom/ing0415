/* global React */
// Studio — design tokens reference + market identity variants showcase.

// Re-grab studioTokens at render time so the page works even if loaded
// before studio.jsx finishes parsing. (Both load in normal script order.)
const __t = () => window.studioTokens;

function TokenSwatch({ label, value, fg, dark }) {
  const t = __t();
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${t.border}`, overflow: 'hidden', background: t.card }}>
      <div style={{ height: 72, background: value }} />
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 12.5, color: t.ink, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function StudioTokens() {
  const t = __t();
  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto', background: t.bg, color: t.text,
      fontFamily: '"Manrope", "Pretendard", ui-sans-serif, system-ui, sans-serif',
      padding: '28px 36px 40px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28, paddingBottom: 18, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>MARKETCAST · STUDIO</div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>디자인 토큰</h1>
        <div style={{ fontSize: 14, color: t.dim, marginTop: 6, maxWidth: 720 }}>
          Studio 컨셉의 단일 진실 소스. 새 화면을 그릴 때는 이 페이지의 값만 사용하세요.
          개발 이관 시에는 <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', background: t.card, padding: '1px 6px', borderRadius: 4 }}>tailwind.config.ts</span>에 동일한 이름으로 매핑됩니다.
        </div>
      </div>

      {/* Color — base palette */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>색상 · 베이스</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          <TokenSwatch label="bg" value={t.bg} />
          <TokenSwatch label="card" value={t.card} />
          <TokenSwatch label="card2" value={t.card2} />
          <TokenSwatch label="border" value={t.border} />
          <TokenSwatch label="borderHi" value={t.borderHi} />
          <TokenSwatch label="ink" value={t.ink} />
        </div>
      </section>

      {/* Color — accent + semantic */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>색상 · 시맨틱</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <TokenSwatch label="accent · 비비드 오렌지" value={t.accent} />
          <TokenSwatch label="ok · 성공" value={t.ok} />
          <TokenSwatch label="warn · 경고" value={t.warn} />
          <TokenSwatch label="danger · 오류" value={t.danger} />
          <TokenSwatch label="info · 정보" value={t.info} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 10 }}>
          <TokenSwatch label="accentBg" value={t.accentBg} />
          <TokenSwatch label="okBg" value={t.okBg} />
          <TokenSwatch label="warnBg" value={t.warnBg} />
          <TokenSwatch label="dangerBg" value={t.dangerBg} />
          <TokenSwatch label="infoBg" value={t.infoBg} />
        </div>
        <div style={{ fontSize: 12, color: t.faint, marginTop: 10 }}>각 시맨틱 토큰은 fg(텍스트·아이콘용)와 bg(배경용) 페어로 사용 — 페어 외 조합 금지.</div>
      </section>

      {/* Marketplaces */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>마켓 식별 색상</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { id: 'm1', label: '네이버', tone: 'emerald' },
            { id: 'm2', label: '쿠팡', tone: 'red-pink' },
            { id: 'm3', label: 'G마켓', tone: 'teal-green' },
            { id: 'm4', label: '옥션', tone: 'orange-red' },
            { id: 'm5', label: '11번가 (v2)', tone: 'magenta' },
          ].map(m => (
            <div key={m.id} style={{ borderRadius: 10, border: `1px solid ${t.border}`, overflow: 'hidden', background: t.card }}>
              <div style={{ height: 72, background: t[m.id], display: 'flex', alignItems: 'flex-end', padding: 10 }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,0.18)', padding: '2px 6px', borderRadius: 4, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>{m.id}</span>
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 12.5, color: t.ink, fontWeight: 700 }}>{m.label}</div>
                <div style={{ fontSize: 10.5, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', marginTop: 2 }}>{t[m.id]}</div>
                <div style={{ fontSize: 10.5, color: t.faint, marginTop: 2 }}>{m.tone}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: t.faint, marginTop: 10 }}>실제 브랜드 톤에 근접하되 4종이 한 줄에 놓였을 때 모두 구분되도록 hue 차이 확보. 사내 가이드 확정 시 토큰 값만 교체.</div>
      </section>

      {/* Typography */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>타이포그래피</SectionHeading>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 140px', gap: 14, alignItems: 'baseline' }}>
            {[
              { size: 36, weight: 700, label: 'Display', sample: '오늘 14건 등록' },
              { size: 26, weight: 700, label: 'H1 / 큰 숫자', sample: '오가닉 면 티셔츠' },
              { size: 20, weight: 700, label: 'H2', sample: '미리보기' },
              { size: 16, weight: 700, label: 'H3 / 카드 헤딩', sample: '마켓 연결' },
              { size: 14, weight: 600, label: '본문 강조', sample: '판매가 ₩29,000' },
              { size: 13, weight: 500, label: '본문', sample: '실시간으로 자동 갱신됩니다' },
              { size: 12, weight: 600, label: '라벨', sample: '오늘 등록 · KPI 라벨' },
              { size: 11, weight: 600, label: 'micro · uppercase', sample: '예상 수수료' },
            ].map(row => (
              <React.Fragment key={row.label}>
                <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: t.faint }}>{row.size}px / {row.weight}</span>
                <span style={{ fontSize: row.size, fontWeight: row.weight, color: t.ink, letterSpacing: row.size > 18 ? '-0.02em' : '-0.005em' }}>{row.sample}</span>
                <span style={{ fontSize: 12, color: t.dim }}>{row.label}</span>
              </React.Fragment>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 16, paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>본문 패밀리</div>
              <div style={{ fontSize: 14, color: t.ink, fontWeight: 600, marginTop: 4 }}>Manrope · Pretendard fallback</div>
              <div style={{ fontSize: 12, color: t.dim, marginTop: 2 }}>한글: Pretendard / 라틴: Manrope</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>모노 패밀리</div>
              <div style={{ fontSize: 14, color: t.ink, fontWeight: 600, marginTop: 4, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>JetBrains Mono 3812 9920</div>
              <div style={{ fontSize: 12, color: t.dim, marginTop: 2 }}>주문번호 · 운송장 · 잡 ID 전용</div>
            </div>
          </div>
        </div>
      </section>

      {/* Spacing & Radii */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>여백 · 라운드</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12, color: t.dim, fontWeight: 700, marginBottom: 12 }}>SPACING</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[{ n: 4, label: 'xs · 인라인 간격' }, { n: 8, label: 'sm · 칩·뱃지 간격' }, { n: 14, label: 'md · 카드 패딩' }, { n: 18, label: 'lg · 섹션 사이' }, { n: 22, label: 'xl · 페이지 패딩' }, { n: 30, label: '2xl · 페이지 외곽' }].map(s => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 40, fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11, color: t.dim }}>{s.n}px</span>
                  <span style={{ height: 12, width: s.n * 2, background: t.accent, borderRadius: 2 }} />
                  <span style={{ fontSize: 12, color: t.faint, flex: 1 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12, color: t.dim, fontWeight: 700, marginBottom: 12 }}>RADIUS</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[{ r: 4, label: '필 / 칩 내부' }, { r: 8, label: '버튼 sm' }, { r: 10, label: '버튼 / 인풋' }, { r: 12, label: '뱃지 그룹' }, { r: 14, label: '카드' }, { r: 16, label: '히어로 카드' }, { r: 999, label: '필 / 동그라미' }].map(r => (
                <div key={r.r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 56, height: 56, background: t.accent, borderRadius: r.r === 999 ? '50%' : r.r }} />
                  <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 10.5, color: t.dim }}>{r.r === 999 ? 'full' : `${r.r}px`}</span>
                  <span style={{ fontSize: 10.5, color: t.faint, textAlign: 'center', maxWidth: 80 }}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Components — buttons + pills */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>컴포넌트 샘플</SectionHeading>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>버튼</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
            <button style={{ padding: '10px 18px', borderRadius: 10, background: t.ink, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14 }}>Primary · 상품 등록</button>
            <button style={{ padding: '10px 16px', borderRadius: 10, background: t.card, color: t.ink, border: `1px solid ${t.borderHi}`, fontWeight: 600, fontSize: 14 }}>Secondary · 임시저장</button>
            <button style={{ padding: '10px 16px', borderRadius: 10, background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, fontWeight: 600, fontSize: 14 }}>Ghost · 이전</button>
            <button style={{ padding: '10px 16px', borderRadius: 10, background: t.danger, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14 }}>Danger · 연결 해제</button>
          </div>

          <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>상태 뱃지 (Pill)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '완료', fg: t.ok, bg: t.okBg },
              { label: '진행 중', fg: t.info, bg: t.infoBg },
              { label: '일부 성공', fg: t.warn, bg: t.warnBg },
              { label: '실패', fg: t.danger, bg: t.dangerBg },
              { label: '출력 완료', fg: t.accent, bg: t.accentBg },
              { label: 'v2 예정', fg: t.faint, bg: t.card2 },
            ].map(p => (
              <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: p.bg, color: p.fg, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: p.fg }} />
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Inputs */}
      <section>
        <SectionHeading>인풋 · 카드</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>인풋</div>
            <label style={{ display: 'block', fontSize: 12, color: t.dim, fontWeight: 600, marginBottom: 6 }}>상품명</label>
            <input defaultValue="오가닉 면 티셔츠 [블랙/M]" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.borderHi}`, background: '#fff', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', marginBottom: 12 }} />
            <label style={{ display: 'block', fontSize: 12, color: t.dim, fontWeight: 600, marginBottom: 6 }}>판매가</label>
            <input defaultValue="29,000" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${t.danger}`, background: '#fff', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ fontSize: 11.5, color: t.danger, marginTop: 4, fontWeight: 500 }}>쿠팡 카테고리는 최소 1,000원 이상이어야 해요</div>
          </div>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>카드 패턴</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 4 }}>마켓 연결</div>
            <div style={{ fontSize: 12, color: t.faint, marginBottom: 14 }}>4개 활성 · 1개 점검</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${t.border}` }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: t.m1 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: t.ink, flex: 1 }}>네이버 스마트스토어</span>
              <span style={{ fontSize: 12, color: t.faint }}>92일</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ children }) {
  const t = __t();
  return (
    <div style={{ marginBottom: 14, display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em' }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: t.border }} />
    </div>
  );
}

// ========== Market identity variants showcase ==========
function StudioIdentityVariants() {
  const t = __t();
  const markets = [
    { id: 'm1', label: '네이버 스마트스토어', count: 14 },
    { id: 'm2', label: '쿠팡', count: 12 },
    { id: 'm3', label: 'G마켓', count: 7 },
    { id: 'm4', label: '옥션', count: 4 },
  ];
  const variants = [
    { mode: 'dot', label: 'A · 색 도트', sub: '현재 기본값 · 가장 가벼움 · 색맹 대응 약함' },
    { mode: 'logo', label: 'B · 이니셜 로고', sub: '식별력 강함 · 정사각 박스가 시각적 무게감 ↑' },
    { mode: 'bar', label: 'C · 컬러바', sub: '행 단위 강조 · 텍스트 가독성 ↑ · 색 면적 최소' },
  ];

  const renderIdentity = (mode, id, size = 'md') => {
    const px = size === 'lg' ? 14 : 12;
    const initial = ({ m1: 'N', m2: 'C', m3: 'G', m4: 'A' })[id];
    const color = t[id];
    if (mode === 'logo') return <span style={{ width: px + 6, height: px + 6, borderRadius: 5, background: color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: px - 1, fontWeight: 700 }}>{initial}</span>;
    if (mode === 'bar') return <span style={{ width: 4, height: px + 6, background: color, borderRadius: 2 }} />;
    return <span style={{ width: px, height: px, borderRadius: px / 2, background: color }} />;
  };

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto', background: t.bg, color: t.text,
      fontFamily: '"Manrope", "Pretendard", ui-sans-serif, system-ui, sans-serif',
      padding: '28px 32px 36px',
    }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>STUDIO · MARKET IDENTITY</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>마켓 아이덴티티 표현 — 3가지 방식</h1>
        <div style={{ fontSize: 13.5, color: t.dim, marginTop: 6, maxWidth: 720 }}>
          같은 마켓 목록을 세 가지 스타일로 렌더링한 비교. 사내 브랜드 가이드 확정 후 한 가지로 통일 권장.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {variants.map(v => (
          <div key={v.mode} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>{v.label}</div>
              <div style={{ fontSize: 12, color: t.faint, marginTop: 3 }}>{v.sub}</div>
            </div>

            {/* List */}
            <div style={{ background: t.card2, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>마켓별 신규</div>
              {markets.map((m, i, arr) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0',
                  borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
                }}>
                  {renderIdentity(v.mode, m.id, 'md')}
                  <span style={{ fontSize: 13, color: t.ink, fontWeight: 500, flex: 1 }}>{m.label}</span>
                  <span style={{ fontSize: 14, color: t.ink, fontWeight: 700 }}>{m.count}</span>
                </div>
              ))}
            </div>

            {/* Inline chip */}
            <div style={{ marginTop: 12, padding: '10px 12px', background: t.bg, borderRadius: 9, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>주문 행 인라인</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                {renderIdentity(v.mode, 'm1', 'sm')}
                <span style={{ color: t.ink, fontWeight: 600 }}>NS-820194</span>
                <span style={{ color: t.dim, flex: 1 }}>오가닉 면 티셔츠</span>
              </div>
            </div>

            {/* Stack 4-up */}
            <div style={{ marginTop: 12, padding: '10px 12px', background: t.bg, borderRadius: 9, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>4-up 스택</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {markets.map(m => <React.Fragment key={m.id}>{renderIdentity(v.mode, m.id, 'md')}</React.Fragment>)}
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 11.5, color: t.faint }}>
              {v.mode === 'dot' && '단점: 색만으로 식별 → 색맹 사용자 차별. 보조 라벨 필수.'}
              {v.mode === 'logo' && '단점: 4종 한 줄에 놓이면 무거움. 메인 캔버스가 좁을 때 유의.'}
              {v.mode === 'bar' && '단점: 인라인(주문 ID 앞)에서 무게감 부족. 행 좌측 정렬 권장.'}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, padding: '14px 18px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, fontSize: 12.5, color: t.dim, lineHeight: 1.6 }}>
        <strong style={{ color: t.ink }}>제안:</strong> 사이드바·정렬 위주 화면(s7·s2)에서는 <strong style={{ color: t.ink }}>B (이니셜 로고)</strong>를 기본으로, 데이터 밀도 높은 테이블 행(s6·s7 목록)에서는 <strong style={{ color: t.ink }}>C (컬러바)</strong>를 권장 — 색 면적이 적어 텍스트 가독성을 해치지 않음. 사내 로고 자산이 확보되면 B의 이니셜 자리에 실제 로고로 교체.
      </div>
    </div>
  );
}

Object.assign(window, { StudioTokens, StudioIdentityVariants });
