const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const getOTPEmailHTML = (otp, purpose, name) => {
  const purposeText =
    purpose === 'register'       ? 'verify your email address' :
    purpose === 'reset-password' ? 'reset your password' :
                                   'confirm your new email address';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#020408;font-family:'Courier New',monospace;">
  <div style="max-width:480px;margin:40px auto;background:#0a1628;border:1px solid rgba(0,245,255,0.2);border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#0088ff,#00f5ff);padding:2rem;text-align:center;">
      <div style="font-size:2rem;font-weight:900;color:#020408;letter-spacing:0.1em;">CAR·PARKING</div>
      <div style="font-size:0.75rem;color:rgba(2,4,8,0.7);letter-spacing:0.2em;margin-top:4px;">CAMPUS CAR-PARKING SYSTEM</div>
    </div>
    <div style="padding:2rem;">
      <p style="color:#e8f4ff;margin:0 0 1rem;">Hello <strong style="color:#00f5ff;">${name}</strong>,</p>
      <p style="color:#5a7a9a;margin:0 0 1.5rem;font-size:0.9rem;">Use the verification code below to ${purposeText}:</p>
      <div style="background:#060d1a;border:1px solid rgba(0,245,255,0.3);border-radius:12px;padding:1.5rem;text-align:center;margin:1.5rem 0;">
        <div style="font-size:0.7rem;color:#5a7a9a;letter-spacing:0.2em;margin-bottom:0.5rem;">VERIFICATION CODE</div>
        <div style="font-size:2.5rem;font-weight:900;letter-spacing:0.3em;color:#00f5ff;text-shadow:0 0 20px rgba(0,245,255,0.5);">${otp}</div>
        <div style="font-size:0.7rem;color:#5a7a9a;margin-top:0.5rem;">Expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes</div>
      </div>
      <p style="color:#5a7a9a;font-size:0.8rem;margin:0;">If you didn't request this, ignore this email. Never share this code.</p>
    </div>
    <div style="padding:1rem 2rem;border-top:1px solid rgba(0,136,255,0.1);text-align:center;">
      <span style="color:#2a4a6a;font-size:0.7rem;">© Smart Campus Car-Parking System</span>
    </div>
  </div>
</body>
</html>`;
};

const subjects = {
  register:         'Your Car Parking Verification Code',
  'email-change':   'Confirm Your New Email — Car Parking',
  'reset-password': 'Password Reset Code — Car Parking',
};

const sendOTP = async ({ to, name, otp, purpose }) => {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = subjects[purpose] || 'Verification Code';
    sendSmtpEmail.htmlContent = getOTPEmailHTML(otp, purpose, name);
    sendSmtpEmail.sender = {
      name:  'Campus Parking',
      email: process.env.EMAIL_USER,
    };
    sendSmtpEmail.to = [{ email: to, name }];

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ OTP email sent to ${to}`, data.messageId);
    return true;
  } catch (err) {
  console.error("❌ FULL ERROR:");
  console.error("Status:", err.response?.status);
  console.error("Body:", err.response?.body);
  console.error("Headers:", err.response?.headers);
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  return false;
}

};

module.exports = { generateOTP, sendOTP };