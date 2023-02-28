require("dotenv").config();
const readline = require("readline");
const fs = require("fs");
const Moralis = require("moralis").default;
const { EvmChain } = require("@moralisweb3/common-evm-utils");
const Web3 = require("web3");
const ethers = require("ethers");
const { getAddress } = require("ethers");
const { Parser } = require("json2csv");
const RPC_ENDPOINT = process.env.BNB_RPC_ENDPOINT;
const ERC_20_ADDRESS = process.env.ERC20_TOKEN_ADDRESS;
const WBNB_ADDRESS = process.env.WBNB_ADDRESS;
const BUSD_ADDRESS = process.env.BUSD_ADDRESS;
const MORALIST_API_KEY = process.env.MORALIST_API_KEY;

const web3 = new Web3(RPC_ENDPOINT);
const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);
const { delay } = require("./utils");

const Type = {
  BUSD_SWAP_IN: "BUSD_SWAP_IN",
  BUSD_SWAP_OUT: "BUSD_SWAP_OUT",
  WBNB_SWAP_IN: "WBNB_SWAP_IN",
  WBNB_SWAP_OUT: "WBNB_SWAP_OUT",
  OTHER: "OTHER",
};

const TransferAbi = [
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

const erc20Instance = new web3.eth.Contract(erc20ABI, ERC_20_ADDRESS);

const chain = EvmChain.BSC;

const TransferInstance = new ethers.Interface(TransferAbi);

// const fieldsListAddress = [
//   {
//     label: "address",
//     value: "address",
//   },
//   {
//     label: "total BUSD SwapIn",
//     value: "totalBusdSwapIn",
//   },
//   {
//     label: "total BUSD SwapOut",
//     value: "totalBusdSwapOut",
//   },
//   {
//     label: "total BNB SwapIn",
//     value: "totalWbnbSwapIn",
//   },
//   {
//     label: "total BNB SwapOut",
//     value: "totalWbnbSwapOut",
//   },
//   {
//     label: "totalOther",
//     value: "totalOther",
//   },
//   {
//     label: "Plant Empires Token",
//     value: "erc20Balance",
//   },
// ];

// const fieldsPerAddress = [
//   {
//     label: "type",
//     value: "type",
//   },
//   {
//     label: "value",
//     value: "value",
//   },
//   {
//     label: "hash",
//     value: "logs[0].transactionHash",
//   },
// ];

function toObject(obj) {
  return JSON.parse(
    JSON.stringify(
      obj,
      (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
    )
  );
}

async function getBalance(address) {
  const balance = await erc20Instance.methods.balanceOf(address).call();
  const balanceFormat = web3.utils.fromWei(balance, "ether");
  return balanceFormat;
}

async function getListTransactionHash(address) {
  const listResult = [];
  let cursor = undefined;
  start: while (true) {
    console.log("cursor", cursor);
    const response = await Moralis.EvmApi.transaction.getWalletTransactions({
      address,
      chain,
      cursor,
    });
    const result = response.result;
    listResult.push(...result);
    if (response.hasNext()) {
      cursor = response.pagination.cursor;
      console.log("has next, continue, current length: ", listResult.length);
      continue start;
    } else {
      console.log("no next, break, current length: ", listResult.length);
      break start;
    }
  }

  fs.writeFileSync("transactions.json", JSON.stringify(listResult, null, 2));
  const listTransactionHash = listResult.map((item) => item.hash);
  return listTransactionHash;
}

const calculateTotal = (listLogWithAddress) => {
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
  const totalOther = listLogWithAddress.reduce((acc, item) => {
    if (item.type === Type.OTHER) {
      return acc + parseFloat(item.value);
    } else {
      return acc;
    }
  }, 0);
  return {
    totalBusdSwapIn,
    totalBusdSwapOut,
    totalWbnbSwapIn,
    totalWbnbSwapOut,
    totalOther,
  };
};

const addTypeAndValue = (NotEmptyListLog) => {
  return NotEmptyListLog.map((item) => {
    let type = Type.OTHER;
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
      transactionHash: item[0].transactionHash,
      tokenIn: item[0].address,
      tokenOut: item[item.length - 1].address,
      type,
      value,
    };
  });
};

const parserHash = async (hash) => {
  const transaction = await provider.getTransactionReceipt(hash);
  const listRawLog = transaction.logs;
  // filter only checked erc20 transfer event
  if (
    !listRawLog
      .map((item) => getAddress(item.address))
      .includes(getAddress(ERC_20_ADDRESS))
  ) {
    return [];
  }
  const listParsedLog = listRawLog.map((rawLog) => {
    try {
      const parsedLog = TransferInstance.parseLog(rawLog);

      if (
        getAddress(rawLog.address) === getAddress(ERC_20_ADDRESS) ||
        getAddress(rawLog.address) === getAddress(WBNB_ADDRESS) ||
        getAddress(rawLog.address) === getAddress(BUSD_ADDRESS)
      ) {
        parsedLog.address = rawLog.address;
        parsedLog.transactionHash = rawLog.transactionHash;
        console.log("transfer event", typeof parsedLog);
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
};

const runPerAddress = async (address) => {
  const listTransactionHash = await getListTransactionHash(address);

  const balance = await getBalance(address);

  // const listLog = [];
  // for await (const hash of listTransactionHash) {
  //   const parsedLog = await parserHash(hash);
  //   listLog.push(parsedLog);
  // }

  const listLog = await Promise.all(
    listTransactionHash.map(async (hash) => {
      const parsedLog = await parserHash(hash);
      return parsedLog;
    })
  );

  const NotEmptyListLog = listLog.filter((item) => item.length > 1);

  const listLogWithAdded = addTypeAndValue(NotEmptyListLog);

  fs.writeFileSync(
    `results/parserlogs_${address}.json`,
    JSON.stringify(
      listLogWithAdded,
      (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
      2
    )
  );
  console.log(`logs address ${address} length :`, listLog.length);
  // const x = new Parser({ fieldsPerAddress });
  // const rawParser = toObject(listLogWithAdded);
  // console.log("rawParser", rawParser);
  // const csv = x.parse(rawParser);
  // fs.writeFileSync(`excel/parserlogs_${address}.csv`, csv);

  const createCsvWriter = require("csv-writer").createObjectCsvWriter;
  const csvWriter = createCsvWriter({
    path: `excels/parserlogs_${address}.csv`,
    header: [
      {
        id: "tokenIn",
        title: "tokenIn",
      },
      {
        id: "tokenOut",
        title: "tokenOut",
      },
      {
        id: "type",
        title: "type",
      },
      {
        id: "value",
        title: "value",
      },
      {
        id: "transactionHash",
        title: "TransactionHash",
      },
    ],
  });

  csvWriter.writeRecords(listLogWithAdded).then(() => {
    console.log(`wrote to csv address ${address} length :`, listLog.length);
  });

  return {
    address,
    ...calculateTotal(listLogWithAdded),
    erc20Balance: balance,
  };
};

async function main() {
  await Moralis.start({
    apiKey: MORALIST_API_KEY,
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
      const res = await runPerAddress(line);
      await delay(1000);
      listArr.push(res);
      console.log("Done with address: ", line);
    }
  }
  await processLineByLine();
  console.log("All Address Done");
  fs.writeFileSync("result/address.json", JSON.stringify(listArr, null, 2));
  // const x = new Parser({ fieldsListAddress });
  // const content = x.parse(listArr);
  // fs.writeFileSync("excel/address.csv", content);
  // console.log("File save success");

  const createCsvWriter = require("csv-writer").createObjectCsvWriter;
  const csvWriter = createCsvWriter({
    path: "excel/address.csv",
    header: [
      {
        id: "address",
        title: "Address",
      },
      {
        id: "totalBusdSwapIn",
        title: "Total BUSD Swap In",
      },
      {
        id: "totalBusdSwapOut",
        title: "Total BUSD Swap Out",
      },
      {
        id: "totalWbnbSwapIn",
        title: "Total BNB Swap In",
      },
      {
        id: "totalWbnbSwapOut",
        title: "Total BNB Swap Out",
      },
      {
        id: "erc20Balance",
        title: "Plant Empires Token",
      },
    ],
  });

  csvWriter.writeRecords(listArr).then(() => {
    console.log("wrote to csv address");
  });
}

main();
