import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create a sample user
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@example.com',
    },
  })

  console.log('Created user:', user)

  // Create income sources
  const salary = await prisma.incomeSource.upsert({
    where: { id: 'income-1' },
    update: {},
    create: {
      id: 'income-1',
      userId: user.id,
      name: 'Primary Salary',
      amount: 5000,
      type: 'salary',
      isActive: true,
    },
  })

  const freelance = await prisma.incomeSource.upsert({
    where: { id: 'income-2' },
    update: {},
    create: {
      id: 'income-2',
      userId: user.id,
      name: 'Freelance Work',
      amount: 1000,
      type: 'freelance',
      isActive: true,
    },
  })

  console.log('Created income sources')

  // Create expense categories
  const rent = await prisma.expenseCategory.upsert({
    where: { id: 'cat-1' },
    update: {},
    create: {
      id: 'cat-1',
      userId: user.id,
      name: 'Rent',
      type: 'fixed',
    },
  })

  const utilities = await prisma.expenseCategory.upsert({
    where: { id: 'cat-2' },
    update: {},
    create: {
      id: 'cat-2',
      userId: user.id,
      name: 'Utilities',
      type: 'fixed',
    },
  })

  const groceries = await prisma.expenseCategory.upsert({
    where: { id: 'cat-3' },
    update: {},
    create: {
      id: 'cat-3',
      userId: user.id,
      name: 'Groceries',
      type: 'variable',
    },
  })

  const dining = await prisma.expenseCategory.upsert({
    where: { id: 'cat-4' },
    update: {},
    create: {
      id: 'cat-4',
      userId: user.id,
      name: 'Dining Out',
      type: 'variable',
    },
  })

  const subscriptions = await prisma.expenseCategory.upsert({
    where: { id: 'cat-5' },
    update: {},
    create: {
      id: 'cat-5',
      userId: user.id,
      name: 'Subscriptions',
      type: 'fixed',
    },
  })

  const entertainment = await prisma.expenseCategory.upsert({
    where: { id: 'cat-6' },
    update: {},
    create: {
      id: 'cat-6',
      userId: user.id,
      name: 'Entertainment',
      type: 'variable',
    },
  })

  console.log('Created expense categories')

  // Create monthly budgets for the current year
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  for (let month = 1; month <= 12; month++) {
    const budget = await prisma.monthlyBudget.upsert({
      where: {
        userId_year_month: {
          userId: user.id,
          year: currentYear,
          month: month,
        },
      },
      update: {},
      create: {
        userId: user.id,
        year: currentYear,
        month: month,
        totalPlannedIncome: 6000,
        totalPlannedExpenses: 4500,
        totalPlannedSavings: 1500,
      },
    })

    // Create budget line items
    await prisma.budgetLineItem.upsert({
      where: {
        monthlyBudgetId_expenseCategoryId: {
          monthlyBudgetId: budget.id,
          expenseCategoryId: rent.id,
        },
      },
      update: {},
      create: {
        monthlyBudgetId: budget.id,
        expenseCategoryId: rent.id,
        plannedAmount: 2000,
      },
    })

    await prisma.budgetLineItem.upsert({
      where: {
        monthlyBudgetId_expenseCategoryId: {
          monthlyBudgetId: budget.id,
          expenseCategoryId: utilities.id,
        },
      },
      update: {},
      create: {
        monthlyBudgetId: budget.id,
        expenseCategoryId: utilities.id,
        plannedAmount: 200,
      },
    })

    await prisma.budgetLineItem.upsert({
      where: {
        monthlyBudgetId_expenseCategoryId: {
          monthlyBudgetId: budget.id,
          expenseCategoryId: groceries.id,
        },
      },
      update: {},
      create: {
        monthlyBudgetId: budget.id,
        expenseCategoryId: groceries.id,
        plannedAmount: 600,
      },
    })

    await prisma.budgetLineItem.upsert({
      where: {
        monthlyBudgetId_expenseCategoryId: {
          monthlyBudgetId: budget.id,
          expenseCategoryId: dining.id,
        },
      },
      update: {},
      create: {
        monthlyBudgetId: budget.id,
        expenseCategoryId: dining.id,
        plannedAmount: 400,
      },
    })

    await prisma.budgetLineItem.upsert({
      where: {
        monthlyBudgetId_expenseCategoryId: {
          monthlyBudgetId: budget.id,
          expenseCategoryId: subscriptions.id,
        },
      },
      update: {},
      create: {
        monthlyBudgetId: budget.id,
        expenseCategoryId: subscriptions.id,
        plannedAmount: 100,
      },
    })

    await prisma.budgetLineItem.upsert({
      where: {
        monthlyBudgetId_expenseCategoryId: {
          monthlyBudgetId: budget.id,
          expenseCategoryId: entertainment.id,
        },
      },
      update: {},
      create: {
        monthlyBudgetId: budget.id,
        expenseCategoryId: entertainment.id,
        plannedAmount: 200,
      },
    })
  }

  console.log('Created monthly budgets')

  // Create sample transactions for the current month
  const today = new Date()
  const transactions = [
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 1),
      description: 'Salary Payment',
      amount: 5000,
      type: 'income' as const,
      incomeSourceId: salary.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 5),
      description: 'Freelance Project',
      amount: 1000,
      type: 'income' as const,
      incomeSourceId: freelance.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 1),
      description: 'Monthly Rent',
      amount: 2000,
      type: 'expense' as const,
      expenseCategoryId: rent.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 3),
      description: 'Electric Bill',
      amount: 120,
      type: 'expense' as const,
      expenseCategoryId: utilities.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 3),
      description: 'Water Bill',
      amount: 80,
      type: 'expense' as const,
      expenseCategoryId: utilities.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 7),
      description: 'Grocery Shopping',
      amount: 250,
      type: 'expense' as const,
      expenseCategoryId: groceries.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 10),
      description: 'Restaurant Dinner',
      amount: 85,
      type: 'expense' as const,
      expenseCategoryId: dining.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 12),
      description: 'Netflix Subscription',
      amount: 15,
      type: 'expense' as const,
      expenseCategoryId: subscriptions.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 12),
      description: 'Spotify Subscription',
      amount: 10,
      type: 'expense' as const,
      expenseCategoryId: subscriptions.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 15),
      description: 'Movie Tickets',
      amount: 30,
      type: 'expense' as const,
      expenseCategoryId: entertainment.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 18),
      description: 'Grocery Shopping',
      amount: 180,
      type: 'expense' as const,
      expenseCategoryId: groceries.id,
    },
    {
      userId: user.id,
      date: new Date(currentYear, currentMonth - 1, 20),
      description: 'Coffee Shop',
      amount: 25,
      type: 'expense' as const,
      expenseCategoryId: dining.id,
    },
  ]

  for (const transaction of transactions) {
    await prisma.transaction.create({
      data: transaction,
    })
  }

  console.log('Created sample transactions')
  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

