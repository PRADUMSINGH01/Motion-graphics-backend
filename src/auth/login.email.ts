import { Router, type Response, type Request } from "express";
import { z } from "zod";


const router = Router()

const mockdata = {
    email: "user@example.com",
    password: "password123"
}

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6).max(12),
})



router.post("/login/email", async (req: Request, res: Response) => {

    const logindata = loginSchema.safeParse(req.body)
    try {
        if (!logindata.success) {
            res.json({
                success: false,
                message: "invalid data"
            })
        }

        if (logindata?.data?.email !== mockdata.email || logindata.data.password !== mockdata.password) {
            res.json({
                success: false,
                message: "invalid email or password"
            })
        }
        //verify the user password with the hashed password in the database
        // send email to user for mail information for login 
       return res.cookie("token", "mocktoken", {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
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




