import express from 'express'



const server  = express();

server.listen(3001, () => {
    console.log("Server is running on port 3001");
});