/* global React */
// Studio — s3 supplementary register steps (1, 2, 3, 5).
// Step 4 (preview) lives in studio.jsx — this file covers the rest.

const _t = () => window.studioTokens;
const _Shell = (...a) => window.studioShell(...a);
const _Pill = (...a) => window.studioPill(...a);
const _Identity = (id, label, size, mode) => window.marketIdentity(id, label, size, mode);

// Shared stepper used by Steps 1–4 (Step 5 omits it)
function RegisterStepper({ current }) {
  const t = _t();
  const steps = [
    { n: 1, label: '상품 정보' },
    { n: 2, label: '이미지' },
    { n: 3, label: '마켓 · 카테고리' },
    { n: 4, label: '미리보기' },
    { n: 5, label: '결과' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 22 }}>
      {steps.map((s, i) => {
        const done = s.n < current;
        const cur  = s.n === current;
        return (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 14,
                background: cur ? t.ink : (done ? t.accentBg : t.card),
                color: cur ? t.accent : (done ? t.accent : t.faint),
                border: `1.5px solid ${cur ? t.ink : (done ? t.accent : t.border)}`,
                fontSize: 13, fontWeight: 700,
                display: 'grid', placeItems: 'center',
              }}>{done ? '✓' : s.n}</span>
              <span style={{ fontSize: 13.5, color: cur ? t.ink : (done ? t.ink : t.faint), fontWeight: cur ? 700 : 500 }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <span style={{ flex: 1, height: 1.5, background: done ? t.accent : t.border, margin: '0 14px', opacity: done ? 0.5 : 1 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Field helper
function Field({ label, children, hint, error, required }) {
  const t = _t();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 12.5, color: t.dim, fontWeight: 600 }}>{label}</label>
        {required && <span style={{ fontSize: 11, color: t.danger, fontWeight: 700 }}>*</span>}
        {hint && <span style={{ fontSize: 11, color: t.faint, marginLeft: 'auto' }}>{hint}</span>}
      </div>
      {children}
      {error && <div style={{ fontSize: 11.5, color: t.danger, marginTop: 4, fontWeight: 500 }}>{error}</div>}
    </div>
  );
}

function Input({ value, placeholder, error, suffix, mono }) {
  const t = _t();
  return (
    <div style={{ position: 'relative' }}>
      <input defaultValue={value} placeholder={placeholder} style={{
        width: '100%', padding: '11px 13px', borderRadius: 10,
        border: `${error ? 1.5 : 1}px solid ${error ? t.danger : t.borderHi}`,
        background: '#fff', fontSize: 14, color: t.ink, outline: 'none',
        fontFamily: mono ? 'ui-monospace, "JetBrains Mono", monospace' : 'inherit',
        paddingRight: suffix ? 60 : 13,
      }} />
      {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: t.faint, fontWeight: 600 }}>{suffix}</span>}
    </div>
  );
}

function ActionBar({ prev, next, nextLabel, disabled, note }) {
  const t = _t();
  return (
    <div style={{
      marginTop: 22, padding: '14px 20px', background: t.card,
      border: `1px solid ${t.border}`, borderRadius: 14,
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 6px 18px -8px rgba(0,0,0,0.12)',
    }}>
      <button style={{ padding: '10px 16px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>← {prev}</button>
      <div style={{ flex: 1, fontSize: 12.5, color: t.faint }}>{note}</div>
      <button disabled={disabled} style={{
        padding: '10px 22px',
        background: disabled ? `color-mix(in oklch, ${t.ink} 30%, transparent)` : t.ink,
        color: '#fff', border: 'none', borderRadius: 10,
        fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      }}>{nextLabel || `다음: ${next} →`}</button>
    </div>
  );
}

// ========== Step 1 — 상품 정보 ==========
function StudioRegisterStep1() {
  const t = _t();
  return _Shell(
    <div style={{ height: '100%', overflow: 'auto', padding: '22px 30px 30px' }}>
      <RegisterStepper current={1} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
        {/* Form */}
        <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 4 }}>기본 정보</div>
          <div style={{ fontSize: 12.5, color: t.faint, marginBottom: 18 }}>여기서 입력한 정보는 모든 마켓에 공통으로 사용돼요.</div>

          <Field label="상품명" required hint="100자 이내">
            <Input value="오가닉 면 티셔츠 [블랙/M]" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="판매가" required hint="원">
              <Input value="29,000" suffix="₩" mono />
            </Field>
            <Field label="정가 (할인 표시용)" hint="원, 선택">
              <Input value="35,000" suffix="₩" mono />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="브랜드" hint="일부 카테고리 필수">
              <Input value="" placeholder="예) konai" error="G마켓·옥션 카테고리는 브랜드가 필요해요" />
            </Field>
            <Field label="제조사">
              <Input value="" placeholder="예) konai 코리아" />
            </Field>
          </div>

          <Field label="내부 카테고리" required>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 13px', border: `1px solid ${t.borderHi}`, borderRadius: 10, background: '#fff', fontSize: 13.5, color: t.ink }}>
              <span>패션의류</span><span style={{ color: t.faint }}>›</span>
              <span>남성의류</span><span style={{ color: t.faint }}>›</span>
              <span style={{ fontWeight: 600 }}>티셔츠</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: t.accent, fontWeight: 600 }}>변경</span>
            </div>
          </Field>

          <Field label="배송 정책" required>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 13px', border: `1px solid ${t.borderHi}`, borderRadius: 10, background: '#fff', fontSize: 13.5, color: t.ink }}>
              <span style={{ fontWeight: 600 }}>기본 배송 정책</span>
              <span style={{ fontSize: 11.5, color: t.faint }}>로젠택배 · 3,000원 · 30,000원↑ 무료</span>
              <span style={{ marginLeft: 'auto', fontSize: 14, color: t.faint }}>▾</span>
            </div>
          </Field>

          <Field label="상품 설명 (HTML)" hint="50,000자 이내 · v2 WYSIWYG">
            <textarea defaultValue="오가닉 100% 면으로 제작된 데일리 티셔츠입니다.&#10;&#10;• 소재: 코튼 100%&#10;• 사이즈: S / M / L / XL&#10;• 세탁: 30°C 이하 단독 세탁 권장" style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${t.borderHi}`, background: '#fff',
              fontSize: 13.5, color: t.ink, outline: 'none',
              fontFamily: 'inherit', minHeight: 110, resize: 'vertical',
            }} />
          </Field>
        </section>

        {/* Side hints */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: t.warnBg, border: `1px solid color-mix(in oklch, ${t.warn} 25%, transparent)`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginBottom: 6 }}>완료 조건 (1/2)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: t.text }}>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ color: t.ok, fontWeight: 700 }}>✓</span> 상품명·가격·카테고리·배송정책 입력</div>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ color: t.danger, fontWeight: 700 }}>!</span> 브랜드 미입력 — 일부 마켓에서 등록 불가</div>
            </div>
          </div>

          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginBottom: 6 }}>중복 상품명 검사</div>
            <div style={{ fontSize: 12, color: t.dim, marginBottom: 10 }}>이름이 같은 미완료 상품이 있는지 자동으로 확인해요.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: t.okBg, borderRadius: 8 }}>
              <span style={{ width: 16, height: 16, borderRadius: 8, background: t.ok, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: 12.5, color: t.ok, fontWeight: 600 }}>중복 없음 · 500ms 디바운스</span>
            </div>
          </div>

          <div style={{ background: t.card2, border: `1.5px dashed ${t.borderHi}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.dim, marginBottom: 4 }}>💡 템플릿 불러오기 (v2)</div>
            <div style={{ fontSize: 11.5, color: t.faint }}>자주 쓰는 상품 정보를 저장해 두면 5초 만에 등록할 수 있어요.</div>
          </div>
        </aside>
      </div>

      <ActionBar
        prev="취소"
        next="이미지"
        note="브랜드 입력 후 다음으로 진행할 수 있어요"
      />
    </div>,
    {
      title: '상품 등록',
      sub: '단계 1 / 5 · 모든 마켓 공통 정보',
      cta: <button style={{ padding: '8px 14px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }}>임시저장</button>,
      sidebarActive: 'register',
    }
  );
}

