// Auth screen (login / signup tabs)
const { useState: useState_A } = React;

function AuthScreen({ onLogin }) {
  const [tab, setTab] = useState_A('login');
  const [email, setEmail] = useState_A('minji.kim@konai.com');
  const [pw, setPw] = useState_A('••••••••');
  const [remember, setRemember] = useState_A(true);
  const [name, setName] = useState_A('');
  const [agree, setAgree] = useState_A(false);

  const submitLogin = (e) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="auth-page">
      {/* Brand side */}
      <div className="auth-side">
        <div className="auth-brand">
          <div className="logo">M</div>
          <div className="name">MarketCast</div>
        </div>

        <div className="auth-hero">
          <h1>여러 마켓에<br />한 번에 등록하세요</h1>
          <p>네이버 스마트스토어, 11번가, G마켓, 옥션, 쿠팡 — 한 번의 입력으로 5개 마켓에 동시 등록. 반복 작업은 템플릿으로 자동화하세요.</p>
          <ul className="auth-hero-list">
            <li><span className="check"><Icons.Check size={12} /></span> 마켓별 자동 카테고리 매핑</li>
            <li><span className="check"><Icons.Check size={12} /></span> 이미지 일괄 업로드 · 자동 리사이즈</li>
            <li><span className="check"><Icons.Check size={12} /></span> 등록 실패 한눈에 확인 · 재시도</li>
          </ul>
        </div>

        <div className="auth-foot">© 2026 MarketCast · 개인정보처리방침 · 이용약관</div>
      </div>

      {/* Form side */}
      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={submitLogin}>
          <div className="auth-tabs">
            <button type="button" className={'auth-tab' + (tab === 'login' ? ' active' : '')} onClick={() => setTab('login')}>로그인</button>
            <button type="button" className={'auth-tab' + (tab === 'signup' ? ' active' : '')} onClick={() => setTab('signup')}>회원가입</button>
          </div>

          {tab === 'login' ? (
            <>
              <h2>다시 만나서 반가워요</h2>
              <p className="sub">계정에 로그인하고 등록 작업을 이어가세요</p>

              <div className="social-row">
                <button type="button" className="social-btn" title="네이버">
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: '#03C75A', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11 }}>N</span>
                  네이버
                </button>
                <button type="button" className="social-btn" title="카카오">
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: '#FEE500', color: '#3C1E1E', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11 }}>K</span>
                  카카오
                </button>
                <button type="button" className="social-btn" title="구글">
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: '#fff', border: '1px solid #E2E8F0', color: '#4285F4', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11 }}>G</span>
                  구글
                </button>
              </div>
              <div className="divider">또는 이메일로 로그인</div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label className="label">이메일</label>
                <div className="input-affix">
                  <div className="suffix" style={{ borderLeft: 'none', borderRight: '1px solid var(--border)' }}>
                    <Icons.Mail size={15} />
                  </div>
                  <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="label">비밀번호</label>
                <div className="input-affix">
                  <div className="suffix" style={{ borderLeft: 'none', borderRight: '1px solid var(--border)' }}>
                    <Icons.Lock size={15} />
                  </div>
                  <input type="password" className="input" value={pw} onChange={e => setPw(e.target.value)} />
                </div>
              </div>

              <div className="row between" style={{ marginBottom: 20, fontSize: 13, whiteSpace: 'nowrap' }}>
                <label className="row" style={{ cursor: 'pointer', gap: 8 }}>
                  <Checkbox checked={remember} onChange={setRemember} />
                  <span>로그인 유지</span>
                </label>
                <a href="#" style={{ color: 'var(--primary)', fontWeight: 600 }}>비밀번호 찾기</a>
              </div>

              <button type="submit" className="btn primary lg" style={{ width: '100%', justifyContent: 'center' }}>
                로그인
              </button>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
                아직 계정이 없으신가요?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setTab('signup'); }} style={{ color: 'var(--primary)', fontWeight: 600 }}>회원가입</a>
              </p>
            </>
          ) : (
            <>
              <h2>지금 시작하세요</h2>
              <p className="sub">14일 무료 체험 · 신용카드 등록 없이 바로 시작</p>

              <div className="field" style={{ marginBottom: 12 }}>
                <label className="label">이름</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" />
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="label">업무용 이메일</label>
                <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="label">비밀번호 <span className="muted" style={{ fontWeight: 500, marginLeft: 6 }}>8자 이상</span></label>
                <input type="password" className="input" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
              </div>

              <label className="row" style={{ cursor: 'pointer', gap: 8, marginBottom: 18, fontSize: 13 }}>
                <Checkbox checked={agree} onChange={setAgree} />
                <span><a href="#" style={{ color: 'var(--primary)', fontWeight: 600 }}>이용약관</a> 및 <a href="#" style={{ color: 'var(--primary)', fontWeight: 600 }}>개인정보처리방침</a>에 동의합니다</span>
              </label>

              <button type="button" disabled={!agree} className="btn primary lg" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogin}>
                계정 만들기
              </button>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
                이미 계정이 있으신가요?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setTab('login'); }} style={{ color: 'var(--primary)', fontWeight: 600 }}>로그인</a>
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });
