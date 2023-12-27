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
        <p>Please check the following already products:</p>
        <ul>
          ${alreadyProducts.map(product => {
            const priceBooksList = product.priceBooks.map(priceBook => `${priceBook.name}`).join('');
            return `<li><ul>${priceBooksList}</ul></li>`; 
          }).join('')}
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
      sendNullMessage: (toEmail) => {
        const htmlContent = `
        <p>The The Products is not created yet. Please check catalog!:</p>
      `;
        return {
          to: toEmail,
          from: 'anil@codenomad.net',      
           subject: sub,
           text: '',
           html: htmlContent,          
        };
      }

}