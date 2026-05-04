import { DateTime } from 'luxon';

/**
 * 格式化时间字符串为指定格式
 */
export const formatDateTime = (dateString: string, format: string = 'yyyy-MM-dd HH:mm:ss'): string => {
    if (!dateString) return '';

    try {
        const dt = DateTime.fromISO(dateString);
        if (!dt.isValid) return dateString;
        return dt.toFormat(format);
    } catch {
        return dateString;
    }
};
