import * as fs from 'fs';
import * as path from 'path';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { Address, Cell, loadMessageRelaxed, toNano } from 'ton-core';
import { Pool } from '../wrappers/Pool';

const POOL = 'EQD2_4d91M4TVbEBVyBF8J1UwpMJc361LKVCz6bBlffMW05o';
const EXPECTED_VALUE = toNano('0.5');
const ORDER_BOC_DEFAULT = 'order.boc';

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
  const poolCode = await compile('Pool');

  const codeHashHex = poolCode.hash().toString('hex');
  const codeHashBase64 = poolCode.hash().toString('base64');

  const body = Pool.upgradeMessage(null, poolCode, null);
  const bodyBoc = body.toBoc().toString('base64');
  const bodyHashHex = body.hash().toString('hex');

  console.log('Pool code hash (hex):    ', codeHashHex);
  console.log('Pool code hash (base64): ', codeHashBase64);
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

// Format produced by the multisig web dApp (https://github.com/ton-blockchain/multisig-dapp):
//   [64 bits: query_id]
//   For each message: [8 bits: send_mode] [^Message] (src = addr_none)
// wallet_id is not part of the saved order — it gets prepended only when the order
// is wrapped into an external message at sign-time.
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
