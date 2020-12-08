// Buidler
const { task, types } = require("hardhat/config");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
// require("hardhat-gas-reporter");

// Libraries
const assert = require("assert");
const { utils } = require("ethers");

const GelatoCoreLib = require("@gelatonetwork/core");
const omenAbis = require("./condition_tokens_mm");

// Process Env Variables
require("dotenv").config();
// const INFURA_ID = process.env.INFURA_ID;
// assert.ok(INFURA_ID, "no Infura ID in process.env");
const ALCHEMY_ID = process.env.ALCHEMY_ID;
assert.ok(ALCHEMY_ID, "no Alchemy ID in process.env");

// ================================= CONFIG =========================================
module.exports = {
  defaultNetwork: "hardhat",
  //   gasReporter: {
  //     enabled: process.env.REPORT_GAS ? true : false,
  //     maxMethodDiff: 25,
  //     coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  //   },
  // hardhat-deploy
  namedAccounts: {
    deployer: {
      default: 0,
    },
    user: {
      default: 0,
    },
    executor: {
      default: 1,
    },
  },
  networks: {
    hardhat: {
      // Standard config
      // timeout: 150000,
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
        // url: `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`,
        blockNumber: 11367046,
      },
      // Accounts
      accounts: {
        accountsBalance: "1000000000000000000000000",
      },
      addresses: {
        gelatoCore: "0x1d681d76ce96E4d70a88A00EBbcfc1E47808d0b8",
        weth: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        uniswapV2Router02: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        externalProvider: "0x3d9A46b5D421bb097AC28B4f70a4A1441A12920C",
        timeCondition: "0x63129681c487d231aa9148e1e21837165f38deaf",
        gnosisSafeProviderModule: "0x3a994Cd3a464032B8d0eAa16F91C446A46c4fEbC",
        masterCopyAddress: "0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F",
        proxyFactoryAddress: "0x0fB4340432e56c014fa96286de17222822a9281b",
        multiSendAddress: "0xB522a9f781924eD250A11C54105E51840B138AdD",
        fallbackHandlerAddress: "0x40A930851BD2e590Bd5A5C981b436de25742E980",
        conditionalTokens: "0xC59b0e4De5F1248C1140964E0fF287B192407E0C",
        fixedProductMarketMakerFactory:
          "0x01FCd2353bBd92234A87FDC9d543ae995e61196C",
        fPMMDeterministicFactory: "0x89023DEb1d9a9a62fF3A5ca8F23Be8d87A576220",
        chainlink: {
          AAVE_ETH: "0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012",
          KNC_USD: "0xf8fF43E991A81e6eC886a3D281A2C6cC19aE70Fc",
          KNC_ETH: "0x656c0544eF4C98A6a98491833A89204Abb045d6b",
          SXP_USD: "0xFb0CfD6c19e25DB4a08D8a204a387cEa48Cc138f",
          UNI_ETH: "0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e",
          USD_ETH: "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4",
          ETH_USD: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
          ADX_USD: "0x231e764B44b2C1b7Ca171fa8021A24ed520Cde10",
        },
        erc20: {
          ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
          KNC: "0xdd974D5C2e2928deA5F71b9825b8b646686BD200",
          SXP: "0x8CE9137d39326AD0cD6491fb5CC0CbA0e089b6A9",
          REP: "0x221657776846890989a759ba2973e427dff5c9bb",
          AAVE: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
          ADX: "0xADE00C28244d5CE17D72E40330B1c318cD12B7c3",
          GNO: "0x6810e776880c02933d47db1b9fc05908e5386b96",
        },
      },
      ...omenAbis,
      // Custom
      //   ...mainnetDeployments,
    },
    // mainnet: {
    //   accounts: DEPLOYER_PK_MAINNET ? [DEPLOYER_PK_MAINNET] : [],
    //   chainId: 1,
    //   url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
    //   gasPrice: parseInt(utils.parseUnits("80", "gwei")),
    //   timeout: 150000,
    //   // Custom
    //   ...mainnetDeployments,
    // },
  },
  solidity: {
    compilers: [
      {
        version: "0.6.10",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },
};

// ================================= TASKS =========================================
task("abi-encode-withselector")
  .addPositionalParam(
    "abi",
    "Contract ABI in array form",
    undefined,
    types.json
  )
  .addPositionalParam("functionname")
  .addOptionalVariadicPositionalParam(
    "inputs",
    "Array of function params",
    undefined,
    types.json
  )
  .addFlag("log")
  .setAction(async (taskArgs) => {
    try {
      if (taskArgs.log) console.log(taskArgs);

      if (!taskArgs.abi)
        throw new Error("abi-encode-withselector: no abi passed");

      const interFace = new utils.Interface(taskArgs.abi);

      let functionFragment;
      try {
        functionFragment = interFace.getFunction(taskArgs.functionname);
      } catch (error) {
        throw new Error(
          `\n ❌ abi-encode-withselector: functionname "${taskArgs.functionname}" not found`
        );
      }

      let payloadWithSelector;

      if (taskArgs.inputs) {
        let iterableInputs;
        try {
          iterableInputs = [...taskArgs.inputs];
        } catch (error) {
          iterableInputs = [taskArgs.inputs];
        }
        payloadWithSelector = interFace.encodeFunctionData(
          functionFragment,
          iterableInputs
        );
      } else {
        payloadWithSelector = interFace.encodeFunctionData(
          functionFragment,
          []
        );
      }

      if (taskArgs.log)
        console.log(`\nEncodedPayloadWithSelector:\n${payloadWithSelector}\n`);
      return payloadWithSelector;
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

task(
  "fetchGelatoGasPrice",
  `Returns the current gelato gas price used for calling canExec and exec`
)
  .addOptionalParam("gelatocoreaddress")
  .addFlag("log", "Logs return values to stdout")
  .setAction(async (taskArgs, hre) => {
    try {
      const gelatoCore = await hre.ethers.getContractAt(
        GelatoCoreLib.GelatoCore.abi,
        taskArgs.gelatocoreaddress
          ? taskArgs.gelatocoreaddress
          : hre.network.config.GelatoCore
      );

      const oracleAbi = ["function latestAnswer() view returns (int256)"];

      const gelatoGasPriceOracleAddress = await gelatoCore.gelatoGasPriceOracle();

      // Get gelatoGasPriceOracleAddress
      const gelatoGasPriceOracle = await hre.ethers.getContractAt(
        oracleAbi,
        gelatoGasPriceOracleAddress
      );

      // lastAnswer is used by GelatoGasPriceOracle as well as the Chainlink Oracle
      const gelatoGasPrice = await gelatoGasPriceOracle.latestAnswer();

      if (taskArgs.log) {
        console.log(
          `\ngelatoGasPrice: ${utils.formatUnits(
            gelatoGasPrice.toString(),
            "gwei"
          )} gwei\n`
        );
      }

      return gelatoGasPrice;
    } catch (error) {
      console.error(error, "\n");
      process.exit(1);
    }
  });

task(
  "hardhatReset",
  "Reset back to a fresh forked state during runtime"
).setAction(async (_, hre) => {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: hre.network.config.forking.url,
          blockNumber: hre.network.config.forking.blockNumber,
        },
      },
    ],
  });
});
