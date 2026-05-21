/* global React */
// Studio — s7 OrdersList / OrdersDetail screens.

const __t1 = () => window.studioTokens;
const __Shell1 = (...a) => window.studioShell(...a);
const __Pill1 = (...a) => window.studioPill(...a);
const __Id1 = (id, label, size, mode) => window.marketIdentity(id, label, size, mode);

function KV1({ label, children }) {
  const t = __t1();
  return (
    <div>
      <div style={{ fontSize: 11, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: t.ink }}>{children}</div>
    </div>
  );
}

// ========== s7 · Orders List ==========
function StudioOrdersList() {
  const t = __t1();
  const orders = [
    { id: 'NS-820194', m: 'm1', name: '오가닉 면 티셔츠 [블랙/M]', who: '김*수', addr: '서울 강남구 ···', status: 'collected', wb: '—', time: '14:22' },
    { id: 'CP-118372', m: 'm2', name: '대용량 무선 청소기 V12 PRO', who: '이*영', addr: '경기 성남시 ···', status: 'logen_registered', wb: '3812 9920 1183', time: '14:18' },
    { id: 'NS-820188', m: 'm1', name: '캠핑 폴딩 체어 (그레이) × 2', who: '박*철', addr: '인천 연수구 ···', status: 'waybill_printed', wb: '3812 9920 1180', time: '14:11' },
    { id: 'AC-552901', m: 'm4', name: '핸드드립 커피 원두 200g', who: '최*진', addr: '부산 해운대구 ···', status: 'logen_failed', wb: '—', time: '14:02' },
    { id: 'GM-339201', m: 'm3', name: '강아지 자동 급식기 5L', who: '정*아', addr: '대전 서구 ···', status: 'tracking_submitted', wb: '3812 9919 8821', time: '13:54' },
    { id: 'CP-118359', m: 'm2', name: '코튼 라이트 트렌치코트', who: '한*민', addr: '경기 안양시 ···', status: 'logen_registered', wb: '3812 9920 1175', time: '13:47' },
    { id: 'NS-820171', m: 'm1', name: '미니 가습기 USB 무드등 × 3', who: '윤*은', addr: '광주 북구 ···', status: 'tracking_submitted', wb: '3812 9919 8814', time: '13:31' },
    { id: 'GM-339180', m: 'm3', name: '오가닉 면 티셔츠 [화이트/L]', who: '신*우', addr: '서울 마포구 ···', status: 'waybill_printed', wb: '3812 9920 1168', time: '13:22' },
    { id: 'AC-552851', m: 'm4', name: '미니 가습기 USB 무드등', who: '오*린', addr: '울산 남구 ···', status: 'logen_registered', wb: '3812 9920 1162', time: '13:10' },
  ];
  const statusMap = {
    collected:           { fg: t.info,   bg: t.infoBg,   label: '수집됨' },
    logen_registered:    { fg: t.ok,     bg: t.okBg,     label: '로젠 등록' },
    waybill_printed:     { fg: t.accent, bg: t.accentBg, label: '출력 완료' },
    tracking_submitted:  { fg: t.faint,  bg: t.card2,    label: '제출 완료' },
    logen_failed:        { fg: t.danger, bg: t.dangerBg, label: '로젠 실패' },
  };

  return __Shell1(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <input placeholder="상품명 · 주문번호 · 수취인 검색 (60자 이내)" style={{
            padding: '11px 14px', borderRadius: 10,
            border: `1px solid ${t.borderHi}`, background: '#fff',
            fontSize: 13.5, color: t.ink, outline: 'none', fontFamily: 'inherit',
          }} />
          <button style={{ padding: '11px 16px', background: t.card2, color: t.ink, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>2026.05.21 ▾</button>
          <button style={{ padding: '11px 16px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>초기화</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>마켓</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'm1', label: '네이버' },
              { id: 'm2', label: '쿠팡' },
              { id: 'm3', label: 'G마켓' },
              { id: 'm4', label: '옥션' },
            ].map((m, idx) => (
              <button key={m.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px 5px 9px', borderRadius: 999,
                background: idx === 3 ? 'transparent' : t.ink,
                color: idx === 3 ? t.dim : '#fff',
                border: `1px solid ${idx === 3 ? t.border : t.ink}`,
                fontSize: 12, fontWeight: 600,
              }}>
                {__Id1(m.id, m.label, 'sm', 'logo')}
                {m.label}
              </button>
            ))}
          </div>
          <span style={{ width: 1, height: 18, background: t.border, margin: '0 6px' }} />
          <span style={{ fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>상태</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['전체 37','수집 6','로젠 18','출력 7','제출 5','실패 1'].map((label, i) => (
              <button key={label} style={{
                padding: '5px 11px', borderRadius: 999,
                background: i === 0 ? t.ink : 'transparent',
                color: i === 0 ? '#fff' : t.dim,
                border: `1px solid ${i === 0 ? t.ink : t.border}`,
                fontSize: 12, fontWeight: 600,
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '32px 110px 1fr 100px 100px 150px 70px',
          padding: '12px 18px', fontSize: 11, color: t.faint, fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${t.border}`,
          background: t.card2,
        }}>
          <span></span><span>주문번호</span><span>상품 · 수취인 · 주소</span><span>마켓</span><span>상태</span><span>운송장</span><span style={{ textAlign: 'right' }}>주문시각</span>
        </div>
        {orders.map((o, i) => (
          <div key={o.id} style={{
            display: 'grid', gridTemplateColumns: '32px 110px 1fr 100px 100px 150px 70px',
            padding: '13px 18px', alignItems: 'center', gap: 10, fontSize: 13,
            borderBottom: i < orders.length - 1 ? `1px solid ${t.border}` : 'none',
          }}>
            {__Id1(o.m, '', 'md', 'bar')}
            <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11.5, color: t.dim }}>{o.id}</span>
            <div style={{ minWidth: 0, paddingRight: 8 }}>
              <div style={{ color: t.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
              <div style={{ fontSize: 11.5, color: t.faint, marginTop: 1 }}>{o.who} · {o.addr}</div>
            </div>
            <span style={{ fontSize: 12, color: t.dim }}>{{ m1:'네이버', m2:'쿠팡', m3:'G마켓', m4:'옥션' }[o.m]}</span>
            <span>{__Pill1(statusMap[o.status].label, statusMap[o.status].fg, statusMap[o.status].bg, { dot: true })}</span>
            <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11.5, color: o.wb === '—' ? t.faint : t.ink, fontWeight: 500 }}>{o.wb}</span>
            <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11.5, color: t.faint, textAlign: 'right' }}>{o.time}</span>
          </div>
        ))}
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: t.faint }}>9건 표시 · 총 37건</span>
        <button style={{ padding: '10px 22px', background: t.card, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>더 불러오기</button>
      </div>
    </div>,
    {
      title: '주문 목록',
      sub: '오늘 37건 · 필터 · URL 공유 가능',
      cta: window.studioPrimaryBtn('운송장 출력'),
      sidebarActive: 'orders',
    }
  );
}

// ========== s7 · Order Detail ==========
function StudioOrdersDetail() {
  const t = __t1();
  const timeline = [
    { label: '수집됨', sub: '14:02:14', state: 'done' },
    { label: '로젠 등록', sub: '14:05:42 · 3회 실패', state: 'failed' },
    { label: '운송장 출력', sub: '대기 중', state: 'pending' },
    { label: '마켓 제출', sub: '대기 중', state: 'pending' },
  ];

  return __Shell1(
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 30px 30px' }}>
      {/* Failure banner */}
      <div style={{
        background: t.dangerBg, border: `1px solid color-mix(in oklch, ${t.danger} 25%, transparent)`,
        borderRadius: 12, padding: '14px 18px', marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ width: 30, height: 30, borderRadius: 15, background: t.danger, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16 }}>!</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>로젠 자동 등록 3회 실패 — 수동 처리가 필요해요</div>
          <div style={{ fontSize: 12.5, color: t.dim, marginTop: 2 }}>로젠 콜센터에서 운송장을 수기 발급받은 뒤, 운송장 번호를 입력하면 자동 흐름으로 복귀해요</div>
        </div>
        <button style={{ padding: '9px 16px', background: t.danger, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>수동 입력 →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Order info */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>주문 정보</div>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {__Id1('m4', '옥션', 'lg', 'logo')}
                <span style={{ fontSize: 12.5, color: t.ink, fontWeight: 600 }}>옥션</span>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
              <KV1 label="외부 주문번호"><span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>AC-552901-XR</span></KV1>
              <KV1 label="주문 시각">2026.05.21 14:02:14</KV1>
              <KV1 label="상품"><span style={{ fontWeight: 600 }}>핸드드립 커피 원두 200g</span></KV1>
              <KV1 label="옵션 / 수량">에티오피아 예가체프 / 1개</KV1>
              <KV1 label="결제 금액"><span style={{ fontWeight: 700 }}>₩28,000</span></KV1>
              <KV1 label="할인 / 쿠폰">— / 마켓 즉시 1,000원</KV1>
            </div>
          </section>

          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em', marginBottom: 16 }}>배송 정보</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
              <KV1 label="수취인 / 연락처">최*진 · 010-XXXX-XXXX</KV1>
              <KV1 label="배송 메시지">부재 시 경비실에 맡겨주세요</KV1>
              <KV1 label="배송지">부산 해운대구 ████████ 209호 · (48058)</KV1>
              <KV1 label="운송장 번호"><span style={{ color: t.faint }}>— 아직 발급되지 않았어요</span></KV1>
            </div>
          </section>

          {/* Timeline */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em', marginBottom: 18 }}>처리 상태</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
              {timeline.map((step, i) => {
                const color = step.state === 'done' ? t.ok : (step.state === 'failed' ? t.danger : t.faint);
                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                    {i < timeline.length - 1 && (
                      <span style={{
                        position: 'absolute', top: 16, left: '50%', right: '-50%', height: 2,
                        background: timeline[i + 1].state === 'pending' ? t.border : color,
                        zIndex: 1,
                      }} />
                    )}
                    <div style={{
                      width: 32, height: 32, borderRadius: 16,
                      background: step.state === 'pending' ? t.card2 : color,
                      color: step.state === 'pending' ? t.faint : '#fff',
                      display: 'inline-grid', placeItems: 'center',
                      fontSize: 14, fontWeight: 700,
                      border: step.state === 'pending' ? `1.5px dashed ${t.borderHi}` : 'none',
                      marginBottom: 10, position: 'relative', zIndex: 2,
                    }}>{step.state === 'done' ? '✓' : (step.state === 'failed' ? '!' : i + 1)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: step.state === 'pending' ? t.faint : t.ink }}>{step.label}</div>
                    <div style={{ fontSize: 11, color: t.faint, marginTop: 3 }}>{step.sub}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Manual resolve */}
          <section style={{
            background: t.card, border: `2px solid ${t.danger}`, borderRadius: 14, padding: 18,
            boxShadow: `0 0 0 4px color-mix(in oklch, ${t.danger} 12%, transparent)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: t.danger, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>!</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>수동 운송장 입력</div>
            </div>
            <div style={{ fontSize: 12, color: t.dim, marginBottom: 14, lineHeight: 1.5 }}>로젠 콜센터(1588-9988)에서 발급받은 12자리 운송장 번호를 입력해 주세요.</div>
            <label style={{ fontSize: 12, color: t.dim, fontWeight: 600, display: 'block', marginBottom: 6 }}>운송장 번호 (12자리)</label>
            <input defaultValue="3812 9920 1149" style={{
              width: '100%', padding: '11px 13px', borderRadius: 10,
              border: `1.5px solid ${t.ok}`, background: '#fff',
              fontSize: 14, color: t.ink, fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
              letterSpacing: '0.04em', outline: 'none',
            }} />
            <div style={{ fontSize: 11.5, color: t.ok, marginTop: 4, fontWeight: 500 }}>✓ 형식 OK</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button style={{ flex: 1, padding: '10px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600 }}>취소</button>
              <button style={{ flex: 2, padding: '10px', background: t.danger, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>등록 · 자동 복귀</button>
            </div>
          </section>

          {/* Market dispatch */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 10 }}>마켓 송장 제출</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
              {__Id1('m4', '옥션', 'md', 'logo')}
              <span style={{ fontSize: 13, color: t.ink, fontWeight: 600, flex: 1 }}>옥션</span>
              {__Pill1('대기 중', t.faint, t.card2, { dot: true })}
            </div>
            <div style={{ fontSize: 11.5, color: t.faint, lineHeight: 1.5 }}>운송장 발급 후 자동으로 옥션 송장 API에 제출돼요.</div>
          </section>
        </div>
      </div>
    </div>,
    {
      title: '주문 상세 · AC-552901',
      sub: '핸드드립 커피 원두 200g · 로젠 실패',
      cta: <button style={{ padding: '8px 14px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }}>← 목록으로</button>,
      sidebarActive: 'orders',
    }
  );
}

Object.assign(window, { StudioOrdersList, StudioOrdersDetail });
