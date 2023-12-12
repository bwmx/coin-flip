import { describe, test, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import { makePaymentTxnWithSuggestedParamsFromObject } from 'algosdk';
import { algos, getTransactionParams, sendTransaction } from '@algorandfoundation/algokit-utils';
import { CoinFlipClient } from '../contracts/clients/CoinFlipClient';

const fixture = algorandFixture();

let creatorAppClient: CoinFlipClient;
let createdAppId: number;

describe('CoinFlip', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { algod, testAccount } = fixture.context;

    creatorAppClient = new CoinFlipClient(
      {
        sender: testAccount,
        resolveBy: 'id',
        id: 0,
      },
      algod
    );

    await creatorAppClient.create.createApplication({
      beaconApp: 110096026,
      minBet: algos(1).microAlgos,
      maxBet: algos(10).microAlgos,
    });

    const { appId, appAddress } = await creatorAppClient.appClient.getAppReference();

    // initial funding transaction, smart contract needs 0.1 to exist, 0.1 to be able to opt-in
    const seedTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: testAccount.addr,
      to: appAddress,
      amount: 200_000,
      suggestedParams: await getTransactionParams(undefined, algod),
    });

    await sendTransaction({ transaction: seedTxn, from: testAccount }, algod);

    createdAppId = <number>appId;
  });

  test('flipCoin', async () => {
    const { algod, testAccount } = fixture.context;

    const appClient = new CoinFlipClient(
      {
        sender: testAccount,
        resolveBy: 'id',
        id: createdAppId,
      },
      algod
    );

    await appClient.optIn.optInToApplication({});

    const { appAddress } = await appClient.appClient.getAppReference();

    // initial funding transaction, smart contract needs 0.1 to exist, 0.1 to be able to opt-in
    const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: testAccount.addr,
      to: appAddress,
      amount: algos(1).microAlgos,
      suggestedParams: await algod.getTransactionParams().do(),
    });

    await appClient.flipCoin({ bet: payTxn, outcome: 0 });
  });

  test('settle', async () => {
    // TODO
  });
});
