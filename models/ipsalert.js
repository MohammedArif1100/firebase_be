const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("IPS alert log table creation");

const IPSAlert = db.define(
  "IPSAlert",
  {
    ipsid: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    ipsdataid: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    stationid: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    message: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    modeid: {
      type: Sequelize.INTEGER,
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
    tabelname: "IPSAlert",
    freezetablename: true,
    timestamps: false,
    restartIdentity: true,
  }
);

IPSAlert.sync({ alter: true });

module.exports = IPSAlert;
