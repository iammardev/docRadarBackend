import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send OTP email
const sendOTPEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `"Doc Radar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset OTP - Doc Radar",
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <!-- Header -->
          <div style="background-color: #1b95c8; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Doc Radar</h1>
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 20px;">Password Reset Request</h2>
            
            <!-- OTP Box -->
            <div style="background-color: #f8f9fa; border: 2px dashed #1b95c8; padding: 20px; margin: 20px 0; text-align: center; border-radius: 10px;">
              <p style="margin: 0; color: #666; font-size: 14px;">Your OTP Code</p>
              <div style="font-size: 32px; font-weight: bold; color: #1b95c8; letter-spacing: 5px; margin: 10px 0;">
                ${otp}
              </div>
              <p style="margin: 0; color: #666; font-size: 14px;">Valid for 10 minutes</p>
            </div>

            <!-- Instructions -->
            <div style="margin: 20px 0; color: #666;">
              <p style="margin-bottom: 10px;">To complete the password reset process:</p>
              <ol style="padding-left: 20px;">
                <li style="margin-bottom: 5px;">Enter this OTP code on the verification page</li>
                <li style="margin-bottom: 5px;">Create your new password</li>
                <li style="margin-bottom: 5px;">Start enjoying Doc Radar again!</li>
              </ol>
            </div>

            <!-- Warning -->
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; color: #856404;">
              ⚠️ If you didn't request this password reset, please ignore this email or contact our support team.
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">This is an automated message, please do not reply.</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">© ${new Date().getFullYear()} Doc Radar. All rights reserved.</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                Need help? Contact us at 
                <span style="color: #1b95c8; font-weight: bold;">support@elearn.com</span>
              </p>
            </div>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

// Function to send welcome email to new users
const sendWelcomeEmail = async (email, name) => {
  try {
    await transporter.sendMail({
      from: `"Doc Radar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to Doc Radar!",
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <!-- Header -->
          <div style="background-color: #1b95c8; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Doc Radar</h1>
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 20px;">Welcome to Doc Radar, ${name}!</h2>
            
            <div style="margin: 20px 0; color: #666;">
              <p style="margin-bottom: 15px;">Thank you for joining Doc Radar! We're excited to have you on board.</p>
              <p style="margin-bottom: 15px;">With Doc Radar, you can:</p>
              <ul style="padding-left: 20px; color: #666;">
                <li style="margin-bottom: 8px;">Find and connect with healthcare professionals</li>
                <li style="margin-bottom: 8px;">Schedule appointments easily</li>
                <li style="margin-bottom: 8px;">Manage your medical records securely</li>
                <li style="margin-bottom: 8px;">Get timely healthcare updates</li>
              </ul>
            </div>

            

            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">This is an automated message, please do not reply.</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">© ${new Date().getFullYear()} Doc Radar. All rights reserved.</p>
            </div>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Welcome email sending error:", error);
    return false;
  }
};

// Function to send pending approval email to doctors
const sendPendingApprovalEmail = async (email, name) => {
  try {
    await transporter.sendMail({
      from: `"Doc Radar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Doc Radar Account is Pending Approval",
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <!-- Header -->
          <div style="background-color: #1b95c8; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Doc Radar</h1>
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 20px;">Account Pending Approval</h2>
            
            <div style="margin: 20px 0; color: #666;">
              <p style="margin-bottom: 15px;">Dear Dr. ${name},</p>
              <p style="margin-bottom: 15px;">Thank you for registering with Doc Radar. Your account is currently under review by our verification team.</p>
              <p style="margin-bottom: 15px;">We are verifying your credentials and professional information to ensure the highest quality of healthcare services for our users.</p>
            </div>

            <!-- Status Box -->
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; color: #856404;">
              <p style="margin: 0;">⏳ Your account is currently in the verification queue. We'll notify you as soon as the review is complete.</p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">This is an automated message, please do not reply.</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">© ${new Date().getFullYear()} Doc Radar. All rights reserved.</p>
            </div>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Pending approval email sending error:", error);
    return false;
  }
};

// Function to send account approval email to doctors
const sendApprovalConfirmationEmail = async (email, name) => {
  console.log('Starting to send approval confirmation email to:', email);
  try {
    console.log('Attempting to send email with transporter...');
    const info = await transporter.sendMail({
      from: `"Doc Radar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Doc Radar Account is Approved!",
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <!-- Header -->
          <div style="background-color: #1b95c8; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Doc Radar</h1>
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 20px;">Account Approved!</h2>
            
            <div style="margin: 20px 0; color: #666;">
              <p style="margin-bottom: 15px;">Dear Dr. ${name},</p>
              <p style="margin-bottom: 15px;">Great news! Your Doc Radar account has been approved. You can now start using all the features of our platform.</p>
            </div>

            <!-- Success Box -->
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; color: #155724;">
              <p style="margin: 0;">✅ Your account is now active and ready to use!</p>
            </div>

            <!-- Next Steps -->
            <div style="margin: 20px 0; color: #666;">
              <p style="margin-bottom: 10px;">Here's what you can do next:</p>
              <ul style="padding-left: 20px; color: #666;">
                <li style="margin-bottom: 8px;">Complete your profile</li>
                <li style="margin-bottom: 8px;">Set up your availability</li>
                <li style="margin-bottom: 8px;">Start accepting appointments</li>
              </ul>
            </div>

           

            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">This is an automated message, please do not reply.</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">© ${new Date().getFullYear()} Doc Radar. All rights reserved.</p>
            </div>
          </div>
        </div>
      `,
    });
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error("Approval confirmation email sending error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      command: error.command
    });
    return false;
  }
};

export { sendOTPEmail, sendWelcomeEmail, sendPendingApprovalEmail, sendApprovalConfirmationEmail };
