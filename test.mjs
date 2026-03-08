import { GoogleGenAI } from '@google/genai';

console.log('Keys in GoogleGenAI class:', Object.getOwnPropertyNames(GoogleGenAI.prototype));
const client = new GoogleGenAI({ apiKey: 'test' });
console.log('Keys in client:', Object.keys(client));
if (client.live) {
    console.log('Keys in client.live:', Object.keys(client.live));
    console.log('Keys in prototype client.live:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.live)));
}
if (client.chats) {
    console.log('Keys in client.chats:', Object.keys(client.chats));
    console.log('Keys in prototype chats:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.chats)));
}
if (client.models) {
    console.log('Keys in prototype models:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.models)));
}
