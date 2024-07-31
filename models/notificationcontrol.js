const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("notificationcontrol table creation");

const NotificationControl = db.define(
  "NotificationControl",
  {    
    stationid: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    assertsid:{
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    userid: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },   
    deletedby_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    deleteddate: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    createdby_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
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
    tableName: "NotificationControl",
    freezeTableName: true,
    timestamps: false,
    restartIdentity: true,
  }
);

NotificationControl.sync({ alter: true });

module.exports = NotificationControl;
