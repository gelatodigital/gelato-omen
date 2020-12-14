const { sleep } = require("@gelatonetwork/core");

module.exports = async (hre) => {
  if (hre.network.name === "mainnet") {
    console.log(
      "\n\n Deploying ProviderModuleGnosisSafe to mainnet. Hit ctrl + c to abort"
    );
    console.log("❗ CONNECTOR DEPLOYMENT: VERIFY");
    await sleep(10000);
  }
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  const safeAddress1 = await hre.run("determineCpkProxyAddress", {
    mastercopy: hre.network.config.addresses.masterCopy111,
  });

  // @dev exctodeHash is the same for different mastercopies as its the bytecode
  // of the proxy contract, not the mastercopy
  const extcodeHash1 = await hre.run("getProxyExtcodeHash", {
    safeAddress: safeAddress1,
  });

  await deploy("ProviderModuleGnosisSafe", {
    from: deployer,
    args: [
      [extcodeHash1],
      [
        hre.network.config.addresses.masterCopy111,
        hre.network.config.addresses.masterCopy120,
      ],
      hre.network.config.addresses.gelatoCore,
      hre.network.config.addresses.gelatoActionPipeline,
    ],
    gasPrice: hre.network.config.gasPrice,
    log: true,
    gasLimit: 5000000,
  });
};
module.exports.tags = ["ProviderModuleGnosisSafe"];
