const ethers = require('ethers');
const cron = require('node-cron');

//see: https://www.quicknode.com/guides/defi/how-to-swap-tokens-on-uniswap-with-ethers-js
//https://www.youtube.com/watch?v=GK7rLwOg10Q
//https://github.com/BlockchainWithLeif/PancakeswapBot

require('dotenv').config({path:__dirname+'/.env'})
//This contains an Endpoint URL, and a wallet private key!!!

const POLYGON_NETWORK_RPC = process.env.POLYGON_NETWORK_RPC;
const POLYGON_NETWORK_CHAIN_ID = Number(process.env.POLYGON_NETWORK_CHAIN_ID);
const POLYGON_CURRENCY = process.env.POLYGON_CURRENCY;

const ETHEREUM_RPC = process.env.ETHEREUM_RPC;
const ETHEREUM_CHAIN = process.env.ETHEREUM_CHAIN;
const ETHEREUM_CURRENCY = process.env.ETHEREUM_CURRENCY;

const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

const TRANSACTION_SPLIPPAGE = 5 || Number(process.env.TRANSACTION_SPLIPPAGE) ; //default slippage 5%

const MIN_TOKENS_AMOUNT_TO_BUY = Number(process.env.MIN_TOKENS_AMOUNT_TO_BUY);
//we need to make sure it is read as Number()
const MAX_TOKENS_AMOUNT_TO_BUY = Number(process.env.MAX_TOKENS_AMOUNT_TO_BUY);

//THIS WORK ON BSC TESTNET!!!!!

//All Values are for the testnet!!!!!!!!

//OUTPUT_TOKEN
const OUTPUT_TOKEN = process.env.QUICKSWAP_OUTPUT_TOKEN_ADDRESS; //GGTK
//"0xae13d989dac2f0debff460ac112a837c89baa7cd"; //WBNB

//INPUT_TOKEN
const INPUT_TOKEN = process.env.QUICKSWAP_INPUT_TOKEN_ADDRESS //WETH
//"0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7"; //BUSD

const router = process.env.QUICKSWAP_ROUTER_ADDRESS;
// "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff" 
//"0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";

console.log('POLYGON_NETWORK_RPC: ', POLYGON_NETWORK_RPC);

console.log('quickswap router address:', router);

const provider = new ethers.providers.JsonRpcProvider({url: POLYGON_NETWORK_RPC});
console.log('got provider:', provider);
console.log('private key:', WALLET_PRIVATE_KEY)
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY);
console.log('got wallet', wallet);
const signer = wallet.connect(provider);

console.log('got signer', signer);

