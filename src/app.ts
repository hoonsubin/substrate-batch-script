import SubstrateApi from './api/SubstrateApi';
import endpoints from './config/endpoints.json';
import _ from 'lodash';
import * as utils from './utils';
import { TransferItem, VestedTransferItem } from './types';

export default async function app() {
    const senderKey = process.env.SUBSTRATE_MNEMONIC || '//Alice';
    const api = new SubstrateApi(endpoints.local, senderKey);
    await api.start();

    const txList = (await utils.readCsv('/Users/hoonkim/Downloads/reward-vesting-fix.csv')) as TransferItem[];

    const txVestedList = _.map(txList, (i) => {
        return {
            ...i,
            vestedMonths: 7,
            startingBlock: 210541,
        }
    })

    await sendBatchVestedTransfer(api, txVestedList);

    // we need this to exit out of polkadot-js/api instance
    process.exit(0);
}

const sendBatchTransfer = async (api: SubstrateApi, txList: TransferItem[]) => {
    console.log(`sending batch transfer with ${txList.length} items`);
    const chainDecimal = api.chainProperty.tokenDecimals[0];

    const batchPayload = _.map(txList, (i) => {
        // converts token amount to chain amount
        const transferAmount = utils.tokenToMinimalDenom(i.amount, chainDecimal);

        return api.buildTxCall('balances', 'transfer', i.to, transferAmount);
    });

    const batchTx = api.wrapBatchAll(batchPayload);

    console.log(batchTx.args.toString());

    const hash = await api.signAndSend(batchTx);

    console.log('batch transfer finished. Tx hash: ' + hash.toString());
};

const sendBatchVestedTransfer = async (api: SubstrateApi, txList: VestedTransferItem[]) => {
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

        console.log(vestingSchedule);

        return api.buildTxCall('vesting', 'vestedTransfer', i.to, vestingSchedule);
    });

    const batchTx = api.wrapBatchAll(batchPayload);
    
    //console.log(batchTx.args.toString());

    const hash = await api.signAndSend(batchTx);

    console.log('batch transfer finished. Tx hash: ' + hash.toString());
};
