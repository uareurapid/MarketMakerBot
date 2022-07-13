const ethers = require('ethers');
const cron = require('node-cron');
const path = require('path'); 
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ERC20ABI = require('./ERC20ABI.json');


const RUNNING_DEX = process.argv[2];
console.log('RUNNING DEX: ', RUNNING_DEX);
//check wich DEX we are using for the current script run
const isRunningOnPolygon = (RUNNING_DEX == 'quickswap' ? true : false);

//some refs
//see: https://www.quicknode.com/guides/defi/how-to-swap-tokens-on-uniswap-with-ethers-js
//https://www.youtube.com/watch?v=GK7rLwOg10Q
//https://github.com/BlockchainWithLeif/PancakeswapBot

const extraForFees = 10 || Number(process.env.TRANSFER_FEES_EXTRA_PERCENTAGE);

//Polygon / Quickswap
const POLYGON_NETWORK_RPC = process.env.POLYGON_NETWORK_RPC;
const POLYGON_NETWORK_CHAIN_ID = Number(process.env.POLYGON_NETWORK_CHAIN_ID);
const POLYGON_CURRENCY = process.env.POLYGON_CURRENCY;

//Ethereum / Uniswap
const ETHEREUM_NETWORK_RPC = process.env.ETHEREUM_RPC;
const ETHEREUM_CHAIN = process.env.ETHEREUM_CHAIN;
const ETHEREUM_CURRENCY = process.env.ETHEREUM_CURRENCY;

//the wallet with th original funds
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

const TRANSACTION_SPLIPPAGE = 10 || Number(process.env.TRANSACTION_SPLIPPAGE) ; //default slippage 10%

const MIN_TOKENS_AMOUNT_TO_BUY = Number(process.env.MIN_TOKENS_AMOUNT_TO_BUY);
//we need to make sure it is read as Number()
const MAX_TOKENS_AMOUNT_TO_BUY = Number(process.env.MAX_TOKENS_AMOUNT_TO_BUY);


const MIN_WAIT_BEFORE_SELL_INTERVAL = Number(process.env.MIN_WAIT_BEFORE_SELL_INTERVAL);
const MAX_WAIT_BEFORE_SELL_INTERVAL = Number(process.env.MAX_WAIT_BEFORE_SELL_INTERVAL);

//THIS WORK ON BSC TESTNET!!!!!

//All Values are for the testnet!!!!!!!!

//OUTPUT_TOKEN
const OUTPUT_TOKEN = isRunningOnPolygon ? process.env.QUICKSWAP_OUTPUT_TOKEN_ADDRESS : process.env.UNISWAP_OUTPUT_TOKEN_ADDRESS; //GGTK
//"0xae13d989dac2f0debff460ac112a837c89baa7cd"; //WBNB

//INPUT_TOKEN
const INPUT_TOKEN = isRunningOnPolygon ? process.env.QUICKSWAP_INPUT_TOKEN_ADDRESS : process.env.UNISWAP_INPUT_TOKEN_ADDRESS //WETH
//"0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7"; //BUSD

const router = isRunningOnPolygon ? process.env.QUICKSWAP_ROUTER_ADDRESS : process.env.UNISWAP_ROUTER_ADDRESS;
// "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff" 
//"0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";

const INPUT_TOKEN_SYMBOL = isRunningOnPolygon ? process.env.QUICKSWAP_INPUT_TOKEN_SYMBOL : UNISWAP_INPUT_TOKEN_SYMBOL;

//provider URL
const NETWORK_RPC_URL = isRunningOnPolygon ?POLYGON_NETWORK_RPC : ETHEREUM_NETWORK_RPC;

console.log('NETWORK_URL_RPC: ', NETWORK_RPC_URL);
console.log('ROUTER ADDRESS:' , router);

const provider = new ethers.providers.JsonRpcProvider({url: NETWORK_RPC_URL });
console.log('PROVIDER:', provider);
//console.log('private key:', WALLET_PRIVATE_KEY)
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY);
console.log('WALLET:', wallet);
const signer = wallet.connect(provider);
console.log('SIGNER: ', signer);

