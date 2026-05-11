import { indexOf } from '../utils/universe';

export default function TradeCard({ stock, niftyBias }) {
  const isLong     = stock.direction === 'LONG';
  const dirColor   = isLong ? '#22c55e' : '#ef4444';
  const dirLabel   = isLong ? '▲ LONG' : '▼ SHORT';
  const idxLabel   = indexOf(stock.symbol);
  const risk       = stock.entry && stock.sl ? Math.abs(stock.entry - stock.sl) : 0;
  const qty10k     = risk > 0 ? Math.floor(10000 / risk) : '—';
  const qty25k     = risk > 0 ? Math.floor(25000 / risk) : '—';

  const niftyAgrees  = (isLong && niftyBias === 'LONG') || (!isLong && niftyBias === 'SHORT');
  const niftyNeutral = niftyBias === 'NEUTRAL';
  const niftyLine    = niftyAgrees
    ? <span style={{ color: '#22c55e' }}>✓ Nifty agrees</span>
    : niftyNeutral
    ? <span style={{ color: '#eab308' }}>~ Nifty neutral</span>
    : <span style={{ color: '#ef4444' }}>✗ Counter-trend vs Nifty — reduce size</span>;

  const htfColor = (isLong && stock.htf15m?.includes('Bull')) ||
                   (!isLong && stock.htf15m?.includes('Bear')) ? '#22c55e' : '#9ca3af';

  return (
    <div style={{
      background: '#0f172a',
      border: `2px solid ${dirColor}`,
      borderRadius: 12, padding: 14, marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 700, color: dirColor }}>{stock.symbol}</span>
          <span style={{ marginLeft: 8, color: dirColor, fontWeight: 600 }}>{dirLabel}</span>
          <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: 12, background: '#1f2937', borderRadius: 4, padding: '2px 6px' }}>{idxLabel}</span>
        </div>
        <span style={{ color: '#d1d5db', fontSize: 15, fontWeight: 600 }}>₹{stock.price}</span>
      </div>

      {/* Nifty context */}
      <div style={{ fontSize: 12, marginBottom: 8 }}>{niftyLine}</div>

      {/* Entry / SL / Targets */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <Level label="Entry" value={`₹${stock.entry}`} color={dirColor} />
        <Level label="SL"    value={`₹${stock.sl}`}    color="#ef4444" />
        <Level label="T1"    value={`₹${stock.t1}`}    color="#22c55e" />
        <Level label="T2"    value={`₹${stock.t2}`}    color="#22c55e" />
        <Level label="R:R"   value={stock.rr}           color="#a78bfa" />
      </div>

      {/* Risk sizing */}
      {risk > 0 && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
          Risk/unit ₹{risk.toFixed(1)} · Qty ₹10k={qty10k} · ₹25k={qty25k}
        </div>
      )}

      {/* HTF + indicators */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, marginBottom: 6 }}>
        <Tag label="15m" value={stock.htf15m} color={htfColor} />
        <Tag label="1h"  value={stock.htf1h}  color={htfColor} />
        <Tag label="RSI" value={stock.rsi} color={stock.rsi > 60 ? '#22c55e' : stock.rsi < 40 ? '#ef4444' : '#9ca3af'} />
        <Tag label="ATR%" value={stock.atrPct} color="#9ca3af" />
        <Tag label="VWAP Dist" value={`${stock.vwapDistPct}%`} color="#9ca3af" />
      </div>

      {/* BnR / OrderFlow */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, marginBottom: 6 }}>
        {stock.bnrLabel !== '—' && (
          <span style={{ background: '#422006', color: '#fbbf24', borderRadius: 6, padding: '2px 8px' }}>
            ★ {stock.bnrLabel} @ ₹{stock.bnrLevel}
          </span>
        )}
        <span style={{
          background: stock.orderFlow === 'BUY' ? '#14532d' : stock.orderFlow === 'SELL' ? '#450a0a' : '#1f2937',
          color: stock.orderFlow === 'BUY' ? '#86efac' : stock.orderFlow === 'SELL' ? '#fca5a5' : '#9ca3af',
          borderRadius: 6, padding: '2px 8px',
        }}>{stock.orderFlowLabel}</span>
      </div>

      {/* Key levels */}
      <div style={{ fontSize: 12, color: '#6b7280' }}>
        PDH {stock.pdh} · PDL {stock.pdl} · PDC {stock.pdc} · VWAP {stock.vwap}
        {stock.orh !== '—' && ` · ORH ${stock.orh} · ORL ${stock.orl}`}
      </div>

      {/* Daily trend */}
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
        Daily: {stock.dailyTrend} · {stock.abvE9 ? '↑ Above EMA9(5m)' : '↓ Below EMA9(5m)'}
      </div>

      {/* Action instruction */}
      <div style={{
        marginTop: 10, background: isLong ? '#14532d' : '#450a0a',
        border: `1px solid ${dirColor}`, borderRadius: 8, padding: '6px 10px',
        fontSize: 12, color: isLong ? '#86efac' : '#fca5a5',
      }}>
        {isLong
          ? `Wait for green 5-min candle to close above Entry ₹${stock.entry}. SL below ₹${stock.sl}.`
          : `Wait for red 5-min candle to close below Entry ₹${stock.entry}. SL above ₹${stock.sl}.`}
      </div>
    </div>
  );
}

function Level({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
      <span style={{ fontSize: 10, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function Tag({ label, value, color }) {
  return (
    <span style={{ color: '#6b7280' }}>
      {label}: <span style={{ color }}>{value}</span>
    </span>
  );
}
