const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("alert mode table creation");

const AlertMode = db.define(
  "AlertMode",
  {         
    mode :{
      type:Sequelize.STRING,
      allowNull:true,
    },   
    colourcode :{
        type:Sequelize.STRING,
        allowNull:false,
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
    tableName: "AlertMode",
    freezeTableName: true,
    timestamps: false,
    restartIdentity: true,
  }
);

AlertMode.sync({ alter: true });

module.exports = AlertMode;
