const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("user details table creation");

const user_details = db.define(
  "user_details",
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
    registrationdate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
    },
    VerificationCode: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    createddate: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    createdby_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    gender: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    user_registration_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    dateofbirth: {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
    isdele: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "user_details",
    freezeTableName: true,
    timestamps: false,
  }
);

const user_detailslog = db.define(
  "user_details_logs",
  {
    username: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    registrationdate: {
      type: Sequelize.DATEONLY,
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
    gender: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    user_registration_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    VerificationCode: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    dateofbirth: {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
    isdele: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "user_details_logs",
    freezeTableName: true,
    timestamps: false,
  }
);


user_details.sync({ alter: true });
user_detailslog.sync({ alter: true });

module.exports = {
  user_details: user_details,
  user_detailslog: user_detailslog,
};
