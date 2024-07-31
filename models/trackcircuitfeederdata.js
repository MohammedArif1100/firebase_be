const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("track circuit feeder data table creation");

// const TrackCircuitFeederData = db.define(
//     'TrackCircuitFeederData',
//     {
//         trackcircuitid: {
//             type:Sequelize.INTEGER,
//             allowNull:false,
//         },
//         count : {
//             type:Sequelize.INTEGER,
//             allowNull:false,
//         } ,  
//         trackcircuitterminal : {
//             type:Sequelize.STRING,
//             allowNull:false,
//         } ,       
//         feederendvoltage: {
//             type:Sequelize.DOUBLE,
//             allowNull:false,
//         },
//         feederendcurrent: {
//             type:Sequelize.DOUBLE,
//             allowNull:false,
//         },
//         chokevoltage: {
//             type:Sequelize.DOUBLE,
//             allowNull:false,
//         }, 
//         charger: {
//             type:Sequelize.DOUBLE,
//             allowNull:false,
//         },
//         createddate: {
//             type:Sequelize.DATE,
//             allowNull:false,
//         },    
//         isdele: {
//             type:Sequelize.BOOLEAN,
//             defaultValue: false,
//             allowNull: false,
//         }
//     },
//     {
//         tabelname: 'TrackCircuitFeederData',
//         freezetablename: true,
//         timestamps:false,
//         restartIdentity: true,
//     }
// );

const TrackCircuitFeederData = db.define(
    'TrackCircuitFeederData',
    {
        trackcircuitid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        count : {
            type:Sequelize.INTEGER,
            allowNull:false,
        } ,  
        trackcircuitterminal : {
            type:Sequelize.STRING,
            allowNull:false,
        } , 
        feed_voltage : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },    
        feed_current : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        choke_voltage : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },    
        battery_charger_dc_voltage : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        battery_charger_dc_current : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        battery_charger_ac_voltage : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        battery_charger_ac_current : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        relay_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        relay_current: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        trv: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        createddate: {
            type:Sequelize.DATE,
            allowNull:false,
        },    
        isdele: {
            type:Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        }
    },
    {
        tabelname: 'TrackCircuitFeederData',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
);


TrackCircuitFeederData.sync({alter : true});

module.exports = TrackCircuitFeederData;