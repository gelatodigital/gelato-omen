const hre = require("hardhat");
const { ethers } = hre;

const getPriceFromOracle = async (oracleAddress) => {
  const ChainlinkOracle = await ethers.getContractAt(
    "IGasPriceOracle",
    oracleAddress
  );

  const oracleLatestAnswer = await ChainlinkOracle.latestAnswer();
  const oracleDecimals = await ChainlinkOracle.decimals();
  const oraclePrice =
    parseInt(oracleLatestAnswer) / Math.pow(10, parseInt(oracleDecimals));

  return oraclePrice;
};

const fromWei = (x) => ethers.utils.formatUnits(x, 18);

const getIndexSets = (outcomesCount) => {
  const range = (length) => [...Array(length)].map((x, i) => i);
  return range(outcomesCount).map((x) => 1 << x);
};

module.exports = {
  getPriceFromOracle,
  fromWei,
  getIndexSets,
};
