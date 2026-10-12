
/**
 * Atlas Trading Command Center
 * Risk Engine — Phase 1
 *
 * Evaluates proposed trades before simulation.
 * No broker connection or live order execution.
 */

export const DEFAULT_RISK_RULES = Object.freeze({
  maxRiskPerTradePercent: 1,
  maxDailyLossPercent: 3,
  maxOpenRiskPercent: 2,
});

export function assessTradeRisk({
  accountBalance,
  dailyStartingBalance = accountBalance,
  dailyRealizedPnL = 0,
  openRisk = 0,
  entry,
  stop,
  quantity,
  pointValue = 1,
  rules = DEFAULT_RISK_RULES,
} = {}) {
  const errors = [];


const baseTrade = {
  accountBalance: 1000,
  entry: 100,
  stop: 95,
  quantity: 1,
  pointValue: 1,
};

    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      errors.push(`${name} must be a positive number.`);
    }
  }

  if (
    typeof dailyRealizedPnL !== "number" ||
    !Number.isFinite(dailyRealizedPnL)
  ) {
    errors.push("dailyRealizedPnL must be a valid number.");
  }

  if (
    typeof openRisk !== "number" ||
    !Number.isFinite(openRisk) ||
    openRisk < 0
  ) {
    errors.push("openRisk must be a nonnegative number.");
  }

  if (!rules || typeof rules !== "object") {
    errors.push("Valid risk rules are required.");
  } else {
    for (const name of [
      "maxRiskPerTradePercent",
      "maxDailyLossPercent",
      "maxOpenRiskPercent",
    ]) {
      const value = rules[name];

      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value <= 0 ||
        value > 100
      ) {
        errors.push(
          `${name} must be greater than 0 and at most 100.`
        );
      }
    }
  }

  if (errors.length > 0) {
    return {
      approved: false,
      errors,
      message: "RISK VETO: Invalid inputs.",
    };
  }

  const riskPerUnit = Math.abs(entry - stop) * pointValue;
  const proposedRisk = riskPerUnit * quantity;

  const maxTradeRisk =
    accountBalance * rules.maxRiskPerTradePercent / 100;

  // Negative daily P&L means a realized daily loss.
  const dailyLoss = Math.max(0, -dailyRealizedPnL);

  const maxDailyLoss =
    dailyStartingBalance * rules.maxDailyLossPercent / 100;

  const maxOpenRisk =
    accountBalance * rules.maxOpenRiskPercent / 100;

  if (entry === stop) {
    errors.push("Entry and stop cannot be the same price.");
  }

  if (proposedRisk > maxTradeRisk) {
    errors.push("Trade exceeds the maximum risk per trade.");
  }

  if (dailyLoss >= maxDailyLoss) {
    errors.push("Daily loss limit reached. No new trades allowed.");
  } else if (dailyLoss + proposedRisk > maxDailyLoss) {
    errors.push("Trade could exceed the daily loss limit.");
  }

  if (openRisk + proposedRisk > maxOpenRisk) {
    errors.push("Trade would exceed the maximum combined open risk.");
  }

  return {
    approved: errors.length === 0,
    errors,
    message: errors.length === 0
      ? "RISK CHECK PASSED."
      : "RISK VETO: Trade rejected.",
    riskPerUnit,
    proposedRisk,
    maxTradeRisk,
    dailyLoss,
    maxDailyLoss,
    openRisk,
    openRiskAfterTrade: openRisk + proposedRisk,
    maxOpenRisk,
  };
}
