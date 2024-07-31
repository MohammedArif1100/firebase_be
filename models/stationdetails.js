const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const moment = require("moment");
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("Station Details table creation");

const StationDetails = db.define(
  "StationDetails",
  {     
    stationcode :{
      type:Sequelize.STRING,
      allowNull:false,
    },   
    stationname : {
      type:Sequelize.STRING,
      allowNull:false,
    },
    district :{
        type:Sequelize.STRING,
        allowNull:true,
      },   
    state:{
      type:Sequelize.STRING,
      allowNull:true,
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
    tableName: "StationDetails",
    freezeTableName: true,
    timestamps: false,
    restartIdentity: true,
  }
);

StationDetails.sync({ alter: true }).then(() => {
  const station_insert = require("../readexcel").station_insert;
  station_insert();
  const zone_insert = require("../readexcel").zone_insert;
  zone_insert();
  const assert_insert = require("../readexcel").assert_insert;
  assert_insert();
  const gui_insert = require("../readexcel").gui_insert;
  gui_insert();
  const alertmode_insert = require("../readexcel").alertmode_insert;
  alertmode_insert();
  const signalaspecttype_insert = require("../readexcel").signalaspecttype_insert;
  signalaspecttype_insert();
  const alert_insert = require("../readexcel").alert_insert;
  alert_insert();
}
);

module.exports = StationDetails;
