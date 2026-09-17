const hre = require("hardhat");

async function main() {
  console.log("Preparing deployment of TriageAnchor contract...");

  const TriageAnchor = await hre.ethers.getContractFactory("TriageAnchor");
  const contract = await TriageAnchor.deploy();
  await contract.deployed();

  console.log("---------------------------------------------------------");
  console.log("TriageAnchor contract successfully deployed!");
  console.log("Contract Address:", contract.address);
  console.log("Network:", hre.network.name);
  console.log("---------------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
