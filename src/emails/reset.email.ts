import mailTransporter from "./init.nodemailer.js";
import { generateEmailHtml } from "./template.base.js";

export interface ResetEmailData {
    name: string;
    email: string;
    resetUrl: string;
    expiresInMinutes?: number;
    theme?: "dark" | "light";
}

export function getResetEmailHtml(data: ResetEmailData): string {
    const isDark = data.theme !== "light";
    const expiresIn = data.expiresInMinutes || 15;
    const valColor = isDark ? "#fafafa" : "#09090b";
    const labelColor = isDark ? "#71717a" : "#64748b";
    const boxBg = isDark ? "#18181b" : "#f8fafc";
    const boxBorder = isDark ? "#27272a" : "#e2e8f0";
    const linkColor = isDark ? "#818cf8" : "#4f46e5";

    const bodyContent = `
        <p style="margin: 0 0 16px 0;">
            Hi ${data.name},
        </p>
        <p style="margin: 0 0 20px 0;">
            We received a request to reset the password for your Motion account associated with <span style="color: ${valColor}; font-weight: 500;">${data.email}</span>.
        </p>
        <p style="margin: 0 0 24px 0;">
            Click the button below to choose a new password. For security, this link will expire in <strong style="color: ${valColor};">${expiresIn} minutes</strong>.
        </p>

        <!-- Fallback Link Box -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${boxBg}; border: 1px solid ${boxBorder}; border-radius: 8px; margin-top: 28px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 14px 16px;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: ${labelColor}; letter-spacing: 0.5px; margin-bottom: 4px;">
                        Trouble clicking? Paste this link into your browser:
                    </div>
                    <div style="font-size: 12px; font-family: monospace; word-break: break-all; color: ${linkColor}; line-height: 18px;">
                        <a href="${data.resetUrl}" style="color: ${linkColor}; text-decoration: underline;">${data.resetUrl}</a>
                    </div>
                </td>
            </tr>
        </table>

        <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${labelColor};">
            If you did not request this password reset, no action is needed. Your current password remains secure and will not change.
        </p>
    `;

    return generateEmailHtml({
        previewText: `Reset your Motion password (link expires in ${expiresIn} minutes)`,
        badge: { text: "Password Reset" },
        heading: "Reset your password",
        bodyContent,
        ctaButton: {
            text: "Reset Password",
            url: data.resetUrl,
        },
        theme: data.theme || "dark",
        footerNotice: "This is a single-use verification email generated for your account.",
    });
}

export async function resetemailer(
    name: string,
    email: string,
    resetUrl: string,
    details?: Partial<ResetEmailData>
) {
    const html = getResetEmailHtml({
        name,
        email,
        resetUrl,
        ...details,
    });

    const mailOptions = {
        from: process.env.NODEMAILER_EMAIL 
            ? `"Motion Security" <${process.env.NODEMAILER_EMAIL}>` 
            : '"Motion Security" <security@motion.dev>',
        to: email,
        subject: "Reset your Motion password",
        html,
    };

    try {
        const info = await mailTransporter.sendMail(mailOptions);
        console.log(`[Email] Password reset email sent to ${email} (MessageId: ${info?.messageId})`);
        return info;
    } catch (error) {
        console.error(`[Email] Failed to send password reset email to ${email}:`, error);
        throw error;
    }
}

export default resetemailer;
