import BigNumber from 'bignumber.js';
import BN from 'bn.js';

export const durationToVestingSchedule = (startingBlock: number, totalAmount: string, durationMonths: number) => {
    const ONE_MONTH = 28 * 24 * 60 * 60;
    const BLOCK_PER_SECOND = 12;
    // one month in block numbers
    const ONE_MONTH_BLOCKS_PER_12_SECONDS = ONE_MONTH / BLOCK_PER_SECOND;

    const totalVestedBlocks = ONE_MONTH_BLOCKS_PER_12_SECONDS * durationMonths;
    //console.log(totalVestedBlocks)
    // amount per block * total vested block number must equal the total amount
    const astrVal = new BigNumber(totalAmount);
    const amountPerBlock = astrVal.dividedBy(totalVestedBlocks);

    return {
        locked: astrVal.toFixed(),
        perBlock: amountPerBlock.toFixed(),
        startingBlock,
    };
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
    return new BN(fullAmount.toString());
}