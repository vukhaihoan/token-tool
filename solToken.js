const fs = require("fs");
const readline = require("readline");
const axios = require("axios");
const { Parser } = require("json2csv");
require("dotenv").config();

async function processLineByLine() {
  const listAddress = [];
  const fileStream = fs.createReadStream("inputAddress/sol.txt");
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) {
      break;
    }
    listAddress.push(line);
  }
  return listAddress;
}
function convertRequestData(listAddress) {
  return listAddress.map((item) => {
    return {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        item,
        {
          mint: process.env.SOL_TOKEN_ADDRESS,
        },
        {
          encoding: "jsonParsed",
        },
      ],
    };
  });
}

const getTokenBalance = async (requestData) => {
  const response = await axios({
    url: `https://api.mainnet-beta.solana.com`,
    method: "post",
    headers: { "Content-Type": "application/json" },
    data: requestData,
  });
  return response;
};
async function main() {
  const listAddress = await processLineByLine();
  const requestData = convertRequestData(listAddress);
  const fetch = await getTokenBalance(requestData);

  // console.log(fetch.data[0].result.value[0].account.data.parsed);
  const listBalance = fetch.data.map((item) => {
    if (item.result.value.length !== 0) {
      const amout =
        item.result.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return amout;
    } else {
      return 0;
    }
  });
  const result = listAddress.map((item, index) => {
    return {
      address: item,
      balance: listBalance[index],
    };
  });
  console.log(result);
  fs.writeFileSync("result/result-sol-Token.json", JSON.stringify(result));
  const fields = [
    { label: "Address", value: "address" },
    { label: "Balance", value: "balance" },
  ];
  const x = new Parser({ fields });
  const content = x.parse(result);
  fs.writeFileSync("excel/sol-token.csv", content);
  console.log("Done");
}
main();
