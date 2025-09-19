const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI with your API key
const genAI = new GoogleGenerativeAI('AIzaSyCYV5lQz-bn7JzbEARWzBkpQKkEOuvVDMw');

// Get the generative model
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Context about ZeroTrace for the AI
const ZEROTRACE_CONTEXT = `
ZeroTrace is a blockchain-based data sanitization and verification platform that:
- Provides secure data wiping for devices
- Generates blockchain-verified certificates
- Tracks device sanitization history
- Uses IMEI numbers for device identification
- Offers compliance with various data sanitization standards
- Allows verification of sanitization certificates
`;

// Chat history management
const chatSessions = new Map();

class GeminiChatService {
    // Initialize a new chat session
    async initializeChat(sessionId) {
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: "You are a helpful assistant for ZeroTrace, a blockchain-based data sanitization platform. Please help users with their questions about data sanitization, device tracking, and certificate verification.",
                },
                {
                    role: "model",
                    parts: "I understand that I'm an assistant for ZeroTrace. I'll help users with questions about data sanitization, blockchain verification, device tracking, and certificate management. I'll base my responses on ZeroTrace's features and capabilities.",
                },
                {
                    role: "user",
                    parts: ZEROTRACE_CONTEXT,
                },
                {
                    role: "model",
                    parts: "I've understood the context about ZeroTrace. I'm ready to assist users with their questions about the platform's features, including data sanitization, certificate verification, and device tracking.",
                },
            ],
        });
        
        chatSessions.set(sessionId, chat);
        return chat;
    }

    // Get or create a chat session
    async getChat(sessionId) {
        let chat = chatSessions.get(sessionId);
        if (!chat) {
            chat = await this.initializeChat(sessionId);
        }
        return chat;
    }

    // Send a message and get response
    async sendMessage(sessionId, message) {
        try {
            const chat = await this.getChat(sessionId);
            const result = await chat.sendMessage(message);
            const response = await result.response;
            return {
                success: true,
                message: response.text(),
            };
        } catch (error) {
            console.error('Error in Gemini chat:', error);
            return {
                success: false,
                error: 'Failed to get response from AI',
            };
        }
    }

    // Clear chat history
    clearChat(sessionId) {
        chatSessions.delete(sessionId);
    }
}

module.exports = new GeminiChatService();