export default function NiftyPulse({ pulse, niftySpot }) {
  if (!pulse) return null;
  const { pctAbove, bias, confidence, nAbove, nBelow } = pulse;
  const total  = nAbove + nBelow;
  const barPct = total > 0 ? (nAbove / total) * 100 : 50;

  const biasColor = bias === 'LONG' ? '#22c55e' : bias === 'SHORT' ? '#ef4444' : '#eab308';
  const biasText  = bias === 'LONG' ? 'LONG BIAS' : bias === 'SHORT' ? 'SHORT BIAS' : 'NEUTRAL';

  return (
    <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>NIFTY 50 PULSE</span>
        {niftySpot && (
          <span style={{ color: '#d1d5db', fontSize: 13 }}>
            ₹{niftySpot.price?.toFixed(1)}
            <span style={{ color: niftySpot.chgPct >= 0 ? '#22c55e' : '#ef4444', marginLeft: 6 }}>
              {niftySpot.chgPct >= 0 ? '+' : ''}{niftySpot.chgPct?.toFixed(2)}%
            </span>
          </span>
        )}
      </div>

      {/* Breadth bar */}
      <div style={{ background: '#1f2937', borderRadius: 4, height: 10, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${barPct}%`, background: '#22c55e', height: '100%', transition: 'width 0.5s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
        <span style={{ color: '#22c55e' }}>{nAbove} above VWAP</span>
        <span>{pctAbove}% bullish</span>
        <span style={{ color: '#ef4444' }}>{nBelow} below VWAP</span>
      </div>

      <div style={{
        background: bias === 'LONG' ? '#14532d' : bias === 'SHORT' ? '#450a0a' : '#422006',
        border: `1px solid ${biasColor}`,
        borderRadius: 8, padding: '6px 12px', textAlign: 'center',
      }}>
        <span style={{ color: biasColor, fontWeight: 700, fontSize: 15 }}>
          {bias === 'LONG' ? '▲' : bias === 'SHORT' ? '▼' : '~'} {biasText}
        </span>
        <span style={{ color: '#d1d5db', fontSize: 12, marginLeft: 8 }}>({confidence})</span>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
        {bias === 'LONG'    && 'Market bullish — focus on BnR longs and VWAP-respect longs'}
        {bias === 'SHORT'   && 'Market bearish — focus on BnR shorts and VWAP-respect shorts'}
        {bias === 'NEUTRAL' && 'Mixed market — trade only highest-quality setups'}
      </div>
    </div>
  );
}
