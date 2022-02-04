import BN from 'bn.js';

export interface TransferItem {
    to: string;
    amount: string;
}
export interface VestedTransferItem extends TransferItem{
    vestedMonths: number;
    startingBlock: number;
}

export interface VestingSchedule {
    locked: string;
    perBlock: string;
    startingBlock: number;
}