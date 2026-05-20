const User = require('../models/User');

const getLeaderboard = async (req, res) => {
  try {
    // Fetch top 10 players sorted by trophies descending
    const topPlayers = await User.find()
      .sort({ trophies: -1 })
      .limit(10)
      .select('fullName username trophies league'); // only fetch needed fields

    res.status(200).json(topPlayers);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error fetching leaderboard.' });
  }
};

module.exports = {
  getLeaderboard
};
