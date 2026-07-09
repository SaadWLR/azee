import {
  getRecentResearchTitles,
  getResearchReports,
} from "../services/researchService";
import { useAsyncData } from "./useAsyncData";

export function useResearchReports() {
  return useAsyncData(getResearchReports);
}

export function useRecentResearchTitles() {
  return useAsyncData(getRecentResearchTitles);
}