//approve the token
async function getInputTokenContract(theSigner) {

    return new ethers.Contract(
        INPUT_TOKEN,
        [
            'function approve(address spender, uint256 amount) external returns (bool)'
        ],
        theSigner
    )
}

//approve the token
async function getOutputTokenContract(theSigner) {

    return new ethers.Contract(
        OUTPUT_TOKEN,
        [
            'function approve(address spender, uint256 amount) external returns (bool)'
        ],
        theSigner
    )
}


/**
 * 
 * @param {*} theSigner wallet signer
 * @returns routerContract
 */
async function getRouterContract(theSigner) { 
    //quickswap or uniswap
    //https://github.com/QuickSwap/QuickSwap-periphery/blob/master/contracts/UniswapV2Router02.sol
    return new ethers.Contract(
        router,
        [
            'function getAmountsOut(uint amountIn, address[] memory path) public view returns(uint[] memory amounts)',
            'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
        ],
        theSigner
    );
}
/**
 * Creates a random wallet to make the purchase/swap
 * It needs to be funded first from the main wallet
 */
async function createRandomWallet() {

    const newWallet = ethers.Wallet.createRandom();

    //for testing with same test account uncoment this line:
    //const newWallet = new ethers.Wallet('private_key');
    //and comment 1st line above

    
    console.log('new wallet address:', newWallet.address);
    console.log('new wallet mnemonic:', newWallet.mnemonic.phrase);
    //we need to log this or we might not be able to restore it later
    console.log('new wallet privateKey:', newWallet.privateKey);
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


//https://ethereum.org/en/developers/tutorials/send-token-etherjs/
/**
 * contract_address,//WETH address
   send_token_amount,//how many WETH
   to_address, //random wallet address
   send_address, //send_address
   walletSigner
   gas_limit
 */


async function send_token(
    contract_address,
    send_token_amount,
    to_address,
    send_account,
    walletSigner,
    gas_limit
  ) {
 
    //let walletSigner = send_wallet.connect(provider);
  
    let currentGasPrice = await provider.getGasPrice();
    let gas_price = ethers.utils.hexlify(parseInt(currentGasPrice))
    console.log('gas_price: ', gas_price);
  
      if (contract_address) {
        // general token send
        let contract = new ethers.Contract(
          contract_address,
          ERC20ABI, //TODO ??
          walletSigner
        )
  
        // How many tokens?
        let numberOfTokens = ethers.utils.parseUnits(send_token_amount, 18)
        console.log('numberOfTokens: ', numberOfTokens);
  
        // Send tokens
        let transferResult = await contract.transfer(to_address, numberOfTokens, {gasLimit: gas_limit, gasPrice: gas_price, from: send_account});
          console.log('transferResult: ', transferResult);
          console.log("sent token ok!")
          return transferResult;
      }

  }

/**
 * Estimates how many WETH i need to get from Private Wallet A to random Wallet B in order to buy X amount of GGTK tokens
 * @param {*} desiredAmount of GGTKS tokens
 */
async function checkHowManyOutputTokensNeededForPurchase(desiredAmount, theSigner) { 

    //OUTPUT_TOKEN = GGTK => The token we want to buy
    //INPUT TOKEN = WETH => The token used to purchase/swap for GGTK

    //swap the logic in this case, so we know an estimate of how many WETH are need to swap for 'desiredAmount' of GGTK tokens
    const inputToken = OUTPUT_TOKEN;
    const outputToken = INPUT_TOKEN;
    console.log('inputToken: ',inputToken);
    console.log('outputToken: ',outputToken);
    const desiredTokensAmount = ethers.utils.parseUnits(desiredAmount.toString(), 18); //needs to be a String
    console.log('desiredTokensAmount: ', desiredTokensAmount);
    const routerContract = await getRouterContract(theSigner);
    const amountsNeeded = await routerContract.getAmountsOut(desiredTokensAmount, [inputToken, outputToken]);
    console.log('amountsNeeded', amountsNeeded);
    return ethers.utils.formatEther(amountsNeeded[1]);
}

/**
 * Actually make the purchase of GGTK tokens, from the randomly generated wallet
 * This wallet will swap back the tokens (sell) after X amount of time.
 * Once it does that it transfers the funds from the sell to the original wallet, so the process can repeat again
 */
async function makePurchase(to_address, theSigner, neededTradePairToken) {

    const inputTokenAmountIn = ethers.utils.parseUnits(neededTradePairToken.toString(), 18);
    console.log('inputTokenAmountIn: ', inputTokenAmountIn);
    const routerContract = await getRouterContract(theSigner);
    let amounts = await routerContract.getAmountsOut(inputTokenAmountIn, [INPUT_TOKEN, OUTPUT_TOKEN]);
    console.log('amounts: ', amounts);
    
    const tokensOut = ethers.utils.formatEther(amounts[1]);
    console.log('tokens out: ', tokensOut);

    //min tokens that we will receive
    const OutputTokenAmountOutMin = amounts[1].sub(amounts[1].div(TRANSACTION_SPLIPPAGE)); //div(TRANSACTION_SPLIPPAGE * 10)
    //OR amounts[1].sub(amounts[1].div(10));

    console.log('OutputTokenAmountOutMin', OutputTokenAmountOutMin);
    console.log("inputTokenAmountIn: ", ethers.utils.formatEther(inputTokenAmountIn));

    console.log('will approve: ',inputTokenAmountIn);
    const inputTokenContract = await getInputTokenContract(theSigner);
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
        to_address,
        Date.now() + 1000 * 60 * 10,
        {gasLimit: 250000, gasPrice: provider.getGasPrice()}
    )

    let receipt = await swapTx.wait();
    console.log('swap tokens (buy) receipt', receipt);
    return receipt;
    

}

