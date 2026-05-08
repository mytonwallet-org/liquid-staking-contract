import { NetworkProvider } from '@ton-community/blueprint';
import { Address } from 'ton';
import { Pool } from '../wrappers/Pool';

const POOL = 'EQD2_4d91M4TVbEBVyBF8J1UwpMJc361LKVCz6bBlffMW05o';

export async function run(provider: NetworkProvider) {
  const pool = provider.open(Pool.createFromAddress(Address.parse(POOL)));
  await pool.sendSetMinMaxLoan(provider.sender(), 800_000n, 1_000_000n);
}
