module.exports = {
  resetpassword: (ID, resetCode, toEmail) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      subject: `Reset password email from get cover`,
      templateId: process.env.reset_password,
      dynamic_template_data: {
        ID: ID,
        resetCode: resetCode
      }
    };
  },

  sendCsvFile: (toEmail, ccMail, data) => {
    return {
      to: toEmail,
      cc: ccMail,
      from: process.env.from_email,
      subject: `Bulk Data Report`,
      html: data
      // templateId: "d-7b32ddb3017b406b8ad55673d84d2fce",
      // dynamic_template_data:data ,
      // mailSettings: {
      //   // Set the subject for the email
      //   subject: 'CSV link',
      // },
    };
  },

  sendEmailTemplate: (toEmail, ccEmail, data) => {
    return {
      to: toEmail,
      cc: ccEmail,
      from: process.env.from_email,
      templateId: process.env.update_status,
      // templateId: "d-7b32ddb3017b406b8ad55673d84d2fce",
      dynamic_template_data: data,
      // mailSettings: {
      //   // Set the subject for the email
      //   subject: 'CSV link',
      // },
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
      // subject: `Sending an email using SendGrid`,
      // text: `Set Password Link:- http://15.207.221.207/newPassword/{{ID}}/{{resetCode}}`,
      templateId: process.env.main_template,
      dynamic_template_data: data

    };
  },

  servicerWelcomeMessage: (toEmail) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      // subject: `Sending an email using SendGrid`,
      // text: `Set Password Link:- http://15.207.221.207/newPassword/{{ID}}/{{resetCode}}`,
      templateId: process.env.register_servicer,
    };
  },

  dealerApproval: (toEmail, data) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      // subject: `Sending an email using SendGrid`,
      // text: `Set Password Link:- http://15.207.221.207/newPassword/{{ID}}/{{resetCode}}`,
      templateId: process.env.approval_mail,
      dynamic_template_data: data
    };
  },

  servicerApproval: (toEmail, data) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      // subject: `Sending an email using SendGrid`,
      // text: `Set Password Link:- http://15.207.221.207/newPassword/{{ID}}/{{resetCode}}`,
      templateId: 'd-5d1f3fb03b7c4f638e7f20199f42f675',
      dynamic_template_data: data
    };
  },



  term_condition: (toEmail) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      text: "ssssssssssssssssssssssss"
      // subject: `Sending an email using SendGrid`,
      // text: `Set Password Link:- http://15.207.221.207/newPassword/{{ID}}/{{resetCode}}`,
      // templateId: 'd-a5d4a679ef5e459aaffcf27b5876e782',
      // dynamic_template_data:data
    };
  },

  // sendMissingProduct: (toEmail, missingProductNames, sub) => {
  //   const htmlContent = `
  //         <p>Please check the following missing products:</p>
  //         <ul>
  //           ${missingProductNames.map(product => `<li>${product}</li>`).join('')}
  //         </ul>
  //       `;
  //   return {
  //     to: toEmail,
  //     from: process.env.from_email,
  //     subject: sub,
  //     text: 'Please check missing Products',
  //     html: htmlContent,
  //   };
  // },

  // sendAlreadyProduct: (toEmail, alreadyProducts, sub) => {
  //   const htmlContent = `
  //       <p>Please check the following already products:</p>
  //       <ul>
  //         ${alreadyProducts.map(product => {
  //     const priceBooksList = product.priceBooks.map(priceBook => `${priceBook.name}`).join('');
  //     return `<li><ul>${priceBooksList}</ul></li>`;
  //   }).join('')}
  //       </ul>
  //     `;
  //   return {
  //     to: toEmail,
  //     from: process.env.from_email,
  //     subject: sub,
  //     text: 'Please check missing Products',
  //     html: htmlContent,
  //   };
  // },

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