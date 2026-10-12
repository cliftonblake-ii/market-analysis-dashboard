
/**
 * Atlas Trading Command Center
 * Simulation Engine — Phase 1
 *
 * Uses virtual accounts only.
 * No broker connection or live order execution.
 */

import {
  DEFAULT_RISK_RULES,
  assessTradeRisk,
} from "./risk-engine.js";

export const INITIAL_VIRTUAL_BALANCE = 100;

export const STRATEGIES = Object.freeze({
  PATIENT: "patient_high_confidence",
  AGGRESSIVE: "aggressive_short_term",
});

export function createVirtualAccount(strategy) {
  if (!Object.values(STRATEGIES).includes(strategy)) {
    throw new Error("Unknown strategy.");
  }

  return {
    strategy,
    startingBalance: INITIAL_VIRTUAL_BALANCE,
    balance: INITIAL_VIRTUAL_BALANCE,
    realizedPnL: 0,

    // Daily tracking. Reset logic will be added separately.
    dailyStartingBalance: INITIAL_VIRTUAL_BALANCE,
    dailyRealizedPnL: 0,

    // Tracks trades that are currently open.
openPositions: [],

// Temporary compatibility field.
// We will replace this with calculated open risk.
openRisk: 0,

    riskRules: { ...DEFAULT_RISK_RULES },
    trades: [],
  };
}

export function validateTrade(trade) {
  const errors = [];

  if (!trade || typeof trade !== "object") {
    return {
      valid: false,
      errors: ["Trade is required."],
    };
  }

  if (typeof trade.market !== "string" || !trade.market.trim()) {
    errors.push("Market is required.");
  }

  if (!Object.values(STRATEGIES).includes(trade.strategy)) {
    errors.push("A valid strategy is required.");
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

  if (trade.pointValue !== undefined) {
    if (
      typeof trade.pointValue !== "number" ||
      !Number.isFinite(trade.pointValue) ||
      trade.pointValue <= 0
    ) {
      errors.push("pointValue must be a positive number.");
    }
  }

  if (
    Number.isFinite(trade.entry) &&
    Number.isFinite(trade.stop) &&
    Number.isFinite(trade.target)
  ) {
    if (trade.entry === trade.stop) {
      errors.push("Entry and stop cannot be the same price.");
    }

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

  if (trade.strategy === STRATEGIES.PATIENT) {
    if (
      !Number.isFinite(trade.validatedProbability) ||
      trade.validatedProbability < 0.85 ||
      trade.validatedProbability > 1
    ) {
      errors.push(
        "Patient strategy requires a claimed validated probability from 85% to 100%."
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function recordSimulatedTrade(account, trade, result) {
  if (
    !account ||
    !Array.isArray(account.trades) ||
    !Number.isFinite(account.balance) ||
    !Number.isFinite(account.realizedPnL)
  ) {
    throw new Error("A valid virtual account is required.");
  }

  const validation = validateTrade(trade);

  if (!validation.valid) {
    return {
      recorded: false,
      errors: validation.errors,
    };
  }

  if (trade.strategy !== account.strategy) {
    return {
      recorded: false,
      errors: ["Trade strategy does not match the virtual account."],
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

  // Risk check happens before the trade can be recorded.
  const riskCheck = assessTradeRisk({
    accountBalance: account.balance,
    dailyStartingBalance:
      account.dailyStartingBalance ?? account.startingBalance,
    dailyRealizedPnL: account.dailyRealizedPnL ?? 0,
    openRisk: account.openRisk ?? 0,
    entry: trade.entry,
    stop: trade.stop,
    quantity: trade.quantity,
    pointValue: trade.pointValue ?? 1,
    rules: account.riskRules ?? DEFAULT_RISK_RULES,
  });

  if (!riskCheck.approved) {
    return {
      recorded: false,
      errors: riskCheck.errors,
      riskCheck,
    };
  }

  const directionMultiplier = trade.direction === "LONG" ? 1 : -1;

  const grossPnL =
    (result.exitPrice - trade.entry) *
    directionMultiplier *
    (trade.quantity * (trade.pointValue ?? 1));

  const netPnL = grossPnL - result.fees;

  const record = {
    ...trade,
    exitPrice: result.exitPrice,
    fees: result.fees,
    grossPnL,
    netPnL,
    riskCheck,
    recordedAt: new Date().toISOString(),
  };

  // Update totals only after all validation and risk checks pass.
  account.balance += netPnL;
  account.realizedPnL += netPnL;
  account.dailyRealizedPnL =
    (account.dailyRealizedPnL ?? 0) + netPnL;

  account.trades.push(record);

  return {
    recorded: true,
    trade: record,
  };
}

export function getPerformanceSummary(account) {
  if (!account || !Array.isArray(account.trades)) {
    throw new Error("A valid virtual account is required.");
  }

  const trades = account.trades;
  const wins = trades.filter((trade) => trade.netPnL > 0).length;
  const losses = trades.filter((trade) => trade.netPnL < 0).length;
  const breakeven = trades.filter((trade) => trade.netPnL === 0).length;

  return {
    strategy: account.strategy,
    startingBalance: account.startingBalance,
    currentBalance: account.balance,
    realizedPnL: account.realizedPnL,
    dailyRealizedPnL: account.dailyRealizedPnL ?? 0,
    totalTrades: trades.length,
    wins,
    losses,
    breakeven,
    winRate: trades.length ? wins / trades.length : null,
  };
}
