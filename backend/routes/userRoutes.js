const express = require('express');
const { getLeaderboard } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Get the top 10 players for the leaderboard
// Using 'protect' middleware to ensure only logged-in users can view it
router.get('/leaderboard', protect, getLeaderboard);

module.exports = router;
