## Automating Liquidity Withdrawals for Omen.eth Users

This repo contains tests showcasing how liquidity providers on Omen.eth or any other UI that supports the Conditional Token Smart Contracts can automate withdrawing liquidity from `FixedProductMarketMakers` using Gelato. Neither Truffle nor Buidler is used, simply Ethers.js, a Ganache Mainnet fork & Jest.

## Run locally

1. Add `INFURA_KEY` and a mainnet private key (`PK`) to your `.env` file


2. Run:

```
npm install
npx jest
```