// ========== Step 2 — 이미지 ==========
function StudioRegisterStep2() {
  const t = _t();
  const images = [
    { id: 1, main: true, label: '메인' },
    { id: 2, main: false, label: '서브 1' },
    { id: 3, main: false, label: '서브 2' },
    { id: 4, main: false, label: '서브 3' },
    { id: 5, main: false, label: '서브 4' },
  ];
  return _Shell(
    <div style={{ height: '100%', overflow: 'auto', padding: '22px 30px 30px' }}>
      <RegisterStepper current={2} />

      <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 4 }}>상품 이미지</div>
        <div style={{ fontSize: 12.5, color: t.faint, marginBottom: 16 }}>1~10장, 대표 1장 필수. 마켓별 규격은 업로드 후 자동 최적화돼요.</div>

        {/* Dropzone */}
        <div style={{
          border: `2px dashed ${t.borderHi}`, borderRadius: 14, padding: 28,
          background: t.card2, marginBottom: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: t.accentBg, color: t.accent, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 300 }}>+</div>
          <div style={{ fontSize: 14, color: t.ink, fontWeight: 600 }}>여기로 드래그하거나 클릭해 업로드</div>
          <div style={{ fontSize: 12, color: t.faint }}>JPG · PNG · WebP · 각 10MB 이하 · 1000×1000 권장</div>
          <button style={{ marginTop: 8, padding: '8px 16px', background: t.ink, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600 }}>파일 선택</button>
        </div>

        {/* Thumbnail grid */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>업로드된 이미지 5장</div>
          <div style={{ fontSize: 11.5, color: t.faint }}>드래그로 순서 변경 · 별표 클릭으로 대표 지정</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {images.map((img, i) => (
            <div key={img.id} style={{
              position: 'relative', borderRadius: 12, overflow: 'hidden',
              border: img.main ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
            }}>
              <div className="mc-img-ph" style={{ aspectRatio: '1', width: '100%', borderRadius: 0 }}>IMG · {i + 1}</div>
              <div style={{ padding: '8px 10px', background: t.card }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: img.main ? t.accent : t.dim, fontWeight: 700 }}>{img.main ? '★ 메인' : '☆ 서브'}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${t.border}`, background: '#fff', fontSize: 10, color: t.dim, padding: 0 }}>◀</button>
                    <button style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${t.border}`, background: '#fff', fontSize: 10, color: t.dim, padding: 0 }}>▶</button>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>1.2 MB</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: t.danger, fontWeight: 600 }}>삭제</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress (extra slot — example uploading) */}
        <div style={{ marginTop: 14, padding: '10px 14px', background: t.infoBg, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 26, height: 26, borderRadius: 6, background: t.info, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>↑</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>back-detail-002.jpg · 업로드 중 64%</div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.5)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: '64%', height: '100%', background: t.info }} />
            </div>
          </div>
        </div>
      </section>

      <ActionBar
        prev="상품 정보"
        next="마켓 · 카테고리"
        note="이미지 5장 · 대표 지정 완료"
      />
    </div>,
    {
      title: '상품 등록',
      sub: '단계 2 / 5 · 이미지 업로드 · 순서 조정',
      cta: <button style={{ padding: '8px 14px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }}>임시저장</button>,
      sidebarActive: 'register',
    }
  );
}

