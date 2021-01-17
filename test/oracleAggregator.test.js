const { expect } = require("chai");
const hre = require("hardhat");
const { deployments, ethers } = hre;
const { getPriceFromOracle } = require("./helpers");

const ETH_ADDRESS = hre.network.config.addresses.ethAddress;
const USD_ADDRESS = hre.network.config.addresses.usdAddress;

const tokens = {
  ETH: ETH_ADDRESS,
  USD: USD_ADDRESS,
  AAVE: hre.network.config.addresses.aaveAddress,
  ADX: hre.network.config.addresses.adxAddress,
  DAI: hre.network.config.addresses.daiAddress,
  KNC: hre.network.config.addresses.kncAddress,
  SXP: hre.network.config.addresses.sxpAddress,
  UNI: hre.network.config.addresses.uniAddress,
  USDC: hre.network.config.addresses.usdcAddress,
};

describe("OracleAggregator.sol: Return Value Checks", async function () {
  this.timeout(0);
  before(async () => {
    await deployments.fixture();
    this.oracleAggregator = await ethers.getContract("OracleAggregator");
  });

  it("Verify Price Oracle expected return", async () => {
    const ether = ethers.utils.parseEther("1");
    const decimals = {
      DAI: ether,
      ETH: ether,
      USDC: 10 ** 6,
      UNI: ether,
      KNC: ether,
      SXP: ether,
      AAVE: ether,
      ADX: ether,
    };

    // Test 'basic' pairs i.e. pairs that have a direct chainlink oracle lookup
    const basicPairs = [
      ["DAI", "ETH", hre.network.config.oracles[USD_ADDRESS][ETH_ADDRESS]],
      ["ETH", "USDC", hre.network.config.oracles[ETH_ADDRESS][USD_ADDRESS]],
      ["AAVE", "ETH", hre.network.config.oracles[tokens["AAVE"]][ETH_ADDRESS]],
      ["KNC", "USDC", hre.network.config.oracles[tokens["KNC"]][USD_ADDRESS]],
      ["KNC", "ETH", hre.network.config.oracles[tokens["KNC"]][ETH_ADDRESS]],
      ["ADX", "DAI", hre.network.config.oracles[tokens["ADX"]][USD_ADDRESS]],
      ["SXP", "USDC", hre.network.config.oracles[tokens["SXP"]][USD_ADDRESS]],
      ["UNI", "ETH", hre.network.config.oracles[tokens["UNI"]][ETH_ADDRESS]],
    ];
    for (let i = 0; i < basicPairs.length; i++) {
      let [tokenA, tokenB, chainlinkOracle] = basicPairs[i];
      let rawAmount = (
        await this.oracleAggregator.getExpectedReturnAmount(
          decimals[tokenA],
          tokens[tokenA],
          tokens[tokenB]
        )
      ).returnAmount;
      let amount = rawAmount / decimals[tokenB];
      console.log(`    - 1 ${tokenA} is worth ${amount.toFixed(4)} ${tokenB}`);
      let check = await getPriceFromOracle(chainlinkOracle);
      expect(Number(amount).toFixed(3)).to.be.eq(Number(check).toFixed(3));
    }

    // Test 'inverse' pairs i.e. the basic pairs but in reverse order from chainlink oracle
    const inversePairs = [
      ["ETH", "AAVE", hre.network.config.oracles[tokens["AAVE"]][ETH_ADDRESS]],
      ["USDC", "KNC", hre.network.config.oracles[tokens["KNC"]][USD_ADDRESS]],
      ["ETH", "KNC", hre.network.config.oracles[tokens["KNC"]][ETH_ADDRESS]],
      ["DAI", "ADX", hre.network.config.oracles[tokens["ADX"]][USD_ADDRESS]],
      ["USDC", "SXP", hre.network.config.oracles[tokens["SXP"]][USD_ADDRESS]],
      ["ETH", "UNI", hre.network.config.oracles[tokens["UNI"]][ETH_ADDRESS]],
    ];
    for (let j = 0; j < inversePairs.length; j++) {
      let [tokenA, tokenB, chainlinkOracle] = inversePairs[j];
      let rawAmount = (
        await this.oracleAggregator.getExpectedReturnAmount(
          decimals[tokenA],
          tokens[tokenA],
          tokens[tokenB]
        )
      ).returnAmount;
      let amount = rawAmount / decimals[tokenB];
      console.log(`    - 1 ${tokenA} is worth ${amount.toFixed(4)} ${tokenB}`);
      let check = await getPriceFromOracle(chainlinkOracle);
      expect(Math.abs(Number(amount - 1 / check))).to.be.lt(
        Number(amount / 100)
      );
    }

    // Test 'hard' pairs i.e. pairs that utilize multiple chainlink lookups to compute result
    let amounts = [];
    const hardPairs = [
      ["UNI", "SXP"],
      ["SXP", "UNI"],
      ["UNI", "USDC"],
      ["SXP", "ETH"],
      ["ADX", "ETH"],
      ["AAVE", "DAI"],
      ["AAVE", "ADX"],
      ["ADX", "AAVE"],
      ["AAVE", "SXP"],
      ["SXP", "ADX"],
      ["ADX", "SXP"],
      ["AAVE", "UNI"],
      ["UNI", "AAVE"],
      ["ADX", "UNI"],
      ["UNI", "ADX"],
    ];
    for (let k = 0; k < hardPairs.length; k++) {
      let [tokenA, tokenB] = hardPairs[k];
      let rawAmount = (
        await this.oracleAggregator.getExpectedReturnAmount(
          decimals[tokenA],
          tokens[tokenA],
          tokens[tokenB]
        )
      ).returnAmount;
      let amount = rawAmount / decimals[tokenB];
      amounts.push(amount);
      console.log(`    - 1 ${tokenA} is worth ${amount.toFixed(4)} ${tokenB}`);
    }
    let [
      uniSxp,
      sxpUni,
      uniUsd,
      sxpEth,
      adxEth,
      aaveUsd,
      aaveAdx,
      adxAave,
      aaveSxp,
      sxpAdx,
      adxSxp,
      aaveUni,
      uniAave,
      adxUni,
      uniAdx,
    ] = amounts;
    expect(Math.round(Number(uniSxp * sxpUni))).to.be.eq(1);
    expect(Math.round(Number(aaveAdx * adxAave))).to.be.eq(1);
    expect(Math.round(Number(sxpAdx * adxSxp))).to.be.eq(1);
    expect(Math.round(Number(aaveUni * uniAave))).to.be.eq(1);
    expect(Math.round(Number(adxUni * uniAdx))).to.be.eq(1);
    let sxpUsd = await getPriceFromOracle(
      hre.network.config.oracles[tokens["SXP"]][USD_ADDRESS]
    );
    let adxUsd = await getPriceFromOracle(
      hre.network.config.oracles[tokens["ADX"]][USD_ADDRESS]
    );
    let uniEth = await getPriceFromOracle(
      hre.network.config.oracles[tokens["UNI"]][ETH_ADDRESS]
    );
    let aaveEth = await getPriceFromOracle(
      hre.network.config.oracles[tokens["AAVE"]][ETH_ADDRESS]
    );
    expect(Math.abs(Number(uniUsd * sxpUni - sxpUsd))).to.be.lt(
      Number(sxpUsd / 100)
    );
    expect(Math.abs(Number(aaveUsd * adxAave - adxUsd))).to.be.lt(
      Number(adxUsd / 100)
    );
    expect(Math.abs(Number(sxpEth * aaveSxp - aaveEth))).to.be.lt(
      Number(aaveEth / 100)
    );
    expect(Math.abs(Number(adxEth * uniAdx - uniEth))).to.be.lt(
      Number(uniEth / 100)
    );
  });
});
