import QueueStack from './queue.js';


const EMAiLQUEUE = QueueStack.EMAiLQUEUE
const AGENTQUEUE = QueueStack.AGENTQUEUE



export async function emailJob(userEmail = "user@example.com", userName = "Motion Creator") {
    const loginmail = await EMAiLQUEUE.add("login", {
        to: userEmail,
        name: userName,
        device: "Chrome 128 on Windows 11",
        ipAddress: "192.168.1.42",
        location: "United States (Approximate)",
    });

    const registermail = await EMAiLQUEUE.add("register", {
        to: userEmail,
        name: userName,
        dashboardUrl: "http://localhost:3000/dashboard",
    });

    const forgetmail = await EMAiLQUEUE.add("forget", {
        to: userEmail,
        name: userName,
        resetUrl: "http://localhost:3000/reset-password?token=secure-motion-token-984",
        expiresInMinutes: 15,
    });

    return { loginmail, registermail, forgetmail };
}

