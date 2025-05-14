import {Cell, fromNano} from 'ton-core';
import { Pool } from '../wrappers/Pool';
import { NetworkProvider } from '@ton-community/blueprint';
import {ION_POOL} from "./utils";
import {Address, toNano, TonClient4} from "ton";

export async function run(provider: NetworkProvider) {
  const pool = provider.open(Pool.createFromAddress(ION_POOL));
  const fullData = await pool.getFullData();

  printPoolFullData(fullData);

  const api = provider.api();
  const { last: { seqno }} = await api.getLastBlock();
  const electorBalance = await getBalance(api, seqno, Address.parse('Ef8zMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM0vF'));
  const poolBalance = await getBalance(api, seqno, ION_POOL);
  const totalStaked = Number(fromNano(electorBalance + poolBalance));
  const balanceWithoutStake = fromNano(
    poolBalance
    - (fullData.totalBalance
    - (fullData.currentRound.returned ? 0n : fullData.currentRound.borrowed)
    - (fullData.previousRound.returned ? 0n : fullData.previousRound.borrowed))
  );

  const poolTvl = Number(fromNano(fullData.totalBalance));

  const supply = 21760619671;
  const strangeMultiplier = 1; // TODO
  const price = 0.0065;

  const profitYear = supply * 0.06 * strangeMultiplier;
  const apyShare = profitYear / totalStaked * 100;
  const apyFull = round(apyShare, 2);
  const apyUser = round(apyShare * 0.45, 2);

  const poolShareOfTvl = poolTvl / totalStaked;
  const profitStakeeYear = poolShareOfTvl * profitYear * 0.05;
  const profitStakeeRound = profitStakeeYear / 481.2;

  const profitYearMyUsd = profitStakeeYear * 0.5 * price;
  const profitMonthMyUsd = profitYearMyUsd / 12;

  console.log({
    balanceWithoutStake,
    supply,
    apyFull,
    apyUser,
    poolTvl,
    poolShareOfTvl,
    profitStakeeYear,
    profitStakeeRound,
    profitYearMyUsd,
    profitMonthMyUsd,
  });
}

async function getBalance(api: TonClient4, seqno: number, address: Address) {
  const state = await api.getAccount(seqno, address);
  return BigInt(state.account.balance.coins);
}

export function round(num: number, decimals: number = 0) {
  return Math.round(num * 10 ** decimals) / 10 ** decimals;
}

export function printPoolFullData(data: any) {
  const newData = Object.entries(data).reduce((res, [key, value]) => {
    if (value instanceof Cell) {
      res[key] = `cell:${value.hash().toString('hex')}`;
    } else if (value instanceof Address) {
      res[key] = `${value.toString({ bounceable: true, urlSafe: true })}`;
    } else if (typeof value === 'object') {
      res[key] = { ...value };

      if (res[key]?.borrowers) {
        res[key].borrowers = `cell:${res[key].borrowers.hash().toString('hex')}`;
      }
    } else {
      res[key] = value;
    }
    return res;
  }, {} as any);

  console.log(newData);
}
