module.exports = {
    msg: (ID,resetCode,toEmail) => {
        return {
          to: toEmail,
          from: 'anil@codenomad.net',
          subject: `Reset password email from get cover`,
          // text: `Set Password Link:- http://15.207.221.207/newPassword/{{ID}}/{{resetCode}}`,
          templateId: "d-ddd46f310f9d4014b95971a3c8664bb6",
          dynamic_template_data: {
            ID:ID,
            resetCode:resetCode
          },
          mailSettings: {
            // Set the subject for the email
            subject: 'Your Custom Subject Here',
          },
        };
      },

      msgWelcome: (templateID,toEmail) => {
        return {
          to: toEmail,
          from: 'anil@codenomad.net',
          // subject: `Sending an email using SendGrid`,
          // text: `Set Password Link:- http://15.207.221.207/newPassword/{{ID}}/{{resetCode}}`,
          templateId: templateID,
        };
      },


      sendMissingProduct: (toEmail,missingProductNames,sub) => {
        const htmlContent = `
          <p>Please check the following missing products:</p>
          <ul>
            ${missingProductNames.map(product => `<li>${product}</li>`).join('')}
          </ul>
        `;
        return {
          to: toEmail,
          from: 'anil@codenomad.net',      
           subject: sub,
           text: 'Please check missing Products',
           html: htmlContent,          
        };
      },

      sendAlreadyProduct: (toEmail,alreadyProducts,sub) => {
        const htmlContent = `
          <p>Please check the following missing products:</p>
          <ul>
            ${alreadyProducts.map(product => `<li>${product.name}</li>`).join('')}
          </ul>
        `;
        return {
          to: toEmail,
          from: 'anil@codenomad.net',      
           subject: sub,
           text: 'Please check missing Products',
           html: htmlContent,          
        };
      }
}