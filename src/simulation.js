
import { assessTradeRisk } from "./risk-engine.js";

/**
 * Atlas Trading Command Center
 * Phase 1: Simulation foundation
 *
 * Simulation only. No broker connection or live orders.
 */

export const INITIAL_VIRTUAL_BALANCE = 100;

export const STRATEGIES = {
  PATIENT: "patient_high_confidence",
  AGGRESSIVE: "aggressive_short_term",
};

export function createVirtualAccount(strategy) {
  if (!Object.values(STRATEGIES).includes(strategy)) {
    throw new Error("Unknown strategy.");
  }

  
}

export function validateTrade(trade) {
  const errors = [];

  if (!trade || typeof trade !== "object") {
    return { valid: false, errors: ["Trade is required."] };
  }

  if (!trade.market || typeof trade.market !== "string") {
    errors.push("Market is required.");
  }

  if (!["LONG", "SHORT"].includes(trade.direction)) {
    errors.push("Direction must be LONG or SHORT.");
  }

  for (const field of ["entry", "stop", "target", "quantity"]) {
    if (
      typeof trade[field] !== "number" ||
      !Number.isFinite(trade[field]) ||
      trade[field] <= 0
    ) {
      errors.push(`${field} must be a positive number.`);
    }
  }

  if (
    Number.isFinite(trade.entry) &&
    Number.isFinite(trade.stop) &&
    Number.isFinite(trade.target)
  ) {
    if (trade.direction === "LONG") {
      if (trade.stop >= trade.entry) {
        errors.push("A LONG stop must be below entry.");
      }

      if (trade.target <= trade.entry) {
        errors.push("A LONG target must be above entry.");
      }
    }

    if (trade.direction === "SHORT") {
      if (trade.stop <= trade.entry) {
        errors.push("A SHORT stop must be above entry.");
      }

      if (trade.target >= trade.entry) {
        errors.push("A SHORT target must be below entry.");
      }
    }
  }

  if (
    trade.strategy === STRATEGIES.PATIENT &&
    (
      !Number.isFinite(trade.validatedProbability) ||
      trade.validatedProbability < 0.85
    )
  ) {
    errors.push(
      "Patient strategy requires historically validated probability of at least 85%."
    );
  }

  if (!Object.values(STRATEGIES).includes(trade.strategy)) {
    errors.push("A valid strategy is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function recordSimulatedTrade(account, trade, result) {
  if (!account || !Array.isArray(account.trades)) {
    throw new Error("A valid virtual account is required.");
  }

  const validation = validateTrade(trade);

  if (!validation.valid) {
    return {
      recorded: false,
      errors: validation.errors,
    };
  }

  const riskCheck = assessTradeRisk({
    accountBalance: account.balance,
    entry: trade.entry,
    stop: trade.stop,
    quantity: trade.quantity,
    pointValue: trade.pointValue ?? 1,
    dailyStartingBalance: account.startingBalance,
    dailyRealizedPnL: account.realizedPnL,
    openRisk: account.openRisk ?? 0,
  });

  if (!riskCheck.approved) {
    return {
      recorded: false,
      errors: riskCheck.errors,
      riskCheck,
    };
  }

  if (
    !result ||
    !Number.isFinite(result.exitPrice) ||
    result.exitPrice <= 0 ||
    !Number.isFinite(result.fees) ||
    result.fees < 0
  ) {
    return {
      recorded: false,
      errors: [
        "A valid exit price and nonnegative fees are required.",
      ],
    };
  }

  const directionMultiplier =
    trade.direction === "LONG" ? 1 : -1;

  const grossPnL =
    (result.exitPrice - trade.entry) *
    directionMultiplier *
    trade.quantity;

  const netPnL = grossPnL - result.fees;

  const record = {
    ...trade,
    exitPrice: result.exitPrice,
    fees: result.fees,
    grossPnL,
    netPnL,
    recordedAt: new Date().toISOString(),
  };

  account.balance += netPnL;
  account.realizedPnL += netPnL;
  account.trades.push(record);

  return {
    recorded: true,
    trade: record,
  };
}

export function getPerformanceSummary(account) {
  const trades = account.trades;

  const wins = trades.filter(
    (trade) => trade.netPnL > 0
  ).length;

  const losses = trades.filter(
    (trade) => trade.netPnL < 0
  ).length;

  
  return {
    strategy,
    startingBalance: INITIAL_VIRTUAL_BALANCE,
    balance: INITIAL_VIRTUAL_BALANCE,
    realizedPnL: 0,
    dailyStartingBalance: INITIAL_VIRTUAL_BALANCE,
    dailyRealizedPnL: 0,
    openRisk: 0,
    trades: [],
  };

}
