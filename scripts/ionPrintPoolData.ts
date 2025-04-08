import { Cell } from 'ton-core';
import { Pool } from '../wrappers/Pool';
import { NetworkProvider } from '@ton-community/blueprint';
import {ION_POOL} from "./utils";

export async function run(provider: NetworkProvider) {
    const pool = provider.open(Pool.createFromAddress(ION_POOL));
    const fullData = await pool.getFullData();

    printData(fullData);
}

export function printData(data: any) {
  const newData = Object.entries(data).reduce((res, [key, value]) => {
    res[key] = value instanceof Cell ? '[Cell]' : value;
    return res;
  }, {} as any);

  console.log(newData);
}
