import SubstrateApi from './api/SubstrateApi';
import endpoints from './config/endpoints.json';
import _ from 'lodash';
import * as utils from './utils';
import { TransferItem, VestedTransferItem, ExtrinsicPayload, VestingAccount, UnlockedItem } from './types';
import { setTimeout as sleep } from 'timers/promises';
import BN from 'bn.js';
import BigNumber from 'bignumber.js';

export default async function app() {
    const senderKey = process.env.SUBSTRATE_MNEMONIC || '//Alice';
    const api = new SubstrateApi(endpoints.shibuya, senderKey);
    await api.start();

    // add custom behavior here

    const VESTING_START = 1_400_000;
    const VESTING_MONTHS = 3;
    const ASTR_TREASURY = 'YQnbw3oWxBnCUarnbePrjFcrSgVPP2jqTZYzWcccmN8fXhd';

    const arthswapRewards = (await utils.readCsv(
        '/Users/hoonkim/Projects/substrate-batch-script/src/data/arthswap-rewards.csv',
    )) as TransferItem[];
    const astriddaoRewards = (await utils.readCsv(
        '/Users/hoonkim/Projects/substrate-batch-script/src/data/astriddao-rewards.csv',
    )) as TransferItem[];
    const starlayRewards = (await utils.readCsv(
        '/Users/hoonkim/Projects/substrate-batch-script/src/data/starlay-rewards.csv',
    )) as TransferItem[];

    const allRewards = [...arthswapRewards, ...astriddaoRewards, ...starlayRewards];

    // send batch transfer with 3 months vesting
    const batchRewardTransfers = allRewards.map((i) => {
        const amount = new BN(i.amount);
        // if the reward is more than 1 ASTR, we send a 3 month vested transfer
        if (amount.gte(new BN(10).pow(new BN(18)))) {
            const vestingSchedule = utils.durationToVestingSchedule(VESTING_START, i.amount, VESTING_MONTHS);
            return api.buildTxCall('vesting', 'forceVestedTransfer', ASTR_TREASURY, i.address, vestingSchedule);
        }

        // else, we send a normal transfer
        return api.buildTxCall('balances', 'forceTransfer', ASTR_TREASURY, i.address, amount);
    });

    const splitTx = utils.splitListIntoChunks(batchRewardTransfers, 300);
    const batchCalls = splitTx.map((i) => {
        return api.wrapSudo(api.wrapBatchAll(i));
    });

    console.log(`There are ${batchCalls.length} batch calls`);

    await utils.saveAsJson(batchCalls, './dot-festival-reward-batch.json');

    // we need this to exit out of polkadot-js/api instance
    process.exit(0);
}

const sendBatchTransfer = (api: SubstrateApi, txList: TransferItem[], chunks: number = 100) => {
    console.log(`creating batch transfer with ${txList.length} items`);
    const chainDecimal = api.chainProperty.tokenDecimals[0];

    const batchPayload = _.map(txList, (i) => {
        // converts token amount to chain amount
        const transferAmount = utils.tokenToMinimalDenom(i.amount, chainDecimal);

        return api.buildTxCall('balances', 'transfer', i.address, transferAmount);
    });

    const splitTx = utils.splitListIntoChunks(batchPayload, chunks);
    const batchCalls = splitTx.map((i) => {
        return api.wrapBatchAll(i);
    });
    return batchCalls;

    //await sendAsChunks(api, batchPayload, chunks);
};

const sendBatchVestedTransfer = async (api: SubstrateApi, txList: VestedTransferItem[], chunks: number = 100) => {
    console.log(`sending batch vested transfer with ${txList.length} items`);
    const chainDecimal = api.chainProperty.tokenDecimals[0];

    const batchPayload = _.map(txList, (i) => {
        // converts token amount to chain amount
        const transferAmount = utils.tokenToMinimalDenom(i.amount, chainDecimal);

        // create the vesting schedule
        const vestingSchedule = utils.durationToVestingSchedule(
            i.startingBlock,
            transferAmount.toString(),
            i.vestedMonths,
        );

        return api.buildTxCall('vesting', 'vestedTransfer', i.address, vestingSchedule);
    });

    await sendAsChunks(api, batchPayload, chunks);
};

const sendBatchVestedTransferSchedules = async (
    api: SubstrateApi,
    accounts: VestingAccount[],
    chunks: number = 100,
) => {
    console.log(`sending batch vested transfer with ${accounts.length} items`);
    const batchPayload: ExtrinsicPayload[] = [];

    accounts.forEach((account) => {
        account.schedules.forEach((schedule) => {
            batchPayload.push(api.buildTxCall('vesting', 'vestedTransfer', account.address, schedule));
        });
    });

    await sendAsChunks(api, batchPayload, chunks);
};

