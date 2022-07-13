module.exports = {
  apps: [
    {
      name: 'Worker Quickswap DEX',
      script: './market_maker.js',
      autorestart: false,
      args: 'quickswap',
      env: {
        "NODE_ENV": "development",
      }
    },
    {
      name: 'Worker Uniswap DEX',
      script: 'market_maker.js',
      autorestart: false,
      args: 'uniswap',
      env: {
        "NODE_ENV": "development",
      }
    }
  ]
};

