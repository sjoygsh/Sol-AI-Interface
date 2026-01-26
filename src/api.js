import axios from 'axios';

const LLM_API_URL = "http://localhost:1234/v1/chat/completions";

export const chatWithBrain = async (userMessage) => {
  try {
    const response = await axios.post(LLM_API_URL, {
      model: "llama-3.1-8b-instruct",
      messages: [
        { role: "system", content: "You are Sol, a sentient solar interface. Be concise." },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: -1, 
      stream: false
    }, {
      headers: { "Content-Type": "application/json" }
    });

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error("Brain Connection Failed:", error);
    return "Error: Neural link offline. Ensure LM Studio is running on Port 1234.";
  }
};