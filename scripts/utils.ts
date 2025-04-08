import { NetworkProvider, sleep } from "@ton-community/blueprint";
import { Address } from "ton-core";

export const ION_JETTON = Address.parse('EQACbwI38RnvclU5Wv6H9zDr8Ao_tq9NWilXxBmoE8yroZlF');
export const ION_POOL = Address.parse('EQAYI9vwZ3K5y9n_9-E8F_e3JzMzNNyEib0ddBlfAWOOsh_c');
export const ION_ADMIN = Address.parse('UQBUJEQkLZJZvCzOv7cG0WAp4616wR-BckVVs6eeu7r86jYI');
export const ION_LIBRARIAN = Address.parse('Ef9ymVquxBIMq3rheG_AzE4WQ7bUGQptF151_yJoEwVyJPZi');

export const waitForTransaction = async (
  provider: NetworkProvider,
  address: Address,
  action: string = "transaction",
  curTxLt: string | null = null,
  maxRetry: number = 15,
  interval: number=1000
) => {
  let done  = false;
  let count = 0;
  const ui  = provider.ui();
  let blockNum = (await provider.api().getLastBlock()).last.seqno;
  if(curTxLt == null) {
    let initialState = await provider.api().getAccount(blockNum, address);
    let lt = initialState?.account?.last?.lt;
    curTxLt = lt ? lt : null;
  }
  do {
    ui.write(`Awaiting ${action} completion (${++count}/${maxRetry})`);
    await sleep(interval);
    let newBlockNum = (await provider.api().getLastBlock()).last.seqno;
    if (blockNum == newBlockNum) {
      continue;
    }
    blockNum = newBlockNum;
    const curState = await provider.api().getAccount(blockNum, address);
    if(curState?.account?.last !== null){
      done = curState?.account?.last?.lt !== curTxLt;
    }
  } while(!done && count < maxRetry);
  return done;
}
