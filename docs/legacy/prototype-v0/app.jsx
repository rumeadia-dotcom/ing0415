// Main app shell with sidebar nav, routing, and tweaks
const { useState: useState_App, useEffect: useEffect_App } = React;

const NAV = [
  { key: 'dashboard', label: '대시보드', icon: 'Dashboard' },
  { key: 'register',  label: '상품 등록', icon: 'PlusBox' },
  { key: 'templates', label: '템플릿', icon: 'Template' },
  { key: 'markets',   label: '마켓 계정', icon: 'Store',  badge: '5' },
  { key: 'history',   label: '등록 이력', icon: 'History' },
];

const TITLES = {
  dashboard: '대시보드',
  register: '상품 등록',
  templates: '템플릿 관리',
  markets: '마켓 계정 관리',
  history: '등록 이력',
};

function App() {
  const [tweaks, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "sidebarCollapsed": false,
    "density": "balanced",
    "startScreen": "dashboard"
  }/*EDITMODE-END*/);

  const [route, setRoute] = useState_App('login'); // start at login

  // Apply density / sidebar
  useEffect_App(() => {
    document.documentElement.setAttribute('data-density',
      tweaks.density === 'compact' ? 'compact' :
      tweaks.density === 'comfortable' ? 'comfortable' : '');
  }, [tweaks.density]);

  const goto = (key) => setRoute(key);

  // Tweaks panel content (used in both auth + main shell)
  const TweaksContent = () => (
    <>
      <TweakSection label="레이아웃">
        <TweakToggle
          label="사이드바 접기"
          value={tweaks.sidebarCollapsed}
          onChange={(v) => setTweak('sidebarCollapsed', v)}
        />
        <TweakRadio
          label="정보 밀도"
          value={tweaks.density}
          onChange={(v) => setTweak('density', v)}
          options={[
            { value: 'compact', label: '조밀' },
            { value: 'balanced', label: '균형' },
            { value: 'comfortable', label: '여유' },
          ]}
        />
      </TweakSection>
      <TweakSection label="화면 이동">
        <TweakSelect
          label="현재 화면"
          value={route}
          onChange={(v) => setRoute(v)}
          options={[
            { value: 'login', label: '로그인' },
            { value: 'dashboard', label: '대시보드' },
            { value: 'register', label: '상품 등록 (5단계)' },
            { value: 'templates', label: '템플릿 관리' },
            { value: 'markets', label: '마켓 계정' },
            { value: 'history', label: '등록 이력' },
          ]}
        />
        <TweakSelect
          label="로그인 후 시작 화면"
          value={tweaks.startScreen}
          onChange={(v) => setTweak('startScreen', v)}
          options={[
            { value: 'dashboard', label: '대시보드' },
            { value: 'register', label: '상품 등록' },
            { value: 'templates', label: '템플릿' },
            { value: 'markets', label: '마켓 계정' },
            { value: 'history', label: '등록 이력' },
          ]}
        />
      </TweakSection>
    </>
  );

  if (route === 'login') {
    return (
      <>
        <AuthScreen onLogin={() => setRoute(tweaks.startScreen || 'dashboard')} />
        <TweaksPanel title="Tweaks"><TweaksContent /></TweaksPanel>
      </>
    );
  }

  const IconC = Icons[NAV.find(n => n.key === route)?.icon] || Icons.Dashboard;

  return (
    <div className="app" data-sidebar={tweaks.sidebarCollapsed ? 'collapsed' : 'expanded'}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">M</div>
          <div className="sidebar-name">
            MarketCast
            <small>다중 마켓 등록</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-group-label">메뉴</div>
          {NAV.map(item => {
            const Ico = Icons[item.icon];
            return (
              <button
                key={item.key}
                className={'nav-item' + (route === item.key ? ' active' : '')}
                onClick={() => goto(item.key)}>
                <Ico size={17} />
                <span>{item.label}</span>
                {item.badge && <span className="badge-count">{item.badge}</span>}
              </button>
            );
          })}

          <div className="sidebar-group-label">계정</div>
          <button className="nav-item">
            <Icons.Settings size={17} />
            <span>설정</span>
          </button>
          <button className="nav-item">
            <Icons.Help size={17} />
            <span>도움말</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">KM</div>
            <div className="user-info">
              <div className="user-name">{window.AppData.user.name}</div>
              <div className="user-email">{window.AppData.user.email}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setTweak('sidebarCollapsed', !tweaks.sidebarCollapsed)}>
            <Icons.Menu size={17} />
          </button>
          <div className="topbar-breadcrumb">
            <IconC size={14} />
            <span>{TITLES[route]}</span>
          </div>
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            <div className="search-input" style={{ width: 220, background: 'var(--bg-subtle)' }}>
              <Icons.Search size={14} />
              <input placeholder="검색…" />
              <span className="kbd">⌘K</span>
            </div>
            <button className="icon-btn">
              <Icons.Bell size={17} />
              <span className="dot" />
            </button>
            <button className="icon-btn" onClick={() => setRoute('login')} title="로그아웃">
              <Icons.User size={17} />
            </button>
          </div>
        </div>

        <div className="content">
          <div className="content-inner">
            {route === 'dashboard' && <DashboardScreen goto={goto} />}
            {route === 'register' && <RegisterScreen goto={goto} />}
            {route === 'templates' && <TemplatesScreen goto={goto} />}
            {route === 'markets' && <MarketsScreen goto={goto} />}
            {route === 'history' && <HistoryScreen goto={goto} />}
          </div>
        </div>
      </main>

      <TweaksPanel title="Tweaks"><TweaksContent /></TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
