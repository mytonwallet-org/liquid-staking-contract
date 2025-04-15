import {Address} from 'ton-core';
import {NetworkProvider, sleep} from '@ton-community/blueprint';
import {Controller} from "../wrappers/Controller";
import {toNano} from "ton";

const CONTROLLER_0 = Address.parse('Ef-R7405k6jEMZkZGHpcz1AoUtphc-T4IGEFKSwqagLe3YF4');
const CONTROLLER_1 = Address.parse('Ef8Yu2l-qpYw63SDmwsg63AuO2oQ1D3GzvbMcoZnhY8GH1ot');

export async function run(provider: NetworkProvider) {
  const controller0 = provider.open(Controller.createFromAddress(CONTROLLER_0));
  await controller0.sendApprove(provider.sender(), true, toNano('0.5'));

  await sleep(20000);

  const controller1 = provider.open(Controller.createFromAddress(CONTROLLER_1));
  await controller1.sendApprove(provider.sender(), true, toNano('0.5'));
}
