// Requiring the module
const reader = require('xlsx')
const fs = require('fs');
const moment = require("moment");
const lodash = require("lodash");
const log4js = require("./log4js");
const { Op } = require("sequelize");
const logs = log4js.logger;

const db = require('./config/db').db

const StationDetails = require("./models/stationdetails");
const ZoneDetails = require("./models/zonedetails");
const Asserts = require("./models/asserts");
const GuiIndication = require('./models/guiindication');
const AlertMessage = require('./models/alertmessage');
const AlertMode = require('./models/alertmode');
const RegisteredRailwayStations = require('./models/registeredrailwaystation');
const RegisteredPointMachine = require('./models/registeredpointmachine');
const RegisteredSignalCircuit = require('./models/registeredsignalcircuit');
const RegisteredTrackCircuit = require('./models/registeredtrackcircuit');
const RegisteredAxleCounter = require('./models/registeredaxlecounter');
const RegisteredLCGate = require('./models/registeredlcgate');
const RegisteredRelay = require('./models/registeredrelay');
const RegisteredIPS = require('./models/registeredips');
const RegisteredBattery = require('./models/registeredbattery');
const SignalAspectType = require('./models/signalaspecttype');


//insert the station details
const station_insert = async () => {
    try {
        const get_stations = await StationDetails.findAll();

        if (get_stations.length === 0) {
            const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");

            if (fs.existsSync('railways.xlsx')) {
                //console.log('Railways file exists');
                //logs.info('Railways file exists');

                // Reading our railway file
                const file = reader.readFile('railways.xlsx')

                let data = []
                let transaction = await db.transaction({ autocommit: false });
                if (file.SheetNames[0] == "Stations") {
                    try {
                        const temp = reader.utils.sheet_to_json(
                            file.Sheets[file.SheetNames[0]])
                        temp.forEach(async (res) => {
                            var object = {
                                stationcode: res.StationCode,
                                stationname: res.StationName,
                                district: res.District,
                                state: res.State,
                                createddate: `${current_datetime}`,
                                isdele: false,
                            }
                            data.push(object)
                        })
                        await StationDetails.bulkCreate(data, { transaction: transaction })
                        await transaction.commit();
                        //console.log('station details inserted')
                        logs.info('station details inserted');
                    }
                    catch (ex) {
                        await transaction.rollback();
                        logs.error('station details not found-' + ex);
                        //console.log('station details not found-' + ex);
                    }
                }
                else {
                    //console.log('Stations sheet not found')
                    logs.error('Stations sheet not found');
                }
            }
            else {
                //console.log('Railways file not found');
                logs.error('Railways file not found');
            }
        }
    }
    catch (ex) {
        logs.error('Station insert excel error-' + ex);

    }
}

//insert the station zone details
const zone_insert = async () => {
    try {
        const get_zones = await ZoneDetails.findAll();

        if (get_zones.length === 0) {
            const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");

            if (fs.existsSync('railways.xlsx')) {
                //console.log('Railways file exists');
                //logs.info('Railways file exists');

                // Reading our railway file
                const file = reader.readFile('railways.xlsx')

                let data = []
                let transaction = await db.transaction({ autocommit: false })
                if (file.SheetNames[1] == "Zones") {
                    try {
                        const temp = reader.utils.sheet_to_json(
                            file.Sheets[file.SheetNames[1]])
                        temp.forEach(async (res) => {
                            var object = {
                                zoneabbr: res.ZoneAbbr,
                                zonename: res.ZoneName,
                                divisionnames: res.Divisions,
                                createddate: `${current_datetime}`,
                                isdele: false,
                            }
                            data.push(object)
                        })
                        await ZoneDetails.bulkCreate(data, { transaction: transaction })
                        await transaction.commit();
                        //console.log('zone details inserted')
                        logs.info('zone details inserted');
                    }
                    catch (ex) {
                        await transaction.rollback();
                        logs.error('Zone details not found-' + ex);
                        //console.log('Zone details not found-' + ex);
                    }
                }
                else {
                    //console.log('Zone sheet not found')
                    logs.error('Zone sheet not found');
                }
            }
            else {
                //console.log('Railways file not found');
                logs.error('Railways file not found');
            }
        }
    }
    catch (ex) {
        //console.log('Station insert excel error-' + ex);
        logs.error('Station insert excel error-' + ex);
    }
}

