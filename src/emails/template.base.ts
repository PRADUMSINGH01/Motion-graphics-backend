/**
 * Motion - Executive Grade Base Email Layout
 * Designed following Vercel, Linear, and Stripe email design systems.
 * Bulletproof rendering across Apple Mail, Gmail, Outlook, and mobile clients.
 */

export interface EmailLayoutOptions {
    previewText: string;
    badge?: {
        text: string;
        type?: "default" | "security" | "success" | "warning";
    };
    heading: string;
    subheading?: string;
    bodyContent: string;
    ctaButton?: {
        text: string;
        url: string;
    };
    secondaryLink?: {
        text: string;
        url: string;
    };
    footerNotice?: string;
    theme?: "dark" | "light";
}

export function generateEmailHtml(options: EmailLayoutOptions): string {
    const {
        previewText,
        badge,
        heading,
        subheading,
        bodyContent,
        ctaButton,
        secondaryLink,
        footerNotice = "You received this email because of activity associated with your Motion account.",
        theme = "dark",
    } = options;

    const isDark = theme === "dark";

    // Colors
    const bgOuter = isDark ? "#09090b" : "#f4f4f5";
    const bgCard = isDark ? "#121215" : "#ffffff";
    const borderCard = isDark ? "#27272a" : "#e4e4e7";
    const textPrimary = isDark ? "#fafafa" : "#09090b";
    const textSecondary = isDark ? "#a1a1aa" : "#52525b";
    const textMuted = isDark ? "#71717a" : "#71717a";
    const btnBg = isDark ? "#ffffff" : "#09090b";
    const btnText = isDark ? "#09090b" : "#ffffff";
    const divider = isDark ? "#27272a" : "#e4e4e7";
    const badgeBg = isDark ? "#1f1f23" : "#f4f4f5";
    const badgeBorder = isDark ? "#2e2e33" : "#e4e4e7";
    const badgeText = isDark ? "#d4d4d8" : "#3f3f46";

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
    <title>${heading}</title>
    <style type="text/css">
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: ${bgOuter}; }
        
        @media only screen and (max-width: 600px) {
            .wrapper { width: 100% !important; padding: 16px !important; }
            .card { padding: 32px 20px !important; border-radius: 12px !important; }
            .h1-title { font-size: 20px !important; line-height: 28px !important; }
            .body-text { font-size: 14px !important; line-height: 22px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 48px 0; background-color: ${bgOuter}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <!-- Preview Text -->
    <div style="display: none; font-size: 1px; color: ${bgOuter}; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
        ${previewText}
    </div>

    <center>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgOuter};">
            <tr>
                <td align="center" style="padding: 0 16px;">
                    <!-- Max width 520px container like Linear / Vercel -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px;" class="wrapper">
                        
                        <!-- Logo & Brand Header -->
                        <tr>
                            <td align="left" style="padding-bottom: 24px;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="vertical-align: middle;">
                                            <!-- Geometric minimalist Motion Logo -->
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="width: 28px; height: 28px; background-color: ${isDark ? '#fafafa' : '#09090b'}; border-radius: 7px; text-align: center; vertical-align: middle;">
                                                        <span style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; font-weight: 800; color: ${isDark ? '#09090b' : '#ffffff'}; line-height: 28px; display: inline-block;">M</span>
                                                    </td>
                                                    <td style="padding-left: 10px; vertical-align: middle;">
                                                        <span style="font-size: 15px; font-weight: 700; letter-spacing: -0.2px; color: ${textPrimary}; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Motion</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Main Content Card -->
                        <tr>
                            <td style="background-color: ${bgCard}; border: 1px solid ${borderCard}; border-radius: 14px; padding: 40px 36px;" class="card">
                                
                                ${badge ? `
                                <!-- Badge -->
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 18px;">
                                    <tr>
                                        <td style="background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; border-radius: 6px; padding: 4px 10px;">
                                            <span style="font-size: 11px; font-weight: 600; color: ${badgeText}; text-transform: uppercase; letter-spacing: 0.6px;">
                                                ${badge.text}
                                            </span>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}

                                <!-- Heading -->
                                <h1 class="h1-title" style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; line-height: 30px; letter-spacing: -0.4px; color: ${textPrimary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    ${heading}
                                </h1>

                                ${subheading ? `
                                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: ${textSecondary};">
                                    ${subheading}
                                </p>
                                ` : '<div style="margin-bottom: 22px;"></div>'}

                                <!-- Body Content -->
                                <div class="body-text" style="font-size: 14px; line-height: 23px; color: ${textSecondary}; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                                    ${bodyContent}
                                </div>

                                <!-- Primary Button -->
                                ${ctaButton ? `
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px; margin-bottom: 8px;">
                                    <tr>
                                        <td align="left">
                                            <!-- Bulletproof Button -->
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center" style="border-radius: 8px; background-color: ${btnBg};">
                                                        <a href="${ctaButton.url}" target="_blank" style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 600; color: ${btnText}; text-decoration: none; border-radius: 8px; padding: 12px 24px; border: 1px solid ${btnBg}; display: inline-block;">
                                                            ${ctaButton.text}
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}

                                <!-- Secondary Link -->
                                ${secondaryLink ? `
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
                                    <tr>
                                        <td>
                                            <a href="${secondaryLink.url}" target="_blank" style="font-size: 13px; color: ${textMuted}; text-decoration: underline;">
                                                ${secondaryLink.text}
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}

                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding: 24px 8px 0 8px;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="font-size: 12px; line-height: 18px; color: ${textMuted};">
                                            ${footerNotice}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding-top: 12px; font-size: 12px; line-height: 18px; color: ${textMuted};">
                                            Motion Inc. &bull; Autonomous Motion Graphics Platform &bull; 
                                            <a href="https://motion.dev/security" style="color: ${textMuted}; text-decoration: underline;">Security</a> &bull; 
                                            <a href="https://motion.dev/help" style="color: ${textMuted}; text-decoration: underline;">Support</a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </center>
</body>
</html>`;
}
