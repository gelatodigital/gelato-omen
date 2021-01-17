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
const ALCHEMY_ID_RINKEBY = process.env.ALCHEMY_ID_RINKEBY;
const DEPLOYER = "0xAabB54394E8dd61Dd70897E9c80be8de7C64A895";
const DEPLOYER_PK_MAINNET = process.env.DEPLOYER_PK_MAINNET;

const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const USD_ADDRESS = "0x7354C81fbCb229187480c4f497F945C6A312d5C3";

const mainnetAddresses = {
  oracleAggregator: "0x479bb758024d768e4153031AC3F8Cd1e458Bd6c2",
  masterCopy111: "0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F",
  masterCopy120: "0x6851D6fDFAfD08c0295C392436245E5bc78B0185",
  gelatoCore: "0x025030bdaa159f281cae63873e68313a703725a5",
  gelatoActionPipeline: "0xD2540644c2B110A8f45BDE903E111fA518d41B6c",
  cpkFactory: "0x0fB4340432e56c014fa96286de17222822a9281b",
  uniswapV2Router02: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  externalProvider: "0x3d9A46b5D421bb097AC28B4f70a4A1441A12920C",
  timeCondition: "0x63129681c487d231aa9148e1e21837165f38deaf",
  gnosisSafeProviderModule: "0x2E87AD9BBdaa9113cd5cA1920c624E2749D7086B",
  multiSendAddress: "0xB522a9f781924eD250A11C54105E51840B138AdD",
  fallbackHandlerAddress: "0x40A930851BD2e590Bd5A5C981b436de25742E980",
  conditionalTokens: "0xC59b0e4De5F1248C1140964E0fF287B192407E0C",
  fixedProductMarketMakerFactory: "0x01FCd2353bBd92234A87FDC9d543ae995e61196C",
  fPMMDeterministicFactory: "0x89023DEb1d9a9a62fF3A5ca8F23Be8d87A576220",
  ethAddress: ETH_ADDRESS,
  usdAddress: USD_ADDRESS,
  aaveAddress: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
  adxAddress: "0xADE00C28244d5CE17D72E40330B1c318cD12B7c3",
  batAddress: "0x0D8775F648430679A709E98d2b0Cb6250d2887EF",
  bnbAddress: "0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
  bntAddress: "0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C",
  busdAddress: "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
  bzrxAddress: "0x56d811088235F11C8920698a204A5010a788f4b3",
  compAddress: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
  croAddress: "0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b",
  daiAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  dmgAddress: "0xEd91879919B71bB6905f23af0A68d231EcF87b14",
  enjAddress: "0x24D9aB51950F3d62E9144fdC2f3135DAA6Ce8D1B",
  gnoAddress: "0x6810e776880c02933d47db1b9fc05908e5386b96",
  kncAddress: "0xdd974D5C2e2928deA5F71b9825b8b646686BD200",
  linkAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  lrcAddress: "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD",
  manaAddress: "0x0F5D2fB29fb7d3CFeE444a200298f468908cC942",
  mkrAddress: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
  nmrAddress: "0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671",
  renAddress: "0x408e41876cCCDC0F92210600ef50372656052a38",
  repAddress: "0x221657776846890989a759BA2973e427DfF5C9bB",
  snxAddress: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
  susdAddress: "0x57Ab1ec28D129707052df4dF418D58a2D46d5f51",
  sxpAddress: "0x8CE9137d39326AD0cD6491fb5CC0CbA0e089b6A9",
  tusdAddress: "0x0000000000085d4780B73119b644AE5ecd22b376",
  uniAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  usdcAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  usdtAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  wethAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  womAddress: "0xa982B2e19e90b2D9F7948e9C1b65D119F1CE88D6",
  yfiAddress: "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e",
  zrxAddress: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
};

let mainnetOracles = {};
mainnetOracles[mainnetAddresses.usdAddress] = {
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE":
    "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4",
};
mainnetOracles[mainnetAddresses.ethAddress] = {
  "0x7354C81fbCb229187480c4f497F945C6A312d5C3":
    "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
};
mainnetOracles[mainnetAddresses.repAddress] = {
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE":
    "0xD4CE430C3b67b3E2F7026D86E7128588629e2455",
};

const mainnetAddressBook = {
  addresses: mainnetAddresses,
  oracles: mainnetOracles,
};

