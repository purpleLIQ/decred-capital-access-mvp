import { dcrdexAdapter } from "./adapters/dcrdex-adapter";
import { krakenAdapter } from "./adapters/kraken-adapter";
import { demoMarketSnapshot } from "./fixtures";
import { protocolConfig } from "./protocol-config";
import { blendPrices } from "./risk";
import type { MarketSnapshot } from "./types";

type PriceSource = {
  name: string;
  price: number | null;
  warnings: string[];
};

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const [kraken, dcrdex, dia, coingecko, coinpaprika] = await Promise.allSettled([
    withTimeout(krakenAdapter.getDcrUsd(), "Kraken"),
    withTimeout(dcrdexAdapter.getMarketData(), "DCRDEX"),
    withTimeout(fetchDiaPrice(), "DIA"),
    withTimeout(fetchCoinGeckoPrice(), "CoinGecko"),
    withTimeout(fetchCoinPaprikaPrice(), "CoinPaprika"),
  ]);

  const krakenData = kraken.status === "fulfilled" ? kraken.value : null;
  const dcrdexData = dcrdex.status === "fulfilled" ? dcrdex.value : null;
  const sources: PriceSource[] = [
    { name: "Kraken", price: krakenData?.priceUsd ?? null, warnings: krakenData?.warnings ?? [] },
    { name: "DIA", price: dia.status === "fulfilled" ? dia.value : null, warnings: [] },
    { name: "CoinGecko", price: coingecko.status === "fulfilled" ? coingecko.value : null, warnings: [] },
    { name: "CoinPaprika", price: coinpaprika.status === "fulfilled" ? coinpaprika.value : null, warnings: [] },
  ];
  const blended = blendPrices(sources.map((source) => source.price ?? 0));
  const liveSources = sources.filter((source) => source.price && source.price > 0);
  const warnings = [
    ...blended.warnings,
    ...sources.flatMap((source) => source.warnings),
    ...(dcrdexData?.warnings ?? []),
  ];

  if (liveSources.length < protocolConfig.minLivePriceSources) {
    warnings.push(
      `Only ${liveSources.length} live DCR/USD price source${liveSources.length === 1 ? "" : "s"} responded; keep lending in demo review mode.`,
    );
  }

  return {
    dcrUsd: blended.price,
    dcrBtc: dcrdexData?.dcrBtcRate ?? demoMarketSnapshot.dcrBtc,
    krakenBid: krakenData?.bid ?? demoMarketSnapshot.krakenBid,
    krakenAsk: krakenData?.ask ?? demoMarketSnapshot.krakenAsk,
    dcrdexBestBid: dcrdexData?.bestBid ?? demoMarketSnapshot.dcrdexBestBid,
    dcrdexBestAsk: dcrdexData?.bestAsk ?? demoMarketSnapshot.dcrdexBestAsk,
    dcrdexStableBookEmpty:
      dcrdexData?.dcrUsdcBookEmpty ?? dcrdexData?.dcrUsdtBookEmpty ?? demoMarketSnapshot.dcrdexStableBookEmpty,
    sourceCount: blended.sourceCount,
    stale: blended.sourceCount === 0,
    warnings,
    updatedAt: new Date().toISOString(),
  };
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${label} request timed out after ${protocolConfig.oracleRequestTimeoutMs}ms`)),
      protocolConfig.oracleRequestTimeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fetchDiaPrice(): Promise<number | null> {
  try {
    const response = await fetch(
      "https://api.diadata.org/v1/assetQuotation/decred/0x0000000000000000000000000000000000000000",
      { cache: "no-store" },
    );
    const json = await response.json();
    return json?.Price ? Number(json.Price) : null;
  } catch {
    return null;
  }
}

async function fetchCoinGeckoPrice(): Promise<number | null> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=decred&vs_currencies=usd&include_last_updated_at=true",
      { cache: "no-store" },
    );
    const json = await response.json();
    return json?.decred?.usd ? Number(json.decred.usd) : null;
  } catch {
    return null;
  }
}

async function fetchCoinPaprikaPrice(): Promise<number | null> {
  try {
    const response = await fetch("https://api.coinpaprika.com/v1/tickers/dcr-decred", { cache: "no-store" });
    const json = await response.json();
    return json?.quotes?.USD?.price ? Number(json.quotes.USD.price) : null;
  } catch {
    return null;
  }
}
