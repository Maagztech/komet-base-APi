const express = require('express');
const cors = require('cors');
const locationRoutes = require('./locationRoutes');
const cron = require('node-cron');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/location', locationRoutes);

cron.schedule('0 * * * *', async () => {
  await pool.execute(
    'DELETE FROM user_sessions WHERE created_at < NOW() - INTERVAL 24 HOUR'
  );

  const [locationRows] = await pool.execute('SELECT id, city, country, partner_id FROM locations');
  for (const location of locationRows) {
    const [liveUsersCount] = await pool.execute(
      'SELECT COUNT(*) AS live_users FROM user_sessions WHERE city = ? AND country = ? AND partner_id = ? AND live = TRUE',
      [location.city, location.country, location.partner_id]
    );

    await pool.execute(
      'UPDATE locations SET live_users = ? WHERE id = ?',
      [liveUsersCount[0].live_users, location.id]
    );
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
