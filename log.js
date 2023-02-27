require("dotenv").config();
const Moralis = require("moralis").default;
const readline = require("readline");
const { EvmChain } = require("@moralisweb3/common-evm-utils");
const fs = require("fs");
const Web3 = require("web3");
const ethers = require("ethers");
const { getAddress } = require("ethers");
const { Parser } = require("json2csv");
const RPC_ENDPOINT = process.env.BNB_RPC_ENDPOINT;
const web3 = new Web3(RPC_ENDPOINT);
const PEFI_ADDRESS = process.env.ERC20_TOKEN_ADDRESS;
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BUSD_ADDRESS = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const Type = {
  BUSD_SWAP_IN: "BUSD_SWAP_IN",
  BUSD_SWAP_OUT: "BUSD_SWAP_OUT",
  WBNB_SWAP_IN: "WBNB_SWAP_IN",
  WBNB_SWAP_OUT: "WBNB_SWAP_OUT",
};

const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);

const erc20ABI = [
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

const runApp = async (address) => {
  const chain = EvmChain.BSC;

  const response = await Moralis.EvmApi.transaction.getWalletTransactions({
    address,
    chain,
  });
  // const eventSignature = "Transfer(address,address,uint256)";
  // const eventTopic = ethers.utils.id(eventSignature); // Get the data hex string for the event signature
  const abi = [
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          name: "from",
          type: "address",
        },
        {
          indexed: true,
          name: "to",
          type: "address",
        },
        {
          indexed: false,
          name: "value",
          type: "uint256",
        },
      ],
      name: "Transfer",
      type: "event",
    },
  ];

  const intrfc = new ethers.Interface(abi);
  // write the response to json file
  fs.writeFileSync("transactions.json", JSON.stringify(response, null, 2));
  console.log("result length: ", response.result.length);
  const listTransactionHash = response.result.map((item) => item.hash);
  // get log from transaction hash using ethers
  const listLog = await Promise.all(
    listTransactionHash.map(async (hash) => {
      const transaction = await provider.getTransactionReceipt(hash);
      const listRawLog = transaction.logs;
      // filter only PEFI transfer event
      if (
        !listRawLog
          .map((item) => getAddress(item.address))
          .includes(getAddress(PEFI_ADDRESS))
      ) {
        return [];
      }
      const listParsedLog = listRawLog.map((rawLog) => {
        try {
          const parsedLog = intrfc.parseLog(rawLog);
          // filter only PEFI transfer event
          if (
            getAddress(rawLog.address) === getAddress(PEFI_ADDRESS) ||
            getAddress(rawLog.address) === getAddress(WBNB_ADDRESS) ||
            getAddress(rawLog.address) === getAddress(BUSD_ADDRESS)
          ) {
            parsedLog.address = rawLog.address;
            parsedLog.transactionHash = rawLog.transactionHash;
            return parsedLog;
          } else {
            return null;
          }
        } catch (error) {
          console.log("not a transfer event: ", typeof rawLog);
          return null;
        }
      });
      const notNullParsedLog = listParsedLog.filter((item) => item !== null);

      return notNullParsedLog;
    })
  );
  const NotEmptyListLog = listLog.filter((item) => item.length > 1);
  const listLogWithAddress = NotEmptyListLog.map((item) => {
    let type = "";
    let value = 0;
    if (getAddress(item[0].address) === getAddress(BUSD_ADDRESS)) {
      type = Type.BUSD_SWAP_IN;
      value = web3.utils.fromWei(BigInt(item[0].args[2]).toString(), "ether");
    } else if (getAddress(item[0].address) === getAddress(WBNB_ADDRESS)) {
      type = Type.WBNB_SWAP_IN;
      value = web3.utils.fromWei(BigInt(item[0].args[2]).toString(), "ether");
    } else if (
      getAddress(item[item.length - 1].address) === getAddress(BUSD_ADDRESS)
    ) {
      type = Type.BUSD_SWAP_OUT;
      value = web3.utils.fromWei(
        BigInt(item[item.length - 1].args[2]).toString(),
        "ether"
      );
    } else if (
      getAddress(item[item.length - 1].address) === getAddress(WBNB_ADDRESS)
    ) {
      type = Type.WBNB_SWAP_OUT;
      value = web3.utils.fromWei(
        BigInt(item[item.length - 1].args[2]).toString(),
        "ether"
      );
    }
    return {
      logs: item,
      firstAddress: item[0].address,
      lastAddress: item[item.length - 1].address,
      type,
      value,
    };
  });
  fs.writeFileSync(
    `result/parserlogs_${address}.json`,
    JSON.stringify(
      listLogWithAddress,
      (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
      2
    )
  );
  console.log("log length: ", listLog.length);
  const fields = [
    {
      label: "TYPE",
      value: "type",
    },
    {
      label: "value",
      value: "value",
    },
    {
      label: "hash",
      value: "logs[0].transactionHash",
    },
  ];
  const x = new Parser({ fields });
  const csv = x.parse(listLogWithAddress);
  fs.writeFileSync(`excel/parserlogs_${address}.csv`, csv);
  const totalBusdSwapIn = listLogWithAddress.reduce((acc, item) => {
    if (item.type === Type.BUSD_SWAP_IN) {
      return acc + parseFloat(item.value);
    } else {
      return acc;
    }
  }, 0);
  const totalBusdSwapOut = listLogWithAddress.reduce((acc, item) => {
    if (item.type === Type.BUSD_SWAP_OUT) {
      return acc + parseFloat(item.value);
    } else {
      return acc;
    }
  }, 0);
  const totalWbnbSwapIn = listLogWithAddress.reduce((acc, item) => {
    if (item.type === Type.WBNB_SWAP_IN) {
      return acc + parseFloat(item.value);
    } else {
      return acc;
    }
  }, 0);
  const totalWbnbSwapOut = listLogWithAddress.reduce((acc, item) => {
    if (item.type === Type.WBNB_SWAP_OUT) {
      return acc + parseFloat(item.value);
    } else {
      return acc;
    }
  }, 0);
  const balance = await erc20Instance.methods.balanceOf(address).call();
  // format balance
  const balanceFormat = web3.utils.fromWei(balance, "ether");
  return {
    address,
    totalBusdSwapIn,
    totalBusdSwapOut,
    totalWbnbSwapIn,
    totalWbnbSwapOut,
    pefiBalance: balanceFormat,
  };
};

