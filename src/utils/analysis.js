import { ema, computeRSI, computeATR, computeVWAP, computeVWAPSeries } from './indicators';

const BNR_RETEST_BAND       = 0.004;
const BNR_BREAK_MIN         = 0.002;
const VWAP_ENTRY_BAND       = 1.0;
const VWAP_ENTRY_BAND_EARLY = 2.0;   // first hour — widen to match Python bot
const VWAP_RESPECT_MIN      = 0.70;
const VWAP_RESPECT_MIN_EARLY = 0.60; // first hour

export function detectBnR(candles, pdh, pdl, pdc) {
  if (candles.length < 6) return null;
  const closes  = candles.map(c => c.close);
  const current = closes[closes.length - 1];
  const orh = Math.max(...candles.slice(0, 3).map(c => c.high));
  const orl = Math.min(...candles.slice(0, 3).map(c => c.low));

  const levels = [
    { name: 'PDH', lvl: pdh,  preferDir: 'BULL', bonus: 15 },
    { name: 'PDL', lvl: pdl,  preferDir: 'BEAR', bonus: 15 },
    { name: 'PDC', lvl: pdc,  preferDir: null,   bonus: 10 },
    { name: 'ORH', lvl: orh,  preferDir: 'BULL', bonus: 0  },
    { name: 'ORL', lvl: orl,  preferDir: 'BEAR', bonus: 0  },
  ];

  let best = null, bestScore = 0;
  const prev = closes.slice(0, -2);

  for (const { name, lvl, preferDir, bonus } of levels) {
    if (!lvl || lvl <= 0) continue;

    const brokeAbove = prev.some(c => c > lvl * (1 + BNR_BREAK_MIN));
    const retestingFromAbove = current >= lvl * (1 - BNR_RETEST_BAND) &&
                               current <= lvl * (1 + BNR_RETEST_BAND * 0.5);

    const brokeBelow = prev.some(c => c < lvl * (1 - BNR_BREAK_MIN));
    const retestingFromBelow = current >= lvl * (1 - BNR_RETEST_BAND * 0.5) &&
                               current <= lvl * (1 + BNR_RETEST_BAND);

    for (const [dir, broke, retesting] of [
      ['BULL', brokeAbove, retestingFromAbove],
      ['BEAR', brokeBelow, retestingFromBelow],
    ]) {
      if (!broke || !retesting) continue;
      if (preferDir && preferDir !== dir) continue;

      let score = 60 + bonus;
      if (dir === 'BULL') {
        const maxClose = Math.max(...prev.filter(c => c > lvl));
        const depth = (maxClose - lvl) / lvl;
        score += Math.min(Math.floor(depth * 2000), 20);
      } else {
        const minClose = Math.min(...prev.filter(c => c < lvl));
        const depth = (lvl - minClose) / lvl;
        score += Math.min(Math.floor(depth * 2000), 20);
      }

      if (score > bestScore) {
        bestScore = score;
        best = {
          bnrLevel: name,
          bnrPrice: Math.round(lvl * 10) / 10,
          bnrDir:   dir,
          bnrScore: score,
          bnrLabel: `BnR ${name}${dir === 'BULL' ? '↑' : '↓'}`,
          orh: Math.round(orh * 10) / 10,
          orl: Math.round(orl * 10) / 10,
        };
      }
    }
  }
  return best;
}

