import * as fs from 'fs';
import * as path from 'path';
import { Blockchain, SandboxContract, createShardAccount } from '@ton-community/sandbox';
import { Address, Cell, Dictionary, DictionaryValue, beginCell, loadMessageRelaxed, toNano } from 'ton-core';
import { compile } from '@ton-community/blueprint';
import '@ton-community/test-utils';
import { Pool } from '../wrappers/Pool';
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

const describeOrSkip = TON_API_KEY ? describe : describe.skip;

describeOrSkip('Multisig v1 upgrade flow (uses production state via toncenter)', () => {
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
    const order = readOrder();
    expect(order.messages).toHaveLength(1);

    const msg = order.messages[0];
    expect(msg.destination.equals(Address.parse(POOL_ADDRESS))).toBe(true);
    expect(msg.value).toEqual(toNano('0.5'));

    const body = msg.body.beginParse();
    expect(body.loadUint(32)).toEqual(Op.sudo.upgrade);
    body.loadUintBig(64); // query_id
    expect(body.loadBit()).toBe(false); // no data
    expect(body.loadBit()).toBe(false); // no code
    expect(body.loadBit()).toBe(true);  // has afterUpgrade

    const afterUpgrade = body.loadRef();
    const expectedAfter = await buildExpectedAfterUpgrade();
    expect(afterUpgrade.hash().toString('hex')).toEqual(expectedAfter.hash().toString('hex'));
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

    const balance = await getContractBalance(bc, multisigAddress);
    const code = await getContractCode(bc, multisigAddress);
    await bc.setShardAccount(multisigAddress, createShardAccount({
      address: multisigAddress, balance, code, data: newData,
    }));

    // queryId top 32 bits encode the expire timestamp; align bc.now so the
    // multisig accepts the query as live (throw_if 33 guards expiration).
    const order = readOrder();
    const expireUnix = Number(order.queryId >> 32n);
    bc.now = Math.min(bc.now ?? expireUnix - 60, expireUnix - 60);

    // Build the externally signed payload exactly like multisig-dapp does:
    //   inner  = [8: owner_id=0] [1: 0 = no extra sigs dict] [32: wallet_id] [order...]
    //   signed = [512: signature] [inner...]
    // Signature is a 64-byte zero buffer — ignoreChksig=true makes the
    // contract accept it.
    const orderCell = Cell.fromBoc(fs.readFileSync(ORDER_BOC_PATH))[0];
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

async function getContractBalance(bc: Blockchain, addr: Address): Promise<bigint> {
  return (await bc.getContract(addr)).balance;
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

type ParsedOrder = {
  queryId: bigint;
  messages: { sendMode: number; destination: Address; value: bigint; body: Cell }[];
};

function readOrder(): ParsedOrder {
  const root = Cell.fromBoc(fs.readFileSync(ORDER_BOC_PATH))[0];
  const s = root.beginParse();
  const queryId = s.loadUintBig(64);
  const messages: ParsedOrder['messages'] = [];
  while (s.remainingRefs > 0) {
    const sendMode = s.loadUint(8);
    const msg = loadMessageRelaxed(s.loadRef().beginParse());
    if (msg.info.type !== 'internal') throw new Error(`Non-internal msg in order: ${msg.info.type}`);
    messages.push({
      sendMode,
      destination: msg.info.dest,
      value: msg.info.value.coins,
      body: msg.body,
    });
  }
  return { queryId, messages };
}

async function buildExpectedAfterUpgrade(): Promise<Cell> {
  const code = await compile('UpdatePool');
  const seg: DictionaryValue<Cell> = {
    parse: (src) => beginCell().storeSlice(src).endCell(),
    serialize: (src, b) => { b.storeSlice(src.asSlice()); },
  };
  const methods = Dictionary.loadDirect(Dictionary.Keys.Uint(19), seg, code.refs[0]);
  const after = methods.get(7777);
  if (!after) throw new Error('after_upgrade(7777) not found in UpdatePool');
  return after;
}
