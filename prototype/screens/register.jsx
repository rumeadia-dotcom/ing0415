// Product Register Wizard (5 steps: 정보 → 이미지 → 마켓·카테고리 → 미리보기 → 결과)
const { useState: useState_R, useEffect: useEffect_R } = React;

const REGISTER_STEPS = [
  { key: 'info',     label: 'STEP 1', name: '상품 정보' },
  { key: 'images',   label: 'STEP 2', name: '이미지 업로드' },
  { key: 'markets',  label: 'STEP 3', name: '마켓 · 카테고리' },
  { key: 'preview',  label: 'STEP 4', name: '미리보기' },
  { key: 'result',   label: 'STEP 5', name: '등록 결과' },
];

function Stepper({ current }) {
  return (
    <div className="stepper">
      {REGISTER_STEPS.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : '';
        return (
          <div key={s.key} className={'step ' + state}>
            <div className="step-num">{state === 'done' ? <Icons.Check size={13} /> : i + 1}</div>
            <div className="step-info">
              <div className="step-label">{s.label}</div>
              <div className="step-name">{s.name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Step 1: Info ----------
function StepInfo({ data, set }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">상품 기본 정보</div>
          <div className="card-sub">모든 마켓에 공통으로 사용될 정보입니다</div>
        </div>
        <button className="btn sm">
          <Icons.Template size={14} /> 템플릿에서 불러오기
        </button>
      </div>

      <div className="form-grid">
        <div className="field full">
          <label className="label">상품명 <span className="req">*</span></label>
          <input className="input" value={data.name} onChange={e => set('name', e.target.value)} placeholder="예) 오가닉 코튼 라운드 티셔츠" />
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{data.name.length} / 100자 · 마켓별 길이 제한에 자동 맞춤</div>
        </div>

        <div className="field">
          <label className="label">상품 코드 (SKU)</label>
          <input className="input" value={data.sku} onChange={e => set('sku', e.target.value)} placeholder="OCT-NV-001" />
        </div>
        <div className="field">
          <label className="label">브랜드</label>
          <input className="input" value={data.brand} onChange={e => set('brand', e.target.value)} placeholder="KONAI" />
        </div>

        <div className="field">
          <label className="label">판매가 <span className="req">*</span></label>
          <div className="input-affix">
            <input className="input" value={data.price} onChange={e => set('price', e.target.value)} placeholder="29,900" />
            <div className="suffix">원</div>
          </div>
        </div>
        <div className="field">
          <label className="label">할인가</label>
          <div className="input-affix">
            <input className="input" value={data.salePrice} onChange={e => set('salePrice', e.target.value)} placeholder="24,900" />
            <div className="suffix">원</div>
          </div>
        </div>

        <div className="field">
          <label className="label">재고 수량 <span className="req">*</span></label>
          <input className="input" value={data.stock} onChange={e => set('stock', e.target.value)} placeholder="100" />
        </div>
        <div className="field">
          <label className="label">배송비</label>
          <select className="select" value={data.shipping} onChange={e => set('shipping', e.target.value)}>
            <option>무료 배송</option>
            <option>3,000원</option>
            <option>2,500원 (조건부 무료)</option>
          </select>
        </div>

        <div className="field full">
          <label className="label">상품 설명</label>
          <textarea className="textarea" value={data.desc} onChange={e => set('desc', e.target.value)}
            placeholder="100% 오가닉 코튼으로 제작된 데일리 티셔츠. 부드러운 촉감과 통기성이 뛰어나며…" />
        </div>

        <div className="field full">
          <label className="label">태그</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--bg)' }}>
            {data.tags.map((t, i) => (
              <span key={i} className="tag-pill">
                {t}
                <span className="x" onClick={() => set('tags', data.tags.filter((_, j) => j !== i))}><Icons.X size={11} /></span>
              </span>
            ))}
            <input
              style={{ border: 'none', outline: 'none', flex: 1, minWidth: 100, fontSize: 13 }}
              placeholder="태그 입력 후 Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  set('tags', [...data.tags, e.target.value.trim()]);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 2: Images ----------
function StepImages({ data, set }) {
  const variants = ['', 'var-1', 'var-2', 'var-3', 'var-4'];
  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div>
            <div className="card-title">상품 이미지</div>
            <div className="card-sub">최대 10장 · 첫 번째 이미지가 대표 이미지가 됩니다 · 드래그로 순서 변경</div>
          </div>
          <button className="btn">
            <Icons.Upload size={14} /> 이미지 추가
          </button>
        </div>

        <div className="notice">
          <div className="ico"><Icons.Sparkles size={16} /></div>
          <div>
            <strong>자동 리사이즈가 적용됩니다.</strong> 마켓별 권장 해상도(네이버 1000×1000, 11번가 1000×1000, 쿠팡 500×500, G마켓 600×600)로 자동 변환되어 등록됩니다.
          </div>
        </div>

        <div className="image-grid" style={{ marginTop: 16 }}>
          {data.images.map((img, i) => (
            <div key={i} className="image-tile">
              <div className={'img-cover ' + variants[i % variants.length]}>
                <Icons.Image size={28} />
              </div>
              {i === 0 && <span className="badge-main">대표</span>}
              <button className="x-btn" onClick={() => set('images', data.images.filter((_, j) => j !== i))}>
                <Icons.X size={12} />
              </button>
            </div>
          ))}
          <div className="image-tile drop" onClick={() => set('images', [...data.images, { name: `img-${Date.now()}` }])}>
            <div>
              <div style={{ marginBottom: 6, color: 'var(--text-tertiary)' }}><Icons.Plus size={20} /></div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>이미지 추가</div>
              <div style={{ fontSize: 11, lineHeight: 1.4 }}>클릭 또는 드래그</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">상세 페이지 (HTML)</div>
            <div className="card-sub">마켓별 상세 페이지에 사용될 HTML 콘텐츠</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm"><Icons.Template size={14} /> 템플릿 사용</button>
            <button className="btn sm"><Icons.Edit size={14} /> 편집기 열기</button>
          </div>
        </div>
        <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--r)', padding: '16px 18px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div style={{ marginBottom: 10, fontWeight: 600, color: 'var(--text)' }}>📐 사이즈 · 소재 · 세탁 안내 · 배송 · 교환반품</div>
          <div className="muted" style={{ fontSize: 12 }}>5개 섹션, 약 2,400자 · 마지막 수정 어제 17:30</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 3: Markets + Category mapping ----------
function StepMarkets({ data, set }) {
  const markets = window.AppData.markets;
  const toggle = (id) => {
    if (data.markets.includes(id)) set('markets', data.markets.filter(m => m !== id));
    else set('markets', [...data.markets, id]);
  };

  const categoryMap = {
    naver:   '패션의류 > 남성의류 > 티셔츠 > 라운드넥',
    '11st':  '의류 > 남성의류 > 티셔츠 > 반팔',
    gmarket: '남성패션 > 티셔츠 > 라운드 반팔',
    auction: '의류 > 티셔츠 > 남성',
    coupang: '패션의류잡화 > 남성패션 > 티셔츠 > 반팔티셔츠',
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div>
            <div className="card-title">등록할 마켓 선택</div>
            <div className="card-sub">{data.markets.length}개 마켓 선택됨</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => set('markets', markets.filter(m => m.status === 'connected').map(m => m.id))}>
              연결된 마켓 모두 선택
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {markets.map(m => {
            const disabled = m.status !== 'connected';
            const selected = data.markets.includes(m.id);
            return (
              <div key={m.id}
                className={'market-card' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '')}
                onClick={() => !disabled && toggle(m.id)}>
                <MarketIcon id={m.id} size="lg" />
                <div className="market-card-body">
                  <div className="market-card-name">{m.name}</div>
                  <div className="market-card-meta">
                    {disabled
                      ? (m.status === 'expired' ? '⚠ 인증 만료' : '미연결')
                      : `${m.accounts}개 계정 연결됨`}
                  </div>
                </div>
                {!disabled && (
                  <div className="check-corner">
                    <Checkbox checked={selected} onChange={() => toggle(m.id)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">카테고리 매핑</div>
            <div className="card-sub">마켓별 카테고리를 자동으로 추천했습니다. 필요시 수정하세요.</div>
          </div>
          <Badge kind="info" dot>AI 자동 매핑</Badge>
        </div>
        {data.markets.length === 0 ? (
          <EmptyState title="마켓을 먼저 선택하세요" sub="위에서 등록할 마켓을 선택하면 카테고리가 자동 매핑됩니다." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.markets.map(id => {
              const m = markets.find(x => x.id === id);
              return (
                <div key={id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 32px', gap: 14, alignItems: 'center', padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--r)' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <MarketIcon id={id} />
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                    <Icons.Tag size={13} />
                    <span style={{ flex: 1 }}>{categoryMap[id]}</span>
                    <Badge kind="success">매칭 완료</Badge>
                  </div>
                  <button className="icon-btn"><Icons.Edit size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Step 4: Preview ----------
function StepPreview({ data }) {
  const markets = window.AppData.markets;
  const [active, setActive] = useState_R(data.markets[0] || 'naver');
  const m = markets.find(x => x.id === active);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div>
            <div className="card-title">등록 미리보기</div>
            <div className="card-sub">각 마켓에서 어떻게 노출될지 미리 확인하세요</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {data.markets.map(id => {
              const mm = markets.find(x => x.id === id);
              const isAct = id === active;
              return (
                <button key={id}
                  onClick={() => setActive(id)}
                  className="btn sm"
                  style={{
                    background: isAct ? mm.color : 'var(--bg)',
                    color: isAct ? 'white' : 'var(--text)',
                    borderColor: isAct ? mm.color : 'var(--border)',
                    fontWeight: 600,
                  }}>
                  {mm.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="preview-pane">
          <div className="preview-mock">
            <div className="preview-mock-head">
              <span style={{ width: 18, height: 18, borderRadius: 4, background: m.color, color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 10 }}>{m.short}</span>
              <span style={{ fontWeight: 600 }}>{m.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11 }}>미리보기</span>
            </div>
            <div className="preview-mock-body">
              <div className="preview-mock-img" />
              <div className="preview-mock-info">
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{data.brand || 'KONAI'}</div>
                <div className="preview-mock-title">{data.name}</div>
                <div style={{ marginTop: 8 }}>
                  {data.salePrice && <span className="preview-mock-strike">{data.price}원</span>}
                  <span className="preview-mock-price">{(data.salePrice || data.price)}원</span>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 10, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <Badge kind="success">무료배송</Badge>
                  <Badge>★ 4.8 (1,284)</Badge>
                </div>
              </div>
            </div>
            <div style={{ padding: '10px 16px', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
              카테고리: 패션의류 &gt; 남성의류 &gt; 티셔츠 &gt; 라운드넥
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">등록 요약</div>
            <div className="card-sub">아래 정보로 일괄 등록됩니다</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <SummaryItem label="상품명" value={data.name} />
          <SummaryItem label="판매가" value={`${data.salePrice || data.price}원`} />
          <SummaryItem label="재고" value={`${data.stock}개`} />
          <SummaryItem label="등록 마켓" value={`${data.markets.length}개 마켓`} />
          <SummaryItem label="이미지" value={`${data.images.length}장`} />
          <SummaryItem label="브랜드" value={data.brand || '-'} />
          <SummaryItem label="SKU" value={data.sku || '-'} />
          <SummaryItem label="태그" value={`${data.tags.length}개`} />
        </div>
      </div>
    </div>
  );
}
function SummaryItem({ label, value }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11.5, marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  );
}

// ---------- Step 5: Result ----------
function StepResult({ data, onRestart }) {
  const markets = window.AppData.markets;
  // Simulated outcomes per market
  const results = useMemo_R(() => {
    return data.markets.map(id => {
      // make naver always success, auction always fail
      let status = 'success';
      let pid = `PID-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      let err = null;
      if (id === 'auction') { status = 'error'; err = '브랜드 등록 미인증 — 셀러 인증 필요'; pid = null; }
      else if (id === 'gmarket') { status = 'error'; err = '카테고리 속성 누락: 핏(Fit)'; pid = null; }
      return { id, status, pid, err };
    });
  }, [data.markets]);

  // Animate progress
  const [progress, setProgress] = useState_R(0);
  useEffect_R(() => {
    const t = setInterval(() => setProgress(p => Math.min(100, p + 8)), 80);
    return () => clearInterval(t);
  }, []);
  const done = progress >= 100;
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.length - successCount;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="row" style={{ gap: 10 }}>
              {!done && <div className="result-status-icon loading"><Icons.Spinner size={14} /></div>}
              {done && errorCount === 0 && <div className="result-status-icon success"><Icons.Check size={14} /></div>}
              {done && errorCount > 0 && <div className="result-status-icon" style={{ background: 'var(--warning-soft)', color: '#B45309' }}><Icons.Alert size={14} /></div>}
              <div>
                <div className="card-title" style={{ fontSize: 16 }}>
                  {!done && '일괄 등록 진행 중…'}
                  {done && errorCount === 0 && '모든 마켓 등록 완료'}
                  {done && errorCount > 0 && `${successCount}개 성공, ${errorCount}개 실패`}
                </div>
                <div className="card-sub">
                  {!done && `${Math.round(progress)}% · 마켓별 API를 호출하고 있습니다`}
                  {done && '아래에서 마켓별 결과를 확인하세요'}
                </div>
              </div>
            </div>
          </div>
          {done && (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn"><Icons.Download size={14} /> 결과 내보내기</button>
              <button className="btn primary" onClick={onRestart}><Icons.Plus size={14} /> 새 상품 등록</button>
            </div>
          )}
        </div>
        <div className="progress-bar"><div className="fill" style={{ width: progress + '%', background: done && errorCount > 0 ? 'var(--warning)' : 'var(--primary)' }} /></div>
      </div>

      <div className="card table-card">
        <div className="table-toolbar">
          <div className="card-title">마켓별 등록 결과</div>
          {done && errorCount > 0 && (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sm"><Icons.Refresh size={14} /> 실패한 마켓 재시도</button>
              <button className="btn sm">실패 마켓 제외하고 등록</button>
            </div>
          )}
        </div>
        {results.map((r, i) => {
          const m = markets.find(x => x.id === r.id);
          const stillLoading = !done && progress < (i + 1) * (100 / results.length);
          return (
            <div className="result-row" key={r.id}>
              {stillLoading && <div className="result-status-icon loading"><Icons.Spinner size={14} /></div>}
              {!stillLoading && r.status === 'success' && <div className="result-status-icon success"><Icons.Check size={14} /></div>}
              {!stillLoading && r.status === 'error' && <div className="result-status-icon error"><Icons.X size={14} /></div>}
              <div>
                <div className="row" style={{ gap: 10 }}>
                  <MarketIcon id={r.id} size="sm" />
                  <span className="result-name">{m.name}</span>
                </div>
                <div className="result-meta" style={{ marginTop: 3 }}>
                  {stillLoading && '등록 중…'}
                  {!stillLoading && r.status === 'success' && `상품 ID: ${r.pid} · 정상 등록됨`}
                  {!stillLoading && r.status === 'error' && (
                    <span style={{ color: 'var(--danger)', fontWeight: 500 }}>⚠ {r.err}</span>
                  )}
                </div>
              </div>
              <div>
                {!stillLoading && r.status === 'success' && <Badge kind="success" dot>등록 완료</Badge>}
                {!stillLoading && r.status === 'error' && <Badge kind="danger" dot>실패</Badge>}
                {stillLoading && <Badge kind="info" dot>처리 중</Badge>}
              </div>
              <div>
                {!stillLoading && r.status === 'success' && (
                  <button className="btn sm ghost"><Icons.Eye size={14} /> 보기</button>
                )}
                {!stillLoading && r.status === 'error' && (
                  <button className="btn sm"><Icons.Refresh size={14} /> 재시도</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// borrow useMemo with rename to avoid shadow
const useMemo_R = React.useMemo;

// ---------- Main wizard wrapper ----------
function RegisterScreen({ goto }) {
  const [step, setStep] = useState_R(0);
  const [data, setData] = useState_R({
    name: '오가닉 코튼 라운드 티셔츠 (네이비, L)',
    sku: 'OCT-NV-L-001',
    brand: 'KONAI',
    price: '29,900',
    salePrice: '24,900',
    stock: '120',
    shipping: '무료 배송',
    desc: '100% 오가닉 코튼으로 제작된 데일리 티셔츠. 부드러운 촉감과 통기성이 뛰어나며 일상에서 편안하게 착용할 수 있습니다.',
    tags: ['오가닉', '데일리', '남성티셔츠', '라운드넥'],
    images: [{ name: 'img-1' }, { name: 'img-2' }, { name: 'img-3' }, { name: 'img-4' }],
    markets: ['naver', '11st', 'gmarket', 'coupang'],
  });
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const canNext = () => {
    if (step === 0) return !!data.name && !!data.price && !!data.stock;
    if (step === 1) return data.images.length > 0;
    if (step === 2) return data.markets.length > 0;
    return true;
  };

  const reset = () => {
    setStep(0);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">상품 등록</h1>
          <p className="page-subtitle">한 번의 입력으로 여러 마켓에 동시 등록하세요</p>
        </div>
        <div className="page-header-actions">
          {step < 4 && <button className="btn ghost" onClick={() => goto('dashboard')}>취소</button>}
          {step < 4 && <button className="btn">임시 저장</button>}
        </div>
      </div>

      <Stepper current={step} />

      {step === 0 && <StepInfo data={data} set={set} />}
      {step === 1 && <StepImages data={data} set={set} />}
      {step === 2 && <StepMarkets data={data} set={set} />}
      {step === 3 && <StepPreview data={data} />}
      {step === 4 && <StepResult data={data} onRestart={reset} />}

      {step < 4 && (
        <div className="wizard-footer">
          <div className="left">
            {step === 0 && '필수 정보를 입력해주세요'}
            {step === 1 && `${data.images.length}장의 이미지가 업로드되었습니다`}
            {step === 2 && `${data.markets.length}개 마켓에 등록됩니다`}
            {step === 3 && '미리보기를 확인하고 등록을 시작하세요'}
          </div>
          <div className="row" style={{ gap: 8 }}>
            {step > 0 && (
              <button className="btn" onClick={() => setStep(s => s - 1)}>
                <Icons.ChevronLeft size={14} /> 이전
              </button>
            )}
            {step < 3 && (
              <button className="btn primary" disabled={!canNext()} onClick={() => setStep(s => s + 1)}>
                다음 <Icons.ChevronRight size={14} />
              </button>
            )}
            {step === 3 && (
              <button className="btn primary" onClick={() => setStep(4)}>
                <Icons.Sparkles size={14} /> {data.markets.length}개 마켓에 일괄 등록
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { RegisterScreen });
