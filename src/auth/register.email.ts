import { Router, Request, Response } from "express";
import { z } from "zod";


const router = Router()

const mockdata = {
    email: "",
    password: "",
    username: "",
    plan: "",
    role: "",
    isVerified: false,
    tokens: {
        accessToken: "",
        refreshToken: ""
    },
    membership: {
        token: "",
        type: "",
        startDate: "",
        endDate: ""
    },
    apiKeys: {
        key: "",
        secret: ""
    },
    usages: {
        daily: 0,
        weekly: 0,
        yearly: 0
    }
}



const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6).max(12),
    username: z.string().min(3).max(20),
    plan: z.string().min(3).max(20),
    role: z.string().min(3).max(20),
    isVerified: z.boolean(),
    authtokens: z.object({
        accessToken: z.string().min(3).max(100),
        refreshToken: z.string().min(3).max(100)
    }),
    membership: z.string().min(3).max(20),
    apiKeys: z.object({
        key: z.string().min(3).max(100),
        secret: z.string().min(3).max(100)
    }),
    usages: z.object({
        daily: z.number().min(0).max(10),
        weekly: z.number().min(0).max(50),
        yearly: z.number().min(0).max(1000)
    })
})


interface RegisterData {
    email: string;
    password: string;
    username: string;
    plan: string;
    role: string;

    isVerified: boolean;
    authtokens: {
        accessToken: string;    
    refreshToken: string;
    };
    membership: string; 
    apiKeys: {
        key: string;
        secret: string;
    };
    usages: {
        daily: number;
        weekly: number;
        yearly: number;
    };
        }



router.post("/register/email", async (req: Request, res: Response): Promise<unknown> => {

    const registerdata = registerSchema.safeParse(req.body)
    if (!registerdata.success) {
        return res.json({
            success: false,
            message: "invalid data"
        })
    }

    if (registerdata.data.email === mockdata.email) {
        return res.json({
            success: false,
            message: "email already exists"
        })
    }

    try {
        //hash the password and store it in the database
        //send email to user for mail information for registration
        res.cookie("token", "mocktoken", {  })
        return res.json({
            success: true,
            message: "user registered successfully"
        })
    } catch (error: unknown) {
        if (error instanceof Error) {
            res.json({
                success: false,
                message: error.message
            })
        }
    }
})