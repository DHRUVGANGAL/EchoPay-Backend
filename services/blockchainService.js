// services/blockchainService.js
const { ethers } = require('ethers');

// Token ABIs
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Token addresses for Sepolia testnet with custom MTK token
const TOKEN_ADDRESSES = {
  // Sepolia testnet addresses
  MTK: '0x0E4Dd0bA5a6f1bc0ffFE421dbB8E252dFF0C66f6', // Replace with your MTK token contract address
  ETH: 'NATIVE', // Special case for ETH
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Example Sepolia USDC address
  DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', // Example Sepolia DAI address
  USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0'  // Example Sepolia USDT address
};

// Token decimals cache
const TOKEN_DECIMALS = {
  MTK: 18, // Most custom tokens use 18 decimals, adjust if yours is different
  USDC: 6,
  ETH: 18,
  DAI: 18,
  USDT: 6
};

class BlockchainService {
  constructor(rpcUrl, privateKey) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    console.log(`Blockchain service initialized for wallet: ${this.wallet.address} on testnet`);
  }
  
  /**
   * Get the decimals for a token
   * @param {string} tokenSymbol - Token symbol (e.g., "MTK")
   * @returns {Promise<number>} - Number of decimals
   */
  async getTokenDecimals(tokenSymbol) {
    // Return from cache if available
    if (TOKEN_DECIMALS[tokenSymbol]) {
      return TOKEN_DECIMALS[tokenSymbol];
    }
    
    // Special case for ETH
    if (tokenSymbol === 'ETH') {
      return 18;
    }
    
    // Get token address
    const tokenAddress = this.getTokenAddress(tokenSymbol);
    if (!tokenAddress) {
      throw new Error(`Unsupported token: ${tokenSymbol}`);
    }
    
    try {
      // Query the contract
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const decimals = await tokenContract.decimals();
      
      // Cache the result
      TOKEN_DECIMALS[tokenSymbol] = decimals;
      
      return decimals;
    } catch (error) {
      console.error(`Error getting decimals for ${tokenSymbol}:`, error);
      // Fallback to default decimals if contract call fails
      return TOKEN_DECIMALS[tokenSymbol] || 18;
    }
  }
  
  /**
   * Get token address from symbol
   * @param {string} tokenSymbol - Token symbol (e.g., "MTK")
   * @returns {string|null} - Token contract address or null if not found
   */
  getTokenAddress(tokenSymbol) {
    return TOKEN_ADDRESSES[tokenSymbol] || null;
  }
  
  /**
   * Send tokens to an address
   * @param {string} tokenSymbol - Token to send (e.g., "MTK")
   * @param {string} toAddress - Recipient address
   * @param {string} amount - Amount as a string (e.g., "5.5")
   * @returns {Promise<Object>} - Transaction receipt
   */
  async sendTokens(tokenSymbol, toAddress, amount) {
    // Validate address
    if (!ethers.utils.isAddress(toAddress)) {
      throw new Error('Invalid Ethereum address');
    }
    
    // Handle ETH transfers (native token)
    if (tokenSymbol === 'ETH') {
      return this.sendEth(toAddress, amount);
    }
    
    // Get token contract
    const tokenAddress = this.getTokenAddress(tokenSymbol);
    if (!tokenAddress) {
      throw new Error(`Unsupported token: ${tokenSymbol}`);
    }
    
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      this.wallet
    );
    
    // Get token decimals
    const decimals = await this.getTokenDecimals(tokenSymbol);
    
    // Convert amount to token units
    const amountInTokenUnits = ethers.utils.parseUnits(amount, decimals);
    
    try {
      // Check balance before sending
      const balance = await tokenContract.balanceOf(this.wallet.address);
      if (balance.lt(amountInTokenUnits)) {
        throw new Error(`Insufficient ${tokenSymbol} balance`);
      }
      
      // Send transaction with higher gas limit for testnet
      const tx = await tokenContract.transfer(toAddress, amountInTokenUnits, {
        gasLimit: 250000 // Higher gas limit for testnet transactions
      });
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        from: this.wallet.address,
        to: toAddress,
        amount,
        token: tokenSymbol,
        blockNumber: receipt.blockNumber,
        network: 'testnet'
      };
    } catch (error) {
      console.error(`Error sending ${tokenSymbol}:`, error);
      throw new Error(`Failed to send ${tokenSymbol}: ${error.message || 'Transaction error'}`);
    }
  }
  
  /**
   * Send ETH to an address
   * @param {string} toAddress - Recipient address
   * @param {string} amount - Amount as a string in ETH (e.g., "0.1")
   * @returns {Promise<Object>} - Transaction receipt
   */
  async sendEth(toAddress, amount) {
    // Validate address
    if (!ethers.utils.isAddress(toAddress)) {
      throw new Error('Invalid Ethereum address');
    }
    
    try {
      // Convert amount to wei
      const amountInWei = ethers.utils.parseEther(amount);
      
      // Check balance
      const balance = await this.provider.getBalance(this.wallet.address);
      if (balance.lt(amountInWei)) {
        throw new Error('Insufficient ETH balance');
      }
      
      // Create transaction with higher gas limit for testnet
      const tx = await this.wallet.sendTransaction({
        to: toAddress,
        value: amountInWei,
        gasLimit: 250000 // Higher gas limit for testnet transactions
      });
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        from: this.wallet.address,
        to: toAddress,
        amount,
        token: 'ETH',
        blockNumber: receipt.blockNumber,
        network: 'testnet'
      };
    } catch (error) {
      console.error('Error sending ETH:', error);
      throw new Error(`Failed to send ETH: ${error.message || 'Transaction error'}`);
    }
  }
  
  /**
   * Get balance of a specific token
   * @param {string} tokenSymbol - Token symbol (e.g., "MTK")
   * @param {string} [address] - Address to check (defaults to wallet address)
   * @returns {Promise<Object>} - Balance info
   */
  async getTokenBalance(tokenSymbol, address = null) {
    const targetAddress = address || this.wallet.address;
    
    try {
      // Handle ETH balance
      if (tokenSymbol === 'ETH') {
        const balanceWei = await this.provider.getBalance(targetAddress);
        const balanceEth = ethers.utils.formatEther(balanceWei);
        
        return {
          token: 'ETH',
          balance: balanceEth,
          balanceRaw: balanceWei.toString(),
          decimals: 18,
          network: 'testnet'
        };
      }
      
      // Get token contract
      const tokenAddress = this.getTokenAddress(tokenSymbol);
      if (!tokenAddress) {
        throw new Error(`Unsupported token: ${tokenSymbol}`);
      }
      
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider
      );
      
      // Get token balance and decimals
      const [balanceRaw, decimals] = await Promise.all([
        tokenContract.balanceOf(targetAddress).catch(() => ethers.BigNumber.from(0)),
        this.getTokenDecimals(tokenSymbol)
      ]);
      
      // Format balance
      const balance = ethers.utils.formatUnits(balanceRaw, decimals);
      
      return {
        token: tokenSymbol,
        balance,
        balanceRaw: balanceRaw.toString(),
        decimals,
        network: 'testnet'
      };
    } catch (error) {
      console.error(`Error checking ${tokenSymbol} balance:`, error);
      return {
        token: tokenSymbol,
        balance: '0',
        error: error.message,
        network: 'testnet'
      };
    }
  }
  
  /**
   * Get balances for multiple tokens
   * @param {string[]} tokenSymbols - Array of token symbols
   * @param {string} [address] - Address to check (defaults to wallet address)
   * @returns {Promise<Object[]>} - Array of balance info objects
   */
  async getBalances(tokenSymbols = ['ETH', 'MTK', 'USDC', 'DAI', 'USDT'], address = null) {
    const balancePromises = tokenSymbols.map(symbol => 
      this.getTokenBalance(symbol, address)
        .catch(err => ({
          token: symbol,
          balance: '0',
          error: err.message,
          network: 'testnet'
        }))
    );
    
    return Promise.all(balancePromises);
  }

  /**
   * Helper method to get the network information
   * @returns {Promise<Object>} - Network information
   */
  async getNetworkInfo() {
    try {
      const network = await this.provider.getNetwork();
      return {
        name: network.name,
        chainId: network.chainId,
        ensAddress: network.ensAddress
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      return { error: error.message };
    }
  }
}

module.exports = BlockchainService;