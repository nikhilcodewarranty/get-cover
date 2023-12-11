module.exports = {
    msg: (ID,resetCode,toEmail) => {
        return {
          to: toEmail,
          from: 'anil@codenomad.net',
          subject: 'Sending an email using SendGrid',
          text: `Set Password Link:- http://15.207.221.207/newPassword/${ID}/${resetCode}`,
        };
      }
}