//insert the station assert details
const assert_insert = async () => {
    try {

        const get_asserts = await Asserts.findAll();

        if (get_asserts.length === 0) {

            const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");

            if (fs.existsSync('railways.xlsx')) {
                //console.log('Railways file exists');
                //logs.info('Railways file exists');

                // Reading our railway file
                const file = reader.readFile('railways.xlsx')

                let data = []
                let transaction = await db.transaction({ autocommit: false })
                if (file.SheetNames[2] == "Asserts") {
                    try {
                        const temp = reader.utils.sheet_to_json(
                            file.Sheets[file.SheetNames[2]])
                        temp.forEach(async (res) => {
                            var object = {
                                assertname: res.Assertname,
                                createddate: `${current_datetime}`,
                                isdele: false,
                            }
                            data.push(object)
                        })
                        await Asserts.bulkCreate(data, { transaction: transaction })
                        await transaction.commit();
                        logs.info('Asserts inserted')
                        //console.log('Asserts inserted');
                    }
                    catch (ex) {
                        await transaction.rollback();
                        logs.error('Asserts details not found-' + ex);
                        //console.log('Asserts details not found-' + ex);
                    }
                }
                else {
                    //console.log('Asserts sheet not found')
                    logs.error('Asserts sheet not found');
                }
            }
            else {
                //console.log('Railways file not found');
                logs.error('Railways file not found');
            }

        }
    }
    catch (ex) {
        //console.log('Assert insert error-' + ex);
        logs.error('Assert insert error-' + ex);
    }
}

//insert the signal gui details
const gui_insert = async () => {
    try {
        const get_gui = await GuiIndication.findAll();

        if (get_gui.length === 0) {
            //console.log('gui insert started')
            //logs.info('gui insert started');
            const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");

            if (fs.existsSync('railways.xlsx')) {
                //console.log('Railways file exists');
                //logs.info('Railways file exists');

                // Reading our railway file
                const file = reader.readFile('railways.xlsx')

                let data = []
                let transaction = await db.transaction({ autocommit: false })
                if (file.SheetNames[3] == "Gui Indications") {
                    try {
                        const temp = reader.utils.sheet_to_json(
                            file.Sheets[file.SheetNames[3]])
                        temp.forEach(async (res) => {
                            var object = {
                                name: res.Name,
                                createddate: `${current_datetime}`,
                                isdele: false,
                            }
                            data.push(object)
                        })
                        await GuiIndication.bulkCreate(data, { transaction: transaction })
                        await transaction.commit();
                        logs.info('Gui inserted')
                        //console.log('Gui inserted');
                    }
                    catch (ex) {
                        await transaction.rollback();
                        logs.error('Gui details not found-' + ex)
                        //console.log('Gui details not found');
                    }
                }
                else {
                    //console.log('Asserts sheet not found')
                    logs.error('Asserts sheet not found');
                }
            }
            else {
                //console.log('Railways file not found');
                logs.error('Railways file not found');
            }

        }
    }
    catch (ex) {
        logs.error('Gui insert error-' + ex);
        //console.log('Gui insert error-' + ex);
    }
}

