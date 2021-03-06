import Token from './token';
import PrivacyTokenModel from '@src/models/token/privacyToken';
import AccountKeySetModel from '@src/models/key/accountKeySet';
import sendPrivacyToken, { hasExchangeRate, createRawPrivacyTokenTx, sendRawPrivacyTokenTx } from '@src/services/tx/sendPrivacyToken';
import PaymentInfoModel from '@src/models/paymentInfo';
import sendBurningRequest, {createRawBurningRequestTx} from '@src/services/tx/sendBurningRequest';
import sendPrivacyTokenPdeContribution from '@src/services/tx/sendPrivacyTokenPdeContribution';
import sendPrivacyTokenPdeTradeRequest from '@src/services/tx/sendPrivacyTokenPdeTradeRequest';
import Validator from '@src/utils/validator';
import PrivacyTokenApiModel, { BridgeInfoInterface } from '@src/models/bridge/privacyTokenApi';
import { TokenInfo } from '@src/constants';
import { genETHDepositAddress, genERC20DepositAddress, genCentralizedDepositAddress } from '@src/services/bridge/deposit';
import { getBridgeHistory } from '@src/services/bridge/history';
import { genCentralizedWithdrawAddress, updatePTokenFee, addETHTxWithdraw, addERC20TxWithdraw } from '@src/services/bridge/withdraw';
import { convertDecimalToNanoAmount } from '@src/utils/common';
import { BurningRequestMeta, BurningRequestDepositToSCMeta } from '@src/constants/wallet';

interface PrivacyTokenParam {
  privacyTokenApi: PrivacyTokenApiModel,
  accountKeySet: AccountKeySetModel,
};

class PrivacyToken extends Token implements PrivacyTokenModel {
  tokenId: string;
  name: string;
  symbol: string;
  isPrivacyToken: boolean;
  totalSupply: number;
  bridgeInfo: BridgeInfoInterface

  constructor({ accountKeySet, privacyTokenApi }: PrivacyTokenParam) {
    new Validator('accountKeySet', accountKeySet).required();
    new Validator('privacyTokenApi', privacyTokenApi).required();

    super({ accountKeySet, tokenId: privacyTokenApi.tokenId, name: privacyTokenApi.name, symbol: privacyTokenApi.symbol });

    this.totalSupply = privacyTokenApi.supplyAmount;
    this.isPrivacyToken = true;
    this.bridgeInfo = privacyTokenApi.bridgeInfo;
  }

  get bridgeErc20Token() {
    return this.bridgeInfo?.currencyType === TokenInfo.BRIDGE_PRIVACY_TOKEN.CURRENCY_TYPE.ERC20;
  }

  get bridgeEthereum() {
    return this.bridgeInfo?.currencyType === TokenInfo.BRIDGE_PRIVACY_TOKEN.CURRENCY_TYPE.ETH;
  }

  get bridgeBinance() {
    return this.bridgeInfo?.currencyType === TokenInfo.BRIDGE_PRIVACY_TOKEN.CURRENCY_TYPE.BNB;
  }

  get bridgeBEP2() {
    return this.bridgeInfo?.currencyType === TokenInfo.BRIDGE_PRIVACY_TOKEN.CURRENCY_TYPE.BNB_BEP2;
  }

  async hasExchangeRate() {
    return await hasExchangeRate(this.tokenId);
  }

  async getNativeAvailableCoins() {
    return this.getAvailableCoins(null);
  }

  async transfer(paymentList: PaymentInfoModel[], nativeFee: number, privacyFee: number) {
    try {
      new Validator('paymentList', paymentList).required().paymentInfoList();
      new Validator('nativeFee', nativeFee).required().amount();
      new Validator('privacyFee', privacyFee).required().amount();
  
      L.info(`Privacy token ${this.tokenId} transfer`, { paymentList, nativeFee, privacyFee });

      const history = await sendPrivacyToken({
        accountKeySet: this.accountKeySet,
        nativeAvailableCoins: await this.getNativeAvailableCoins(),
        privacyAvailableCoins: await this.getAvailableCoins(),
        nativeFee,
        privacyFee,
        privacyPaymentInfoList: paymentList,
        tokenId: this.tokenId,
        tokenName: this.name,
        tokenSymbol: this.symbol,
      });
  
      L.info(`Privacy token ${this.tokenId} transfered successfully with tx id ${history.txId}`);
  
      return history;
    } catch (e) {
      L.error(`Privacy token ${this.tokenId} transfered failed`, e);
      throw e;
    }
  }