/**
 * Needs to be the opposite of purchase()
 * @param {*} to_address 
 * @param {*} theSigner 
 * @param {*} neededTradePairToken 
 */
async function makeSell(to_address, theSigner, neededTradePairToken) {

    //swap tokens
    const tokenIn = OUTPUT_TOKEN; //GGTK
    const tokenOut = INPUT_TOKEN; //WETH

    const inputTokenAmountIn = ethers.utils.parseUnits(neededTradePairToken.toString(), 18);
    console.log('inputTokenAmountIn: ', inputTokenAmountIn);
    const routerContract = await getRouterContract(theSigner);
    let amounts = await routerContract.getAmountsOut(inputTokenAmountIn, [tokenIn, tokenOut]);
    console.log('amounts: ', amounts);
    
    const tokensOut = ethers.utils.formatEther(amounts[1]);
    console.log('tokens out: ', tokensOut);

    //min tokens that we will receive
    const OutputTokenAmountOutMin = amounts[1].sub(amounts[1].div(TRANSACTION_SPLIPPAGE)); //div(TRANSACTION_SPLIPPAGE * 10)
    //OR amounts[1].sub(amounts[1].div(10));

    console.log('OutputTokenAmountOutMin', OutputTokenAmountOutMin);
    console.log("inputTokenAmountIn: ", ethers.utils.formatEther(inputTokenAmountIn));

    console.log('will approve: ',inputTokenAmountIn);
    const inputTokenContract = await getOutputTokenContract(theSigner);
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
        [tokenIn, tokenOut],
        to_address,
        Date.now() + 1000 * 60 * 10,
        {gasLimit: 250000, gasPrice: provider.getGasPrice()}
    )

    let receipt = await swapTx.wait();
    console.log('swap tokens (sell) receipt', receipt);
    return receipt;
}