//insert the alert mode details
const alertmode_insert = async () => {
    try {
        const get_alertmode = await AlertMode.findAll();

        if (get_alertmode.length === 0) {
            //console.log('alert mode insert started')
            //logs.info('alert mode  started');
            const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");

            if (fs.existsSync('railways.xlsx')) {
                //console.log('Railways file exists');
                //logs.info('Railways file exists');

                // Reading our railway file
                const file = reader.readFile('railways.xlsx')

                let data = []
                let transaction = await db.transaction({ autocommit: false })
                if (file.SheetNames[4] == "Alert Modes") {
                    try {
                        const temp = reader.utils.sheet_to_json(
                            file.Sheets[file.SheetNames[4]])
                        temp.forEach(async (res) => {
                            var object = {
                                mode: res.Mode,
                                colourcode: res.Colourcode,
                                createddate: `${current_datetime}`,
                                isdele: false,
                            }
                            data.push(object)
                        })
                        await AlertMode.bulkCreate(data, { transaction: transaction })
                        await transaction.commit();
                        logs.info('Alertmode inserted')
                        //console.log('Alertmode inserted');
                    }
                    catch (ex) {
                        await transaction.rollback();
                        logs.error('Alertmode details not found-' + ex)
                        //console.log('Alertmode details not found');
                    }
                }
                else {
                    //console.log('Alert mode sheet not found')
                    logs.error('Alert mode sheet not found');
                }
            }
            else {
                //console.log('Railways file not found');
                logs.error('Railways file not found');
            }
        }
    }
    catch (ex) {
        logs.error('Alertmode insert error-' + ex);
        //console.log('Alertmode insert error-' + ex.message);
    }
}

const signalaspecttype_insert = async () => {
    const get_signalaspecttype = await SignalAspectType.findAll();

    if (get_signalaspecttype.length === 0) {
          //console.log('signal aspect type insert started')
        //logs.info('signal aspect type started');
        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");

        if (fs.existsSync('railways.xlsx')) {
            //console.log('Railways file exists');
            //logs.info('Railways file exists');

            // Reading our railway file
            const file = reader.readFile('railways.xlsx')

            let data = []
            let transaction = await db.transaction({ autocommit: false })
            if (file.SheetNames[5] == "Signal Aspect Types") {
                try {
                    const temp = reader.utils.sheet_to_json(
                        file.Sheets[file.SheetNames[5]])
                    temp.forEach(async (res) => {
                        var object = {
                            description: res.Description,
                            createddate: `${current_datetime}`,
                            isdele: false,
                        }
                        data.push(object)
                    })
                    await SignalAspectType.bulkCreate(data, { transaction: transaction })
                    await transaction.commit();
                    logs.info('SignalAspect Type inserted')
                    //console.log('SignalAspect Type inserted');
                }
                catch (ex) {
                    await transaction.rollback();
                    logs.error('SignalAspectType details not found-' + ex)
                    //console.log('SignalAspectType details not found');
                }
            }
            else {
                //console.log('Signal Aspect Type  sheet not found')
                logs.error('Signal Aspect Type sheet not found');
            }
        }
        else {
            //console.log('Railways file not found');
            logs.error('Railways file not found');
        }

    }

}