export function detectOrderFlow(candles) {
  if (candles.length < 5) return { signal: 'NEUTRAL', strength: 0, label: '—' };
  const last      = candles[candles.length - 1];
  const avgVol    = candles.slice(0, -1).reduce((s, c) => s + c.volume, 0) / (candles.length - 1);
  const volRatio  = avgVol > 0 ? last.volume / avgVol : 1;
  const { open: o, close: c, high: h, low: l } = last;
  const rng       = h - l || 0.0001;
  const body      = Math.abs(c - o);
  const bodyR     = body / rng;
  const upperWick = h - Math.max(o, c);
  const lowerWick = Math.min(o, c) - l;
  const upperWickR = upperWick / rng;
  const lowerWickR = lowerWick / rng;
  const last3 = candles.slice(-3);
  const greenN = last3.filter(x => x.close > x.open).length;
  const redN   = 3 - greenN;

  let buyScore = 0, sellScore = 0;
  if (c > o) {
    buyScore  += 25 + Math.min(Math.floor(volRatio * 15), 35) + Math.floor(bodyR * 20) + greenN * 5 + Math.floor(lowerWickR * 10);
    sellScore += Math.floor(upperWickR * 15);
  } else {
    sellScore += 25 + Math.min(Math.floor(volRatio * 15), 35) + Math.floor(bodyR * 20) + redN * 5 + Math.floor(upperWickR * 10);
    buyScore  += Math.floor(lowerWickR * 15);
  }
  if (volRatio >= 2.5) { c > o ? (buyScore += 10) : (sellScore += 10); }

  const volStr = volRatio.toFixed(1) + 'x';
  if (buyScore >= 55 && buyScore > sellScore)
    return { signal: 'BUY',  strength: Math.min(buyScore, 100), label: `FreshBuy ${volStr}` };
  if (sellScore >= 55 && sellScore > buyScore)
    return { signal: 'SELL', strength: Math.min(sellScore, 100), label: `FreshSell ${volStr}` };
  return { signal: 'NEUTRAL', strength: 0, label: 'Neutral' };
}

export function computeHTFBias(candles5m) {
  const result = { '15m': '—', '1h': '—', '15m_bull': null, '1h_bull': null };

  for (const [mins, key] of [[15, '15m'], [60, '1h']]) {
    const htf = resampleToHTF(candles5m, mins);
    if (htf.length < 2) continue;
    try {
      const closes = htf.map(c => c.close);
      const tpvSum = htf.reduce((s, c) => s + ((c.high + c.low + c.close) / 3) * c.volume, 0);
      const volSum = htf.reduce((s, c) => s + c.volume, 0);
      const vwap   = volSum > 0 ? tpvSum / volSum : closes[closes.length - 1];
      const price  = closes[closes.length - 1];
      const e9Arr  = htf.length >= 9  ? ema(closes, 9)  : null;
      const e9     = e9Arr ? e9Arr[e9Arr.length - 1] : price;

      let trend, isBull;
      if (price > e9 && price > vwap)       { trend = '↑↑ Bull'; isBull = true;  }
      else if (price < e9 && price < vwap)  { trend = '↓↓ Bear'; isBull = false; }
      else if (price > vwap)                { trend = '↑~ Weak'; isBull = true;  }
      else if (price < vwap)                { trend = '↓~ Weak'; isBull = false; }
      else                                  { trend = 'Mixed';   isBull = null;  }

      result[key]           = trend;
      result[`${key}_bull`] = isBull;
    } catch (_) {}
  }
  return result;
}

function resampleToHTF(candles5m, intervalMins) {
  const buckets = {};
  for (const c of candles5m) {
    const t    = new Date(c.time);
    const slot = Math.floor((t.getHours() * 60 + t.getMinutes()) / intervalMins);
    const key  = `${t.toDateString()}_${slot}`;
    if (!buckets[key]) {
      buckets[key] = { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, time: c.time };
    } else {
      buckets[key].high   = Math.max(buckets[key].high, c.high);
      buckets[key].low    = Math.min(buckets[key].low,  c.low);
      buckets[key].close  = c.close;
      buckets[key].volume += c.volume;
    }
  }
  return Object.values(buckets).filter(b => b.volume > 0);
}

