export default function BnRTable({ setups }) {
  if (!setups || setups.length === 0) {
    return (
      <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <Header />
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>No confirmed BnR setups this cycle.</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <Header />
      {setups.map(s => (
        <BnRRow key={s.symbol} s={s} />
      ))}
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ color: '#fbbf24', fontSize: 14, fontWeight: 700 }}>★ BREAK-AND-RETEST SETUPS</span>
      <span style={{ color: '#6b7280', fontSize: 12 }}>highest priority — confirmed level + order flow</span>
    </div>
  );
}

function BnRRow({ s }) {
  const isLong = s.direction === 'LONG';
  const dirCol = isLong ? '#22c55e' : '#ef4444';
  return (
    <div style={{
      background: '#1f2937', borderRadius: 8, padding: '10px 12px', marginBottom: 8,
      border: `1px solid ${dirCol}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: dirCol, fontWeight: 700, fontSize: 15 }}>
          {s.symbol} {isLong ? '▲' : '▼'}
        </span>
        <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>{s.bnrLabel}</span>
        <span style={{ color: '#d1d5db', fontSize: 13 }}>₹{s.price}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ color: '#9ca3af' }}>Level <span style={{ color: '#fbbf24' }}>₹{s.bnrLevel}</span></span>
        <span style={{ color: '#9ca3af' }}>Entry <span style={{ color: dirCol }}>₹{s.entry}</span></span>
        <span style={{ color: '#9ca3af' }}>SL <span style={{ color: '#ef4444' }}>₹{s.sl}</span></span>
        <span style={{ color: '#9ca3af' }}>T1 <span style={{ color: '#22c55e' }}>₹{s.t1}</span></span>
        <span style={{ color: '#9ca3af' }}>R:R <span style={{ color: '#a78bfa' }}>{s.rr}</span></span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#9ca3af' }}>Flow: <span style={{ color: s.orderFlow === 'BUY' ? '#22c55e' : '#ef4444' }}>{s.orderFlowLabel}</span></span>
        <span style={{ color: '#9ca3af' }}>15m: <span style={{ color: '#a78bfa' }}>{s.htf15m}</span></span>
        <span style={{ color: '#9ca3af' }}>1h: <span style={{ color: '#a78bfa' }}>{s.htf1h}</span></span>
        <span style={{ color: '#9ca3af' }}>RSI: <span style={{ color: '#d1d5db' }}>{s.rsi}</span></span>
        <span style={{ color: '#9ca3af' }}>Score: <span style={{ color: '#fbbf24' }}>{s.bnrScore}</span></span>
      </div>
    </div>
  );
}
