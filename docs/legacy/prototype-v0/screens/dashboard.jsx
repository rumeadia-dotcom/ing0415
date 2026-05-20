// Dashboard screen
const { useState: useState_D } = React;

function DashboardScreen({ goto }) {
  const stats = window.AppData.stats;
  const recent = window.AppData.recent;
  const markets = window.AppData.markets;

  // Mock bar chart (last 7 days)
  const bars = [
    { day: '월', n: 18 }, { day: '화', n: 24 }, { day: '수', n: 16 },
    { day: '목', n: 30 }, { day: '금', n: 22 }, { day: '토', n: 9 }, { day: '일', n: 23 },
  ];
  const maxN = Math.max(...bars.map(b => b.n));

  // Market distribution
  const marketStats = [
    { id: 'naver', count: 412, share: 32 },
    { id: '11st', count: 298, share: 23 },
    { id: 'gmarket', count: 245, share: 19 },
    { id: 'coupang', count: 224, share: 18 },
    { id: 'auction', count: 105, share: 8 },
  ];

  const statusBadge = (s, count, fail) => {
    if (s === 'success') return <Badge kind="success" dot>완료 {count}/{count}</Badge>;
    if (s === 'partial') return <Badge kind="warning" dot>부분 성공 {count}/{count + (fail || 0)}</Badge>;
    if (s === 'failed') return <Badge kind="danger" dot>실패 0/{fail}</Badge>;
    if (s === 'pending') return <Badge kind="info" dot>등록 중</Badge>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">안녕하세요, 민지님 👋</h1>
          <p className="page-subtitle">오늘 등록 현황과 마켓별 통계를 확인하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn"><Icons.Refresh size={15} /> 새로고침</button>
          <button className="btn primary" onClick={() => goto('register')}>
            <Icons.Plus size={15} /> 상품 등록
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label"><Icons.Box size={14} /> 누적 등록 상품</div>
          <div className="stat-value">{stats.totalProducts.toLocaleString()}</div>
          <div className="stat-meta"><span className="up"><Icons.ArrowUp size={11} /> 8.2%</span> 지난달 대비</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Icons.Sparkles size={14} /> 이번 달 등록</div>
          <div className="stat-value">{stats.monthlyRegistered}</div>
          <div className="stat-meta">
            <div className="spark" style={{ width: 80 }}>
              {[3,5,2,6,4,7,5,8,6,9].map((h, i) => (
                <div key={i} className={'b' + (h > 6 ? ' hi' : '')} style={{ height: h * 2.5 }} />
              ))}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Icons.CheckCircle size={14} /> 성공률</div>
          <div className="stat-value">{stats.successRate}<span style={{ fontSize: 18, color: 'var(--text-tertiary)', fontWeight: 600 }}>%</span></div>
          <div className="stat-meta"><span className="up"><Icons.ArrowUp size={11} /> 1.2%p</span> 지난주 대비</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(180deg, #FFFBEB 0%, #fff 60%)', borderColor: '#FDE68A' }}>
          <div className="stat-label" style={{ color: '#B45309' }}><Icons.Alert size={14} /> 처리 필요</div>
          <div className="stat-value">{stats.pendingErrors}<span style={{ fontSize: 18, color: 'var(--text-tertiary)', fontWeight: 600 }}>건</span></div>
          <div className="stat-meta">
            <a href="#" style={{ color: '#B45309', fontWeight: 600 }}>오류 확인 →</a>
          </div>
        </div>
      </div>

      {/* Chart + market breakdown */}
      <div className="col-2" style={{ marginBottom: 'var(--gap)' }}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">최근 7일 등록 현황</div>
              <div className="card-sub">일별 등록 상품 수</div>
            </div>
            <div className="row" style={{ gap: 14, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span className="row" style={{ gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--primary)' }}></span>
                성공
              </span>
              <span className="row" style={{ gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#FDE68A' }}></span>
                부분 성공
              </span>
            </div>
          </div>
          <div className="bars">
            {bars.map((b, i) => {
              const h = (b.n / maxN) * 100;
              const failPart = b.n > 25 ? 14 : 0;
              return (
                <div key={i} className="bar-col">
                  <div className="bar-stack">
                    {failPart > 0 && <div style={{ height: failPart + '%', background: '#FDE68A', borderRadius: '4px 4px 0 0', marginBottom: 2 }}></div>}
                    <div className="bar" style={{ height: (h - failPart) + '%', borderRadius: failPart > 0 ? 0 : '4px 4px 0 0' }}></div>
                  </div>
                  <div className="bar-label">{b.day}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">마켓별 분포</div>
              <div className="card-sub">전체 상품 기준</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {marketStats.map(s => {
              const m = markets.find(x => x.id === s.id);
              return (
                <div key={s.id}>
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <div className="row" style={{ gap: 8, minWidth: 0, flex: 1 }}>
                      <MarketIcon id={s.id} size="sm" />
                      <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                    </div>
                    <div className="row" style={{ gap: 8, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <span style={{ fontWeight: 600 }}>{s.count}</span>
                      <span className="muted">{s.share}%</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="fill" style={{ width: s.share + '%', background: m.color }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent registrations */}
      <div className="card table-card">
        <div className="table-toolbar">
          <div>
            <div className="card-title">최근 등록 내역</div>
            <div className="card-sub">최근 6건</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => goto('history')}>전체 이력 보기 <Icons.ArrowRight size={13} /></button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>상품명</th>
              <th>마켓</th>
              <th>상태</th>
              <th style={{ width: 100 }}>시간</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {recent.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{r.sku}</div>
                </td>
                <td><MarketStack ids={r.markets} /></td>
                <td>{statusBadge(r.status, r.count, r.fail)}</td>
                <td className="muted">{r.time}</td>
                <td><button className="icon-btn"><Icons.MoreH size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen });
