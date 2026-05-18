// Templates / Markets / History screens
const { useState: useState_S } = React;

// ============================ Templates ============================
function TemplatesScreen({ goto }) {
  const templates = window.AppData.templates;
  const [modalOpen, setModalOpen] = useState_S(false);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">템플릿 관리</h1>
          <p className="page-subtitle">반복되는 등록 작업을 템플릿으로 저장해 시간을 절약하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn primary" onClick={() => setModalOpen(true)}>
            <Icons.Plus size={15} /> 새 템플릿
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 20 }}>
        <div className="search-input" style={{ width: 280 }}>
          <Icons.Search size={14} />
          <input placeholder="템플릿 검색" />
        </div>
        <button className="btn"><Icons.Filter size={14} /> 카테고리</button>
        <div className="grow" />
        <div className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{templates.length}개의 템플릿</div>
      </div>

      <div className="tmpl-grid">
        <div className="tmpl-card new" onClick={() => setModalOpen(true)}>
          <div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-muted)', display: 'grid', placeItems: 'center', margin: '0 auto 10px', color: 'var(--text-tertiary)' }}>
              <Icons.Plus size={20} />
            </div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>새 템플릿 만들기</div>
            <div className="muted" style={{ fontSize: 12 }}>자주 쓰는 설정을 저장하세요</div>
          </div>
        </div>

        {templates.map(t => (
          <div key={t.id} className="tmpl-card">
            <div className={'tmpl-thumb ' + t.thumb}>
              <div>{t.cat}</div>
            </div>
            <div className="tmpl-body">
              <div className="row between" style={{ marginBottom: 4 }}>
                <div className="tmpl-name">{t.name}</div>
                <button className="icon-btn" style={{ width: 28, height: 28 }}><Icons.MoreH size={15} /></button>
              </div>
              <div className="tmpl-meta">
                <span>{t.items}개 항목</span>
                <span>·</span>
                <span>{t.updated}</span>
              </div>
              <div className="tmpl-markets">
                {t.markets.map(id => <MarketIcon key={id} id={id} size="sm" />)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="새 템플릿 만들기"
        footer={
          <>
            <button className="btn" onClick={() => setModalOpen(false)}>취소</button>
            <button className="btn primary" onClick={() => setModalOpen(false)}>다음으로</button>
          </>
        }
      >
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="label">템플릿 이름</label>
          <input className="input" placeholder="예) 의류 - 봄/여름 기본형" />
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="label">카테고리</label>
          <select className="select">
            <option>의류</option>
            <option>주방용품</option>
            <option>디지털 가전</option>
            <option>뷰티</option>
            <option>식품</option>
            <option>기타</option>
          </select>
        </div>
        <div className="field">
          <label className="label">기본 등록 마켓</label>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {window.AppData.markets.map(m => (
              <button key={m.id} className="btn sm" style={{ height: 32 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: m.color, color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 9 }}>{m.short}</span>
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================ Markets ============================
function MarketsScreen({ goto }) {
  const markets = window.AppData.markets;
  const [connecting, setConnecting] = useState_S(null);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">마켓 계정 관리</h1>
          <p className="page-subtitle">연결된 마켓 계정과 인증 상태를 한곳에서 관리하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn"><Icons.Refresh size={14} /> 연결 상태 확인</button>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label"><Icons.Link size={14} /> 연결된 계정</div>
          <div className="stat-value">5<span style={{ fontSize: 18, color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 4 }}>/ 7</span></div>
          <div className="stat-meta">5개 마켓 중 3개 활성</div>
        </div>
        <div className="stat-card">
          <div className="stat-label" style={{ color: '#B45309' }}><Icons.Alert size={14} /> 만료된 인증</div>
          <div className="stat-value">1<span style={{ fontSize: 18, color: 'var(--text-tertiary)', fontWeight: 600 }}>건</span></div>
          <div className="stat-meta"><a href="#" style={{ color: '#B45309', fontWeight: 600 }}>재인증 필요</a></div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Icons.Refresh size={14} /> 마지막 동기화</div>
          <div className="stat-value" style={{ fontSize: 22 }}>2분 전</div>
          <div className="stat-meta">자동 동기화: 매 시간</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--gap)' }}>
        <div className="card-head">
          <div>
            <div className="card-title">마켓 연결</div>
            <div className="card-sub">지원되는 마켓에 셀러 계정을 연결하세요</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {markets.map(m => {
            const isConnected = m.status === 'connected';
            const isExpired = m.status === 'expired';
            return (
              <div key={m.id} style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}>
                  <div className="row between">
                    <div className="row" style={{ gap: 12, minWidth: 0, flex: 1 }}>
                      <MarketIcon id={m.id} size="lg" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2, whiteSpace: 'nowrap' }}>
                          {isConnected && `${m.accounts}개 계정 연결`}
                          {isExpired && '인증 만료됨'}
                          {!isConnected && !isExpired && '연결되지 않음'}
                        </div>
                      </div>
                    </div>
                  {isConnected && <Badge kind="success" dot>연결됨</Badge>}
                  {isExpired && <Badge kind="warning" dot>만료</Badge>}
                  {!isConnected && !isExpired && <Badge dot>미연결</Badge>}
                </div>

                {isConnected && (
                  <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 'var(--r)', fontSize: 12 }}>
                    <div className="row between" style={{ whiteSpace: 'nowrap' }}>
                      <span className="muted">셀러 ID</span>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>konai_seller_01</span>
                    </div>
                    <div className="row between" style={{ marginTop: 4, whiteSpace: 'nowrap' }}>
                      <span className="muted">마지막 사용</span>
                      <span>방금 전</span>
                    </div>
                  </div>
                )}

                <div className="row" style={{ gap: 6 }}>
                  {isConnected && (
                    <>
                      <button className="btn sm grow">계정 관리</button>
                      <button className="btn sm" title="연결 해제"><Icons.Unlink size={14} /></button>
                    </>
                  )}
                  {isExpired && (
                    <button className="btn primary sm grow" onClick={() => setConnecting(m)}>
                      <Icons.Refresh size={14} /> 재인증
                    </button>
                  )}
                  {!isConnected && !isExpired && (
                    <button className="btn primary sm grow" onClick={() => setConnecting(m)}>
                      <Icons.Link size={14} /> 계정 연결
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!connecting}
        onClose={() => setConnecting(null)}
        title={connecting ? `${connecting.name} 계정 연결` : ''}
        footer={
          <>
            <button className="btn" onClick={() => setConnecting(null)}>취소</button>
            <button className="btn primary" onClick={() => setConnecting(null)}>
              <Icons.Link size={14} /> OAuth로 인증
            </button>
          </>
        }
      >
        {connecting && (
          <>
            <div className="row" style={{ gap: 12, marginBottom: 16 }}>
              <MarketIcon id={connecting.id} size="lg" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{connecting.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>셀러센터 OAuth 2.0 인증</div>
              </div>
            </div>
            <div className="notice">
              <div className="ico"><Icons.Info size={16} /></div>
              <div>다음 단계에서 {connecting.name} 셀러센터로 이동합니다. 로그인 후 권한을 승인하면 자동으로 연결됩니다.</div>
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label className="label">계정 별칭 (선택)</label>
              <input className="input" placeholder="예) 메인 계정, 서브 계정" />
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>여러 계정을 운영할 때 구분하기 좋습니다</div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ============================ History ============================
function HistoryScreen({ goto }) {
  const history = window.AppData.history;
  const [period, setPeriod] = useState_S('7d');
  const [marketFilter, setMarketFilter] = useState_S('all');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">등록 이력</h1>
          <p className="page-subtitle">언제, 어떤 상품을, 어떤 결과로 등록했는지 모두 추적하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn"><Icons.Download size={14} /> CSV 내보내기</button>
        </div>
      </div>

      {/* Period filter */}
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <div className="row" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 3 }}>
          {[
            { id: 'today', label: '오늘' },
            { id: '7d', label: '7일' },
            { id: '30d', label: '30일' },
            { id: '90d', label: '90일' },
            { id: 'custom', label: '기간 지정' },
          ].map(p => (
            <button key={p.id}
              onClick={() => setPeriod(p.id)}
              className="btn sm ghost"
              style={{ background: period === p.id ? 'var(--primary-soft)' : 'transparent',
                       color: period === p.id ? 'var(--primary)' : 'var(--text-secondary)' }}>
              {p.label}
            </button>
          ))}
        </div>
        <select className="select" style={{ width: 'auto' }} value={marketFilter} onChange={e => setMarketFilter(e.target.value)}>
          <option value="all">전체 마켓</option>
          {window.AppData.markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="search-input" style={{ width: 240 }}>
          <Icons.Search size={14} />
          <input placeholder="상품명 검색" />
        </div>
        <div className="grow" />
        <div className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>총 {history.length}건</div>
      </div>

      {/* Mini summary */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 'var(--gap)' }}>
        <MiniStat label="총 시도" value={history.length} note="등록 시도 건수" />
        <MiniStat label="성공" value={history.filter(h => h.fail === 0).length} note="모든 마켓 성공" tone="success" />
        <MiniStat label="부분 성공" value={history.filter(h => h.fail > 0 && h.success > 0).length} note="일부 마켓 실패" tone="warning" />
        <MiniStat label="실패" value={history.filter(h => h.success === 0 && h.fail > 0).length} note="모든 마켓 실패" tone="danger" />
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 32 }}><Checkbox checked={false} onChange={() => {}} /></th>
              <th>등록일시</th>
              <th>상품명</th>
              <th>등록자</th>
              <th>마켓 수</th>
              <th>결과</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => {
              const isFail = h.fail > 0 && h.success === 0;
              const isPartial = h.fail > 0 && h.success > 0;
              const isPending = h.fail === 0 && h.success === 0;
              return (
                <tr key={h.id}>
                  <td><Checkbox checked={false} onChange={() => {}} /></td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{h.date}</td>
                  <td><div style={{ fontWeight: 500 }}>{h.name}</div></td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="user-avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{h.by[0]}</div>
                      <span style={{ fontSize: 13 }}>{h.by}</span>
                    </div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <Icons.Store size={14} className="muted" />
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{h.markets}</span>
                    </div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 100, height: 6, background: 'var(--bg-muted)', borderRadius: 'var(--r-full)', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: (h.success / h.markets * 100) + '%', background: 'var(--success)' }}></div>
                        <div style={{ width: (h.fail / h.markets * 100) + '%', background: 'var(--danger)' }}></div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {h.success}/{h.markets}
                      </span>
                      {isFail && <Badge kind="danger">실패</Badge>}
                      {isPartial && <Badge kind="warning">부분</Badge>}
                      {!isFail && !isPartial && !isPending && <Badge kind="success">성공</Badge>}
                      {isPending && <Badge kind="info">대기</Badge>}
                    </div>
                  </td>
                  <td className="right">
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <button className="icon-btn" title="상세보기"><Icons.Eye size={15} /></button>
                      {(isFail || isPartial) && (
                        <button className="icon-btn" title="재시도"><Icons.Refresh size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStat({ label, value, note, tone }) {
  const colors = {
    success: { v: '#047857', bg: '#ECFDF5' },
    warning: { v: '#B45309', bg: '#FFFBEB' },
    danger:  { v: '#B91C1C', bg: '#FEF2F2' },
  };
  const c = colors[tone];
  return (
    <div className="stat-card" style={{ background: c?.bg || 'var(--bg)', borderColor: c?.bg ? 'transparent' : 'var(--border)' }}>
      <div className="stat-label" style={{ color: c?.v }}>{label}</div>
      <div className="stat-value" style={{ color: c?.v, fontSize: 24 }}>{value}<span style={{ fontSize: 14, fontWeight: 600, marginLeft: 3, opacity: 0.6 }}>건</span></div>
      <div className="stat-meta" style={{ color: c?.v, opacity: 0.7 }}>{note}</div>
    </div>
  );
}

Object.assign(window, { TemplatesScreen, MarketsScreen, HistoryScreen });
