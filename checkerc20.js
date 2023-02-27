const fs = require("fs");
const readline = require("readline");
require("dotenv").config();
const { Parser } = require("json2csv");
const Web3 = require("web3");
const RPC_ENDPOINT = process.env.BNB_RPC_ENDPOINT;

const web3 = new Web3(RPC_ENDPOINT);

// check erc20 token balance
const erc20ABI = [
  // only balanceOf
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "balance",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

const erc20Instance = new web3.eth.Contract(
  erc20ABI,
  process.env.ERC20_TOKEN_ADDRESS
);

async function main() {
  let listarr = [];
  async function processLineByLine() {
    const fileStream = fs.createReadStream("inputAddress/bnb.txt");

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break.

    for await (const line of rl) {
      if (!line) {
        break;
      }
      const balance = await erc20Instance.methods.balanceOf(line).call();
      // format balance
      const balanceFormat = web3.utils.fromWei(balance, "ether");
      const item = {
        address: line,
        balance: balanceFormat,
      };

      console.log(item);
      listarr.push(item);
    }
  }

  await processLineByLine();
  fs.writeFileSync("result/result-bnb.json", JSON.stringify(listarr));
  const fields = [
    { label: "Address", value: "address" },
    { label: "Balance", value: "balance" },
  ];
  const x = new Parser({ fields });
  const content = x.parse(listarr);
  fs.writeFileSync("excel/bnb.csv", content);
  console.log("Done");
}
main();
