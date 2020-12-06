const { expect } = require("chai");
const hre = require("hardhat");
const { deployments, ethers } = hre;
const { getPriceFromOracle } = require("./helpers");

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
      ["DAI", "ETH", hre.network.config.addresses.chainlink.USD_ETH],
      ["ETH", "USDC", hre.network.config.addresses.chainlink.ETH_USD],
      ["AAVE", "ETH", hre.network.config.addresses.chainlink.AAVE_ETH],
      ["KNC", "USDC", hre.network.config.addresses.chainlink.KNC_USD],
      ["KNC", "ETH", hre.network.config.addresses.chainlink.KNC_ETH],
      ["ADX", "DAI", hre.network.config.addresses.chainlink.ADX_USD],
      ["SXP", "USDC", hre.network.config.addresses.chainlink.SXP_USD],
      ["UNI", "ETH", hre.network.config.addresses.chainlink.UNI_ETH],
    ];
    for (let i = 0; i < basicPairs.length; i++) {
      let [tokenA, tokenB, chainlinkOracle] = basicPairs[i];
      let rawAmount = await this.oracleAggregator.getExpectedReturnAmount(
        decimals[tokenA],
        hre.network.config.addresses.erc20[tokenA],
        hre.network.config.addresses.erc20[tokenB]
      );
      let amount = rawAmount / decimals[tokenB];
      console.log(`    - 1 ${tokenA} is worth ${amount.toFixed(4)} ${tokenB}`);
      let check = await getPriceFromOracle(chainlinkOracle);
      expect(Number(amount).toFixed(3)).to.be.eq(Number(check).toFixed(3));
    }

    // Test 'inverse' pairs i.e. the basic pairs but in reverse order from chainlink oracle
    const inversePairs = [
      ["ETH", "AAVE", hre.network.config.addresses.chainlink.AAVE_ETH],
      ["USDC", "KNC", hre.network.config.addresses.chainlink.KNC_USD],
      ["ETH", "KNC", hre.network.config.addresses.chainlink.KNC_ETH],
      ["DAI", "ADX", hre.network.config.addresses.chainlink.ADX_USD],
      ["USDC", "SXP", hre.network.config.addresses.chainlink.SXP_USD],
      ["ETH", "UNI", hre.network.config.addresses.chainlink.UNI_ETH],
    ];
    for (let j = 0; j < inversePairs.length; j++) {
      let [tokenA, tokenB, chainlinkOracle] = inversePairs[j];
      let rawAmount = await this.oracleAggregator.getExpectedReturnAmount(
        decimals[tokenA],
        hre.network.config.addresses.erc20[tokenA],
        hre.network.config.addresses.erc20[tokenB]
      );
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
      let rawAmount = await this.oracleAggregator.getExpectedReturnAmount(
        decimals[tokenA],
        hre.network.config.addresses.erc20[tokenA],
        hre.network.config.addresses.erc20[tokenB]
      );
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
      hre.network.config.addresses.chainlink.SXP_USD
    );
    let adxUsd = await getPriceFromOracle(
      hre.network.config.addresses.chainlink.ADX_USD
    );
    let uniEth = await getPriceFromOracle(
      hre.network.config.addresses.chainlink.UNI_ETH
    );
    let aaveEth = await getPriceFromOracle(
      hre.network.config.addresses.chainlink.AAVE_ETH
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
