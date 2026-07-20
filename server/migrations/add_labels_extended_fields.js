// Migración: Agregar columnas region, climate y roast_date a generated_labels
import { query } from '../db.js';

export async function addLabelsExtendedFields() {
    console.log('🏷️  Iniciando migración de campos extendidos en generated_labels...');

    try {
        // SQLite no soporta múltiples ADD COLUMN en un solo ALTER TABLE
        const cols = [
            { name: 'region',     def: 'VARCHAR(100)' },
            { name: 'climate',    def: 'VARCHAR(50)' },
            { name: 'roast_date', def: 'DATE' },
        ];
        for (const col of cols) {
            try {
                await query(`ALTER TABLE generated_labels ADD COLUMN ${col.name} ${col.def}`);
            } catch {
                // columna ya existe — ignorar
            }
        }
        console.log('  ✓ Columnas region, climate y roast_date agregadas a generated_labels');

        console.log('✅ Migración de campos extendidos en generated_labels completada.');
    } catch (err) {
        console.error('❌ Error en migración de campos extendidos en generated_labels:', err);
        throw err;
    }
}

if (process.argv[1].endsWith('add_labels_extended_fields.js')) {
    import('dotenv/config').then(() =>
        addLabelsExtendedFields().then(() => process.exit(0)).catch(() => process.exit(1))
    );
}
