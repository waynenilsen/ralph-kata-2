import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupFts5() {
  console.log('Setting up FTS5 for todo search...');

  // Create FTS5 virtual table
  console.log('Creating TodoSearchFts virtual table...');
  await prisma.$executeRaw`
    CREATE VIRTUAL TABLE IF NOT EXISTS TodoSearchFts USING fts5(
      id UNINDEXED,
      title,
      description
    )
  `;

  // Create INSERT trigger
  console.log('Creating INSERT trigger...');
  await prisma.$executeRaw`
    CREATE TRIGGER IF NOT EXISTS todo_fts_insert
    AFTER INSERT ON Todo
    BEGIN
      INSERT INTO TodoSearchFts(id, title, description)
      VALUES (NEW.id, NEW.title, COALESCE(NEW.description, ''));
    END
  `;

  // Create UPDATE trigger
  console.log('Creating UPDATE trigger...');
  await prisma.$executeRaw`
    CREATE TRIGGER IF NOT EXISTS todo_fts_update
    AFTER UPDATE OF title, description ON Todo
    BEGIN
      UPDATE TodoSearchFts
      SET title = NEW.title, description = COALESCE(NEW.description, '')
      WHERE id = NEW.id;
    END
  `;

  // Create DELETE trigger
  console.log('Creating DELETE trigger...');
  await prisma.$executeRaw`
    CREATE TRIGGER IF NOT EXISTS todo_fts_delete
    AFTER DELETE ON Todo
    BEGIN
      DELETE FROM TodoSearchFts WHERE id = OLD.id;
    END
  `;

  // Backfill existing todos
  console.log('Backfilling existing todos into FTS table...');

  // First, clear any existing data to avoid duplicates on re-run
  await prisma.$executeRaw`DELETE FROM TodoSearchFts`;

  // Then insert all existing todos
  const backfillCount = await prisma.$executeRaw`
    INSERT INTO TodoSearchFts(id, title, description)
    SELECT id, title, COALESCE(description, '') FROM Todo
  `;

  console.log(`Backfilled ${backfillCount} todos into FTS table`);
  console.log('FTS5 setup complete!');
}

setupFts5()
  .catch((error) => {
    console.error('Error setting up FTS5:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
