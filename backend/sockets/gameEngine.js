const User = require('../models/User');

const buildDeck = () => {
  const colors = ['Red', 'Green', 'Blue', 'Yellow'];
  const deck = [];

  // Number cards (0-9)
  colors.forEach(color => {
    deck.push({ id: `${color}-0`, type: 'Number', color, value: 0 });
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: `${color}-${i}-1`, type: 'Number', color, value: i });
      deck.push({ id: `${color}-${i}-2`, type: 'Number', color, value: i });
    }
    // Action Cards
    deck.push({ id: `${color}-Reverse-1`, type: 'Action', color, value: 'Reverse' });
    deck.push({ id: `${color}-Reverse-2`, type: 'Action', color, value: 'Reverse' });
    deck.push({ id: `${color}-Skip-1`, type: 'Action', color, value: 'Skip' });
    deck.push({ id: `${color}-Skip-2`, type: 'Action', color, value: 'Skip' });
    deck.push({ id: `${color}-+2-1`, type: 'Action', color, value: '+2' });
    deck.push({ id: `${color}-+2-2`, type: 'Action', color, value: '+2' });
  });

  // Wild Cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `Wild-ColorChange-${i}`, type: 'Wild', color: 'Any', value: 'ColorChange' });
    deck.push({ id: `Wild-+4-${i}`, type: 'Wild', color: 'Any', value: '+4' });
  }

  // Super Power Cards
  for (let i = 0; i < 2; i++) {
    deck.push({ id: `Super-+6-${i}`, type: 'Super', color: 'Any', value: '+6' });
    deck.push({ id: `Super-+10-${i}`, type: 'Super', color: 'Any', value: '+10' });
    deck.push({ id: `Super-PunchBack-${i}`, type: 'Super', color: 'Any', value: 'PunchBack' });
    deck.push({ id: `Super-Slam-${i}`, type: 'Super', color: 'Any', value: 'Slam' });
    deck.push({ id: `Super-Couple-${i}`, type: 'Super', color: 'Any', value: 'Couple' });
  }

  // Shuffle
  return deck.sort(() => Math.random() - 0.5);
};

const checkDeck = (state) => {
  if (state.deck.length === 0 && state.discardPile.length > 1) {
    const topCard = state.discardPile.pop(); // keep top card
    state.deck = state.discardPile.sort(() => Math.random() - 0.5);
    state.discardPile = [topCard];
  }
};

// Authoritative Helper to draw cards for a player and replicate if Coupled
const drawCardsForPlayer = (state, playerId, count, isAttackDraw = false) => {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    checkDeck(state);
    if (state.deck.length > 0) {
      const card = state.deck.pop();
      if (!state.hands[playerId]) state.hands[playerId] = [];
      state.hands[playerId].push(card);
      drawn.push(card);
    }
  }

  // Replicate +attacks for Couple Link
  if (isAttackDraw && state.coupleLink && !state.inCoupleReplication) {
    state.inCoupleReplication = true; // prevent infinite loops
    const { p1, p2 } = state.coupleLink;
    if (playerId === p1) {
      drawCardsForPlayer(state, p2, count, true);
    } else if (playerId === p2) {
      drawCardsForPlayer(state, p1, count, true);
    }
    state.inCoupleReplication = false;
  }

  return drawn;
};

const getMaskedState = (room, requestUserId) => {
  if (!room.gameState) return null;
  
  const maskedHands = {};
  Object.keys(room.gameState.hands).forEach(playerId => {
    if (playerId === requestUserId) {
      maskedHands[playerId] = room.gameState.hands[playerId];
    } else {
      // Return a dummy list of cards representing hand size to hide values
      maskedHands[playerId] = Array((room.gameState.hands[playerId] || []).length).fill({ id: 'dummy', type: 'Back' });
    }
  });

  const maskedState = {
    ...room.gameState,
    hands: maskedHands,
    deckCount: room.gameState.deck.length,
  };
  delete maskedState.deck;
  return maskedState;
};

