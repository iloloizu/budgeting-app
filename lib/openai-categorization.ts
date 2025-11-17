import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

export interface CategorySuggestion {
  categoryName: string
  confidence: number
  reasoning: string
}

/**
 * Use OpenAI API to suggest a category for a transaction
 */
export async function suggestCategoryOpenAI(
  merchantName: string,
  description: string,
  amount: number,
  existingCategories: string[]
): Promise<CategorySuggestion | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  try {
    const categoriesList = existingCategories.length > 0
      ? existingCategories.join(', ')
      : 'No existing categories'

    const prompt = `You are a financial categorization assistant. Given a transaction, suggest the most appropriate expense category.

Transaction details:
- Merchant/Name: ${merchantName}
- Description: ${description}
- Amount: $${amount.toFixed(2)}

Existing categories: ${categoriesList}

Respond with ONLY a JSON object in this exact format:
{
  "categoryName": "Category Name",
  "confidence": 0.95,
  "reasoning": "Brief explanation"
}

Rules:
1. Use an existing category name if it matches well (confidence > 0.8)
2. Suggest a new category name if no existing category fits well
3. Confidence should be 0.0 to 1.0
4. Category names should be concise (1-3 words)
5. Common categories: Food & Dining, Transportation, Shopping, Bills & Utilities, Entertainment, Healthcare, Travel, etc.
6. NEVER suggest "Uncategorized" or "N/A" as a category name - always suggest a specific category

Example responses:
- For "UBER EATS" → {"categoryName": "Food & Dining", "confidence": 0.95, "reasoning": "Food delivery service"}
- For "AMAZON" → {"categoryName": "Shopping", "confidence": 0.85, "reasoning": "Online retailer"}
- For "STARBUCKS" → {"categoryName": "Food & Dining", "confidence": 0.9, "reasoning": "Coffee shop"}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful financial assistant. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    })

    const content = completion.choices[0]?.message?.content
    if (content) {
      const text = content.trim()
      
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          categoryName: parsed.categoryName,
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || '',
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error getting OpenAI category suggestion:', error)
    return null
  }
}

