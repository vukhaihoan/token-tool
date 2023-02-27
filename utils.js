function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}
function rn(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isPromise(promise) {
  return !!promise && typeof promise.then === "function";
}

async function goto(
  callback,
  condition,
  { retryAmount = 5, retryDelayTime = 2000, errMessage, retryMessage }
) {
  // console.log(condition);
  let resResultGlobal = null;
  function retryDelay(retryCount) {
    console.log(`${retryMessage || "retry "} attempt : ${retryCount}`);
    return retryCount * retryDelayTime; // time interval between retries
  }
  var i = 0;
  var check = false;
  start: while (true) {
    if (i > 0) {
      await delay(retryDelay(i));
    }
    const result = await callback();
    resResultGlobal = result;
    const conditionResult = await condition(result);
    i++;
    if (i < retryAmount && conditionResult) continue start;
    if (i == retryAmount) {
      check = true;
    }
    break;
  }
  if (check) {
    throw new Error(
      (errMessage || `Failed to submit captcha `) +
        `after ${retryAmount} attempts`
    );
  }
  return resResultGlobal;
}
// let status = false;
// goto(function () {
//     console.log("Hello, world!");
// }, !status);

module.exports = {
  goto,
  delay,
  rn,
};
