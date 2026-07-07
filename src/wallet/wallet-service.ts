/**
 * Server-side wallet: thin wrapper over the WDK EVM account for one fan.
 * Uses the API verified in Spike A (see DECISIONS.md):
 *   getAddress(), getBalance() (native), getTokenBalance(addr), transfer({token,recipient,amount}).
 * The seed and private key never leave this process.
 */

import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import type { AppConfig } from '../config.js'
import { formatUnits, parseUnits } from './units.js'

const CHAIN = 'ethereum'

export interface WalletInfo {
  address: string
  nativeWei: string
  nativeEth: string
  usdtBase: string
  usdtHuman: string
}

export interface TransferResult {
  hash: string
  fee: string
  explorer: string
}

// The WDK type declarations expose the account as IWalletAccountWithProtocols, whose concrete
// read/write methods (getAddress, getBalance, getTokenBalance, transfer — all verified live in
// Spike A) are not surfaced on that interface. Use a structural alias for the methods we call.
interface EvmAccount {
  getAddress(): Promise<string>
  getBalance(): Promise<bigint>
  getTokenBalance(tokenAddress: string): Promise<bigint>
  transfer(opts: { token: string; recipient: string; amount: bigint }): Promise<{ hash: string; fee: bigint }>
}

export class WalletService {
  private wdk: WDK
  private account: EvmAccount | null = null

  constructor(private cfg: AppConfig) {
    this.wdk = new WDK(cfg.seed).registerWallet(CHAIN, WalletManagerEvm, { provider: cfg.rpcUrl })
  }

  async init(): Promise<this> {
    this.account = (await this.wdk.getAccount(CHAIN, 0)) as unknown as EvmAccount
    return this
  }

  private get acct(): EvmAccount {
    if (!this.account) throw new Error('WalletService not initialised — call init() first')
    return this.account
  }

  async getAddress(): Promise<string> {
    return this.acct.getAddress()
  }

  async getInfo(): Promise<WalletInfo> {
    const [address, native] = await Promise.all([this.acct.getAddress(), this.acct.getBalance()])
    let usdtBase = 0n
    if (this.cfg.usdtAddress) {
      try {
        usdtBase = await this.acct.getTokenBalance(this.cfg.usdtAddress)
      } catch {
        /* token not readable (e.g. wrong network) — report zero */
      }
    }
    return {
      address,
      nativeWei: native.toString(),
      nativeEth: formatUnits(native, 18),
      usdtBase: usdtBase.toString(),
      usdtHuman: formatUnits(usdtBase, this.cfg.usdtDecimals),
    }
  }

  /** Send USDt to a recipient address. `human` is a decimal string like "1.5". */
  async sendUsdt(recipient: string, human: string): Promise<TransferResult> {
    if (!this.cfg.usdtAddress) throw new Error('USDT_ADDRESS not configured')
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error('invalid recipient address')
    const amount = parseUnits(human, this.cfg.usdtDecimals)
    if (amount <= 0n) throw new Error('amount must be greater than 0')
    const res = await this.acct.transfer({ token: this.cfg.usdtAddress, recipient, amount })
    return {
      hash: res.hash,
      fee: res.fee.toString(),
      explorer: `https://sepolia.etherscan.io/tx/${res.hash}`,
    }
  }

  dispose(): void {
    this.wdk.dispose()
  }
}
