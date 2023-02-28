// read multiple csv file from inputAddress folder, file name format: "inputAddress/address0.csv", "inputAddress/address1.csv" to "inputAddress/address33.csv"
// per file have header Address,Total BUSD Swap In,Total BUSD Swap Out,Total BNB Swap In,Total BNB Swap Out,Plant Empires Token
// and body data
// merge all data to one csv file, file name: "outputAddress/merged.csv"
// output file have header Address,Total BUSD Swap In,Total BUSD Swap Out,Total BNB Swap In,Total BNB Swap Out,Plant Empires Token
// and body data

const fs = require("fs");
const parse = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const inputAddress = "excel";
const outputAddress = "outputAddress";

const csvWriter = createCsvWriter({
  path: `merged.csv`,
  header: [
    { id: "address", title: "Address" },
    { id: "totalBusdSwapIn", title: "Total BUSD Swap In" },
    { id: "totalBusdSwapOut", title: "Total BUSD Swap Out" },
    { id: "totalWbnbSwapIn", title: "Total BNB Swap In" },
    { id: "TotalWbnbSwapOut", title: "Total BNB Swap Out" },
    { id: "erc20token", title: "Plant Empires Token" },
  ],
});

const csvData = [];

for (let i = 0; i < 34; i++) {
  // read csv file
  const csvFile = `${inputAddress}/address${i}.csv`;
  fs.createReadStream(csvFile)
    .pipe(parse({ delimiter: ",", from_line: 2 }))
    .on("data", function (row) {
      console.log(row);
      csvData.push({
        address: row.Address,
        totalBusdSwapIn: row["Total BUSD Swap In"],
        totalBusdSwapOut: row["Total BUSD Swap Out"],
        totalWbnbSwapIn: row["Total BNB Swap In"],
        TotalWbnbSwapOut: row["Total BNB Swap Out"],
        erc20token: row["Plant Empires Token"],
      });
    })
    .on("end", function () {
      console.log("done");
      csvWriter.writeRecords(csvData).then(() => {
        console.log("...Done");
      });
    });
}
