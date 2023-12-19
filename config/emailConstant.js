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
          }
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
      }
}