import { getMarketSnapshot, getTickerQuotes } from "../services/marketService";
import { useAsyncData } from "./useAsyncData";

export function useMarketSnapshot() {
  return useAsyncData(getMarketSnapshot);
}

export function useTickerQuotes() {
  return useAsyncData(getTickerQuotes);
}