  async createRawTx(paymentList: PaymentInfoModel[], nativeFee: number, privacyFee: number) {
    try {
      new Validator('paymentList', paymentList).required().paymentInfoList();
      new Validator('nativeFee', nativeFee).required().amount();
      new Validator('privacyFee', privacyFee).required().amount();
  
      L.info(`Create raw privacy token ${this.tokenId} tx`, { paymentList, nativeFee, privacyFee });

      const res = await createRawPrivacyTokenTx({
        accountKeySet: this.accountKeySet,
        nativeAvailableCoins: await this.getNativeAvailableCoins(),
        privacyAvailableCoins: await this.getAvailableCoins(),
        nativeFee,
        privacyFee,
        privacyPaymentInfoList: paymentList,
        tokenId: this.tokenId,
        tokenName: this.name,
        tokenSymbol: this.symbol,
      });
  
      return res;
    } catch (e) {
      L.error(`Create privacy token ${this.tokenId} raw tx failed`, e);
      throw e;
    }
  }

  static async sendRawTx(b58CheckEncodeTx: string) {
    try {
      return sendRawPrivacyTokenTx(b58CheckEncodeTx);
    } catch (e) {
      L.error('Send Privacy token raw tx failed', e);
      throw e;
    }
  }

  async burning(outchainAddress: string, burningAmount: number, nativeFee: number, privacyFee: number) {
    try {
      new Validator('outchainAddress', outchainAddress).required().string();
      new Validator('burningAmount', burningAmount).required().amount();
      new Validator('nativeFee', nativeFee).required().amount();
      new Validator('privacyFee', privacyFee).required().amount();
  
      L.info(`Privacy token ${this.tokenId} send burning request`, {outchainAddress, burningAmount, nativeFee, privacyFee});

      const history = await sendBurningRequest({
        accountKeySet: this.accountKeySet,
        nativeAvailableCoins: await this.getNativeAvailableCoins(),
        privacyAvailableCoins: await this.getAvailableCoins(),
        nativeFee,
        privacyFee,
        tokenId: this.tokenId,
        tokenName: this.name,
        tokenSymbol: this.symbol,
        outchainAddress,
        burningAmount,
        metaType: BurningRequestMeta,
      });
  
      L.info(`Privacy token ${this.tokenId} send burning request successfully with tx id ${history.txId}`);
  
      return history;
    } catch (e) {
      L.error(`Privacy token ${this.tokenId} sent burning request failed`, e);
      throw e;
    } 
  }

  async createRawTxForBurningToken(outchainAddress: string, burningAmount: number, nativeFee: number, privacyFee: number) {
    try {
      new Validator('outchainAddress', outchainAddress).required().string();
      new Validator('burningAmount', burningAmount).required().amount();
      new Validator('nativeFee', nativeFee).required().amount();
      new Validator('privacyFee', privacyFee).required().amount();
  
      L.info(`Privacy token ${this.tokenId} send burning request`, {outchainAddress, burningAmount, nativeFee, privacyFee});

      const res = await createRawBurningRequestTx({
        accountKeySet: this.accountKeySet,
        nativeAvailableCoins: await this.getNativeAvailableCoins(),
        privacyAvailableCoins: await this.getAvailableCoins(),
        nativeFee,
        privacyFee,
        tokenId: this.tokenId,
        tokenName: this.name,
        tokenSymbol: this.symbol,
        outchainAddress,
        burningAmount,
        metaType: BurningRequestMeta,
      });
      return res;
    } catch (e) {
      L.error(`Privacy token ${this.tokenId} create burning request failed`, e);
      throw e;
    } 
  }

