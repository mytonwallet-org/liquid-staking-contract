import {Address, Cell, toNano, beginCell} from 'ton-core';
import {Pool} from '../wrappers/Pool';
import {PoolState} from "../PoolConstants";
import {JettonMinter as DAOJettonMinter, jettonContentToCell} from '../contracts/jetton_dao/wrappers/JettonMinter';
import {compile, NetworkProvider} from '@ton-community/blueprint';
import {Librarian} from '../wrappers/Librarian';
import {ION_ADMIN, waitForTransaction} from "./utils";

export async function run(provider: NetworkProvider) {
  console.log(provider.api());

  const sender = provider.sender();
  const admin: Address = sender.address!;

  const pool_code = await compile('Pool');
  const controller_code = await compile('Controller');
  const payout_collection = await compile('PayoutNFTCollection');
  const dao_minter_code = await compile('DAOJettonMinter');
  let dao_wallet_code_raw = await compile('DAOJettonWallet');
  const dao_vote_keeper_code = await compile('DAOVoteKeeper');
  const dao_voting_code = await compile('DAOVoting');

  let lib_prep = beginCell().storeUint(2, 8).storeBuffer(dao_wallet_code_raw.hash()).endCell();
  const dao_wallet_code = new Cell({exotic: true, bits: lib_prep.bits, refs: lib_prep.refs});

  const content = jettonContentToCell({
    type: 1,
    uri: "https://raw.githubusercontent.com/catchain/metadata/refs/heads/main/ion/staking/LION.json"
  });

  const minter = DAOJettonMinter.createFromConfig({
      admin,
      content,
      voting_code: dao_voting_code
    },
    dao_minter_code,
  );

  let poolFullConfig = {
    state: PoolState.NORMAL as (0 | 1),
    halted: false, // not halted
    totalBalance: 0n,
    poolJetton: minter.address,
    poolJettonSupply: 0n,

    // empty deposits/withdrawals
    depositMinter: null,
    requestedForDeposit: null,
    withdrawalMinter: null,
    requestedForWithdrawal: null,

    // To set X% APY without compound one need to calc
    // (X/100) * (round_seconds/year_seconds) * (2**24)
    interestRate: 122304, // 0.00729 per round / 2
    optimisticDepositWithdrawals: true,
    depositsOpen: true,

    savedValidatorSetHash: 0n,
    currentRound: {
      borrowers: null,
      roundId: 0,
      activeBorrowers: 0n,
      borrowed: 0n,
      expected: 0n,
      returned: 0n,
      profit: 0n,
    },
    prevRound: {
      borrowers: null,
      roundId: 0,
      activeBorrowers: 0n,
      borrowed: 0n,
      expected: 0n,
      returned: 0n,
      profit: 0n
    },

    minLoanPerValidator: toNano('10000'),
    maxLoanPerValidator: toNano('40000000000'),

    // To set X% put X*(2**24) here
    governanceFee: 1677721, // 10% (0.1)

    sudoer: ION_ADMIN,
    sudoerSetAt: 0,
    governor: ION_ADMIN,
    governorUpdateAfter: 0xffffffffffff,
    interest_manager: ION_ADMIN,
    halter: ION_ADMIN,
    approver: ION_ADMIN,

    controller_code: controller_code,
    pool_jetton_wallet_code: dao_wallet_code,
    payout_minter_code: payout_collection,
    vote_keeper_code: dao_vote_keeper_code,
  };

  // Deployment scheme:
  // 1. Deploy DAO Minter with wallet as admin
  // 2. Deploy Pool with DAO Minter as main jetton minter (all other roles set to wallet)
  // 3. Transfer adminship of DAO Minter to Pool

  const pool = provider.open(Pool.createFromFullConfig(poolFullConfig, pool_code));
  const poolJetton = provider.open(minter);
  await poolJetton.sendDeploy(provider.sender(), toNano("1"));
  await provider.waitForDeploy(poolJetton.address);

  await pool.sendDeploy(provider.sender(), toNano("21"));
  await provider.waitForDeploy(pool.address);

  await poolJetton.sendChangeAdmin(provider.sender(), pool.address, toNano('0.5'));
  await waitForTransaction(provider, poolJetton.address, "transfer adminship of DAO Minter to Pool");
}
