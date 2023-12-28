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

  sendCsvFile: (toEmail, link) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      subject: `CSV link`,
      text: `CSV Link:- ${link}`,
      //templateId: "d-ddd46f310f9d4014b95971a3c8664bb6",
      // dynamic_template_data: {
      //   resetCode:link
      // },
      mailSettings: {
        // Set the subject for the email
        subject: 'CSV link',
      },
    };
  },

  dealerWelcomeMessage: (toEmail) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      // subject: `Sending an email using SendGrid`,
      // text: `Set Password Link:- http://15.207.221.207/newPassword/{{ID}}/{{resetCode}}`,
      templateId: process.env.register_dealer,
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

  dealerApproval: (toEmail) => {
    return {
      to: toEmail,
      from: process.env.from_email,
      // subject: `Sending an email using SendGrid`,
      // text: `Set Password Link:- http://15.207.221.207/newPassword/{{ID}}/{{resetCode}}`,
      templateId: process.env.approval_mail,
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