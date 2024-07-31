
const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("gui indication table creation");

const GuiIndication = db.define(
"GuiIndication",
    {
        name: {
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
        tableName: "GuiIndication",
        freezeTableName : true,
        timestamps: false,
        restartIdentity: true,
    }
)


GuiIndication.sync({alter:true})

module.exports = GuiIndication;