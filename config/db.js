const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");
const lodash = require("lodash");
const { Client } = require("pg");

const log4js = require("../log4js");
const logs = log4js.logger;

dotenv.config();

//client creation for postgres

const DbCreations = (async () => {
  // const DbCreation =  new Client({
  //   user: process.env.DB_USER,
  //   password: process.env.DB_PASSWORD,
  //   host: process.env.DB_HOST,
  //   database: process.env.DB_USER,
  //   port: process.env.DB_PORT,
  // });
  // await DbCreation.connect();
  // logs.info("database connected");
  // //to get all the database present in the server
  // try {
  //   await DbCreation.query('SELECT datname FROM pg_database', (err, res) => {    
  //     var db_present = lodash.some(res.rows,{datname:process.env.DB_NAME}) 
  //     //required db is already present   
  //     if(db_present == true) {
  //       logs.info("database already present");    
  //       //console.log('database already present');
  //       DbCreation.end();
  //     }   
  //     else
  //     {
  //       //required db is not present 
  //       logs.info("database not present");
  //       //console.log("database not present");
  //       DbCreation.query('CREATE DATABASE "' +  process.env.DB_NAME + '"', (err, res) => {            
  //         DbCreation.end();
  //       });
  //       logs.info("database created");
  //       //console.log("database created");
  //     }
  //   });
  // }
  // catch (ex) {
  //   logs.info("database creation error-", ex);
  // }


  logs.info(process.env.DB_USER + " // " + process.env.DB_PASSWORD);

})();

const db = new Sequelize(
  process.env.DB_NAME || "postgres",
  process.env.DB_USER || "postgres",
  process.env.DB_PASSWORD || "postgres",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres",
    port: process.env.DB_PORT || 5432,
    //operatorsAliases: false,
    dialectOptions: {
      useUTC: true, // for reading from database
    },
    logging: false,
    timezone: process.env.TIMEZONE_,//"+08:00",
    pool: {
      max: 10000,
      min: 0,
      acquire: 600000,
      idle: 10000,
      evict: 10000,
      ssl: { rejectUnauthorized: false },
    },
    // retry: {
    // match: [/Deadlock/i, Sequelize.ConnectionError], // Retry on connection errors
    // max: 3, // Maximum retry 3 times
    // backoffBase: 3000, // Initial backoff duration in ms. Default: 100,
    // backoffExponent: 1.5, // Exponent to increase backoff each try. Default: 1.1
    // },
  }
);

const cloudDb = new Sequelize(
  process.env.CLOUD_DB_NAME || "postgres",
  process.env.CLOUD_DB_USER || "postgres",
  process.env.CLOUD_DB_PASSWORD || "postgres",
  {
    host: process.env.CLOUD_DB_HOST || "localhost",
    dialect: "postgres",
    port: process.env.CLOUD_DB_PORT || 5432,
    //operatorsAliases: false,
    dialectOptions: {
      useUTC: true, // for reading from database
    },
    logging: false,
    timezone: process.env.TIMEZONE_,//"+08:00",
    pool: {
      max: 10000,
      min: 0,
      acquire: 1000000,
      idle: 10000,
      evict: 10000,
      ssl: { rejectUnauthorized: false },
    },
    // retry: {
    // match: [/Deadlock/i, Sequelize.ConnectionError], // Retry on connection errors
    // max: 3, // Maximum retry 3 times
    // backoffBase: 3000, // Initial backoff duration in ms. Default: 100,
    // backoffExponent: 1.5, // Exponent to increase backoff each try. Default: 1.1
    // },
  }
);

module.exports = { DbCreations, db, cloudDb };

