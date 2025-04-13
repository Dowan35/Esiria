import dotenv from "dotenv";
import OpenAI from "openai"

// Charger les variables d'environnement
dotenv.config({ path: './key.env' });

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
})

async function main() {
  const completion = await openai.chat.completions.create({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        "role": "user",
        "content": "What is the meaning of life?"
      }
    ]
  })

  console.log(completion.choices[0].message)
}
main()