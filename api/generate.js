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
    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
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
    
    // 4. CLEAN THE LLM OUTPUT
    // First, remove the <think> tags and everything inside them
    let cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, "");
    
    // Then, remove any markdown code block wrappers (```json ... ```) and trim whitespace
    cleanText = cleanText.replace(/```json|```/g, "").trim();

    // Now it should be pure JSON
    const parsedData = JSON.parse(cleanText);

    // 5. Send the result back to your React app
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Failed to generate quiz" });
  }
}