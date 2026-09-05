import mailTransporter from "./init.nodemailer.js";
import { generateEmailHtml } from "./template.base.js";

export interface RegisterEmailData {
    name: string;
    email: string;
    dashboardUrl?: string;
    theme?: "dark" | "light";
}

export function getRegisterEmailHtml(data: RegisterEmailData): string {
    const isDark = data.theme !== "light";
    const dashboardUrl = data.dashboardUrl || "https://motion.dev/dashboard";
    const valColor = isDark ? "#fafafa" : "#09090b";
    const stepNumBg = isDark ? "#27272a" : "#e4e4e7";
    const stepNumColor = isDark ? "#fafafa" : "#18181b";

    const bodyContent = `
        <p style="margin: 0 0 16px 0;">
            Hi ${data.name},
        </p>
        <p style="margin: 0 0 24px 0;">
            Welcome to <strong style="color: ${valColor};">Motion</strong>. Your account has been created and you now have access to our autonomous motion graphics studio and cloud GPU render pipeline.
        </p>

        <!-- Steps -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
            <tr>
                <td style="vertical-align: top; width: 26px; padding-bottom: 18px;">
                    <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${stepNumBg}; color: ${stepNumColor}; text-align: center; line-height: 20px; font-size: 11px; font-weight: 700;">
                        1
                    </div>
                </td>
                <td style="vertical-align: top; padding-left: 12px; padding-bottom: 18px;">
                    <strong style="color: ${valColor}; font-size: 14px; display: block; margin-bottom: 2px;">
                        Prompt your first animation
                    </strong>
                    <span style="font-size: 13px; line-height: 20px;">
                        Describe your visual concept in plain language. Animagent computes bezier springs, camera paths, and keyframes automatically.
                    </span>
                </td>
            </tr>
            <tr>
                <td style="vertical-align: top; width: 26px; padding-bottom: 18px;">
                    <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${stepNumBg}; color: ${stepNumColor}; text-align: center; line-height: 20px; font-size: 11px; font-weight: 700;">
                        2
                    </div>
                </td>
                <td style="vertical-align: top; padding-left: 12px; padding-bottom: 18px;">
                    <strong style="color: ${valColor}; font-size: 14px; display: block; margin-bottom: 2px;">
                        Fine-tune in the timeline
                    </strong>
                    <span style="font-size: 13px; line-height: 20px;">
                        Make adjustments to curves, timings, and easing parameters in the real-time canvas editor.
                    </span>
                </td>
            </tr>
            <tr>
                <td style="vertical-align: top; width: 26px;">
                    <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${stepNumBg}; color: ${stepNumColor}; text-align: center; line-height: 20px; font-size: 11px; font-weight: 700;">
                        3
                    </div>
                </td>
                <td style="vertical-align: top; padding-left: 12px;">
                    <strong style="color: ${valColor}; font-size: 14px; display: block; margin-bottom: 2px;">
                        Export at 4K 60fps
                    </strong>
                    <span style="font-size: 13px; line-height: 20px;">
                        Send your compositions directly to our dedicated cloud GPU cluster for instant broadcast-quality renders.
                    </span>
                </td>
            </tr>
        </table>

        <p style="margin: 0; font-size: 13px; line-height: 21px;">
            If you have any questions or need guidance, feel free to reply directly to this email or visit our documentation.
        </p>
    `;

    return generateEmailHtml({
        previewText: `Welcome to Motion, ${data.name}. Your studio is ready.`,
        badge: { text: "Account Activated" },
        heading: "Welcome to Motion",
        bodyContent,
        ctaButton: {
            text: "Open Motion Studio",
            url: dashboardUrl,
        },
        secondaryLink: {
            text: "Read the quickstart guide",
            url: "https://motion.dev/docs/quickstart",
        },
        theme: data.theme || "dark",
        footerNotice: "You received this email because an account was registered with this email address.",
    });
}

export async function registeremailer(
    name: string,
    email: string,
    details?: Partial<RegisterEmailData>
) {
    const html = getRegisterEmailHtml({
        name,
        email,
        ...details,
    });

    const mailOptions = {
        from: process.env.NODEMAILER_EMAIL 
            ? `"Motion Team" <${process.env.NODEMAILER_EMAIL}>` 
            : '"Motion Team" <welcome@motion.dev>',
        to: email,
        subject: "Welcome to Motion",
        html,
    };

    try {
        const info = await mailTransporter.sendMail(mailOptions);
        console.log(`[Email] Welcome email sent to ${email} (MessageId: ${info?.messageId})`);
        return info;
    } catch (error) {
        console.error(`[Email] Failed to send welcome email to ${email}:`, error);
        throw error;
    }
}

export default registeremailer;
