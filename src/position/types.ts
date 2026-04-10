import { SignalSide } from '../strategy/types';

export interface Position {
  id: string;
  side: SignalSide;
  entryPrice: number;
  entryTime: number;
  initialQty: number;
  remainingQty: number;
  atrAtEntry: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  breakevenActive: boolean;
  trailingStop: number | null;
  krakenOrderIds: string[];
  slOrderId: string | null;
}

export function createPosition(params: {
  side: SignalSide;
  entryPrice: number;
  qty: number;
  atr: number;
  orderTxid: string;
}): Position {
  return {
    id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    side: params.side,
    entryPrice: params.entryPrice,
    entryTime: Date.now(),
    initialQty: params.qty,
    remainingQty: params.qty,
    atrAtEntry: params.atr,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    breakevenActive: false,
    trailingStop: null,
    krakenOrderIds: [params.orderTxid],
    slOrderId: null,
  };
}
