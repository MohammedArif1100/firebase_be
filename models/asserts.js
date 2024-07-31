const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("asserts table creation");

const Asserts = db.define(
  "Asserts",
  {     
    assertname :{
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
    tableName: "Asserts",
    freezeTableName: true,
    timestamps: false,
    restartIdentity: true,
  }
);

Asserts.sync({ alter: true });

module.exports = Asserts;
