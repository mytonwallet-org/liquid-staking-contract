import {dataToFullConfig, Pool, poolFullConfigToCell} from '../wrappers/Pool';
import {compile, NetworkProvider} from '@ton-community/blueprint';
import {ION_POOL} from "./utils";
import {printPoolFullData} from "./ionPoolPrintData";

export async function run(provider: NetworkProvider) {
  const payout_collection = await compile('PayoutNFTCollection');
  const pool = provider.open(Pool.createFromAddress(ION_POOL));

  const fullData = await pool.getFullDataRaw();
  const newPoolConfig = dataToFullConfig(fullData);

  printPoolFullData(fullData);

  newPoolConfig.payout_minter_code = payout_collection;

  const data = poolFullConfigToCell(newPoolConfig);
  await pool.sendUpgrade(provider.sender(), { data });
}