export function analyseStock(sym, candles5m, candlesDaily, pdh, pdl, pdc) {
  const today    = new Date().toDateString();
  const todayC   = candles5m.filter(c => new Date(c.time).toDateString() === today);
  if (todayC.length < 6) return null;

  const closes   = todayC.map(c => c.close);
  const current  = closes[closes.length - 1];
  const vwap     = computeVWAP(todayC);
  const distPct  = (current - vwap) / vwap * 100;

  // Use relaxed thresholds for first ~12 candles (first hour), matching Python bot
  const isEarly = todayC.length < 12;
  const vwapBand    = isEarly ? VWAP_ENTRY_BAND_EARLY : VWAP_ENTRY_BAND;
  const respectMin  = isEarly ? VWAP_RESPECT_MIN_EARLY : VWAP_RESPECT_MIN;

  // Per-bar running VWAP series — used to count how many candles respected VWAP
  // (matches Python bot: closes >= vwap_series.values).sum() / n_total)
  const vwapSeries = computeVWAPSeries(todayC);
  const nAbove  = closes.filter((c, i) => c >= vwapSeries[i]).length;
  const nBelow  = closes.filter((c, i) => c <  vwapSeries[i]).length;
  const total   = nAbove + nBelow;
  const pctAbove = nAbove / total;
  const pctBelow = nBelow / total;

  const isBullish = pctAbove >= respectMin && distPct >= 0 && distPct <= vwapBand;
  const isBearish = pctBelow >= respectMin && distPct >= -vwapBand && distPct <= 0;

  const htf         = computeHTFBias(todayC);
  const htf15mBull  = htf['15m_bull'];
  const htf1hBull   = htf['1h_bull'];

  const bnr = detectBnR(todayC, pdh, pdl, pdc);
  const of  = detectOrderFlow(todayC);

  let direction = null;
  if      (isBullish) direction = 'LONG';
  else if (isBearish) direction = 'SHORT';
  else if (bnr)       direction = bnr.bnrDir === 'BULL' ? 'LONG' : 'SHORT';
  else return null;

  if (direction === 'LONG'  && htf15mBull === false && htf1hBull === false) return null;
  if (direction === 'SHORT' && (htf15mBull === true  || htf1hBull === true))  return null;

  const e9Arr  = todayC.length >= 9  ? ema(closes, 9)  : null;
  const e21Arr = todayC.length >= 21 ? ema(closes, 21) : null;
  const e9_5m  = e9Arr  ? e9Arr[e9Arr.length - 1]   : current;
  const e21_5m = e21Arr ? e21Arr[e21Arr.length - 1]  : current;

  let rsi = 50, atrPct = 0;
  let dailyTrend = 'N/A', isBullDaily = false, isBearDaily = false;

  if (candlesDaily && candlesDaily.length >= 55) {
    const dc = candlesDaily.map(c => c.close);
    rsi = computeRSI(dc);
    const atr = computeATR(candlesDaily);
    atrPct = parseFloat((atr / current * 100).toFixed(2));
    const de9  = ema(dc, 9)[dc.length - 1];
    const de20 = ema(dc, 20)[dc.length - 1];
    const de50 = ema(dc, 50)[dc.length - 1];
    if (current > de9 && de9 > de20 && de20 > de50)         { dailyTrend = '↑↑↑ Bull'; isBullDaily = true; }
    else if (current > de20 && de20 > de50)                 { dailyTrend = '↑↑~ Part';  isBullDaily = true; }
    else if (current > de50)                                 { dailyTrend = '↑~~ Weak'; }
    else if (current < de9 && de9 < de20 && de20 < de50)    { dailyTrend = '↓↓↓ Bear'; isBearDaily = true; }
    else if (current < de20 && de20 < de50)                 { dailyTrend = '↓↓~ Part';  isBearDaily = true; }
    else if (current < de50)                                 { dailyTrend = '↓~~ Weak'; }
    else                                                     { dailyTrend = '~ Mixed'; }

    if (direction === 'SHORT' && !(current < de9 && de9 < de20 && de20 < de50)) return null;
  }

  const respectPct = direction === 'LONG' ? pctAbove : pctBelow;
  const proximity  = (isBullish || isBearish) ? 1.0 - Math.abs(distPct) / VWAP_ENTRY_BAND : 0.5;
  const trendBonus = (direction === 'LONG' ? isBullDaily : isBearDaily) ? 20 : 0;
  const bnrBonus   = bnr ? bnr.bnrScore * 0.3 : 0;
  const ofBonus    = (direction === 'LONG' && of.signal === 'BUY') ||
                     (direction === 'SHORT' && of.signal === 'SELL') ? 12 : 0;
  const htfBonus   = (direction === 'LONG'  ? (htf15mBull === true  ? 8 : 0) + (htf1hBull === true  ? 10 : 0)
                                            : (htf15mBull === false ? 8 : 0) + (htf1hBull === false ? 10 : 0));
  const rankScore  = respectPct * 35 + proximity * 20 + trendBonus + bnrBonus + ofBonus + htfBonus;

  const atrAbs = atrPct > 0 ? (atrPct / 100) * current : current * 0.005;
  const levels = computeTradeLevels(direction, current, vwap, bnr, atrAbs, pdh, pdl);

  const gapPct = pdc > 0 ? parseFloat(((current - pdc) / pdc * 100).toFixed(2)) : 0;

  return {
    symbol:       sym,
    price:        Math.round(current * 10) / 10,
    vwap:         Math.round(vwap * 10) / 10,
    vwapDistPct:  parseFloat(distPct.toFixed(2)),
    vwapRespect:  `${Math.round(respectPct * 100)}%`,
    htf15m:       htf['15m'],
    htf1h:        htf['1h'],
    bnrLabel:     bnr?.bnrLabel ?? '—',
    bnrLevel:     bnr?.bnrPrice ?? '—',
    bnrScore:     bnr?.bnrScore ?? 0,
    orderFlow:    of.signal,
    orderFlowLabel: of.label,
    rsi,
    dailyTrend,
    e9_5m:        Math.round(e9_5m * 10) / 10,
    e21_5m:       Math.round(e21_5m * 10) / 10,
    abvE9:        current > e9_5m,
    atrPct,
    gapPct,
    pdh:          Math.round((pdh || 0) * 10) / 10,
    pdl:          Math.round((pdl || 0) * 10) / 10,
    pdc:          Math.round((pdc || 0) * 10) / 10,
    orh:          bnr ? Math.round(bnr.orh * 10) / 10 : '—',
    orl:          bnr ? Math.round(bnr.orl * 10) / 10 : '—',
    direction,
    entry:        levels.entry,
    sl:           levels.sl,
    t1:           levels.t1,
    t2:           levels.t2,
    rr:           levels.rr,
    rankScore:    parseFloat(rankScore.toFixed(1)),
    ofConfirms:   ofBonus > 0,
  };
}

