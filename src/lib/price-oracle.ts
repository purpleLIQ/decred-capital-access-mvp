import { dcrdexAdapter } from "./adapters/dcrdex-adapter";
import { krakenAdapter } from "./adapters/kraken-adapter";
import { demoMarketSnapshot } from "./fixtures";
import { blendPrices } from "./risk";
import type { MarketSnapshot } from "./types";

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const [kraken, dcrdex, coingecko, coinpaprika] = await Promise.allSettled([
    krakenAdapter.getDcrUsd(),
    dcrdexAdapter.getMarketData(),
    fetchCoinGeckoPrice(),
    fetchCoinPaprikaPrice(),
  ]);

  const krakenData = kraken.status === "fulfilled" ? kraken.value : null;
  const dcrdexData = dcrdex.status === "fulfilled" ? dcrdex.value : null;
  const coingeckoPrice = coingecko.status === "fulfilled" ? coingecko.value : null;
  const coinpaprikaPrice = coinpaprika.status === "fulfilled" ? coinpaprika.value : null;
  const blended = blendPrices([
    krakenData?.priceUsd ?? 0,
    coingeckoPrice ?? 0,
    coinpaprikaPrice ?? 0,
  ]);
  const warnings = [
    ...blended.warnings,
    ...(krakenData?.warnings ?? []),
    ...(dcrdexData?.warnings ?? []),
  ];

  return {
    dcrUsd: blended.price,
    dcrBtc: dcrdexData?.dcrBtcRate ?? demoMarketSnapshot.dcrBtc,
    krakenBid: krakenData?.bid ?? demoMarketSnapshot.krakenBid,
    krakenAsk: krakenData?.ask ?? demoMarketSnapshot.krakenAsk,
    dcrdexBestBid: dcrdexData?.bestBid ?? demoMarketSnapshot.dcrdexBestBid,
    dcrdexBestAsk: dcrdexData?.bestAsk ?? demoMarketSnapshot.dcrdexBestAsk,
    dcrdexStableBookEmpty:
      dcrdexData?.dcrUsdcBookEmpty ?? dcrdexData?.dcrUsdtBookEmpty ?? demoMarketSnapshot.dcrdexStableBookEmpty,
    sourceCount: [krakenData?.priceUsd, coingeckoPrice, coinpaprikaPrice].filter(Boolean).length,
    stale: false,
    warnings,
    updatedAt: new Date().toISOString(),
  };
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
