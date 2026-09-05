import { createClient } from 'redis';

export const redisConnection = {
    username: 'default',
    password: 'anAGNZFXyuZkGh4ByI2Mpk9BShEB0OFa',
    host: 'redis-12074.c265.us-east-1-2.ec2.cloud.redislabs.com',
    port: 12074
};

const client = createClient({
    username: redisConnection.username,
    password: redisConnection.password,
    socket: {
        host: redisConnection.host,
        port: redisConnection.port
    }
});

client.on('error', err => console.log('Redis Client Error', err));

export default client;
