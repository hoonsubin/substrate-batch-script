import { ApiPromise, WsProvider } from '@polkadot/api';
import { ApiTypes, SignerOptions, SubmittableExtrinsic } from '@polkadot/api/types';
import { ITuple } from '@polkadot/types/types';
import { DispatchError } from '@polkadot/types/interfaces';
import { mnemonicGenerate } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';
import BN from 'bn.js';
import { ExtrinsicPayload } from '../types';

const AUTO_CONNECT_MS = 10_000; // [ms]
interface ChainProperty {
    tokenSymbols: string[];
    tokenDecimals: number[];
    chainName: string;
}

export default class SubstrateApi {
    private _provider: WsProvider;
    private _api: ApiPromise;
    private _keyring: Keyring;
    private _mnemonic: string;
    private _chaiProperty: ChainProperty;

    constructor(endpoint: string, mnemonic?: string) {
        this._provider = new WsProvider(endpoint, AUTO_CONNECT_MS);
        this._keyring = new Keyring({ type: 'sr25519' });

        // create a random account if no mnemonic was provided
        this._mnemonic = mnemonic || mnemonicGenerate();

        console.log('connecting to ' + endpoint);
        this._api = new ApiPromise({
            provider: this._provider,
        });
    }

    public get apiInst() {
        if (!this._api) {
            throw new Error('The ApiPromise has not been initialized');
        }
        return this._api;
    }

    public get account() {
        return this._keyring.addFromUri(this._mnemonic, { name: 'Default' }, 'sr25519');
    }

    public get chainProperty() {
        return this._chaiProperty;
    }

    public async start() {
        this._api = await this._api.isReady;

        const chainProperties = await this._api.rpc.system.properties();

        const ss58Format = chainProperties.ss58Format.unwrapOrDefault().toNumber();

        const tokenDecimals = chainProperties.tokenDecimals
            .unwrapOrDefault()
            .toArray()
            .map((i) => i.toNumber());

        const tokenSymbols = chainProperties.tokenSymbol
            .unwrapOrDefault()
            .toArray()
            .map((i) => i.toString());

        const chainName = (await this._api.rpc.system.chain()).toString();

        console.log(`connected to ${chainName} with account ${this.account.address}`);

        this._chaiProperty = {
            tokenSymbols,
            tokenDecimals,
            chainName,
        };
        this._keyring.setSS58Format(ss58Format);

        //return this;
    }

    public async getBlockHash(blockNumber: number) {
        return await this._api?.rpc.chain.getBlockHash(blockNumber);
    }

    public forceTransfer(sourceAddress: string, dest: string, balance: BN): SubmittableExtrinsic<ApiTypes> {
        if (!sourceAddress) {
            throw new Error('Transfer target address was not defined!');
        }

        const ext = this._api?.tx.balances.forceTransfer(sourceAddress, dest, balance);
        if (ext) return ext;
        throw new Error('Undefined force transfer');
    }

    public buildTxCall(extrinsic: string, method: string, ...args: any[]): ExtrinsicPayload {
        const ext = this._api?.tx[extrinsic][method](...args);
        if (ext) return ext;
        throw new Error(`Undefined extrinsic call ${extrinsic} with method ${method}`);
    }

    public buildStorageQuery(extrinsic: string, method: string, ...args: any[]) {
        const ext = this._api?.query[extrinsic][method](...args);
        if (ext) return ext;
        throw new Error(`Undefined storage query ${extrinsic} for method ${method}`);
    }

    public async nonce(): Promise<number | undefined> {
        return ((await this._api?.query.system.account(this.account.address)) as any)?.nonce.toNumber();
    }

    public wrapBatchAll(txs: ExtrinsicPayload[]): ExtrinsicPayload {
        const ext = this._api?.tx.utility.batchAll(txs);
        if (ext) return ext;
        throw new Error('Undefined batch all');
    }

    public wrapSudo(tx: ExtrinsicPayload): ExtrinsicPayload {
        const ext = this._api?.tx.sudo.sudo(tx);
        if (ext) return ext;
        throw new Error('Undefined sudo');
    }

    public async signAndSend(tx: ExtrinsicPayload, options?: Partial<SignerOptions>) {
        // ensure that we automatically increment the nonce per transaction
        return await tx.signAndSend(this.account, { nonce: -1, ...options }, (result) => {
            // handle transaction errors
            result.events
                .filter((record): boolean => !!record.event && record.event.section !== 'democracy')
                .map(({ event: { data, method, section } }) => {

                if (section === 'system' && method === 'ExtrinsicFailed') {
                    const [dispatchError] = data as unknown as ITuple<[DispatchError]>;
                    let message = dispatchError.type.toString();

                    if (dispatchError.isModule) {
                    try {
                        const mod = dispatchError.asModule;
                        const error = dispatchError.registry.findMetaError(mod);

                        message = `${error.section}.${error.name}`;
                    } catch (error) {
                        console.error(error);
                    }
                    } else if (dispatchError.isToken) {
                        message = `${dispatchError.type}.${dispatchError.asToken.type}`;
                    }

                    const errorMessage = `${section}.${method} ${message}`;
                    console.error(`error: ${errorMessage}`);

                    throw new Error(message);
                } 
                else if (section === 'utility' && method === 'BatchInterrupted') {
                    const anyData = data as any;
                    const error = anyData[1].registry.findMetaError(anyData[1].asModule);
                    let message = `${error.section}.${error.name}`;
                    console.error(`error: ${section}.${method} ${message}`);
                }
            });
        });
    }
}
