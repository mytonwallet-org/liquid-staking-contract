import { NetworkProvider } from '@ton-community/blueprint';
import {Address} from "ton";
import {PayoutCollection} from "../wrappers/PayoutNFTCollection";
import {fromNano} from "ton-core";
import {PayoutItem} from "../wrappers/PayoutNFTItem";

export async function run(provider: NetworkProvider) {
  const stakers: any[] = [];
  let total: number = 0;

  for (const address of [
    'EQBGnMsIOr17Mu-pok0pOubQe744jZY6_NhALrHw59NF3f8H',
    'EQBC5_iFAARuO0emp1gWx_JU-NDWYa-Wsgaowi3m5t0kSFza',
    'EQDGpVU-t5oiyBreEdiSXhxAh6t0_PuSPKxmvaCsx31R1J0E',
  ]) {
    const collection = provider.open(PayoutCollection.createFromAddress(Address.parse(address)));
    const data = await collection.getDistribution();
    const totalBill = await collection.getTotalBill();
    const rate = Number(fromNano(data.volume)) / Number(fromNano(totalBill.totalBill));

    for (let i = 0; i < totalBill.billsCount; i++) {
      const nftAddress = await collection.getNFTAddress(BigInt(i));
      const nftAddressString = nftAddress.toString({ urlSafe: true, bounceable: true });
      const nft = provider.open(PayoutItem.createFromAddress(nftAddress));
      const owner = (await nft.getNFTData()).owner.toString({ urlSafe: true, bounceable: false });

      const tokenAmount = Number(fromNano(await nft.getBillAmount()));
      const iceAmount = tokenAmount * rate;

      stakers.push({ owner, nft: nftAddressString, rate, LION: tokenAmount, ICE: iceAmount });
      total += iceAmount;
    }

    console.log({ address, ...data, ...totalBill, rate });
  }

  console.log(stakers);

  console.log(total);
}
