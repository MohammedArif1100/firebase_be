const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("notification send table creation");

const NotificationSend = db.define(
  "NotificationSend",
  {     
    stationid :{
      type:Sequelize.INTEGER,
      allowNull:false,
   },
    assertsid :{
      type:Sequelize.INTEGER,
      allowNull:false,
    } ,
    alertid :{
      type:Sequelize.INTEGER,
      allowNull:false,
    },
    modeid :{
      type:Sequelize.INTEGER,
      allowNull:false,
    },
    alertmessageids :{
      type:Sequelize.ARRAY(Sequelize.INTEGER),
      allowNull:false,
    },
    userid: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    isseen: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    issend: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
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
    tableName: "NotificationSend",
    freezeTableName: true,
    timestamps: false,
    restartIdentity: true,
  }
);

NotificationSend.sync({ alter: true });

module.exports = NotificationSend;
