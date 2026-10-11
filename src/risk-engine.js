
/**
 * Atlas Trading Command Center
 * Phase 1: Risk Engine
 *
 * Simulation only. No live orders.
 */

export const DEFAULT_RISK_RULES = {
  maxRiskPerTradePercent: 1,
  maxDailyLossPercent: 3,
  maxOpenRiskPercent: 2,
};

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
}) {
  const errors = [];

  const positiveValues = {
    accountBalance,
    dailyStartingBalance,
    pointValue,
  };

  for (const [name, value] of Object.entries(positiveValues)) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      errors.push(`${name} must be a positive number.`);
    }
  }

  for (const [name, value] of Object.entries({
    entry,
    stop,
    quantity,
  })) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      errors.push(`${name} must be a positive number.`);
    }
  }

  for (const [name, value] of Object.entries({
    dailyRealizedPnL,
    openRisk,
  })) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 && name === "openRisk"
    ) {
      errors.push(`${name} must be a valid number.`);
    }
  }

  for (const [name, value] of Object.entries(rules)) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 100
    ) {
      errors.push(`${name} must be greater than 0 and at most 100.`);
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

  const dailyLoss = Math.max(0, -dailyRealizedPnL);

  const maxDailyLoss =
    dailyStartingBalance * rules.maxDailyLossPercent / 100;

  const maxOpenRisk =
    accountBalance * rules.maxOpenRiskPercent / 100;

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
      ? "RISK CHECK PASSED: Trade meets configured limits."
      : "RISK VETO: Trade rejected.",
    riskPerUnit,
    proposedRisk,
    maxTradeRisk,
    dailyLoss,
    maxDailyLoss,
    openRiskAfterTrade: openRisk + proposedRisk,
    maxOpenRisk,
  };
}
