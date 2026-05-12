import * as fs from 'fs';
import * as path from 'path';
import { NetworkProvider } from '@ton-community/blueprint';
import { Address, toNano } from 'ton-core';
import { Pool } from '../wrappers/Pool';
import { AFTER_UPGRADE_METHOD_ID, compileAfterUpgrade, parseOrder, verifyOrder } from '../wrappers/UpdatePool';

const POOL = 'EQD2_4d91M4TVbEBVyBF8J1UwpMJc361LKVCz6bBlffMW05o';
const EXPECTED_VALUE = toNano('0.5');
const ORDER_BOC_DEFAULT = 'order.boc';

export async function run(_provider: NetworkProvider) {
  const afterUpgrade = await compileAfterUpgrade();

  const body = Pool.upgradeMessage(null, null, afterUpgrade);
  const bodyBoc = body.toBoc().toString('base64');
  const bodyHashHex = body.hash().toString('hex');

  console.log('Pool:                    ', POOL);
  console.log('Value (nanoTON):         ', EXPECTED_VALUE.toString());
  console.log(`after_upgrade(${AFTER_UPGRADE_METHOD_ID}) hash:  `, afterUpgrade.hash().toString('hex'));
  console.log('Upgrade body hash (hex): ', bodyHashHex);
  console.log('Upgrade body BOC (base64):');
  console.log(bodyBoc);

  const orderPath = path.resolve(process.env.ORDER_BOC ?? ORDER_BOC_DEFAULT);
  if (!fs.existsSync(orderPath)) {
    console.log(`\nNo order.boc found at ${orderPath} — skipping verification (set ORDER_BOC to override path).`);
    return;
  }

  console.log(`\nFound order file: ${orderPath}`);
  const order = parseOrder(fs.readFileSync(orderPath));
  verifyOrder(order, { pool: Address.parse(POOL), value: EXPECTED_VALUE, bodyHashHex });

  const msg = order.messages[0];
  const expireUnix = Number(order.queryId >> 32n);
  console.log('---');
  console.log('Order verification:');
  console.log('  query_id:            ', order.queryId.toString());
  console.log('  expires at:          ', new Date(expireUnix * 1000).toISOString());
  console.log('  send_mode:           ', msg.sendMode);
  console.log('  destination:         ', msg.destination.toString());
  console.log('  value (nanoTON):     ', msg.value.toString());
  console.log('  body hash (hex):     ', msg.body.hash().toString('hex'));
  console.log('  status:              OK (matches expected upgrade body, pool, value)');
}
