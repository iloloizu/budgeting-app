import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, userQuestion } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        response:
          'LLM API key not configured. Please set ANTHROPIC_API_KEY in your environment variables.',
        disclaimer:
          'This is guidance from an AI assistant, not financial advice.',
      })
    }

    // Gather user's financial data
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    // Get recent budgets (last 6 months)
    const recentBudgets = []
    for (let i = 5; i >= 0; i--) {
      let year = currentYear
      let month = currentMonth - i

      if (month <= 0) {
        month = month + 12
        year = year - 1
      }

      const budget = await prisma.monthlyBudget.findUnique({
        where: {
          userId_year_month: {
            userId,
            year,
            month,
          },
        },
        include: {
          budgetLineItems: {
            include: {
              expenseCategory: true,
            },
          },
        },
      })

      if (budget) {
        recentBudgets.push(budget)
      }
    }

    // Get recent transactions (last 6 months)
    const startDate = new Date(currentYear, currentMonth - 6, 1)
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
        },
      },
      include: {
        expenseCategory: true,
        incomeSource: true,
      },
    })

    // Get income sources
    const incomeSources = await prisma.incomeSource.findMany({
      where: { userId, isActive: true },
    })

    // Get expense categories
    const expenseCategories = await prisma.expenseCategory.findMany({
      where: { userId },
    })

    // Calculate expense summary by category
    const expenseSummary: Record<string, number> = {}
    transactions
      .filter((t) => t.type === 'expense' && t.expenseCategory)
      .forEach((t) => {
        const catName = t.expenseCategory!.name
        expenseSummary[catName] = (expenseSummary[catName] || 0) + t.amount
      })

    // Prepare context for LLM
    const incomeSummary = incomeSources.reduce(
      (sum, source) => sum + source.amount,
      0
    )

    const averageMonthlyExpenses =
      recentBudgets.length > 0
        ? recentBudgets.reduce(
            (sum, b) => sum + b.totalPlannedExpenses,
            0
          ) / recentBudgets.length
        : 0

    const prompt = `You are a financial budgeting assistant. The user has asked: "${userQuestion}"

Here is their financial context:

Monthly Income: $${incomeSummary.toFixed(2)}
Average Monthly Expenses: $${averageMonthlyExpenses.toFixed(2)}
Average Monthly Savings: $${(incomeSummary - averageMonthlyExpenses).toFixed(2)}

Expense Categories (last 6 months):
${Object.entries(expenseSummary)
  .map(([cat, amount]) => `- ${cat}: $${amount.toFixed(2)}`)
  .join('\n')}

Income Sources:
${incomeSources.map((s) => `- ${s.name}: $${s.amount.toFixed(2)}/month`).join('\n')}

Please provide helpful, actionable budgeting advice based on this information. Be specific and practical. Format your response in clear paragraphs or bullet points.`

    // Try different model names - Anthropic model names can vary
    // Common options: claude-3-5-sonnet-20241022, claude-3-5-sonnet, claude-3-sonnet-20240229
    // If one doesn't work, try: claude-3-opus-20240229 or claude-3-haiku-20240307
    const modelName = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
    
    let message
    try {
      message = await anthropic.messages.create({
        model: modelName,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })
    } catch (modelError: any) {
      // If the model doesn't exist, try fallback models
      if (modelError.error?.type === 'not_found_error' || modelError.status === 404) {
        console.log(`Model ${modelName} not found, trying fallback models...`)
        const fallbackModels = [
          'claude-3-5-sonnet',
          'claude-3-sonnet-20240229',
          'claude-3-opus-20240229',
          'claude-3-haiku-20240307'
        ]
        
        let lastError = modelError
        for (const fallbackModel of fallbackModels) {
          try {
            message = await anthropic.messages.create({
              model: fallbackModel,
              max_tokens: 1024,
              messages: [
                {
                  role: 'user',
                  content: prompt,
                },
              ],
            })
            console.log(`Successfully used fallback model: ${fallbackModel}`)
            break
          } catch (fallbackError) {
            lastError = fallbackError
            continue
          }
        }
        
        if (!message) {
          throw lastError
        }
      } else {
        throw modelError
      }
    }

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({
      response: responseText,
      disclaimer:
        'This is guidance from an AI assistant, not financial advice.',
    })
  } catch (error: any) {
    console.error('Error calling LLM:', error)
    
    // Extract error message from Anthropic API error structure
    let errorMessage = 'Unknown error'
    let errorDetails = ''
    
    if (error.error) {
      errorMessage = error.error.message || JSON.stringify(error.error)
      errorDetails = error.error.type || ''
    } else if (error.message) {
      errorMessage = error.message
    }
    
    // If error is a string, try to parse it
    if (typeof error === 'string') {
      try {
        const parsed = JSON.parse(error)
        if (parsed.error) {
          errorMessage = parsed.error.message || errorMessage
          errorDetails = parsed.error.type || errorDetails
        }
      } catch {
        errorMessage = error
      }
    }
    
    return NextResponse.json(
      {
        error: 'Failed to get LLM response',
        message: errorMessage,
        details: errorDetails || errorMessage,
        fullError: JSON.stringify(error, null, 2),
        disclaimer:
          'This is guidance from an AI assistant, not financial advice.',
      },
      { status: 500 }
    )
  }
}

