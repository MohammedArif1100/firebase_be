const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("signal aspect type table creation");

const SignalAspectType = db.define(
"SignalAspectType",
    {
        description: {
            type : Sequelize.STRING,
            allowNull: false,
        },
        createddate:{
            type:Sequelize.DATE,
            allowNull:false,
        },
        isdele:{
            type:Sequelize.BOOLEAN,
            allowNull:false,
            defaultValue:false,
        }
    } ,
    {
        tableName: "SignalAspectType",
        freezeTableName : true,
        timestamps: false,
        restartIdentity: true,
    }
)


SignalAspectType.sync({alter:true})

module.exports = SignalAspectType;