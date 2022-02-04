import SubstrateApi from './api/SubstrateApi';
import endpoints from './config/endpoints.json';
import _ from 'lodash';
import * as utils from './utils';

interface TransferItem {
    address: string;
    amount: string;
}

export default async function app() {
    const senderKey = process.env.SUBSTRATE_MNEMONIC || '//Alice';
    const api = new SubstrateApi(endpoints.local, senderKey);
    await api.start();

    const txList = (await utils.readCsv('/Users/hoonkim/Downloads/reward-vesting-fix.csv')) as TransferItem[];

    await sendBatchTransaction(api, txList);

    // we need this to exit out of polkadot-js/api instance
    process.exit(0);
}

const sendBatchTransaction = async (api: SubstrateApi, txList: TransferItem[]) => {
    console.log(`sending batch transfer with ${txList.length} items`);

    const batchPayload = _.map(txList, (i) => {
        const chainDecimal = api.chainProperty.tokenDecimals[0];
        // converts token amount to chain amount
        const transferAmount = utils.tokenToMinimalDenom(i.amount, chainDecimal);

        const tx = api.buildTxCall('balances', 'transfer', i.address, transferAmount);

        return tx;
    });

    const batchTx = api.wrapBatchAll(batchPayload);

    const hash = await api.signAndSend(batchTx);

    console.log('batch transfer finished. Tx hash: ' + hash.toString());
};
