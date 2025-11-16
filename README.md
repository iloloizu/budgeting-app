# Fortis Wealth

A modern budgeting application built with Next.js, React, TypeScript, Prisma, and SQLite. This app helps you track income, expenses, and savings with monthly budgeting capabilities, similar to Rocket Money.

## Features

- **Monthly Budgeting**: Create and manage monthly budgets with multiple income streams and expense categories
- **Multiple Income Sources**: Track various income streams (salary, freelance, bonuses, etc.)
- **Expense Categories**: Organize expenses into fixed and variable categories
- **Transaction Tracking**: Record and manage income and expense transactions
- **12-Month Savings Projection**: View projected savings over the next 12 months with interactive charts
- **Category Spending Analysis**: Analyze spending by category for any calendar year
- **LLM Budget Assistant**: Get AI-powered budgeting advice using Claude API (optional)
- **User Management**: Simple user system for 1-2 users

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite with Prisma ORM
- **Charts**: Recharts
- **LLM**: Anthropic Claude API (optional)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- (Optional) Anthropic API key for LLM assistant feature

### Installation

1. Clone the repository and navigate to the project directory:

```bash
cd budgeting-app
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./prisma/dev.db"
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
<<<<<<< Updated upstream
TELLER_API_KEY="your-teller-api-key-here"
=======
NEXT_PUBLIC_TELLER_APPLICATION_ID="app_xxxxxx"
NEXT_PUBLIC_TELLER_ENVIRONMENT="sandbox"
TELLER_CERT_PATH="./teller/cert.pem"
TELLER_KEY_PATH="./teller/key.pem"
TELLER_TOKEN_SIGNING_KEY="your-base64-token-signing-key-here"
>>>>>>> Stashed changes
```

Note: 
- The `ANTHROPIC_API_KEY` is optional. If not provided, the LLM assistant will show a message indicating the API key is not configured.
<<<<<<< Updated upstream
- The `TELLER_API_KEY` is optional. If not provided, the Net Worth page will show a message indicating the API key is not configured.
=======
- The `NEXT_PUBLIC_TELLER_APPLICATION_ID` is required for Teller Connect. Get this from your Teller Dashboard.
- The `NEXT_PUBLIC_TELLER_ENVIRONMENT` can be "sandbox", "development", or "production" (defaults to "sandbox").
- The `TELLER_CERT_PATH` and `TELLER_KEY_PATH` are **required** for Teller API calls in development and production environments. These are client certificates for mTLS authentication. Get these from your Teller Dashboard:
  1. Go to your Teller Dashboard
  2. Navigate to your Application settings
  3. Generate or download your client certificate (`cert.pem`) and private key (`key.pem`)
  4. Store them securely in your project (e.g., in a `teller/` directory)
  5. Update the paths in your `.env` file
  6. **Important**: Add `teller/*.pem` to your `.gitignore` to never commit these files
- The `TELLER_TOKEN_SIGNING_KEY` is **optional but recommended** for production. It's used to verify the authenticity of enrollment data from Teller Connect. Without it, the app will still work but will skip signature verification (with a warning). Get this from your Teller Dashboard under Application settings.
>>>>>>> Stashed changes

4. Initialize the database:

```bash
npm run db:push
```

5. Seed the database with sample data (optional):

```bash
npm run db:seed
```

This will create:
- A demo user (demo@example.com)
- Sample income sources
- Sample expense categories
- Monthly budgets for the current year
- Sample transactions for the current month

6. Start the development server:

```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Creating a User

1. On the home page, click "Create New User"
2. Enter your name and email
3. Click "Create"

### Setting Up Monthly Budget

1. Navigate to "Monthly Budget" from the navigation
2. Select the year and month
3. **Add Income Sources**:
   - Click "Add Income Source"
   - Enter name, monthly amount, type (salary, bonus, freelance, other)
   - Mark as active/inactive
4. **Add Expense Categories**:
   - Click "Add Category"
   - Enter category name and type (fixed or variable)
5. **Set Budget Amounts**:
   - Enter planned amounts for each expense category
6. Click "Save Budget"

### Adding Transactions

1. Navigate to "Transactions" from the navigation
2. Select the year and month to view
3. Click "Add Transaction"
4. Fill in:
   - Date
   - Description
   - Amount
   - Type (income or expense)
   - Income source (for income) or expense category (for expenses)
5. Click "Add Transaction"

### Viewing Reports

1. Navigate to "Reports" from the navigation
2. **12-Month Savings Projection**:
   - View a table showing planned income, expenses, and savings for the next 12 months
   - See an interactive line chart visualizing the projection
3. **Category Spending**:
   - Select a year
   - View a table showing total spending per category and percentages
   - See a pie chart visualizing category distribution

### Using LLM Assistant

1. Navigate to "LLM Assistant" from the navigation
2. Enter your question about your budget (e.g., "How can I save an extra $300 per month?")
3. Click "Ask Assistant"
4. Review the AI-generated response

**Note**: You need to set `ANTHROPIC_API_KEY` in your `.env` file for this feature to work.

## Database Management

### View Database

To open Prisma Studio and view/edit your database:

```bash
npm run db:studio
```

### Reset Database

To reset the database:

1. Delete `prisma/dev.db` and `prisma/dev.db-journal` (if exists)
2. Run `npm run db:push`
3. Optionally run `npm run db:seed` to add sample data

## Project Structure

```
budgeting-app/
├── app/
│   ├── api/              # API routes
│   │   ├── users/
│   │   ├── income-sources/
│   │   ├── expense-categories/
│   │   ├── budget/
│   │   ├── transactions/
│   │   ├── reports/
│   │   └── llm-budget/
│   ├── budget/           # Monthly budget page
│   ├── transactions/     # Transactions page
│   ├── reports/          # Reports page
│   ├── assistant/        # LLM assistant page
│   ├── layout.tsx
│   ├── page.tsx          # Dashboard/home page
│   └── globals.css
├── components/           # React components
│   ├── Navigation.tsx
│   └── UserSelector.tsx
├── lib/
│   └── prisma.ts         # Prisma client
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed script
└── README.md
```

## Data Model

- **User**: User accounts
- **IncomeSource**: Income streams (salary, freelance, etc.)
- **ExpenseCategory**: Expense categories (rent, groceries, etc.)
- **MonthlyBudget**: Monthly budget plans
- **BudgetLineItem**: Planned amounts per category per month
- **Transaction**: Actual income and expense transactions

## Styling

The app uses a clean, minimalist black and white design inspired by Savvy Wealth, with:
- Black borders and text on white background
- Simple, clean typography
- Minimal use of color (only in charts)
- Focus on readability and clarity

## Development

### Running Linter

```bash
npm run lint
```

### Building for Production

```bash
npm run build
npm start
```

## Notes

- The app is designed for 1-2 users maximum
- User authentication is simplified (no passwords required)
- All data is stored locally in SQLite
- The LLM assistant feature requires an Anthropic API key

## License

This project is for personal use.

