import * as StellarSdk from "@stellar/stellar-sdk";

// Define the network passphrase (use 'Testnet' for testing and 'Public Global Stellar Network ; September 2015' for production)
const networkPassphrase = StellarSdk.Networks.TESTNET;

// Create keypairs for the source account and the fee account
const sourceKeypair = StellarSdk.Keypair.fromSecret("SECREY_KEY_1");
const feeKeypair = StellarSdk.Keypair.fromSecret("SECREY_KEY_2");

// Load the source account (this requires network interaction)
const server = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org");
const sourceAccount = await server.getAccount(sourceKeypair.publicKey());

// Construct the inner transaction, just a example tx, to transfer 10 XLM to a destination account
const innerTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase,
})
  .addOperation(
    StellarSdk.Operation.payment({
      destination: "GDWH3P3MNTCMOY42CA7RVEACUUAUPZ73XDYKPYUL3TWOFRF37FD6OVM6",
      asset: StellarSdk.Asset.native(),
      amount: "10",
    }),
  )
  .setTimeout(30)
  .build();

// Sign the inner transaction with the source account
innerTransaction.sign(sourceKeypair);

// Build the fee-bump transaction
const feeBumpTransaction =
  StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    feeKeypair,
    StellarSdk.BASE_FEE * 2,
    innerTransaction,
    networkPassphrase,
  );

// Sign the fee-bump transaction with the fee account
feeBumpTransaction.sign(feeKeypair);

// Submit the fee-bump transaction to the Stellar network
server
  .sendTransaction(feeBumpTransaction)
  .then((response) => {
    if (response.status !== "PENDING") {
      throw response;
    }

    return server.pollTransaction(response.hash, {
      sleepStrategy: StellarSdk.rpc.LinearSleepStrategy,
      attempts: 5,
    });
  })
  .then((response) => {
    console.log("transaction response:", response);
  })
  .catch((error) => {
    console.error("Something went wrong!", error);
  });