const sendBatchVestedTransferForceUpdateSchedules = async (
    api: SubstrateApi,
    accounts: VestingAccount[],
    chunks: number = 100,
) => {
    console.log(`sending batch force update schedules transfer with ${accounts.length} items`);
    const batchPayload: ExtrinsicPayload[] = [];

    accounts.forEach((account) => {
        batchPayload.push(api.buildTxCall('vesting', 'forceUpdateSchedules', account.address, account.schedules));
    });

    await sendAsChunksSudo(api, batchPayload, chunks);
};

const sendBatchForceVestedTransfer = async (
    api: SubstrateApi,
    sourceAccount: string,
    txList: VestedTransferItem[],
    chunks: number = 100,
) => {
    console.log(`sending batch force vested transfer with ${txList.length} items`);
    const chainDecimal = api.chainProperty.tokenDecimals[0];

    const batchPayload = _.map(txList, (i) => {
        // converts token amount to chain amount
        const transferAmount = utils.tokenToMinimalDenom(i.amount, chainDecimal);

        // create the vesting schedule
        const vestingSchedule = utils.durationToVestingSchedule(
            i.startingBlock,
            transferAmount.toString(),
            i.vestedMonths,
        );

        return api.buildTxCall('vesting', 'forceVestedTransfer', sourceAccount, i.address, vestingSchedule);
    });

    await sendAsChunksSudo(api, batchPayload, chunks);
};

const sendBatchForceUpdateSchedules = async (api: SubstrateApi, txList: VestedTransferItem[], chunks: number = 100) => {
    console.log(`sending batch force update schedules transfer with ${txList.length} items`);
    const chainDecimal = api.chainProperty.tokenDecimals[0];

    const batchPayload = _.map(txList, (i) => {
        // converts token amount to chain amount
        const transferAmount = utils.tokenToMinimalDenom(i.amount, chainDecimal);

        // create the vesting schedule
        const vestingSchedule = utils.durationToVestingSchedule(
            i.startingBlock,
            transferAmount.toString(),
            i.vestedMonths,
        );

        return api.buildTxCall('vesting', 'forceUpdateSchedules', i.address, [vestingSchedule]);
    });

    await sendAsChunksSudo(api, batchPayload, chunks);
};

const sendAsChunks = async (api: SubstrateApi, batchPayload: ExtrinsicPayload[], chunks: number) => {
    // we are splitting the batch into chunks in case the hash size is over the block limit
    const batchesInChunk = _.map(utils.splitListIntoChunks(batchPayload, chunks), (i) => {
        return api.wrapBatchAll(i);
    });

    for (let i = 0; i < batchesInChunk.length; i++) {
        const logs = batchesInChunk[i].args.toString();

        console.log(logs);

        const hash = await api.signAndSend(batchesInChunk[i]);

        console.log('batch transfer finished. Tx hash: ' + hash.toString());

        await sleep(10000); // 10 seconds
    }
};

const sendAsChunksSudo = async (api: SubstrateApi, batchPayload: ExtrinsicPayload[], chunks: number) => {
    // we are splitting the batch into chunks in case the hash size is over the block limit
    const batchesInChunk = _.map(utils.splitListIntoChunks(batchPayload, chunks), (i) => {
        return api.wrapBatchAll(i);
    });

    for (let i = 0; i < batchesInChunk.length; i++) {
        const sudoTx = api.wrapSudo(batchesInChunk[i]);

        const logs = sudoTx.args.toString();

        console.log(logs);

        const hash = await api.signAndSend(sudoTx);

        console.log('batch transfer finished. Tx hash: ' + hash.toString());

        await sleep(10000); // 10 seconds
    }
};

const calculateUnlockedAmounts = (unlockers: UnlockedItem[], originalSchedules: VestingAccount[]) => {
    console.log(`addres,vested_total,unlocked,remaining`);
    unlockers.map((unlocker) => {
        const totalVested = originalSchedules
            .find((x) => x.address === unlocker.address)
            ?.schedules.reduce((previous, current) => new BN(previous).add(new BN(current.locked)), new BN(0));

        const unlocked = totalVested?.sub(new BN(unlocker.remaining_balance));
        console.log(`${unlocker.address},${totalVested},${unlocked},${unlocker.remaining_balance}`);
    });
};