async function main() {
  await Moralis.start({
    apiKey: "2lq1n8Va5LTfR4NdHT6sHXGgG9MbVB8E5CN0PfDNVqoxk3rPEPjexcnhl4HPp2Ys",
    // ...and any other configuration
  });
  const listArr = [];
  async function processLineByLine() {
    const fileStream = fs.createReadStream("inputAddress/bnb.txt");

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line) {
        break;
      }
      const res = await runApp(line);
      listArr.push(res);
      console.log("done: ", line);
    }
  }
  await processLineByLine();
  console.log("done het sach");
  fs.writeFileSync("result/address.json", JSON.stringify(listArr, null, 2));
  const fields = [
    {
      label: "address",
      value: "address",
    },
    {
      label: "totalBusdSwapIn",
      value: "totalBusdSwapIn",
    },
    {
      label: "totalBusdSwapOut",
      value: "totalBusdSwapOut",
    },
    {
      label: "totalWbnbSwapIn",
      value: "totalWbnbSwapIn",
    },
    {
      label: "totalWbnbSwapOut",
      value: "totalWbnbSwapOut",
    },
    {
      label: "pefiBalance",
      value: "pefiBalance",
    },
  ];
  const x = new Parser({ fields });
  const content = x.parse(listArr);
  fs.writeFileSync("excel/address.csv", content);
  console.log("Done");
}

main();
