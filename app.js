const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import services and models
const BlockchainService = require('./services/blockchainService');
const { ContactRepository } = require('./models/Contact');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    return res.status(200).json({});
  }
  next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Initialize Blockchain Service
const blockchainService = new BlockchainService(
  process.env.RPC_URL,
  process.env.PRIVATE_KEY
);

// Command parsing helper function
function parseCommand(command) {
  console.log('Parsing command:', command);
  
  // Basic regex to extract amount, token, and recipient
  const regex = /send\s+(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+to\s+(.+)/i;
  const match = command.match(regex);
  
  if (!match) {
    console.log('Command does not match pattern');
    return null;
  }
  
  let token = match[2].toUpperCase();
  // Handle token aliases/variations for MTK
  if (token === 'MYTOKEN' || token === 'MY-TOKEN' || token === 'MY_TOKEN') {
    token = 'MTK';
  }
  
  const result = {
    amount: match[1],
    token: token,
    recipient: match[3].trim().toLowerCase() // Lowercase recipient for case-insensitive matching
  };
  
  console.log('Parsed command:', result);
  return result;
}

// Routes

// 1. Contacts API
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, address } = req.body;
    
    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }
    
    // No need for ethers validation here - the model will validate with the regex
    
    const contact = await ContactRepository.create({ name, address });
    
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await ContactRepository.findAll();
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address } = req.body;
    
    const updatedContact = await ContactRepository.update(id, { name, address });
    
    if (!updatedContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(updatedContact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await ContactRepository.delete(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Command execution API
app.post('/api/execute', async (req, res) => {
  try {
    const { command } = req.body;
    console.log('Received execute command:', command);
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    // Parse the command
    const parsedCommand = parseCommand(command);
    
    if (!parsedCommand) {
      return res.status(400).json({ 
        error: 'Invalid command format',
        suggestion: 'Try something like "Send 5 USDC to Alice"'
      });
    }
    
    const { amount, token, recipient } = parsedCommand;
    console.log('Looking for recipient:', recipient);
    
    // Look up the recipient in the contacts
    const contact = await ContactRepository.findByName(recipient);
    console.log('Found contact:', contact);
    
    if (!contact) {
      return res.status(404).json({ 
        error: `Contact "${recipient}" not found`,
        suggestion: `Make sure you've added ${recipient} to your contacts first`
      });
    }
    
    // Use the blockchain service to send tokens
    const transaction = await blockchainService.sendTokens(
      token,
      contact.address,
      amount
    );
    
    res.json({
      success: true,
      message: `Successfully sent ${amount} ${token} to ${recipient}`,
      transaction
    });
    
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Balance check API
app.get('/api/balance', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (token) {
      // Get specific token balance
      const balance = await blockchainService.getTokenBalance(token.toUpperCase());
      res.json(balance);
    } else {
      // Get all balances
      const balances = await blockchainService.getBalances();
      res.json(balances);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;




// blockchainService.js modifications remain the same

// In your main Express app file (e.g., server.js or app.js)

// Add SECRET_WORD to your .env file 
// SECRET_WORD=your_secret_word_here

// Import dependencies
// const express = require('express');
// const mongoose = require('mongoose');
// const bodyParser = require('body-parser');
// require('dotenv').config();

// // Import services and models
// const BlockchainService = require('./services/blockchainService');
// const { ContactRepository } = require('./models/Contact');

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(bodyParser.json());
// app.use(express.json());

// // CORS middleware
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
//   if (req.method === 'OPTIONS') {
//     res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
//     return res.status(200).json({});
//   }
//   next();
// });

// // MongoDB Connection
// mongoose.connect(process.env.MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// }).then(() => {
//   console.log('Connected to MongoDB');
// }).catch(err => {
//   console.error('MongoDB connection error:', err);
// });

// // Initialize Blockchain Service
// const blockchainService = new BlockchainService(
//   process.env.RPC_URL,
//   process.env.PRIVATE_KEY
// );

// // Command parsing helper function
// function parseCommand(command) {
//   console.log('Parsing command:', command);
  
//   // Basic regex to extract amount, token, and recipient
//   const regex = /send\s+(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+to\s+(.+)/i;
//   const match = command.match(regex);
  
//   if (!match) {
//     console.log('Command does not match pattern');
//     return null;
//   }
  
//   let token = match[2].toUpperCase();
//   // Handle token aliases/variations for MTK
//   if (token === 'MYTOKEN' || token === 'MY-TOKEN' || token === 'MY_TOKEN') {
//     token = 'MTK';
//   }
  
//   const result = {
//     amount: match[1],
//     token: token,
//     recipient: match[3].trim().toLowerCase() // Lowercase recipient for case-insensitive matching
//   };
  
//   console.log('Parsed command:', result);
//   return result;
// }

// // Middleware to verify secret word
// const verifySecretWord = (req, res, next) => {
//   // Get secret word from request
//   const secretWord = req.method === 'GET' ? req.query.secretWord : req.body.secretWord;
  
//   // Check if secret word matches
//   if (!secretWord || secretWord !== process.env.SECRET_WORD) {
//     return res.status(401).json({
//       error: 'Invalid secret word. Authentication failed.',
//       requiresAuthentication: true
//     });
//   }
  
//   // If secret word is valid, proceed
//   next();
// };

// // Routes

// // 1. Contacts API
// app.post('/api/contacts', async (req, res) => {
//   try {
//     const { name, address } = req.body;
    
//     if (!name || !address) {
//       return res.status(400).json({ error: 'Name and address are required' });
//     }
    
//     // No need for ethers validation here - the model will validate with the regex
    
//     const contact = await ContactRepository.create({ name, address });
    
//     res.status(201).json(contact);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get('/api/contacts', async (req, res) => {
//   try {
//     const contacts = await ContactRepository.findAll();
//     res.json(contacts);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.put('/api/contacts/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, address } = req.body;
    
//     const updatedContact = await ContactRepository.update(id, { name, address });
    
//     if (!updatedContact) {
//       return res.status(404).json({ error: 'Contact not found' });
//     }
    
//     res.json(updatedContact);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.delete('/api/contacts/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const deleted = await ContactRepository.delete(id);
    
//     if (!deleted) {
//       return res.status(404).json({ error: 'Contact not found' });
//     }
    
//     res.status(204).send();
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 2. Command execution API (with secret word verification)
// app.post('/api/execute', verifySecretWord, async (req, res) => {
//   try {
//     const { command, userAddress } = req.body;
//     console.log('Received execute command:', command);
    
//     if (!command) {
//       return res.status(400).json({ error: 'Command is required' });
//     }
    
//     // Parse the command
//     const parsedCommand = parseCommand(command);
    
//     if (!parsedCommand) {
//       return res.status(400).json({ 
//         error: 'Invalid command format',
//         suggestion: 'Try something like "Send 5 USDC to Alice"'
//       });
//     }
    
//     const { amount, token, recipient } = parsedCommand;
//     console.log('Looking for recipient:', recipient);
    
//     // Look up the recipient in the contacts
//     const contact = await ContactRepository.findByName(recipient);
//     console.log('Found contact:', contact);
    
//     if (!contact) {
//       return res.status(404).json({ 
//         error: `Contact "${recipient}" not found`,
//         suggestion: `Make sure you've added ${recipient} to your contacts first`
//       });
//     }
    
//     // Use the blockchain service to send tokens
//     const transaction = await blockchainService.sendTokens(
//       token,
//       contact.address,
//       amount
//     );
    
//     res.json({
//       success: true,
//       message: `Successfully sent ${amount} ${token} to ${recipient}`,
//       transaction
//     });
    
//   } catch (error) {
//     console.error('Transaction error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // 3. Balance check API (with secret word verification)
// app.get('/api/balance', verifySecretWord, async (req, res) => {
//   try {
//     const { token } = req.query;
    
//     if (token) {
//       // Get specific token balance
//       const balance = await blockchainService.getTokenBalance(token.toUpperCase());
//       res.json(balance);
//     } else {
//       // Get all balances
//       const balances = await blockchainService.getBalances();
//       res.json(balances);
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 4. Health check endpoint
// app.get('/health', (req, res) => {
//   res.json({ status: 'ok', version: '1.0.0' });
// });

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// module.exports = app;