import { Pool } from '../wrappers/Pool';
import { NetworkProvider } from '@ton-community/blueprint';
import {ION_POOL} from "./utils";

export async function run(provider: NetworkProvider) {
    const pool = provider.open(Pool.createFromAddress(ION_POOL));
    await pool.sendSetGovernanceFee(provider.sender(), 1524210);
}
