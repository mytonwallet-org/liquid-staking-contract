import * as fs from 'fs';
import * as path from 'path';
import { Blockchain, SandboxContract, createShardAccount } from '@ton-community/sandbox';
import { Address, Cell, Dictionary, DictionaryValue, beginCell, toNano } from 'ton-core';
import '@ton-community/test-utils';
import { Pool } from '../wrappers/Pool';
import { compileAfterUpgrade, parseOrder, verifyOrder } from '../wrappers/UpdatePool';
import { Op } from '../PoolConstants';

// Load .env if present (project does not use dotenv).
function loadEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const POOL_ADDRESS = 'EQD2_4d91M4TVbEBVyBF8J1UwpMJc361LKVCz6bBlffMW05o';
const ORDER_BOC_PATH = path.resolve(process.env.ORDER_BOC ?? 'order.boc');
const TON_API_KEY = process.env.TON_API_KEY;

// This suite needs the signed order.boc and a toncenter API key; on a fresh
// clone neither exists yet, so skip (loudly) instead of failing — a red run
// here would be noise, not signal. The pre-sign gate is the blueprint script,
// which DOES hard-fail on missing prerequisites.
const missing = [
  ...(fs.existsSync(ORDER_BOC_PATH) ? [] : [`order.boc (looked at ${ORDER_BOC_PATH})`]),
  ...(TON_API_KEY ? [] : ['TON_API_KEY env var']),
];
if (missing.length > 0) {
  console.warn(`SKIPPING MultisigUpdateMinMaxLoan suite — missing: ${missing.join(', ')}`);
}
const describeIfReady = missing.length > 0 ? describe.skip : describe;

describeIfReady('Multisig v1 upgrade flow (uses production state via toncenter)', () => {
  let bc: Blockchain;
  let pool: SandboxContract<Pool>;
  let multisigAddress: Address;
  let multisigData: Cell;
  let walletId: number;

  beforeAll(async () => {
    bc = await Blockchain.create();
    bc.now = Math.floor(Date.now() / 1000);

    const poolAddress = Address.parse(POOL_ADDRESS);
    await fetchAccount(bc, poolAddress);
    pool = bc.openContract(Pool.createFromAddress(poolAddress));

    const fullData = await pool.getFullData();
    multisigAddress = fullData.sudoer;
    expect(multisigAddress).toBeDefined();

    await fetchAccount(bc, multisigAddress);
    multisigData = await getContractData(bc, multisigAddress);

    const multisigCode = await getContractCode(bc, multisigAddress);
    console.log('Multisig address:        ', multisigAddress.toString());
    console.log('Multisig code hash (hex):', multisigCode.hash().toString('hex'));
    console.log('Multisig data size:      ', `${multisigData.bits.length}b, refs=${multisigData.refs.length}`);

    // multisig v1 data layout: [32:wallet_id][8:n][8:k][64:last_cleaned][dict:owners][dict:queries]
    const ds = multisigData.beginParse();
    walletId = ds.loadUint(32);
    const n = ds.loadUint(8);
    const k = ds.loadUint(8);
    const lastCleaned = ds.loadUintBig(64);
    console.log(`Multisig state: walletId=${walletId} n=${n} k=${k} lastCleaned=${lastCleaned}`);
  }, 60_000);

  it('order.boc carries the expected after_upgrade(7777) call', async () => {
    const afterUpgrade = await compileAfterUpgrade();
    const expectedBody = Pool.upgradeMessage(null, null, afterUpgrade);
    const order = parseOrder(fs.readFileSync(ORDER_BOC_PATH));
    verifyOrder(order, {
      pool: Address.parse(POOL_ADDRESS),
      value: toNano('0.5'),
      bodyHashHex: expectedBody.hash().toString('hex'),
      sendMode: 3, // multisig-dapp builds order messages with mode 3
    });
  });

  it('Signing the order through multisig updates min/max loan on the pool', async () => {
    // Replace multisig data with a permissive single-key config so we can
    // produce a valid root signature with a key we own. n=1, k=1, owner 0 →
    // a single root signature is enough to reach quorum and dispatch actions.
    // last_cleaned=1 keeps us out of the try_init path (which fires only on
    // empty external messages anyway).
    const owners = Dictionary.empty(Dictionary.Keys.Uint(8), OwnerInfoValue());
    owners.set(0, { pubkey: 0n, flood: 0 });
    const newData = packMultisigData({
      walletId,
      n: 1,
      k: 1,
      lastCleaned: 1n,
      owners,
      pendingQueries: Dictionary.empty(Dictionary.Keys.Uint(64), Dictionary.Values.Cell()),
    });

    const code = await getContractCode(bc, multisigAddress);
    await bc.setShardAccount(multisigAddress, createShardAccount({
      address: multisigAddress, balance: toNano('5'), code, data: newData,
    }));

    const orderCell = Cell.fromBoc(fs.readFileSync(ORDER_BOC_PATH))[0];
    const queryId = orderCell.beginParse().loadUintBig(64);
    const expireUnix = Number(queryId >> 32n);
    bc.now = expireUnix - 3600;

    // Build the externally signed payload exactly like multisig-dapp does
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
    const res = await bc.sendMessage({
      info: { type: 'external-in', src: undefined, dest: multisigAddress, importFee: 0n },
      body: signedBody,
    }, { ignoreChksig: true });

    expect(res.transactions).toHaveTransaction({ on: multisigAddress, aborted: false });
    expect(res.transactions).toHaveTransaction({
      on: pool.address,
      from: multisigAddress,
      op: Op.sudo.upgrade,
      aborted: false,
    });

    const dataAfter = await pool.getFullData();
    expect(dataAfter.minLoan).not.toEqual(dataBefore.minLoan);
    expect(dataAfter.maxLoan).not.toEqual(dataBefore.maxLoan);
    expect(dataAfter.minLoan).toEqual(toNano('300000'));
    expect(dataAfter.maxLoan).toEqual(toNano('3000000'));

    // Everything else must remain untouched — the forward-parse rewrite is
    // supposed to swap only the two loan_params coins.
    expectSameExcept(dataBefore, dataAfter, ['minLoan', 'maxLoan']);
  });
});

