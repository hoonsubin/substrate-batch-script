import SubstrateApi from './api/SubstrateApi';
import endpoints from './config/endpoints.json';
import _ from 'lodash';
import * as utils from './utils';
import { TransferItem, VestedTransferItem, ExtrinsicPayload, VestingAccount, UnlockedItem } from './types';
import { setTimeout as sleep } from 'timers/promises';
import BN from 'bn.js';
import BigNumber from 'bignumber.js';

import missingLockropRewardBonus from './data/missing-10-ld-reward.json';

export default async function app() {
    const senderKey = process.env.SUBSTRATE_MNEMONIC || '//Alice';
    const api = new SubstrateApi(endpoints.shibuya, senderKey);
    await api.start();

    // add custom behavior

    const lockdroRewards = Object.entries(missingLockropRewardBonus);

    const txList = lockdroRewards.map((i) => {
        const amount = utils.tokenToMinimalDenom(i[1], api.chainProperty.tokenDecimals[0])
        return {
            address: i[0],
            amount: amount.toString(),
        };
    });

    // const txCalls = sendBatchTransfer(api, txList).map((i) => {
    //     return i.toHex();
    // });

    console.log(txList);

    await utils.saveAsJson(txList, './missing-10-reward-calls.json');
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
