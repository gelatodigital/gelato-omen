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

// const mainnetDeployments = require("./_hardhat/config/mainnet-deployments");

// Process Env Variables
require("dotenv").config();
// const INFURA_ID = process.env.INFURA_ID;
// assert.ok(INFURA_ID, "no Infura ID in process.env");
const ALCHEMY_ID = process.env.ALCHEMY_ID;
assert.ok(ALCHEMY_ID, "no Alchemy ID in process.env");

// const DEPLOYER = "0x5B753BF02a42bC73B5846dfd16a8F2e082b99a6a"; // Gelato-Dev-Luis
// const DEPLOYER_PK_MAINNET = process.env.DEPLOYER_PK_MAINNET;

// ================================= CONFIG =========================================
module.exports = {
  defaultNetwork: "hardhat",
  //   gasReporter: {
  //     enabled: process.env.REPORT_GAS ? true : false,
  //     maxMethodDiff: 25,
  //     coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  //   },
  // hardhat-deploy
  //   namedAccounts: {
  //     deployer: {
  //       default: 0,
  //       mainnet: DEPLOYER,
  //     },
  //     user: {
  //       default: 0,
  //     },
  //     executor: {
  //       default: 1,
  //     },
  //   },
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
      //   {
      //     version: "0.6.6",
      //     settings: {
      //       optimizer: { enabled: process.env.DEBUG ? false : true },
      //     },
      //   },
      //   {
      //     version: "0.6.10",
      //     settings: {
      //       optimizer: { enabled: process.env.DEBUG ? false : true },
      //     },
      //   },
      //   {
      //     version: "0.7.4",
      //     settings: {
      //       optimizer: { enabled: process.env.DEBUG ? false : true },
      //     },
      //   },
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
