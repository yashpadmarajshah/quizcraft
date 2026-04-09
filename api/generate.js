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
    
    // 4. ROBUST JSON EXTRACTION
    // First, strip <think> tags if the model uses them
    let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    
    // Find the first '[' and the last ']' to isolate the array
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');

    if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
      console.error("Raw LLM Output missing brackets:", cleanText);
      throw new Error("Could not locate a JSON array in the AI response.");
    }

    // Extract ONLY the array string
    let jsonString = cleanText.substring(firstBracket, lastBracket + 1);

    // 5. SANITIZATION: Remove trailing commas (e.g., {"a": 1,} becomes {"a": 1})
    // This stops the parser from crashing if the AI leaves a comma at the end of a list!
    jsonString = jsonString.replace(/,\s*([\]}])/g, '$1');

    // 6. Safe parsing with detailed error logging
    let parsedData;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("❌ JSON PARSE FAILED!");
      console.error("Exact string that crashed the parser:\n", jsonString);
      throw new Error("AI generated malformed JSON (likely unescaped quotes).");
    }

    // 7. Send the result back to your React app
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("API Error:", error.message);
    // Return a 500 error so the frontend can display the fallback error state gracefully
    return res.status(500).json({ error: "Failed to generate quiz. The AI produced invalid formatting." });
  }
}