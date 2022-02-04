import BigNumber from 'bignumber.js';
import BN from 'bn.js';
import { VestingSchedule } from '../types';

const ONE_MONTH = 28 * 24 * 60 * 60;

export const durationToVestingSchedule = (startingBlock: number, totalAmount: string, durationMonths: number, blockTime: number = 12) => {
    
    // one month in block numbers
    const oneMonthInBlocks = ONE_MONTH / blockTime;

    const totalVestedBlocks = oneMonthInBlocks * durationMonths;

    // amount per block * total vested block number must equal the total amount
    const astrVal = new BN(totalAmount);
    const amountPerBlock = astrVal.divRound(new BN(totalVestedBlocks));

    return {
        locked: astrVal.toString(),
        perBlock: amountPerBlock.toString(),
        startingBlock,
    } as VestingSchedule;
};

/**
 * Converts the token denominated value to the minimal denomination. For example, 5 DOT will be converted to 50,000,000,000.
 * @param amount The token amount with decimal points
 * @param decimalPoint The number of zeros for 1 token (ex: 15 zeros)
 * @returns The converted token number that can be used in the blockchain.
 */
export const tokenToMinimalDenom = (amount: string | number, decimalPoint: number) => {
    const tokenAmount = new BigNumber(amount);
    const fullAmount = tokenAmount.multipliedBy(new BigNumber(10).pow(decimalPoint));
    return new BN(fullAmount.toFixed());
};
