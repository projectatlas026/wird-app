/**
 * Date Service with Test Override support
 */
export const DateService = {
    getLocalDate(override) {
        if (override) return override;
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    isValidDateString(str) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
        const [y, m, d] = str.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    },
    addMonths(dateStr, months) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1 + months, d);
        if (date.getDate() !== d) date.setDate(0); 
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    addDays(dateStr, days) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d + days);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    diffDays(a, b) {
        const d1 = new Date(a);
        const d2 = new Date(b);
        return Math.floor((d1 - d2) / 86400000);
    },
    getWeekday(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).getDay();
    },
    formatArabic(dateStr) {
        if (!dateStr) return "";
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m-1, d).toLocaleDateString('ar-LY', { 
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
        });
    }
};