function computeTradeLevels(direction, current, vwap, bnr, atrAbs, pdh, pdl) {
  if (atrAbs <= 0) atrAbs = current * 0.005;
  const bnrLvl = bnr?.bnrPrice || 0;
  const useBnr = bnrLvl > 0;

  let entry, sl, t1, t2;
  if (direction === 'LONG') {
    entry  = Math.round((useBnr ? bnrLvl : vwap) * 10) / 10;
    let slRaw = entry - 0.6 * atrAbs;
    if (pdl > 0 && slRaw > pdl) slRaw = pdl - 0.1 * atrAbs;
    sl = Math.round(slRaw * 10) / 10;
    t1 = Math.round((entry + 1.5 * atrAbs) * 10) / 10;
    t2 = Math.round((entry + 2.5 * atrAbs) * 10) / 10;
  } else {
    entry  = Math.round((useBnr ? bnrLvl : vwap) * 10) / 10;
    let slRaw = entry + 0.8 * atrAbs;
    if (pdh > 0 && slRaw < pdh) slRaw = pdh + 0.1 * atrAbs;
    sl = Math.round(slRaw * 10) / 10;
    t1 = Math.round((entry - 1.5 * atrAbs) * 10) / 10;
    t2 = Math.round((entry - 2.5 * atrAbs) * 10) / 10;
  }
  const risk   = Math.abs(entry - sl);
  const reward = Math.abs(t1 - entry);
  const rr     = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : '1:0';
  return { entry, sl, t1, t2, rr };
}

export function computeNiftyPulse(stockResults) {
  const aboveVwap = stockResults.filter(r => r._aboveVwap);
  const belowVwap = stockResults.filter(r => !r._aboveVwap);
  const total     = aboveVwap.length + belowVwap.length;
  const pctAbove  = total > 0 ? Math.round(aboveVwap.length / total * 100) : 50;

  let bias, confidence;
  if      (pctAbove >= 80) { bias = 'LONG';    confidence = 'Strong';   }
  else if (pctAbove >= 70) { bias = 'LONG';    confidence = 'Moderate'; }
  else if (pctAbove <= 10) { bias = 'SHORT';   confidence = 'Strong';   }
  else if (pctAbove <= 20) { bias = 'SHORT';   confidence = 'Moderate'; }
  else                     { bias = 'NEUTRAL'; confidence = 'Weak';     }

  return { pctAbove, bias, confidence, nAbove: aboveVwap.length, nBelow: belowVwap.length };
}
