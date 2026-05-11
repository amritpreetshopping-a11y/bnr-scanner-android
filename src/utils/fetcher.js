// Yahoo Finance chart API — same source as yfinance, CORS-enabled, no proxy needed
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const BATCH_SIZE = 15; // parallel requests per batch

function yfUrl(ticker, interval, range) {
  return `${YF_BASE}/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false`;
}

async function yfGet(ticker, interval, range) {
  const res = await fetch(yfUrl(ticker, interval, range), {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`YF ${ticker} → ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`YF ${ticker} no data`);
  return result;
}

function parseCandles(result) {
  const ts  = result.timestamp ?? [];
  const q   = result.indicators?.quote?.[0] ?? {};
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ time: ts[i] * 1000, open: o, high: h, low: l, close: c, volume: v ?? 0 });
  }
  return candles;
}

export async function fetchNiftySpot() {
  try {
    const result = await yfGet('^NSEI', '5m', '1d');
    const price  = result.meta?.regularMarketPrice ?? result.meta?.chartPreviousClose;
    const prevClose = result.meta?.chartPreviousClose ?? price;
    const chgPct = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : 0;
    return { price, chgPct };
  } catch (_) { return null; }
}

async function fetchStockData(symbol) {
  const ticker = symbol + '.NS';
  // Fetch 5m intraday (2 days = today + prev for PDH/PDL) and 3mo daily in parallel
  const [intraResult, dailyResult] = await Promise.all([
    yfGet(ticker, '5m', '2d').catch(() => null),
    yfGet(ticker, '1d', '3mo').catch(() => null),
  ]);

  const intra5m = intraResult ? parseCandles(intraResult) : [];
  const daily   = dailyResult ? parseCandles(dailyResult) : [];

  // Previous day levels from daily candles
  const prevLevels = (() => {
    if (daily.length < 2) return { pdh: 0, pdl: 0, pdc: 0 };
    const prev = daily[daily.length - 2];
    return { pdh: prev.high, pdl: prev.low, pdc: prev.close };
  })();

  return { symbol, intra5m, daily, prevLevels };
}

// Parallel batch fetch — BATCH_SIZE stocks at a time
export async function batchFetchStocks(symbols, onProgress) {
  const results = [];
  let done = 0;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(sym =>
        fetchStockData(sym).catch(() => ({
          symbol: sym, intra5m: [], daily: [], prevLevels: { pdh: 0, pdl: 0, pdc: 0 },
        }))
      )
    );
    results.push(...batchResults);
    done += batch.length;
    onProgress?.(done, symbols.length, batch[batch.length - 1]);
  }

  return results;
}