async function main() {


    const amountToBuy = getRandomAboutToBuy(MIN_TOKENS_AMOUNT_TO_BUY, MAX_TOKENS_AMOUNT_TO_BUY);
    console.log('Will try to buy ' + amountToBuy + ' GGTK tokens');

    //Add extra 5% to cover transfer fees
    const amountToBuyWithExtra = Math.floor(amountToBuy + Number(amountToBuy * extraForFees/100));
    console.log('With extra ' + extraForFees + '%  the amount to buy is: ', amountToBuyWithExtra);

    //the other pair token needed (the one to swap for GGTK)
    const neededTradePairToken = Number(await checkHowManyOutputTokensNeededForPurchase(amountToBuyWithExtra, signer));
    console.log('Will need ' + neededTradePairToken + ' ' + INPUT_TOKEN_SYMBOL + ' to buy ' + amountToBuy + ' of GGTK');
    
    //Random wallet stuff
    //create
    const randomWallet = await createRandomWallet();
    //connect
    const walletSigner = randomWallet.connect(provider);
    //TODO check if we have enough balance on main wallet to ransfer to reandom one
    //get random wallet address
    const to_address = await walletSigner.getAddress();
    console.log('Random wallet address: ', to_address);
    const contract_address = INPUT_TOKEN; //of ETH, WETH or MATIC for instance
    const gas_limit = "0x100000";
    const send_token_amount = neededTradePairToken.toString();
    const send_address = await signer.getAddress();

    console.log('will send ' + send_token_amount + ' ' + INPUT_TOKEN_SYMBOL + ' from wallet ' + send_address + ' to wallet ' + to_address);

    //Transfer needed input tokens from private wallet to random wallet
    //OK
    let result = await send_token(
        contract_address,//WETH or MATIC address
        send_token_amount,//how many WETH/MATIC/ETH
        to_address, //random wallet address
        send_address, //send_address
        signer,//wallet signer
        gas_limit
      );

      console.log('result is: ', result);
      if(result && typeof result.wait === 'function') {
        let receipt = await result.wait();
        console.log('Send tokens Done: ', receipt);

        console.log('will make purchase of GGTK now...');
        //Make purchase/swap (Buy GGTK)
        let purchase = await makePurchase(to_address, walletSigner, neededTradePairToken);
        console.log('purchase receipt: ', purchase);

        //see when to seel it back (config is in MINUTES)
        const whenToSell = getRandomSellWindow(MIN_WAIT_BEFORE_SELL_INTERVAL, MAX_WAIT_BEFORE_SELL_INTERVAL);
        console.log('Will make sell after ' + whenToSell + ' minute(s)');
        await sleepBeforeSell(whenToSell * 60 * 1000);
        console.log('Try to sell tokens now....');

        //1)get the GGTK balance
        const tokenContract = new ethers.Contract(OUTPUT_TOKEN, ERC20ABI, walletSigner);
        const balance = await tokenContract.balanceOf(to_address);
        const maxToSell = ethers.utils.formatEther(balance);

        console.log('will try to sell my GGTK balance of ', maxToSell);
        //get the main wallet address to receive the resulting WETH
        const receiver_address = await signer.getAddress();
        console.log('receiver address', receiver_address)
        //sell all GGTK back again for WETH, and return the WETH profit to the main wallet
        let sell = await makeSell(receiver_address, walletSigner, maxToSell);
        console.log('sell receipt: ', sell);
  
      }
      
}

function sleepBeforeSell(ms) {
    console.log('sleeping....');
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

//This will run the script exactly 1 time
//main().then().finally(() => {
//    console.log('Run ' + RUNNING_DEX + ' MMScript done!');
//});

//NOTE if we want to use a cron to run the script daily in a more automated way
//We should comment the lines above with the main() call, and use the cron schedule above
//0 0 0 * * * //will run every day at 00:00 AM (midnight)
console.log('CRON_SCHEDULE: ',process.env.CRON_SCHEDULE);
cron.schedule(process.env.CRON_SCHEDULE, async () => { 
  console.log('running cron job at: ' + new Date().toString());
  main().then().finally(() => {
    console.log('Run ' + RUNNING_DEX + ' MMScript done!');
    }
  );
});
