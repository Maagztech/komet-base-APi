const express = require('express');
const { reportLocation, getRealTimeLiveUserCount, getRealTimeUserDivision, get24HourUserCount, get24HourUserDivision, updateUserStatus } = require('./controllers/locationController');

const router = express.Router();

router.post('/', reportLocation);
router.get('/real-time-live-user-count', getRealTimeLiveUserCount);
router.get('/real-time-user-division', getRealTimeUserDivision);
router.get('/24-hour-user-count', get24HourUserCount);
router.get('/24-hour-user-division', get24HourUserDivision);
router.post('/update-user-status', updateUserStatus);
module.exports = router;