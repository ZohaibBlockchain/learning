import Binance from 'binance-api-node';
import dotenv from 'dotenv';

dotenv.config();

const client = Binance.default({
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET
  });





export function getPriceDirection(PriceInf) {

    const currentTime = Date.now();
    const fifteenMinutesAgo = currentTime - (1 * 60 * 1000);
    PriceInf = PriceInf.filter(({ timestamp }) => timestamp > fifteenMinutesAgo);

    if (PriceInf.length > 25) {
        var averagePrice = sum(PriceInf) / PriceInf.length;
        // console.log('AV: ', averagePrice);
        const currentPrice = PriceInf[PriceInf.length - 1].price;
        if (currentPrice > averagePrice) {
            return 'Long';
        } else if (currentPrice < averagePrice) {
            return 'Short';
        } else {
            return 'Flat';
        }
    }
    else {
        return 'Flat';
    }
}



function sum(arr) {
    let v = 0;
    arr.forEach(element => {
        v += element.price;
    });
    return v;
}



export function calculateRSI(pricesX, position) {
    const currentTime = Date.now();
    const fifteenMinutesAgo = currentTime - (6 * 60 * 1000);
    let prices = pricesX.filter(({ timestamp }) => timestamp > fifteenMinutesAgo);


    if (prices.length > 25) {
        const gains = [];
        const losses = [];
        let avgGain = 0;
        let avgLoss = 0;
        let prevPrice = prices[0].price;

        for (let i = 1; i < prices.length; i++) {
            const price = prices[i].price;
            const diff = price - prevPrice;
            prevPrice = price;

            if (diff > 0) {
                gains.push(diff);
                losses.push(0);
            } else if (diff < 0) {
                gains.push(0);
                losses.push(Math.abs(diff));
            } else {
                gains.push(0);
                losses.push(0);
            }
        }

        for (let i = 0; i < gains.length; i++) {
            avgGain = (i === 0 ? gains[i] : ((avgGain * (i - 1)) + gains[i]) / i);
            avgLoss = (i === 0 ? losses[i] : ((avgLoss * (i - 1)) + losses[i]) / i);
        }

        const RS = avgGain / avgLoss;
        const RSI = 100 - (100 / (1 + RS));
        console.log('RSI: ',RSI);
        if (position == false) {
            if (RSI > 65) {
                return "Short";
            } else if (RSI < 20) {
                return "Long";
            } else {
                return "Flat";
            }
        } else if (position == true) {
            if (RSI > 65) {
                return "Short";
            } else if (RSI < 35) {
                return "Long";
            } else {
                return "Flat";
            }
        }
    }
}



export function calculateVolumeDirection(tradesx) {

    const currentTime = Date.now();
    const fifteenMinutesAgo = currentTime - (90 * 1000);//90 seconds
    let trades = tradesx.filter(({ timestamp }) => timestamp > fifteenMinutesAgo);

    if (trades.length > 25) {
        let buyVolume = 0;
        let sellVolume = 0;

        trades.forEach((trade) => {
            if (trade.isBuyerMaker) {
                sellVolume += trade.quantity;
            } else {
                buyVolume += trade.quantity;
            }
        });

        if (buyVolume > sellVolume) {
            return "Long";
        } else if (sellVolume > buyVolume) {
            return "Short";
        } else {
            return "Flat";
        }
    }
}



export async function setFuturesLeverage(symbol, leverage) {
    try {
        const response = await client.futuresLeverage({
            symbol: symbol,
            leverage: leverage,
        });
        console.log(`Leverage set to ${leverage} for symbol ${symbol}`);
        return response;
    } catch (error) {
        console.error('Error setting leverage:', error);
        throw error;
    }
}



export async function getFuturesPosition(symbol) {
    try {
        const positions = await client.futuresPositionRisk({ symbol: symbol });
        const position = positions.find((position) => position.symbol === symbol);
        console.log(`Position for symbol ${symbol}:`, position);

        if (position.entryPrice == 0 && position.liquidationPrice == 0) {
            return { 'res': false, 'inf': position }
        } else {
            return { 'res': true, 'inf': position }
        }
        return position;
    } catch (error) {
        console.error('Error retrieving futures position:', error);
        throw error;
    }
}




export async function getMarketOrderDominance(symbol) {
    try {
        const orderBook = await client.book({ symbol, limit: 100 });
        const { bids, asks } = orderBook;
        const buyQuantity = bids.reduce((acc, { quantity }) => acc + parseFloat(quantity), 0);
        const sellQuantity = asks.reduce((acc, { quantity }) => acc + parseFloat(quantity), 0);
        // Calculate buy and sell dominance percentages
        const buyDominance = (buyQuantity / (buyQuantity + sellQuantity)) * 100;
        const sellDominance = (sellQuantity / (buyQuantity + sellQuantity)) * 100;

        if (buyDominance - 1 > sellDominance) {
            return "Long";
        } else if (sellDominance - 1 > buyDominance) {
            return "Short";
        } else {
            return "Flat";
        }
    } catch (error) {
        console.error('Error retrieving market order dominance:', error.message);
    }
}




export async function getFuturesPnLPercentage(symbol) {
    try {
        const accountInfo = await client.futuresAccount();
        const balances = accountInfo.positions;
        const position = balances.find((balance) => balance.symbol === symbol);

        if (position) {
            const unrealizedPnL = parseFloat(position.unrealizedProfit);
            const entryPrice = parseFloat(position.entryPrice);
            const positionValue = parseFloat(position.positionAmt) * entryPrice;
            const unrealizedPnLPercentage = (unrealizedPnL / positionValue) * 100;
            console.log(`Unrealized PnL percentage for symbol ${symbol}: ${unrealizedPnLPercentage}%`);
            return unrealizedPnLPercentage;
        } else {
            console.log(`No position found for symbol ${symbol}`);
            return null;
        }
    } catch (error) {
        console.error('Error retrieving futures PnL percentage:', error);
        throw error;
    }
}


export async function trade(symbol, side, quantity) {
   

    client.futuresMarketOrder({
        symbol: symbol,
        side: side,
        quantity: quantity,
    })
        .then((response) => {
            console.log('Instant futures order placed successfully:', response);
            return true;
            // Handle the success case
        })
        .catch((error) => {
            console.error('Error placing instant futures order:', error);
            return false;
        });
}