const broadcastGameState = (io, room) => {
  if (!room.gameState) return;
  room.players.forEach(p => {
    if (p.connected && p.socketId) {
      io.to(p.socketId).emit('sync_game_state', getMaskedState(room, p._id));
    }
  });
};

const handleGameEvents = (io, socket, rooms) => {
  socket.on('start_game', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.queue.push(async () => {
      if (room.gameStarted) return;
      if (room.players.length < 2) {
        return socket.emit('error_message', 'Minimum 2 players required to start.');
      }

      room.gameStarted = true;
      let deck = buildDeck();
      
      // Deal 7 cards to each player
      const hands = {};
      room.players.forEach(p => {
        hands[p._id] = deck.splice(0, 7);
      });

      let topCard = deck.pop();
      while (topCard.type === 'Wild' || topCard.type === 'Super' || topCard.type === 'Action') {
        deck.unshift(topCard);
        topCard = deck.pop(); // Ensure first card is a standard number card
      }

      room.gameState = {
        deck,
        discardPile: [topCard],
        hands,
        turnIndex: 0,
        direction: 1, // 1 for clockwise, -1 for counter-clockwise
        activeColor: topCard.color,
        stackingCards: 0, // accumulated penalty cards
        coupleLink: null, // { p1: id, p2: id, roundsLeft: 2 }
        hasDrawn: false,
        winner: null
      };

      io.to(roomId).emit('game_started');
      broadcastGameState(io, room);
    });
  });

  socket.on('player_action', ({ roomId, action, payload }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;

    room.queue.push(async () => {
      const state = room.gameState;
      if (!state) return;

      const player = room.players.find(p => p._id === socket.userId);
      if (!player || !player.connected) {
        return socket.emit('error_message', 'You are not active in this session.');
      }
      
      const currentPlayer = room.players[state.turnIndex];
      if (currentPlayer._id !== socket.userId) {
        return socket.emit('error_message', 'Not your turn');
      }

      if (action === 'play_card') {
        const { card, selectedColor, targetId } = payload;
        const playerHand = state.hands[currentPlayer._id] || [];
        const cardIndex = playerHand.findIndex(c => c.id === card.id);
        if (cardIndex === -1) return;

        const levels = { '+2': 2, '+4': 4, '+6': 6, '+10': 10, 'PunchBack': 99 };
        const topCard = state.discardPile[state.discardPile.length - 1];

        // Stacking validation
        if (state.stackingCards > 0) {
          const cardLevel = levels[card.value];
          if (!cardLevel) {
            return socket.emit('error_message', 'An attack stack is active! You must play an attack card or PunchBack to defend.');
          }
          const requiredLevel = levels[topCard.value] || 0;
          if (cardLevel < requiredLevel) {
            return socket.emit('error_message', `You must play a card of level ${topCard.value} or higher!`);
          }
        }

        // Normal card match validation
        const isValidColor = (card.color === 'Any' || card.color === state.activeColor || card.value === topCard.value);
        if (!isValidColor) {
          return socket.emit('error_message', 'Invalid card. Match card by color or value.');
        }

        // Play card from hand
        playerHand.splice(cardIndex, 1);
        state.discardPile.push(card);
        state.activeColor = (card.color === 'Any' && selectedColor) ? selectedColor : card.color;

        // Handle Card Effects
        if (card.value === 'Reverse') {
          state.direction *= -1;
        }
        
        if (card.value === 'Skip') {
          nextTurn(room);
        }

        // Accumulate +attacks
        if (['+2', '+4', '+6', '+10'].includes(card.value)) {
          state.stackingCards += parseInt(card.value.replace('+', ''));
        }

        // Counter Mechanics: Punch Back
        if (card.value === 'PunchBack') {
          // Find who attacked us (previous turn player)
          const attackerIndex = (state.turnIndex - state.direction + room.players.length) % room.players.length;
          const attacker = room.players[attackerIndex];
          
          // Attack is reversed immediately to the attacker
          drawCardsForPlayer(state, attacker._id, state.stackingCards, true);
          
          // Stack is cleared
          state.stackingCards = 0;
        }

        // Slam effect: selection targeted player receives +3 cards
        if (card.value === 'Slam' && targetId) {
          drawCardsForPlayer(state, targetId, 3, true);
        }

        // Couple effect: link two players
        if (card.value === 'Couple' && targetId) {
          if (!state.coupleLink) {
            state.coupleLink = {
              p1: currentPlayer._id,
              p2: targetId,
              roundsLeft: 2 * room.players.length // exactly 2 full rounds
            };
          }
        }

        // Win Condition check
        if (playerHand.length === 0) {
          state.winner = currentPlayer._id;
          await handleMatchEnd(room, io);
          return;
        }

        state.hasDrawn = false;
        nextTurn(room);
        broadcastGameState(io, room);
      }

      if (action === 'draw_card') {
        if (state.stackingCards > 0) {
          // Stacking penalty resolved on clicking draw (take accumulated stack)
          drawCardsForPlayer(state, currentPlayer._id, state.stackingCards, true);
          state.stackingCards = 0;
          state.hasDrawn = false;
          nextTurn(room);
        } else {
          // Normal turn draw
          if (state.hasDrawn) return;
          checkDeck(state);
          if (state.deck.length > 0) {
            const drawnCard = state.deck.pop();
            if (!state.hands[currentPlayer._id]) state.hands[currentPlayer._id] = [];
            state.hands[currentPlayer._id].push(drawnCard);
            state.hasDrawn = true;
            
            // Check if drawn card is playable
            const topCard = state.discardPile[state.discardPile.length - 1];
            const isPlayable = (drawnCard.color === 'Any' || drawnCard.color === state.activeColor || drawnCard.value === topCard.value);
            
            if (!isPlayable) {
              // Cannot play, auto pass
              state.hasDrawn = false;
              nextTurn(room);
            }
          }
        }
        broadcastGameState(io, room);
      }

      if (action === 'pass_turn') {
        if (state.hasDrawn) {
          state.hasDrawn = false;
          nextTurn(room);
          broadcastGameState(io, room);
        }
      }
    });
  });

  socket.on('play_again', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.queue.push(async () => {
      if (room.hostId !== socket.userId) return;
      
      // Reset room parameters to return to lobby state
      room.gameStarted = false;
      room.gameState = null;
      
      io.to(roomId).emit('room_update', room);
    });
  });
};