type OwnerInfo = { pubkey: bigint; flood: number };

function OwnerInfoValue(): DictionaryValue<OwnerInfo> {
  return {
    parse: (src) => ({ pubkey: src.loadUintBig(256), flood: src.loadUint(8) }),
    serialize: (v, b) => { b.storeUint(v.pubkey, 256).storeUint(v.flood, 8); },
  };
}

function packMultisigData(opts: {
  walletId: number; n: number; k: number; lastCleaned: bigint;
  owners: Dictionary<number, OwnerInfo>;
  pendingQueries: Dictionary<number, Cell>;
}): Cell {
  return beginCell()
    .storeUint(opts.walletId, 32)
    .storeUint(opts.n, 8)
    .storeUint(opts.k, 8)
    .storeUint(opts.lastCleaned, 64)
    .storeDict(opts.owners)
    .storeDict(opts.pendingQueries)
    .endCell();
}

// Deep equality for getFullData() snapshots, excluding the specified top-level
// keys. Cells use hash-based equality; Addresses use .equals; bigints use
// strict ===; nested objects/arrays recurse.
function expectSameExcept<T extends Record<string, any>>(a: T, b: T, ignored: (keyof T)[]) {
  const ignore = new Set(ignored);
  for (const k of Object.keys(a) as (keyof T)[]) {
    if (ignore.has(k)) continue;
    expect({ key: k, value: serializeForCompare((b as any)[k]) }).toEqual({
      key: k,
      value: serializeForCompare((a as any)[k]),
    });
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

// ───── helpers ─────────────────────────────────────────────────────────────

type AccountStateV3 = {
  address: string;
  status: string;
  balance: string;
  code_boc: string;
  data_boc: string;
};

async function fetchAccount(bc: Blockchain, addr: Address): Promise<void> {
  const url = new URL('https://toncenter.com/api/v3/accountStates');
  url.searchParams.append('address', addr.toRawString());
  url.searchParams.append('include_boc', 'true');

  const res = await fetch(url, { headers: { accept: 'application/json', 'X-API-Key': TON_API_KEY! } });
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

