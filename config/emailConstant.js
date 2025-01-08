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

    sendPriceBookFile: (toEmail, ccMail, data) => {
      return {
        to: toEmail,
        cc: ccMail,
        from: process.env.from_email,
        subject: `Price Book Report`,
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
    

    sendContactUsTemplateAdmin: (toEmail, ccEmail, data) => {
      return {
        to: toEmail,
        cc: ccEmail,
        from: process.env.from_email,
        templateId: process.env.contact_admin,
        dynamic_template_data: data,
      };
    },
    sendPriceBookNotification: (toEmail, ccEmail, data) => {
      return {
        to: toEmail,
        cc: ccEmail,
        from: process.env.from_email,
        templateId: process.env.price_book,
        dynamic_template_data: data,
      };
    },    
    sendCommentNotification: (toEmail, ccEmail, data) => {
      return {
        to: toEmail,
        cc: ccEmail,
        from: process.env.from_email,
        templateId: process.env.comment_notification,
        dynamic_template_data: data,
      };
    },

    sendClaimStatusNotification: (toEmail, ccEmail, data) => {
      return {
        to: toEmail,
        cc: ccEmail,
        from: process.env.from_email,
        templateId: process.env.claim_status,
        dynamic_template_data: data,
      };
    },

    sendServicerClaimNotification: (toEmail, ccEmail, data) => {
      return {
        to: toEmail,
        cc: ccEmail,
        from: process.env.from_email,
        templateId: process.env.servicer_claim_notification,
        dynamic_template_data: data,
      };
    },
    sendContactUsTemplate: (toEmail, ccEmail, data) => {
      return {
        to: toEmail,
        cc: ccEmail,
        from: process.env.from_email,
        templateId: process.env.contact_us,
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
        templateId: process.env.servicer_approval,
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