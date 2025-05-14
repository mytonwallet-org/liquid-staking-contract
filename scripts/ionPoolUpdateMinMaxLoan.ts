import { Pool } from '../wrappers/Pool';
import { NetworkProvider } from '@ton-community/blueprint';
import { ION_POOL } from "./utils";
import { toNano } from "ton";

export async function run(provider: NetworkProvider) {
    const pool = provider.open(Pool.createFromAddress(ION_POOL));
    await pool.sendSetMinMaxLoan(provider.sender(), toNano(10_000), toNano(6_000_000));
}
