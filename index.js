import WebSocket from "ws";
import {
  getPriceDirection,
  calculateRSI,
  calculateVolumeDirection,
  setFuturesLeverage,
  getFuturesPosition,
  getMarketOrderDominance,
  getFuturesPnLPercentage,
  trade
} from "./Lib/lib.js";
import Binance from "binance-api-node";
import dotenv from 'dotenv';

dotenv.config();

const client = Binance.default({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET
});


let PriceArr = [];
let trades = [];
let Dominance;
const OperationStartTime = Date.now() + 6 * 60 * 1000;
const symbol = "BTCUSDT"; // The futures trading pair
const leverage = 1; // The leverage value you want to set
let position = false;
let tradeDirection = 'Null';
const quantity = 0.001; // The quantity of the asset you want to trade
let IterationTime = 0;



function init(symbol) {
  const wss = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`
  );

  setFuturesLeverage(symbol, leverage)
    .then(async (response) => {
      console.log("leverage successfully pushed ", response);
      let res = await getFuturesPosition(symbol);
      position = res.res;
      wss.on("open", () => {
        console.log(`Subscribed to ${symbol}`);
      });

      wss.on("message", (message) => {
        const data = JSON.parse(message);
        const price = parseFloat(data.p); // Price of the latest trade
        const quantity = parseFloat(data.q);
        const isBuyerMaker = data.m;
        const timestamp = data.T; // Trade time

        // Add price to PriceArr

        PriceArr.push({ price, timestamp });
        if (PriceArr > 50000) {
          PriceArr.shift();
        }
        // Add trade data to trades
        trades.push({ quantity, isBuyerMaker, timestamp });

        if (trades > 30000) {
          trades.shift();
        }
        // Filter out trades that are older than 15 minutes
      });

      wss.on("error", (error) => {
        console.error(`WebSocket encountered an error: ${error}`);
      });

      wss.on("close", (code, reason) => {
        console.log(`WebSocket disconnected: ${code} [${reason}]`);
      });
    })
    .catch((error) => {
      // Handle error
      console.error(error);
    });
}





async function Engine() {
  if (OperationStartTime <= Date.now()) {
    // console.clear();
    let PD = getPriceDirection(PriceArr);
    let RSI = calculateRSI(PriceArr, position);
    let VD = calculateVolumeDirection(trades);
    console.log(VD, RSI, PD, Dominance, position, tradeDirection, IterationTime);

    if (IterationTime > 0) {
      IterationTime -= 500;
    } else {
      //finding the opportunity
      if (PD === 'Long' && VD === 'Long' && Dominance === 'Long' && RSI === 'Long') {
        if (position && tradeDirection === 'Short') {
          //Close trade...
          tradeDirection = 'Null';
          position = false;
          IterationTime = 5000;
          await trade(symbol, 'BUY', quantity);
        }
        else if (!position) {
          position = true;
          console.log('Activated!');
          tradeDirection = 'Long';
          IterationTime = 5000;
          await trade(symbol, 'BUY', quantity);
        }
      }
      else if (PD === 'Short' && VD === 'Short' && Dominance === 'Short' && RSI === 'Long') {
        if (position && tradeDirection === 'Long') {
          //Close trade...
          tradeDirection = 'Null';
          position = false;
          IterationTime = 5000;
          await trade(symbol, 'SELL', quantity);
        }
        else if (!position) {
          position = true;
          console.log('Activated!');
          tradeDirection = 'Short';
          IterationTime = 5000;
          await trade(symbol, 'SELL', quantity);
        }
      }
      else {
        console.log('...');
      }
    }
  }
  else {
    console.log("Initializing...");
  }



}




// Call the Engine function every second
setInterval(() => {
  Engine();
}, 500);

setInterval(async () => {
  Dominance = await getMarketOrderDominance(symbol);
}, 10000);

init(symbol);