//quickswap or uniswap
//https://github.com/QuickSwap/QuickSwap-periphery/blob/master/contracts/UniswapV2Router02.sol
const routerContract = new ethers.Contract(
    router,
    [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns(uint[] memory amounts)',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ],
    signer
);

//approve the token
const inputTokenContract = new ethers.Contract(
    INPUT_TOKEN,
    [
        'function approve(address spender, uint256 amount) external returns (bool)'
    ],
    signer
)

/**
 * Creates a random wallet to make the purchase/swap
 * It needs to be funded first from the main wallet
 */
async function createRandomWallet() {

    const newWallet = ethers.Wallet.createRandom();
    console.log('address:', newWallet.address);
    console.log('mnemonic:', newWallet.mnemonic.phrase);
    console.log('privateKey:', newWallet.privateKey);
    return newWallet;
}

/**
 * Gets a random number of minutes before selling again, between min & max
 * @param {*} min 
 * @param {*} max 
 * @returns random interval in minutes
 */
function getRandomSellWindow(min = MIN_WAIT_BEFORE_SELL_INTERVAL, max = MAX_WAIT_BEFORE_SELL_INTERVAL) {
    return getRandomNumber(min, max);
}

/**
 * Gets a random amount of tockens to buy between min & max
 * @param {*} min amount
 * @param {*} max amount
 * @returns random number of tokens
 */
function getRandomAboutToBuy(min = MIN_TOKENS_AMOUNT_TO_BUY, max = MAX_TOKENS_AMOUNT_TO_BUY) {
    return getRandomNumber(min, max);
}

/**
 * Gets a random number between min & max values
 * @param {*} min 
 * @param {*} max 
 * @returns random number
 */
function getRandomNumber(min, max) {

    //find diff
    let difference = max - min;

    // generate random number 
    let rand = Math.random();
    // multiply with difference 
    rand = Math.floor( rand * difference);

    // add with min value 
    rand = rand + Number(min);
   
    return rand;
}

/**
 * Estimates how many WETH i need to get from Private Wallet A to random Wallet B in order to buy X amount of GGTK tokens
 * @param {*} desiredAmount of GGTKS tokens
 */
async function checkHowManyOutputTokensNeededForPurchase(desiredAmount) { 

    //OUTPUT_TOKEN = GGTK => The token we want to buy
    //INPUT TOKEN = WETH => The token used to purchase/swap for GGTK

    //swap the logic in this case, so we know an estimate of how many WETH are need to swap for 'desiredAmount' of GGTK tokens
    const inputToken = OUTPUT_TOKEN;
    const outputToken = INPUT_TOKEN;
    console.log('inputToken: ',inputToken);
    console.log('outputToken: ',outputToken);
    const desiredTokensAmount = ethers.utils.parseUnits(desiredAmount.toString(), 18); //needs to be a String
    console.log('desiredTokensAmount: ', desiredTokensAmount);
    const amountsNeeded = await routerContract.getAmountsOut(desiredTokensAmount, [inputToken, outputToken]);
    return ethers.utils.formatEther(amountsNeeded[1]);
}

async function main() {

    const previousOut = 165.280349745909999154;
    console.log('previous out: ', previousOut);


    const amountToBuy = getRandomAboutToBuy(MIN_TOKENS_AMOUNT_TO_BUY, MAX_TOKENS_AMOUNT_TO_BUY);
    console.log('Will try to buy ' + amountToBuy + ' GGTK tokens');
    const neededWeth = await checkHowManyOutputTokensNeededForPurchase(amountToBuy);
    console.log('Will need ' + neededWeth + ' to buy ' + amountToBuy + ' of GGTK');
    //TODO round neededWeth to 4 decimals, then approve the move from private wallet to randomWallet() of thi amount
    // then the the buy operation from this wallet and schedule a cron to sell it later?
    
    /*
    const inputTokenAmountIn = ethers.utils.parseUnits('0.008', 18);
    console.log('inputTokenAmountIn: ', inputTokenAmountIn);
    let amounts = await routerContract.getAmountsOut(inputTokenAmountIn, [INPUT_TOKEN, OUTPUT_TOKEN]);
    //var amountOut = amountsOutResult[1];
    //amountOut = amountOut - (amountOut * transactionSlippage / 100);
    console.log('amounts: ', amounts);
    
    const tokensOut = ethers.utils.formatEther(amounts[1]);
    console.log('tokens out: ', tokensOut);

    //min tokens that we will receive
    const OutputTokenAmountOutMin =  tokensOut - ( tokensOut * (TRANSACTION_SPLIPPAGE / 100 ) );
    //OR amounts[1].sub(amounts[1].div(10));

    console.log('OutputTokenAmountOutMin with ' + TRANSACTION_SPLIPPAGE + '% : ' + OutputTokenAmountOutMin);
    console.log("inputTokenAmountIn: ", ethers.utils.formatEther(inputTokenAmountIn));
    //console.log("OutputTokenAmountOutMin: ", OutputTokenAmountOutMin);

    const tokensToReceive = OutputTokenAmountOutMin;

    if( tokensToReceive > previousOut) {
        console.log('Token GGTTK went up:' + ( (tokensToReceive/previousOut) /100 ).toFixed(2) + " %");
    }else if( tokensToReceive < previousOut) {
        console.log('Token GGTTK went down:' + ( (previousOut/tokensToReceive) / 100).toFixed(2) + " %");
    } else {
        console.log('same price');
    }*/

    /*console.log('will approve: ',inputTokenAmountIn);
    const approveTx = await inputTokenContract.approve(
        router,
        inputTokenAmountIn,
        {gasPrice: provider.getGasPrice(),gasLimit: 100000}
    );
    let reciept = await approveTx.wait();
    console.log("approve reciept", reciept);

    const swapTx = await routerContract.swapExactTokensForTokens(
        inputTokenAmountIn,
        OutputTokenAmountOutMin,
        [INPUT_TOKEN, OUTPUT_TOKEN],
        wallet.address,
        Date.now() + 1000 * 60 * 10,
        {gasLimit: 250000, gasPrice: provider.getGasPrice()}
    )

    receipt = await swapTx.wait();
    console.log('swap receipt', receipt);*/
}
main().then().finally(() => {
    console.log('Run done');
    }
  );


//0 0 0 * * * //will run every day at 00:00 AM (midnight)
//every 10 m
cron.schedule('1 * * * *', async () => { 
  console.log('run cro job... ' + new Date().toString());
  main().then().finally(() => {
    console.log('Run done');
    }
  );
});
