import * as fs from 'fs';
import * as path from 'path';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { Address, Cell, Dictionary, DictionaryValue, beginCell, loadMessageRelaxed, toNano } from 'ton-core';
import { Pool } from '../wrappers/Pool';

const POOL = 'EQD2_4d91M4TVbEBVyBF8J1UwpMJc361LKVCz6bBlffMW05o';
const EXPECTED_VALUE = toNano('0.5');
const ORDER_BOC_DEFAULT = 'order.boc';
const AFTER_UPGRADE_METHOD_ID = 7777;

type ParsedOrderMessage = {
  sendMode: number;
  destination: Address;
  value: bigint;
  body: Cell;
};

type ParsedOrder = {
  queryId: bigint;
  messages: ParsedOrderMessage[];
};

export async function run(_provider: NetworkProvider) {
  const updateCode = await compile('UpdatePool');
  const afterUpgrade = extractMethod(updateCode, AFTER_UPGRADE_METHOD_ID);

  const body = Pool.upgradeMessage(null, null, afterUpgrade);
  const bodyBoc = body.toBoc().toString('base64');
  const bodyHashHex = body.hash().toString('hex');

  console.log('Pool:                    ', POOL);
  console.log('Value (nanoTON):         ', EXPECTED_VALUE.toString());
  console.log('UpdatePool code hash:    ', updateCode.hash().toString('hex'));
  console.log(`after_upgrade(${AFTER_UPGRADE_METHOD_ID}) hash:  `, afterUpgrade.hash().toString('hex'));
  console.log('Upgrade body hash (hex): ', bodyHashHex);
  console.log('Upgrade body BOC (base64):');
  console.log(bodyBoc);

  const orderPath = path.resolve(process.env.ORDER_BOC ?? ORDER_BOC_DEFAULT);
  if (fs.existsSync(orderPath)) {
    console.log(`\nFound order file: ${orderPath}`);
    const orderBoc = fs.readFileSync(orderPath);
    const order = parseOrder(orderBoc);
    verifyOrder(order, {
      pool: Address.parse(POOL),
      value: EXPECTED_VALUE,
      bodyHashHex,
    });
  } else {
    console.log(`\nNo order.boc found at ${orderPath} — skipping verification (set ORDER_BOC to override path).`);
  }
}

function extractMethod(code: Cell, methodId: number): Cell {
  const codeSegment: DictionaryValue<Cell> = {
    parse: (src) => beginCell().storeSlice(src).endCell(),
    serialize: (src, builder) => { builder.storeSlice(src.asSlice()); },
  };
  const methods = Dictionary.loadDirect(Dictionary.Keys.Uint(19), codeSegment, code.refs[0]);
  const cell = methods.get(methodId);
  if (!cell) {
    throw new Error(`Method ${methodId} not found in compiled code`);
  }
  return cell;
}

function parseOrder(boc: Buffer): ParsedOrder {
  const root = Cell.fromBoc(boc)[0];
  const slice = root.beginParse();

  const queryId = slice.loadUintBig(64);

  const messages: ParsedOrderMessage[] = [];
  while (slice.remainingRefs > 0) {
    const sendMode = slice.loadUint(8);
    const msgSlice = slice.loadRef().beginParse();
    const msg = loadMessageRelaxed(msgSlice);
    if (msg.info.type !== 'internal') {
      throw new Error(`Unexpected message info type: ${msg.info.type}`);
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

function verifyOrder(order: ParsedOrder, expected: { pool: Address; value: bigint; bodyHashHex: string }): void {
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

  const expireUnix = Number(order.queryId >> 32n);

  console.log('---');
  console.log('Order verification:');
  console.log('  query_id:            ', order.queryId.toString());
  console.log('  expires at:          ', new Date(expireUnix * 1000).toISOString());
  console.log('  send_mode:           ', msg.sendMode);
  console.log('  destination:         ', msg.destination.toString());
  console.log('  value (nanoTON):     ', msg.value.toString());
  console.log('  body hash (hex):     ', actualBodyHash);

  if (errors.length > 0) {
    console.error('\nORDER MISMATCH:');
    for (const e of errors) console.error('  - ' + e);
    throw new Error('Order does not match expected upgrade parameters');
  }

  console.log('  status:              OK (matches expected upgrade body, pool, value)');
}
