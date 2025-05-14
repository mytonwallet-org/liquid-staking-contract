import {NetworkProvider, sleep} from '@ton-community/blueprint';
import {Controller} from "../wrappers/Controller";
import {Address, toNano} from "ton";
import {ION_CONTROLLERS} from "./utils";

export async function run(provider: NetworkProvider) {
  const result: {
    validatorAddress: string;
    validatorName: string;
    controller: string;
  }[] = [];

  for (const address of ION_CONTROLLERS) {
    const controller = provider.open(Controller.createFromAddress(Address.parse(address)));
    const data = await controller.getControllerData().catch((err) => err as Error);

    if (data instanceof Error) {
      console.log(address, data);
      continue;
    }

    if (!data.approved) {
      await sleep(10000);
      await controller.sendApprove(provider.sender(), true, toNano('0.5'));
    }

    const validatorAddress = data.validator.toString({bounceable: true, urlSafe: true});
    const validatorName = `validator-${validatorAddress.slice(validatorAddress.length - 6)}`;

    result.push({validatorAddress, validatorName, controller: address});
  }

  Object.values(buildArrayCollectionByKey(result, 'validatorAddress')).forEach((controllers) => {
    console.log(`  - name: ${controllers[0].validatorName}
    address: ${controllers[0].validatorAddress}
    controllers:
      - ${controllers[0].controller}
      - ${controllers[1].controller}
    `)
  })
}

type AnyLiteral = Record<string, any>;
type CollectionByKey<Member> = Record<number | string, Member>;
type GroupedByKey<Member> = Record<number | string, Member[]>;

export function buildArrayCollectionByKey<T extends AnyLiteral>(collection: T[], key: keyof T) {
  return collection.reduce((byKey: CollectionByKey<Array<T>>, member: T) => {
    const collectionKey = member[key];
    if (!byKey[collectionKey]) {
      // eslint-disable-next-line no-param-reassign
      byKey[collectionKey] = [];
    }
    byKey[collectionKey].push(member);

    return byKey;
  }, {});
}
