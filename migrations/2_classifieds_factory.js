const ClassifiedsFactory = artifacts.require("ClassifiedsFactory");

module.exports = function (deployer) {
  console.log(`TODO: set currencyToken address! Placeholder currently used`);
  // TODO: replace this placeholder with the real currency
  const currencyToken = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  deployer.deploy(ClassifiedsFactory, currencyToken);
};
