// Quick script to check users in the database
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log('\n📊 Users in database:')
    console.log('='.repeat(60))
    
    if (users.length === 0) {
      console.log('No users found in the database.')
    } else {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name}`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   Created: ${user.createdAt.toLocaleString()}`)
      })
    }

    console.log('\n' + '='.repeat(60))
    console.log(`Total users: ${users.length}`)
  } catch (error) {
    console.error('Error checking users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()

