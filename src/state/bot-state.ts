import { Position } from '../position/types';
import {
  CircuitBreakerState,
  createInitialCircuitState,
} from '../strategy/circuit-breakers';

export interface BotStateData {
  circuitBreaker: CircuitBreakerState;
  positions: Position[];
  lastProcessedCandleTime: number;
  botStartTime: number;
}

export function createInitialState(equity: number): BotStateData {
  return {
    circuitBreaker: createInitialCircuitState(equity),
    positions: [],
    lastProcessedCandleTime: 0,
    botStartTime: Date.now(),
  };
}