// ========== Step 3 — 마켓 · 카테고리 ==========
function StudioRegisterStep3() {
  const t = _t();
  const markets = [
    { id: 'm1', label: '네이버 스마트스토어', cat: '패션의류 › 남성의류 › 티셔츠', sel: true, status: 'ok' },
    { id: 'm2', label: '쿠팡', cat: '패션의류잡화 › 남성의류 › 반팔티셔츠', sel: true, status: 'ok' },
    { id: 'm3', label: 'G마켓', cat: '— 카테고리 미선택', sel: true, status: 'pending' },
    { id: 'm4', label: '옥션', cat: '패션 › 남성의류 › 반팔티', sel: true, status: 'ok' },
    { id: 'm5', label: '11번가', cat: 'v2 예정', sel: false, status: 'soon' },
  ];
  return _Shell(
    <div style={{ height: '100%', overflow: 'auto', padding: '22px 30px 30px' }}>
      <RegisterStepper current={3} />

      {/* Section A — market selection */}
      <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>등록할 마켓 선택</div>
            <div style={{ fontSize: 12.5, color: t.faint, marginTop: 3 }}>4개 마켓 선택됨 · 비활성 마켓은 사유 표시</div>
          </div>
          <span style={{ fontSize: 12.5, color: t.accent, fontWeight: 700 }}>+ 마켓 연결 추가</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {markets.map(m => (
            <div key={m.id} style={{
              border: m.sel ? `1.5px solid ${t.ink}` : `1px solid ${t.border}`,
              borderRadius: 12, padding: 14,
              background: m.sel ? `color-mix(in oklch, ${t.accent} 5%, ${t.card})` : t.card,
              opacity: m.status === 'soon' ? 0.5 : 1,
              cursor: m.status === 'soon' ? 'not-allowed' : 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {_Identity(m.id, m.label, 'lg', 'logo')}
                <span style={{
                  marginLeft: 'auto', width: 18, height: 18, borderRadius: 4,
                  border: `1.5px solid ${m.sel ? t.ink : t.borderHi}`,
                  background: m.sel ? t.ink : '#fff', position: 'relative',
                }}>{m.sel && <span style={{ position: 'absolute', top: 1, left: 4, color: '#fff', fontSize: 10, lineHeight: 1, fontWeight: 700 }}>✓</span>}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 10.5, color: t.faint }}>{m.status === 'soon' ? '준비 중 · v2' : '연결됨'}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Section B — category mapping per selected market */}
      <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 14 }}>마켓별 카테고리 매핑</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {markets.filter(m => m.sel).map(m => (
            <div key={m.id} style={{
              border: `1px solid ${t.border}`, borderRadius: 12, padding: 16,
              display: 'grid', gridTemplateColumns: '36px 1fr 280px 110px', gap: 14, alignItems: 'center',
              background: m.status === 'pending' ? `color-mix(in oklch, ${t.warn} 5%, transparent)` : 'transparent',
            }}>
              {_Identity(m.id, m.label, 'lg', 'logo')}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{m.label}</div>
                <div style={{ fontSize: 11.5, color: m.status === 'pending' ? t.warn : t.faint, marginTop: 2, fontWeight: m.status === 'pending' ? 600 : 400 }}>{m.cat}</div>
              </div>
              <input placeholder="카테고리 검색 · 키워드 입력" style={{
                padding: '8px 11px', borderRadius: 8, border: `1px solid ${t.border}`,
                background: '#fff', fontSize: 12.5, color: t.ink, outline: 'none', fontFamily: 'inherit',
              }} />
              {m.status === 'pending'
                ? _Pill('선택 필요', t.warn, t.warnBg, { dot: true })
                : _Pill('매핑 완료', t.ok, t.okBg, { dot: true })}
            </div>
          ))}
        </div>
      </section>

      <ActionBar
        prev="이미지"
        next="미리보기"
        note="G마켓 카테고리를 선택하면 다음으로 진행할 수 있어요"
      />
    </div>,
    {
      title: '상품 등록',
      sub: '단계 3 / 5 · 마켓 선택 + 카테고리 매핑',
      cta: <button style={{ padding: '8px 14px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }}>임시저장</button>,
      sidebarActive: 'register',
    }
  );
}

// ========== Step 5 — 결과 (위저드 바깥, stepper 없음) ==========
function StudioRegisterStep5() {
  const t = _t();
  const results = [
    { id: 'm1', label: '네이버 스마트스토어', status: 'success',     pid: 'NSP-22847102', dur: '01:24', attempts: 1 },
    { id: 'm2', label: '쿠팡',                status: 'success',     pid: 'CPP-VR-2847',  dur: '01:08', attempts: 1 },
    { id: 'm4', label: '옥션',                status: 'success',     pid: 'ACP-118372X',  dur: '00:52', attempts: 1 },
    { id: 'm3', label: 'G마켓',               status: 'failed_final', err: 'brand_required · 의류 카테고리는 브랜드 입력이 필수입니다', attempts: 3 },
  ];

  return (
    <div style={{
      width: '100%', height: '100%', background: t.bg, color: t.text,
      fontFamily: '"Manrope", "Pretendard", ui-sans-serif, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Custom header — no sidebar wizard chrome */}
      <header style={{ padding: '22px 30px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, color: t.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            등록 결과 · #J-2848
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink }}>오가닉 면 티셔츠 [블랙/M]</h1>
          <div style={{ fontSize: 13, color: t.dim, marginTop: 4 }}>4개 마켓 중 3개 성공 · 평균 01:08 소요</div>
        </div>
        {window.studioPill('일부 성공', t.warn, t.warnBg, { dot: true })}
        <button style={{ padding: '9px 16px', background: t.card, color: t.ink, border: `1px solid ${t.borderHi}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>이력으로</button>
        <button style={{ padding: '9px 16px', background: t.ink, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>대시보드로</button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 30px 30px' }}>
        {/* Progress hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 16 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', lineHeight: 1 }}>3 / 4</div>
                <div style={{ fontSize: 12.5, color: t.faint, marginTop: 4 }}>마켓에 등록 완료</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.ok, letterSpacing: '-0.015em' }}>75%</div>
                <div style={{ fontSize: 11.5, color: t.faint }}>전체 진행률</div>
              </div>
            </div>
            <div style={{ height: 12, background: t.card2, borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: '75%', height: '100%', background: t.ok }} />
              <div style={{ width: '25%', height: '100%', background: t.danger }} />
            </div>
            <div style={{ display: 'flex', gap: 22, marginTop: 14, fontSize: 12.5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: t.ok }} />성공 3</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: t.danger }} />실패 1</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', color: t.faint }}><span style={{ width: 8, height: 8, borderRadius: 4, background: t.ok, opacity: 0.4 }} />Realtime · 14:22 종료</span>
            </div>
          </div>

          <div style={{ background: t.warnBg, border: `1.5px solid color-mix(in oklch, ${t.warn} 30%, transparent)`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: t.warn, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>!</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>일부 마켓 실패</div>
            </div>
            <div style={{ fontSize: 12.5, color: t.dim, marginBottom: 12, lineHeight: 1.5 }}>실패한 1개 마켓만 골라 새 잡으로 재시도할 수 있어요. 성공한 마켓은 유지됩니다.</div>
            <button style={{ width: '100%', padding: '10px', background: t.warn, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>마켓 제외 후 재등록 →</button>
            <button style={{ width: '100%', padding: '10px', background: 'transparent', color: t.warn, border: `1px solid ${t.warn}`, borderRadius: 9, fontSize: 13, fontWeight: 600 }}>전체 재시도</button>
          </div>
        </div>

        {/* Per-market results */}
        <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, fontSize: 14, fontWeight: 700, color: t.ink }}>마켓별 결과</div>
          {results.map((r, i) => {
            const ok = r.status === 'success';
            return (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 180px 110px 80px 80px',
                padding: '14px 18px', alignItems: 'center', gap: 14, fontSize: 13,
                borderBottom: i < results.length - 1 ? `1px solid ${t.border}` : 'none',
                borderLeft: `3px solid ${ok ? t.ok : t.danger}`, marginLeft: -1,
              }}>
                {_Identity(r.id, r.label, 'lg', 'logo')}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{r.label}</div>
                  {ok
                    ? <a style={{ fontSize: 11.5, color: t.accent, fontWeight: 600 }}>외부 상품 보기 ↗ · {r.pid}</a>
                    : <div style={{ fontSize: 11.5, color: t.danger, marginTop: 2, fontWeight: 500 }}>{r.err}</div>
                  }
                </div>
                <span style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11.5, color: t.dim }}>{ok ? r.pid : '—'}</span>
                <span>{ok ? window.studioPill('등록 완료', t.ok, t.okBg, { dot: true }) : window.studioPill('재시도 불가', t.danger, t.dangerBg, { dot: true })}</span>
                <span style={{ fontSize: 11.5, color: t.faint, fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>{ok ? r.dur : `${r.attempts}/3`}</span>
                <span style={{ textAlign: 'right' }}>
                  {ok
                    ? <button style={{ padding: '6px 11px', background: 'transparent', color: t.dim, border: `1px solid ${t.border}`, borderRadius: 7, fontSize: 11.5, fontWeight: 600 }}>상세</button>
                    : <button style={{ padding: '6px 11px', background: t.card2, color: t.faint, border: `1px solid ${t.border}`, borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'not-allowed' }}>수정 필요</button>}
                </span>
              </div>
            );
          })}
        </section>

        <div style={{ marginTop: 14, padding: '12px 18px', background: t.dangerBg, border: `1px solid color-mix(in oklch, ${t.danger} 22%, transparent)`, borderRadius: 12, fontSize: 12.5, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: t.danger, fontWeight: 700 }}>실패 분석:</span>
          G마켓은 의류 카테고리 등록 시 브랜드 정보가 필수예요. 상품 정보를 수정한 뒤 마켓 제외 재등록을 시도하세요.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  StudioRegisterStep1, StudioRegisterStep2, StudioRegisterStep3, StudioRegisterStep5,
});
