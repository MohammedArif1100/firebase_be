const nodemailer = require("nodemailer");
const log4js = require("../log4js");
const logs = log4js.logger;

const dotenv = require("dotenv");
dotenv.config();

//setup set mail transporter
let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: `${process.env.ROOT_USER_MAILID}`,
    pass: `${process.env.ROOT_USER_MAILID_PASSWORD}`,
  },
});
let info = "";

module.exports.mailSend = async (To, Cc, Subject, body) => {
  // try {    
  //   //console.log("Mail send started");
  //   logs.info("Mail send started");
  //   logs.info(`To : ${To} cc : ${Cc} Subject : ${Subject}`);

  //   if (Cc !== null && Cc !== "") {
  //       let mailDetails = {
  //           from: `${process.env.ROOT_USER_MAILID}`, //"skillcaliber@gmail.com",
  //           to: To, //"aravindharjan@gmailcom", // list of receivers
  //           cc: Cc,
  //           bcc:`${process.env.ROOT_USER_MAILID}`,
  //           subject: Subject, // Subject line
  //           html: body, // html body
  //       };  

  //       await transporter.sendMail(mailDetails, function(err, data) {
  //       if(err) {
  //           logs.error('mail sending  error-' + err);
  //       } else {
  //           logs.info("Mail send successfully");
  //           //console.log('Email sent successfully');
  //       }
  //     });
  //   } else {

  //       let mailDetails = {
  //           from: `${process.env.ROOT_USER_MAILID}`, //"skillcaliber@gmail.com",
  //           to: To, //"aravindharjan@gmailcom", // list of receivers
  //           bcc:`${process.env.ROOT_USER_MAILID}`,
  //           subject: Subject, // Subject line
  //           html: body, // html body
  //       };  

  //       await transporter.sendMail(mailDetails, function(err, data) {
  //           if(err) {
  //               logs.error('mail sending  error-' + err);
  //           } else {
  //               logs.info("Mail send successfully");
  //               console.log('Email sent successfully');
  //           }
  //       });

  //   }
  //   logs.info("Mail send successfully");
  // } catch (ex) {
  //   logs.error('mail sending error-' + ex);
  // }
};


module.exports.mailSendError = async (Subject, body) => {
  // try {    
  //   console.log("error mail loop start");
  //   logs.info("Mail send started");
  //   logs.info(`Subject is -------------------------------------: ${Subject}`);

  //  // console.log(`Subject is -------------------------------------: ${Subject}`);
  //   // //console.log(
  //   //   `Body is ----------------------------------------------:  ${body}`
  //   // );
  //   info = await transporter.sendMail({
  //     from: `${process.env.ROOT_USER_MAILID}`, 
  //     to: `${process.env.ERROR_MAILID}`, //"sw@caliberinterconnect.net", //aravindharajan.j@gmail.com", // list of receivers
  //     cc: "",//"skillcaliber@gmail.com",
  //     bcc:`${process.env.ROOT_USER_MAILID}`,
  //     subject: Subject, // Subject line
  //     //text: "Hello world?", // plain text body
  //     html: `${body}`, // html body
  //   });

  //   // console.log("Error Mail send");
  //   // console.log("Error Message sent: %s", info.messageId);
  //   logs.info("Error Mail send successfully");
  //   logs.info("Error Message sent id : %s", info.messageId);    
  // } catch (ex) {
  //   //console.log(ex.message);
  //   logs.error('mail send error error' + ex);
  //   //res.status(400).send(`Something went wrong, Please try again later`);
  // }
};

