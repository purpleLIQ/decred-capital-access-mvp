export interface DcrdexMarketData {
  dcrBtcRate: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  dcrUsdcBookEmpty: boolean;
  dcrUsdtBookEmpty: boolean;
  warnings: string[];
}

interface DcrdexOrder {
  side: number;
  qty: number;
  rate: number;
}

export class DcrdexAdapter {
  async getMarketData(): Promise<DcrdexMarketData> {
    try {
      const [spotsResponse, btcBookResponse, usdcBookResponse, usdtBookResponse] = await Promise.all([
        fetch("https://dex.decred.org/api/spots", { cache: "no-store" }),
        fetch("https://dex.decred.org/api/orderbook/dcr/btc", { cache: "no-store" }),
        fetch("https://dex.decred.org/api/orderbook/dcr/usdc.polygon", { cache: "no-store" }),
        fetch("https://dex.decred.org/api/orderbook/dcr/usdt.polygon", { cache: "no-store" }),
      ]);
      const spots = await spotsResponse.json();
      const btcBook = await btcBookResponse.json();
      const usdcBook = await usdcBookResponse.json();
      const usdtBook = await usdtBookResponse.json();
      const orders: DcrdexOrder[] = btcBook?.orders ?? [];
      const bids = orders.filter((order) => order.side === 1);
      const asks = orders.filter((order) => order.side === 2);
      const bestBid = bids.length ? Math.max(...bids.map((order) => order.rate)) : null;
      const bestAsk = asks.length ? Math.min(...asks.map((order) => order.rate)) : null;
      const dcrBtcSpot = Array.isArray(spots)
        ? spots.find((spot) => spot.baseID === 42 && spot.quoteID === 0)
        : null;

      return {
        dcrBtcRate: dcrBtcSpot?.rate ? Number(dcrBtcSpot.rate) / 100000000 : null,
        bestBid,
        bestAsk,
        dcrUsdcBookEmpty: (usdcBook?.orders ?? []).length === 0,
        dcrUsdtBookEmpty: (usdtBook?.orders ?? []).length === 0,
        warnings:
          (usdcBook?.orders ?? []).length === 0 && (usdtBook?.orders ?? []).length === 0
            ? ["DCRDEX stablecoin order books are empty right now."]
            : [],
      };
    } catch {
      return {
        dcrBtcRate: null,
        bestBid: null,
        bestAsk: null,
        dcrUsdcBookEmpty: true,
        dcrUsdtBookEmpty: true,
        warnings: ["DCRDEX APIs did not respond; using demo liquidity assumptions."],
      };
    }
  }
}

export const dcrdexAdapter = new DcrdexAdapter();
