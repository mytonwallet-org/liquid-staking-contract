import { Pool } from '../wrappers/Pool';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { ION_POOL } from "./utils";

export async function run(provider: NetworkProvider) {
  const pool_code = await compile('Pool');
  const pool = provider.open(Pool.createFromAddress(ION_POOL));
  await pool.sendUpgrade(provider.sender(), { code: pool_code });
}
