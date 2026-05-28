import * as fs from 'fs';
import * as path from 'path';
import { NetworkProvider } from '@ton-community/blueprint';
import { Blockchain, createShardAccount } from '@ton-community/sandbox';
import { Address, Cell, Dictionary, DictionaryValue, beginCell, fromNano, toNano } from 'ton-core';
import { Pool } from '../wrappers/Pool';
import { AFTER_UPGRADE_METHOD_ID, compileAfterUpgrade, parseOrder, verifyOrder } from '../wrappers/UpdatePool';
import { Op } from '../PoolConstants';

const POOL = 'EQD2_4d91M4TVbEBVyBF8J1UwpMJc361LKVCz6bBlffMW05o';
const EXPECTED_VALUE = toNano('0.5');
const ORDER_BOC_DEFAULT = 'order.boc';

export async function run(_provider: NetworkProvider) {
  const afterUpgrade = await compileAfterUpgrade();

  const body = Pool.upgradeMessage(null, null, afterUpgrade);
  const bodyBoc = body.toBoc().toString('base64');
  const bodyHashHex = body.hash().toString('hex');

  console.log('Destination:             ', POOL);
  console.log('Value (TON):             ', fromNano(EXPECTED_VALUE));
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
  console.log('  value (TON):         ', fromNano(msg.value));
  console.log('  body hash (hex):     ', msg.body.hash().toString('hex'));
  console.log('  status:              OK (matches expected upgrade body, pool, value)');

  await simulate(orderPath);
}

