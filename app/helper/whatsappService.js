// whatsappService.js
const axios = require("axios");
require('dotenv').config();

const AISENSY_URL = "https://cloud.apikaro.in/api";
const VENDOR_ID = process.env.VENDOR_ID;

const API_KEY = process.env.WHATSAPP_API_KEY;

async function sendWhatsAppMessages(appointmentType, numbers, data) {
  // Mapping appointmentType to campaignName & paramssss
  let campaignName = "";
  let templateParams = [];

  switch (appointmentType) {
    case "newAppointment":
      campaignName = "appointment_booked_v2";
      templateParams = [
        data.patientName,
        data.doctorName,
        data.hospitalAddress,
        data.bookingTime
      ];
      break;

    case "deleteAppointment":
      campaignName = "appointment_cancel_v2"; 
      templateParams = [
        data.patientName,
        data.doctorName,
        data.hospitalAddress,
        data.bookingTime
      ];
      break;

    case "reminderAppointment":
      campaignName = "appointment_reminder_v2"; 
      templateParams = [
        data.patientName,
        data.doctorName,
        data.hospitalAddress,
        data.bookingTime
      ];
      break;

    case "reminderAppontment3":
      campaignName = "appointment_reminder_3_v2";
      templateParams = [
        data.patientName,
        data.doctorName,
        data.hospitalAddress,
        data.bookingTime,
        data.bookingDate
      ]

    case "cancelAppointmentByPatient": 
      campaignName = "cancel_appointment_by_patient";
      templateParams = [
        data.patientName,
        data.doctorName,
        data.hospitalAddress,
        data.bookingDate,
        data.cancelReason
      ];
      break;

    case "shiftAppointment":
      campaignName = "appointment_shift_v2"; 
      templateParams = [
        data.patientName,
        data.doctorName,
        data.hospitalAddress,
        data.bookingTime
      ];
      break;

    default:
      campaignName = "appointment_booked_v2";
      templateParams = [
        data.patientName,
        data.doctorName,
        data.hospitalAddress,
        data.bookingTime
      ];
      break;
  }
  for (const number of numbers) {
    try {
      const payload = {
        phone_number: number,
        template_name: campaignName,
        template_language: "en_US",
        header_field_1: templateParams[0] || "",
        field_1: templateParams[0] || "",
        field_2: templateParams[1] || "",
        field_3: templateParams[2] || "",
        field_4: templateParams[3] || "",
        field_5: templateParams[4] || "",
        contact: {
          first_name: templateParams[0] || "User",
          last_name: "",
          email: "",
          country: "india",
          language_code: "en_US",
          groups: ""
        }
      };

      const response = await axios.post(`${AISENSY_URL}/${VENDOR_ID}/contact/send-template-message`, payload, {
        headers: { "Content-Type": "application/json" ,
          "Authorization": `Bearer ${process.env.WHATSAPP_API_KEY}`,
        },
      });

      console.log(`Message sent to ${number}`, response.data);
    } catch (error) {
      console.error(`Error sending to ${number}`, error.response?.data || error.message);
    }
  }
}

module.exports = { sendWhatsAppMessages };
