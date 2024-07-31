const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const moment = require("moment");
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("zone name table creation");

const ZoneDetails = db.define(
  "ZoneDetails",
  {    
    zoneabbr : {
      type:Sequelize.STRING,
      allowNull:false,
    }, 
    zonename :{
      type:Sequelize.STRING,
      allowNull:false,
    },        
    divisionnames:{
      type:Sequelize.STRING,
      allowNull:false,
    } ,  
    createddate: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    isdele: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "ZoneDetails",
    freezeTableName: true,
    timestamps: false,
    restartIdentity: true,
  }
);

ZoneDetails.sync({ alter: true });

module.exports = ZoneDetails;