// Replay the signed order against live pool + multisig state in sandbox to
// confirm the BoC produces the intended upgrade and doesn't break the pool.
async function simulate(orderPath: string) {
  const apiKey = process.env.TON_API_KEY;
  if (!apiKey) {
    console.log('\nNo TON_API_KEY in env — skipping emulation. Set TON_API_KEY to enable.');
    return;
  }

  console.log('\n---\nEmulation against production state:');

  const bc = await Blockchain.create();
  bc.now = Math.floor(Date.now() / 1000);

  const poolAddress = Address.parse(POOL);
  await fetchAccount(bc, poolAddress, apiKey);
  const pool = bc.openContract(Pool.createFromAddress(poolAddress));

  const fullData = await pool.getFullData();
  const multisigAddress = fullData.sudoer;
  await fetchAccount(bc, multisigAddress, apiKey);
  const multisigData = await getContractData(bc, multisigAddress);
  const multisigCode = await getContractCode(bc, multisigAddress);

  console.log('  Multisig address:    ', multisigAddress.toString());

  // multisig v1 data: [32:wallet_id][8:n][8:k][64:last_cleaned][dict:owners][dict:queries]
  const walletId = multisigData.beginParse().loadUint(32);

  // Swap multisig data for a permissive single-key config so we can reach
  // quorum without a real signature (ignoreChksig handles the signature).
  // n=1, k=1, one owner, last_cleaned=1 to bypass try_init.
  const owners = Dictionary.empty(Dictionary.Keys.Uint(8), OwnerInfoValue());
  owners.set(0, { pubkey: 0n, flood: 0 });
  const newData = beginCell()
    .storeUint(walletId, 32)
    .storeUint(1, 8)
    .storeUint(1, 8)
    .storeUint(1n, 64)
    .storeDict(owners)
    .storeDict(Dictionary.empty(Dictionary.Keys.Uint(64), Dictionary.Values.Cell()))
    .endCell();

  await bc.setShardAccount(multisigAddress, createShardAccount({
    address: multisigAddress, balance: toNano('5'), code: multisigCode, data: newData,
  }));

  const orderCell = Cell.fromBoc(fs.readFileSync(orderPath))[0];
  const queryId = orderCell.beginParse().loadUintBig(64);
  const expireUnix = Number(queryId >> 32n);
  bc.now = expireUnix - 3600;

  // Build the externally signed payload (multisig-dapp format):
  //   [64:zero-sig][8:owner_idx=0][1:root=false][32:wallet_id][slice:order]
  const inner = beginCell()
    .storeUint(0, 8)
    .storeBit(false)
    .storeUint(walletId, 32)
    .storeSlice(orderCell.beginParse())
    .endCell();
  const signedBody = beginCell()
    .storeBuffer(Buffer.alloc(64))
    .storeSlice(inner.beginParse())
    .endCell();

  const dataBefore = await pool.getFullData();
  const dataCellBefore = await getContractData(bc, poolAddress);
  const balanceBefore = (await bc.getContract(poolAddress)).balance;
  const res = await bc.sendMessage({
    info: { type: 'external-in', src: undefined, dest: multisigAddress, importFee: 0n },
    body: signedBody,
  }, { ignoreChksig: true });

  const multisigTx = res.transactions.find((t) => t.inMessage?.info.dest?.toString() === multisigAddress.toString());
  if (!multisigTx || multisigTx.description.type !== 'generic' || multisigTx.description.aborted) {
    throw new Error('Multisig external message aborted or missing');
  }

  const upgradeTx = res.transactions.find((t) =>
    t.inMessage?.info.dest?.toString() === poolAddress.toString() &&
    t.inMessage.info.type === 'internal'
  );
  if (!upgradeTx || upgradeTx.description.type !== 'generic' || upgradeTx.description.aborted) {
    throw new Error('Pool upgrade transaction aborted or missing');
  }
  const inOp = upgradeTx.inMessage!.body.beginParse().loadUint(32);
  if (inOp !== Op.sudo.upgrade) {
    throw new Error(`Pool received op=${inOp}, expected sudo.upgrade=${Op.sudo.upgrade}`);
  }

  // The pool must not emit any outgoing messages while processing the upgrade.
  const poolOutMsgs = res.transactions
    .filter((t) => t.inMessage?.info.dest?.toString() === poolAddress.toString())
    .flatMap((t) => t.outMessages.values());
  if (poolOutMsgs.length > 0) {
    const dests = poolOutMsgs.map((m) => m.info.dest?.toString() ?? '?').join(', ');
    throw new Error(`Pool emitted ${poolOutMsgs.length} outgoing message(s): ${dests}`);
  }

  // The upgrade must not drain the pool: its balance must not decrease.
  const balanceAfter = (await bc.getContract(poolAddress)).balance;
  if (balanceAfter < balanceBefore) {
    throw new Error(`Pool balance decreased: ${fromNano(balanceBefore)} → ${fromNano(balanceAfter)} TON`);
  }

  const dataAfter = await pool.getFullData();

  console.log('  Pool min loan:        ', `${fromNano(dataBefore.minLoan)} → ${fromNano(dataAfter.minLoan)} TON`);
  console.log('  Pool max loan:        ', `${fromNano(dataBefore.maxLoan)} → ${fromNano(dataAfter.maxLoan)} TON`);
  console.log('  Pool balance (TON):   ', `${fromNano(balanceBefore)} → ${fromNano(balanceAfter)} (no decrease)`);
  console.log('  Outgoing from pool:    none');

  const expectedMin = toNano('300000');
  const expectedMax = toNano('3000000');
  if (dataAfter.minLoan !== expectedMin) {
    throw new Error(`minLoan = ${fromNano(dataAfter.minLoan)} TON, expected ${fromNano(expectedMin)} TON`);
  }
  if (dataAfter.maxLoan !== expectedMax) {
    throw new Error(`maxLoan = ${fromNano(dataAfter.maxLoan)} TON, expected ${fromNano(expectedMax)} TON`);
  }

  assertSameExcept(dataBefore, dataAfter, ['minLoan', 'maxLoan']);
  console.log('  Other fields:         unchanged');

  // Rebuild the data cell with only the two loan_params replaced; a hash match proves nothing else changed.
  const dataCellAfter = await getContractData(bc, poolAddress);
  const expectedCell = rebuildPoolDataWithLoans(dataCellBefore, expectedMin, expectedMax);
  const expectedHash = expectedCell.hash().toString('hex');
  const actualHash = dataCellAfter.hash().toString('hex');
  if (expectedHash !== actualHash) {
    throw new Error(`Data cell hash mismatch:\n  expected: ${expectedHash}\n  actual:   ${actualHash}`);
  }
  console.log('  Data cell hash:        matches expected (only min/max loan replaced)');
  console.log('  Emulation:            OK');
}

