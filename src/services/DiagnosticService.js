const logs = [];
export const DiagnosticService = {
    log(event, data = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            event,
            ...data
        };
        logs.push(entry);
        console.log(`[Diagnostic]: ${event}`, data);
    },
    getLogs() {
        return [...logs];
    },
    clearLogs() {
        logs.length = 0;
    },
    exportLogs() {
        return JSON.stringify(logs, null, 2);
    }
};
