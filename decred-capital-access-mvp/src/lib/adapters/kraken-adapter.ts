export interface KrakenMarketData {
  priceUsd: number | null;
  bid: number | null;
  ask: number | null;
  volume24hDcr: number | null;
  online: boolean;
  warnings: string[];
}

export class KrakenAdapter {
  async getDcrUsd(): Promise<KrakenMarketData> {
    const warnings: string[] = [];

    try {
      const [pairResponse, tickerResponse] = await Promise.all([
        fetch("https://api.kraken.com/0/public/AssetPairs?pair=DCRUSD", { cache: "no-store" }),
        fetch("https://api.kraken.com/0/public/Ticker?pair=DCRUSD", { cache: "no-store" }),
      ]);
      const pairJson = await pairResponse.json();
      const tickerJson = await tickerResponse.json();
      const pair = pairJson?.result?.DCRUSD;
      const ticker = tickerJson?.result?.DCRUSD;

      if (!pair || pair.status !== "online") {
        warnings.push("Kraken DCRUSD pair did not report as online.");
      }

      return {
        priceUsd: ticker?.c?.[0] ? Number(ticker.c[0]) : null,
        bid: ticker?.b?.[0] ? Number(ticker.b[0]) : null,
        ask: ticker?.a?.[0] ? Number(ticker.a[0]) : null,
        volume24hDcr: ticker?.v?.[1] ? Number(ticker.v[1]) : null,
        online: pair?.status === "online",
        warnings,
      };
    } catch {
      return {
        priceUsd: null,
        bid: null,
        ask: null,
        volume24hDcr: null,
        online: false,
        warnings: ["Kraken API did not respond; using demo fallback pricing."],
      };
    }
  }
}

export const krakenAdapter = new KrakenAdapter();
