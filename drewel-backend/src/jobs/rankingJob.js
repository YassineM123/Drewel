import { recalculateAllRankings, assignRankingPositions } from "../services/driverRankingService.js";

const RANKING_RECALCULATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let recalculationTimer = null;

const runRankingRecalculation = async () => {
  try {
    console.log("[RankingJob] Starting ranking recalculation...");
    await recalculateAllRankings();
    await assignRankingPositions();
    console.log("[RankingJob] Ranking recalculation completed");
  } catch (error) {
    console.error("[RankingJob] Ranking recalculation failed:", error.message);
  }
};

export const startRankingJob = () => {
  if (recalculationTimer) return;
  console.log("[RankingJob] Starting ranking recalculation job");
  recalculationTimer = setInterval(runRankingRecalculation, RANKING_RECALCULATION_INTERVAL_MS);
  // Run once on startup after a short delay to avoid blocking server start
  setTimeout(runRankingRecalculation, 30_000);
};

export const stopRankingJob = () => {
  if (recalculationTimer) {
    clearInterval(recalculationTimer);
    recalculationTimer = null;
  }
};
