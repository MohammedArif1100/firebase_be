const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("User role table creation");

const UserRoles = db.define(
  "UserRoles", 
  {
    userrole: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },   
    createddate: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    createdby_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    isdele: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "UserRoles",
    freezeTableName: true,
    timestamps: false,
    restartIdentity: true,
  }
);

UserRoles.sync({ alter: true });

module.exports = UserRoles;
