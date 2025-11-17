import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, content, url } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    console.log("Processing content with AI...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a technical knowledge extraction expert. Extract key information from technical content.
            
Return a JSON object with:
1. summary: A concise 2-3 sentence summary
2. key_concepts: Array of 3-7 key technical concepts/topics
3. code_snippets: Array of objects with {language: string, code: string, description: string} for any code found

Be precise and technical. Focus on actionable knowledge.`
          },
          {
            role: "user",
            content: `Title: ${title}\n\nContent:\n${content.substring(0, 15000)}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_knowledge",
            description: "Extract technical knowledge from content",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                key_concepts: { 
                  type: "array",
                  items: { type: "string" }
                },
                code_snippets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      language: { type: "string" },
                      code: { type: "string" },
                      description: { type: "string" }
                    },
                    required: ["language", "code", "description"]
                  }
                }
              },
              required: ["summary", "key_concepts", "code_snippets"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_knowledge" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please check your OpenAI credits." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI processing failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