// Parse the pre-upgrade data cell exactly as after_upgrade does and re-serialize with only min/max loan replaced.
function rebuildPoolDataWithLoans(before: Cell, newMin: bigint, newMax: bigint): Cell {
  const ds = before.beginParse();
  const state = ds.loadUint(8);
  const halted = ds.loadBoolean();
  const totalBalance = ds.loadCoins();
  const mintersRef = ds.loadRef();
  const interestRate = ds.loadUint(24);    // load_share
  const optimisticDw = ds.loadBoolean();
  const depositsOpen = ds.loadBoolean();
  const validatorSetHash = ds.loadUintBig(256);
  const roundDataRef = ds.loadRef();
  ds.loadCoins();                          // skip old min_loan
  ds.loadCoins();                          // skip old max_loan
  // `ds` now holds the untouched tail (governance_fee, roles, codes).

  return beginCell()
    .storeUint(state, 8)
    .storeBit(halted)
    .storeCoins(totalBalance)
    .storeRef(mintersRef)
    .storeUint(interestRate, 24)
    .storeBit(optimisticDw)
    .storeBit(depositsOpen)
    .storeUint(validatorSetHash, 256)
    .storeRef(roundDataRef)
    .storeCoins(newMin)
    .storeCoins(newMax)
    .storeSlice(ds)
    .endCell();
}

// ───── helpers ─────────────────────────────────────────────────────────────

type AccountStateV3 = {
  address: string;
  status: string;
  balance: string;
  code_boc: string;
  data_boc: string;
};

async function fetchAccount(bc: Blockchain, addr: Address, apiKey: string): Promise<void> {
  const url = new URL('https://toncenter.com/api/v3/accountStates');
  url.searchParams.append('address', addr.toRawString());
  url.searchParams.append('include_boc', 'true');

  const res = await fetch(url, { headers: { accept: 'application/json', 'X-API-Key': apiKey } });
  if (!res.ok) throw new Error(`toncenter ${res.status}: ${await res.text()}`);
  const body = await res.json() as { accounts: AccountStateV3[] };
  const acc = body.accounts.find((a) => Address.parse(a.address).equals(addr));
  if (!acc || acc.status !== 'active') throw new Error(`Account ${addr.toString()} is not active`);

  await bc.setShardAccount(addr, createShardAccount({
    address: addr,
    balance: BigInt(acc.balance),
    code: Cell.fromBase64(acc.code_boc),
    data: Cell.fromBase64(acc.data_boc),
  }));
}

async function getContractData(bc: Blockchain, addr: Address): Promise<Cell> {
  const smc = await bc.getContract(addr);
  if (smc.account.account?.storage.state.type !== 'active' || !smc.account.account.storage.state.state.data) {
    throw new Error(`No data for ${addr}`);
  }
  return smc.account.account.storage.state.state.data;
}

async function getContractCode(bc: Blockchain, addr: Address): Promise<Cell> {
  const smc = await bc.getContract(addr);
  if (smc.account.account?.storage.state.type !== 'active' || !smc.account.account.storage.state.state.code) {
    throw new Error(`No code for ${addr}`);
  }
  return smc.account.account.storage.state.state.code;
}

type OwnerInfo = { pubkey: bigint; flood: number };

function OwnerInfoValue(): DictionaryValue<OwnerInfo> {
  return {
    parse: (src) => ({ pubkey: src.loadUintBig(256), flood: src.loadUint(8) }),
    serialize: (v, b) => { b.storeUint(v.pubkey, 256).storeUint(v.flood, 8); },
  };
}

function assertSameExcept<T extends Record<string, any>>(a: T, b: T, ignored: (keyof T)[]) {
  const ignore = new Set(ignored);
  for (const k of Object.keys(a) as (keyof T)[]) {
    if (ignore.has(k)) continue;
    const av = serializeForCompare(a[k]);
    const bv = serializeForCompare(b[k]);
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      throw new Error(`Field "${String(k)}" changed unexpectedly:\n  before: ${JSON.stringify(av)}\n  after:  ${JSON.stringify(bv)}`);
    }
  }
}

function serializeForCompare(v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v === 'bigint') return v.toString() + 'n';
  if (v instanceof Cell) return 'Cell:' + v.hash().toString('hex');
  if (v instanceof Address) return 'Addr:' + v.toRawString();
  if (Array.isArray(v)) return v.map(serializeForCompare);
  if (typeof v === 'object') {
    const out: any = {};
    for (const k of Object.keys(v)) out[k] = serializeForCompare(v[k]);
    return out;
  }
  return v;
}
