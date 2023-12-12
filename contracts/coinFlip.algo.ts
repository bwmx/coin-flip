import { Contract } from '@algorandfoundation/tealscript';

type BetResult = {
  won: uint64;
  amount: uint64;
};

// eslint-disable-next-line no-unused-vars
class CoinFlip extends Contract {
  // beacon app id
  beaconApp = GlobalStateKey<Application>();

  // min bet
  minBet = GlobalStateKey<uint64>();

  // max bet
  maxBet = GlobalStateKey<uint64>();

  // how many outstanding?
  betsOutstanding = GlobalStateKey<uint64>();

  // what round did user commit to
  commitmentRound = LocalStateKey<uint64>();

  // what's the users bet
  bet = LocalStateKey<uint64>();

  // bet value (what the user is betting on)
  betOutcome = LocalStateKey<uint64>();

  createApplication(beaconApp: Application, minBet: number, maxBet: number): void {
    this.beaconApp.value = beaconApp;
    this.minBet.value = minBet;
    this.maxBet.value = maxBet;

    this.betsOutstanding.value = 0;
  }

  // override to give user a local state
  optInToApplication(): void {}

  private getRandomness(round: uint64): bytes {
    const r: bytes = sendMethodCall<[uint64, bytes], bytes>({
      applicationID: this.beaconApp.value,
      name: 'must_get',
      methodArgs: [round, concat(this.txn.sender, itob(round))],
      fee: 0,
    });

    return r;
  }

  private deleteLocalStorage(): void {
    this.commitmentRound(this.txn.sender).delete();
    this.bet(this.txn.sender).delete();
    this.betOutcome(this.txn.sender).delete();
  }

  // lets user place bet
  // returns round where result will be decided
  flipCoin(bet: PayTxn, outcome: uint64): uint64 {
    verifyTxn(bet, {
      amount: { greaterThanEqualTo: this.minBet.value, lessThanEqualTo: this.maxBet.value },
      receiver: this.app.address,
      sender: this.txn.sender,
    });

    // ensure there is not current bet pending result
    assert(!this.commitmentRound(this.txn.sender).exists);

    this.bet(this.txn.sender).value = bet.amount;
    this.betOutcome(this.txn.sender).value = outcome;

    const commitmentRound = globals.round + 3;

    this.commitmentRound(this.txn.sender).value = commitmentRound;

    // increment outstanding bets by 1
    this.betsOutstanding.value = this.betsOutstanding.value + 1;

    return commitmentRound;
  }

  // eslint-disable-next-line no-unused-vars
  settle(beaconApp: Application): BetResult {
    const r = this.getRandomness(this.commitmentRound(this.txn.sender).value);
    const c = getbit(r, 0);
    const predictedOutcome = this.betOutcome(this.txn.sender).value;

    let result = <BetResult>{
      won: 0,
      amount: this.bet(this.txn.sender).value,
    };

    if ((c && predictedOutcome === 1) || (!c && predictedOutcome === 0)) {
      sendPayment({
        receiver: this.txn.sender,
        amount: this.bet(this.txn.sender).value * 2,
        fee: 0,
      });

      result = <BetResult>{
        won: 1,
        amount: this.bet(this.txn.sender).value * 2,
      };
    }

    // reset users local state
    this.deleteLocalStorage();

    // decrement pending bets num
    this.betsOutstanding.value = this.betsOutstanding.value - 1;

    return result;
  }
}
