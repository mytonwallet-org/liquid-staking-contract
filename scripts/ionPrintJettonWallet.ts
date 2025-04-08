import { NetworkProvider } from '@ton-community/blueprint';
import {JettonMaster} from "ton";
import {JettonWallet} from "../wrappers/JettonWallet";
import {ION_JETTON} from "./ionConstants";
import {Address} from "ton-core";

export async function run(provider: NetworkProvider) {
  const address = provider.sender().address!;
  const jettonMaster = provider.open(JettonMaster.create(Address.parse(ION_JETTON)))

  const jettonWalletAddress = await jettonMaster.getWalletAddress(address);
  console.log('Jetton wallet:', jettonWalletAddress.toString());

  const jettonWallet = provider.open(JettonWallet.createFromAddress(jettonWalletAddress));
  const jettonData = await jettonWallet.getJettonData();
  console.log('Jetton wallet data:', jettonData);
}
