import mailTransporter from "./init.nodemailer.js";
import { generateEmailHtml } from "./template.base.js";

export interface LoginEmailData {
    name: string;
    email: string;
    loginTime?: string;
    device?: string;
    ipAddress?: string;
    location?: string;
    securityUrl?: string;
    theme?: "dark" | "light";
}

export function getLoginEmailHtml(data: LoginEmailData): string {
    const isDark = data.theme !== "light";
    const timeFormatted = data.loginTime || new Date().toUTCString();
    const device = data.device || "Chrome on Windows";
    const ip = data.ipAddress || "192.168.1.42";
    const location = data.location || "San Francisco, CA (approximate)";
    const securityUrl = data.securityUrl || "https://motion.dev/account/security";

    const boxBg = isDark ? "#18181b" : "#f8fafc";
    const boxBorder = isDark ? "#27272a" : "#e2e8f0";
    const labelColor = isDark ? "#71717a" : "#64748b";
    const valColor = isDark ? "#f4f4f5" : "#0f172a";
    const rowBorder = isDark ? "#27272a" : "#edf2f7";

    const bodyContent = `
        <p style="margin: 0 0 16px 0;">
            Hi ${data.name},
        </p>
        <p style="margin: 0 0 20px 0;">
            We detected a new sign-in to your Motion account (<span style="color: ${valColor}; font-weight: 500;">${data.email}</span>).
        </p>

        <!-- Session Details Box -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${boxBg}; border: 1px solid ${boxBorder}; border-radius: 8px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 16px 18px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: ${labelColor}; width: 34%;">
                                Time
                            </td>
                            <td style="padding: 6px 0; font-size: 13px; font-weight: 500; color: ${valColor};">
                                ${timeFormatted}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: ${labelColor}; border-top: 1px solid ${rowBorder};">
                                Device
                            </td>
                            <td style="padding: 6px 0; font-size: 13px; font-weight: 500; color: ${valColor}; border-top: 1px solid ${rowBorder};">
                                ${device}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: ${labelColor}; border-top: 1px solid ${rowBorder};">
                                IP Address
                            </td>
                            <td style="padding: 6px 0; font-size: 13px; font-family: monospace; color: ${valColor}; border-top: 1px solid ${rowBorder};">
                                ${ip}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: ${labelColor}; border-top: 1px solid ${rowBorder};">
                                Location
                            </td>
                            <td style="padding: 6px 0; font-size: 13px; font-weight: 500; color: ${valColor}; border-top: 1px solid ${rowBorder};">
                                ${location}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 21px;">
            If this was you, you can safely disregard this email.
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 21px; color: ${labelColor};">
            If you do not recognize this activity, please secure your account immediately by resetting your password.
        </p>
    `;

    return generateEmailHtml({
        previewText: `New login detected for ${data.email} from ${device}`,
        badge: { text: "Security Notice" },
        heading: "New login to your account",
        bodyContent,
        ctaButton: {
            text: "Review Security Activity",
            url: securityUrl,
        },
        secondaryLink: {
            text: "Lock account immediately",
            url: `${securityUrl}?action=lock`,
        },
        theme: data.theme || "dark",
        footerNotice: "This security alert was automatically generated upon account authentication.",
    });
}

export async function loginemailer(
    name: string,
    email: string,
    details?: Partial<LoginEmailData>
) {
    const html = getLoginEmailHtml({
        name,
        email,
        ...details,
    });

    const mailOptions = {
        from: process.env.NODEMAILER_EMAIL 
            ? `"Motion Security" <${process.env.NODEMAILER_EMAIL}>` 
            : '"Motion Security" <security@motion.dev>',
        to: email,
        subject: "New login to your Motion account",
        html,
    };

    try {
        const info = await mailTransporter.sendMail(mailOptions);
        console.log(`[Email] Login alert sent to ${email} (MessageId: ${info?.messageId})`);
        return info;
    } catch (error) {
        console.error(`[Email] Failed to send login alert to ${email}:`, error);
        throw error;
    }
}

export default loginemailer;