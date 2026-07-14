import nodemailer from "nodemailer";


export const sendMail = async (email, subject, message, htmlfile) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "Rmmbr@rmmbr.me",
        pass: process.env.GMAILPASS, // Secure password
      },
      // auth: {
      //   user: 'kuldeeppatel0055.ewebworld@gmail.com',
      //   pass: 'yald cjdr cytq btgt' // Secure password
      // },
    });

    const mailOptions = {
      from: "Rmmbr@rmmbr.me",
      to: email,
      subject: subject,
      text: message,
      html: htmlfile,
    };

    const info = await transporter.sendMail(mailOptions);

    // Log success and return a success response
    console.log("Email sent successfully:", info.response);
    return {
      success: true,
      message: "Email sent successfully",
      info: info.response,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error(error);
  }
};