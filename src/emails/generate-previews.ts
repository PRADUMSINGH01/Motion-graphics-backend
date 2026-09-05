import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLoginEmailHtml } from "./login.email.js";
import { getRegisterEmailHtml } from "./register.email.js";
import { getResetEmailHtml } from "./reset.email.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loginHtml = getLoginEmailHtml({
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    device: "Chrome 128 on macOS Sequoia",
    ipAddress: "192.168.1.104",
    location: "San Francisco, CA, United States",
    loginTime: new Date().toUTCString(),
});

const registerHtml = getRegisterEmailHtml({
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    dashboardUrl: "http://localhost:3000/dashboard",
});

const resetHtml = getResetEmailHtml({
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    resetUrl: "http://localhost:3000/reset-password?token=a8f93bc091d743fe82b",
    expiresInMinutes: 15,
});

const previewHubHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Motion Email Templates Preview Hub</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            background-color: #030712;
            color: #f3f4f6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        header {
            background-color: #0b0f19;
            border-bottom: 1px solid #1f2937;
            padding: 16px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 50;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .logo-box {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: linear-gradient(135deg, #6366f1, #ec4899);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 16px;
            color: white;
        }
        .brand-title {
            font-size: 18px;
            font-weight: 700;
            color: white;
            letter-spacing: -0.3px;
        }
        .badge {
            font-size: 11px;
            background: #1e1b4b;
            color: #818cf8;
            border: 1px solid #3730a3;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: 600;
        }
        .controls {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .tab-btn {
            background: #111827;
            border: 1px solid #1f2937;
            color: #9ca3af;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
        }
        .tab-btn:hover {
            color: #f3f4f6;
            border-color: #374151;
        }
        .tab-btn.active {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            border-color: transparent;
            color: white;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
        }
        .viewport-btn {
            background: #111827;
            border: 1px solid #1f2937;
            color: #9ca3af;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
        }
        .viewport-btn.active {
            color: white;
            background: #374151;
        }
        .preview-container {
            flex: 1;
            display: flex;
            justify-content: center;
            padding: 30px 16px;
            overflow-y: auto;
        }
        .frame-wrapper {
            width: 100%;
            max-width: 680px;
            transition: max-width 0.3s ease;
            background: #080c14;
            border-radius: 16px;
            border: 1px solid #1f2937;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .frame-wrapper.mobile {
            max-width: 390px;
        }
        iframe {
            width: 100%;
            height: 820px;
            border: none;
            background-color: #080c14;
        }
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <div class="logo-box">M</div>
            <div>
                <span class="brand-title">Motion Email Templates</span>
                <span class="badge">Live Preview Hub</span>
            </div>
        </div>
        <div class="controls">
            <button class="tab-btn active" onclick="switchTab('login')">🔐 Login Notification</button>
            <button class="tab-btn" onclick="switchTab('register')">🚀 Welcome & Register</button>
            <button class="tab-btn" onclick="switchTab('reset')">🔑 Reset Password</button>
            <div style="width: 1px; height: 24px; background: #1f2937; margin: 0 4px;"></div>
            <button class="viewport-btn active" id="btn-desktop" onclick="setViewport('desktop')">🖥️ Desktop</button>
            <button class="viewport-btn" id="btn-mobile" onclick="setViewport('mobile')">📱 Mobile</button>
        </div>
    </header>

    <main class="preview-container">
        <div class="frame-wrapper" id="frame-wrapper">
            <iframe id="preview-frame"></iframe>
        </div>
    </main>

    <script>
        const templates = {
            login: ${JSON.stringify(loginHtml)},
            register: ${JSON.stringify(registerHtml)},
            reset: ${JSON.stringify(resetHtml)}
        };

        let currentTab = 'login';
        const frame = document.getElementById('preview-frame');
        const wrapper = document.getElementById('frame-wrapper');

        function renderTemplate() {
            const doc = frame.contentWindow.document;
            doc.open();
            doc.write(templates[currentTab]);
            doc.close();
        }

        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            renderTemplate();
        }

        function setViewport(mode) {
            document.querySelectorAll('.viewport-btn').forEach(btn => btn.classList.remove('active'));
            if (mode === 'mobile') {
                wrapper.classList.add('mobile');
                document.getElementById('btn-mobile').classList.add('active');
            } else {
                wrapper.classList.remove('mobile');
                document.getElementById('btn-desktop').classList.add('active');
            }
        }

        window.onload = () => {
            renderTemplate();
        };
    </script>
</body>
</html>`;

const outputPath = path.join(__dirname, "preview.html");
fs.writeFileSync(outputPath, previewHubHtml, "utf8");
console.log(`[Preview Generated] Output saved to: ${outputPath}`);