const nextTurn = (room) => {
  const state = room.gameState;
  const levels = { '+2': 2, '+4': 4, '+6': 6, '+10': 10, 'PunchBack': 99 };

  while (true) {
    state.turnIndex = (state.turnIndex + state.direction + room.players.length) % room.players.length;
    
    // Decrement rounds left on couple linking
    if (state.coupleLink) {
      state.coupleLink.roundsLeft--;
      if (state.coupleLink.roundsLeft <= 0) {
        state.coupleLink = null;
      }
    }

    // Auto-resolve stacking penalty if active player cannot defend
    if (state.stackingCards > 0) {
      const currentPlayer = room.players[state.turnIndex];
      const topCard = state.discardPile[state.discardPile.length - 1];
      const requiredLevel = levels[topCard.value] || 0;
      
      const hasValidDefensiveCard = (state.hands[currentPlayer._id] || []).some(c => {
        const cardLevel = levels[c.value];
        return cardLevel && cardLevel >= requiredLevel;
      });
      
      if (!hasValidDefensiveCard) {
        // Forces active player to draw full penalty and skips turn
        drawCardsForPlayer(state, currentPlayer._id, state.stackingCards, true);
        state.stackingCards = 0;
        continue;
      }
    }
    break;
  }
};

const handlePlayerForfeit = async (io, rooms, roomId, userId) => {
  const room = rooms.get(roomId);
  if (!room) return;

  room.queue.push(async () => {
    const playerIndex = room.players.findIndex(p => p._id === userId);
    if (playerIndex === -1) return;

    const player = room.players[playerIndex];
    console.log(`Executing authoritative forfeit for player ${player.username} from room ${roomId}`);

    if (!room.gameStarted) {
      // Lobby state forfeit: just remove
      room.players.splice(playerIndex, 1);
      if (room.players.length === 0) {
        rooms.delete(roomId);
      } else {
        if (room.hostId === userId) {
          room.hostId = room.players[0]._id;
        }
        io.to(roomId).emit('room_update', room);
      }
      return;
    }

    // Active game forfeit:
    const state = room.gameState;
    
    // 1. Return player's hand cards to the deck/discard
    const playerHand = state.hands[userId] || [];
    if (playerHand.length > 0) {
      state.deck = [...state.deck, ...playerHand].sort(() => Math.random() - 0.5);
      delete state.hands[userId];
    }

    // 2. Remove player from players list
    room.players.splice(playerIndex, 1);

    // 3. Check if only 1 player remains in the room
    if (room.players.length < 2) {
      const winner = room.players[0];
      state.winner = winner._id;
      
      broadcastGameState(io, room);
      await handleMatchEnd(room, io);
      return;
    }

    // 4. If the forfeiting player was linked in a Couple, clear the couple link
    if (state.coupleLink && (state.coupleLink.p1 === userId || state.coupleLink.p2 === userId)) {
      state.coupleLink = null;
    }

    // 5. Adjust turn index
    if (state.turnIndex >= room.players.length) {
      state.turnIndex = state.turnIndex % room.players.length;
    }

    if (playerIndex === state.turnIndex) {
      // Re-align turnIndex since current active player was spliced out
      state.turnIndex = (state.turnIndex - state.direction + room.players.length) % room.players.length;
      nextTurn(room);
    } else if (playerIndex < state.turnIndex) {
      // Decrement turnIndex to keep the active player active (since index shifted left)
      state.turnIndex = (state.turnIndex - 1 + room.players.length) % room.players.length;
    }

    // 6. If the forfeited player was the host, assign a new host
    if (room.hostId === userId) {
      room.hostId = room.players[0]._id;
    }

    // 7. Sync and update
    io.to(roomId).emit('room_update', room);
    broadcastGameState(io, room);
  });
};