  async createRawTxForBurningDepositToSCRequest(outchainAddress: string, burningAmount: number, nativeFee: number, privacyFee: number) {
    try {
      new Validator('outchainAddress', outchainAddress).required().string();
      new Validator('burningAmount', burningAmount).required().amount();
      new Validator('nativeFee', nativeFee).required().amount();
      new Validator('privacyFee', privacyFee).required().amount();
  
      L.info(`Privacy token ${this.tokenId} send burning request despoit to smart contract`, {outchainAddress, burningAmount, nativeFee, privacyFee});

      const res = await createRawBurningRequestTx({
        accountKeySet: this.accountKeySet,
        nativeAvailableCoins: await this.getNativeAvailableCoins(),
        privacyAvailableCoins: await this.getAvailableCoins(),
        nativeFee,
        privacyFee,
        tokenId: this.tokenId,
        tokenName: this.name,
        tokenSymbol: this.symbol,
        outchainAddress,
        burningAmount,
        metaType: BurningRequestDepositToSCMeta,
      });
      return res;
    } catch (e) {
      L.error(`Privacy token ${this.tokenId} create burning request deposit to smart contract failed`, e);
      throw e;
    } 
  }

  async pdeContribution(pdeContributionPairID: string, contributedAmount: number, nativeFee: number, privacyFee: number) {
    try {
      new Validator('pdeContributionPairID', pdeContributionPairID).required().string();
      new Validator('contributedAmount', contributedAmount).required().amount();
      new Validator('nativeFee', nativeFee).required().amount();
      new Validator('privacyFee', privacyFee).required().amount();
  
      L.info(`Privacy token ${this.tokenId} sent PDE contribution request`, {pdeContributionPairID, contributedAmount, nativeFee, privacyFee});

      const history = await sendPrivacyTokenPdeContribution({
        accountKeySet: this.accountKeySet,
        availableNativeCoins: await this.getNativeAvailableCoins(),
        privacyAvailableCoins: await this.getAvailableCoins(),
        nativeFee,
        pdeContributionPairID,
        tokenId: this.tokenId,
        contributedAmount,
        privacyFee,
        tokenSymbol: this.symbol,
        tokenName: this.name
      });
  
      L.info(`Privacy token ${this.tokenId} sent PDE contribution request successfully with tx id ${history.txId}`);
  
      return history;
    } catch (e) {
      L.error(`Privacy token ${this.tokenId} sent PDE contribution request failed`, e);
      throw e;
    }
  }

  async requestTrade(tokenIdBuy: TokenIdType, sellAmount: number, minimumAcceptableAmount: number, nativeFee: number, privacyFee: number, tradingFee: number) {
    try {
      new Validator('tokenIdBuy', tokenIdBuy).required().string();
      new Validator('sellAmount', sellAmount).required().amount();
      new Validator('minimumAcceptableAmount', minimumAcceptableAmount).required().amount();
      new Validator('nativeFee', nativeFee).required().amount();
      new Validator('privacyFee', privacyFee).required().amount();
      new Validator('tradingFee', tradingFee).required().amount();
  
      L.info(`Privacy token ${this.tokenId} sent trade request`, {tokenIdBuy, sellAmount, minimumAcceptableAmount, nativeFee, privacyFee, tradingFee});

      const history = await sendPrivacyTokenPdeTradeRequest({
        accountKeySet: this.accountKeySet,
        availableNativeCoins: await this.getNativeAvailableCoins(),
        privacyAvailableCoins: await this.getAvailableCoins(),
        nativeFee,
        tradingFee,
        privacyFee,
        tokenIdBuy,
        sellAmount,
        minimumAcceptableAmount,
        tokenName: this.name,
        tokenSymbol: this.symbol,
        tokenId: this.tokenId,
      });
  
      L.info(`Privacy token ${this.tokenId} sent trade request successfully with tx id ${history.txId}`);
  
      return history;
    } catch (e) {
      L.error(`Privacy token ${this.tokenId} sent trade request failed`, e);
      throw e;
    }
  }

