export const maxDuration = 60; // Keep the extended timeout just in case!

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Grab the prompt from the frontend request
  const { prompt } = req.body;

  try {
    // 3. Make the call to Sarvam securely from the server
    const response = await fetch("[https://api.sarvam.ai/v1/chat/completions](https://api.sarvam.ai/v1/chat/completions)", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": process.env.SARVAM_API_KEY, 
      },
      body: JSON.stringify({
        model: "sarvam-30b",
        max_tokens: 50000,
        messages: [
          { role: "system", content: "You are a quiz generator. Always respond with valid JSON only. No markdown, no extra text." },
          { role: "user", content: prompt }
        ],
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    
    // 4. ROBUST JSON EXTRACTION
    // First, strip <think> tags if the model uses them
    let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    
    // Find the first '[' and the last ']' to isolate the array
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');

    if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
      console.error("Raw LLM Output:", cleanText);
      throw new Error("Could not locate a JSON array in the AI response.");
    }

    // Extract ONLY the array string
    const jsonString = cleanText.substring(firstBracket, lastBracket + 1);

    // Now it should be pure, safe JSON
    const parsedData = JSON.parse(jsonString);

    // 5. Send the result back to your React app
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("API Error:", error);
    // Return a 500 error so the frontend can display the fallback error state gracefully
    return res.status(500).json({ error: "Failed to parse generated quiz from AI" });
  }
}