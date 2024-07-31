const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("RegisteredUserDetails table creation");

const RegisteredUserDetails = db.define(
  "RegisteredUserDetails",
  {
    username: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    ismail_verified: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    userstatus: {
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
    mobile_access: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    mobile_accessReson: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    lastpassword_failuredate: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    incorrect_password_attempt: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    password_changeddate: {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    },
    roles: {
      type: Sequelize.STRING, //Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    },
    createddate: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    updateddate: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    isdele_reason: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    isreadonly: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,      
      allowNull:false,
    },
    isdele: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "RegisteredUserDetails",
    freezeTableName: true,
    timestamps: false,
    restartIdentity: true,
  }
);

RegisteredUserDetails.sync({ alter: true }).then(() => {
const admincreate = require("../login/admincreation");
  admincreate();

});

module.exports = RegisteredUserDetails;

