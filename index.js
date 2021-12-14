const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

const KardiaClient = require("kardia-js-sdk").default;
const RPC_ENDPOINT = process.env.YOUR_RPC_ENDPOINT;

const kardiaClient = new KardiaClient({ endpoint: RPC_ENDPOINT });

const krc20Instance = kardiaClient.krc20;

// Fetch KRC20 token's data from smart contract

// const balance = await krc20Instance.balanceOf(process.env.YOUR_WALLET_ADDRESS);
// // `balance` will be your wallet's balance, but with token's `decimals` padding.
// // To get real ballance, use the following code

// const decimals = krc20Instance.getDecimals();
// const parsedBalance = balance / 10 ** decimals;

async function main() {
  let listarr = [];
  async function processLineByLine() {
    await krc20Instance.getFromAddress(process.env.KRC20_TOKEN_ADDRESS);
    const fileStream = fs.createReadStream("input.txt");

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break.

    for await (const line of rl) {
      // Each line in input.txt will be successively available here as `line`.
      const balance = await krc20Instance.balanceOf(line);
      // `balance` will be your wallet's balance, but with token's `decimals` padding.
      // To get real ballance, use the following code

      const decimals = await krc20Instance.getDecimals();
      const parsedBalance = balance / 10 ** decimals;
      const item = {
        address: line,
        balance: parsedBalance,
      };
      console.log(item);
      listarr.push(item);
    }
  }

  await processLineByLine();
  fs.writeFileSync("result.json", JSON.stringify(listarr));
}
main();
