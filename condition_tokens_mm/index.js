const conditionalTokensAbi = require("./abis/ConditionalTokens.json").abi;
const fixedProductMarketMakerAbi = require("./abis/FixedProductMarketMaker.json")
  .abi;
const fixedProductMarketMakerFactoryAbi = require("./abis/FixedProductMarketMakerFactory.json")
  .abi;
const fPMMDeterministicFactoryAbi = require("./abis/FPMMDeterministicFactory.json")
  .abi;

module.exports = {
  abis: {
    conditionalTokensAbi,
    fixedProductMarketMakerAbi,
    fixedProductMarketMakerFactoryAbi,
    fPMMDeterministicFactoryAbi,
  },
  // conditionalTokens: {
  //   address: "0xC59b0e4De5F1248C1140964E0fF287B192407E0C",
  //   abi: conditionalTokensAbi,
  // },
  // fixedProductMarketMaker: {
  //   address: "depends on the deployment by factory",
  //   abi: fixedProductMarketMakerAbi,
  // },
  // fixedProductMarketMakerFactory: {
  //   address: "0x01FCd2353bBd92234A87FDC9d543ae995e61196C",
  //   abi: fixedProductMarketMakerFactoryAbi,
  // },
  // fPMMDeterministicFactory: {
  //   address: "0x89023DEb1d9a9a62fF3A5ca8F23Be8d87A576220",
  //   abi: fPMMDeterministicFactoryAbi,
  // },
};
