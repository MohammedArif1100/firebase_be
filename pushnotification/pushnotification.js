
const express = require("express");
const bodyParser = require("body-parser");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const JwtDecode = require("jwt-decode");
const log4js = require("../log4js");
const logs = log4js.logger;

const pushNotification = express.Router();
const db = require("../config/db").db;
const { validuser } = require("../login/verifytoken");

const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  //   databaseURL: 'https://your-database-name.firebaseio.com',
});



const sendNotification = async (message, retries = 3) => {
  while (retries > 0) {
    try {
      const response = await admin.messaging().send(message);
      return response;
    } catch (error) {
      if (retries <= 1 || !isRetryableError(error)) {
        throw error;
      }
      retries--;
      await new Promise(resolve => setTimeout(resolve, 1000)); 
    }
  }
};

const isRetryableError = (error) => {
  return error.code === 'network-error';
};

pushNotification.get('/getPushNotification', validuser, async (req, res) => {
  logs.info("get push notification started");

  const user_id = JwtDecode(req.token).Userid;
  const user_role = JwtDecode(req.token).Roles;
  const user_mail = JwtDecode(req.token).Email;

  logs.info('queryForPushNotification', req.query.token);
  const registrationToken = req.query.token;

  const message = {
    notification: {
      title: 'Test notification',
      body: 'Checking for the FCM from server',
    },
    token: registrationToken,
  };

  try {
    const response = await sendNotification(message);
    res.status(200).send({ isSuccess: true, messageId: response });
    logs.info('Successfully sent message:', response);
  } catch (error) {
    res.status(500).send({ isSuccess: false, error: error.message });
    logs.info('Error sending message:', error.message);
  }

  logs.info("Push Notification ended");
});

module.exports = pushNotification;