const handleMatchEnd = async (room, io) => {
  // Sort standings by hand size ascending (winner has 0 cards, is first)
  let standings = [...room.players].sort((a, b) => {
    const handA = room.gameState.hands[a._id] || [];
    const handB = room.gameState.hands[b._id] || [];
    return handA.length - handB.length;
  });
  
  const results = [];
  for (let i = 0; i < standings.length; i++) {
    const p = standings[i];
    let trophyChange = -5;
    if (i === 0) trophyChange = +40;
    else if (i === 1) trophyChange = +25;
    else if (i === 2) trophyChange = +10;
    else if (i < standings.length - 1) trophyChange = +5;
    
    results.push({ userId: p._id, username: p.username, trophyChange });

    // Save progression stats to DB
    const user = await User.findById(p._id);
    if (user) {
      user.trophies = Math.max(0, user.trophies + trophyChange);
      if (i === 0) {
        user.wins += 1;
      } else {
        user.losses += 1;
      }
      
      // Update league category
      if (user.trophies <= 200) user.league = 'Bronze';
      else if (user.trophies <= 500) user.league = 'Silver';
      else if (user.trophies <= 1000) user.league = 'Gold';
      else if (user.trophies <= 2000) user.league = 'Platinum';
      else if (user.trophies <= 3200) user.league = 'Crystal';
      else if (user.trophies <= 5000) user.league = 'Diamond';
      else user.league = 'Legend';
      
      await user.save();
    }
  }

  io.to(room.id).emit('match_end', results);
};

module.exports = { handleGameEvents, handlePlayerForfeit, getMaskedState };
