export default function TopTable({ stocks, direction }) {
  const isLong = direction === 'LONG';
  const color  = isLong ? '#22c55e' : '#ef4444';
  const label  = isLong ? '▲ TOP 5 BULLISH — VWAP Respect + HTF Aligned'
                        : '▼ TOP 5 BEARISH — VWAP Respect + HTF Aligned';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color, fontWeight: 700, fontSize: 13, marginBottom: 8, padding: '4px 0' }}>{label}</div>
      {!stocks || stocks.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>No setups found this cycle.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#9ca3af', borderBottom: '1px solid #374151' }}>
                {['Symbol','Price','Entry','SL','T1','R:R','VWAP%','HTF 15m','HTF 1h','BnR','Flow','RSI','Daily'].map(h => (
                  <th key={h} style={{ padding: '4px 6px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stocks.map(s => (
                <tr key={s.symbol} style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '5px 6px', color, fontWeight: 700 }}>{s.symbol}</td>
                  <td style={{ padding: '5px 6px', color: '#d1d5db' }}>{s.price}</td>
                  <td style={{ padding: '5px 6px', color }}>{s.entry}</td>
                  <td style={{ padding: '5px 6px', color: '#ef4444' }}>{s.sl}</td>
                  <td style={{ padding: '5px 6px', color: '#22c55e' }}>{s.t1}</td>
                  <td style={{ padding: '5px 6px', color: '#a78bfa' }}>{s.rr}</td>
                  <td style={{ padding: '5px 6px', color: Math.abs(s.vwapDistPct) < 0.5 ? '#22c55e' : '#9ca3af' }}>{s.vwapDistPct}%</td>
                  <td style={{ padding: '5px 6px', color: '#a78bfa' }}>{s.htf15m}</td>
                  <td style={{ padding: '5px 6px', color: '#a78bfa' }}>{s.htf1h}</td>
                  <td style={{ padding: '5px 6px', color: s.bnrLabel !== '—' ? '#fbbf24' : '#6b7280' }}>{s.bnrLabel}</td>
                  <td style={{ padding: '5px 6px', color: s.orderFlow === 'BUY' ? '#22c55e' : s.orderFlow === 'SELL' ? '#ef4444' : '#6b7280' }}>{s.orderFlowLabel}</td>
                  <td style={{ padding: '5px 6px', color: s.rsi > 60 ? '#22c55e' : s.rsi < 40 ? '#ef4444' : '#9ca3af' }}>{s.rsi}</td>
                  <td style={{ padding: '5px 6px', color: '#9ca3af' }}>{s.dailyTrend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