// ================================= CONFIG =========================================
module.exports = {
  defaultNetwork: "hardhat",
  // hardhat-deploy
  namedAccounts: {
    deployer: {
      default: 0,
      mainnet: DEPLOYER,
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
        blockNumber: 11674075,
      },
      // Accounts
      accounts: {
        accountsBalance: "1000000000000000000000000",
      },
      ...mainnetAddressBook,
      ...omenAbis,
      // Custom
      //   ...mainnetDeployments,
    },
    rinkeby: {
      addresses: {
        oracleAggregator: "0x399cFce1F3f5AB74C46d9F0361BE18f87c23FCC3",
        masterCopy111: "0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F",
        masterCopy120: "0x6851D6fDFAfD08c0295C392436245E5bc78B0185",
        gelatoCore: "0x733aDEf4f8346FD96107d8d6605eA9ab5645d632",
        gelatoActionPipeline: "0xbB193c525fdB29Cdea7261452568D83AD476ed5D",
        cpkFactory: "0x336c19296d3989e9e0c2561ef21c964068657c38",
        uniswapV2Router02: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        wethAddress: "0xc778417e063141139fce010982780140aa0cd5ab",
      },
      accounts: DEPLOYER_PK_MAINNET ? [DEPLOYER_PK_MAINNET] : [],
      gasPrice: parseInt(utils.parseUnits("1", "gwei")),
      url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_ID_RINKEBY}`,
    },
    mainnet: {
      ...mainnetAddressBook,
      accounts: DEPLOYER_PK_MAINNET ? [DEPLOYER_PK_MAINNET] : [],
      chainId: 1,
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
      gasPrice: parseInt(utils.parseUnits("45", "gwei")),
      timeout: 150000,
      // Custom
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.6.10",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        version: "0.7.4",
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

task(
  "determineCpkProxyAddress",
  `Determines gnosis safe proxy address from cpk factory on [--network]`
)
  .addOptionalPositionalParam(
    "mastercopy",
    "address of EOA whose proxy to derive"
  )
  .addFlag("log", "Logs return values to stdout")
  .setAction(async ({ mastercopy, log }, hre) => {
    try {
      const useraddress = "0xAabB54394E8dd61Dd70897E9c80be8de7C64A895";

      // Standard CPK Factory Saltnonce
      const saltnonce =
        "0xcfe33a586323e7325be6aa6ecd8b4600d232a9037e83c8ece69413b777dabe65";

      const create2Salt = hre.ethers.utils.keccak256(
        utils.defaultAbiCoder.encode(
          ["address", "uint256"],
          [useraddress, saltnonce]
        )
      );

      const proxyFactory = hre.network.config.addresses.cpkFactory;

      const proxyFactoryContract = await hre.ethers.getContractAt(
        ["function proxyCreationCode() external pure returns (bytes memory)"],
        proxyFactory
      );

      const proxyFactoryCreationCode = await proxyFactoryContract.proxyCreationCode();

      const gnosisSafeAddress = hre.ethers.utils.getAddress(
        utils
          .solidityKeccak256(
            ["bytes", "address", "bytes32", "bytes32"],
            [
              "0xff",
              proxyFactory,
              create2Salt,
              utils.solidityKeccak256(
                ["bytes", "bytes"],
                [
                  proxyFactoryCreationCode,
                  utils.defaultAbiCoder.encode(["address"], [mastercopy]),
                ]
              ),
            ]
          )
          .slice(-40)
      );

      if (log) console.log(`Proxy Address: ${gnosisSafeAddress}`);

      return gnosisSafeAddress;
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });

task("getProxyExtcodeHash", "determines gnosis safe proxy extcodehash")
  .addPositionalParam("safeAddress")
  .addFlag("log", "Logs return values to stdout")
  .setAction(async ({ safeAddress, log }, hre) => {
    // @dev check if contract is Gnosis Safe
    // @dev passes if contract is mastercopy
    try {
      const gnosisSafe = await hre.ethers.getContractAt(
        ["function NAME() view returns(string)"],
        safeAddress
      );
      if ((await gnosisSafe.NAME()) !== "Gnosis Safe")
        throw Error("Contract not a Gnosis Safe");
    } catch (err) {
      throw Error("Err: Contract not a Gnosis Safe");
    }

    if (log) console.log(`Finding Extcode hash for contract: ${safeAddress}`);
    const extcode = await hre.ethers.provider.getCode(safeAddress);
    if (extcode.toString() === "0x") throw Error("No Contract Found!");
    if (log) console.log(`Extcode: ${extcode}`);
    const extcodeHash = hre.ethers.utils.solidityKeccak256(
      ["bytes"],
      [extcode]
    );
    if (log) console.log(`extcodeHash: ${extcodeHash}`);
    return extcodeHash;
  });
