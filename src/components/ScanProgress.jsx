export default function ScanProgress({ current, total, symbol, stage }) {
  const pct = total > 0 ? Math.round(current / total * 100) : 0;
  return (
    <div style={{ padding: '20px 16px', textAlign: 'center' }}>
      <div style={{ color: '#22c55e', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        {stage === 'daily' ? '📊 Loading daily data...' : '🔍 Scanning stocks...'}
      </div>
      <div style={{ background: '#1f2937', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, background: '#22c55e', height: '100%', transition: 'width 0.3s' }} />
      </div>
      <div style={{ color: '#9ca3af', fontSize: 13 }}>
        {current}/{total} — {symbol}
      </div>
    </div>
  );
}
