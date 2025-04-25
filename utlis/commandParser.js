// utils/commandParser.js
/**
 * Advanced command parser for handling various transaction-related commands
 * Including support for MTK custom token
 */

// Standard patterns for common commands
const PATTERNS = {
    SEND: /^send\s+(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+to\s+(.+)$/i,
    CHECK_BALANCE: /^(?:check|show|view)\s+(?:my)?\s*balance(?:\s+of\s+([a-zA-Z]+))?$/i,
    ADD_CONTACT: /^add\s+contact\s+([a-zA-Z0-9_]+)\s+(?:with\s+address\s+|as\s+)?(0x[a-fA-F0-9]{40})$/i,
    LIST_CONTACTS: /^(?:list|show|view)\s+(?:my)?\s*contacts$/i
  };
  
  /**
   * Parse a command string into structured data
   * @param {string} commandString - The command to parse
   * @returns {Object|null} Parsed command data or null if invalid
   */
  function parseCommand(commandString) {
    if (!commandString || typeof commandString !== 'string') {
      return null;
    }
    
    const command = commandString.trim();
    
    // Try to match each pattern
    let match;
    
    // 1. Send tokens
    if ((match = command.match(PATTERNS.SEND))) {
      // Extract token from the command, normalize it to uppercase
      let token = match[2].toUpperCase();
      
      // Handle token aliases/variations
      if (token === 'MYTOKEN' || token === 'MY-TOKEN' || token === 'MY_TOKEN') {
        token = 'MTK'; // Map various forms to your standard MTK token symbol
      }
      
      return {
        type: 'SEND',
        payload: {
          amount: match[1],
          token: token,
          recipient: match[3].trim()
        }
      };
    }
    
    // 2. Check balance
    if ((match = command.match(PATTERNS.CHECK_BALANCE))) {
      let token = match[1] ? match[1].toUpperCase() : 'ALL';
      
      // Handle token aliases for balance check
      if (token === 'MYTOKEN' || token === 'MY-TOKEN' || token === 'MY_TOKEN') {
        token = 'MTK';
      }
      
      return {
        type: 'CHECK_BALANCE',
        payload: {
          token: token
        }
      };
    }
    
    // 3. Add contact
    if ((match = command.match(PATTERNS.ADD_CONTACT))) {
      return {
        type: 'ADD_CONTACT',
        payload: {
          name: match[1].trim(),
          address: match[2]
        }
      };
    }
    
    // 4. List contacts
    if ((match = command.match(PATTERNS.LIST_CONTACTS))) {
      return {
        type: 'LIST_CONTACTS',
        payload: {}
      };
    }
    
    // No matches found
    return {
      type: 'UNKNOWN',
      originalCommand: command
    };
  }
  
  /**
   * Get user-friendly description of what a command will do (for confirmation)
   * @param {Object} parsedCommand - The parsed command object
   * @returns {string} Human-readable description
   */
  function getCommandDescription(parsedCommand) {
    if (!parsedCommand) return 'Invalid command';
    
    switch (parsedCommand.type) {
      case 'SEND':
        return `Send ${parsedCommand.payload.amount} ${parsedCommand.payload.token} to ${parsedCommand.payload.recipient}`;
      
      case 'CHECK_BALANCE':
        return parsedCommand.payload.token === 'ALL' 
          ? 'Check balance of all tokens' 
          : `Check balance of ${parsedCommand.payload.token}`;
      
      case 'ADD_CONTACT':
        return `Add contact "${parsedCommand.payload.name}" with address ${parsedCommand.payload.address}`;
      
      case 'LIST_CONTACTS':
        return 'List all contacts';
      
      case 'UNKNOWN':
      default:
        return `Unknown command: "${parsedCommand.originalCommand}"`;
    }
  }
  
  module.exports = {
    parseCommand,
    getCommandDescription,
    COMMAND_TYPES: {
      SEND: 'SEND',
      CHECK_BALANCE: 'CHECK_BALANCE',
      ADD_CONTACT: 'ADD_CONTACT',
      LIST_CONTACTS: 'LIST_CONTACTS',
      UNKNOWN: 'UNKNOWN'
    }
  };