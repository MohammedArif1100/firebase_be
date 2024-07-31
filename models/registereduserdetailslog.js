const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("RegisteredUserDetails log table creation");

const RegisteredUserDetailsLog = db.define(
  "RegisteredUserDetailsLog",
  {
    userid: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    username: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    ismail_verified: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    user_status: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    islock: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    locked_period: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    locked_reason: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    mobile_number: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    // ismobile_active: {
    //   type: Sequelize.BOOLEAN,
    //   defaultValue: false,
    //   allowNull: false,
    // },
    mobile_access: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    mobile_accessReson: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    incorrect_password_attempt: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    lastpassword_failuredate: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    password_changeddate: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    roles: {
      type: Sequelize.STRING, //Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    },
    updatedby_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    updateddate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
    isdele_reason: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    isreadonly: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    isdele: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "RegisteredUserDetailsLog",
    freezeTableName: true,
    timestamps: false,
  }
);
RegisteredUserDetailsLog.sync({ alter: true });


module.exports = RegisteredUserDetailsLog;
