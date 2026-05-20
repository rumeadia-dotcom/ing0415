// Shared UI components and icons for the prototype
const { useState, useEffect, useRef, useMemo } = React;

// ============================ Icons (24px Lucide-style) ============================
const I = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const Icons = {
  Dashboard: (p) => <I {...p}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></I>,
  Plus: (p) => <I {...p}><path d="M12 5v14M5 12h14"/></I>,
  PlusBox: (p) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></I>,
  Template: (p) => <I {...p}><rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="15" y="13" width="6" height="8" rx="1"/></I>,
  Store: (p) => <I {...p}><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></I>,
  History: (p) => <I {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></I>,
  Search: (p) => <I {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></I>,
  Bell: (p) => <I {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></I>,
  Settings: (p) => <I {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.66.43.86.78"/></I>,
  Help: (p) => <I {...p}><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></I>,
  Menu: (p) => <I {...p}><path d="M3 6h18M3 12h18M3 18h18"/></I>,
  ChevronLeft: (p) => <I {...p}><path d="m15 18-6-6 6-6"/></I>,
  ChevronRight: (p) => <I {...p}><path d="m9 18 6-6-6-6"/></I>,
  ChevronDown: (p) => <I {...p}><path d="m6 9 6 6 6-6"/></I>,
  ArrowRight: (p) => <I {...p}><path d="M5 12h14M13 5l7 7-7 7"/></I>,
  ArrowUp: (p) => <I {...p}><path d="M12 19V5M5 12l7-7 7 7"/></I>,
  ArrowDown: (p) => <I {...p}><path d="M12 5v14M19 12l-7 7-7-7"/></I>,
  Check: (p) => <I {...p}><path d="M20 6 9 17l-5-5"/></I>,
  CheckCircle: (p) => <I {...p}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></I>,
  X: (p) => <I {...p}><path d="M18 6 6 18M6 6l12 12"/></I>,
  XCircle: (p) => <I {...p}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></I>,
  Alert: (p) => <I {...p}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></I>,
  Info: (p) => <I {...p}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></I>,
  Image: (p) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></I>,
  Upload: (p) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></I>,
  Download: (p) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></I>,
  Filter: (p) => <I {...p}><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/></I>,
  Refresh: (p) => <I {...p}><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.4-2.6L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.4 2.6L21 8"/><path d="M21 3v5h-5"/></I>,
  Tag: (p) => <I {...p}><path d="M20 12 13 19a2 2 0 0 1-3 0l-7-7V5a2 2 0 0 1 2-2h7l7 7a2 2 0 0 1 0 3z"/><path d="M7 7h.01"/></I>,
  Copy: (p) => <I {...p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></I>,
  Trash: (p) => <I {...p}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></I>,
  Edit: (p) => <I {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></I>,
  Eye: (p) => <I {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></I>,
  MoreH: (p) => <I {...p}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></I>,
  Link: (p) => <I {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></I>,
  Unlink: (p) => <I {...p}><path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><path d="m2 2 20 20"/></I>,
  Box: (p) => <I {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22.08V12"/></I>,
  Sparkles: (p) => <I {...p}><path d="M12 3v3M5.6 5.6l2 2M3 12h3M5.6 18.4l2-2M12 18v3M16.4 16.4l2 2M21 12h-3M16.4 7.6l2-2"/><path d="M12 8v8M8 12h8"/></I>,
  Logo: (p) => <I {...p}><path d="M3 9l9-6 9 6v12H3z"/><path d="M9 21v-7h6v7"/></I>,
  Mail: (p) => <I {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/></I>,
  Lock: (p) => <I {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></I>,
  User: (p) => <I {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></I>,
  Spinner: (p) => <I {...p}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></I>,
};

// ============================ Market Badge ============================
function MarketIcon({ id, size = 'md' }) {
  const m = window.AppData.markets.find(x => x.id === id);
  if (!m) return null;
  const cls = size === 'sm' ? 'market-icon sm' : size === 'lg' ? 'market-icon lg' : 'market-icon';
  return <div className={cls} style={{ background: m.color }}>{m.short}</div>;
}

function MarketStack({ ids, size = 'sm' }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {ids.map(id => <MarketIcon key={id} id={id} size={size} />)}
    </div>
  );
}

// ============================ Checkbox ============================
function Checkbox({ checked, onChange }) {
  return (
    <button
      type="button"
      className={'checkbox' + (checked ? ' checked' : '')}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    />
  );
}

function Toggle({ on, onChange }) {
  return <div className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)} />;
}

// ============================ Badge ============================
function Badge({ kind = 'default', children, dot }) {
  const k = kind === 'default' ? '' : ' ' + kind;
  return (
    <span className={'badge' + k}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

// ============================ Modal ============================
function Modal({ open, onClose, title, children, footer, width }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: width || 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ============================ Toast ============================
const ToastCtx = React.createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (msg, kind = 'default') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-region">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            {t.kind === 'success' && <span style={{ color: '#34D399' }}><Icons.CheckCircle size={16} /></span>}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ============================ Empty ============================
function EmptyState({ icon, title, sub, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon || <Icons.Box size={22} />}</div>
      <div className="empty-title">{title}</div>
      {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

Object.assign(window, {
  Icons, MarketIcon, MarketStack, Checkbox, Toggle, Badge, Modal,
  ToastProvider, ToastCtx, EmptyState,
});
