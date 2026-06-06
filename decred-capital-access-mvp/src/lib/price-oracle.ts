import { dcrdexAdapter } from "./adapters/dcrdex-adapter";
import { krakenAdapter } from "./adapters/kraken-adapter";
import { demoMarketSnapshot } from "./fixtures";
import { blendPrices } from "./risk";
import type { MarketSnapshot } from "./types";

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const [kraken, dcrdex, dia, coingecko, coinpaprika] = await Promise.allSettled([
    krakenAdapter.getDcrUsd(),
    dcrdexAdapter.getMarketData(),
    fetchDiaPrice(),
    fetchCoinGeckoPrice(),
    fetchCoinPaprikaPrice(),
  ]);

  const krakenData = kraken.status === "fulfilled" ? kraken.value : null;
  const dcrdexData = dcrdex.status === "fulfilled" ? dcrdex.value : null;
  const diaPrice = dia.status === "fulfilled" ? dia.value : null;
  const coingeckoPrice = coingecko.status === "fulfilled" ? coingecko.value : null;
  const coinpaprikaPrice = coinpaprika.status === "fulfilled" ? coinpaprika.value : null;
  const blended = blendPrices([
    krakenData?.priceUsd ?? 0,
    diaPrice ?? 0,
    coingeckoPrice ?? 0,
    coinpaprikaPrice ?? 0,
  ]);
  const sourceCount = [krakenData?.priceUsd, diaPrice, coingeckoPrice, coinpaprikaPrice].filter(Boolean).length;
  const warnings = [
    ...blended.warnings,
    ...(krakenData?.warnings ?? []),
    ...(dcrdexData?.warnings ?? []),
  ];

  if (sourceCount < 2) {
    warnings.push("Fewer than two live DCR/USD price sources responded; demo mode can continue, but production should pause new loans.");
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
    sourceCount,
    stale: false,
    warnings,
    updatedAt: new Date().toISOString(),
  };
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
