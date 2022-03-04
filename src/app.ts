import SubstrateApi from './api/SubstrateApi';
import endpoints from './config/endpoints.json';
import _ from 'lodash';
import * as utils from './utils';
import { TransferItem, VestedTransferItem, ExtrinsicPayload, VestingAccount } from './types';
import { setTimeout as sleep } from 'timers/promises';

export default async function app() {
    const senderKey = process.env.SUBSTRATE_MNEMONIC || '//Alice';
    const api = new SubstrateApi(endpoints.local, senderKey);
    await api.start();

    const txList = (await utils.readCsv('inputs/reward-vesting-fix.csv')) as TransferItem[];
    const originalSchedules = (await utils.readJson('inputs/original_vesting_schedules.json')) as VestingAccount[];
    const updatedSchedules = (await utils.readJson('inputs/updated_vesting_schedules.json')) as VestingAccount[];
    
    const txVestedList = _.map(txList, (i) => {
        return {
            ...i,
            vestedMonths: 7,
            // vestedMonths: 15,
            startingBlock: 10,
        };
    });

    // await sendBatchForceVestedTransfer(api, 'ajYMsCKsEAhEvHpeA4XqsfiA9v1CdzZPrCfS6pEfeGHW9j8', txVestedList);
    // await sendBatchVestedTransfer(api, txVestedList);
    // await sendBatchForceUpdateSchedules(api, txVestedList);

    await sendBatchVestedTransferSchedules(api, originalSchedules);
    //await sendBatchVestedTransferForceUpdateSchedules(api, updatedSchedules);

    // we need this to exit out of polkadot-js/api instance
    process.exit(0);
}

const sendBatchTransfer = async (api: SubstrateApi, txList: TransferItem[], chunks: number = 100) => {
    console.log(`sending batch transfer with ${txList.length} items`);
    const chainDecimal = api.chainProperty.tokenDecimals[0];

    const batchPayload = _.map(txList, (i) => {
        // converts token amount to chain amount
        const transferAmount = utils.tokenToMinimalDenom(i.amount, chainDecimal);

        return api.buildTxCall('balances', 'transfer', i.address, transferAmount);
    });

    await sendAsChunks(api, batchPayload, chunks);
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

const sendBatchVestedTransferSchedules = async (api: SubstrateApi, accounts: VestingAccount[], chunks: number = 100) => {
    console.log(`sending batch vested transfer with ${accounts.length} items`);
    const batchPayload: ExtrinsicPayload[] = [];

    accounts.forEach(account => {
        account.schedules.forEach(schedule => {
            batchPayload.push(api.buildTxCall('vesting', 'vestedTransfer', account.address, schedule));
        });
    });

    await sendAsChunks(api, batchPayload, chunks);
};

const sendBatchVestedTransferForceUpdateSchedules = async (api: SubstrateApi, accounts: VestingAccount[], chunks: number = 100) => {
    console.log(`sending batch force update schedules transfer with ${accounts.length} items`);
    const batchPayload: ExtrinsicPayload[] = [];

    accounts.forEach(account => {
        batchPayload.push(api.buildTxCall('vesting', 'forceUpdateSchedules', account.address, account.schedules));
    });

    await sendAsChunksSudo(api, batchPayload, chunks);
};

const sendBatchForceVestedTransfer = async (api: SubstrateApi, sourceAccount: string, txList: VestedTransferItem[], chunks: number = 100) => {
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
