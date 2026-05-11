const NSE_BASE   = 'https://www.nseindia.com';
const PROXY_BASE = 'https://api.allorigins.win/raw?url=';

function proxyUrl(url) {
  return PROXY_BASE + encodeURIComponent(url);
}

const _headers = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0',
};

async function nseGet(path) {
  const res = await fetch(proxyUrl(NSE_BASE + path), { headers: _headers });
  if (!res.ok) throw new Error(`NSE ${path} → ${res.status}`);
  return res.json();
}

export async function fetchNiftySpot() {
  try {
    const data = await nseGet('/api/allIndices');
    const nifty = data.data?.find(d => d.index === 'NIFTY 50');
    return nifty ? { price: nifty.last, chgPct: nifty.percentChange } : null;
  } catch (_) { return null; }
}

export async function fetchStockQuote(symbol) {
  try {
    const data = await nseGet(`/api/quote-equity?symbol=${encodeURIComponent(symbol)}`);
    const pd   = data.priceInfo;
    if (!pd) return null;
    return {
      price:    pd.lastPrice,
      open:     pd.open,
      high:     pd.intraDayHighLow?.max ?? pd.lastPrice,
      low:      pd.intraDayHighLow?.min ?? pd.lastPrice,
      prevClose: pd.previousClose,
      volume:   data.marketDeptOrderBook?.totalTradedVolume ?? 0,
    };
  } catch (_) { return null; }
}

export async function fetchIntraday5m(symbol) {
  try {
    const url  = `${NSE_BASE}/api/chart-databyindex?index=${encodeURIComponent(symbol + '-EQ')}&indices=false`;
    const data = await nseGet(`/api/chart-databyindex?index=${encodeURIComponent(symbol + '-EQ')}&indices=false`);
    if (!data?.grapthData?.length) return [];
    return data.grapthData.map(([ts, o, h, l, c, v]) => ({
      time: ts, open: o, high: h, low: l, close: c, volume: v ?? 0,
    }));
  } catch (_) { return []; }
}

export async function fetchDaily(symbol) {
  try {
    const to   = Math.floor(Date.now() / 1000);
    const from = to - 90 * 86400;
    const url  = `${NSE_BASE}/api/historical/cm/equity?symbol=${encodeURIComponent(symbol)}&series=EQ&from=${toDateStr(from)}&to=${toDateStr(to)}`;
    const data = await nseGet(`/api/historical/cm/equity?symbol=${encodeURIComponent(symbol)}&series=EQ&from=${toDateStr(from)}&to=${toDateStr(to)}`);
    if (!data?.data?.length) return [];
    return data.data.map(r => ({
      time:   r.CH_TIMESTAMP,
      open:   parseFloat(r.CH_OPENING_PRICE),
      high:   parseFloat(r.CH_TRADE_HIGH_PRICE),
      low:    parseFloat(r.CH_TRADE_LOW_PRICE),
      close:  parseFloat(r.CH_CLOSING_PRICE),
      volume: parseInt(r.CH_TOT_TRADED_QTY, 10),
    })).sort((a, b) => new Date(a.time) - new Date(b.time));
  } catch (_) { return []; }
}

function toDateStr(epochSec) {
  const d = new Date(epochSec * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

export async function fetchPrevDayLevels(symbol) {
  try {
    const data  = await fetchDaily(symbol);
    if (data.length < 2) return { pdh: 0, pdl: 0, pdc: 0 };
    const prev = data[data.length - 2];
    return { pdh: prev.high, pdl: prev.low, pdc: prev.close };
  } catch (_) { return { pdh: 0, pdl: 0, pdc: 0 }; }
}

// Batch fetch for multiple symbols — returns [{symbol, quote, intra5m, daily, prevLevels}]
export async function batchFetchStocks(symbols, onProgress) {
  const results = [];
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    onProgress?.(i + 1, symbols.length, sym);
    try {
      const [quote, intra5m, daily] = await Promise.all([
        fetchStockQuote(sym),
        fetchIntraday5m(sym),
        fetchDaily(sym),
      ]);
      const prevLevels = daily.length >= 2
        ? { pdh: daily[daily.length - 2].high, pdl: daily[daily.length - 2].low, pdc: daily[daily.length - 2].close }
        : { pdh: 0, pdl: 0, pdc: 0 };
      results.push({ symbol: sym, quote, intra5m, daily, prevLevels });
    } catch (_) {
      results.push({ symbol: sym, quote: null, intra5m: [], daily: [], prevLevels: { pdh: 0, pdl: 0, pdc: 0 } });
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50));
  }
  return results;
}
