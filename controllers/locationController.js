const pool = require('../db');
const axios = require('axios');

exports.reportLocation = async (req, res) => {
  try {
    const { latitude, longitude, partnerId } = req.body;

    if (!latitude || !longitude || !partnerId) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const geoRes = await axios.get(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
    const { city, countryName: country } = geoRes.data;

    const [locationRows] = await pool.execute(
      'SELECT * FROM locations WHERE city = ? AND country = ? AND partner_id = ?',
      [city, country, partnerId]
    );

    if (locationRows.length > 0) {
      await pool.execute(
        'UPDATE locations SET live_users = live_users + 1, updated_at = CURRENT_TIMESTAMP WHERE city = ? AND country = ? AND partner_id = ?',
        [city, country, partnerId]
      );
    } else {
      await pool.execute(
        'INSERT INTO locations (latitude, longitude, city, country, partner_id, live_users) VALUES (?, ?, ?, ?, ?, 1)',
        [latitude, longitude, city, country, partnerId]
      );
    }

    await pool.execute(
      'INSERT INTO user_sessions (latitude, longitude, city, country, partner_id) VALUES (?, ?, ?, ?, ?)',
      [latitude, longitude, city, country, partnerId]
    );

    res.status(201).json({ message: 'Location data saved successfully' });
  } catch (error) {
    console.error('Error reporting location:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateUserStatus = async (req, res) => {
  const { latitude, longitude, partnerId } = req.body;

  await pool.execute(
    `UPDATE user_sessions 
     SET live = FALSE 
     WHERE latitude = ? AND longitude = ? AND partner_id = ?`,
    [latitude, longitude, partnerId]
  );

  const [locationRows] = await pool.execute(
    `SELECT city, country FROM user_sessions 
     WHERE latitude = ? AND longitude = ? AND partner_id = ?`,
    [latitude, longitude, partnerId]
  );

  if (locationRows.length > 0) {
    const { city, country } = locationRows[0];

    const [liveUsersCount] = await pool.execute(
      'SELECT COUNT(*) AS live_users FROM user_sessions WHERE city = ? AND country = ? AND partner_id = ? AND live = TRUE',
      [city, country, partnerId]
    );

    await pool.execute(
      'UPDATE locations SET live_users = ? WHERE city = ? AND country = ? AND partner_id = ?',
      [liveUsersCount[0].live_users, city, country, partnerId]
    );
  }

  res.status(200).json({ message: 'User status updated successfully' });
};


exports.getRealTimeLiveUserCount = async (req, res) => {
  const { partnerId } = req.query;

  const [rows] = await pool.execute(
    'SELECT SUM(live_users) AS live_user_count FROM locations WHERE partner_id = ?',
    [partnerId]
  );

  res.status(200).json({ live_user_count: rows[0].live_user_count });
};

exports.getRealTimeUserDivision = async (req, res) => {
  const { partnerId } = req.query;

  const [rows] = await pool.execute(
    'SELECT country, city, latitude, longitude, live_users FROM locations WHERE partner_id = ?',
    [partnerId]
  );

  const countryData = {};

  rows.forEach(row => {
    if (!countryData[row.country]) {
      countryData[row.country] = {
        total_users: 0,
        cities: [],
        latitude: row.latitude,
        longitude: row.longitude
      };
    }
    countryData[row.country].total_users += row.live_users;
    countryData[row.country].cities.push({
      city: row.city,
      users: row.live_users,
      latitude: row.latitude,
      longitude: row.longitude
    });
  });

  const totalUsers = Object.values(countryData).reduce((acc, country) => acc + country.total_users, 0);

  const responseData = {};

  Object.keys(countryData).forEach(country => {
    const percentage = ((countryData[country].total_users / totalUsers) * 100).toFixed(2);
    responseData[country] = {
      total_users: countryData[country].total_users,
      percentage: `${percentage}%`,
      latitude: countryData[country].latitude,
      longitude: countryData[country].longitude,
      cities: countryData[country].cities
    };
  });

  res.status(200).json(responseData);
};

exports.get24HourUserCount = async (req, res) => {
  const { partnerId } = req.query;

  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS user_count FROM user_sessions WHERE partner_id = ? AND created_at >= NOW() - INTERVAL 24 HOUR',
    [partnerId]
  );

  res.status(200).json({ user_count: rows[0].user_count });
};

exports.get24HourUserDivision = async (req, res) => {
  const { partnerId } = req.query;

  const [rows] = await pool.execute(
    `SELECT country, city, latitude, longitude, COUNT(*) AS users 
     FROM user_sessions 
     WHERE partner_id = ? AND created_at >= NOW() - INTERVAL 24 HOUR 
     GROUP BY country, city, latitude, longitude`,
    [partnerId]
  );

  const countryData = {};

  rows.forEach(row => {
    if (!countryData[row.country]) {
      countryData[row.country] = {
        total_users: 0,
        cities: [],
        latitude: row.latitude,
        longitude: row.longitude
      };
    }
    countryData[row.country].total_users += row.users;
    countryData[row.country].cities.push({
      city: row.city,
      users: row.users,
      latitude: row.latitude,
      longitude: row.longitude
    });
  });

  const totalUsers = Object.values(countryData).reduce((acc, country) => acc + country.total_users, 0);

  const responseData = {};

  Object.keys(countryData).forEach(country => {
    const percentage = ((countryData[country].total_users / totalUsers) * 100).toFixed(2);
    responseData[country] = {
      total_users: countryData[country].total_users,
      percentage: `${percentage}%`,
      latitude: countryData[country].latitude,
      longitude: countryData[country].longitude,
      cities: countryData[country].cities
    };
  });

  res.status(200).json(responseData);
};
