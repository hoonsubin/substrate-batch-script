import SubstrateApi from './api/SubstrateApi';
import endpoints from './config/endpoints.json';

export default async function app() {

    const accountKey = process.env.SUBSTRATE_MNEMONIC;
    const api = new SubstrateApi(endpoints.local, accountKey);
    await api.start();

    const account = await api.buildStorageQuery('system', 'account', api.account.address);

    console.log(api.account.address);
    console.log(account.toHuman());

    // we need this to exit out of polkadot-js/api instance
    process.exit(0);
}
