import fs from 'fs';
import path from 'path';

// Read the shared/schema.ts file
const schemaPath = path.join(process.cwd(), 'shared', 'schema.ts');
let schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Find the insertReviewSchema definition
const originalReviewSchemaPattern = /export const insertReviewSchema = createInsertSchema\(reviews\)\.pick\(\{[^}]+\}\);/;
const originalReviewSchema = schemaContent.match(originalReviewSchemaPattern)[0];

// Create a modified schema that adds .transform() for date fields
const modifiedReviewSchema = `export const insertReviewSchema = createInsertSchema(reviews)
  .pick({
    carId: true,
    reviewerId: true,
    status: true,
    startDate: true,
    endDate: true,
    cujDatabaseVersionId: true,
  })
  .transform((data) => ({
    ...data,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
  }));`;

// Replace the original schema with the modified one
const updatedSchemaContent = schemaContent.replace(originalReviewSchemaPattern, modifiedReviewSchema);

// Write the updated content back to the file
fs.writeFileSync(schemaPath, updatedSchemaContent);

console.log('Successfully modified insertReviewSchema to handle string dates');