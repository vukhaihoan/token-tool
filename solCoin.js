const web3 = require("@solana/web3.js");
const { PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const fs = require("fs");
const readline = require("readline");
const { Parser } = require("json2csv");
require("dotenv").config();
(async () => {})();
async function main() {
  let listarr = [];
  // Connect to cluster
  var connection = new web3.Connection(
    web3.clusterApiUrl("mainnet-beta"),
    "confirmed"
  );

  async function processLineByLine() {
    const fileStream = fs.createReadStream("inputAddress/sol.txt");
    var connection = new web3.Connection(
      web3.clusterApiUrl("mainnet-beta"),
      "confirmed"
    );
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line) {
        break;
      }
      const owneraddress = new PublicKey(line);

      let balance = await connection.getBalance(owneraddress);
      const parsedBalance = balance / LAMPORTS_PER_SOL;
      const item = {
        address: line,
        balance: parsedBalance,
      };
      console.log(item);
      listarr.push(item);
    }
  }

  await processLineByLine();
  fs.writeFileSync("result/result-sol-Coin.json", JSON.stringify(listarr));
  const fields = [
    { label: "Address", value: "address" },
    { label: "Balance", value: "balance" },
  ];
  const x = new Parser({ fields });
  const content = x.parse(listarr);
  fs.writeFileSync("excel/sol-coin.csv", content);
  console.log("Done");
}
main();
