import { DateService } from './DateService.js';
import { DiagnosticService } from './DiagnosticService.js';

const SCHEMA_VERSION = 3;

export const StorageService = {
    getStorageKey(env) {
        return env === 'test' ? 'wird_test_data' : 'wird_app_data';
    },

    validateStateShape(data) {
        return (
            data &&
            typeof data === 'object' &&
            !Array.isArray(data) &&
            Number.isInteger(data.schemaVersion) &&
            typeof data.streak === 'number' &&
            Array.isArray(data.units)
        );
    },

    save(state, env = 'production') {
        const key = this.getStorageKey(env);
        try {
            const data = { ...state, schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString() };
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            DiagnosticService.log('STORAGE_SAVE_ERROR', { error: e.message, env });
        }
    },

    load(env = 'production') {
        const key = this.getStorageKey(env);
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        try {
            const data = JSON.parse(raw);
            if (!this.validateStateShape(data)) {
                throw new Error("Invalid state shape");
            }

            if (data.schemaVersion < SCHEMA_VERSION) {
                DiagnosticService.log('STORAGE_MIGRATION', { from: data.schemaVersion, to: SCHEMA_VERSION });
                return this.migrate(data);
            }
            return data;
        } catch (e) {
            DiagnosticService.log('STORAGE_LOAD_CORRUPT', { error: e.message, env });
            localStorage.setItem(`${key}_backup_${Date.now()}`, raw);
            return null;
        }
    },

    migrate(oldData) {
        // Implement real migration logic if needed between versions
        return { ...oldData, schemaVersion: SCHEMA_VERSION };
    },

    reset(env = 'production') {
        const key = this.getStorageKey(env);
        localStorage.removeItem(key);
        DiagnosticService.log('STORAGE_RESET', { env });
    }
};
