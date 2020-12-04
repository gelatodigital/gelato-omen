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
};
