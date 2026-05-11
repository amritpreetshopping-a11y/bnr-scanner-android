import { useState, useEffect, useCallback, useRef } from 'react';
import NiftyPulse    from './components/NiftyPulse';
import BnRTable      from './components/BnRTable';
import TopTable      from './components/TopTable';
import TradeCard     from './components/TradeCard';
import ScanProgress  from './components/ScanProgress';
import { analyseStock, computeNiftyPulse } from './utils/analysis';
import { batchFetchStocks, fetchNiftySpot } from './utils/fetcher';
import { UNIVERSE, NIFTY50 } from './utils/universe';
import { computeVWAPSeries } from './utils/indicators';

const SCAN_INTERVAL_MS = 5 * 60 * 1000;
const TABS = ['BnR Setups', 'Longs', 'Shorts', 'Trade Cards'];

function isMarketOpen() {
  const now  = new Date();
  const day  = now.getDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 15;
}

function useSettings() {
  const [stockCount, setStockCount] = useState(() => parseInt(localStorage.getItem('stockCount') || '50', 10));
  const save = (v) => { setStockCount(v); localStorage.setItem('stockCount', v); };
  return [stockCount, save];
}

export default function App() {
  const [activeTab, setActiveTab]   = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [stockCount, setStockCount] = useSettings();

  const [scanning, setScanning]     = useState(false);
  const [progress, setProgress]     = useState({ current: 0, total: 0, symbol: '', stage: 'intra' });
  const [scanNum,  setScanNum]      = useState(0);
  const [nextScanIn, setNextScanIn] = useState(0);

  const [niftySpot,  setNiftySpot]  = useState(null);
  const [pulse,      setPulse]      = useState(null);
  const [longs,      setLongs]      = useState([]);
  const [shorts,     setShorts]     = useState([]);
  const [bnrSetups,  setBnrSetups]  = useState([]);
  const [allStocks,  setAllStocks]  = useState([]);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [error,      setError]      = useState(null);

  const timerRef    = useRef(null);
  const countdownRef = useRef(null);

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    const symbols = UNIVERSE.slice(0, stockCount);

    try {
      const spot = await fetchNiftySpot();
      if (spot) setNiftySpot(spot);

      const rawResults = await batchFetchStocks(symbols, (cur, tot, sym) => {
        setProgress({ current: cur, total: tot, symbol: sym, stage: 'intra' });
      });

      // Pulse: computed from ALL fetched stocks regardless of whether analyseStock passes
      // This matches Python bot which scans the full universe for above/below VWAP counts
      const pulseInputs = [];
      const analysed = [];
      const todayStr = new Date().toDateString();

      for (const { symbol, intra5m, daily, prevLevels } of rawResults) {
        if (!intra5m?.length) continue;

        // Always compute VWAP position for pulse (even if no tradeable setup)
        const todayC = intra5m.filter(c => new Date(c.time).toDateString() === todayStr);
        if (todayC.length >= 2) {
          const vwapArr   = computeVWAPSeries(todayC);
          const lastPrice = todayC[todayC.length - 1].close;
          const lastVwap  = vwapArr[vwapArr.length - 1];
          const isN50 = NIFTY50.includes(symbol);
          pulseInputs.push({ symbol, _aboveVwap: lastPrice >= lastVwap, isN50 });
        }

        const row = analyseStock(symbol, intra5m, daily, prevLevels.pdh, prevLevels.pdl, prevLevels.pdc);
        if (row) {
          const lastVwap = pulseInputs.find(p => p.symbol === symbol)?._aboveVwap;
          analysed.push({ ...row, _aboveVwap: lastVwap ?? (row.price >= row.vwap) });
        }
      }

      // Prefer Nifty50 subset for pulse; fall back to full scan set
      const n50inputs = pulseInputs.filter(p => p.isN50);
      const pulseData = computeNiftyPulse(n50inputs.length >= 5 ? n50inputs : pulseInputs);
      setPulse(pulseData);

      const sorted    = [...analysed].sort((a, b) => b.rankScore - a.rankScore);
      const longList  = sorted.filter(r => r.direction === 'LONG').slice(0, 5);
      const shortList = sorted.filter(r => r.direction === 'SHORT').slice(0, 5);
      const bnrList   = sorted
        .filter(r => r.bnrLabel !== '—' && r.bnrScore >= 70 &&
          ((r.direction === 'LONG' && r.orderFlow === 'BUY') ||
           (r.direction === 'SHORT' && r.orderFlow === 'SELL') ||
           r.bnrScore >= 85))
        .slice(0, 6);

      setLongs(longList);
      setShorts(shortList);
      setBnrSetups(bnrList);
      setAllStocks(sorted.slice(0, 8));
      setScanNum(n => n + 1);
      setLastScanTime(new Date());
    } catch (e) {
      setError(`Scan failed: ${e.message}`);
    } finally {
      setScanning(false);
    }
  }, [stockCount]);

  // Auto-scan scheduler
  useEffect(() => {
    runScan();
    timerRef.current = setInterval(runScan, SCAN_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [runScan]);

  // Countdown ticker
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      if (lastScanTime) {
        const elapsed = Date.now() - lastScanTime.getTime();
        const rem = Math.max(0, Math.ceil((SCAN_INTERVAL_MS - elapsed) / 1000));
        setNextScanIn(rem);
      }
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [lastScanTime]);

  const fmtCountdown = (s) => `${Math.floor(s/60)}m ${s%60}s`;

  return (
    <div style={{ background: '#0a0f1a', minHeight: '100vh', color: '#d1d5db', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
      {/* Header */}
      <div style={{ background: '#111827', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px #0006' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#22c55e' }}>BnR Scanner</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {isMarketOpen() ? '● Market Open' : '○ Market Closed'}
            {lastScanTime && <span style={{ marginLeft: 8 }}>· Scan #{scanNum} · Next {fmtCountdown(nextScanIn)}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {scanning && <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s infinite' }} />}
          <button onClick={() => setShowSettings(s => !s)} style={{ background: '#1f2937', border: 'none', color: '#9ca3af', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 18 }}>⚙</button>
          <button onClick={runScan} disabled={scanning} style={{ background: '#166534', border: 'none', color: '#22c55e', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', opacity: scanning ? 0.5 : 1 }}>↻ Scan</button>
        </div>
      </div>

      <div style={{ padding: '12px 14px', maxWidth: 680, margin: '0 auto' }}>
        {/* Settings panel */}
        {showSettings && (
          <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10, color: '#d1d5db' }}>Settings</div>
            <label style={{ color: '#9ca3af', fontSize: 13 }}>
              Stocks to scan: {stockCount}
              <input type="range" min={20} max={160} step={10} value={stockCount}
                onChange={e => setStockCount(parseInt(e.target.value, 10))}
                style={{ width: '100%', marginTop: 6 }} />
              <span style={{ color: '#6b7280', fontSize: 11 }}>20 = fast scan (~1 min) · 160 = full universe (~8 min)</span>
            </label>
            <div style={{ marginTop: 10, color: '#6b7280', fontSize: 12 }}>
              Data: NSE public API (real-time when market is open, last session when closed)<br/>
              Auto-refresh every 5 minutes during market hours
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: 12, marginBottom: 12, color: '#fca5a5', fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* Scan progress */}
        {scanning && <ScanProgress {...progress} />}

        {/* Nifty Pulse */}
        {!scanning && <NiftyPulse pulse={pulse} niftySpot={niftySpot} />}

        {/* Tab bar */}
        {!scanning && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {TABS.map((t, i) => (
                <button key={t} onClick={() => setActiveTab(i)} style={{
                  background: activeTab === i ? '#1e40af' : '#1f2937',
                  border: 'none', color: activeTab === i ? '#93c5fd' : '#9ca3af',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  fontWeight: activeTab === i ? 700 : 400, fontSize: 13,
                }}>
                  {t}
                  {t === 'BnR Setups' && bnrSetups.length > 0 && (
                    <span style={{ marginLeft: 4, background: '#fbbf24', color: '#000', borderRadius: 4, padding: '0 5px', fontSize: 11 }}>{bnrSetups.length}</span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 0 && <BnRTable setups={bnrSetups} />}
            {activeTab === 1 && <TopTable stocks={longs}  direction="LONG"  />}
            {activeTab === 2 && <TopTable stocks={shorts} direction="SHORT" />}
            {activeTab === 3 && (
              <div>
                {allStocks.length === 0
                  ? <div style={{ color: '#6b7280' }}>No setups found. Run a scan first.</div>
                  : allStocks.map(s => <TradeCard key={s.symbol} stock={s} niftyBias={pulse?.bias ?? 'NEUTRAL'} />)
                }
              </div>
            )}
          </>
        )}

        {/* How to trade footer */}
        {!scanning && (
          <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 10, padding: 14, marginTop: 12 }}>
            <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>How to trade these setups</div>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.7 }}>
              <div style={{ color: '#fbbf24', marginBottom: 4 }}>★ BnR SETUP (best quality)</div>
              Price broke PDH/PDL/ORH/ORL and is now retesting. Wait for 1 confirming 5-min candle at the retest zone.
              Bull BnR → green candle closing above BnRLevel → Long. Bear BnR → red candle below → Short.
              <div style={{ marginTop: 6, color: '#22c55e' }}>▲ BULLISH VWAP (VWAPDist 0 to +1%)</div>
              Price respected VWAP from above all session. HTF_15m/1h must show ↑. Entry: green 5-min candle above VWAP + EMA9.
              <div style={{ marginTop: 6, color: '#ef4444' }}>▼ BEARISH VWAP (VWAPDist -1% to 0)</div>
              Price respected VWAP from below all session. HTF_15m/1h must show ↓. Entry: red 5-min candle below VWAP + EMA9.
              <div style={{ marginTop: 8, color: '#ef4444', fontWeight: 600 }}>Square off ALL positions before 3:15 PM.</div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
      `}</style>
    </div>
  );
}