  /**
   * Convert your crypto from other chains to privacy version from the Incognito chain - private 100%.
   * This method will generate a temporary address, this temp address will be expired in 60 minutes.
   * Then, send/transfer you crypto to this temp address, the process will be completed in several minutes.
   * Use `bridgeGetHistory` method to check the histories.
   */
  async bridgeGenerateDepositAddress() {
    try {
      if (!this.bridgeInfo) {
        throw new ErrorCode(`Token ${this.tokenId} does not support deposit function`);
      }

      L.info('Create deposit request', {
        tokenId: this.tokenId,
        currencyType: this.bridgeInfo.currencyType,
        paymentAddress: this.accountKeySet.paymentAddressKeySerialized,
      });

      let tempAddress;
      const commonParams = {
        paymentAddress: this.accountKeySet.paymentAddressKeySerialized,
        walletAddress: this.accountKeySet.paymentAddressKeySerialized,
        tokenId: this.tokenId,
        currencyType: this.bridgeInfo.currencyType
      };

      if (this.bridgeEthereum) {
        tempAddress = await genETHDepositAddress(commonParams);
      } else if (this.bridgeErc20Token) {
        tempAddress = await genERC20DepositAddress({
          ...commonParams,
          tokenContractID: this.bridgeInfo.contractID
        });
      } else {
        tempAddress = await genCentralizedDepositAddress(commonParams);
      }

      L.info(`Generated temp deposit address successfully: ${tempAddress}`);

      L.warning(`The temp deposit address (${tempAddress}) is only available in 60 mins from now`);

      return tempAddress;
    } catch (e) {
      L.error('Generated temp deposit address failed', e);
      throw e;
    }
  }

  async bridgeGetHistory() {
    try {
      if (!this.bridgeInfo) {
        throw new ErrorCode(`Token ${this.tokenId} does not support bridge history function`);
      }

      const histories = await getBridgeHistory({
        paymentAddress: this.accountKeySet.paymentAddressKeySerialized,
        tokenId: this.tokenId
      });

      L.info('Get bridge history successfully');

      return histories;
    } catch (e) {
      L.error('Get bridge history failed', e);
      throw e;
    }
  }

  private async bridgeWithdrawCentralized(outchainAddress: string, decimalAmount: number, nanoAmount: number, nativeFee: number = 0, privacyFee: number = 0, memo?: string) {
    try {
      L.info(`Bridge withdraw centralized token ${this.tokenId}`, { decimalAmount, nanoAmount, nativeFee, privacyFee, memo });
      // get temp address
      const tempAddress = await genCentralizedWithdrawAddress({
        amount: decimalAmount,
        paymentAddress: outchainAddress,
        walletAddress: this.accountKeySet.paymentAddressKeySerialized,
        tokenId: this.tokenId,
        currencyType: this.bridgeInfo.currencyType,
        memo
      });

      L.info(`Bridge withdraw centralized token ${this.tokenId} get temporary address`, { tempAddress, outchainAddress });

      const privacyPaymentInfoList = [new PaymentInfoModel({ paymentAddress: tempAddress, amount: nanoAmount + privacyFee, message: '' })];
      const nativePaymentInfoList = nativeFee && [new PaymentInfoModel({ paymentAddress: tempAddress, amount: nativeFee, message: '' })];

      // transfer coin to master account
      const history = await sendPrivacyToken({
        accountKeySet: this.accountKeySet,
        nativeAvailableCoins: await this.getNativeAvailableCoins(),
        privacyAvailableCoins: await this.getAvailableCoins(),
        nativeFee,
        privacyFee,
        tokenId: this.tokenId,
        tokenName: this.name,
        tokenSymbol: this.symbol,
        privacyPaymentInfoList,
        ...nativePaymentInfoList ? { nativePaymentInfoList }: {},
      });

      L.info(`Bridge withdraw centralized token ${this.tokenId} transfered with tx id ${history.txId}`, { privacyPaymentInfoList, nativePaymentInfoList });

      if (privacyFee) {
        await updatePTokenFee({ fee: privacyFee, paymentAddress: this.accountKeySet.paymentAddressKeySerialized });
        L.info(`Bridge withdraw centralized token ${this.tokenId} updated privacy fee`, { privacyFee, paymentAddress: this.accountKeySet.paymentAddressKeySerialized });
      }
    } catch (e) {
      L.error(`Bridge withdraw centralized token ${this.tokenId} failed`, e);
      throw e;
    } 
  }

