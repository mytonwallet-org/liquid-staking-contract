import { Address, Cell, Dictionary, DictionaryValue, beginCell, loadMessageRelaxed } from 'ton-core';
import { compile } from '@ton-community/blueprint';

export const AFTER_UPGRADE_METHOD_ID = 7777;

export type ParsedOrderMessage = {
  sendMode: number;
  destination: Address;
  value: bigint;
  body: Cell;
};

export type ParsedOrder = {
  queryId: bigint;
  messages: ParsedOrderMessage[];
};

// Pull the after_upgrade(method_id) cell out of a compiled FunC code BoC.
// FunC stores method dictionaries under the first ref of the code cell, keyed
// by 19-bit method_id.
export function extractMethod(code: Cell, methodId: number): Cell {
  const seg: DictionaryValue<Cell> = {
    parse: (src) => beginCell().storeSlice(src).endCell(),
    serialize: (src, b) => { b.storeSlice(src.asSlice()); },
  };
  const methods = Dictionary.loadDirect(Dictionary.Keys.Uint(19), seg, code.refs[0]);
  const cell = methods.get(methodId);
  if (!cell) throw new Error(`Method ${methodId} not found in compiled code`);
  return cell;
}

export async function compileAfterUpgrade(): Promise<Cell> {
  const code = await compile('UpdatePool');
  return extractMethod(code, AFTER_UPGRADE_METHOD_ID);
}

// multisig-dapp order layout: [64:queryId(expire<<32)] [for each msg: [8:sendMode] [^msg]]
export function parseOrder(boc: Buffer): ParsedOrder {
  const root = Cell.fromBoc(boc)[0];
  const s = root.beginParse();
  const queryId = s.loadUintBig(64);
  const messages: ParsedOrderMessage[] = [];
  while (s.remainingRefs > 0) {
    const sendMode = s.loadUint(8);
    const msg = loadMessageRelaxed(s.loadRef().beginParse());
    if (msg.info.type !== 'internal') {
      throw new Error(`Non-internal msg in order: ${msg.info.type}`);
    }
    messages.push({
      sendMode,
      destination: msg.info.dest,
      value: msg.info.value.coins,
      body: msg.body,
    });
  }
  return { queryId, messages };
}

export type OrderExpectations = { pool: Address; value: bigint; bodyHashHex: string };

export function verifyOrder(order: ParsedOrder, expected: OrderExpectations): void {
  if (order.messages.length !== 1) {
    throw new Error(`Order must contain exactly 1 message, got ${order.messages.length}`);
  }

  const msg = order.messages[0];
  const errors: string[] = [];

  if (!msg.destination.equals(expected.pool)) {
    errors.push(`destination mismatch: expected ${expected.pool.toString()}, got ${msg.destination.toString()}`);
  }
  if (msg.value !== expected.value) {
    errors.push(`value mismatch: expected ${expected.value} nanoTON, got ${msg.value} nanoTON`);
  }
  const actualBodyHash = msg.body.hash().toString('hex');
  if (actualBodyHash !== expected.bodyHashHex) {
    errors.push(`body hash mismatch: expected ${expected.bodyHashHex}, got ${actualBodyHash}`);
  }

  if (errors.length > 0) {
    const lines = ['ORDER MISMATCH:', ...errors.map((e) => '  - ' + e)];
    throw new Error(lines.join('\n'));
  }
}
