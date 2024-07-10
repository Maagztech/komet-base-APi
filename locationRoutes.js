const express = require('express');
const { reportLocation, getLocations, getTopCountries, getRecentData } = require('./controllers/locationController');

const router = express.Router();

router.post('/', reportLocation);
router.get('/', getLocations);
router.get('/top-countries', getTopCountries);
router.get('/recent-data', getRecentData);

module.exports = router;