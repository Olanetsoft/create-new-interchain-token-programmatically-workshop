const hre = require("hardhat");
const crypto = require("crypto");
const ethers = hre.ethers;
const {
  AxelarQueryAPI,
  Environment,
  EvmChain,
  GasToken,
} = require("@axelar-network/axelarjs-sdk");

const interchainTokenServiceContractABI = require("./utils/interchainTokenServiceABI");
const interchainTokenFactoryContractABI = require("./utils/interchainTokenFactoryABI");
const interchainTokenContractABI = require("./utils/interchainTokenABI");

const interchainTokenServiceContractAddress =
  "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C";
const interchainTokenFactoryContractAddress =
  "0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D66";

async function getSigner() {
  const [signer] = await ethers.getSigners();
  return signer;
}

async function getContractInstance(contractAddress, contractABI, signer) {
  return new ethers.Contract(contractAddress, contractABI, signer);
}

async function registerAndDeploy() {
  // Create a salt value
  const salt = "0x" + crypto.randomBytes(32).toString("hex");

  // Initialize token info
  const name = "My Interchain Token";
  const symbol = "MIT";
  const decimals = 18;

  // initialize initial token supply
  const initialSupply = ethers.utils.parseUnits("1000000");

  // Get the signer
  const signer = await getSigner();

  // Create the contract instance
  const interchainTokenFactoryContract = await getContractInstance(
    interchainTokenFactoryContractAddress,
    interchainTokenFactoryContractABI,
    signer
  );

  const interchainTokenServiceContract = await getContractInstance(
    interchainTokenServiceContractAddress,
    interchainTokenServiceContractABI,
    signer
  );

  // Get the token ID
  const tokenId = await interchainTokenFactoryContract.interchainTokenId(
    signer.address,
    salt
  );

  // Token address
  const tokenAddress =
    await interchainTokenServiceContract.interchainTokenAddress(tokenId);

  // Get the expected token manager
  const expectedTokenManagerAddress =
    await interchainTokenServiceContract.tokenManagerAddress(tokenId);

  // Deploy our interchain token
  const deployTxData =
    await interchainTokenFactoryContract.deployInterchainToken(
      salt,
      name,
      symbol,
      decimals,
      initialSupply,
      signer.address
    );

  // Log
  console.log(
    `
  Deployed Token ID: ${tokenId},
  Token Address: ${tokenAddress},
  Transaction Hash: ${deployTxData.hash},
  salt: ${salt},
  Expected Token Manager Address: ${expectedTokenManagerAddress},
     `
  );

  //   Deployed Token ID: 0x7a28a0fd40ccaf2bcd5e67cd0279137f6c4db70f6fa400419e75a22491f33942,
  //   Token Address: 0xDC94aE5643fE0EdF63982B89744CC3235F3362CC,
  //   Transaction Hash: 0x582bfe9bae077977075217cefff70f045d8044be64716ace220fc671b9f487ec,
  //   salt: 0x46ca64bb6c5ae3b97c700c4f689a763d9f324e22ca87e0e15628197893c356f2,
  //   Expected Token Manager Address: 0x16F7424334ec843740fa824022F39DA26EeC2bC8,
  //   https://testnet.ftmscan.com/token/0xdc94ae5643fe0edf63982b89744cc3235f3362cc
}

const api = new AxelarQueryAPI({ environment: Environment.TESTNET });

async function gasEstimator() {
  const gas = await api.estimateGasFee(
    EvmChain.FANTOM,
    EvmChain.POLYGON,
    GasToken.FTM,
    7000000,
    1.1
  );

  return gas;
}

async function deployToRemoteChain() {
  const signer = await getSigner();

  const interchainTokenFactoryContract = await getContractInstance(
    interchainTokenFactoryContractAddress,
    interchainTokenFactoryContractABI,
    signer
  );

  const gasAmount = await gasEstimator();

  const salt =
    "0x46ca64bb6c5ae3b97c700c4f689a763d9f324e22ca87e0e15628197893c356f2";

  const txn = await interchainTokenFactoryContract.deployRemoteInterchainToken(
    "Fantom",
    salt,
    signer.address,
    "Polygon",
    gasAmount,
    { value: gasAmount }
  );

  console.log("Transaction Hash: ", txn.hash);
  // https://testnet.axelarscan.io/gmp/0x3da555f6d2e04a9832e2b45bcceeb1b5ac63ba2265c86087b4fe3c9c808093c0
}

async function transferTokens() {
  const signer = await getSigner();

  const interchainToken = await getContractInstance(
    "0xDC94aE5643fE0EdF63982B89744CC3235F3362CC", // Token address
    interchainTokenContractABI,
    signer
  );

  const gasAmount = await gasEstimator();

  const transfer = await interchainToken.interchainTransfer(
    "Polygon",
    "0x510e5EA32386B7C48C4DEEAC80e86859b5e2416C",
    ethers.utils.parseUnits("100"),
    "0x",
    { value: gasAmount }
  );

  console.log("Transfer Transaction Hash: ", transfer.hash);
  // https://testnet.axelarscan.io/gmp/0x96d5118f0a10bd6a6158b74a2876d1a316bc8ef4554c0e5a55eef4febc5a5f5b
}

async function main() {
  const functionName = process.env.FUNCTION_NAME;
  switch (functionName) {
    case "registerAndDeploy":
      await registerAndDeploy();
      break;
    case "deployToRemoteChain":
      await deployToRemoteChain();
      break;
    case "transferTokens":
      await transferTokens();
      break;
    default:
      console.error(`Unknown function: ${functionName}`);
      process.exitCode = 1;
      return;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// FUNCTION_NAME=registerAndDeploy npx hardhat run newInterchainToken.js --network fantom
// FUNCTION_NAME=deployToRemoteChain npx hardhat run newInterchainToken.js --network fantom
// FUNCTION_NAME=transferTokens npx hardhat run newInterchainToken.js --network fantom
