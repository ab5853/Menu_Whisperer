import { GoogleGenAI } from '@google/genai';

async function test() {
    const ai = new GoogleGenAI({ apiKey: 'fake' });
    console.log('client.live.connect config', ai.live.connect.toString());
}
test();
