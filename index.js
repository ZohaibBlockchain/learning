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
    console.clear();
    let PD = getPriceDirection(PriceArr);
    let RSI = calculateRSI(PriceArr, position);
    let VD = calculateVolumeDirection(trades);

    //finding the opportunity
    if (PD === 'Long' && RSI === 'Long' && VD === 'Long' && Dominance === 'Long') {

      if (position) {
        if (tradeDirection === 'Short') {
          //Close trade...
          let res = await trade(symbol, 'BUY', quantity)
          if (res) {
            tradeDirection = 'Null';
            position = false;
          } else {
            console.log('Error occur while making a trade')
          }
        }
      } else {
        //trade
        let res = await trade(symbol, 'BUY', quantity)
        if (res) {
          tradeDirection = 'Long';
          position = true;
        } else {
          console.log('Error occur while making a trade')
        }
      }
    }
    else if (PD === 'Short' && RSI === 'Short' && VD === 'Short' && Dominance === 'Short') {

      if (position) {
        if (tradeDirection === 'Long') {
          //Close trade...
          let res = await trade(symbol, 'SELL', quantity)
          if (res) {
            tradeDirection = 'Null';
            position = false;
          } else {
            console.log('Error occur while making a trade')
          }
        }
      } else {
        //trade
        let res = await trade(symbol, 'SELL', quantity)
        if (res) {
          tradeDirection = 'Short';
          position = true;
        } else {
          console.log('Error occur while making a trade')
        }
      }
    }
    else {
      console.log('...');
    }

    console.log(VD, RSI, PD, Dominance);
  } else {
    console.log("Initializing...");
  }
}







// Call the Engine function every second
setInterval(Engine, 100);
setInterval(async () => {
  Dominance = await getMarketOrderDominance(symbol);
}, 10000);

init(symbol);


