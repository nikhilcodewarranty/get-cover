module.exports = {
  resetpassword: (ID, resetCode, toEmail, data) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      subject: `Reset password email from get cover`,
      templateId: process.env.reset_password,
      dynamic_template_data: data
    };
  },

  sendCsvFile: (toEmail, ccMail, data) => {
    return {
      to: toEmail,
      cc: ccMail,
      from: process.env.from_email,
      subject: `Bulk Data Report`,
      html: data
    };
  },

  sendEmailTemplate: (toEmail, ccEmail, data) => {
    return {
      to: toEmail,
      cc: ccEmail,
      from: process.env.from_email,
      templateId: process.env.update_status,
      dynamic_template_data: data,
    };
  },

  sendTermAndCondition: (toEmail, ccEmail, data, attachment) => {
    return {
      to: toEmail,
      cc: ccEmail,
      from: process.env.from_email,
      templateId: process.env.update_status,
      dynamic_template_data: data,
      attachments: [
        {
          content: attachment,
          filename: "Get-Cover term and condition",
          type: 'application/pdf',
          disposition: 'attachment',
          contentId: 'mytext'
        },
      ],
    };
  },

  dealerWelcomeMessage: (toEmail, data) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      templateId: process.env.main_template,
      dynamic_template_data: data

    };
  },

  servicerWelcomeMessage: (toEmail) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      templateId: process.env.register_servicer,
    };
  },

  dealerApproval: (toEmail, data) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      templateId: process.env.approval_mail,
      dynamic_template_data: data
    };
  },

  servicerApproval: (toEmail, data) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      templateId: 'd-a5d4a679ef5e459aaffcf27b5876e782',
      dynamic_template_data: data
    };
  },



  term_condition: (toEmail) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      text: "ssssssssssssssssssssssss"
    };
  },



  sendNullMessage: (toEmail) => {
    const htmlContent = `
        <p>The The Products is not created yet. Please check catalog!:</p>
      `;
    return {
      to: toEmail,
      from: process.env.from_email,
      subject: sub,
      text: '',
      html: htmlContent,
    };
  }

}