  private async bridgeWithdrawDecentralized(outchainAddress: string, decimalAmount: number, nanoAmount: number, nativeFee: number = 0, privacyFee: number = 0) {
    try {
      L.info(`Bridge withdraw decentralized token ${this.tokenId}`, { outchainAddress, decimalAmount, nanoAmount, nativeFee, privacyFee });

      const burningHistory = await this.burning(outchainAddress, nanoAmount + privacyFee, nativeFee, privacyFee);

      L.info(`Bridge withdraw decentralized token ${this.tokenId} burned with id ${burningHistory.txId}`, { outchainAddress, amount: nanoAmount + privacyFee, nativeFee, privacyFee });

      if (this.bridgeEthereum) {
        const isAdded = await addETHTxWithdraw({
          amount: decimalAmount,
          originalAmount: nanoAmount,
          paymentAddress: outchainAddress,
          walletAddress: this.accountKeySet.paymentAddressKeySerialized,
          tokenId: this.tokenId,
          currencyType: this.bridgeInfo.currencyType,
          burningTxId: burningHistory.txId,
        });

        if (!isAdded) {
          throw new ErrorCode('Add ETH tx withdraw failed');
        }

        L.info(`Bridge withdraw decentralized token ${this.tokenId} added ETH withraw info`);
      } else if (this.bridgeErc20Token) {
        const isAdded = await addERC20TxWithdraw({
          amount: decimalAmount,
          originalAmount: nanoAmount,
          paymentAddress: outchainAddress,
          walletAddress: this.accountKeySet.paymentAddressKeySerialized,
          tokenId: this.tokenId,
          currencyType: this.bridgeInfo.currencyType,
          burningTxId: burningHistory.txId,
          tokenContractID: this.bridgeInfo.contractID
        });

        if (!isAdded) {
          throw new ErrorCode('Add ERC20 tx withdraw failed');
        }

        L.info(`Bridge withdraw decentralized token ${this.tokenId} added ERC20 withraw info`);
      }
    } catch (e) {
      L.error(`Bridge withdraw decentralized token ${this.tokenId} failed`, e);
      throw e;
    }
  }

  /**
   * Convert privacy token to origin, your privacy token will be burned and the origin will be returned
   * @param {number} decimalAmount accept amount in decimal number (ex: 1.2 ETH, 0.5 BTC,...)
   * @note aaa
   */
  async bridgeWithdraw(outchainAddress: string, decimalAmount: number, nativeFee: number = 0, privacyFee: number = 0, memo?: string) {
    try {
      new Validator('decimalAmount', decimalAmount).required().number().largerThan(0);
      new Validator('nativeFee', nativeFee).required().amount();
      new Validator('outchainAddress', outchainAddress).required().string();
      new Validator('privacyFee', privacyFee).required().amount();

      const memoValidator = new Validator('memo', memo).string();

      if (this.bridgeBinance) {
        memoValidator.required('Binance memo is required').maxLength(125);
      }

      const nanoAmount = convertDecimalToNanoAmount(decimalAmount, this.bridgeInfo.pDecimals);
      new Validator('nanoAmount', nanoAmount).required().amount();
      
      L.info(`Bridge withraw token ${this.tokenId}`, { outchainAddress, decimalAmount, nanoAmount, nativeFee, privacyFee, memo });

      if (!this.bridgeInfo) {
        throw new ErrorCode(`Token ${this.tokenId} does not support withdraw function`);
      }

      if (this.bridgeEthereum || this.bridgeErc20Token) {
        // DECENTRALIZED COINS (eth && ERC-20 tokens)
        await this.bridgeWithdrawDecentralized(outchainAddress, decimalAmount, nanoAmount, nativeFee, privacyFee);    
      } else {
        // CENTRALIZED COINS 
        await this.bridgeWithdrawCentralized(outchainAddress, decimalAmount, nanoAmount, nativeFee, privacyFee, memo);        
      }
      L.info(`Bridge withraw token ${this.tokenId} successfully`);
    } catch (e) {
      L.error(`Bridge withraw token ${this.tokenId} failed`, e);
      throw e;
    }
  }
}

export default PrivacyToken;