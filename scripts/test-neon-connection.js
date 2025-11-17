// Test script to verify Neon database connection
// Run with: node scripts/test-neon-connection.js

const { PrismaClient } = require('@prisma/client')

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  })

  try {
    console.log('Testing Neon database connection...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden)' : 'NOT SET')
    
    // Test connection
    await prisma.$connect()
    console.log('✅ Successfully connected to database!')

    // Test query - check if User table exists
    const userCount = await prisma.user.count()
    console.log(`✅ User table exists! Current user count: ${userCount}`)

    // Test creating a user
    const testUser = await prisma.user.create({
      data: {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
      },
    })
    console.log('✅ Successfully created test user:', testUser.id)

    // Clean up test user
    await prisma.user.delete({
      where: { id: testUser.id },
    })
    console.log('✅ Test user deleted')

    console.log('\n🎉 All tests passed! Your Neon database is working correctly.')
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error('Error code:', error.code)
    console.error('Error meta:', error.meta)
    
    if (error.code === 'P1001') {
      console.error('\n💡 This error means Prisma cannot reach the database.')
      console.error('   Check:')
      console.error('   1. Is your DATABASE_URL correct?')
      console.error('   2. Is your Neon database running?')
      console.error('   3. Are your firewall/network settings blocking the connection?')
    } else if (error.code === 'P2025') {
      console.error('\n💡 This error means a record was not found.')
    } else if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
      console.error('\n💡 This error means the database tables do not exist.')
      console.error('   Run: npx prisma db push')
    }
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()