//insert the station alert details
const alert_insert = async () => {
    try {
        var registeredstations = await RegisteredRailwayStations.findAll({ attributes: ['id', 'createdby_id'], where: { isdele: false }, raw: true})
        var registeredpointmachine = await RegisteredPointMachine.findAll({ attributes: ['id', 'stationid', 'createdby_id'], where: { isdele: false, stationid: { [Op.in]: registeredstations.map(id => id.id) } }, raw: true })
        var registeredtrackcircuit = await RegisteredTrackCircuit.findAll({ attributes: ['id', 'stationid', 'createdby_id'], where: { isdele: false, stationid: { [Op.in]: registeredstations.map(id => id.id) } }, raw: true})
        var registeredsignalcircuit = await RegisteredSignalCircuit.findAll({ attributes: ['id', 'stationid', 'createdby_id'], where: { isdele: false, stationid: { [Op.in]: registeredstations.map(id => id.id) } }, raw: true})
        var registeredaxlecounter = await RegisteredAxleCounter.findAll({ attributes: ['id', 'stationid', 'createdby_id'], where: { isdele: false, stationid: { [Op.in]: registeredstations.map(id => id.id) } }, raw: true})
        var registeredlcgate = await RegisteredLCGate.findAll({ attributes: ['id', 'stationid', 'createdby_id'], where: { isdele: false, stationid: { [Op.in]: registeredstations.map(id => id.id) } }, raw: true})
        var registeredrelay = await RegisteredRelay.findAll({ attributes: ['id', 'stationid', 'createdby_id'], where: { isdele: false, stationid: { [Op.in]: registeredstations.map(id => id.id) } }, raw: true})
        var registeredips = await RegisteredIPS.findAll({ attributes: ['id', 'stationid', 'createdby_id'], where: { isdele: false, stationid: { [Op.in]: registeredstations.map(id => id.id) } }, raw: true})
        var registeredbattery = await RegisteredBattery.findAll({ attributes: ['id', 'stationid', 'createdby_id'], where: { isdele: false, stationid: { [Op.in]: registeredstations.map(id => id.id) } }, raw: true})
        var registeredalerts = await AlertMessage.findAll({ where: { isdele: false, }, raw: true }) 
        var remaining_pointmachine_ids = lodash.difference(lodash.uniq(registeredpointmachine.map(data => data.id)), lodash.uniq(registeredalerts.filter(data => data.assert == "Point Machine").map(data => data.assertid)))
        var remaining_trackcircuit_ids = lodash.difference(lodash.uniq(registeredtrackcircuit.map(data => data.id)), lodash.uniq(registeredalerts.filter(data => data.assert == "Track Circuit").map(data => data.assertid)))
        var remaining_signalcircuit_ids = lodash.difference(lodash.uniq(registeredsignalcircuit.map(data => data.id)), lodash.uniq(registeredalerts.filter(data => data.assert == "Signal Circuit").map(data => data.assertid)))
        var remaining_axlecounter_ids = lodash.difference(lodash.uniq(registeredaxlecounter.map(data => data.id)), lodash.uniq(registeredalerts.filter(data => data.assert == "Axle Counter").map(data => data.assertid)))
        var remaining_lcgate_ids = lodash.difference(lodash.uniq(registeredlcgate.map(data => data.id)), lodash.uniq(registeredalerts.filter(data => data.assert == "LC Gate").map(data => data.assertid)))
        var remaining_relay_ids = lodash.difference(lodash.uniq(registeredrelay.map(data => data.id)), lodash.uniq(registeredalerts.filter(data => data.assert == "Relay").map(data => data.assertid)))
        var remaining_ips_ids = lodash.difference(lodash.uniq(registeredips.map(data => data.id)), lodash.uniq(registeredalerts.filter(data => data.assert == "IPS").map(data => data.assertid)))
        var remaining_battery_ids = lodash.difference(lodash.uniq(registeredbattery.map(data => data.id)), lodash.uniq(registeredalerts.filter(data => data.assert == "Battery").map(data => data.assertid)))
        var pointmachine_ids = lodash.filter(registeredpointmachine, function (p) { return lodash.includes(remaining_pointmachine_ids, p.id); }).sort((a, b) => a.id - b.id);
        var trackcircuit_ids = lodash.filter(registeredtrackcircuit, function (p) { return lodash.includes(remaining_trackcircuit_ids, p.id); }).sort((a, b) => a.id - b.id);
        var signalcircuit_ids = lodash.filter(registeredsignalcircuit, function (p) { return lodash.includes(remaining_signalcircuit_ids, p.id); }).sort((a, b) => a.id - b.id);    
        var axlecounter_ids = lodash.filter(registeredaxlecounter, function (p) { return lodash.includes(remaining_axlecounter_ids, p.id); }).sort((a, b) => a.id - b.id);    
        var lcgate_ids = lodash.filter(registeredlcgate, function (p) { return lodash.includes(remaining_lcgate_ids, p.id); }).sort((a, b) => a.id - b.id);    
        var relay_ids = lodash.filter(registeredrelay, function (p) { return lodash.includes(remaining_relay_ids, p.id); }).sort((a, b) => a.id - b.id);    
        var ips_ids = lodash.filter(registeredips, function (p) { return lodash.includes(remaining_ips_ids, p.id); }).sort((a, b) => a.id - b.id);    
        var battery_ids = lodash.filter(registeredbattery, function (p) { return lodash.includes(remaining_battery_ids, p.id); }).sort((a, b) => a.id - b.id);    
        
        if (pointmachine_ids.length > 0 || trackcircuit_ids.length > 0 || signalcircuit_ids.length > 0 || axlecounter_ids.length > 0 ||
            lcgate_ids.length       > 0 || relay_ids               > 0 || ips_ids.length           > 0 || battery_ids.length > 0) {

            if (fs.existsSync('railways.xlsx')) {

                //logs.info('railways file exists');
                //console.log('railways file exists');

                // Reading our railway file
                const file = reader.readFile('railways.xlsx')
                var data = []
                const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");
                if (pointmachine_ids.length > 0) {
                    if (file.SheetNames[6] == "Point Machine Alerts") {
                        let transaction = await db.transaction({ autocommit: false })
                        try {
                            const temp = reader.utils.sheet_to_json(
                                file.Sheets[file.SheetNames[6]])
                            for (let i = 0; i < pointmachine_ids.length; i++) {
                                temp.forEach(async (res) => {
                                    var object = {
                                        stationid: pointmachine_ids[i].stationid,
                                        assertid: pointmachine_ids[i].id,
                                        assert: "Point Machine",
                                        alertname: res.Alertname,
                                        value: res.Value,
                                        unit: res.Unit,
                                        message: res.Message,
                                        mode: res.Mode,
                                        email: res.Email,
                                        sms: res.SMS,
                                        voice: res.Voice,
                                        isactive: res.IsActive,
                                        iseditable: res.IsEditable,
                                        view: res.View,
                                        description: res.Description,
                                        createddate: `${current_datetime}`,
                                        createdby_id: pointmachine_ids[i].createdby_id,
                                        updateddate: `${current_datetime}`,
                                        isdele: false,
                                    }
                                    data.push(object)
                                })
                            }
                            await AlertMessage.bulkCreate(data, { transaction: transaction })
                            await transaction.commit();
                            logs.info('Point Machine Alerts inserted');
                            //console.log('Point Machine Alerts inserted') 
                        }
                        catch (ex) {
                            await transaction.rollback();
                            logs.error('Point Machine Alerts error-' + ex);
                            //console.log('Point Machine Alerts error-' + ex);
                        }
                    }
                    else {
                        logs.info('Point Machine Alerts sheet not found');
                        //console.log('Point Machine Alerts sheet not found')
                    }
                }               

                var data = []
                if (trackcircuit_ids.length > 0) {
                    if (file.SheetNames[7] == "Track Circuit Alerts") {
                        let transaction = await db.transaction({ autocommit: false })
                        try {
                            const temp = reader.utils.sheet_to_json(
                                file.Sheets[file.SheetNames[7]])
                            for (let i = 0; i < trackcircuit_ids.length; i++) {
                                temp.forEach(async (res) => {
                                    var object = {
                                        stationid: trackcircuit_ids[i].stationid,
                                        assertid: trackcircuit_ids[i].id,
                                        assert: "Track Circuit",
                                        alertname: res.Alertname,
                                        value: res.Value,
                                        unit: res.Unit,
                                        message: res.Message,
                                        mode: res.Mode,
                                        email: res.Email,
                                        sms: res.SMS,
                                        voice: res.Voice,
                                        isactive: res.IsActive,
                                        iseditable: res.IsEditable,
                                        view: res.View,
                                        description: res.Description,
                                        createddate: `${current_datetime}`,
                                        createdby_id: trackcircuit_ids[i].createdby_id,
                                        updateddate: `${current_datetime}`,
                                        isdele: false,
                                    }
                                    data.push(object)
                                })
                            }
                            await AlertMessage.bulkCreate(data, { transaction: transaction })
                            await transaction.commit();
                            logs.info('Track Circuit Alerts inserted');
                            //console.log('Track Circuit Alerts inserted') 
                        }
                        catch (ex) {
                            await transaction.rollback();
                            logs.error('Track Circuit Alerts error-' + ex)
                            //console.log('Track Circuit Alerts error-' + ex);
                        }
                    }
                    else {
                        logs.info('Track Circuit Alerts sheet not found');
                        //console.log('Track Circuit Alerts sheet not found')
                    }
                }               

                var data = []
                if (signalcircuit_ids.length > 0) {
                    if (file.SheetNames[8] == "Signal Circuit Alerts") {
                        let transaction = await db.transaction({ autocommit: false })
                        try {
                            const temp = reader.utils.sheet_to_json(
                                file.Sheets[file.SheetNames[8]])
                            for (let i = 0; i < signalcircuit_ids.length; i++) {
                                temp.forEach(async (res) => {
                                    var object = {
                                        stationid: signalcircuit_ids[i].stationid,
                                        assertid: signalcircuit_ids[i].id,
                                        assert: "Signal Circuit",
                                        alertname: res.Alertname,
                                        value: res.Value,
                                        unit: res.Unit,
                                        message: res.Message,
                                        mode: res.Mode,
                                        email: res.Email,
                                        sms: res.SMS,
                                        voice: res.Voice,
                                        isactive: res.IsActive,
                                        iseditable: res.IsEditable,
                                        view: res.View,
                                        description: res.Description,
                                        createddate: `${current_datetime}`,
                                        createdby_id: signalcircuit_ids[i].createdby_id,
                                        updateddate: `${current_datetime}`,
                                        isdele: false,
                                    }
                                    data.push(object)
                                })
                            }
                            await AlertMessage.bulkCreate(data, { transaction: transaction })
                            await transaction.commit();
                            logs.info('Signal Circuit Alerts inserted');
                            //console.log('Signal Circuit Alerts inserted') 
                        }
                        catch (ex) {
                            await transaction.rollback();
                            logs.error('Signal Circuit Alerts error-' + ex)
                            //console.log('Signal Circuit Alerts error-' + ex);
                        }
                    }
                    else {
                        logs.info('Signal Circuit Alerts sheet not found');
                        //console.log('Signal Circuit Alerts sheet not found')
                    }

                }
               
                var data = []
                if (axlecounter_ids.length > 0) {
                    if (file.SheetNames[9] == "Axle Counter Alerts") {
                        let transaction = await db.transaction({ autocommit: false })
                        try {
                            const temp = reader.utils.sheet_to_json(
                                file.Sheets[file.SheetNames[9]])
                            for (let i = 0; i < axlecounter_ids.length; i++) {
                                temp.forEach(async (res) => {
                                    var object = {
                                        stationid: axlecounter_ids[i].stationid,
                                        assertid: axlecounter_ids[i].id,
                                        assert: "Axle Counter",
                                        alertname: res.Alertname,
                                        value: res.Value,
                                        unit: res.Unit,
                                        message: res.Message,
                                        mode: res.Mode,
                                        email: res.Email,
                                        sms: res.SMS,
                                        voice: res.Voice,
                                        isactive: res.IsActive,
                                        iseditable: res.IsEditable,
                                        view: res.View,
                                        description: res.Description,
                                        createddate: `${current_datetime}`,
                                        createdby_id: axlecounter_ids[i].createdby_id,
                                        updateddate: `${current_datetime}`,
                                        isdele: false,
                                    }
                                    data.push(object)
                                })
                            }
                            await AlertMessage.bulkCreate(data, { transaction: transaction })
                            await transaction.commit();
                            logs.info('Axle Counter Alerts inserted');
                            //console.log('Axle Counter Alerts inserted') 
                        }
                        catch (ex) {
                            await transaction.rollback();
                            logs.error('Axle Counter Alerts error-' + ex)
                            //console.log('Axle Counter Alerts error-' + ex);
                        }
                    }
                    else {
                        logs.info('Axle Counter Alerts sheet not found');
                        //console.log('Axle Counter Alerts sheet not found')
                    }
                }

                var data = []
                if (lcgate_ids.length > 0) {
                    if (file.SheetNames[10] == "LC Gate Alerts") {
                        let transaction = await db.transaction({ autocommit: false })
                        try {
                            const temp = reader.utils.sheet_to_json(
                                file.Sheets[file.SheetNames[10]])
                            for (let i = 0; i < lcgate_ids.length; i++) {
                                temp.forEach(async (res) => {
                                    var object = {
                                        stationid: lcgate_ids[i].stationid,
                                        assertid: lcgate_ids[i].id,
                                        assert: "LC Gate",
                                        alertname: res.Alertname,
                                        value: res.Value,
                                        unit: res.Unit,
                                        message: res.Message,
                                        mode: res.Mode,
                                        email: res.Email,
                                        sms: res.SMS,
                                        voice: res.Voice,
                                        isactive: res.IsActive,
                                        iseditable: res.IsEditable,
                                        view: res.View,
                                        description: res.Description,
                                        createddate: `${current_datetime}`,
                                        createdby_id: lcgate_ids[i].createdby_id,
                                        updateddate: `${current_datetime}`,
                                        isdele: false,
                                    }
                                    data.push(object)
                                })
                            }
                            await AlertMessage.bulkCreate(data, { transaction: transaction })
                            await transaction.commit();
                            logs.info('LC Gate Alerts inserted');
                            //console.log('LC Gate Alerts inserted') 
                        }
                        catch (ex) {
                            await transaction.rollback();
                            logs.error('LC Gate Alerts error-' + ex)
                            //console.log('LC Gate Alerts error-' + ex);
                        }
                    }
                    else {
                        logs.info('LC Gate Alerts sheet not found');
                        //console.log('LC Gate Alerts sheet not found')
                    }
                }
            
                var data = []
                if(relay_ids.length > 0)
                {
                    if (file.SheetNames[11] == "Relay Alerts") {
                        let transaction = await db.transaction({ autocommit: false })
                        try {
                            const temp = reader.utils.sheet_to_json(
                                file.Sheets[file.SheetNames[11]])
                            for (let i = 0; i < relay_ids.length; i++) {                           
                                temp.forEach(async (res) => {
                                    var object = {
                                        stationid: relay_ids[i].stationid,
                                        assertid: relay_ids[i].id,
                                        assert: "Relay",
                                        alertname: res.Alertname,
                                        value: res.Value,
                                        unit: res.Unit,
                                        message: res.Message,
                                        mode: res.Mode,
                                        email: res.Email,
                                        sms: res.SMS,
                                        voice: res.Voice,
                                        isactive: res.IsActive,
                                        iseditable: res.IsEditable,
                                        view: res.View,
                                        description: res.Description,
                                        createddate: `${current_datetime}`,
                                        createdby_id: relay_ids[i].createdby_id,
                                        updateddate: `${current_datetime}`,
                                        isdele: false,
                                    }
                                    data.push(object)
                                })
                            }
                            await AlertMessage.bulkCreate(data, { transaction: transaction })
                            await transaction.commit();
                            logs.info('Relay Alerts inserted');
                            //console.log('Relay Alerts inserted') 
                        }
                        catch (ex) {
                            await transaction.rollback();
                            logs.error('Relay Alerts error-' + ex)
                            //console.log('Relay Alerts error-' + ex);
                        }
                    }
                    else {
                        logs.info('Relay Alerts sheet not found');
                        //console.log('Relay Alerts sheet not found')
                    }
                }               

                var data = []
                if (ips_ids.length > 0) {
                    if (file.SheetNames[12] == "IPS Alerts") {
                        let transaction = await db.transaction({ autocommit: false })
                        try {
                            const temp = reader.utils.sheet_to_json(
                                file.Sheets[file.SheetNames[12]])
                            for (let i = 0; i < ips_ids.length; i++) {
                                temp.forEach(async (res) => {
                                    var object = {
                                        stationid: ips_ids[i].stationid,
                                        assertid: ips_ids[i].id,
                                        assert: "IPS",
                                        alertname: res.Alertname,
                                        value: res.Value,
                                        unit: res.Unit,
                                        message: res.Message,
                                        mode: res.Mode,
                                        email: res.Email,
                                        sms: res.SMS,
                                        voice: res.Voice,
                                        isactive: res.IsActive,
                                        iseditable: res.IsEditable,
                                        view: res.View,
                                        description: res.Description,
                                        createddate: `${current_datetime}`,
                                        createdby_id: ips_ids[i].createdby_id,
                                        updateddate: `${current_datetime}`,
                                        isdele: false,
                                    }
                                    data.push(object)
                                })
                            }
                            await AlertMessage.bulkCreate(data, { transaction: transaction })
                            await transaction.commit();
                            logs.info('IPS Alerts inserted');
                            //console.log('IPS Alerts inserted') 
                        }
                        catch (ex) {
                            await transaction.rollback();
                            logs.error('IPS Alerts error-' + ex)
                            //console.log('IPS Alerts error-' + ex);
                        }
                    }
                    else {
                        logs.info('IPS Alerts sheet not found');
                        //console.log('IPS Alerts sheet not found')
                    }
                }
               
                var data = []
                if (battery_ids.length > 0) {
                    if (file.SheetNames[13] == "Battery Alerts") {
                        let transaction = await db.transaction({ autocommit: false })
                        try {
                            const temp = reader.utils.sheet_to_json(
                                file.Sheets[file.SheetNames[13]])
                            for (let i = 0; i < battery_ids.length; i++) {
                                temp.forEach(async (res) => {
                                    var object = {
                                        stationid: battery_ids[i].stationid,
                                        assertid: battery_ids[i].id,
                                        assert: "Battery",
                                        alertname: res.Alertname,
                                        value: res.Value,
                                        unit: res.Unit,
                                        message: res.Message,
                                        mode: res.Mode,
                                        email: res.Email,
                                        sms: res.SMS,
                                        voice: res.Voice,
                                        isactive: res.IsActive,
                                        iseditable: res.IsEditable,
                                        view: res.View,
                                        description: res.Description,
                                        createddate: `${current_datetime}`,
                                        createdby_id: battery_ids[i].createdby_id,
                                        updateddate: `${current_datetime}`,
                                        isdele: false,
                                    }
                                    data.push(object)
                                })
                            }
                            await AlertMessage.bulkCreate(data, { transaction: transaction })
                            await transaction.commit();
                            logs.info('Battery Alerts inserted');
                            //console.log('Battery Alerts inserted') 
                        }
                        catch (ex) {
                            await transaction.rollback();
                            logs.error('Battery Alerts error-' + ex)
                            //console.log('Battery Alerts error-' + ex);
                        }
                    }
                    else {
                        logs.info('Battery Alerts sheet not found');
                        //console.log('Battery Alerts sheet not found')
                    }
                }
               
            }
            else {
                logs.info('Railways file not found');
                //console.log('Railways file not found');
            }
        }
        require("./mqtt/mqtt");
    }
    catch (ex) {
        logs.error('Alerts insert error-' + ex);
        //console.log('Alerts insert error-' + ex);
    }
}

module.exports = { station_insert, zone_insert, assert_insert, gui_insert, alertmode_insert, signalaspecttype_insert, alert_insert };





