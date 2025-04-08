import {compile, NetworkProvider} from '@ton-community/blueprint';
import {Librarian} from '../wrappers/Librarian';
import {ION_LIBRARIAN, waitForTransaction} from "./utils";
import {toNano} from "ton";

export async function run(provider: NetworkProvider) {
  let dao_wallet_code_raw = await compile('DAOJettonWallet');

  // const librarian_code = await compile('Librarian');
  // const librarian = provider.open(
  //   Librarian.createFromConfig({ librarianId: 0n }, librarian_code),
  // );
  // await librarian.sendDeploy(provider.sender(), toNano("5"));

  const librarian = provider.open(Librarian.createFromAddress(ION_LIBRARIAN));
  console.log("Librarian address:", librarian.address);

  await librarian.sendAddLibrary(provider.sender(), dao_wallet_code_raw, toNano('1000'));
  await waitForTransaction(provider, librarian.address, "Librarian deploy");
}
