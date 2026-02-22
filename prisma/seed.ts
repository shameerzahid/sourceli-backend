import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';
import { seedDefaultPerformanceRulesIfEmpty } from '../src/services/performanceRules.service.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Default admin credentials (should be changed after first login)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sourceli.com';
  const adminPhone = process.env.ADMIN_PHONE || '+1234567890';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: UserRole.ADMIN,
    },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
    console.log(`   Email: ${existingAdmin.email}`);
    console.log(`   ID: ${existingAdmin.id}\n`);
    
    // Optionally update password if ADMIN_PASSWORD is set
    if (process.env.ADMIN_PASSWORD) {
      const passwordHash = await hashPassword(adminPassword);
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { passwordHash },
      });
      console.log('🔐 Admin password updated\n');
    }
  } else {
    // Hash password
    console.log('🔐 Hashing admin password...');
    const passwordHash = await hashPassword(adminPassword);

    // Create admin user
    console.log('👤 Creating admin user...');
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE, // Admin is immediately active
      },
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', admin.email);
    console.log('📱 Phone:', adminPhone);
    console.log('🔑 Password:', adminPassword);
    console.log('👤 Role:', admin.role);
    console.log('✅ Status:', admin.status);
    console.log('🆔 User ID:', admin.id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
    console.log('   You can set custom credentials using environment variables:');
    console.log('   - ADMIN_EMAIL=your@email.com');
    console.log('   - ADMIN_PHONE=+1234567890');
    console.log('   - ADMIN_PASSWORD=YourSecurePassword\n');
  }

  // Seed produce categories (always run, even if admin exists)
  console.log('🌾 Seeding produce categories...');
  const produceCategories = [
    { name: 'Rabbit', unitType: 'units' },
    { name: 'Chicken', unitType: 'units' },
    { name: 'Eggs', unitType: 'units' },
    { name: 'Goat', unitType: 'units' },
    { name: 'Sheep', unitType: 'units' },
    { name: 'Cattle', unitType: 'units' },
    { name: 'Pork', unitType: 'kg' },
    { name: 'Fish', unitType: 'kg' },
    { name: 'Vegetables', unitType: 'kg' },
    { name: 'Fruits', unitType: 'kg' },
    { name: 'Grains', unitType: 'kg' },
    { name: 'Other', unitType: 'kg' },
  ];

  for (const category of produceCategories) {
    const existing = await prisma.produceCategory.findUnique({
      where: { name: category.name },
    });

    if (!existing) {
      await prisma.produceCategory.create({
        data: category,
      });
      console.log(`   ✅ Created category: ${category.name} (${category.unitType})`);
    } else {
      console.log(`   ⏭️  Category already exists: ${category.name}`);
    }
  }
  console.log('✅ Produce categories seeded\n');

  // Seed default performance rules if none exist (Milestone 3)
  console.log('📊 Seeding performance rules...');
  await seedDefaultPerformanceRulesIfEmpty();
  console.log('✅ Performance rules seeded\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


