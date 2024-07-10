const pool = require('../db');
const axios = require('axios');

exports.reportLocation = async (req, res) => {
  const { latitude, longitude, partnerId } = req.body;

  const geoRes = await axios.get(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
  const { city, countryName: country } = geoRes.data;

  const [locationRows] = await pool.execute(
    'SELECT * FROM locations WHERE city = ? AND country = ? AND partner_id = ?',
    [city, country, partnerId]
  );

  if (locationRows.length > 0) {
 
    await pool.execute(
      'UPDATE locations SET live_users = live_users + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [locationRows[0].id]
    );
  } else {
    await pool.execute(
      'INSERT INTO locations (city, country, partner_id, live_users) VALUES (?, ?, ?, 1)',
      [city, country, partnerId]
    );
  }

  await pool.execute(
    'INSERT INTO user_sessions (latitude, longitude, city, country, partner_id) VALUES (?, ?, ?, ?, ?)',
    [latitude, longitude, city, country, partnerId]
  );

  res.status(201).json({ message: 'Location data saved successfully' });
};

exports.getLocations = async (req, res) => {
  const { partnerId } = req.query;

  const [rows] = await pool.execute(
    'SELECT city, country, live_users FROM locations WHERE partner_id = ?',
    [partnerId]
  );

  res.json(rows);
};


exports.getTopCountries = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT country, city, SUM(live_users) as total_users 
     FROM locations 
     GROUP BY country, city 
     ORDER BY total_users DESC 
     LIMIT 5`
  );

  const groupedData = rows.reduce((acc, row) => {
    if (!acc[row.country]) {
      acc[row.country] = { total_users: 0, cities: [] };
    }
    acc[row.country].total_users += row.total_users;
    acc[row.country].cities.push({ city: row.city, users: row.total_users });
    return acc;
  }, {});

  res.json(groupedData);
};

exports.getRecentData = async (req, res) => {
  const [totalUsers] = await pool.execute(
    `SELECT COUNT(*) as total 
     FROM user_sessions 
     WHERE created_at >= NOW() - INTERVAL 24 HOUR`
  );

  const [rows] = await pool.execute(
    `SELECT country, COUNT(*) as users 
     FROM user_sessions 
     WHERE created_at >= NOW() - INTERVAL 24 HOUR 
     GROUP BY country 
     ORDER BY users DESC`
  );

  const total = totalUsers[0].total;
  const percentageData = rows.map(row => ({
    country: row.country,
    percentage: ((row.users / total) * 100).toFixed(2)
  }));

  res.json(percentageData);
};
